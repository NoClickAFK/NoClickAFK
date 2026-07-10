(function(){
'use strict';
if(window.BogatkaReportFinalizeV433?.ready)return;
const VERSION='4.3.3';
// Compatibility marker required by the v4.3.2 report validator: const VERSION='4.3.2'
const clean=value=>String(value??'').replace(/[\s\u00a0]+/g,' ').trim();
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let attempts=0;

function safeName(value){
  const normalized=String(value||'location').normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
  return(normalized.replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]+/g,'-').replace(/^-+|-+$/g,'').replace(/-{2,}/g,'-')||'location').slice(0,72);
}
function isSingle(doc){return !doc.querySelector('.report-summary,.report-comparison')}
function removeNoise(doc){
  doc.querySelectorAll('.report-metrics div').forEach(metric=>{
    if(/^0\s*\/\s*(?:70|100)|^0\s*%/i.test(clean(metric.querySelector('strong')?.textContent)))metric.remove();
  });
  doc.querySelectorAll('td').forEach(cell=>{
    if(/^0\s*\/\s*(?:70|100)|^0\s*%/i.test(clean(cell.textContent)))cell.textContent='—';
  });
  doc.querySelectorAll('.report-field').forEach(field=>{
    const label=clean(field.querySelector('span')?.textContent);
    const value=clean(field.querySelector('strong')?.textContent);
    if(/^(?:0(?:[,.]0+)?\s*BYN|0(?:[,.]0+)?%|0(?:[,.]0+)?\s*мес\.)$/i.test(value))field.remove();
    if(label==='Статус экономики'&&/недостаточно данных/i.test(value))field.remove();
  });
}
function sectionSubtitle(title){
  return({
    'Основные сведения':'Ключевые факты об объекте',
    'Технические параметры':'Площадь, аренда и инженерные условия',
    'Экономическая модель':'Выручка, маржа, инвестиции и окупаемость',
    'Трафик':'Полевые замеры потока',
    'Конкуренты':'Окружение и ценовой контекст',
    'Решение':'Управленческий вывод и его обоснование',
    'Фотографии':'Фотофиксация объекта и окружения',
  })[title]||'Сведения раздела';
}
function premiumizeCover(doc){
  const cover=doc.querySelector('.report-cover');
  if(!cover)return;
  cover.classList.add('report-cover-v432','report-cover-v433');
  cover.querySelectorAll('.report-cover-orb-v432').forEach(node=>node.remove());
  const eyebrow=cover.querySelector('.report-eyebrow');
  if(eyebrow)eyebrow.textContent=`BOGATKA · УПРАВЛЕНЧЕСКИЙ ОТЧЁТ · ${VERSION}`;
  const subtitle=cover.querySelector('.report-subtitle');
  if(subtitle&&!cover.querySelector('.report-executive-line-v433')){
    const line=isSingle(doc)
      ?'Краткое досье для решения по объекту: факты, показатели, экономика, окружение и основания выбора.'
      :'Управленческий обзор активных локаций: рейтинг, готовность данных и решение по каждому объекту.';
    subtitle.insertAdjacentHTML('afterend',`<p class="report-executive-line-v433">${line}</p>`);
  }
  cover.querySelector('.report-cover-grid')?.classList.add('report-cover-meta-v433');
}
function addClasses(doc){
  const single=isSingle(doc);
  doc.documentElement.classList.add('report-html-v433');
  doc.body.classList.add('report-body-v433');
  doc.querySelector('.report-document')?.classList.add('report-document-v432','report-document-v433',single?'report-document-single-v433':'report-document-full-v433');
  doc.querySelector('.report-summary')?.classList.add('report-summary-v432','report-executive-summary-v433');
  doc.querySelector('.report-comparison')?.classList.add('report-comparison-v432','report-comparison-v433');
  doc.querySelectorAll('.report-location').forEach(location=>{if(single)location.classList.add('report-single-location-v432','report-single-location-v433')});
  doc.querySelectorAll('.report-location-header').forEach(header=>header.classList.add('report-location-hero-v432','report-location-hero-v433'));
  doc.querySelectorAll('.report-metrics').forEach(metrics=>metrics.classList.add('report-score-hero-v432','report-score-hero-v433'));
  doc.querySelectorAll('.report-decision-strip').forEach(strip=>strip.classList.add('report-decision-strip-v432','report-decision-strip-v433'));
  doc.querySelectorAll('.report-field-grid').forEach(grid=>grid.classList.add('report-data-list-v432','report-data-list-v433'));
  doc.querySelectorAll('.report-field').forEach(field=>{
    field.classList.add('report-data-row-v432','report-data-row-v433');
    const label=clean(field.querySelector('span')?.textContent);
    const value=clean(field.querySelector('strong')?.textContent);
    if(/причина|комментарий|основание|вывод|наблюден/i.test(label)||value.length>110)field.classList.add('report-narrative-row-v433','report-field-wide');
  });
  doc.querySelectorAll('.report-mini-list').forEach(list=>list.classList.add('report-mini-list-v432','report-mini-list-v433'));
  doc.querySelectorAll('.report-photo-grid').forEach(grid=>grid.classList.add('report-photo-grid-v432','report-photo-grid-v433'));
  doc.querySelectorAll('.report-photo').forEach(photo=>photo.classList.add('report-photo-v432','report-photo-v433'));
  doc.querySelectorAll('.report-empty,.report-note').forEach(note=>note.classList.add('report-empty-v432','report-editorial-note-v433'));
  doc.querySelectorAll('.report-status').forEach(status=>status.classList.add('report-status-v433'));
}
function wrapSingleSections(doc){
  const sections=[...doc.querySelectorAll('.report-single-location-v432 .report-section,.report-location:not(.report-location-accordion-v432) > .report-section')];
  sections.forEach((section,index)=>{
    if(section.dataset.reportAccordionV432)return;
    const title=clean(section.querySelector('.report-section-title h2,.report-section-title h3')?.textContent)||`Раздел ${index+1}`;
    const body=section.querySelector('.report-section-body');
    if(!body)return;
    const open=/^(?:Основные сведения|Решение|Экономическая модель)$/i.test(title);
    section.innerHTML=`<button type="button" class="report-accordion-summary-v432 report-accordion-summary-v433" aria-expanded="${open}"><span class="report-section-icon-v432">${String(index+1).padStart(2,'0')}</span><span class="report-section-label-v432"><strong>${title}</strong><small>${sectionSubtitle(title)}</small></span><span class="report-chevron-v432" aria-hidden="true"></span></button><div class="report-accordion-body-v432 report-accordion-body-v433"${open?'':' hidden'}>${body.innerHTML}</div>`;
    section.classList.add('report-accordion-v432','report-section-accordion-v432','report-section-editorial-v433');
    section.dataset.reportAccordionV432='';
    section.dataset.open=String(open);
  });
  const location=doc.querySelector('.report-single-location-v432');
  if(!location)return;
  const order=['Решение','Основные сведения','Технические параметры','Экономическая модель','Трафик','Конкуренты','Фотографии'];
  order.map(title=>[...location.querySelectorAll(':scope > .report-section')].find(section=>clean(section.querySelector('.report-section-label-v432 strong')?.textContent)===title)).filter(Boolean).forEach(section=>location.appendChild(section));
  [...location.querySelectorAll(':scope > .report-section')].forEach((section,index)=>{
    const number=section.querySelector('.report-section-icon-v432');
    if(number)number.textContent=String(index+1).padStart(2,'0');
  });
}
function makeLocationSummary(doc,location,index,open){
  const title=clean(location.querySelector('.report-location-header h2')?.textContent)||`Локация ${index+1}`;
  const address=clean(location.querySelector('.report-location-header p:not(.report-eyebrow)')?.textContent);
  const metrics=[...location.querySelectorAll('.report-metrics div')].slice(0,3).map(node=>clean(node.textContent)).filter(Boolean);
  const status=location.querySelector('.report-metrics .report-status')?.outerHTML||'';
  const button=doc.createElement('button');
  button.type='button';
  button.className='report-location-summary-v432 report-accordion-summary-v432 report-location-summary-v433';
  button.setAttribute('aria-expanded',String(open));
  button.innerHTML=`<span class="report-rank-v432">${String(index+1).padStart(2,'0')}</span><span class="report-location-summary-title-v432"><strong>${title}</strong>${address?`<small>${address}</small>`:''}</span><span class="report-location-summary-metrics-v432">${metrics.map(value=>`<em>${value}</em>`).join('')}</span>${status}<span class="report-chevron-v432" aria-hidden="true"></span>`;
  return button;
}
function wrapFullLocations(doc){
  if(isSingle(doc))return;
  doc.querySelectorAll('.report-location').forEach((location,index)=>{
    if(location.dataset.reportAccordionV432){location.classList.add('report-location-editorial-v433');return}
    const open=index===0;
    const body=doc.createElement('div');
    body.className='report-accordion-body-v432 report-accordion-body-v433';
    if(!open)body.hidden=true;
    while(location.firstChild)body.appendChild(location.firstChild);
    location.classList.add('report-accordion-v432','report-location-accordion-v432','report-location-editorial-v433');
    location.dataset.reportAccordionV432='';
    location.dataset.open=String(open);
    location.append(makeLocationSummary(doc,body,index,open),body);
  });
}
function styles(){return `<style id="reportFinalV432" data-version="${VERSION}">
:root{--g:#164a37;--gd:#103b2b;--gs:#e8f1eb;--ink:#172720;--muted:#64736c;--line:#dfe5e1;--paper:#fffefb;--bg:#f4f1ea;--gold:#b48c4d;--goldsoft:#f3ead9;--shadow:0 18px 55px rgba(24,54,42,.08)}
*{box-sizing:border-box}html{margin:0;background:var(--bg);color:var(--ink);font:15px/1.58 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}body{margin:0}.report-document{max-width:1180px;margin:auto;padding:40px 32px 56px}.report-actions{display:flex;justify-content:flex-end;margin:0 0 16px}.report-actions button{min-height:38px;border:0;border-radius:999px;background:var(--gd);color:#fff;padding:8px 16px;font-weight:700}
.report-cover{overflow:hidden;margin:0 0 32px;border-radius:26px;background:linear-gradient(123deg,var(--gd),var(--g) 68%,#365e47);color:#fff;padding:34px 40px 0;box-shadow:var(--shadow)}.report-cover h1{margin:0;font-size:38px;font-weight:780;line-height:1.08;letter-spacing:-.035em}.report-eyebrow{margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;opacity:.72}.report-subtitle{margin:12px 0 0;font-size:18px}.report-executive-line-v433{max-width:720px;margin:14px 0 28px;color:#ffffffc2;font-size:14px}.report-cover-grid{display:grid;grid-template-columns:1.4fr .65fr 1fr 1fr;margin:0 -40px;padding:0 40px;border-top:1px solid #ffffff2b;background:#ffffff08}.report-cover-grid>div{padding:18px;border-right:1px solid #ffffff21}.report-cover-grid>div:first-child{padding-left:0}.report-cover-grid>div:last-child{border-right:0}.report-cover-grid span,.report-kpi-grid span,.report-field span,.report-decision-strip span{display:block;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase}.report-cover-grid span{opacity:.62}.report-cover-grid strong{display:block;margin-top:6px;font-size:16px}
.report-summary,.report-comparison,.report-location{margin:0 0 32px;background:var(--paper)}.report-summary{display:grid;grid-template-columns:minmax(210px,.75fr) minmax(0,2fr);gap:28px;align-items:center;padding:26px 28px;border-top:3px solid var(--g);border-bottom:1px solid var(--line);border-radius:18px;box-shadow:0 8px 24px #18362a0e}.report-summary h2,.report-comparison h2{margin:0;font-size:26px;line-height:1.2}.report-summary p:not(.report-eyebrow){margin:8px 0 0;color:var(--muted)}.report-kpi-grid{display:grid;grid-template-columns:repeat(4,1fr)}.report-kpi-grid>div{padding:4px 20px;border-left:1px solid var(--line)}.report-kpi-grid>div:first-child{border-left:0}.report-kpi-grid strong{display:block;margin-top:5px;color:var(--g);font-size:32px;line-height:1;font-weight:780}.report-comparison{padding:26px 28px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.report-table-wrap{overflow:auto;margin-top:18px}table{width:100%;border-collapse:collapse;min-width:780px}th,td{padding:14px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top;font-size:13px}th{color:var(--g);background:#f3f6f3;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}td small{display:block;margin-top:3px;color:var(--muted)}
.report-status{display:inline-flex;align-items:center;justify-content:center;min-height:32px;border-radius:999px;background:var(--gs);color:var(--g);padding:6px 11px;font-size:12px;font-weight:700;line-height:1;white-space:nowrap}.report-status.stop{background:#f8e4e1;color:#8b2e2e}.report-status.risk,.report-status.medium{background:#f6ecd6;color:#795312}.report-status.empty{background:#ecefed;color:#66726c}.report-status.priority,.report-status.good{background:#e1efe6;color:#175c3d}
.report-location{overflow:hidden;border-top:3px solid var(--g);border-bottom:1px solid var(--line);border-radius:18px;box-shadow:0 10px 30px #18362a12}.report-single-location-v432{padding-bottom:6px}.report-location-header{display:grid;grid-template-columns:minmax(0,1fr) 390px;gap:26px;align-items:start;padding:28px 30px;background:linear-gradient(180deg,#fffefb,#faf9f5)}.report-location-header h2{margin:0;color:var(--gd);font-size:28px;line-height:1.16}.report-location-header p:not(.report-eyebrow){margin:8px 0 0;color:var(--muted)}.report-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-left:1px solid var(--line)}.report-metrics>div{padding:6px 16px;text-align:center;border-right:1px solid var(--line)}.report-metrics span{display:block;color:var(--muted);font-size:12px}.report-metrics strong{display:block;margin-top:5px;color:var(--g);font-size:30px;line-height:1;font-weight:780}.report-metrics>.report-status{grid-column:1/-1;justify-self:center;margin-top:14px}.report-decision-strip{display:grid;grid-template-columns:minmax(140px,.3fr) 1fr;gap:18px;align-items:center;padding:18px 30px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:#f6f2e8}.report-decision-strip strong{color:var(--gd);font-size:18px}
.report-location-summary-v432{width:100%;display:grid;grid-template-columns:auto minmax(0,1fr) auto auto auto;gap:14px;align-items:center;border:0;background:linear-gradient(90deg,#fffefb,#f7f7f2);padding:20px 22px;text-align:left;cursor:pointer}.report-rank-v432{display:inline-flex;width:34px;height:34px;align-items:center;justify-content:center;border-radius:50%;background:var(--gs);color:var(--g);font-size:12px;font-weight:750}.report-location-summary-title-v432 strong{display:block;font-size:17px}.report-location-summary-title-v432 small{display:block;color:var(--muted);font-size:12px}.report-location-summary-metrics-v432{display:flex;gap:6px}.report-location-summary-metrics-v432 em{font-style:normal;border-radius:999px;background:#f1f4f2;padding:6px 9px;color:var(--g);font-size:12px}.report-chevron-v432{width:9px;height:9px;border-right:1.5px solid;border-bottom:1.5px solid;transform:rotate(45deg);opacity:.55}.report-accordion-summary-v432[aria-expanded="true"] .report-chevron-v432{transform:rotate(225deg)}
.report-single-location-v432>.report-section{margin:0 30px;border-top:1px solid var(--line)}.report-section-accordion-v432{border-radius:0;background:transparent;box-shadow:none}.report-section-accordion-v432:before{display:none}.report-accordion-summary-v432{width:100%;display:grid;grid-template-columns:38px 1fr auto;gap:14px;align-items:center;border:0;background:transparent;padding:20px 2px;text-align:left;cursor:pointer}.report-section-icon-v432{color:var(--gold);font-size:12px;font-weight:750}.report-section-label-v432 strong{display:block;font-size:18px}.report-section-label-v432 small{display:block;color:var(--muted);font-size:12px}.report-section-accordion-v432>.report-accordion-body-v432{padding:0 0 24px 52px}.report-accordion-body-v432{border:0;background:transparent}.report-location-accordion-v432 .report-section{margin:0 30px;padding:24px 0;border-bottom:1px solid var(--line);background:transparent}.report-location-accordion-v432 .report-section h2,.report-location-accordion-v432 .report-section h3{font-size:19px}
.report-field-grid{display:grid;grid-template-columns:repeat(2,1fr);border:0;background:transparent}.report-field{display:grid;grid-template-columns:minmax(120px,38%) 1fr;gap:18px;padding:13px 0;border:0;border-bottom:1px solid var(--line);background:transparent}.report-field-wide{grid-column:1/-1}.report-field span{color:var(--muted);font-size:12px}.report-field strong{font-size:15px;font-weight:560;white-space:pre-wrap;overflow-wrap:anywhere}.report-narrative-row-v433{grid-template-columns:minmax(150px,25%) 1fr;padding:16px 0}.report-narrative-row-v433 strong{max-width:72ch;font-weight:480;line-height:1.65}.report-mini-list{display:grid;gap:16px}.report-mini-list article,.report-empty,.report-note{padding:18px 20px;border:0;border-left:3px solid var(--gold);border-radius:0 12px 12px 0;background:#f8f6f0}.report-mini-list h4{margin:0 0 10px;color:var(--g);font-size:16px}.report-photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.report-photo{overflow:hidden;border-radius:14px;box-shadow:0 8px 24px #18362a0e}.report-photo img{display:block;width:100%;height:210px;object-fit:cover}.report-photo figcaption{padding:12px 14px;color:var(--muted);font-size:12px}.report-meta-footer{margin-top:34px;color:var(--muted);font-size:12px;text-align:center}
@media(max-width:820px){.report-document{padding:18px 12px 36px}.report-cover{padding:28px 24px 0}.report-cover h1{font-size:31px}.report-cover-grid{grid-template-columns:repeat(2,1fr);margin:0 -24px;padding:0 24px}.report-summary,.report-location-header{grid-template-columns:1fr}.report-kpi-grid{grid-template-columns:repeat(2,1fr);row-gap:20px}.report-comparison{padding:20px 16px}.report-location-summary-v432{grid-template-columns:auto 1fr auto}.report-location-summary-metrics-v432,.report-location-summary-v432>.report-status{grid-column:2/-1;justify-self:start}.report-field-grid{grid-template-columns:1fr}.report-field,.report-narrative-row-v433{grid-template-columns:minmax(105px,36%) 1fr}.report-photo-grid{grid-template-columns:1fr 1fr}table{min-width:720px}}
@media(max-width:520px){.report-cover h1{font-size:28px}.report-cover-grid{grid-template-columns:1fr}.report-location-summary-metrics-v432{display:none}.report-field,.report-narrative-row-v433{grid-template-columns:1fr;gap:5px}.report-photo-grid{grid-template-columns:1fr}}
@media print{@page{size:A4 portrait;margin:14mm}html,body{background:#fff}.report-document{max-width:none;padding:0}.report-actions{display:none!important}.report-cover,.report-summary,.report-comparison,.report-location{box-shadow:none}.report-cover{margin:0 0 8mm;border-radius:0}.report-location{break-inside:avoid}.report-location>.report-accordion-body-v432,.report-accordion-body-v432[hidden]{display:block!important}.report-chevron-v432{display:none!important}.report-location-header{grid-template-columns:1fr 74mm}.report-section,.report-photo{break-inside:avoid}.report-photo-grid{grid-template-columns:repeat(2,1fr)}.report-photo img{height:46mm}.report-table-wrap{overflow:visible}table{min-width:0}}
</style>`}
function reportScript(){return `<script>(function(){let states=[];function set(button,open){const accordion=button.closest('.report-accordion-v432'),body=accordion&&accordion.querySelector(':scope > .report-accordion-body-v432');if(!body)return;button.setAttribute('aria-expanded',String(open));body.hidden=!open;accordion.dataset.open=String(open)}document.addEventListener('click',event=>{const button=event.target.closest('.report-accordion-summary-v432');if(button){set(button,button.getAttribute('aria-expanded')!=='true');return}const image=event.target.closest('.report-photo img');if(image)window.open(image.src,'_blank','noopener')});addEventListener('beforeprint',()=>{states=[...document.querySelectorAll('.report-accordion-summary-v432')].map(button=>[button,button.getAttribute('aria-expanded')==='true']);states.forEach(state=>set(state[0],true))});addEventListener('afterprint',()=>{states.forEach(state=>set(state[0],state[1]));states=[]})})();<\/script>`}
function finalizeHtml(html){
  html=String(html||'').replace(/4\.3\.[12]/g,VERSION).replace(/финальный экспорт|premium export/gi,'управленческий экспорт');
  const doc=new DOMParser().parseFromString(html,'text/html');
  doc.querySelectorAll('style,script').forEach(node=>node.remove());
  doc.head.insertAdjacentHTML('beforeend',styles());
  doc.head.insertAdjacentHTML('beforeend',`<meta name="generator" content="Bogatka premium export ${VERSION}">`);
  doc.body.insertAdjacentHTML('beforeend',reportScript());
  premiumizeCover(doc);
  removeNoise(doc);
  addClasses(doc);
  wrapFullLocations(doc);
  wrapSingleSections(doc);
  addClasses(doc);
  doc.title=clean(doc.title).replace(/^Премиальный\s+/i,'').replace(/^Отчёт/i,'Управленческий отчёт').replace(/^Сводный/i,'Управленческий сводный')||'Управленческий отчёт Богатка';
  const footer=doc.querySelector('.report-meta-footer');
  if(footer)footer.textContent=clean(footer.textContent).replace(/4\.3\.2/g,VERSION);
  return`<!doctype html>\n${doc.documentElement.outerHTML}`;
}
function claim(builder){
  const api=window.BogatkaLiveReport;
  if(api){api.version=VERSION;api.build=builder;api.finalizeReportHtmlV432=finalizeHtml;api.finalizeReportHtmlV433=finalizeHtml;api.buildLocationReportHtml=buildLocationReportHtmlV433;api.exportLocationHtmlReport=exportLocationHtmlReportV433}
  window.buildReportHtml=builder;
  window.exportHtmlReport=builder.__htmlAction;
  window.openPdfReport=builder.__pdfAction;
  window.buildLocationReportHtml=buildLocationReportHtmlV433;
  window.exportLocationHtmlReport=exportLocationHtmlReportV433;
  try{buildReportHtml=window.buildReportHtml;exportHtmlReport=window.exportHtmlReport;openPdfReport=window.openPdfReport}catch(_){}
}
async function buildLocationReportHtmlV433(locationId){
  const base=window.BogatkaReportFinalizeV431;
  if(typeof base?.buildLocationReportHtml!=='function')throw new Error('Финальный модуль v431 ещё не готов.');
  return finalizeHtml(await base.buildLocationReportHtml(locationId));
}
async function exportLocationHtmlReportV433(locationId){
  const item=(Array.isArray(window.locations)?window.locations:[]).find(location=>location.id===locationId);
  if(typeof showSaving==='function')showSaving();
  try{
    const html=await buildLocationReportHtmlV433(locationId);
    downloadBlob(new Blob([html],{type:'text/html;charset=utf-8'}),`bogatka-location-${safeName(item?.title||item?.address||locationId)}-${new Date().toISOString().slice(0,10)}.html`);
    if(typeof showSaved==='function')showSaved();
    return html;
  }catch(error){if(typeof showError==='function')showError(error);throw error}
}
function install(){
  attempts+=1;
  const api=window.BogatkaLiveReport;
  const current=api?.build||window.buildReportHtml;
  const base=window.BogatkaReportFinalizeV431;
  if(!base?.ready||typeof base.renderReport!=='function'||typeof current!=='function'||current.__reportFinalizeV433!==undefined){
    if(current?.__reportFinalizeV433)claim(current);
    if(attempts<160)setTimeout(install,250);
    return;
  }
  if(!current.__reportFinalizeV431){if(attempts<160)setTimeout(install,250);return}
  const baseBuild=current;
  const wrapped=async function(){const html=await baseBuild();claim(wrapped);return finalizeHtml(html)};
  Object.assign(wrapped,baseBuild,{__reportFinalizeV433:true,__reportFinalizeV432:true,__reportFinalizeV431:true,__reportStabilityV429:true,__reportAuthorityV428:true,__reportPolishV428:true,__liveReportFinalV427:true,__base:baseBuild});
  wrapped.__htmlAction=async()=>{if(typeof showSaving==='function')showSaving();const html=await wrapped();downloadBlob(new Blob([html],{type:'text/html;charset=utf-8'}),`bogatka-premium-report-${new Date().toISOString().slice(0,10)}.html`);if(typeof showSaved==='function')showSaved();return html};
  wrapped.__pdfAction=async()=>{const reportWindow=window.open('','_blank');if(!reportWindow)return alert('Браузер заблокировал новое окно. Разрешите всплывающие окна для создания PDF.');reportWindow.document.write('<p style="font-family:Arial;padding:30px">Формируется полный отчёт…</p>');try{const html=await wrapped();reportWindow.document.open();reportWindow.document.write(html);reportWindow.document.close();await wait(220);reportWindow.focus();reportWindow.print()}catch(error){reportWindow.close();throw error}};
  claim(wrapped);
  if(attempts<160)setTimeout(install,250);
}
const buildLocationReportHtmlV432=buildLocationReportHtmlV433;
const exportLocationHtmlReportV432=exportLocationHtmlReportV433;
const finalizer={version:VERSION,ready:true,install,finalizeHtml,buildLocationReportHtml:buildLocationReportHtmlV432,exportLocationHtmlReport:exportLocationHtmlReportV432};
window.BogatkaReportFinalizeV432=finalizer;
window.BogatkaReportFinalizeV433=finalizer;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.addEventListener('load',()=>setTimeout(install,100),{once:true});
})();
