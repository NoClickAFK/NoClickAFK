function bindInputs() {
  $$('[data-location][data-field]').forEach(el=>{
    const evt=(el.tagName==='TEXTAREA'||el.type==='text')?'input':'change';
    el.addEventListener(evt,()=>{showSaving(); clearTimeout(el._t); el._t=setTimeout(()=>saveField(el),250);});
  });
  $$('[data-global]').forEach(el=>el.addEventListener('input',()=>{showSaving();clearTimeout(el._t);el._t=setTimeout(()=>saveGlobal(el),250);}));
  $$('.photo-input').forEach(el=>el.addEventListener('change',()=>handlePhotos(el.dataset.photoLocation,[...el.files])));
}

async function resizeImage(file) {
  const bitmap=await createImageBitmap(file);
  const max=1600,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
  return await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.76));
}
async function blobToDataURL(blob) {
  return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});
}
async function handlePhotos(locationId,files) {
  for(const file of files){
    const blob=await resizeImage(file);
    await idbPut(PHOTO_STORE,{id:crypto.randomUUID(),locationId,createdAt:new Date().toISOString(),blob});
  }
  await renderPhotos(locationId);await updateSummary();showSaved();
}
async function renderPhotos(locationId) {
  const root=document.querySelector(`[data-photos="${locationId}"]`);
  if(!root)return;
  const all=(await idbAll(PHOTO_STORE)).filter(p=>p.locationId===locationId);
  root.innerHTML='';
  for(const p of all){
    const url=URL.createObjectURL(p.blob);
    const div=document.createElement('div');div.className='photo';
    div.innerHTML='<img alt="Фото локации"><button title="Удалить">×</button>';
    div.querySelector('img').src=url;
    div.querySelector('button').onclick=async()=>{if(confirm('Удалить фото?')){await idbDelete(PHOTO_STORE,p.id);URL.revokeObjectURL(url);renderPhotos(locationId);updateSummary();}};
    root.appendChild(div);
  }
}

async function exportBackup() {
  const records={};
  for(const key of ['global',...CONFIG.addresses.map(x=>'location:'+x.id)])records[key]=await idbGet(STORE,key)||{};
  const photos=[];
  for(const p of await idbAll(PHOTO_STORE))photos.push({...p,blob:await blobToDataURL(p.blob)});
  const payload={format:'bogatka-location-backup',version:1,createdAt:new Date().toISOString(),records,photos};
  const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});
  downloadBlob(blob,`bogatka-backup-${new Date().toISOString().slice(0,10)}.json`);
}
function dataURLToBlob(dataURL) {
  const [meta,data]=dataURL.split(',');const mime=meta.match(/:(.*?);/)[1];
  const bytes=atob(data);const arr=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)arr[i]=bytes.charCodeAt(i);
  return new Blob([arr],{type:mime});
}
async function importBackup(file) {
  const payload=JSON.parse(await file.text());
  if(payload.format!=='bogatka-location-backup')throw new Error('Неверный формат резервной копии');
  await idbClear(STORE);await idbClear(PHOTO_STORE);
  for(const [k,v] of Object.entries(payload.records||{}))await idbPut(STORE,v,k);
  for(const p of payload.photos||[])await idbPut(PHOTO_STORE,{...p,blob:dataURLToBlob(p.blob)});
  await restoreForm();showSaved();
}
function downloadBlob(blob,name) {
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}

async function createReport() {
  const global=await idbGet(STORE,'global')||{};
  let sections='';
  for(const loc of CONFIG.addresses){
    const d=await getLocationData(loc.id);const total=totalFromData(d);
    const checks=CONFIG.checklist.filter(([k])=>d?.check?.[k]).map(([,l])=>l);
    const photos=(await idbAll(PHOTO_STORE)).filter(p=>p.locationId===loc.id);
    let photoHtml='';
    for(const p of photos)photoHtml+=`<img src="${await blobToDataURL(p.blob)}" alt="">`;
    sections+=`<section><h2>${esc(loc.title)} — ${total}/70</h2>
      <p><b>Решение:</b> ${esc(d.decision||'—')} · <b>Аренда:</b> ${esc(d.rent||'—')} · <b>Контакт:</b> ${esc(d.contact||'—')}</p>
      <p><b>Плюсы:</b> ${esc(d.pros||'—')}</p><p><b>Минусы:</b> ${esc(d.cons||'—')}</p>
      <p><b>Уточнить:</b> ${esc(d.questions||'—')}</p><p><b>Заметки:</b> ${esc(d.notes||'—')}</p>
      <p><b>Отмечено:</b> ${checks.length?checks.map(esc).join('; '):'—'}</p>
      <div class="photos">${photoHtml}</div></section>`;
  }
  const report=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Отчёт «Богатка»</title>
  <style>body{font-family:Arial;color:#1d2933;max-width:1000px;margin:auto;padding:24px;line-height:1.5}h1,h2{color:#184f3a}section{border:1px solid #d4e0d8;border-radius:12px;padding:16px;margin:14px 0;break-inside:avoid}.photos{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}img{width:100%;max-height:260px;object-fit:cover;border-radius:8px}@media print{body{padding:0}}</style></head>
  <body><h1>Отчёт по осмотру локаций «Богатка»</h1><p><b>Инспектор:</b> ${esc(global.inspector||'—')}</p><p><b>Общие заметки:</b> ${esc(global.tripNotes||'—')}</p>${sections}</body></html>`;
  const w=window.open('','_blank');w.document.write(report);w.document.close();
}

async function clearAll() {
  if(!confirm('Удалить все оценки, заметки и фотографии на этом устройстве? Сначала сделайте резервную копию.'))return;
  await idbClear(STORE);await idbClear(PHOTO_STORE);location.reload();
}

async function copyAccessLink() {
  const token=localStorage.getItem(TOKEN_KEY);
  if(!token)return alert('На этом устройстве нет исходного ключа. Откройте приложение по полной ссылке доступа.');
  const url=location.origin+location.pathname+'#access='+token;
  await navigator.clipboard.writeText(url);
  alert('Ссылка доступа скопирована. Передавайте только участникам проекта.');
}

function updateOnline() {
  $('#onlineStatus').textContent=navigator.onLine?'Онлайн':'Офлайн';
}
window.addEventListener('online',updateOnline);window.addEventListener('offline',updateOnline);

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('#installBtn').classList.remove('hidden');});
$('#installBtn').onclick=async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('#installBtn').classList.add('hidden');}};

async function init() {
  if(!await authorize())return;
  db=await openDB();
  renderLocations();bindInputs();await restoreForm();updateOnline();
  $('#shareAccessBtn').onclick=copyAccessLink;
  $('#exportBtn').onclick=exportBackup;
  $('#importBtn').onclick=()=>$('#importFile').click();
  $('#importFile').onchange=async e=>{try{await importBackup(e.target.files[0]);alert('Данные восстановлены');}catch(err){alert(err.message);}e.target.value='';};
  $('#reportBtn').onclick=createReport;
  $('#clearBtn').onclick=clearAll;
  $('#helpBtn').onclick=()=>$('#helpModal').classList.remove('hidden');
  $$('[data-close-modal]').forEach(b=>b.onclick=()=>$('#helpModal').classList.add('hidden'));
  if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
init();
