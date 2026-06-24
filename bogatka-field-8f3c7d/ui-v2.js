function renderLocations() {
  revokeObjectUrls();
  const root = $("#locations");
  root.innerHTML = locations.map((locationItem, index) => renderLocationCard(locationItem, index)).join("");
  bindLocationInputs();
  bindLocationActions();
  restoreAllForms().catch(showError);
}

function renderLocationCard(locationItem, index) {
  const groups = {};
  CHECKLIST.forEach(([key, label, group]) => (groups[group] ||= []).push([key, label]));
  const checklistHtml = Object.entries(groups).map(([group, items]) => `
    <div class="check-group">
      <h4>${esc(group)}</h4>
      <div class="check-grid">
        ${items.map(([key, label]) => `<label class="check-row"><input type="checkbox" data-location="${locationItem.id}" data-field="check.${key}"><span>${esc(label)}</span></label>`).join("")}
      </div>
    </div>`).join("");

  const scoresHtml = SCORES.map(([key, label]) => `
    <tr><td>${esc(label)}</td><td><select data-location="${locationItem.id}" data-field="score.${key}"><option value="">—</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></td></tr>`).join("");

  const techHtml = TECH_FIELDS.map(([key, label, type]) => `<label class="field">${esc(label)}<input type="${type}" step="any" data-location="${locationItem.id}" data-field="tech.${key}"></label>`).join("");
  const trafficHtml = TRAFFIC_FIELDS.map(([key, label]) => `<label class="field">${esc(label)}<input type="number" min="0" step="1" data-location="${locationItem.id}" data-field="traffic.${key}"></label>`).join("");

  const photoCategoriesHtml = PHOTO_CATEGORIES.map(([category, title, description]) => `
    <div class="photo-category">
      <div class="photo-category-head">
        <div><h4>${esc(title)}</h4><p>${esc(description)}</p></div>
        <label class="btn secondary small photo-add">Добавить фото<input class="hidden photo-input" type="file" accept="image/*" capture="environment" multiple data-photo-location="${locationItem.id}" data-photo-category="${category}"></label>
      </div>
      <div class="photos" data-photos="${locationItem.id}:${category}"></div>
    </div>`).join("");

  return `
  <section class="location" data-location-card="${locationItem.id}">
    <div class="location-head">
      <div class="location-title-wrap">
        <span class="rank">Локация ${index + 1}</span>
        <h2>${esc(locationItem.title || locationItem.address)}</h2>
        <p>${esc(locationItem.note || "Дополнительная локация для проверки.")}</p>
        <div class="gps" data-gps-label="${locationItem.id}"></div>
        <div class="location-actions">
          <a class="maplink btn secondary small" href="${mapUrl(locationItem.address)}" target="_blank" rel="noopener">Открыть на карте</a>
          <button class="btn secondary small" data-action="edit-location" data-id="${locationItem.id}">Изменить адрес</button>
          <button class="btn secondary small" data-action="save-gps" data-id="${locationItem.id}">Сохранить GPS</button>
          <button class="btn danger small" data-action="clear-location" data-id="${locationItem.id}">Очистить локацию</button>
          <button class="btn secondary small" data-action="restore-location" data-id="${locationItem.id}">Восстановить</button>
        </div>
      </div>
      <div class="scorebox"><strong data-total="${locationItem.id}">0</strong><small>/ 70</small></div>
    </div>

    <div class="location-body">
      <div class="status-row">
        <label class="field">Статус<select data-location="${locationItem.id}" data-field="status"><option value="">Не выбран</option><option>Кандидат</option><option>Осмотрена</option><option>Оставить</option><option>Переговоры</option><option>Исключить</option></select></label>
        <label class="field">Тип объекта<select data-location="${locationItem.id}" data-field="objectType"><option value="">Не выбран</option><option>Торговый центр</option><option>Стрит-ритейл</option><option>Первый этаж жилого дома</option><option>Рынок / павильон</option><option>Отдельное здание</option><option>Другое</option></select></label>
        <span class="undo-note" data-undo-note="${locationItem.id}"></span>
      </div>

      <div class="quick-grid">
        <label class="field">Дата<input type="date" data-location="${locationItem.id}" data-field="date"></label>
        <label class="field">Время<input type="time" data-location="${locationItem.id}" data-field="time"></label>
        <label class="field">Аренда / условия<input type="text" data-location="${locationItem.id}" data-field="rent" placeholder="BYN + платежи"></label>
        <label class="field">Контакт<input type="text" data-location="${locationItem.id}" data-field="contact" placeholder="Имя, телефон"></label>
      </div>

      <details><summary>Полевой замер трафика</summary><div class="details-body"><p class="section-note">Считать людей у конкретного входа, а не общий поток по улице.</p><div class="grid-4">${trafficHtml}</div></div></details>
      <details><summary>Быстрый чек-лист</summary><div class="details-body">${checklistHtml}</div></details>
      <details><summary>Оценка по 70-балльной системе</summary><div class="details-body"><div class="table-wrap"><table class="score-table"><thead><tr><th>Показатель</th><th>1–5</th></tr></thead><tbody>${scoresHtml}</tbody></table></div></div></details>
      <details><summary>Технические и финансовые параметры</summary><div class="details-body"><div class="grid-3">${techHtml}</div></div></details>
      <details><summary>Конкуренты и окружение</summary><div class="details-body"><div class="grid-2">
        <label class="field">Ближайший конкурент<input type="text" data-location="${locationItem.id}" data-field="competitor.name"></label>
        <label class="field">Расстояние / время пешком<input type="text" data-location="${locationItem.id}" data-field="competitor.distance"></label>
        <label class="field">Сильные стороны конкурента<textarea data-location="${locationItem.id}" data-field="competitor.strengths"></textarea></label>
        <label class="field">Слабые стороны конкурента<textarea data-location="${locationItem.id}" data-field="competitor.weaknesses"></textarea></label>
      </div></div></details>
      <details open><summary>Фотографии по категориям</summary><div class="details-body"><p class="section-note">Фотографии сохраняются локально в высоком качестве. Нажмите на изображение, чтобы открыть крупно.</p>${photoCategoriesHtml}</div></details>

      <div class="notes-grid">
        <label class="field">Главные плюсы<textarea data-location="${locationItem.id}" data-field="pros"></textarea></label>
        <label class="field">Главные минусы<textarea data-location="${locationItem.id}" data-field="cons"></textarea></label>
        <label class="field">Риски / подводные камни<textarea data-location="${locationItem.id}" data-field="risks"></textarea></label>
        <label class="field">Что уточнить у арендодателя<textarea data-location="${locationItem.id}" data-field="questions"></textarea></label>
        <label class="field">Идея формата магазина<textarea data-location="${locationItem.id}" data-field="formatIdea"></textarea></label>
        <label class="field">Дополнительные заметки<textarea data-location="${locationItem.id}" data-field="notes"></textarea></label>
      </div>

      <div class="decision">
        <label><input type="radio" name="decision-${locationItem.id}" value="Оставить" data-location="${locationItem.id}" data-field="decision"> Оставить</label>
        <label><input type="radio" name="decision-${locationItem.id}" value="Под вопросом" data-location="${locationItem.id}" data-field="decision"> Под вопросом</label>
        <label><input type="radio" name="decision-${locationItem.id}" value="Исключить" data-location="${locationItem.id}" data-field="decision"> Исключить</label>
      </div>
    </div>
  </section>`;
}

