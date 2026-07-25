import { firebaseConfig, storeConfig } from "./firebase-config.js";

/* The Firebase SDK lives on a cross-origin CDN. Static imports would abort this whole
   module when that CDN is unreachable; loading it dynamically keeps the app usable
   against localStorage alone. The app renders immediately either way — there is no
   lock screen and no sign-in step in front of it. */
const FIREBASE_CDN = "https://www.gstatic.com/firebasejs/12.16.0/";

let collection, doc, getDoc, getDocs, onSnapshot, writeBatch, setDoc;
let db = null;

const DATA_GROUPS = ["customers", "prescriptions", "sales", "products"];

/* Left over from the removed PIN lock; clear them so an old device does not keep a
   stale credential hash in localStorage forever. */
const LEGACY_PIN_KEYS = [
  "kaneroptik_pin_hash_v1",
  "kaneroptik_pin_salt_v1",
  "kaneroptik_pin_attempts_v1",
  "kaneroptik_pin_lock_until_v1"
];

let cloudStarted = false;
let remoteState = null;
let pendingLocalState = null;
let localSaveTimer = null;

function clearLegacyPinState(){
  LEGACY_PIN_KEYS.forEach(key => localStorage.removeItem(key));
}

async function connect(){
  const [appModule, authModule, storeModule] = await Promise.all([
    import(`${FIREBASE_CDN}firebase-app.js`),
    import(`${FIREBASE_CDN}firebase-auth.js`),
    import(`${FIREBASE_CDN}firebase-firestore.js`)
  ]);
  ({collection, doc, getDoc, getDocs, onSnapshot, writeBatch, setDoc} = storeModule);

  const app = appModule.initializeApp(firebaseConfig);
  const auth = authModule.getAuth(app);
  db = storeModule.initializeFirestore(app, {
    localCache: storeModule.persistentLocalCache({tabManager: storeModule.persistentMultipleTabManager()})
  });

  // Every device shares one store, so the session only needs to satisfy the Firestore
  // rules — nothing is scoped per user and nobody is ever prompted.
  await authModule.setPersistence(auth, authModule.browserLocalPersistence).catch(() => {});
  if(!auth.currentUser){
    await authModule.signInAnonymously(auth);
  }
}

function emptyRemoteState(){
  return {customers:[], prescriptions:[], sales:[], products:[], settings:null};
}

async function readCloudState(){
  const next = emptyRemoteState();
  await Promise.all(DATA_GROUPS.map(async group => {
    const snapshot = await getDocs(collection(db, "stores", storeConfig.id, group));
    next[group] = snapshot.docs.map(item => item.data());
  }));
  const settingsSnapshot = await getDoc(doc(db, "stores", storeConfig.id, "meta", "settings"));
  next.settings = settingsSnapshot.exists() ? settingsSnapshot.data() : null;
  return next;
}

async function startCloudSync(){
  cloudStarted = true;
  try{
    const cloud = await readCloudState();
    const hasCloudData = DATA_GROUPS.some(group => cloud[group].length) || !!cloud.settings;
    if(hasCloudData){
      remoteState = cloneState(cloud);
      applyRemoteState();
    }else{
      remoteState = emptyRemoteState();
      queueCloudWrite(window.KanerApp.snapshot(), true);
    }
    attachRealtimeListeners();
  }catch(error){
    console.error("Firestore başlatılamadı:", error);
    cloudStarted = false;
    window.KanerApp.toast("Bulut senkronizasyonu kurulamadı; veriler bu cihazda saklanıyor.", "error");
  }
}

