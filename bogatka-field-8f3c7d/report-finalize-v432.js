(function(){
'use strict';
if(window.BogatkaReportFinalizeV432?.ready)return;
const VERSION='4.3.2';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let attempts=0;
const clean=value=>String(value??'').replace(/[\s\u00a0]+/g,' ').trim();
const zeroScoreValue=value=>/^0\s*\/\s*(?:70|100)(?:\s+\S+)?$/i.test(clean(value))||/^0\s*%$/.test(clean(value));
function safeFileNamePart(value){const normalized=String(value||'location').normalize('NFKD').replace(/[\u0300-\u036f]/g,'');const safe=normalized.replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]+/g,'-').replace(/^-+|-+$/g,'').replace(/-{2,}/g,'-');return(safe||'location').slice(0,72)}
function removeZeroNoise(doc){
  doc.querySelectorAll('.report-metrics div').forEach(metric=>{if(zeroScoreValue(metric.querySelector('strong')?.textContent))metric.remove()});
  doc.querySelectorAll('td').forEach(cell=>{if(zeroScoreValue(cell.textContent))cell.textContent='—'});
  doc.querySelectorAll('.report-field').forEach(field=>{
    const label=clean(field.querySelector('span')?.textContent);
    const value=clean(field.querySelector('strong')?.textContent);
    if(/^(0(?:[,.]0+)?\s*BYN|0(?:[,.]0+)?%|0(?:[,.]0+)?\s*мес\.)$/i.test(value))field.remove();
    if(label==='Статус экономики'&&/недостаточно данных/i.test(value))field.remove();
  });
  doc.querySelectorAll('.report-section').forEach(section=>{
    const title=clean(section.querySelector('h2,h3')?.textContent);
    const body=section.querySelector('.report-section-body');
    if(title!=='Экономическая модель'||!body)return;
    const fields=body.querySelectorAll('.report-field').length;
    const text=clean(body.textContent);
    if(!fields||(!/выручк|марж|окупаем|прибыл/i.test(text)&&/недостаточно данных/i.test(text))){
      body.innerHTML='<div class="report-empty report-empty-v432 compact">Экономическая модель не рассчитана: не хватает прогноза выручки и валовой маржи. Нулевые расчётные строки скрыты.</div>';
    }
  });
}
function premiumizeCover(doc){const cover=doc.querySelector('.report-cover');if(!cover)return;cover.classList.add('report-cover-v432');const eyebrow=cover.querySelector('.report-eyebrow');if(eyebrow)eyebrow.textContent=`Bogatka · premium export · ${VERSION}`;if(!cover.querySelector('.report-cover-orb-v432'))cover.insertAdjacentHTML('afterbegin','<div class="report-cover-orb-v432" aria-hidden="true"></div>')}
function sectionSubtitle(title){if(title==='Основные сведения')return'адрес, статус, контакт';if(title==='Технические параметры')return'площадь, аренда, инженерия';if(title==='Экономическая модель')return'выручка, маржа, Окупаемость';if(title==='Трафик')return'замеры потока';if(title==='Конкуренты')return'окружение и цены';if(title==='Решение')return'решение и аргументация';if(title==='Фотографии')return'фотофиксация';return'детали раздела'}
function wrapSingleSections(doc){
  doc.querySelectorAll('.report-single-location-v432 .report-section,.report-location:not(.report-location-accordion-v432) > .report-section').forEach((section,index)=>{
    if(section.dataset.reportAccordionV432)return;
    const title=clean(section.querySelector('.report-section-title h2,.report-section-title h3')?.textContent)||`Раздел ${index+1}`;
    const open=/^(Основные сведения|Решение)$/i.test(title);
    const body=section.querySelector('.report-section-body');
    if(!body)return;
    const summary=doc.createElement('button');
    summary.type='button';
    summary.className='report-accordion-summary-v432';
    summary.setAttribute('aria-expanded',String(open));
    summary.innerHTML=`<span class="report-section-icon-v432">${String(index+1).padStart(2,'0')}</span><span class="report-section-label-v432"><strong>${title}</strong><small>${sectionSubtitle(title)}</small></span><span class="report-chevron-v432" aria-hidden="true"></span>`;
    const accordionBody=doc.createElement('div');
    accordionBody.className='report-accordion-body-v432';
    if(!open)accordionBody.hidden=true;
    accordionBody.innerHTML=body.innerHTML;
    section.innerHTML='';
    section.classList.add('report-accordion-v432','report-section-accordion-v432');
    section.dataset.reportAccordionV432='';
    section.dataset.open=String(open);
    section.append(summary,accordionBody);
  });
}
function makeLocationSummary(doc,location,index,open){
  const title=clean(location.querySelector('.report-location-header h2')?.textContent)||`Локация ${index+1}`;
  const address=clean(location.querySelector('.report-location-header p:not(.report-eyebrow)')?.textContent);
  const metrics=[...location.querySelectorAll('.report-metrics div')].slice(0,3).map(node=>clean(node.textContent)).filter(Boolean);
  const status=location.querySelector('.report-metrics .report-status')?.outerHTML||'';
  const button=doc.createElement('button');
  button.type='button';
  button.className='report-location-summary-v432 report-accordion-summary-v432';
  button.setAttribute('aria-expanded',String(open));
  button.innerHTML=`<span class="report-rank-v432">#${index+1}</span><span class="report-location-summary-title-v432"><strong>${title}</strong>${address?`<small>${address}</small>`:''}</span><span class="report-location-summary-metrics-v432">${metrics.map(value=>`<em>${value.replace(/\s+/g,' ')}</em>`).join('')}</span>${status}<span class="report-chevron-v432" aria-hidden="true"></span>`;
  return button;
}
function wrapFullLocations(doc){
  const single=!doc.querySelector('.report-summary,.report-comparison');
  if(single)return;
  doc.querySelectorAll('.report-location').forEach((location,index)=>{
    if(location.dataset.reportAccordionV432)return;
    const open=index===0;
    const summary=makeLocationSummary(doc,location,index,open);
    const body=doc.createElement('div');
    body.className='report-accordion-body-v432';
    if(!open)body.hidden=true;
    while(location.firstChild)body.appendChild(location.firstChild);
    location.classList.add('report-accordion-v432','report-location-accordion-v432');
    location.dataset.reportAccordionV432='';
    location.dataset.open=String(open);
    location.prepend(summary);
    location.appendChild(body);
  });
}
function addPremiumClasses(doc){
  const single=!doc.querySelector('.report-summary,.report-comparison');
  doc.querySelector('.report-document')?.classList.add('report-document-v432');
  doc.querySelector('.report-summary')?.classList.add('report-summary-v432');
  doc.querySelector('.report-comparison')?.classList.add('report-comparison-v432');
  doc.querySelectorAll('.report-location').forEach(location=>{if(single)location.classList.add('report-single-location-v432')});
  doc.querySelectorAll('.report-location-header').forEach(header=>header.classList.add('report-location-hero-v432'));
  doc.querySelectorAll('.report-metrics').forEach(metrics=>metrics.classList.add('report-score-hero-v432'));
  doc.querySelectorAll('.report-decision-strip').forEach(strip=>strip.classList.add('report-decision-strip-v432'));
  doc.querySelectorAll('.report-field-grid').forEach(grid=>grid.classList.add('report-data-list-v432'));
  doc.querySelectorAll('.report-field').forEach(field=>field.classList.add('report-data-row-v432'));
  doc.querySelectorAll('.report-mini-list').forEach(list=>list.classList.add('report-mini-list-v432'));
  doc.querySelectorAll('.report-photo-grid').forEach(grid=>grid.classList.add('report-photo-grid-v432'));
  doc.querySelectorAll('.report-photo').forEach(photo=>photo.classList.add('report-photo-v432'));
  doc.querySelectorAll('.report-empty,.report-note').forEach(note=>note.classList.add('report-empty-v432'));
}
function styles(){return `<style id="reportFinalV432">:root{--green:#14563e;--ink:#142b23;--muted:#657a71;--line:#dbe7e1;--soft:#f4f8f5;--gold:#c69b4a;--bad:#fdecec;--shadow:0 20px 70px rgba(16,70,48,.11);--soft-shadow:0 10px 32px rgba(16,70,48,.07)}*{box-sizing:border-box}html{margin:0;background:radial-gradient(circle at 20% 0%,#fff 0,#eff6f1 34%,#e7f0eb 100%);color:var(--ink);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}body{margin:0;line-height:1.5}.report-document{max-width:1240px;margin:0 auto;padding:28px}.report-actions{display:flex;gap:8px;justify-content:flex-end;margin:0 0 16px}.report-actions button{border:0;border-radius:999px;background:var(--green);color:#fff;padding:10px 15px;font-weight:850;box-shadow:var(--soft-shadow)}.report-cover{position:relative;overflow:hidden;border-radius:34px;background:linear-gradient(135deg,#0f3f2d 0%,#1d6c4d 58%,#c5a35b 150%);color:#fff;padding:42px 44px;box-shadow:var(--shadow);margin-bottom:26px}.report-cover:after{content:"";position:absolute;inset:auto -120px -170px auto;width:360px;height:360px;border-radius:999px;background:rgba(255,255,255,.13)}.report-cover-orb-v432{position:absolute;right:38px;top:30px;width:90px;height:90px;border-radius:999px;background:radial-gradient(circle,#fff8 0,#fff0 65%)}.report-cover h1{margin:0;font-size:42px;line-height:1.06;letter-spacing:-.035em}.report-subtitle{margin:14px 0 30px;opacity:.87;font-size:17px}.report-eyebrow{margin:0 0 9px;color:inherit;opacity:.72;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.1em}.report-cover-grid,.report-kpi-grid{position:relative;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.report-cover-grid>div,.report-kpi-grid>div{border:1px solid rgba(255,255,255,.24);border-radius:18px;background:rgba(255,255,255,.12);padding:14px}.report-cover-grid span,.report-kpi-grid span,.report-field span,.report-decision-strip span{display:block;opacity:.68;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.07em}.report-cover-grid strong,.report-kpi-grid strong{display:block;margin-top:6px;font-size:18px;line-height:1.18}.report-summary,.report-comparison,.report-location{border:1px solid var(--line);border-radius:28px;background:rgba(255,255,255,.92);box-shadow:var(--shadow);margin:22px 0}.report-summary{display:grid;grid-template-columns:330px minmax(0,1fr);gap:24px;padding:24px}.report-summary h2,.report-comparison h2{margin:0;color:var(--green);font-size:25px}.report-summary p:not(.report-eyebrow){margin:8px 0 0;color:var(--muted)}.report-kpi-grid>div{border-color:var(--line);background:linear-gradient(180deg,#fff,#f8fbf9);color:var(--ink)}.report-kpi-grid strong{color:var(--green);font-size:28px}.report-comparison{padding:22px}.report-table-wrap{overflow:auto;border:1px solid var(--line);border-radius:18px;background:#fff}table{width:100%;border-collapse:collapse;min-width:780px}th,td{border-bottom:1px solid var(--line);padding:12px;text-align:left;vertical-align:top;font-size:12px}th{background:#eef7f2;color:var(--green);font-weight:900}td small{display:block;color:var(--muted);margin-top:3px}.report-status{display:inline-flex;align-items:center;justify-content:center;min-height:30px;border-radius:999px;background:#e8f4ee;color:var(--green);padding:6px 10px;font-size:11px;font-weight:900;text-align:center;white-space:nowrap}.report-status.stop{background:var(--bad);color:#8d3030}.report-status.risk,.report-status.medium{background:#fff0d2;color:#805610}.report-status.empty{background:#edf1ef;color:#68776f}.report-status.priority,.report-status.good{background:#e2f3e9;color:#17613d}.report-location{overflow:hidden}.report-location-header{display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:24px;align-items:start;padding:26px 28px;background:linear-gradient(180deg,#fffdf9,#f5faf7)}.report-location-header h2{margin:0;color:var(--green);font-size:28px;line-height:1.14}.report-location-header p:not(.report-eyebrow){margin:7px 0 0;color:var(--muted)}.report-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.report-metrics>div{border:1px solid var(--line);border-radius:17px;background:#fff;padding:12px;text-align:center;box-shadow:var(--soft-shadow)}.report-metrics span{display:block;color:var(--muted);font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.06em}.report-metrics strong{display:block;margin-top:4px;color:var(--green);font-size:23px}.report-metrics>.report-status{grid-column:1/-1}.report-decision-strip{display:flex;gap:12px;align-items:center;border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:linear-gradient(90deg,#f7fbf8,#fffdf7);padding:14px 28px}.report-decision-strip strong{font-size:18px;color:var(--green)}.report-location-body-v432,.report-location>.report-accordion-body-v432{padding:18px 22px 24px}.report-accordion-v432{border:1px solid var(--line);border-radius:22px;background:#fff;margin:12px 0;overflow:hidden;box-shadow:none}.report-location-accordion-v432{border-radius:28px;box-shadow:var(--shadow);margin:22px 0}.report-section-accordion-v432{background:linear-gradient(180deg,#fff,#fbfdfb)}.report-section-accordion-v432:before{content:"";display:block;height:3px;background:linear-gradient(90deg,var(--green),rgba(198,155,74,.62));opacity:.8}.report-accordion-summary-v432{width:100%;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:13px;border:0;background:transparent;color:var(--ink);padding:15px 17px;text-align:left;cursor:pointer;font:inherit}.report-location-summary-v432{grid-template-columns:auto minmax(0,1fr) auto auto auto;padding:18px 20px;background:linear-gradient(90deg,#fff,#f7fbf8)}.report-rank-v432,.report-section-icon-v432{display:inline-flex;align-items:center;justify-content:center;min-width:36px;height:36px;border-radius:999px;background:#e8f4ee;color:var(--green);font-size:12px;font-weight:950}.report-section-label-v432 strong,.report-location-summary-title-v432 strong{display:block;color:var(--green);font-size:16px}.report-section-label-v432 small,.report-location-summary-title-v432 small{display:block;margin-top:2px;color:var(--muted);font-size:12px}.report-location-summary-metrics-v432{display:flex;gap:7px;align-items:center}.report-location-summary-metrics-v432 em{font-style:normal;border:1px solid var(--line);border-radius:999px;background:#fff;padding:6px 8px;color:var(--green);font-size:12px;font-weight:900}.report-chevron-v432{width:10px;height:10px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);transition:.18s ease;opacity:.55}.report-accordion-summary-v432[aria-expanded="true"] .report-chevron-v432{transform:rotate(225deg)}.report-accordion-body-v432{border-top:1px solid var(--line);background:linear-gradient(180deg,#fff,#fcfdfb)}.report-section-accordion-v432>.report-accordion-body-v432{padding:16px 18px}.report-field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0;border:1px solid var(--line);border-radius:18px;overflow:hidden;background:#fff}.report-field{display:grid;grid-template-columns:42% minmax(0,1fr);gap:12px;border:0!important;border-bottom:1px solid var(--line)!important;border-radius:0!important;background:#fff!important;padding:12px 14px!important}.report-field-wide{grid-column:1/-1}.report-field span{color:var(--muted)!important;font-size:12px!important;font-weight:850!important;opacity:1!important}.report-field strong{margin:0!important;color:var(--ink);font-weight:760;white-space:pre-wrap;overflow-wrap:anywhere}.report-empty,.report-note{border:1px dashed #cbdcd3;border-radius:18px;background:#f7fbf8;color:var(--muted);padding:14px 16px;font-weight:760}.report-mini-list{display:grid;gap:12px}.report-mini-list article{border:1px solid var(--line);border-radius:18px;background:#fff;padding:14px}.report-mini-list h4{margin:0 0 12px;color:var(--green)}.report-photo-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.report-photo{margin:0;border:1px solid var(--line);border-radius:18px;overflow:hidden;background:#fff;box-shadow:var(--soft-shadow)}.report-photo img{display:block;width:100%;height:190px;object-fit:cover}.report-photo figcaption{padding:10px 12px;font-size:12px;color:var(--muted)}.report-meta-footer{margin:26px 0 0;color:var(--muted);font-size:12px;text-align:center}@media(max-width:820px){.report-document{padding:12px}.report-cover{border-radius:24px;padding:28px}.report-cover h1{font-size:30px}.report-cover-grid,.report-kpi-grid,.report-summary,.report-location-header,.report-field-grid,.report-photo-grid{grid-template-columns:1fr}.report-metrics{max-width:420px}.report-location-summary-v432{grid-template-columns:auto minmax(0,1fr) auto}.report-location-summary-metrics-v432,.report-location-summary-v432>.report-status{grid-column:2/-1;justify-self:start}table{min-width:720px}}@media print{@page{size:A4 portrait;margin:12mm}html,body{background:#fff}.report-document{max-width:none;padding:0}.report-actions{display:none!important}.report-cover,.report-summary,.report-comparison,.report-location,.report-accordion-v432{box-shadow:none;break-inside:avoid}.report-cover{border-radius:0;margin:0 0 7mm}.report-cover-orb-v432,.report-chevron-v432{display:none!important}.report-accordion-body-v432[hidden]{display:block!important}.report-accordion-summary-v432{cursor:default}.report-location-header{grid-template-columns:minmax(0,1fr) 78mm}.report-photo img{height:42mm}}</style>`}
function script(){return `<script>(function(){document.addEventListener('click',function(event){const button=event.target.closest('.report-accordion-summary-v432');if(button){const accordion=button.closest('.report-accordion-v432');const body=accordion&&accordion.querySelector(':scope > .report-accordion-body-v432');if(body){const expanded=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!expanded));body.hidden=expanded;accordion.dataset.open=String(!expanded);}}const img=event.target.closest('.report-photo img,.report-photo-v432 img');if(img)window.open(img.src,'_blank','noopener');});})();<\/script>`}
function finalizeHtml(html){
  html=String(html||'').replace(/4\.3\.1/g,VERSION).replace(/финальный экспорт/g,'premium export');
  const parser=new DOMParser();
  const doc=parser.parseFromString(html,'text/html');
  doc.querySelectorAll('style,script').forEach(node=>node.remove());
  doc.head.insertAdjacentHTML('beforeend',styles());
  doc.body.insertAdjacentHTML('beforeend',script());
  premiumizeCover(doc);
  removeZeroNoise(doc);
  addPremiumClasses(doc);
  wrapFullLocations(doc);
  wrapSingleSections(doc);
  doc.title=clean(doc.title).replace('Отчёт','Премиальный отчёт').replace('Сводный','Премиальный сводный')||'Премиальный отчёт Богатка';
  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}
