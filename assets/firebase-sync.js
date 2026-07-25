import { firebaseConfig, storeConfig } from "./firebase-config.js";

/* The Firebase SDK lives on a cross-origin CDN. Static imports would abort this whole
   module when that CDN is unreachable, leaving the app hidden behind
   `body.firebase-pending` with no gate and no error. Load it dynamically instead so the
   gate is always painted and an offline device can still unlock with its local PIN. */
const FIREBASE_CDN = "https://www.gstatic.com/firebasejs/12.16.0/";

let setPersistence, browserLocalPersistence, onAuthStateChanged, signInWithEmailAndPassword;
let collection, doc, getDoc, getDocs, onSnapshot, writeBatch, setDoc;
let auth = null;
let db = null;
let cloudAvailable = false;

async function loadFirebase(){
  const [appModule, authModule, storeModule] = await Promise.all([
    import(`${FIREBASE_CDN}firebase-app.js`),
    import(`${FIREBASE_CDN}firebase-auth.js`),
    import(`${FIREBASE_CDN}firebase-firestore.js`)
  ]);
  ({setPersistence, browserLocalPersistence, onAuthStateChanged, signInWithEmailAndPassword} = authModule);
  ({collection, doc, getDoc, getDocs, onSnapshot, writeBatch, setDoc} = storeModule);
  const app = appModule.initializeApp(firebaseConfig);
  auth = authModule.getAuth(app);
  db = storeModule.initializeFirestore(app, {
    localCache: storeModule.persistentLocalCache({tabManager: storeModule.persistentMultipleTabManager()})
  });
  cloudAvailable = true;
}

const DATA_GROUPS = ["customers", "prescriptions", "sales", "products"];
const PIN_HASH_KEY = "kaneroptik_pin_hash_v1";
const PIN_SALT_KEY = "kaneroptik_pin_salt_v1";
const ATTEMPT_KEY = "kaneroptik_pin_attempts_v1";
const LOCK_UNTIL_KEY = "kaneroptik_pin_lock_until_v1";
const encoder = new TextEncoder();

let cloudStarted = false;
let remoteState = null;
let pendingLocalState = null;
let localSaveTimer = null;
let remoteApplyTimer = null;
let inactivityTimer = null;
let unlocked = false;

function logoSVG(){
  return '<svg width="29" height="29" viewBox="0 0 40 40" fill="none" aria-hidden="true"><circle cx="13" cy="20" r="9" stroke="currentColor" stroke-width="2.4"/><circle cx="27" cy="20" r="9" stroke="currentColor" stroke-width="2.4"/><path d="M22.5 18.5c0-1.8 1-3 2.7-3M3 19c1-2.4 2.4-3.4 3.8-3.4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
}

function createGate(){
  clearTimeout(window.__kanerGateFailsafe);
  document.getElementById("firebaseGateFallback")?.remove();
  const gate = document.createElement("div");
  gate.id = "firebaseGate";
  gate.className = "firebase-gate";
  gate.innerHTML = '<main class="firebase-gate-card" id="firebaseGateCard"></main>';
  document.body.appendChild(gate);
  document.body.classList.remove("firebase-pending");
  document.body.classList.add("app-locked");
  return gate;
}

const gate = createGate();
const gateCard = gate.querySelector("#firebaseGateCard");

function showConnecting(){
  gate.dataset.mode = "connecting";
  gateShell(`
    <h1>Bağlanılıyor…</h1>
    <p class="firebase-gate-copy">Güvenli oturum hazırlanıyor.</p>
    <div class="firebase-gate-status">Firebase ile güvenli bağlantı</div>`);
}

function showConnectionError(){
  gate.dataset.mode = "offline-error";
  gate.classList.remove("is-hidden");
  document.body.classList.add("app-locked");
  // No PIN was ever verified on this device, so keep the records fully hidden rather
  // than merely blurred behind the gate.
  document.body.classList.add("firebase-pending");
  gateShell(`
    <h1>Bağlantı kurulamadı</h1>
    <p class="firebase-gate-copy">Güvenli oturum bileşenleri yüklenemedi ve bu cihazda kayıtlı bir PIN yok. İnternet bağlantınızı kontrol edip tekrar deneyin.</p>
    <button class="btn btn-primary firebase-gate-submit" type="button" id="gateRetry">Yeniden dene</button>
    <div class="firebase-gate-help">Verileriniz bu cihazda korunuyor; hiçbir kayıt silinmedi.</div>`);
  gateCard.querySelector("#gateRetry").addEventListener("click", () => location.reload());
}

