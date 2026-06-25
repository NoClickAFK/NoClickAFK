const BOGATKA_PENDING_CLEAR_KEY = "bogatka_pending_cloud_clear_v34";
let bogatkaPremiumSelectMenu = null;
let bogatkaPremiumSelectActive = null;
let bogatkaPremiumSelectObserver = null;
let bogatkaPremiumSelectTimer = null;

function bogatkaReadPendingClear() {
  try { return JSON.parse(localStorage.getItem(BOGATKA_PENDING_CLEAR_KEY) || "null"); }
  catch (_) { return null; }
}

function bogatkaWritePendingClear(value) {
  if (value) localStorage.setItem(BOGATKA_PENDING_CLEAR_KEY, JSON.stringify(value));
  else localStorage.removeItem(BOGATKA_PENDING_CLEAR_KEY);
}

function bogatkaRawPut() {
  return typeof cloudOriginalIdbPut !== "undefined" && cloudOriginalIdbPut ? cloudOriginalIdbPut : idbPut;
}

function bogatkaRawDelete() {
  return typeof cloudOriginalIdbDelete !== "undefined" && cloudOriginalIdbDelete ? cloudOriginalIdbDelete : idbDelete;
}

async function bogatkaWithoutCloudTracking(operation) {
  const hasFlag = typeof cloudApplyingRemote !== "undefined";
  const previous = hasFlag ? cloudApplyingRemote : false;
  if (hasFlag) cloudApplyingRemote = true;
  try { return await operation(); }
  finally { if (hasFlag) cloudApplyingRemote = previous; }
}

function bogatkaMarkLocationReset(id, photos = []) {
  if (typeof cloudMutateState !== "function") return;
  cloudMutateState(state => {
    state.dirtyLocations ||= [];
    if (!state.dirtyLocations.includes(id)) state.dirtyLocations.push(id);
    state.dirtyPhotos ||= [];
    state.deletedPhotos ||= {};
    for (const photo of photos) {
      state.deletedPhotos[photo.id] = photo.storagePath || null;
      state.dirtyPhotos = state.dirtyPhotos.filter(photoId => photoId !== photo.id);
    }
  });
}

function bogatkaMarkFullReset(photos = []) {
  if (typeof cloudMutateState !== "function") return;
  cloudMutateState(state => {
    state.dirtyLocations = locations.map(item => item.id);
    state.stateDirty = true;
    state.metaDirty = false;
    state.dirtyPhotos = [];
    state.deletedPhotos ||= {};
    for (const photo of photos) state.deletedPhotos[photo.id] = photo.storagePath || null;
  });
}

async function bogatkaRemoveCloudPhotoFiles(rows) {
  const paths = (rows || []).map(row => row.storage_path).filter(Boolean);
  if (!paths.length) return;
  const { error } = await cloudClient.storage.from(BOGATKA_SUPABASE.photoBucket).remove(paths);
  if (error) throw new Error(error.message);
}

async function bogatkaClearCloudLocation(id) {
  if (!cloudSession || !navigator.onLine) throw new Error("Облачное удаление ожидает подключения.");
  await cloudEnsureProject();
  const { data: remoteLocation, error: locationError } = await cloudClient
    .from("locations")
    .select("id")
    .eq("project_id", cloudProjectId)
    .eq("client_id", id)
    .maybeSingle();
  if (locationError) throw new Error(locationError.message);

  if (remoteLocation?.id) {
    const { data: photoRows, error: photoReadError } = await cloudClient
      .from("photos")
      .select("id,storage_path")
      .eq("project_id", cloudProjectId)
      .eq("location_id", remoteLocation.id);
    if (photoReadError) throw new Error(photoReadError.message);
    await bogatkaRemoveCloudPhotoFiles(photoRows || []);
    const { error: deleteError } = await cloudClient
      .from("photos")
      .delete()
      .eq("project_id", cloudProjectId)
      .eq("location_id", remoteLocation.id);
    if (deleteError) throw new Error(deleteError.message);
  }

  const item = locations.find(location => location.id === id);
  if (item) {
    const { error: upsertError } = await cloudClient.from("locations").upsert({
      project_id: cloudProjectId,
      client_id: item.id,
      title: item.title || item.address || "Без названия",
      address: item.address || null,
      note: item.note || null,
      status: null,
      object_type: null,
      form_data: { updatedAt: new Date().toISOString() },
      sort_order: locations.findIndex(location => location.id === id),
      updated_by: cloudSession.user.id,
    }, { onConflict:"project_id,client_id" });
    if (upsertError) throw new Error(upsertError.message);
  }
}

