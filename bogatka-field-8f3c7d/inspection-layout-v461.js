(function(){
'use strict';
if(window.BogatkaInspectionLayoutV461?.ready)return;

const VERSION='4.6.2';
const SOURCE_LABELS={
  '':'Не выбрано',
  'Собственник':'Напрямую от собственника',
  'Агент / посредник':'Через агента / посредника',
  'Объявление':'По объявлению',
  'Рекомендация':'По рекомендации',
  'Самостоятельный поиск':'Самостоятельный поиск',
  'Другое':'Другое',
};
const LABELS={
  objectSource:'Как нашли объект',
  objectSourceOther:'Уточните, как нашли объект',
  listingUrl:'Ссылка на объявление / карточку',
  inspectionPurpose:'Цель осмотра',
  inspectionParticipants:'Участники осмотра',
  inspectionResult:'Итог осмотра',
};
const LEFT=['inspectionPurpose','inspectionResult'];
const RIGHT=['objectSource','listingUrl','objectSourceOther','inspectionParticipants'];
const WIDE=new Set(['inspectionPurpose','inspectionResult','objectSourceOther','inspectionParticipants']);
let timer=null;
let timerDue=Infinity;
let observer=null;
let observerRoot=null;
let enhancing=false;

const fieldSelector=field=>`[data-field="${CSS.escape(field)}"]`;
const visibleControl=(card,field)=>card.querySelector(fieldSelector(field));
const fieldWrapper=control=>control?.closest('label.field')||null;
const isEditing=card=>{const active=document.activeElement;return Boolean(active&&card.contains(active)&&/^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName));};
const premiumTrigger=select=>select?.nextElementSibling?.classList?.contains('premium-select-trigger')?select.nextElementSibling:null;

function observe(){
  if(observer&&observerRoot)observer.observe(observerRoot,{childList:true,subtree:true});
}

function syncPremium(select){
  if(!select||select.tagName!=='SELECT')return true;
  let trigger=premiumTrigger(select);
  const expectsPremium=select.dataset.premiumSelect==='1'||select.classList.contains('premium-native-select');
  if(!trigger&&expectsPremium&&typeof bogatkaEnhanceSelect==='function'){
    // Preserve the native premium marker while asking the canonical enhancer to
    // restore its visible trigger. Removing the marker here caused the premium
    // observer and V461 to repeatedly undo each other during startup.
    delete select.dataset.premiumSelect;
    bogatkaEnhanceSelect(select);
    trigger=premiumTrigger(select);
  }
  if(trigger){
    if(window.BogatkaSelectSync?.syncVisibleSelect)window.BogatkaSelectSync.syncVisibleSelect(select);
    else if(typeof bogatkaSyncPremiumSelect==='function')bogatkaSyncPremiumSelect(select,trigger);
    return true;
  }
  // A select already claimed by the premium enhancer is not layout-ready until
  // its visible trigger exists. Leave its classes intact and let the existing
  // observer schedule one later V461 pass.
  return !expectsPremium;
}

function clearResponsiveGridOverrides(...grids){
  // Responsive column ownership belongs exclusively to inspection-layout-v461.css.
  // Remove the former inline !important value so media queries remain authoritative
  // through initial load, resize and every late compatibility enhancement pass.
  for(const grid of grids){
    if(!grid)continue;
    if(grid.style.getPropertyValue('grid-template-columns')||grid.style.getPropertyPriority('grid-template-columns')){
      grid.style.removeProperty('grid-template-columns');
    }
  }
}

function setCaption(wrapper,text){
  const caption=wrapper?.querySelector(':scope > .profile-caption-v416');
  if(caption&&caption.textContent!==text)caption.textContent=text;
}

function patchExtraLookup(extra,card){
  if(extra.dataset.lookupV461==='1')return;
  const localQuery=extra.querySelector.bind(extra);
  extra.querySelector=function(selector){
    const local=localQuery(selector);
    if(local)return local;
    if(typeof selector==='string'&&selector.indexOf('[data-field=')===0)return card.querySelector(selector);
    return null;
  };
  extra.dataset.lookupV461='1';
}

function insertSequence(container,nodes,before){
  let cursor=before||null;
  for(let index=nodes.length-1;index>=0;index--){
    const node=nodes[index];
    if(!node)continue;
    if(node.parentElement!==container||node.nextElementSibling!==cursor)container.insertBefore(node,cursor);
    cursor=node;
  }
}

function rewriteSource(select){
  if(!select)return false;
  const current=select.value;
  for(const option of select.options){
    const next=SOURCE_LABELS[option.value];
    if(next&&option.textContent!==next)option.textContent=next;
  }
  if(select.value!==current)select.value=current;
  return syncPremium(select);
}

function normalizeUrl(value){
  const raw=String(value||'').trim();
  if(!raw)return null;
  try{
    const parsed=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);
    return ['http:','https:'].includes(parsed.protocol)?parsed.href:null;
  }catch(_){return null}
}