function gateShell(content){
  gateCard.innerHTML = `
    <div class="firebase-gate-brand">
      <div class="firebase-gate-logo">${logoSVG()}</div>
      <div><strong>Kaner Optik</strong><span>Özel işletme yönetimi</span></div>
    </div>
    ${content}`;
}

function setGateMessage(message, success = false){
  const el = gateCard.querySelector("#gateMessage");
  if(!el) return;
  el.textContent = message || "";
  el.style.color = success ? "var(--success)" : "var(--danger)";
}

function setBusy(button, busy, label){
  if(!button) return;
  button.disabled = busy;
  if(busy) button.innerHTML = '<span class="firebase-gate-spinner"></span> Bağlanıyor…';
  else button.textContent = label;
}

function showDeviceSetup(){
  gate.dataset.mode = "device-setup";
  gate.classList.remove("is-hidden");
  document.body.classList.add("app-locked");
  gateShell(`
    <h1>Bu cihazı bağlayın</h1>
    <p class="firebase-gate-copy">Bu işlem yalnızca ilk kurulumda yapılır. Sonraki açılışlarda sadece 4 haneli PIN istenir.</p>
    <form id="gateForm" autocomplete="off">
      <div class="field">
        <label>Firebase yönetici parolası</label>
        <input id="gatePassword" type="password" autocomplete="current-password" required placeholder="Firebase Authentication parolası">
      </div>
      <div class="form-row">
        <div class="field"><label>4 haneli PIN</label><input id="gatePin" class="pin-input" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required></div>
        <div class="field"><label>PIN tekrar</label><input id="gatePinAgain" class="pin-input" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required></div>
      </div>
      <button class="btn btn-primary firebase-gate-submit" id="gateSubmit" type="submit">Cihazı bağla</button>
      <div class="firebase-gate-message" id="gateMessage"></div>
    </form>
    <div class="firebase-gate-help">Yetkili hesap: ${storeConfig.authorizedEmail}<br>Parola cihazda saklanmaz; Firebase yalnızca güvenli oturumu hatırlar.</div>`);
  gateCard.querySelector("#gateForm").addEventListener("submit", handleDeviceSetup);
  gateCard.querySelector("#gatePassword").focus();
}

function showPinSetup(){
  gate.dataset.mode = "pin-setup";
  gate.classList.remove("is-hidden");
  document.body.classList.add("app-locked");
  gateShell(`
    <h1>PIN oluşturun</h1>
    <p class="firebase-gate-copy">Bu cihazda uygulamayı açmak için kullanacağınız 4 haneli kodu belirleyin.</p>
    <form id="gateForm" autocomplete="off">
      <div class="form-row">
        <div class="field"><label>4 haneli PIN</label><input id="gatePin" class="pin-input" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required autofocus></div>
        <div class="field"><label>PIN tekrar</label><input id="gatePinAgain" class="pin-input" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required></div>
      </div>
      <button class="btn btn-primary firebase-gate-submit" type="submit">PIN’i kaydet</button>
      <div class="firebase-gate-message" id="gateMessage"></div>
    </form>`);
  gateCard.querySelector("#gateForm").addEventListener("submit", handlePinSetup);
}