async function bogatkaClearCloudAll() {
  if (!cloudSession || !navigator.onLine) throw new Error("Облачное удаление ожидает подключения.");
  await cloudEnsureProject();
  const { data: photoRows, error: photoReadError } = await cloudClient
    .from("photos")
    .select("id,storage_path")
    .eq("project_id", cloudProjectId);
  if (photoReadError) throw new Error(photoReadError.message);
  await bogatkaRemoveCloudPhotoFiles(photoRows || []);
  const { error: photoDeleteError } = await cloudClient.from("photos").delete().eq("project_id", cloudProjectId);
  if (photoDeleteError) throw new Error(photoDeleteError.message);

  const now = new Date().toISOString();
  const rows = locations.map((item, index) => ({
    project_id: cloudProjectId,
    client_id: item.id,
    title: item.title || item.address || "Без названия",
    address: item.address || null,
    note: item.note || null,
    status: null,
    object_type: null,
    form_data: { updatedAt: now },
    sort_order: index,
    updated_by: cloudSession.user.id,
  }));
  if (rows.length) {
    const { error: locationsError } = await cloudClient.from("locations").upsert(rows, { onConflict:"project_id,client_id" });
    if (locationsError) throw new Error(locationsError.message);
  }
  const { error: stateError } = await cloudClient.from("project_state").upsert({
    project_id: cloudProjectId,
    data: { updatedAt: now },
    updated_by: cloudSession.user.id,
  });
  if (stateError) throw new Error(stateError.message);
}

async function bogatkaFlushPendingClear() {
  const pending = bogatkaReadPendingClear();
  if (!pending || !cloudSession || !navigator.onLine) return;
  if (cloudSyncing) {
    setTimeout(bogatkaFlushPendingClear, 700);
    return;
  }
  const previousSyncing = cloudSyncing;
  cloudSyncing = true;
  try {
    cloudSetStatus("syncing", "Удаляю очищенные данные из облака…");
    if (pending.all) await bogatkaClearCloudAll();
    else for (const id of pending.locations || []) await bogatkaClearCloudLocation(id);
    bogatkaWritePendingClear(null);
    if (typeof cloudMutateState === "function" && pending.all) {
      cloudMutateState(state => { state.deletedPhotos = {}; state.dirtyPhotos = []; });
    }
  } catch (error) {
    console.error(error);
    cloudSetStatus("offline", "Локально очищено. Облачное удаление будет повторено автоматически.");
    return;
  } finally {
    cloudSyncing = previousSyncing;
  }
  if (!previousSyncing) await cloudSyncAll();
}

async function bogatkaClearLocationV34(id) {
  const item = locations.find(location => location.id === id);
  if (!item) return;
  if (!confirm(`Очистить все поля и фотографии локации «${item.title || id}»? Состояние можно будет вернуть кнопкой «Восстановить».`)) return;

  showSaving();
  const data = await getLocationData(id);
  const photos = (await idbAll(PHOTO_STORE)).filter(photo => photo.locationId === id);
  const now = new Date().toISOString();
  const put = bogatkaRawPut();
  const remove = bogatkaRawDelete();

  await bogatkaWithoutCloudTracking(async () => {
    await put(STORE, { data, photos, clearedAt:now }, `undo:${id}`);
    await put(STORE, { updatedAt:now }, `location:${id}`);
    for (const photo of photos) await remove(PHOTO_STORE, photo.id);
  });
  bogatkaMarkLocationReset(id, photos);

  const pending = bogatkaReadPendingClear() || { all:false, locations:[] };
  if (!pending.all && !pending.locations.includes(id)) pending.locations.push(id);
  bogatkaWritePendingClear(pending);

  renderLocations();
  await updateSummary();
  showSaved();
  setTimeout(() => bogatkaFlushPendingClear(), 80);
}

