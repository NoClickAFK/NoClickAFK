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
    script.dataset.criticalStartupV467 = "1";
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

async function bogatkaPrepareCriticalUi() {
  const root = document.getElementById("locations");
  if (!root?.querySelector("[data-location-card]")) throw new Error("Карточки локаций ещё не отрисованы.");
  for (const src of BOGATKA_CRITICAL_STARTUP_SCRIPTS) await bogatkaLoadStartupScript(src);

  await window.BogatkaDecisionUI?.refresh?.();
  const metrics = window.BogatkaDecisionUI?.lastMetrics;
  if (Array.isArray(metrics) && metrics.length && window.BogatkaCardProgressV448?.transformMetrics) {
    window.BogatkaCardProgressV448.transformMetrics(metrics);
  }
  await window.BogatkaCardProgressV448?.renderAll?.();
  await window.BogatkaCardEnhancer?.enhanceAll?.({renderProgress:false});
  window.BogatkaLocationCardCollapseV422?.enhanceAll?.();

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

  window.dispatchEvent(new CustomEvent("bogatka:critical-ui-ready", {detail:{version:"4.6.7"}}));
}

window.BogatkaStartup = {
  version:"4.6.7",
  prepareCriticalUi:bogatkaPrepareCriticalUi,
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