function attachRealtimeListeners(){
  DATA_GROUPS.forEach(group => {
    let firstSnapshot = true;
    onSnapshot(collection(db, "stores", storeConfig.id, group), snapshot => {
      if(firstSnapshot){ firstSnapshot = false; return; }
      const map = new Map(remoteState[group].map(item => [item.id, item]));
      snapshot.docChanges().forEach(change => {
        if(change.type === "removed") map.delete(change.doc.id);
        else map.set(change.doc.id, change.doc.data());
      });
      remoteState[group] = Array.from(map.values());
      scheduleRemoteApply();
    }, cloudListenerError);
  });
  let firstSettings = true;
  onSnapshot(doc(db, "stores", storeConfig.id, "meta", "settings"), snapshot => {
    if(firstSettings){ firstSettings = false; return; }
    if(snapshot.exists()) remoteState.settings = snapshot.data();
    scheduleRemoteApply();
  }, cloudListenerError);
}

function cloudListenerError(error){
  console.error("Firestore dinleme hatası:", error);
  window.KanerApp.toast("Bulut senkronizasyonu durdu. Firebase kurallarını kontrol edin.", "error");
}

let remoteApplyTimer = null;
function scheduleRemoteApply(){
  clearTimeout(remoteApplyTimer);
  remoteApplyTimer = setTimeout(applyRemoteState, 120);
}

function applyRemoteState(){
  if(!remoteState) return;
  const current = window.KanerApp.snapshot();
  window.KanerApp.applyCloud({
    customers: remoteState.customers || [],
    prescriptions: remoteState.prescriptions || [],
    sales: remoteState.sales || [],
    products: remoteState.products || [],
    settings: remoteState.settings || current.settings
  });
}

function cloneState(state){
  return JSON.parse(JSON.stringify(state));
}

function sameValue(left, right){
  return JSON.stringify(left) === JSON.stringify(right);
}

function queueCloudWrite(state, immediate = false){
  if(!cloudStarted || !remoteState) return;
  pendingLocalState = cloneState(state);
  clearTimeout(localSaveTimer);
  localSaveTimer = setTimeout(flushCloudWrite, immediate ? 0 : 450);
}

function flushCloudWrite(){
  if(!pendingLocalState || !remoteState) return;
  const next = pendingLocalState;
  pendingLocalState = null;
  const operations = [];

  DATA_GROUPS.forEach(group => {
    const previousMap = new Map((remoteState[group] || []).map(item => [item.id, item]));
    const nextMap = new Map((next[group] || []).map(item => [item.id, item]));
    nextMap.forEach((item, id) => {
      if(!sameValue(previousMap.get(id), item)) operations.push({type:"set", ref:doc(db,"stores",storeConfig.id,group,id), data:item});
    });
    previousMap.forEach((item, id) => {
      if(!nextMap.has(id)) operations.push({type:"delete", ref:doc(db,"stores",storeConfig.id,group,id)});
    });
  });

  for(let offset=0; offset<operations.length; offset+=400){
    const batch = writeBatch(db);
    operations.slice(offset, offset+400).forEach(operation => {
      if(operation.type === "set") batch.set(operation.ref, operation.data);
      else batch.delete(operation.ref);
    });
    batch.commit().catch(cloudWriteError);
  }
  if(!sameValue(remoteState.settings, next.settings)){
    setDoc(doc(db,"stores",storeConfig.id,"meta","settings"), next.settings).catch(cloudWriteError);
  }
  remoteState = cloneState(next);
}

function cloudWriteError(error){
  console.error("Firestore kayıt hatası:", error);
  window.KanerApp.toast("Değişiklik buluta gönderilemedi; cihazda saklandı.", "error");
}

window.addEventListener("kaner:db-changed", event => queueCloudWrite(event.detail));

async function bootstrap(){
  clearLegacyPinState();
  try{
    await connect();
  }catch(error){
    // Unreachable CDN, blocked network, or anonymous sign-in not enabled in the
    // Firebase console. The app is already on screen and fully usable against
    // localStorage, so this is a background degradation, not a blocking failure.
    console.error("Firebase bağlantısı kurulamadı:", error);
    window.KanerApp.toast("Çevrimdışı mod: değişiklikler bu cihazda saklanıyor.", "error");
    return;
  }
  await startCloudSync();
}

bootstrap();