async function bogatkaClearAllV34() {
  if (!confirm("Очистить все заполненные поля и фотографии во всех локациях — на этом устройстве и в облаке? Это действие нельзя отменить общей кнопкой восстановления.")) return;

  showSaving();
  const photos = await idbAll(PHOTO_STORE);
  const now = new Date().toISOString();
  const put = bogatkaRawPut();
  const remove = bogatkaRawDelete();

  await bogatkaWithoutCloudTracking(async () => {
    for (const item of locations) {
      await put(STORE, { updatedAt:now }, `location:${item.id}`);
      await remove(STORE, `undo:${item.id}`);
    }
    await put(STORE, { updatedAt:now }, "global");
    for (const photo of photos) await remove(PHOTO_STORE, photo.id);
  });
  bogatkaMarkFullReset(photos);
  bogatkaWritePendingClear({ all:true, locations:[] });

  document.querySelectorAll("[data-global]").forEach(element => { element.value = ""; });
  renderLocations();
  await updateSummary();
  showSaved();
  setTimeout(() => bogatkaFlushPendingClear(), 80);
}

if (typeof clearLocation === "function") clearLocation = bogatkaClearLocationV34;
if (typeof clearAllData === "function") clearAllData = bogatkaClearAllV34;

function bogatkaEnsureSelectMenu() {
  if (bogatkaPremiumSelectMenu) return bogatkaPremiumSelectMenu;
  const menu = document.createElement("div");
  menu.className = "premium-select-menu";
  menu.setAttribute("role", "listbox");
  document.body.appendChild(menu);
  bogatkaPremiumSelectMenu = menu;
  return menu;
}

function bogatkaClosePremiumSelect() {
  if (bogatkaPremiumSelectActive?.trigger) {
    bogatkaPremiumSelectActive.trigger.setAttribute("aria-expanded", "false");
    bogatkaPremiumSelectActive.trigger.classList.remove("open");
  }
  bogatkaPremiumSelectActive = null;
  bogatkaPremiumSelectMenu?.classList.remove("open");
  if (bogatkaPremiumSelectMenu) bogatkaPremiumSelectMenu.replaceChildren();
}

function bogatkaPositionPremiumSelect() {
  if (!bogatkaPremiumSelectActive || !bogatkaPremiumSelectMenu?.classList.contains("open")) return;
  const { trigger } = bogatkaPremiumSelectActive;
  if (!trigger.isConnected) return bogatkaClosePremiumSelect();
  const rect = trigger.getBoundingClientRect();
  const menu = bogatkaPremiumSelectMenu;
  const margin = 8;
  const availableBelow = window.innerHeight - rect.bottom - margin;
  const availableAbove = rect.top - margin;
  const openAbove = availableBelow < 180 && availableAbove > availableBelow;
  const maxHeight = Math.max(140, Math.min(340, openAbove ? availableAbove : availableBelow));
  const width = Math.max(rect.width, 180);
  const left = Math.min(Math.max(margin, rect.left), Math.max(margin, window.innerWidth - width - margin));
  menu.style.width = `${width}px`;
  menu.style.maxHeight = `${maxHeight}px`;
  menu.style.left = `${left}px`;
  menu.style.top = openAbove ? "auto" : `${rect.bottom + 7}px`;
  menu.style.bottom = openAbove ? `${window.innerHeight - rect.top + 7}px` : "auto";
  menu.classList.toggle("open-above", openAbove);
}

function bogatkaSyncPremiumSelect(select, trigger) {
  const selected = select.selectedOptions?.[0] || select.options[select.selectedIndex] || select.options[0];
  trigger.querySelector(".premium-select-value").textContent = selected?.textContent || "Выберите";
  trigger.disabled = select.disabled;
}

