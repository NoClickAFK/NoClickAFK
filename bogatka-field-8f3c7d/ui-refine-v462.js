(function(){
'use strict';
if(window.BogatkaUIRefineV462?.ready)return;

const VERSION='4.6.2';
let timer=null;

function storageGet(key){try{return localStorage.getItem(key)}catch(_){return null}}
function storageSet(key,value){try{localStorage.setItem(key,value)}catch(_){}}

function ensureCanonicalStyleLast(){
  const link=[...document.querySelectorAll('link[rel="stylesheet"]')].find(node=>{
    const href=node.getAttribute('href')||'';
    return href.includes('ui-refine-v462.css');
  });
  if(!link)return null;
  if(link!==document.head.lastElementChild)document.head.append(link);
  return link;
}

function setExpanded(button,content,expanded,key){
  button.setAttribute('aria-expanded',String(expanded));
  content.hidden=!expanded;
  if(key)storageSet(key,expanded?'1':'0');
}

function splitRecommendationReason(node){
  if(!node)return false;
  const plain=String(node.textContent||'').replace(/\s+/g,' ').trim();
  const match=plain.match(/^Оцените минимум 5 критериев\.?\s*Сейчас заполнено\s+(\d+)\s+из\s+(\d+)\.?$/i);
  if(!match)return false;
  const first='Оцените минимум 5 критериев';
  const second=`Сейчас заполнено ${match[1]} из ${match[2]}`;
  if(node.children.length===2&&node.children[0].textContent===first&&node.children[1].textContent===second)return true;
  const line1=document.createElement('span');
  line1.className='recommendation-line-v462';
  line1.textContent=first;
  const line2=document.createElement('span');
  line2.className='recommendation-line-v462';
  line2.textContent=second;
  node.replaceChildren(line1,line2);
  return true;
}

function syncProgressSummary(overview){
  const output=overview.querySelector('[data-progress-card-summary-v462]');
  const source=overview.querySelector('[data-progress-recommendation-label-v448]');
  if(output&&source&&output.textContent!==source.textContent)output.textContent=source.textContent;
  splitRecommendationReason(overview.querySelector('[data-progress-recommendation-reason-v448]'));
}

function applyLayoutGuards(card){
  for(const grid of card.querySelectorAll('.inspection-grid-v416,.landlord-grid-v416')){
    grid.style.setProperty('row-gap','12px','important');
    grid.style.setProperty('column-gap','14px','important');
  }
  const metrics=card.querySelector('.decision-progress-v448.progress-card-v462 .progress-metrics-v448');
  if(metrics){
    if(matchMedia('(max-width:700px)').matches)metrics.style.setProperty('grid-template-columns','minmax(0,1fr)','important');
    else metrics.style.removeProperty('grid-template-columns');
  }
}

async function syncLegacyStatus(card){
  const select=card.querySelector('select[data-field="status"]');
  const id=card.dataset.locationCard;
  if(!select||!id||select===document.activeElement||select.value)return false;
  const data=await getLocationData(id);
  const normalized=window.BogatkaStatusNextTaskV447?.normalizeStatus?.(data?.status)||String(data?.status||'');
  if(!normalized||select.value===normalized)return false;
  if(![...select.options].some(option=>option.value===normalized))return false;
  select.value=normalized;
  const trigger=select.nextElementSibling;
  if(trigger?.classList?.contains('premium-select-trigger')){
    const valueNode=trigger.querySelector('.premium-select-value');
    if(valueNode)valueNode.textContent=select.selectedOptions?.[0]?.textContent||normalized;
    trigger.dataset.syncedValue=select.value;
    trigger.disabled=select.disabled;
  }
  return true;
}

function installStatusEnhanceWrapper(){
  const api=window.BogatkaStatusNextTaskV447;
  const original=api?.enhanceAll;
  if(!api||typeof original!=='function')return false;
  if(original.__uiRefineV462)return true;
  const wrapped=async function(...args){
    const focused=document.activeElement;
    const restoreFocus=focused instanceof HTMLInputElement||focused instanceof HTMLTextAreaElement||focused instanceof HTMLSelectElement;
    const start=restoreFocus&&typeof focused.selectionStart==='number'?focused.selectionStart:null;
    const end=restoreFocus&&typeof focused.selectionEnd==='number'?focused.selectionEnd:null;
    const result=await original.apply(api,args);
    for(const card of document.querySelectorAll('[data-location-card]'))await syncLegacyStatus(card);
    if(restoreFocus&&focused.isConnected&&(document.activeElement===document.body||document.activeElement===null)){
      focused.focus({preventScroll:true});
      if(start!==null&&typeof focused.setSelectionRange==='function')focused.setSelectionRange(start,end??start);
    }
    return result;
  };
  wrapped.__uiRefineV462=true;
  wrapped.__base=original;
  api.enhanceAll=wrapped;
  return true;
}

function ensureFillPlan(overview,card){
  const plan=overview.querySelector('.fill-plan-v448');
  const list=plan?.querySelector('[data-fill-plan-list-v448]');
  if(!plan||!list)return false;
  if(plan.dataset.uiRefineV462==='1')return true;
  const oldHeading=plan.querySelector(':scope > .fill-plan-heading-v448');
  const title=oldHeading?.querySelector('strong')?.textContent||'Что заполнить дальше';
  const summary=oldHeading?.querySelector('[data-fill-plan-summary-v448]')||document.createElement('span');
  summary.dataset.fillPlanSummaryV448='';

  const button=document.createElement('button');
  button.type='button';
  button.className='fill-plan-toggle-v462';
  const copy=document.createElement('span');
  copy.className='fill-plan-toggle-copy-v462';
  const strong=document.createElement('strong');
  strong.textContent=title;
  copy.append(strong,summary);
  const chevron=document.createElement('i');
  chevron.className='fill-plan-chevron-v462';
  chevron.setAttribute('aria-hidden','true');
  button.append(copy,chevron);
  oldHeading?.replaceWith(button);

  const id=card.dataset.locationCard||'location';
  const key=`bogatka_fill_plan_open_v462:${id}`;
  const expanded=storageGet(key)==='1';
  setExpanded(button,list,expanded,null);
  button.addEventListener('click',()=>setExpanded(button,list,button.getAttribute('aria-expanded')!=='true',key));
  plan.dataset.uiRefineV462='1';
  return true;
}

function ensureProgressAccordion(card){
  const overview=card.querySelector('.decision-overview-v340.decision-progress-v448');
  if(!overview)return false;
  if(overview.dataset.uiRefineV462==='1'){
    ensureFillPlan(overview,card);
    syncProgressSummary(overview);
    return true;
  }

  const heading=overview.querySelector(':scope > .progress-heading-v448');
  if(!heading)return false;
  const titleBlock=heading.querySelector(':scope > div:first-child');
  const title=titleBlock?.querySelector('strong')?.textContent||'Оценка и готовность данных';
  const subtitle=titleBlock?.querySelector('span')?.textContent||'Качество локации отдельно от полноты заполнения.';

  const content=document.createElement('div');
  content.className='progress-card-content-v462';
  while(overview.firstChild)content.append(overview.firstChild);
  heading.classList.add('progress-heading-compact-v462');

  const toggle=document.createElement('button');
  toggle.type='button';
  toggle.className='progress-card-toggle-v462';
  const copy=document.createElement('span');
  copy.className='progress-card-toggle-copy-v462';
  const strong=document.createElement('strong');
  strong.textContent=title;
  const note=document.createElement('span');
  note.textContent=subtitle;
  copy.append(strong,note);
  const summary=document.createElement('span');
  summary.className='progress-card-summary-v462';
  summary.dataset.progressCardSummaryV462='';
  summary.textContent=overview.querySelector('[data-progress-recommendation-label-v448]')?.textContent||'Недостаточно данных';
  const chevron=document.createElement('i');
  chevron.className='progress-card-chevron-v462';
  chevron.setAttribute('aria-hidden','true');
  toggle.append(copy,summary,chevron);
  overview.append(toggle,content);

  const id=card.dataset.locationCard||'location';
  const key=`bogatka_progress_open_v462:${id}`;
  const expanded=storageGet(key)==='1';
  setExpanded(toggle,content,expanded,null);
  toggle.addEventListener('click',()=>setExpanded(toggle,content,toggle.getAttribute('aria-expanded')!=='true',key));

  overview.classList.add('progress-card-v462');
  overview.dataset.uiRefineV462='1';
  ensureFillPlan(overview,card);
  syncProgressSummary(overview);
  return true;
}

function enhanceCard(card){
  if(!card?.dataset?.locationCard)return false;
  splitRecommendationReason(card.querySelector('[data-card-recommendation-reason-v448]'));
  ensureProgressAccordion(card);
  applyLayoutGuards(card);
  return true;
}

function enhanceAll(){
  let count=0;
  for(const card of document.querySelectorAll('[data-location-card]'))if(enhanceCard(card))count++;
  return count;
}

function schedule(delay=70){
  clearTimeout(timer);
  timer=setTimeout(()=>{try{enhanceAll()}catch(error){console.error(error)}},delay);
}

function install(){
  ensureCanonicalStyleLast();
  installStatusEnhanceWrapper();
  const root=document.getElementById('locations')||document.body;
  new MutationObserver(()=>schedule(90)).observe(root,{childList:true,subtree:true,characterData:true});
  schedule(20);
  [250,700,1500,3000,6000].forEach(delay=>setTimeout(()=>{
    ensureCanonicalStyleLast();
    installStatusEnhanceWrapper();
    schedule(0);
  },delay));
  addEventListener('resize',()=>schedule(40),{passive:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.addEventListener('load',()=>{ensureCanonicalStyleLast();installStatusEnhanceWrapper();schedule(30)},{once:true});
window.BogatkaUIRefineV462={version:VERSION,ready:true,enhanceAll,ensureProgressAccordion,splitRecommendationReason,ensureCanonicalStyleLast,installStatusEnhanceWrapper,applyLayoutGuards};
})();
