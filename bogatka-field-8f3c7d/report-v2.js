async function exportBackup() {
  const records = {};
  records["meta:locations"] = locations;
  records.global = await idbGet(STORE, "global") || {};
  for (const locationItem of locations) records[`location:${locationItem.id}`] = await getLocationData(locationItem.id);
  const photos = [];
  for (const photo of await idbAll(PHOTO_STORE)) photos.push({...photo, blob:await blobToDataURL(photo.blob)});
  const payload = {format:"bogatka-location-backup", version:2, appVersion:APP_VERSION, createdAt:new Date().toISOString(), records, photos};
  const blob = new Blob([JSON.stringify(payload)], {type:"application/json"});
  downloadBlob(blob, `bogatka-backup-${new Date().toISOString().slice(0,10)}.json`);
  const global = records.global || {};
  global.lastBackupAt = new Date().toISOString();
  await idbPut(STORE, global, "global");
}

async function importBackup(file) {
  const payload = JSON.parse(await file.text());
  if (payload.format !== "bogatka-location-backup") throw new Error("Неверный формат резервной копии.");
  const incomingLocations = payload.records?.["meta:locations"] || [];
  const known = new Set(locations.map(item => item.id));
  for (const incomingLocation of incomingLocations) if (!known.has(incomingLocation.id)) locations.push(incomingLocation);
  await saveLocations();
  for (const [key, incoming] of Object.entries(payload.records || {})) {
    if (key === "meta:locations") continue;
    const current = await idbGet(STORE, key) || {};
    await idbPut(STORE, deepMerge(current, incoming), key);
  }
  const existingPhotoIds = new Set((await idbAll(PHOTO_STORE)).map(photo => photo.id));
  for (const photo of payload.photos || []) {
    if (!existingPhotoIds.has(photo.id)) await idbPut(PHOTO_STORE, {...photo, blob:dataURLToBlob(photo.blob)});
  }
  renderLocations();
}

function downloadBlob(blob, filename) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}

function valueOrDash(value) {
  return value === undefined || value === null || value === "" ? "—" : esc(value);
}
function formatChecklistForReport(data) {
  const groups = {};
  CHECKLIST.forEach(([key, label, group]) => {
    if (data?.check?.[key]) (groups[group] ||= []).push(label);
  });
  return Object.entries(groups).map(([group, labels]) => `<div class="report-check"><h4>${esc(group)}</h4><ul>${labels.map(label => `<li>${esc(label)}</li>`).join("")}</ul></div>`).join("") || "<p>Нет отмеченных пунктов.</p>";
}