function showUnlock(message = ""){
  unlocked = false;
  clearTimeout(inactivityTimer);
  gate.dataset.mode = "unlock";
  gate.classList.remove("is-hidden");
  document.body.classList.add("app-locked");
  gateShell(`
    <h1>Tekrar hoş geldiniz</h1>
    <p class="firebase-gate-copy">Kaner Optik yönetim panelini açmak için PIN kodunu girin.</p>
    <form id="gateForm" autocomplete="off">
      <div class="field"><label>4 haneli PIN</label><input id="gatePin" class="pin-input" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required autofocus></div>
      <button class="btn btn-primary firebase-gate-submit" type="submit">Uygulamayı aç</button>
      <div class="firebase-gate-message" id="gateMessage">${escapeText(message)}</div>
    </form>
    <div class="firebase-gate-status">${cloudAvailable ? "Firebase ile güvenli bağlantı" : "Çevrimdışı mod · yalnızca bu cihazdaki veriler"}</div>`);
  gateCard.querySelector("#gateForm").addEventListener("submit", handleUnlock);
  gateCard.querySelector("#gatePin").focus();
}

function escapeText(value){
  return String(value || "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
}

async function handleDeviceSetup(event){
  event.preventDefault();
  const password = gateCard.querySelector("#gatePassword").value;
  const pin = gateCard.querySelector("#gatePin").value;
  const repeat = gateCard.querySelector("#gatePinAgain").value;
  if(!/^\d{4}$/.test(pin)){ setGateMessage("PIN tam olarak 4 rakam olmalıdır."); return; }
  if(pin !== repeat){ setGateMessage("PIN kodları birbiriyle eşleşmiyor."); return; }
  const button = gateCard.querySelector("#gateSubmit");
  setBusy(button, true, "Cihazı bağla");
  try{
    await setPersistence(auth, browserLocalPersistence);
    await signInWithEmailAndPassword(auth, storeConfig.authorizedEmail, password);
    await savePin(pin);
    await unlockApp();
  }catch(error){
    console.error("Firebase bağlantı hatası:", error);
    setGateMessage(firebaseErrorMessage(error));
    setBusy(button, false, "Cihazı bağla");
  }
}

async function handlePinSetup(event){
  event.preventDefault();
  const pin = gateCard.querySelector("#gatePin").value;
  const repeat = gateCard.querySelector("#gatePinAgain").value;
  if(!/^\d{4}$/.test(pin)){ setGateMessage("PIN tam olarak 4 rakam olmalıdır."); return; }
  if(pin !== repeat){ setGateMessage("PIN kodları birbiriyle eşleşmiyor."); return; }
  await savePin(pin);
  await unlockApp();
}

async function handleUnlock(event){
  event.preventDefault();
  const lockUntil = Number(localStorage.getItem(LOCK_UNTIL_KEY) || 0);
  if(lockUntil > Date.now()){
    const seconds = Math.ceil((lockUntil - Date.now()) / 1000);
    setGateMessage(`${seconds} saniye sonra tekrar deneyin.`);
    return;
  }
  const pin = gateCard.querySelector("#gatePin").value;
  if(await verifyPin(pin)){
    localStorage.removeItem(ATTEMPT_KEY);
    localStorage.removeItem(LOCK_UNTIL_KEY);
    await unlockApp();
    return;
  }
  const attempts = Number(localStorage.getItem(ATTEMPT_KEY) || 0) + 1;
  if(attempts >= 5){
    localStorage.setItem(ATTEMPT_KEY, "0");
    localStorage.setItem(LOCK_UNTIL_KEY, String(Date.now() + 30000));
    setGateMessage("Çok fazla hatalı deneme. 30 saniye bekleyin.");
  }else{
    localStorage.setItem(ATTEMPT_KEY, String(attempts));
    setGateMessage(`PIN hatalı. ${5-attempts} deneme hakkı kaldı.`);
  }
  gateCard.querySelector("#gatePin").value = "";
  gateCard.querySelector("#gatePin").focus();
}

async function savePin(pin){
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePin(pin, salt);
  localStorage.setItem(PIN_SALT_KEY, bytesToBase64(salt));
  localStorage.setItem(PIN_HASH_KEY, bytesToBase64(hash));
}

async function verifyPin(pin){
  if(!/^\d{4}$/.test(pin)) return false;
  const saltValue = localStorage.getItem(PIN_SALT_KEY);
  const hashValue = localStorage.getItem(PIN_HASH_KEY);
  if(!saltValue || !hashValue) return false;
  const actual = await derivePin(pin, base64ToBytes(saltValue));
  const expected = base64ToBytes(hashValue);
  if(actual.length !== expected.length) return false;
  let difference = 0;
  for(let index=0; index<actual.length; index++) difference |= actual[index] ^ expected[index];
  return difference === 0;
}

async function derivePin(pin, salt){
  const key = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({name:"PBKDF2", hash:"SHA-256", salt, iterations:150000}, key, 256);
  return new Uint8Array(bits);
}

function bytesToBase64(bytes){
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value){
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}

function firebaseErrorMessage(error){
  const code = error && error.code;
  if(code === "auth/invalid-credential" || code === "auth/wrong-password") return "Firebase parolası hatalı.";
  if(code === "auth/too-many-requests") return "Çok fazla deneme yapıldı. Bir süre sonra tekrar deneyin.";
  if(code === "auth/network-request-failed") return "İnternet bağlantısı kurulamadı.";
  return "Firebase bağlantısı kurulamadı. Ayarları kontrol edin.";
}

async function unlockApp(){
  unlocked = true;
  gate.classList.add("is-hidden");
  document.body.classList.remove("app-locked");
  resetInactivityTimer();
  if(!cloudAvailable){
    window.KanerApp.toast("Çevrimdışı mod: değişiklikler bu cihazda saklanıyor.", "error");
    return;
  }
  if(!cloudStarted) await startCloudSync();
}

function lockApp(reason = ""){
  if(!cloudAvailable){
    if(localStorage.getItem(PIN_HASH_KEY)) return showUnlock(reason);
    return showConnectionError();
  }
  if(!auth.currentUser) return showDeviceSetup();
  showUnlock(reason);
}

function resetInactivityTimer(){
  if(!unlocked) return;
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => lockApp("Güvenliğiniz için uygulama otomatik kilitlendi."), storeConfig.autoLockMinutes * 60 * 1000);
}