function syncSource(card){
  const source=visibleControl(card,'objectSource');
  const other=visibleControl(card,'objectSourceOther');
  const listing=visibleControl(card,'listingUrl');
  if(!source||!other||!listing)return false;
  const otherWrapper=fieldWrapper(other);
  const listingWrapper=fieldWrapper(listing);
  const showOther=source.value==='Другое';
  if(otherWrapper){otherWrapper.hidden=!showOther;otherWrapper.setAttribute('aria-hidden',String(!showOther));}
  other.required=showOther;
  other.setAttribute('aria-required',String(showOther));
  const listingRequired=source.value==='Объявление';
  listing.required=listingRequired;
  listing.setAttribute('aria-required',String(listingRequired));
  if(listingWrapper)listingWrapper.dataset.requiredMissing=String(listingRequired&&!String(listing.value||'').trim());
  const link=listingWrapper?.querySelector('.listing-link-v452');
  if(link){
    const href=normalizeUrl(listing.value);
    link.hidden=!String(listing.value||'').trim();
    link.classList.toggle('invalid',Boolean(String(listing.value||'').trim()&&!href));
    if(href){link.href=href;link.textContent='Открыть объявление';}
    else{link.removeAttribute('href');link.textContent='Проверьте ссылку';}
  }
  return rewriteSource(source);
}

function bindSource(card){
  for(const field of ['objectSource','objectSourceOther','listingUrl']){
    const control=visibleControl(card,field);
    if(!control||control.dataset.inspectionLayoutBoundV461==='1')continue;
    control.dataset.inspectionLayoutBoundV461='1';
    control.addEventListener(control.tagName==='SELECT'?'change':'input',()=>syncSource(card));
    control.addEventListener('change',()=>syncSource(card));
  }
}

function tuneField(card,field){
  const control=visibleControl(card,field);
  const wrapper=fieldWrapper(control);
  if(!control||!wrapper)return null;
  wrapper.classList.add('stage6-field-v452','overview-field-v417');
  wrapper.classList.toggle('profile-wide-v416',WIDE.has(field));
  wrapper.classList.toggle('stage6-wide-v452',WIDE.has(field));
  setCaption(wrapper,LABELS[field]||field);
  if(field==='listingUrl')control.placeholder='Ссылка на объявление или карточку объекта';
  if(field==='inspectionPurpose')control.placeholder='Первичный осмотр, повторная проверка или замеры';
  if(field==='inspectionParticipants')control.placeholder='ФИО или роли участников осмотра';
  if(field==='inspectionResult')control.placeholder='Что подтвердили, что изменилось и что проверить повторно';
  return wrapper;
}

