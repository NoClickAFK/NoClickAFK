async function updateSummary() {
  let completed = 0;
  let best = 0;
  let keep = 0;
  for (const locationItem of locations) {
    const data = await getLocationData(locationItem.id);
    const total = totalFromData(data);
    best = Math.max(best, total);
    if (data.date || data.decision || total > 0 || data.updatedAt) completed += 1;
    if (data.decision === "Оставить" || data.status === "Оставить") keep += 1;
  }
  const photos = await idbAll(PHOTO_STORE);
  $("#completedCount").textContent = completed;
  $("#bestScore").textContent = best;
  $("#keepCount").textContent = keep;
  $("#photoCount").textContent = photos.length;
  await updateStorageUsage();
}

async function updateStorageUsage() {
  if (!navigator.storage?.estimate) return;
  const estimate = await navigator.storage.estimate();
  const usedMb = (estimate.usage || 0) / 1024 / 1024;
  const quotaMb = (estimate.quota || 0) / 1024 / 1024;
  $("#storageUsage").textContent = quotaMb ? `${usedMb.toFixed(1)} / ${quotaMb.toFixed(0)} МБ` : `${usedMb.toFixed(1)} МБ`;
}

function updateGpsLabel(id, data) {
  const label = document.querySelector(`[data-gps-label="${id}"]`);
  if (!label) return;
  if (data.gpsLat && data.gpsLon) {
    label.innerHTML = `GPS: ${Number(data.gpsLat).toFixed(6)}, ${Number(data.gpsLon).toFixed(6)} · <a href="${gpsMapUrl(data.gpsLat, data.gpsLon)}" target="_blank" rel="noopener">открыть точку</a>`;
  } else {
    label.textContent = "GPS не сохранён";
  }
}

async function saveGps(id) {
  if (!navigator.geolocation) return alert("Геолокация не поддерживается этим браузером.");
  navigator.geolocation.getCurrentPosition(async position => {
    try {
      const data = await getLocationData(id);
      data.gpsLat = position.coords.latitude;
      data.gpsLon = position.coords.longitude;
      data.gpsAccuracy = position.coords.accuracy;
      data.updatedAt = new Date().toISOString();
      await idbPut(STORE, data, `location:${id}`);
      updateGpsLabel(id, data);
      showSaved();
    } catch (error) { showError(error); }
  }, error => alert(`Не удалось получить геопозицию: ${error.message}`), {enableHighAccuracy:true, timeout:15000, maximumAge:0});
}

async function clearLocation(id) {
  const locationItem = locations.find(item => item.id === id);
  if (!confirm(`Очистить все данные и фотографии локации «${locationItem?.title || id}»? Их можно будет вернуть кнопкой «Восстановить».`)) return;
  try {
    const data = await getLocationData(id);
    const photos = (await idbAll(PHOTO_STORE)).filter(photo => photo.locationId === id);
    await idbPut(STORE, {data, photos, clearedAt:new Date().toISOString()}, `undo:${id}`);
    await idbDelete(STORE, `location:${id}`);
    for (const photo of photos) await idbDelete(PHOTO_STORE, photo.id);
    renderLocations();
  } catch (error) { showError(error); }
}

async function restoreLocation(id) {
  const snapshot = await idbGet(STORE, `undo:${id}`);
  if (!snapshot) return alert("Для этой локации нет сохранённого состояния для восстановления.");
  if (!confirm("Восстановить последнее очищенное состояние этой локации? Текущие данные локации будут заменены.")) return;
  try {
    const currentPhotos = (await idbAll(PHOTO_STORE)).filter(photo => photo.locationId === id);
    for (const photo of currentPhotos) await idbDelete(PHOTO_STORE, photo.id);
    await idbPut(STORE, snapshot.data || {}, `location:${id}`);
    for (const photo of snapshot.photos || []) await idbPut(PHOTO_STORE, photo);
    await idbDelete(STORE, `undo:${id}`);
    renderLocations();
  } catch (error) { showError(error); }
}

async function updateUndoState(id) {
  const snapshot = await idbGet(STORE, `undo:${id}`);
  const button = document.querySelector(`[data-action="restore-location"][data-id="${id}"]`);
  const note = document.querySelector(`[data-undo-note="${id}"]`);
  if (button) button.disabled = !snapshot;
  if (note) note.textContent = snapshot ? `Можно восстановить состояние до ${new Date(snapshot.clearedAt).toLocaleString("ru-RU")}` : "";
}

