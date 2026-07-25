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

function report(state, title, hint){
  window.KanerApp.setCloudStatus({state, title, hint: hint || ""});
}

/* "Çevrimdışı" on its own is not actionable — a project can be fully set up and still
   fail here because the console is missing one switch or the rules were never
   redeployed. Name the actual cause and the fix. */
function describeError(error){
  const code = (error && (error.code || error.message)) || "";
  if(/auth\/(operation-not-allowed|admin-restricted-operation)/.test(code)) return {
    title: "Anonim giriş kapalı",
    hint: "Firebase Console > Authentication > Sign-in method bölümünden \"Anonymous\" sağlayıcısını etkinleştirin."
  };
  if(/auth\/(api-key-not-valid|invalid-api-key)/.test(code)) return {
    title: "Firebase yapılandırması geçersiz",
    hint: "assets/firebase-config.js içindeki apiKey ve projectId değerlerini kontrol edin."
  };
  if(/auth\/network-request-failed|Failed to fetch|NetworkError|dynamically imported module/i.test(code)) return {
    title: "Firebase'e ulaşılamadı",
    hint: "İnternet bağlantısını kontrol edin. Bağlantı gelince senkronizasyon kendiliğinden kurulur."
  };
  if(/permission-denied|Missing or insufficient permissions/i.test(code)) return {
    title: "Firestore kuralları erişime izin vermiyor",
    hint: "Bu depodaki firestore.rules dosyasını yayınlayın: npx firebase-tools deploy --only firestore:rules"
  };
  if(/unavailable|failed-precondition/i.test(code)) return {
    title: "Firestore şu anda yanıt vermiyor",
    hint: "Veritabanının oluşturulduğundan emin olun ve birazdan tekrar deneyin."
  };
  return {
    title: "Bulut bağlantısı kurulamadı",
    hint: String(code).slice(0, 160) || "Ayrıntı için tarayıcı konsoluna bakın."
  };
}

/* Idempotent: a retry must not re-run initializeApp/initializeFirestore, which throw
   once the app and the Firestore instance already exist. */
let sdk = null;
let authInstance = null;

async function connect(){
  if(!sdk){
    const [appModule, authModule, storeModule] = await Promise.all([
      import(`${FIREBASE_CDN}firebase-app.js`),
      import(`${FIREBASE_CDN}firebase-auth.js`),
      import(`${FIREBASE_CDN}firebase-firestore.js`)
    ]);
    sdk = {appModule, authModule, storeModule};
  }
  const {appModule, authModule, storeModule} = sdk;
  ({collection, doc, getDoc, getDocs, onSnapshot, writeBatch, setDoc} = storeModule);

  if(!db){
    const app = appModule.initializeApp(firebaseConfig);
    authInstance = authModule.getAuth(app);
    db = storeModule.initializeFirestore(app, {
      localCache: storeModule.persistentLocalCache({tabManager: storeModule.persistentMultipleTabManager()})
    });
    await authModule.setPersistence(authInstance, authModule.browserLocalPersistence).catch(() => {});
  }

  // Every device shares one store, so the session only needs to satisfy the Firestore
  // rules — nothing is scoped per user and nobody is ever prompted.
  if(!authInstance.currentUser){
    await authModule.signInAnonymously(authInstance);
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
    report("connected", "Bulut senkronizasyonu etkin", "Değişiklikler tüm cihazlarda anında güncelleniyor.");
  }catch(error){
    console.error("Firestore başlatılamadı:", error);
    cloudStarted = false;
    const reason = describeError(error);
    report("offline", reason.title, reason.hint);
    window.KanerApp.toast(reason.title + " — veriler bu cihazda saklanıyor.", "error");
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
  const reason = describeError(error);
  report("offline", reason.title, reason.hint);
  window.KanerApp.toast("Bulut senkronizasyonu durdu: " + reason.title, "error");
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
  const reason = describeError(error);
  report("offline", reason.title, reason.hint);
  window.KanerApp.toast("Değişiklik buluta gönderilemedi; cihazda saklandı.", "error");
}

window.addEventListener("kaner:db-changed", event => queueCloudWrite(event.detail));

let connecting = false;
async function bootstrap(){
  if(connecting) return;
  connecting = true;
  report("connecting", "Bağlanılıyor…", "");
  try{
    await connect();
  }catch(error){
    // Unreachable CDN, blocked network, or anonymous sign-in not enabled in the
    // Firebase console. The app is already on screen and fully usable against
    // localStorage, so this is a background degradation, not a blocking failure.
    console.error("Firebase bağlantısı kurulamadı:", error);
    const reason = describeError(error);
    report("offline", reason.title, reason.hint);
    window.KanerApp.toast(reason.title + " — veriler bu cihazda saklanıyor.", "error");
    connecting = false;
    return;
  }
  await startCloudSync();
  connecting = false;
}

// Lets Settings > Veri Yönetimi retry after the console setting is flipped, without
// making the user reload and lose their place.
window.KanerApp.retryCloud = () => { cloudStarted = false; remoteState = null; return bootstrap(); };

clearLegacyPinState();
bootstrap();