function claim(builder){const api=window.BogatkaLiveReport;if(api){api.version=VERSION;api.build=builder;api.finalizeReportHtmlV432=finalizeHtml;api.buildLocationReportHtml=buildLocationReportHtmlV432;api.exportLocationHtmlReport=exportLocationHtmlReportV432}window.buildReportHtml=builder;window.exportHtmlReport=builder.__htmlAction;window.openPdfReport=builder.__pdfAction;window.buildLocationReportHtml=buildLocationReportHtmlV432;window.exportLocationHtmlReport=exportLocationHtmlReportV432;try{buildReportHtml=window.buildReportHtml;exportHtmlReport=window.exportHtmlReport;openPdfReport=window.openPdfReport}catch(_){}}
async function buildLocationReportHtmlV432(locationId){const base=window.BogatkaReportFinalizeV431;if(typeof base?.buildLocationReportHtml!=='function')throw new Error('Финальный модуль v431 ещё не готов.');return finalizeHtml(await base.buildLocationReportHtml(locationId))}
async function exportLocationHtmlReportV432(locationId){const item=(Array.isArray(window.locations)?window.locations:[]).find(x=>x.id===locationId);if(typeof showSaving==='function')showSaving();try{const html=await buildLocationReportHtmlV432(locationId);downloadBlob(new Blob([html],{type:'text/html;charset=utf-8'}),`bogatka-location-${safeFileNamePart(item?.title||item?.address||locationId)}-${new Date().toISOString().slice(0,10)}.html`);if(typeof showSaved==='function')showSaved();return html}catch(error){if(typeof showError==='function')showError(error);throw error}}
function install(){attempts+=1;const api=window.BogatkaLiveReport,current=api?.build||window.buildReportHtml,base=window.BogatkaReportFinalizeV431;if(!base?.ready||typeof base.renderReport!=='function'||typeof current!=='function'||current.__reportFinalizeV432!==undefined){if(current?.__reportFinalizeV432)claim(current);if(attempts<160)setTimeout(install,250);return}if(!current.__reportFinalizeV431){if(attempts<160)setTimeout(install,250);return}const baseBuild=current;const wrapped=async function(){const html=await baseBuild();claim(wrapped);return finalizeHtml(html)};Object.assign(wrapped,baseBuild);wrapped.__reportFinalizeV432=true;wrapped.__reportFinalizeV431=true;wrapped.__reportStabilityV429=true;wrapped.__reportAuthorityV428=true;wrapped.__reportPolishV428=true;wrapped.__liveReportFinalV427=true;wrapped.__base=baseBuild;wrapped.__htmlAction=async()=>{if(typeof showSaving==='function')showSaving();const html=await wrapped();downloadBlob(new Blob([html],{type:'text/html;charset=utf-8'}),`bogatka-premium-report-${new Date().toISOString().slice(0,10)}.html`);if(typeof showSaved==='function')showSaved();return html};wrapped.__pdfAction=async()=>{const reportWindow=window.open('','_blank');if(!reportWindow)return alert('Браузер заблокировал новое окно. Разрешите всплывающие окна для создания PDF.');reportWindow.document.write('<p style="font-family:Arial;padding:30px">Формируется полный отчёт…</p>');try{const html=await wrapped();reportWindow.document.open();reportWindow.document.write(html);reportWindow.document.close();await wait(220);reportWindow.focus();reportWindow.print()}catch(error){reportWindow.close();throw error}};claim(wrapped);if(attempts<160)setTimeout(install,250)}
window.BogatkaReportFinalizeV432={version:VERSION,ready:true,install,finalizeHtml,buildLocationReportHtml:buildLocationReportHtmlV432,exportLocationHtmlReport:exportLocationHtmlReportV432};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();window.addEventListener('load',()=>setTimeout(install,100),{once:true});
})();