function openLocationModal(id="") {
  const locationItem = id ? locations.find(item => item.id === id) : null;
  $("#editLocationId").value = locationItem?.id || "";
  $("#locationTitle").value = locationItem?.title || "";
  $("#locationAddress").value = locationItem?.address || "";
  $("#locationNote").value = locationItem?.note || "";
  $("#locationModalTitle").textContent = locationItem ? "Изменить локацию" : "Добавить локацию";
  $("#deleteLocationBtn").classList.toggle("hidden", !locationItem?.custom);
  $("#locationModal").classList.remove("hidden");
}
function closeLocationModal() {
  $("#locationModal").classList.add("hidden");
}
async function saveLocationFromModal() {
  const editId = $("#editLocationId").value;
  const title = $("#locationTitle").value.trim();
  const address = $("#locationAddress").value.trim();
  const note = $("#locationNote").value.trim();
  if (!address) return alert("Укажите адрес для карты.");
  let targetId = editId;
  if (editId) {
    const index = locations.findIndex(item => item.id === editId);
    if (index >= 0) locations[index] = {...locations[index], title:title || address, address, note};
  } else {
    targetId = `custom-${crypto.randomUUID()}`;
    locations.push({id:targetId, title:title || address, address, note, custom:true, createdAt:new Date().toISOString()});
  }
  await saveLocations();
  closeLocationModal();
  renderLocations();
  document.querySelector(`[data-location-card="${targetId}"]`)?.scrollIntoView({behavior:"smooth"});
}
async function deleteCustomLocation() {
  const id = $("#editLocationId").value;
  const locationItem = locations.find(item => item.id === id);
  if (!locationItem?.custom) return;
  if (!confirm(`Удалить локацию «${locationItem.title}» вместе с её данными и фотографиями? Перед удалением рекомендуется сделать резервную копию.`)) return;
  const photos = (await idbAll(PHOTO_STORE)).filter(photo => photo.locationId === id);
  for (const photo of photos) await idbDelete(PHOTO_STORE, photo.id);
  await idbDelete(STORE, `location:${id}`);
  await idbDelete(STORE, `undo:${id}`);
  locations = locations.filter(item => item.id !== id);
  await saveLocations();
  closeLocationModal();
  renderLocations();
}

function revokeObjectUrls() {
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls.clear();
}

async function decodeImage(file) {
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(file);
    return {source:bitmap, width:bitmap.width, height:bitmap.height, close:() => bitmap.close?.()};
  }
  const dataUrl = await blobToDataURL(file);
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
  return {source:image, width:image.naturalWidth, height:image.naturalHeight, close:() => {}};
}

async function processImage(file) {
  const decoded = await decodeImage(file);
  const maxDimension = 3200;
  const scale = Math.min(1, maxDimension / Math.max(decoded.width, decoded.height));
  const width = Math.max(1, Math.round(decoded.width * scale));
  const height = Math.max(1, Math.round(decoded.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", {alpha:false});
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(decoded.source, 0, 0, width, height);
  decoded.close();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.90));
  if (!blob) throw new Error("Не удалось обработать фотографию.");
  return {blob, width, height};
}

async function handlePhotoFiles(input) {
  const locationId = input.dataset.photoLocation;
  const category = input.dataset.photoCategory || "other";
  const files = [...input.files];
  if (!files.length) return;
  showSaving();
  try {
    for (const file of files) {
      const processed = await processImage(file);
      await idbPut(PHOTO_STORE, {
        id:crypto.randomUUID(), locationId, category, createdAt:new Date().toISOString(),
        originalName:file.name || "photo.jpg", caption:"", width:processed.width, height:processed.height,
        size:processed.blob.size, blob:processed.blob
      });
    }
    input.value = "";
    await renderPhotoCategory(locationId, category);
    await updateSummary();
    showSaved();
  } catch (error) { showError(error); }
}

async function renderAllPhotoCategories(locationId) {
  for (const [category] of PHOTO_CATEGORIES) await renderPhotoCategory(locationId, category);
}

async function renderPhotoCategory(locationId, category) {
  const root = document.querySelector(`[data-photos="${locationId}:${category}"]`);
  if (!root) return;
  const photos = (await idbAll(PHOTO_STORE)).filter(photo => photo.locationId === locationId && (photo.category || "other") === category);
  root.innerHTML = "";
  for (const photo of photos) {
    const url = URL.createObjectURL(photo.blob);
    objectUrls.add(url);
    const card = document.createElement("div");
    card.className = "photo";
    card.innerHTML = `
      <div class="photo-preview"><img loading="lazy" alt="${esc(photo.caption || photo.originalName || "Фото")}"><button class="photo-delete" title="Удалить">×</button></div>
      <input type="text" value="${esc(photo.caption || "")}" placeholder="Подпись к фото">
      <div class="photo-meta">${photo.width || "?"}×${photo.height || "?"} · ${((photo.size || photo.blob.size || 0)/1024/1024).toFixed(1)} МБ</div>`;
    card.querySelector("img").src = url;
    card.querySelector(".photo-preview").addEventListener("click", event => {
      if (event.target.closest(".photo-delete")) return;
      openPhotoViewer(url, photo.caption || photo.originalName || "Фотография локации");
    });
    card.querySelector(".photo-delete").addEventListener("click", async event => {
      event.stopPropagation();
      if (!confirm("Удалить эту фотографию?")) return;
      await idbDelete(PHOTO_STORE, photo.id);
      await renderPhotoCategory(locationId, category);
      await updateSummary();
    });
    card.querySelector("input").addEventListener("input", event => {
      clearTimeout(event.target._saveTimer);
      event.target._saveTimer = setTimeout(async () => {
        photo.caption = event.target.value;
        await idbPut(PHOTO_STORE, photo);
        showSaved();
      }, 300);
    });
    root.appendChild(card);
  }
}

function openPhotoViewer(url, caption) {
  $("#viewerImage").src = url;
  $("#viewerCaption").textContent = caption || "";
  $("#photoViewer").classList.remove("hidden");
}
function closePhotoViewer() {
  $("#photoViewer").classList.add("hidden");
  $("#viewerImage").src = "";
}

async function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
function dataURLToBlob(dataURL) {
  const [meta, data] = dataURL.split(",");
  const mime = meta.match(/:(.*?);/)?.[1] || "application/octet-stream";
  const bytes = atob(data);
  const array = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index++) array[index] = bytes.charCodeAt(index);
  return new Blob([array], {type:mime});
}