function addManualLockButtons(){
  const sidebarFooter = document.querySelector(".sidebar-footer");
  if(sidebarFooter && !document.getElementById("manualLockButton")){
    const button = document.createElement("button");
    button.id = "manualLockButton";
    button.className = "sidebar-link";
    button.type = "button";
    button.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><span>Uygulamayı kilitle</span>';
    button.addEventListener("click", () => lockApp());
    sidebarFooter.prepend(button);
  }
  const mobileActions = document.querySelector(".mobile-app-actions");
  if(mobileActions && !document.getElementById("mobileLockButton")){
    const button = document.createElement("button");
    button.id = "mobileLockButton";
    button.className = "mobile-icon-btn";
    button.type = "button";
    button.setAttribute("aria-label", "Uygulamayı kilitle");
    button.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
    button.addEventListener("click", () => lockApp());
    mobileActions.prepend(button);
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
    window.KanerApp.toast("Firebase senkronizasyonu hazır.", "success");
  }catch(error){
    console.error("Firestore başlatılamadı:", error);
    cloudStarted = false;
    window.KanerApp.toast("Firebase bağlantısı kurulamadı; yerel veriler kullanılmaya devam ediyor.", "error");
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
["pointerdown","keydown","touchstart"].forEach(name => document.addEventListener(name, resetInactivityTimer, {passive:true}));
document.addEventListener("visibilitychange", () => { if(!document.hidden) resetInactivityTimer(); });

async function bootstrap(){
  showConnecting();
  try{
    await loadFirebase();
  }catch(error){
    console.error("Firebase SDK yüklenemedi:", error);
    addManualLockButtons();
    // A locally stored PIN is verified with WebCrypto alone, so a device that has
    // already been set up can still get in and keep working against localStorage.
    if(localStorage.getItem(PIN_HASH_KEY)) showUnlock("Bulut bağlantısı yok; çevrimdışı modda açılıyor.");
    else showConnectionError();
    return;
  }
  setPersistence(auth, browserLocalPersistence).catch(() => {});
  onAuthStateChanged(auth, user => {
    addManualLockButtons();
    if(!user){ showDeviceSetup(); return; }
    if(!localStorage.getItem(PIN_HASH_KEY)) showPinSetup();
    else showUnlock();
  });
}

bootstrap();
