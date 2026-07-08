const DB_NAME = "bogatka-location-db-v1";
const DB_VERSION = 2;
const STORE = "records";
const PHOTO_STORE = "photos";
const AUTH_KEY = "bogatka_access_authorized_v1";
const TOKEN_KEY = "bogatka_access_token_v1";
const ACCESS_PIN_HASH = "a98a69d554f7a03a3b5a9e1792b443c1938d5a48b323933be3fe90c9c2cfe64d";
let db;
let locations = [];
let installPrompt = null;
let saveTimer = null;
const objectUrls = new Set();
let bogatkaAuthorized = false;
let bogatkaAppRevealed = false;
let bogatkaCloudInitPromise = null;
let bogatkaCloudFirstSyncReady = Promise.resolve({status:"not-started"});
let bogatkaCloudFirstSyncCompleted = false;
let bogatkaCloudAuthListenerInstalled = false;
let bogatkaCloudWindowHooksInstalled = false;
let bogatkaCloudPrepared = false;
let bogatkaCloudLastInitResult = null;
let bogatkaCloudLastFirstSyncResult = null;
let bogatkaCloudSyncModuleError = null;

const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const esc = (value="") => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
const mapUrl = address => `https://yandex.by/maps/10274/grodno/search/${encodeURIComponent(address || "Гродно")}`;
const gpsMapUrl = (lat, lon) => `https://yandex.by/maps/10274/grodno/?ll=${encodeURIComponent(lon)},${encodeURIComponent(lat)}&z=17`;

function setAuthorizedShell(allowed, {reveal=false} = {}) {
  bogatkaAuthorized = Boolean(allowed);
  const lock = $("#lock");
  const app = $("#app");
  if (lock) lock.classList.toggle("hidden", bogatkaAuthorized);
  if (app) app.classList.toggle("hidden", !(bogatkaAuthorized && reveal));
  if (bogatkaAuthorized && reveal) bogatkaAppRevealed = true;
}

function revealAuthorizedApp() {
  if (!bogatkaAuthorized) return false;
  setAuthorizedShell(true, {reveal:true});
  window.dispatchEvent(new CustomEvent("bogatka:app-visible", {detail:{source:"critical-ui-ready"}}));
  return true;
}

const BOGATKA_CRITICAL_STARTUP_SCRIPTS = [
  "./decision-core-v340.js",
  "./suite-core-v400.js",
  "./decision-ui-v340.js",
  "./compare-v430.js",
  "./location-card-collapse-v422.js",
  "./status-next-task-v447.js",
  "./card-progress-init-v448.js",
  "./card-progress-v448.js",
];
const BOGATKA_CLOUD_SYNC_SCRIPTS = [
  ["./sync-merge-v412.js", () => window.BogatkaSyncMerge?.merge, "sync merge"],
  ["./sync-state-v412.js", () => window.BogatkaSyncState?.ready, "sync state"],
  ["./cloud-stability-v401.js", () => window.BogatkaCloudStability?.version, "cloud stability"],
  ["./sync-field-compat-v416.js", () => window.BogatkaSyncFieldCompatV416?.ready, "sync field compatibility"],
  ["./sync-runtime-v412.js", () => window.BogatkaSyncIntegrity?.ready, "sync integrity"],
  ["./sync-ui-v412.js", () => window.BogatkaSyncCompatibility?.ready, "sync UI compatibility"],
];

function bogatkaStartupScriptExists(src) {
  const target = new URL(src, location.href).href;
  return [...document.scripts].some(script => script.src === target || script.getAttribute("src") === src);
}