function bindLocationInputs() {
  $$('[data-location][data-field]').forEach(element => {
    const eventName = element.tagName === "TEXTAREA" || element.type === "text" || element.type === "number" ? "input" : "change";
    element.addEventListener(eventName, () => {
      showSaving();
      clearTimeout(element._saveTimer);
      element._saveTimer = setTimeout(() => saveField(element).catch(showError), 250);
    });
  });
  $$('.photo-input').forEach(input => input.addEventListener("change", () => handlePhotoFiles(input).catch(showError)));
}

function bindLocationActions() {
  $$('[data-action="edit-location"]').forEach(button => button.addEventListener("click", () => openLocationModal(button.dataset.id)));
  $$('[data-action="save-gps"]').forEach(button => button.addEventListener("click", () => saveGps(button.dataset.id)));
  $$('[data-action="clear-location"]').forEach(button => button.addEventListener("click", () => clearLocation(button.dataset.id)));
  $$('[data-action="restore-location"]').forEach(button => button.addEventListener("click", () => restoreLocation(button.dataset.id)));
}

async function saveField(element) {
  const id = element.dataset.location;
  const field = element.dataset.field;
  const data = await getLocationData(id);
  let value;
  if (element.type === "checkbox") value = element.checked;
  else if (element.type === "radio") { if (!element.checked) return; value = element.value; }
  else value = element.value;
  setNested(data, field, value);
  data.updatedAt = new Date().toISOString();
  await idbPut(STORE, data, `location:${id}`);
  updateLocationTotal(id, data);
  await updateSummary();
  showSaved();
}

async function saveGlobal(element) {
  const data = await idbGet(STORE, "global") || {};
  data[element.dataset.global] = element.value;
  data.updatedAt = new Date().toISOString();
  await idbPut(STORE, data, "global");
  showSaved();
}

function updateLocationTotal(id, data) {
  const target = document.querySelector(`[data-total="${id}"]`);
  if (target) target.textContent = totalFromData(data);
}

async function restoreAllForms() {
  const global = await idbGet(STORE, "global") || {};
  $$('[data-global]').forEach(element => element.value = global[element.dataset.global] || "");
  for (const locationItem of locations) {
    const data = await getLocationData(locationItem.id);
    $$(`[data-location="${locationItem.id}"]`).forEach(element => {
      const value = getNested(data, element.dataset.field);
      if (element.type === "checkbox") element.checked = Boolean(value);
      else if (element.type === "radio") element.checked = element.value === value;
      else if (value !== undefined) element.value = value;
    });
    updateLocationTotal(locationItem.id, data);
    updateGpsLabel(locationItem.id, data);
    await updateUndoState(locationItem.id);
    await renderAllPhotoCategories(locationItem.id);
  }
  await updateSummary();
}
