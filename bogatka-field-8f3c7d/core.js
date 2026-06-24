const DB_NAME = "bogatka-location-db-v1";
const DB_VERSION = 2;
const STORE = "records";
const PHOTO_STORE = "photos";
const AUTH_KEY = "bogatka_access_authorized_v1";
const TOKEN_KEY = "bogatka_access_token_v1";
let db;
let locations = [];
let installPrompt = null;
let saveTimer = null;
const objectUrls = new Set();

const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const esc = (value="") => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
const mapUrl = address => `https://yandex.by/maps/10274/grodno/search/${encodeURIComponent(address || "Гродно")}`;
const gpsMapUrl = (lat, lon) => `https://yandex.by/maps/10274/grodno/?ll=${encodeURIComponent(lon)},${encodeURIComponent(lat)}&z=17`;

async function sha256Hex(text) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2,"0")).join("");
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
  $("#lock").classList.toggle("hidden", allowed);
  $("#app").classList.toggle("hidden", !allowed);
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
