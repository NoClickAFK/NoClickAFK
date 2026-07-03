(function(){
'use strict';
if(window.BogatkaUIRefineV462?.ready)return;
const VERSION='4.6.2';
let timer=null;
const read=key=>{try{return localStorage.getItem(key)}catch(_){return null}};
const write=(key,value)=>{try{localStorage.setItem(key,value)}catch(_){}};

function setOpen(button,content,open,key){
  button.setAttribute('aria-expanded',String(open));
  content.hidden=!open;
  if(key)write(key,open?'1':'0');
}

function splitReason(node){
  if(!node)return false;
  const value=String(node.textContent||'').replace(/\s+/g,' ').trim();
  const match=value.match(/^Оцените минимум 5 критериев\.?\s*Сейчас заполнено\s+(\d+)\s+из\s+(\d+)\.?$/i);
  if(!match)return false;
  const first='Оцените минимум 5 критериев';
  const second=`Сейчас заполнено ${match[1]} из ${match[2]}`;
  if(node.children.length===2&&node.children[0].textContent===first&&node.children[1].textContent===second)return true;
  const one=document.createElement('span');
  const two=document.createElement('span');
  one.className=two.className='recommendation-line-v462';
  one.textContent=first;
  two.textContent=second;
  node.replaceChildren(one,two);
  return true;
}

function ensureFillPlan(overview,card){
  const plan=overview.querySelector('.fill-plan-v448');
  const list=plan?.querySelector('[data-fill-plan-list-v448]');
  if(!plan||!list)return false;
  if(plan.dataset.uiRefineV462==='1')return true;
  const old=plan.querySelector(':scope > .fill-plan-heading-v448');
  const summary=old?.querySelector('[data-fill-plan-summary-v448]')||document.createElement('span');
  summary.dataset.fillPlanSummaryV448='';
  const button=document.createElement('button');
  const copy=document.createElement('span');
  const title=document.createElement('strong');
  const arrow=document.createElement('i');
  button.type='button';
  button.className='fill-plan-toggle-v462';
  copy.className='fill-plan-toggle-copy-v462';
  title.textContent=old?.querySelector('strong')?.textContent||'Что заполнить дальше';
  arrow.className='fill-plan-chevron-v462';
  arrow.setAttribute('aria-hidden','true');
  copy.append(title,summary);
  button.append(copy,arrow);
  old?.replaceWith(button);
  const key=`bogatka_fill_plan_open_v462:${card.dataset.locationCard||'location'}`;
  setOpen(button,list,read(key)==='1',null);
  button.addEventListener('click',()=>setOpen(button,list,button.getAttribute('aria-expanded')!=='true',key));
  plan.dataset.uiRefineV462='1';
  return true;
}

function syncSummary(overview){
  const target=overview.querySelector('[data-progress-card-summary-v462]');
  const source=overview.querySelector('[data-progress-recommendation-label-v448]');
  if(target&&source&&target.textContent!==source.textContent)target.textContent=source.textContent;
  splitReason(overview.querySelector('[data-progress-recommendation-reason-v448]'));
}

function ensureProgress(card){
  const overview=card.querySelector('.decision-overview-v340.decision-progress-v448');
  if(!overview)return false;
  if(overview.dataset.uiRefineV462==='1'){
    ensureFillPlan(overview,card);
    syncSummary(overview);
    return true;
  }
  const heading=overview.querySelector(':scope > .progress-heading-v448');
  if(!heading)return false;
  const titleBlock=heading.querySelector(':scope > div:first-child');
  const content=document.createElement('div');
  content.className='progress-card-content-v462';
  while(overview.firstChild)content.append(overview.firstChild);
  heading.classList.add('progress-heading-compact-v462');
  const button=document.createElement('button');
  const copy=document.createElement('span');
  const title=document.createElement('strong');
  const note=document.createElement('span');
  const summary=document.createElement('span');
  const arrow=document.createElement('i');
  button.type='button';
  button.className='progress-card-toggle-v462';
  copy.className='progress-card-toggle-copy-v462';
  title.textContent=titleBlock?.querySelector('strong')?.textContent||'Оценка и готовность данных';
  note.textContent=titleBlock?.querySelector('span')?.textContent||'Качество локации отдельно от полноты заполнения.';
  summary.className='progress-card-summary-v462';
  summary.dataset.progressCardSummaryV462='';
  summary.textContent=overview.querySelector('[data-progress-recommendation-label-v448]')?.textContent||'Недостаточно данных';
  arrow.className='progress-card-chevron-v462';
  arrow.setAttribute('aria-hidden','true');
  copy.append(title,note);
  button.append(copy,summary,arrow);
  overview.append(button,content);
  const key=`bogatka_progress_open_v462:${card.dataset.locationCard||'location'}`;
  setOpen(button,content,read(key)==='1',null);
  button.addEventListener('click',()=>setOpen(button,content,button.getAttribute('aria-expanded')!=='true',key));
  overview.classList.add('progress-card-v462');
  overview.dataset.uiRefineV462='1';
  ensureFillPlan(overview,card);
  syncSummary(overview);
  return true;
}

function applyLayoutGuards(card){
  for(const grid of card.querySelectorAll('.inspection-grid-v416,.landlord-grid-v416')){
    grid.style.setProperty('row-gap','12px','important');
    grid.style.setProperty('column-gap','14px','important');
  }
  const selector='.inspection-grid-v416>label.field:not([hidden]):not(.hidden):not(.panel-hidden-v419),.landlord-grid-v416>label.field:not([hidden]):not(.hidden):not(.panel-hidden-v419),.inspection-grid-v416>.next-task-v447';
  for(const field of card.querySelectorAll(selector))field.style.setProperty('gap','5px','important');
  const metrics=card.querySelector('.progress-metrics-v448');
  if(metrics){
    if(matchMedia('(max-width:700px)').matches)metrics.style.setProperty('grid-template-columns','minmax(0,1fr)','important');
    else metrics.style.removeProperty('grid-template-columns');
  }
}

async function syncLegacyStatus(card){
  const select=card.querySelector('select[data-field="status"]');
  const id=card.dataset.locationCard;
  if(!select||!id||select===document.activeElement||select.value)return;
  const data=await getLocationData(id);
  const value=window.BogatkaStatusNextTaskV447?.normalizeStatus?.(data?.status)||String(data?.status||'');
  if(!value||![...select.options].some(option=>option.value===value))return;
  select.value=value;
  const trigger=select.nextElementSibling;
  if(trigger?.classList?.contains('premium-select-trigger')){
    const label=trigger.querySelector('.premium-select-value');
    if(label)label.textContent=select.selectedOptions?.[0]?.textContent||value;
    trigger.dataset.syncedValue=value;
    trigger.disabled=select.disabled;
  }
}

function wrapStatusEnhancer(){
  const api=window.BogatkaStatusNextTaskV447;
  const base=api?.enhanceAll;
  if(!api||typeof base!=='function')return false;
  if(base.__uiRefineV462)return true;
  const wrapped=async function(...args){
    const focused=document.activeElement;
    const restore=focused instanceof HTMLInputElement||focused instanceof HTMLTextAreaElement||focused instanceof HTMLSelectElement;
    const start=restore&&typeof focused.selectionStart==='number'?focused.selectionStart:null;
    const end=restore&&typeof focused.selectionEnd==='number'?focused.selectionEnd:null;
    const result=await base.apply(api,args);
    for(const card of document.querySelectorAll('[data-location-card]'))await syncLegacyStatus(card);
    if(restore&&focused.isConnected&&(document.activeElement===document.body||document.activeElement===null)){
      focused.focus({preventScroll:true});
      if(start!==null&&typeof focused.setSelectionRange==='function')focused.setSelectionRange(start,end??start);
    }
    return result;
  };
  wrapped.__uiRefineV462=true;
  wrapped.__base=base;
  api.enhanceAll=wrapped;
  return true;
}

function enhanceCard(card){
  if(!card?.dataset?.locationCard)return false;
  splitReason(card.querySelector('[data-card-recommendation-reason-v448]'));
  ensureProgress(card);
  applyLayoutGuards(card);
  return true;
}

function enhanceAll(){
  let count=0;
  for(const card of document.querySelectorAll('[data-location-card]'))if(enhanceCard(card))count+=1;
  return count;
}

function schedule(delay=70){
  clearTimeout(timer);
  timer=setTimeout(()=>{try{enhanceAll()}catch(error){console.error(error)}},delay);
}

function install(){
  wrapStatusEnhancer();
  const root=document.getElementById('locations')||document.body;
  new MutationObserver(()=>schedule(90)).observe(root,{childList:true,subtree:true});
  schedule(20);
  [250,700,1500,3000,6000].forEach(delay=>setTimeout(()=>{wrapStatusEnhancer();schedule(0)},delay));
  addEventListener('resize',()=>schedule(40),{passive:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.addEventListener('load',()=>{wrapStatusEnhancer();schedule(30)},{once:true});
window.BogatkaUIRefineV462={version:VERSION,ready:true,enhanceAll,ensureProgressAccordion:ensureProgress,splitRecommendationReason:splitReason,installStatusEnhanceWrapper:wrapStatusEnhancer,applyLayoutGuards};
})();