function patchLabels(){
  const labels=window.BogatkaWorkflowV414?.FIELD_LABELS;
  if(labels)Object.assign(labels,LABELS);
  const api=window.BogatkaLocationDataV452;
  if(api?.FIELD_LABELS)Object.assign(api.FIELD_LABELS,LABELS);
  if(Array.isArray(api?.SOURCE_OPTIONS))for(const option of api.SOURCE_OPTIONS)if(SOURCE_LABELS[option[0]])option[1]=SOURCE_LABELS[option[0]];
}

function placeCard(card){
  if(!card?.dataset?.locationCard||isEditing(card))return false;
  delete card.dataset.inspectionLayoutV461;
  delete card.dataset.inspectionLayoutV462;
  const inspection=card.querySelector('.inspection-card-v416');
  const landlord=card.querySelector('.landlord-card-v416');
  const inspectionGrid=inspection?.querySelector('.inspection-grid-v416');
  const landlordGrid=landlord?.querySelector('.landlord-grid-v416');
  const extra=inspection?.querySelector('.inspection-extra-v452');
  if(!inspectionGrid||!landlordGrid||!extra)return false;
  patchExtraLookup(extra,card);
  clearResponsiveGridOverrides(inspectionGrid,landlordGrid);

  const controls={};
  for(const field of [...LEFT,...RIGHT]){
    controls[field]=visibleControl(card,field);
    if(!controls[field])return false;
  }

  const leftNodes=LEFT.map(field=>tuneField(card,field));
  const rightNodes=RIGHT.map(field=>tuneField(card,field));
  const nextTask=inspectionGrid.querySelector('.next-task-v447');
  const undo=inspectionGrid.querySelector('.inspection-note-v416');
  insertSequence(inspectionGrid,[nextTask,...leftNodes],undo||null);
  insertSequence(landlordGrid,rightNodes,null);

  landlord.querySelector(':scope > .landlord-inspection-v461')?.remove();
  extra.hidden=true;
  extra.setAttribute('aria-hidden','true');
  const inspectionCopy=inspection.querySelector('.profile-section-head-v416 span');
  const landlordCopy=landlord.querySelector('.profile-section-head-v416 span');
  if(inspectionCopy)inspectionCopy.textContent='Статус, параметры осмотра, следующий шаг и итог.';
  if(landlordCopy)landlordCopy.textContent='Контакты, источник объекта и предварительные договорённости.';

  const sourceReady=rewriteSource(controls.objectSource);
  bindSource(card);
  const sourceStateReady=syncSource(card);
  if(!sourceReady||!sourceStateReady)return false;
  card.dataset.inspectionLayoutV461='1';
  card.dataset.inspectionLayoutV462='1';
  return true;
}

function enhanceAll(){
  if(enhancing)return 0;
  enhancing=true;
  observer?.disconnect();
  try{
    patchLabels();
    let ready=0;
    for(const card of document.querySelectorAll('[data-location-card]'))if(placeCard(card))ready++;
    return ready;
  }finally{
    enhancing=false;
    observe();
  }
}

function schedule(delay=70){
  const due=performance.now()+Math.max(0,delay);
  if(timer!==null&&timerDue<=due)return;
  if(timer!==null)clearTimeout(timer);
  timerDue=due;
  timer=setTimeout(()=>{
    timer=null;
    timerDue=Infinity;
    try{enhanceAll();}catch(error){console.error(error)}
  },Math.max(0,delay));
}

function install(){
  observerRoot=document.getElementById('locations')||document.body;
  observer=new MutationObserver(records=>{
    if(enhancing)return;
    if(records.some(record=>record.addedNodes.length||record.removedNodes.length))schedule(0);
  });
  observe();
  schedule(20);
  [250,700,1500,3000,6000].forEach(delay=>setTimeout(()=>schedule(0),delay));
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.addEventListener('load',()=>schedule(30),{once:true});
window.addEventListener('resize',()=>schedule(0));
window.BogatkaInspectionLayoutV461={version:VERSION,ready:true,LABELS,SOURCE_LABELS,responsiveOwner:'inspection-layout-v461.css',enhanceAll,placeCard};
})();
