const CONFIG = {"addresses": [{"id": "lidskaya-34", "title": "ул. Лидская, 34, ТЦ «Лидский»", "note": "Основной кандидат для первой точки.", "map": "https://yandex.by/maps/10274/grodno/search/%D1%83%D0%BB.%20%D0%9B%D0%B8%D0%B4%D1%81%D0%BA%D0%B0%D1%8F%2C%2034"}, {"id": "belusha-41a", "title": "ул. Белуша, 41А", "note": "Альтернатива Лидской, 34 в том же кластере.", "map": "https://yandex.by/maps/10274/grodno/search/%D1%83%D0%BB.%20%D0%91%D0%B5%D0%BB%D1%83%D1%88%D0%B0%2C%2041%D0%90"}, {"id": "repina-54", "title": "ул. Репина, 54", "note": "Проверить реальный пешеходный поток и условия помещения.", "map": "https://yandex.by/maps/10274/grodno/search/%D1%83%D0%BB.%20%D0%A0%D0%B5%D0%BF%D0%B8%D0%BD%D0%B0%2C%2054"}, {"id": "rumlevskiy-10", "title": "Румлёвский проспект, 10", "note": "Перспективный район роста; выяснить причину закрытия прежней точки.", "map": "https://yandex.by/maps/10274/grodno/search/%D0%A0%D1%83%D0%BC%D0%BB%D1%91%D0%B2%D1%81%D0%BA%D0%B8%D0%B9%20%D0%BF%D1%80%D0%BE%D1%81%D0%BF%D0%B5%D0%BA%D1%82%2C%2010"}, {"id": "makarovoy-2", "title": "ул. Валентины Макаровой, 2", "note": "Растущий район Грандичи; нужен объект на первой линии.", "map": "https://yandex.by/maps/10274/grodno/search/%D1%83%D0%BB.%20%D0%92%D0%B0%D0%BB%D0%B5%D0%BD%D1%82%D0%B8%D0%BD%D1%8B%20%D0%9C%D0%B0%D0%BA%D0%B0%D1%80%D0%BE%D0%B2%D0%BE%D0%B9%2C%202"}, {"id": "molodaya-7a", "title": "ул. Молодая, 7А, ЖК «Погораны»", "note": "Только компактный формат с доставкой и проверкой заселённости.", "map": "https://yandex.by/maps/10274/grodno/search/%D1%83%D0%BB.%20%D0%9C%D0%BE%D0%BB%D0%BE%D0%B4%D0%B0%D1%8F%2C%207%D0%90"}, {"id": "magistralnaya-10", "title": "ул. Магистральная, 10, ЖК «Мир»", "note": "Резерв: компактный магазин или пункт самовывоза.", "map": "https://yandex.by/maps/10274/grodno/search/%D1%83%D0%BB.%20%D0%9C%D0%B0%D0%B3%D0%B8%D1%81%D1%82%D1%80%D0%B0%D0%BB%D1%8C%D0%BD%D0%B0%D1%8F%2C%2010"}], "checklist": [["housing_dense", "Вокруг плотная жилая застройка", "Район"], ["housing_occupied", "Дома реально заселены", "Район"], ["foot_traffic", "Есть заметный пешеходный поток", "Район"], ["evening_traffic", "Есть вечерний поток после работы", "Район"], ["pet_owners", "В районе заметны владельцы животных", "Район"], ["grocery_anchor", "Рядом есть продуктовый якорь", "Якоря"], ["transport_stop", "Рядом удобная остановка", "Якоря"], ["daily_services", "Есть аптеки, ПВЗ, кафе и другие сервисы", "Якоря"], ["visible_entrance", "Вход хорошо видно с улицы", "Вход"], ["sign_allowed", "Можно установить заметную вывеску", "Вход"], ["showcase", "Есть витрина", "Вход"], ["accessible", "Нет неудобных ступеней и высокого порога", "Вход"], ["parking", "Есть удобная парковка", "Логистика"], ["short_stop", "Можно подъехать близко ко входу", "Логистика"], ["loading", "Есть нормальная разгрузка товара", "Логистика"], ["delivery_route", "Не нужно носить товар через весь объект", "Логистика"], ["ground_floor", "Первый этаж", "Помещение"], ["separate_entry", "Отдельный вход", "Помещение"], ["area_ok", "Площадь подходит под формат", "Помещение"], ["storage_ok", "Можно выделить 15–20% под склад", "Помещение"], ["water_wc", "Есть вода и санузел", "Помещение"], ["dry_room", "Нет сырости, плесени и протечек", "Помещение"], ["layout_ok", "Удобная планировка под стеллажи и кассу", "Помещение"], ["internet", "Есть интернет и мобильная связь", "Помещение"], ["no_door_competitor", "Нет сильного конкурента прямо у входа", "Конкуренция"], ["competitor_gap", "Есть слабые места у ближайших конкурентов", "Конкуренция"], ["clear_advantage", "Понятно, чем новая точка будет лучше", "Конкуренция"], ["rent_reasonable", "Аренда выглядит разумной", "Аренда"], ["rent_holidays", "Есть арендные каникулы", "Аренда"], ["fees_clear", "Все дополнительные платежи понятны", "Аренда"], ["repair_terms", "Условия ремонта приемлемые", "Аренда"]], "scores": [["housing", "Жилые дома рядом"], ["occupied", "Реальная заселённость"], ["foot", "Пешеходный поток"], ["car", "Автомобильный поток"], ["parking", "Парковка"], ["stop", "Остановка"], ["anchor", "Продуктовый / другой якорь"], ["visibility", "Видимость входа"], ["sign", "Возможность вывески"], ["loading", "Разгрузка товара"], ["condition", "Состояние помещения"], ["storage", "Складская зона"], ["competition", "Слабость конкурентов рядом"], ["overall", "Общая привлекательность"]], "accessHash": "986f06a1fda6a0d98d22c6c1483d260e520231c5c955996153a08cb3442a4cb7", "version": "1.0.0"};
const DB_NAME = "bogatka-location-db-v1";
const DB_VERSION = 1;
const STORE = "records";
const PHOTO_STORE = "photos";
const AUTH_KEY = "bogatka_access_authorized_v1";
const TOKEN_KEY = "bogatka_access_token_v1";
let db;
let installPrompt = null;
let saveTimer = null;

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,"0")).join("");
}

