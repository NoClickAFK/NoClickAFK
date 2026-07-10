(function(){
'use strict';
if(window.BogatkaReportFinalizeV433?.ready)return;
const VERSION='4.3.3';
let attempts=0;
function loadScript(src){
  return new Promise((resolve,reject)=>{
    const existing=document.querySelector(`script[src="${src}"]`);
    if(existing){if(existing.dataset.loadedV433==='true')return resolve();existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return}
    const script=document.createElement('script');script.src=src;script.async=false;
    script.addEventListener('load',()=>{script.dataset.loadedV433='true';resolve()},{once:true});script.addEventListener('error',reject,{once:true});document.head.appendChild(script);
  });
}
async function ensureDependencies(){
  if(!window.BogatkaReportCoreV433?.ready)await loadScript('./report-editorial-core-v433.js');
  if(!window.BogatkaReportStyleV433?.ready)await loadScript('./report-editorial-style-v433.js');
  return Boolean(window.BogatkaReportCoreV433?.ready&&window.BogatkaReportStyleV433?.ready);
}
function clean(...args){return window.BogatkaReportCoreV433.clean(...args)}
function wait(...args){return window.BogatkaReportCoreV433.wait(...args)}
function safeName(...args){return window.BogatkaReportCoreV433.safeName(...args)}
function isSingle(...args){return window.BogatkaReportCoreV433.isSingle(...args)}
function removeNoise(...args){return window.BogatkaReportCoreV433.removeNoise(...args)}
function buildSingleHero(...args){return window.BogatkaReportCoreV433.buildSingleHero(...args)}
function buildExecutiveDecision(...args){return window.BogatkaReportCoreV433.buildExecutiveDecision(...args)}
function transformEconomySection(...args){return window.BogatkaReportCoreV433.transformEconomySection(...args)}
function findSection(...args){return window.BogatkaReportCoreV433.findSection(...args)}
function wrapSingleSections(...args){return window.BogatkaReportCoreV433.wrapSingleSections(...args)}
function buildFullHero(...args){return window.BogatkaReportCoreV433.buildFullHero(...args)}
function buildPortfolioSummary(...args){return window.BogatkaReportCoreV433.buildPortfolioSummary(...args)}
function buildShortlist(...args){return window.BogatkaReportCoreV433.buildShortlist(...args)}
function buildRiskOverview(...args){return window.BogatkaReportCoreV433.buildRiskOverview(...args)}
function makeComparisonAccordion(...args){return window.BogatkaReportCoreV433.makeComparisonAccordion(...args)}
function wrapFullLocations(...args){return window.BogatkaReportCoreV433.wrapFullLocations(...args)}
function addReportClasses(...args){return window.BogatkaReportCoreV433.addReportClasses(...args)}
function updateGeneratorMetadata(...args){return window.BogatkaReportCoreV433.updateGeneratorMetadata(...args)}
function styles(){return window.BogatkaReportStyleV433.styles()}
function reportScript(){return `<script>(function(){
let states=[];
function hydrate(root){(root||document).querySelectorAll('img[data-report-src]').forEach(img=>{img.src=img.dataset.reportSrc;delete img.dataset.reportSrc})}
function set(button,open){
  const accordion=button.closest('.report-accordion-v432');
  const body=accordion&&accordion.querySelector(':scope>.report-accordion-body-v432');
  if(!body)return;
  button.setAttribute('aria-expanded',String(open));
  body.hidden=!open;
  accordion.dataset.open=String(open);
  if(open)hydrate(body);
}
document.addEventListener('click',event=>{
  const button=event.target.closest('.report-accordion-summary-v432');
  if(button){set(button,button.getAttribute('aria-expanded')!=='true');return}
  const image=event.target.closest('.report-photo img,.report-hero-photo-v433 img');
  if(image&&image.src)window.open(image.src,'_blank','noopener');
});
addEventListener('beforeprint',()=>{
  states=[...document.querySelectorAll('.report-accordion-summary-v432')].map(button=>[button,button.getAttribute('aria-expanded')==='true']);
  hydrate(document);
  states.forEach(state=>set(state[0],true));
});
addEventListener('afterprint',()=>{states.forEach(state=>set(state[0],state[1]));states=[]});
})();<\/script>`}
function finalizeHtml(html){
  const doc=new DOMParser().parseFromString(String(html||''),'text/html');
  doc.querySelectorAll('style,script').forEach(node=>node.remove());
  removeNoise(doc);
  const single=isSingle(doc);
  const locations=[...doc.querySelectorAll('.report-location')];
  const cover=doc.querySelector('.report-cover');
  let singleData=null;
  if(single&&locations[0]&&cover){
    locations[0].classList.add('report-single-location-v432','report-single-location-v433');
    singleData=buildSingleHero(doc,locations[0],cover);
    buildExecutiveDecision(doc,locations[0],singleData);
    transformEconomySection(doc,findSection(locations[0],'Экономическая модель'));
    wrapSingleSections(doc,locations[0]);
  }else if(!single&&cover){
    const hero=buildFullHero(doc,cover,locations);
    const summary=buildPortfolioSummary(doc,doc.querySelector('.report-summary'),locations);
    const shortlist=buildShortlist(doc,locations);
    const risks=buildRiskOverview(doc,locations);
    const comparison=doc.querySelector('.report-comparison');
    if(summary){if(shortlist)summary.after(shortlist);if(risks)(shortlist||summary).after(risks)}
    makeComparisonAccordion(doc,comparison);
    wrapFullLocations(doc,locations);
    hero.classList.add('report-portfolio-front-v433');
  }
  addReportClasses(doc);
  updateGeneratorMetadata(doc);
  doc.querySelectorAll('style#reportFinalV432').forEach(style=>style.remove());
  doc.head.insertAdjacentHTML('beforeend',styles());
  doc.body.insertAdjacentHTML('beforeend',reportScript());
  doc.title=single?`Управленческий отчёт по локации — ${singleData?.title||'Богатка'}`:'Управленческий портфель локаций — Богатка';
  return`<!doctype html>\n${doc.documentElement.outerHTML}`;
}
function claim(builder){
  const api=window.BogatkaLiveReport;
  if(api){
    api.version=VERSION;
    api.build=builder;
    api.finalizeReportHtmlV432=finalizeHtml;
    api.finalizeReportHtmlV433=finalizeHtml;
    api.buildLocationReportHtml=buildLocationReportHtmlV433;
    api.exportLocationHtmlReport=exportLocationHtmlReportV433;
  }
  window.buildReportHtml=builder;
  window.exportHtmlReport=builder.__htmlAction;
  window.openPdfReport=builder.__pdfAction;
  window.buildLocationReportHtml=buildLocationReportHtmlV433;
  window.exportLocationHtmlReport=exportLocationHtmlReportV433;
  try{buildReportHtml=window.buildReportHtml;exportHtmlReport=window.exportHtmlReport;openPdfReport=window.openPdfReport}catch(_){}
}
async function buildLocationReportHtmlV433(locationId){
  await ensureDependencies();
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
async function install(){
  attempts+=1;
  try{if(!await ensureDependencies()){if(attempts<160)setTimeout(install,250);return}}catch(error){console.error('Report v4.3.3 dependencies failed to load.',error);if(attempts<160)setTimeout(install,500);return}
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
  const wrapped=async function(){const html=await base.renderReport();claim(wrapped);return finalizeHtml(html)};
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