function bogatkaLoadStartupScript(src) {
  if (bogatkaStartupScriptExists(src)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.criticalStartupV468 = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Не удалось загрузить критический модуль запуска: ${src}`));
    document.head.appendChild(script);
  });
}

function bogatkaWaitFor(predicate, label, timeoutMs = 9000) {
  const started = performance.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      let ok = false;
      try { ok = Boolean(predicate()); } catch (_) { ok = false; }
      if (ok) return resolve(true);
      if (performance.now() - started > timeoutMs) return reject(new Error(`Не дождались готовности критического UI: ${label}`));
      requestAnimationFrame(tick);
    };
    tick();
  });
}

async function bogatkaRefreshCriticalUi() {
  await window.BogatkaDecisionUI?.refresh?.();
  const metrics = window.BogatkaDecisionUI?.lastMetrics;
  if (Array.isArray(metrics) && metrics.length && window.BogatkaCardProgressV448?.transformMetrics) {
    window.BogatkaCardProgressV448.transformMetrics(metrics);
  }
  await window.BogatkaCardProgressV448?.renderAll?.();
  await window.BogatkaCardEnhancer?.enhanceAll?.({renderProgress:false});
  window.BogatkaLocationCardCollapseV422?.enhanceAll?.();
}

async function bogatkaWaitForStableCriticalUi() {
  await bogatkaWaitFor(() => {
    const panel = document.getElementById("locationComparisonPanel");
    const cards = [...document.querySelectorAll("[data-location-card]")];
    if (!panel || panel.open || panel.querySelector(":scope > summary")?.getAttribute("aria-expanded") !== "false") return false;
    if (!cards.length) return false;
    return cards.every(card => {
      const badges = [...card.querySelectorAll("[data-card-recommendation-v448]")].filter(node => {
        const style = getComputedStyle(node);
        return !node.hidden && style.display !== "none" && style.visibility !== "hidden";
      });
      if (badges.length !== 1) return false;
      const badge = badges[0];
      return Boolean(badge.textContent.trim() && badge.dataset.recommendationClass && badge.classList.contains("recommendation-status-v448"));
    });
  }, "comparison panel and authoritative location recommendations");
}

async function bogatkaLoadCloudSyncModules() {
  if (window.BogatkaSyncIntegrity?.ready && window.BogatkaSyncCompatibility?.ready && window.BogatkaSyncFieldCompatV416?.ready) return {status:"already-ready"};
  for (const [src, predicate, label] of BOGATKA_CLOUD_SYNC_SCRIPTS) {
    await bogatkaLoadStartupScript(src);
    await bogatkaWaitFor(predicate, `${label} ready`, 7000);
  }
  return {status:"ready"};
}

function bogatkaInstallCloudInitOverride() {
  if (typeof cloudInit !== "function" || cloudInit.__bogatkaCloudStartupV468) return;
  const wrapped = bogatkaInitCloudBeforeReveal;
  wrapped.__bogatkaCloudStartupV468 = true;
  wrapped.__base = cloudInit;
  window.cloudInit = wrapped;
  try { cloudInit = wrapped; } catch (_) {}
}

function bogatkaEnsureCloudTopPill() {
  const statusbar = document.querySelector(".statusbar");
  if (statusbar && !document.querySelector("#cloudTopPill")) {
    const pill = document.createElement("span");
    pill.id = "cloudTopPill";
    pill.className = "pill cloud-sync-pill signed_out";
    pill.textContent = "Облако: вход не выполнен";
    statusbar.appendChild(pill);
  }
}

function bogatkaInstallCloudWindowHooks() {
  if (bogatkaCloudWindowHooksInstalled) return;
  bogatkaCloudWindowHooksInstalled = true;
  window.addEventListener("online", () => cloudSyncAll().catch(cloudHandleError));
  window.addEventListener("offline", () => cloudSetStatus("offline"));
}

function bogatkaInstallCloudAuthListener() {
  if (bogatkaCloudAuthListenerInstalled || !cloudClient?.auth?.onAuthStateChange) return;
  bogatkaCloudAuthListenerInstalled = true;
  cloudClient.auth.onAuthStateChange((event, session) => {
    cloudSession = session;
    if (event === "INITIAL_SESSION") return;
    setTimeout(async () => {
      if (session) {
        try {
          await cloudEnsureProject();
          cloudRenderModal();
          await cloudSyncAll();
        } catch (error) { cloudHandleError(error); }
      } else {
        cloudProjectId = null;
        cloudRole = null;
        cloudSetStatus("signed_out");
        cloudRenderModal();
      }
    }, 0);
  });
}

async function bogatkaRunCloudSyncForStartup(preReveal, timeoutMs) {
  let result = await cloudSyncAll({manual:false, preReveal, startup:true});
  if (result?.deferred) {
    await bogatkaWaitFor(() => !cloudSyncing, "existing cloud sync to finish before reveal", timeoutMs);
    result = await cloudSyncAll({manual:false, preReveal, startup:true, afterDeferred:true});
    if (result?.deferred) throw new Error("Первичная облачная синхронизация осталась отложенной.");
  }
  return result;
}

async function bogatkaRunCloudFirstSync({preReveal=false, timeoutMs=14000} = {}) {
  if (!cloudSession) {
    bogatkaCloudLastFirstSyncResult = {status:"no-session", preReveal};
    bogatkaCloudFirstSyncCompleted = true;
    return bogatkaCloudLastFirstSyncResult;
  }
  if (!navigator.onLine) {
    cloudSetStatus("offline", "Изменения сохранены на устройстве и будут отправлены после восстановления связи.");
    bogatkaCloudLastFirstSyncResult = {status:"offline", preReveal};
    bogatkaCloudFirstSyncCompleted = true;
    return bogatkaCloudLastFirstSyncResult;
  }

  const sync = async () => {
    await cloudEnsureProject();
    cloudRenderModal();
    const result = await bogatkaRunCloudSyncForStartup(preReveal, timeoutMs);
    bogatkaCloudFirstSyncCompleted = true;
    bogatkaCloudLastFirstSyncResult = {status:"synced", preReveal, result};
    window.dispatchEvent(new CustomEvent("bogatka:cloud-first-sync-ready", {detail:{version:"4.6.8", preReveal, result:bogatkaCloudLastFirstSyncResult}}));
    return bogatkaCloudLastFirstSyncResult;
  };

  const timeout = new Promise(resolve => setTimeout(() => resolve({status:"timeout", preReveal}), timeoutMs));
  const result = await Promise.race([sync().catch(error => ({status:"error", preReveal, error})), timeout]);
  if (result.status === "error") cloudHandleError(result.error);
  else if (result.status === "timeout") cloudSetStatus("error", "Первичная облачная проверка не завершилась вовремя. Локальные данные показаны, синхронизация продолжится в фоне.");
  bogatkaCloudLastFirstSyncResult = result;
  return result;
}

async function bogatkaInitCloudBeforeReveal(options = {}) {
  const preReveal = Boolean(options.preReveal);
  if (bogatkaCloudInitPromise) {
    const result = await bogatkaCloudInitPromise;
    if (preReveal) await bogatkaCloudFirstSyncReady;
    return result;
  }

  bogatkaCloudInitPromise = (async () => {
    cloudReplaceButtons();
    bogatkaEnsureCloudTopPill();
    if (!window.BOGATKA_SUPABASE || !window.supabase?.createClient) {
      cloudSetStatus("error", "Не удалось загрузить модуль облака.");
      bogatkaCloudLastInitResult = {status:"missing-supabase", session:false, preReveal};
      return bogatkaCloudLastInitResult;
    }
    await cloudWaitForDb();
    cloudInstallTracking();
    if (!cloudClient) {
      cloudClient = window.supabase.createClient(
        BOGATKA_SUPABASE.url,
        BOGATKA_SUPABASE.publishableKey,
        {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}}
      );
    }

    try { await bogatkaLoadCloudSyncModules(); }
    catch (error) { bogatkaCloudSyncModuleError = error; console.error(error); }

    const {data} = await cloudClient.auth.getSession();
    cloudSession = data.session;
    bogatkaInstallCloudAuthListener();
    if (cloudSession) {
      await cloudEnsureProject();
      cloudRenderModal();
      bogatkaCloudFirstSyncReady = bogatkaRunCloudFirstSync({preReveal, timeoutMs:options.timeoutMs || 14000});
      await bogatkaCloudFirstSyncReady;
    } else {
      cloudSetStatus("signed_out");
      bogatkaCloudFirstSyncReady = Promise.resolve({status:"no-session", preReveal});
      bogatkaCloudFirstSyncCompleted = true;
    }

    window.cloudPublishReport = cloudPublishReport;
    window.cloudSyncAll = cloudSyncAll;
    window.cloudApplyRemote = cloudApplyRemote;
    window.cloudFetchRemote = cloudFetchRemote;
    window.cloudEnsureProject = cloudEnsureProject;
    window.cloudSetStatus = cloudSetStatus;
    window.cloudHandleRealtime = cloudHandleRealtime;
    bogatkaInstallCloudWindowHooks();
    bogatkaCloudPrepared = true;
    bogatkaCloudLastInitResult = {status:"ready", session:Boolean(cloudSession), role:cloudRole || null, preReveal, firstSync:bogatkaCloudLastFirstSyncResult, syncModuleLoadError:bogatkaCloudSyncModuleError?.message || null};
    return bogatkaCloudLastInitResult;
  })();
  return bogatkaCloudInitPromise;
}

async function bogatkaPrepareCloudBeforeReveal() {
  try {
    await bogatkaWaitFor(() => typeof window.cloudInit === "function" || typeof cloudInit === "function", "cloud module executed", 3500);
    bogatkaInstallCloudInitOverride();
  } catch (error) {
    console.warn("Cloud module was not ready before local reveal.", error);
    return {status:"cloud-module-missing"};
  }
  return await bogatkaInitCloudBeforeReveal({preReveal:true, timeoutMs:14000});
}

async function bogatkaPrepareCriticalUi() {
  const root = document.getElementById("locations");
  if (!root?.querySelector("[data-location-card]")) throw new Error("Карточки локаций ещё не отрисованы.");
  for (const src of BOGATKA_CRITICAL_STARTUP_SCRIPTS) await bogatkaLoadStartupScript(src);

  await bogatkaRefreshCriticalUi();
  await bogatkaWaitForStableCriticalUi();
  const cloud = await bogatkaPrepareCloudBeforeReveal();
  await bogatkaRefreshCriticalUi();
  await bogatkaWaitForStableCriticalUi();

  window.dispatchEvent(new CustomEvent("bogatka:critical-ui-ready", {detail:{version:"4.6.8", cloud}}));
}

window.BogatkaCloud = {
  version:"4.6.8",
  init:bogatkaInitCloudBeforeReveal,
  installSyncModules:bogatkaLoadCloudSyncModules,
  get firstSyncReady(){ return bogatkaCloudFirstSyncReady; },
  get ready(){ return bogatkaCloudPrepared; },
  get firstSyncCompleted(){ return bogatkaCloudFirstSyncCompleted; },
  get lastInitResult(){ return bogatkaCloudLastInitResult ? {...bogatkaCloudLastInitResult} : null; },
  get lastFirstSyncResult(){ return bogatkaCloudLastFirstSyncResult ? {...bogatkaCloudLastFirstSyncResult} : null; },
  get diagnostics(){ return {syncModuleLoadError:bogatkaCloudSyncModuleError?.message || null, stability:window.BogatkaCloudStability?.diagnostics || null, integrity:window.BogatkaSyncIntegrity?.diagnostics || null, compatibility:window.BogatkaSyncCompatibility?.diagnostics || null}; },
};

window.BogatkaStartup = {
  version:"4.6.8",
  prepareCriticalUi:bogatkaPrepareCriticalUi,
  prepareCloudBeforeReveal:bogatkaPrepareCloudBeforeReveal,
  refreshCriticalUi:bogatkaRefreshCriticalUi,
  revealApp:revealAuthorizedApp,
  isRevealed:() => bogatkaAppRevealed,
  criticalScripts:BOGATKA_CRITICAL_STARTUP_SCRIPTS,
};

async function sha256Hex(text) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2,"0")).join("");
}

async function unlockWithPin() {
  const input = $("#accessPin");
  const error = $("#accessPinError");
  const pin = input?.value.trim() || "";
  if (await sha256Hex(pin) !== ACCESS_PIN_HASH) {
    if (error) error.textContent = "Неверный код доступа.";
    input?.focus();
    return false;
  }
  localStorage.setItem(AUTH_KEY, "1");
  if (error) error.textContent = "";
  $("#lock")?.classList.add("hidden");
  $("#app")?.classList.add("hidden");
  setTimeout(() => location.reload(), 30);
  return true;
}

async function authorize() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  const token = params.get("access");
  if (token && await sha256Hex(token) === ACCESS_HASH) {
    localStorage.setItem(AUTH_KEY, "1");
    localStorage.setItem(TOKEN_KEY, token);
    history.replaceState(null, "", location.pathname + location.search);
  }
  const allowed = localStorage.getItem(AUTH_KEY) === "1";
  setAuthorizedShell(allowed, {reveal:false});
  if (!allowed) {
    $("#unlockBtn")?.addEventListener("click", unlockWithPin, {once:false});
    $("#accessPin")?.addEventListener("keydown", event => {
      if (event.key === "Enter") unlockWithPin();
    });
  }
  return allowed;
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE);
      if (!database.objectStoreNames.contains(PHOTO_STORE)) database.createObjectStore(PHOTO_STORE, {keyPath:"id"});
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbGet(store, key) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, "readonly").objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function idbPut(store, value, key) {
  return new Promise((resolve, reject) => {
    const objectStore = db.transaction(store, "readwrite").objectStore(store);
    const request = key === undefined ? objectStore.put(value) : objectStore.put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
function idbDelete(store, key) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, "readwrite").objectStore(store).delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
function idbAll(store) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, "readonly").objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function idbClear(store) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, "readwrite").objectStore(store).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function setNested(object, path, value) {
  const parts = path.split(".");
  let current = object;
  parts.slice(0,-1).forEach(part => current = current[part] ||= {});
  current[parts.at(-1)] = value;
}
function getNested(object, path) {
  return path.split(".").reduce((current, part) => current?.[part], object);
}
function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Blob);
}
function deepMerge(base, incoming) {
  const result = isPlainObject(base) ? {...base} : {};
  for (const [key, value] of Object.entries(incoming || {})) {
    if (isPlainObject(value)) result[key] = deepMerge(result[key], value);
    else if (value !== "" && value !== null && value !== undefined) result[key] = value;
  }
  return result;
}

async function loadLocations() {
  const saved = await idbGet(STORE, "meta:locations");
  if (Array.isArray(saved) && saved.length) {
    locations = saved;
    const known = new Set(locations.map(item => item.id));
    for (const defaultLocation of DEFAULT_LOCATIONS) {
      if (!known.has(defaultLocation.id)) locations.push({...defaultLocation});
    }
  } else {
    locations = DEFAULT_LOCATIONS.map(item => ({...item}));
  }
  await saveLocations();
}
async function saveLocations() {
  await idbPut(STORE, locations, "meta:locations");
}
async function getLocationData(id) {
  return await idbGet(STORE, `location:${id}`) || {};
}

function showSaving() {
  $("#saveStatus").textContent = "Сохраняю…";
}
function showSaved() {
  clearTimeout(saveTimer);
  $("#saveStatus").textContent = "Все изменения сохранены";
  $("#saveBanner").classList.add("show");
  saveTimer = setTimeout(() => $("#saveBanner").classList.remove("show"), 900);
}
function showError(error) {
  console.error(error);
  alert(error?.name === "QuotaExceededError" ? "Недостаточно памяти браузера. Сохраните резервную копию и удалите лишние фотографии." : `Ошибка: ${error?.message || error}`);
  $("#saveStatus").textContent = "Ошибка сохранения";
}

function totalFromData(data) {
  return SCORES.reduce((sum, [key]) => sum + Number(data?.score?.[key] || 0), 0);
}