async function buildReportHtml() {
  const global = await idbGet(STORE, "global") || {};
  const allPhotos = await idbAll(PHOTO_STORE);
  let locationSections = "";
  let bestScore = 0;
  let inspected = 0;

  for (let index = 0; index < locations.length; index++) {
    const locationItem = locations[index];
    const data = await getLocationData(locationItem.id);
    const total = totalFromData(data);
    bestScore = Math.max(bestScore, total);
    if (data.date || data.decision || total > 0 || data.updatedAt) inspected += 1;

    const scoreRows = SCORES.map(([key, label]) => `<tr><td>${esc(label)}</td><td>${valueOrDash(data?.score?.[key])}</td></tr>`).join("");
    const techRows = TECH_FIELDS.map(([key, label]) => `<tr><td>${esc(label)}</td><td>${valueOrDash(data?.tech?.[key])}</td></tr>`).join("");
    const trafficRows = TRAFFIC_FIELDS.map(([key, label]) => `<tr><td>${esc(label)}</td><td>${valueOrDash(data?.traffic?.[key])}</td></tr>`).join("");

    let photoGroups = "";
    for (const [category, title] of PHOTO_CATEGORIES) {
      const categoryPhotos = allPhotos.filter(photo => photo.locationId === locationItem.id && (photo.category || "other") === category);
      if (!categoryPhotos.length) continue;
      let images = "";
      for (const photo of categoryPhotos) {
        images += `<figure><img src="${await blobToDataURL(photo.blob)}" alt="${esc(photo.caption || title)}"><figcaption>${esc(photo.caption || photo.originalName || "")}</figcaption></figure>`;
      }
      photoGroups += `<div class="report-photo-group"><h4>${esc(title)}</h4><div class="report-photos">${images}</div></div>`;
    }

    locationSections += `
    <section class="report-location">
      <div class="report-location-head"><div><span class="report-rank">Локация ${index + 1}</span><h2>${esc(locationItem.title || locationItem.address)}</h2><p>${esc(locationItem.note || "")}</p></div><div class="report-score">${total}<small>/70</small></div></div>
      <div class="report-summary-grid">
        <div><b>Адрес:</b> ${esc(locationItem.address || "—")}</div><div><b>Статус:</b> ${valueOrDash(data.status)}</div>
        <div><b>Решение:</b> ${valueOrDash(data.decision)}</div><div><b>Тип объекта:</b> ${valueOrDash(data.objectType)}</div>
        <div><b>Дата:</b> ${valueOrDash(data.date)}</div><div><b>Время:</b> ${valueOrDash(data.time)}</div>
        <div><b>Аренда:</b> ${valueOrDash(data.rent)}</div><div><b>Контакт:</b> ${valueOrDash(data.contact)}</div>
        <div><b>GPS:</b> ${data.gpsLat ? `${data.gpsLat}, ${data.gpsLon}` : "—"}</div>
      </div>
      <h3>Полевой замер</h3><table><tbody>${trafficRows}</tbody></table>
      <h3>Оценка</h3><table><tbody>${scoreRows}</tbody></table>
      <h3>Технические и финансовые параметры</h3><table><tbody>${techRows}</tbody></table>
      <h3>Подтверждённые пункты чек-листа</h3><div class="report-check-grid">${formatChecklistForReport(data)}</div>
      <h3>Конкурент</h3><p><b>Название:</b> ${valueOrDash(data?.competitor?.name)} · <b>Расстояние:</b> ${valueOrDash(data?.competitor?.distance)}</p>
      <p><b>Сильные стороны:</b> ${valueOrDash(data?.competitor?.strengths)}</p><p><b>Слабые стороны:</b> ${valueOrDash(data?.competitor?.weaknesses)}</p>
      <div class="report-notes"><div><h3>Плюсы</h3><p>${valueOrDash(data.pros)}</p></div><div><h3>Минусы</h3><p>${valueOrDash(data.cons)}</p></div><div><h3>Риски</h3><p>${valueOrDash(data.risks)}</p></div><div><h3>Что уточнить</h3><p>${valueOrDash(data.questions)}</p></div><div><h3>Идея формата</h3><p>${valueOrDash(data.formatIdea)}</p></div><div><h3>Заметки</h3><p>${valueOrDash(data.notes)}</p></div></div>
      ${photoGroups ? `<h3>Фотографии</h3>${photoGroups}` : ""}
    </section>`;
  }

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Отчёт по локациям «Богатка»</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;color:#1c2933;background:#f3f7f4;margin:0;line-height:1.5}main{max-width:1100px;margin:auto;padding:28px 18px}.report-cover,.report-location{background:#fff;border:1px solid #d4e0d8;border-radius:18px;padding:24px;margin-bottom:18px}.report-cover{background:linear-gradient(135deg,#174c38,#2c7155);color:#fff}.report-cover h1{margin:0 0 8px}.report-cover p{margin:5px 0}.report-location-head{display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid #d4e0d8;padding-bottom:12px}.report-location h2{color:#184f3a;margin:5px 0}.report-rank{background:#184f3a;color:#fff;border-radius:999px;padding:4px 8px;font-size:12px}.report-score{min-width:80px;text-align:center;background:#eaf5ef;border-radius:12px;padding:10px;color:#184f3a;font-size:28px;font-weight:bold}.report-score small{display:block;font-size:12px}.report-summary-grid,.report-notes{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0}.report-summary-grid>div,.report-notes>div{background:#f7faf8;border:1px solid #d4e0d8;border-radius:10px;padding:10px}h3{color:#2d6b52;margin:18px 0 8px}table{width:100%;border-collapse:collapse;font-size:13px}td{border:1px solid #d4e0d8;padding:7px}.report-check-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.report-check{background:#f7faf8;border:1px solid #d4e0d8;border-radius:10px;padding:10px}.report-check h4{margin:0;color:#184f3a}.report-check ul{margin:7px 0}.report-photo-group{margin:15px 0}.report-photos{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.report-photos figure{margin:0;border:1px solid #d4e0d8;border-radius:10px;overflow:hidden;background:#fff}.report-photos img{display:block;width:100%;height:260px;object-fit:contain;background:#111}.report-photos figcaption{padding:7px;font-size:12px;color:#657168}@media(max-width:700px){.report-summary-grid,.report-notes,.report-check-grid{grid-template-columns:1fr}.report-photos{grid-template-columns:1fr 1fr}}@media print{body{background:#fff}main{max-width:none;padding:0}.report-cover,.report-location{box-shadow:none;break-inside:auto}.report-photo-group{break-inside:avoid}.report-photos img{height:220px}}
  </style></head><body><main>
    <section class="report-cover"><h1>Отчёт по осмотру локаций «Богатка»</h1><p><b>Инспектор:</b> ${valueOrDash(global.inspector)}</p><p><b>Общие заметки:</b> ${valueOrDash(global.tripNotes)}</p><p><b>Сформирован:</b> ${new Date().toLocaleString("ru-RU")}</p><p><b>Осмотрено:</b> ${inspected} из ${locations.length} · <b>Лучший балл:</b> ${bestScore}/70</p></section>
    ${locationSections}
  </main></body></html>`;
}

async function exportHtmlReport() {
  showSaving();
  const html = await buildReportHtml();
  downloadBlob(new Blob([html], {type:"text/html;charset=utf-8"}), `bogatka-location-report-${new Date().toISOString().slice(0,10)}.html`);
  showSaved();
}

async function openPdfReport() {
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) return alert("Браузер заблокировал новое окно. Разрешите всплывающие окна для создания PDF.");
  reportWindow.document.write("<p style='font-family:Arial;padding:30px'>Формируется отчёт…</p>");
  const html = await buildReportHtml();
  reportWindow.document.open();
  reportWindow.document.write(html);
  reportWindow.document.close();
  setTimeout(() => reportWindow.print(), 700);
}

async function clearAllData() {
  if (!confirm("Удалить все локации, оценки, заметки и фотографии на этом устройстве? Перед этим обязательно сделайте резервную копию.")) return;
  await idbClear(STORE);
  await idbClear(PHOTO_STORE);
  location.reload();
}

async function copyAccessLink() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return alert("На этом устройстве нет исходного ключа. Откройте приложение по полной ссылке доступа.");
  const url = `${location.origin}${location.pathname}#access=${token}`;
  if (navigator.share) {
    try { await navigator.share({title:"Чек-лист «Богатка»", text:"Ссылка доступа к приложению", url}); return; } catch (_) {}
  }
  await navigator.clipboard.writeText(url);
  alert("Ссылка доступа скопирована.");
}

