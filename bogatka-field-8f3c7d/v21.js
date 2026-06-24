const photoEditState = new Set();
let enhanceTimer = null;

function scheduleEnhance() {
  clearTimeout(enhanceTimer);
  enhanceTimer = setTimeout(() => enhanceV21().catch(console.error), 80);
}

async function enhanceV21() {
  if (typeof db === "undefined" || !db) return;
  await enhanceObjectTypes();
  await enhancePhotoSections();
}

async function enhanceObjectTypes() {
  for (const select of $$('select[data-field="objectType"]')) {
    const streetOption = [...select.options].find(option => option.textContent.trim() === "Стрит-ритейл");
    if (streetOption) streetOption.textContent = "Магазин с отдельным входом с улицы";
    const locationId = select.dataset.location;
    let wrapper = document.querySelector(`[data-object-other="${locationId}"]`);
    if (!wrapper) {
      wrapper = document.createElement("label");
      wrapper.className = "field object-other hidden";
      wrapper.dataset.objectOther = locationId;
      wrapper.innerHTML = `Уточните тип объекта<input type="text" data-location="${locationId}" data-field="objectTypeOther" placeholder="Опишите объект">`;
      select.closest("label")?.insertAdjacentElement("afterend", wrapper);
      const input = wrapper.querySelector("input");
      const data = await getLocationData(locationId);
      input.value = data.objectTypeOther || "";
      input.addEventListener("input", () => {
        showSaving();
        clearTimeout(input._saveTimer);
        input._saveTimer = setTimeout(() => saveField(input).catch(showError), 250);
      });
    }
    const updateVisibility = () => wrapper.classList.toggle("hidden", select.value !== "Другое");
    updateVisibility();
    if (!select.dataset.otherBound) {
      select.dataset.otherBound = "1";
      select.addEventListener("change", updateVisibility);
    }
  }
}

async function enhancePhotoSections() {
  const allPhotos = await idbAll(PHOTO_STORE);
  for (const section of $$('[data-location-card]')) {
    const locationId = section.dataset.locationCard;
    const photoDetails = [...section.querySelectorAll("details")].find(details => details.querySelector("summary")?.textContent.includes("Фотографии"));
    if (!photoDetails) continue;
    const body = photoDetails.querySelector(".details-body");
    if (body && !body.querySelector(".photo-mode-bar")) {
      const bar = document.createElement("div");
      bar.className = "photo-mode-bar";
      bar.innerHTML = `<button class="btn secondary small" type="button">Разрешить редактирование фото</button><span class="photo-mode-status">Удаление и подписи заблокированы</span>`;
      body.prepend(bar);
      bar.querySelector("button").addEventListener("click", () => togglePhotoEditMode(locationId, section, bar));
    }
    applyPhotoEditState(locationId, section);

    for (const root of section.querySelectorAll("[data-photos]")) {
      const [, category] = root.dataset.photos.split(":");
      const photos = allPhotos.filter(photo => photo.locationId === locationId && (photo.category || "other") === category);
      const cards = [...root.querySelectorAll(".photo")];
      cards.forEach((card, index) => enhancePhotoCard(card, photos[index], locationId));
    }
  }
}

function togglePhotoEditMode(locationId, section, bar) {
  if (photoEditState.has(locationId)) photoEditState.delete(locationId);
  else photoEditState.add(locationId);
  applyPhotoEditState(locationId, section);
  const enabled = photoEditState.has(locationId);
  bar.querySelector("button").textContent = enabled ? "Завершить редактирование" : "Разрешить редактирование фото";
  bar.querySelector(".photo-mode-status").textContent = enabled ? "Удаление и подписи разрешены" : "Удаление и подписи заблокированы";
}

function applyPhotoEditState(locationId, section) {
  const enabled = photoEditState.has(locationId);
  section.classList.toggle("photo-edit-enabled", enabled);
  section.querySelectorAll(".photo-caption").forEach(input => input.readOnly = !enabled);
}

function enhancePhotoCard(card, photo, locationId) {
  if (!card || !photo) return;
  const caption = card.querySelector('input[type="text"]');
  if (caption) {
    caption.classList.add("photo-caption");
    caption.readOnly = !photoEditState.has(locationId);
  }
  if (card.querySelector(".photo-actions")) return;
  const actions = document.createElement("div");
  actions.className = "photo-actions";
  actions.innerHTML = `<button class="btn secondary" type="button">Сохранить / поделиться</button>`;
  actions.querySelector("button").addEventListener("click", () => shareOrSavePhoto(photo).catch(showError));
  const meta = card.querySelector(".photo-meta");
  if (meta) meta.insertAdjacentElement("beforebegin", actions);
  else card.appendChild(actions);
}

async function shareOrSavePhoto(photo) {
  const extension = photo.blob.type === "image/png" ? "png" : "jpg";
  const baseName = (photo.caption || photo.originalName || `bogatka-photo-${photo.id}`).replace(/[\\/:*?"<>|]+/g, "-");
  const filename = baseName.toLowerCase().endsWith(`.${extension}`) ? baseName : `${baseName}.${extension}`;
  const file = new File([photo.blob], filename, {type:photo.blob.type || "image/jpeg"});
  if (navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))) {
    await navigator.share({title:"Фотография локации «Богатка»", text:photo.caption || "Фотография локации", files:[file]});
    return;
  }
  downloadBlob(photo.blob, filename);
  alert("Фотография скачана. На iPhone откройте файл и выберите «Поделиться» → «Сохранить изображение».");
}

async function shareReportFile() {
  showSaving();
  const html = await buildReportHtml();
  const filename = `bogatka-location-report-${new Date().toISOString().slice(0,10)}.html`;
  const file = new File([html], filename, {type:"text/html;charset=utf-8"});
  if (navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))) {
    await navigator.share({title:"Отчёт по локациям «Богатка»", text:"Отчёт с оценками и фотографиями", files:[file]});
  } else {
    downloadBlob(new Blob([html], {type:"text/html;charset=utf-8"}), filename);
    alert("HTML-отчёт скачан. Его можно отправить через Telegram, почту или облачное хранилище.");
  }
  showSaved();
}

function bindV21Buttons() {
  $("#shareReportBtn")?.addEventListener("click", () => shareReportFile().catch(showError));
  $("#cloudSyncBtn")?.addEventListener("click", () => $("#cloudModal")?.classList.remove("hidden"));
  $$('[data-close-cloud]').forEach(button => button.addEventListener("click", () => $("#cloudModal")?.classList.add("hidden")));
  $("#cloudModal")?.addEventListener("click", event => {
    if (event.target === $("#cloudModal")) $("#cloudModal").classList.add("hidden");
  });
}

async function reloadAfterSuccessfulPin() {
  const pin = $("#accessPin")?.value.trim() || "";
  if (pin && await sha256Hex(pin) === ACCESS_PIN_HASH) setTimeout(() => location.reload(), 80);
}

window.addEventListener("load", () => {
  if ($("#versionLabel")) $("#versionLabel").textContent = "2.1.0";
  bindV21Buttons();
  $("#unlockBtn")?.addEventListener("click", reloadAfterSuccessfulPin);
  $("#accessPin")?.addEventListener("keydown", event => { if (event.key === "Enter") reloadAfterSuccessfulPin(); });
  scheduleEnhance();
  const observer = new MutationObserver(scheduleEnhance);
  observer.observe(document.body, {childList:true, subtree:true});
});
