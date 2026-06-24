function renderLocations() {
  const root = $("#locations");
  root.innerHTML = CONFIG.addresses.map((loc,index) => {
    const groups = {};
    CONFIG.checklist.forEach(([key,label,group]) => (groups[group] ||= []).push([key,label]));
    const checks = Object.entries(groups).map(([group,items]) => `
      <div class="check-group"><h4>${esc(group)}</h4><div class="check-grid">
        ${items.map(([key,label])=>`<label class="check-row"><input type="checkbox" data-location="${loc.id}" data-field="check.${key}"><span>${esc(label)}</span></label>`).join("")}
      </div></div>`).join("");
    const scoreRows = CONFIG.scores.map(([key,label]) => `
      <tr><td>${esc(label)}</td><td><select data-location="${loc.id}" data-field="score.${key}">
        <option value="">—</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option>
      </select></td></tr>`).join("");
    return `
    <section class="location" data-location-card="${loc.id}">
      <div class="location-head">
        <div><span class="rank">Локация ${index+1}</span><h2>${esc(loc.title)}</h2><p>${esc(loc.note)}</p>
          <a class="maplink" href="${loc.map}" target="_blank" rel="noopener">Открыть на карте</a>
        </div>
        <div class="scorebox"><strong data-total="${loc.id}">0</strong><small>/ 70</small></div>
      </div>
      <div class="location-body">
        <div class="quick-grid">
          <label class="field">Дата<input type="date" data-location="${loc.id}" data-field="date"></label>
          <label class="field">Время<input type="time" data-location="${loc.id}" data-field="time"></label>
          <label class="field">Аренда<input type="text" data-location="${loc.id}" data-field="rent" placeholder="BYN + платежи"></label>
          <label class="field">Контакт<input type="text" data-location="${loc.id}" data-field="contact" placeholder="Имя, телефон"></label>
        </div>
        <details><summary>Быстрый чек-лист</summary><div class="details-body">${checks}</div></details>
        <details><summary>Оценка по 70-балльной системе</summary><div class="details-body">
          <table class="score-table"><thead><tr><th>Показатель</th><th>1–5</th></tr></thead><tbody>${scoreRows}</tbody></table>
        </div></details>
        <details><summary>Фото с телефона</summary><div class="details-body">
          <div class="photo-bar">
            <label class="btn secondary">Добавить фото<input class="hidden photo-input" type="file" accept="image/*" capture="environment" data-photo-location="${loc.id}" multiple></label>
          </div>
          <div class="photos" data-photos="${loc.id}"></div>
        </div></details>
        <div class="notes-grid">
          <label class="field">Главные плюсы<textarea data-location="${loc.id}" data-field="pros"></textarea></label>
          <label class="field">Главные минусы<textarea data-location="${loc.id}" data-field="cons"></textarea></label>
          <label class="field">Что уточнить<textarea data-location="${loc.id}" data-field="questions"></textarea></label>
          <label class="field">Дополнительные заметки<textarea data-location="${loc.id}" data-field="notes"></textarea></label>
        </div>
        <div class="decision">
          <label><input type="radio" name="decision-${loc.id}" value="Оставить" data-location="${loc.id}" data-field="decision"> Оставить</label>
          <label><input type="radio" name="decision-${loc.id}" value="Под вопросом" data-location="${loc.id}" data-field="decision"> Под вопросом</label>
          <label><input type="radio" name="decision-${loc.id}" value="Исключить" data-location="${loc.id}" data-field="decision"> Исключить</label>
        </div>
      </div>
    </section>`;
  }).join("");
}

function setNested(obj,path,value) {
  const parts=path.split(".");
  let cur=obj;
  parts.slice(0,-1).forEach(p=>cur=cur[p] ||= {});
  cur[parts.at(-1)] = value;
}
function getNested(obj,path) {
  return path.split(".").reduce((a,p)=>a?.[p],obj);
}

async function getLocationData(id) {
  return await idbGet(STORE,"location:"+id) || {};
}
async function saveField(el) {
  const id=el.dataset.location, field=el.dataset.field;
  if (!id || !field) return;
  const data=await getLocationData(id);
  let value;
  if (el.type==="checkbox") value=el.checked;
  else if (el.type==="radio") { if(!el.checked)return; value=el.value; }
  else value=el.value;
  setNested(data,field,value);
  await idbPut(STORE,data,"location:"+id);
  showSaved();
  updateLocationTotal(id,data);
  updateSummary();
}
async function saveGlobal(el) {
  const data=await idbGet(STORE,"global") || {};
  data[el.dataset.global]=el.value;
  await idbPut(STORE,data,"global");
  showSaved();
}

function showSaving() {
  $("#saveStatus").textContent="Сохраняю…";
}
function showSaved() {
  clearTimeout(saveTimer);
  $("#saveStatus").textContent="Все изменения сохранены";
  $("#saveBanner").classList.add("show");
  saveTimer=setTimeout(()=>$("#saveBanner").classList.remove("show"),800);
}
function totalFromData(data) {
  return CONFIG.scores.reduce((sum,[key])=>sum+Number(data?.score?.[key]||0),0);
}
function updateLocationTotal(id,data) {
  const el=document.querySelector(`[data-total="${id}"]`);
  if(el)el.textContent=totalFromData(data);
}

async function restoreForm() {
  const global=await idbGet(STORE,"global") || {};
  $$('[data-global]').forEach(el=>el.value=global[el.dataset.global]||"");
  for (const loc of CONFIG.addresses) {
    const data=await getLocationData(loc.id);
    $$(`[data-location="${loc.id}"]`).forEach(el=>{
      const v=getNested(data,el.dataset.field);
      if(el.type==="checkbox")el.checked=!!v;
      else if(el.type==="radio")el.checked=el.value===v;
      else if(v!==undefined)el.value=v;
    });
    updateLocationTotal(loc.id,data);
    await renderPhotos(loc.id);
  }
  await updateSummary();
}

async function updateSummary() {
  let completed=0,best=0,keep=0;
  for(const loc of CONFIG.addresses){
    const d=await getLocationData(loc.id);
    const t=totalFromData(d); best=Math.max(best,t);
    if(d.date || d.decision || t>0)completed++;
    if(d.decision==="Оставить")keep++;
  }
  const photos=await idbAll(PHOTO_STORE);
  $("#completedCount").textContent=completed;
  $("#bestScore").textContent=best;
  $("#keepCount").textContent=keep;
  $("#photoCount").textContent=photos.length;
}