async function authorize() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  const token = params.get("access");
  if (token && await sha256Hex(token) === CONFIG.accessHash) {
    localStorage.setItem(AUTH_KEY, "1");
    localStorage.setItem(TOKEN_KEY, token);
    history.replaceState(null, "", location.pathname + location.search);
  }
  const ok = localStorage.getItem(AUTH_KEY) === "1";
  $("#lock").classList.toggle("hidden", ok);
  $("#app").classList.toggle("hidden", !ok);
  return ok;
}

function openDB() {
  return new Promise((resolve,reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      if (!d.objectStoreNames.contains(PHOTO_STORE)) d.createObjectStore(PHOTO_STORE, {keyPath:"id"});
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(store,key) {
  return new Promise((resolve,reject) => {
    const req = db.transaction(store,"readonly").objectStore(store).get(key);
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
function idbPut(store,value,key) {
  return new Promise((resolve,reject) => {
    const os = db.transaction(store,"readwrite").objectStore(store);
    const req = key === undefined ? os.put(value) : os.put(value,key);
    req.onsuccess=()=>resolve();
    req.onerror=()=>reject(req.error);
  });
}
function idbDelete(store,key) {
  return new Promise((resolve,reject) => {
    const req = db.transaction(store,"readwrite").objectStore(store).delete(key);
    req.onsuccess=()=>resolve();
    req.onerror=()=>reject(req.error);
  });
}
function idbAll(store) {
  return new Promise((resolve,reject) => {
    const req = db.transaction(store,"readonly").objectStore(store).getAll();
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
function idbClear(store) {
  return new Promise((resolve,reject) => {
    const req = db.transaction(store,"readwrite").objectStore(store).clear();
    req.onsuccess=()=>resolve();
    req.onerror=()=>reject(req.error);
  });
}

function esc(s="") {
  return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}