function bogatkaOpenPremiumSelect(select, trigger) {
  if (select.disabled) return;
  if (bogatkaPremiumSelectActive?.select === select) return bogatkaClosePremiumSelect();
  bogatkaClosePremiumSelect();
  const menu = bogatkaEnsureSelectMenu();
  const fragment = document.createDocumentFragment();

  [...select.options].forEach(option => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "premium-select-option";
    button.dataset.value = option.value;
    button.textContent = option.textContent;
    button.disabled = option.disabled;
    button.classList.toggle("selected", option.selected);
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(option.selected));
    button.addEventListener("click", () => {
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles:true }));
      bogatkaSyncPremiumSelect(select, trigger);
      bogatkaClosePremiumSelect();
      trigger.focus({ preventScroll:true });
    });
    fragment.appendChild(button);
  });

  menu.replaceChildren(fragment);
  bogatkaPremiumSelectActive = { select, trigger };
  trigger.setAttribute("aria-expanded", "true");
  trigger.classList.add("open");
  menu.classList.add("open");
  bogatkaPositionPremiumSelect();
}

function bogatkaEnhanceSelect(select) {
  if (select.dataset.premiumSelect === "1") return;

  if (select.nextElementSibling?.classList.contains("bogatka-role-select")) {
    select.nextElementSibling.remove();
  }
  select.dataset.bogatkaCustom = "1";
  select.dataset.premiumSelect = "1";
  select.classList.remove("bogatka-native-select-hidden");
  select.classList.add("premium-native-select");

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "premium-select-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.innerHTML = '<span class="premium-select-value"></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  select.insertAdjacentElement("afterend", trigger);
  bogatkaSyncPremiumSelect(select, trigger);

  select.addEventListener("change", () => bogatkaSyncPremiumSelect(select, trigger));
  trigger.addEventListener("click", () => bogatkaOpenPremiumSelect(select, trigger));
  trigger.addEventListener("keydown", event => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      bogatkaOpenPremiumSelect(select, trigger);
    } else if (event.key === "Escape") {
      bogatkaClosePremiumSelect();
    }
  });
}

function bogatkaEnhanceAllSelects() {
  document.querySelectorAll("select:not([data-premium-select='1'])").forEach(bogatkaEnhanceSelect);
}

function bogatkaScheduleSelectEnhancement() {
  clearTimeout(bogatkaPremiumSelectTimer);
  bogatkaPremiumSelectTimer = setTimeout(bogatkaEnhanceAllSelects, 30);
}

function bogatkaBindAccountButton() {
  const button = document.querySelector("#accountBtn");
  if (!button || button.dataset.bound === "1") return;
  button.dataset.bound = "1";
  button.addEventListener("click", () => {
    if (typeof cloudOpenModal === "function") cloudOpenModal();
    else document.querySelector("#cloudModal")?.classList.remove("hidden");
  });
}

function bogatkaInitV34() {
  bogatkaEnhanceAllSelects();
  bogatkaBindAccountButton();
  if (!bogatkaPremiumSelectObserver) {
    bogatkaPremiumSelectObserver = new MutationObserver(() => {
      bogatkaScheduleSelectEnhancement();
      bogatkaBindAccountButton();
    });
    bogatkaPremiumSelectObserver.observe(document.body, { childList:true, subtree:true });
  }
  document.addEventListener("pointerdown", event => {
    if (!event.target.closest(".premium-select-trigger,.premium-select-menu")) bogatkaClosePremiumSelect();
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape") bogatkaClosePremiumSelect(); });
  window.addEventListener("resize", bogatkaPositionPremiumSelect);
  window.addEventListener("scroll", bogatkaPositionPremiumSelect, true);
  window.addEventListener("online", () => setTimeout(bogatkaFlushPendingClear, 100));
  setTimeout(bogatkaFlushPendingClear, 1200);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bogatkaInitV34, { once:true });
else bogatkaInitV34();