function updateOnlineStatus() {
  $("#onlineStatus").textContent = navigator.onLine ? "Онлайн" : "Офлайн";
}

function bindGlobalInputs() {
  $$('[data-global]').forEach(element => element.addEventListener("input", () => {
    showSaving();
    clearTimeout(element._saveTimer);
    element._saveTimer = setTimeout(() => saveGlobal(element).catch(showError), 250);
  }));
}

function bindStaticActions() {
  $("#addLocationBtn").addEventListener("click", () => openLocationModal());
  $("#shareAccessBtn").addEventListener("click", copyAccessLink);
  $("#exportBtn").addEventListener("click", () => exportBackup().catch(showError));
  $("#importBtn").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", async event => {
    try {
      if (event.target.files[0]) await importBackup(event.target.files[0]);
      alert("Данные резервной копии объединены с текущими данными.");
    } catch (error) { showError(error); }
    event.target.value = "";
  });
  $("#htmlReportBtn").addEventListener("click", () => exportHtmlReport().catch(showError));
  $("#pdfReportBtn").addEventListener("click", () => openPdfReport().catch(showError));
  $("#helpBtn").addEventListener("click", () => $("#helpModal").classList.remove("hidden"));
  $("#clearAllBtn").addEventListener("click", () => clearAllData().catch(showError));
  $$('[data-close-modal]').forEach(button => button.addEventListener("click", () => $("#helpModal").classList.add("hidden")));
  $$('[data-close-location]').forEach(button => button.addEventListener("click", closeLocationModal));
  $("#saveLocationBtn").addEventListener("click", () => saveLocationFromModal().catch(showError));
  $("#deleteLocationBtn").addEventListener("click", () => deleteCustomLocation().catch(showError));
  $$('[data-close-viewer]').forEach(button => button.addEventListener("click", closePhotoViewer));
  $("#photoViewer").addEventListener("click", event => { if (event.target === $("#photoViewer")) closePhotoViewer(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape") { closePhotoViewer(); closeLocationModal(); $("#helpModal").classList.add("hidden"); } });
}

window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPrompt = event;
  $("#installBtn").classList.remove("hidden");
});

async function installApp() {
  if (!installPrompt) return alert("Установка доступна через меню браузера: «Добавить на главный экран» или «Установить приложение».");
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $("#installBtn").classList.add("hidden");
}

async function requestPersistentStorage() {
  if (navigator.storage?.persist) {
    try { await navigator.storage.persist(); } catch (_) {}
  }
}

async function init() {
  const allowed = await authorize();
  if (!allowed) return;
  db = await openDB();
  await requestPersistentStorage();
  await loadLocations();
  $("#versionLabel").textContent = APP_VERSION;
  bindStaticActions();
  bindGlobalInputs();
  $("#installBtn").addEventListener("click", installApp);
  renderLocations();
  updateOnlineStatus();
  try {
    await window.BogatkaStartup?.prepareCriticalUi?.();
  } catch (error) {
    console.error("Критический UI запуска не был полностью подготовлен до показа приложения.", error);
  } finally {
    window.BogatkaStartup?.revealApp?.();
  }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(console.error);
}

init().catch(error => {
  showError(error);
  if (localStorage.getItem(AUTH_KEY) === "1") window.BogatkaStartup?.revealApp?.();
});
