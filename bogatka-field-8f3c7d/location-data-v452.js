(function(){
  'use strict';
  if(window.BogatkaLocationDataV452?.ready)return;

  const VERSION='4.5.2';
  const REMOVED_CHECKLIST_KEYS=['pet_owners','area_ok','layout_ok','power_ok'];
  const SOURCE_OPTIONS=[
    ['','Не выбрано'],
    ['Собственник','Собственник'],
    ['Агент / посредник','Агент / посредник'],
    ['Объявление','Объявление'],
    ['Рекомендация','Рекомендация'],
    ['Самостоятельный поиск','Самостоятельный поиск'],
    ['Другое','Другое'],
  ];
  const FIELD_LABELS={
    objectSource:'Источник объекта',
    objectSourceOther:'Уточните источник объекта',
    listingUrl:'Ссылка на объявление',
    inspectionPurpose:'Цель осмотра',
    inspectionParticipants:'Кто участвовал',
    inspectionResult:'Итог осмотра',
    decisionReason:'Причина решения',
    'tech.requiredPowerKw':'Требуемая мощность для магазина, кВт',
  };
  const INSPECTION_FIELDS=[
    {field:'objectSource',label:FIELD_LABELS.objectSource,kind:'select',options:SOURCE_OPTIONS},
    {field:'listingUrl',label:FIELD_LABELS.listingUrl,kind:'url',placeholder:'Ссылка на объявление или карточку объекта'},
    {field:'objectSourceOther',label:FIELD_LABELS.objectSourceOther,kind:'text',placeholder:'Например: знакомый, поставщик, управляющая компания',wide:true,conditional:true},
    {field:'inspectionPurpose',label:FIELD_LABELS.inspectionPurpose,kind:'text',placeholder:'Например: первичный осмотр, повторная проверка, замеры'},
    {field:'inspectionParticipants',label:FIELD_LABELS.inspectionParticipants,kind:'text',placeholder:'ФИО или роли участников'},
    {field:'inspectionResult',label:FIELD_LABELS.inspectionResult,kind:'textarea',placeholder:'Что подтвердили, что изменилось и что нужно проверить повторно',wide:true},
  ];
  let timer=null;
  let engineAttempts=0;
  let viewerTimer=null;

  const filled=value=>value!==undefined&&value!==null&&String(value).trim()!=='';
  const number=value=>{
    if(typeof value==='number')return Number.isFinite(value)?value:null;
    if(typeof value!=='string')return null;
    const match=value.replace(/\s+/g,'').replace(',','.').match(/-?\d+(?:\.\d+)?/);
    return match&&Number.isFinite(Number(match[0]))?Number(match[0]):null;
  };
  const formatNumber=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Math.abs(Number(value)));

  function isViewer(){
    try{return typeof cloudRole!=='undefined'&&cloudRole==='viewer'}catch(_){return false}
  }

  function inspectionSection(card){
    return card.querySelector('.inspection-card-v416');
  }

  function fieldWrapper(control){
    return control?.closest('label.field')||null;
  }

  function syncPremium(select){
    if(!select||select.tagName!=='SELECT')return;
    const trigger=select.nextElementSibling?.classList.contains('premium-select-trigger')?select.nextElementSibling:null;
    if(window.BogatkaSelectSync?.syncVisibleSelect)window.BogatkaSelectSync.syncVisibleSelect(select);
    else if(trigger&&typeof bogatkaSyncPremiumSelect==='function')bogatkaSyncPremiumSelect(select,trigger);
    const current=select.nextElementSibling?.classList.contains('premium-select-trigger')?select.nextElementSibling:null;
    if(current){
      current.disabled=select.disabled;
      current.setAttribute('aria-disabled',String(select.disabled));
      current.dataset.syncedValue=select.value;
    }
  }

  function bindField(control,onImmediate){
    if(!control||control.dataset.locationDataBoundV452==='1')return;
    control.dataset.locationDataBoundV452='1';
    const eventName=control.tagName==='TEXTAREA'||['text','url','number'].includes(control.type)?'input':'change';
    control.addEventListener(eventName,()=>{
      onImmediate?.(control);
      if(isViewer())return;
      if(typeof showSaving==='function')showSaving();
      clearTimeout(control._locationDataSaveTimerV452);
      const revision=Number(control.dataset.locationDataRevisionV452||0)+1;
      control.dataset.locationDataRevisionV452=String(revision);
      control.dataset.locationDataDirtyV452='1';
      control._locationDataSaveTimerV452=setTimeout(async()=>{
        try{
          if(typeof saveField!=='function')throw new Error('Не найдена функция сохранения поля.');
          await saveField(control);
        }catch(error){
          if(typeof showError==='function')showError(error);else console.error(error);
        }finally{
          if(control.dataset.locationDataRevisionV452===String(revision)){
            delete control.dataset.locationDataDirtyV452;
            control._locationDataSaveTimerV452=null;
          }
        }
      },eventName==='change'?80:250);
    });
  }

  function createField(locationId,definition){
    const wrapper=document.createElement('label');
    wrapper.className=`field stage6-field-v452${definition.wide?' stage6-wide-v452':''}${definition.conditional?' stage6-source-other-v452':''}`;
    wrapper.dataset.stage6Field=definition.field;
    const caption=document.createElement('span');
    caption.className='profile-caption-v416';
    caption.textContent=definition.label;
    let control;
    if(definition.kind==='textarea'){
      control=document.createElement('textarea');
      control.rows=3;
    }else if(definition.kind==='select'){
      control=document.createElement('select');
      for(const [value,label] of definition.options||[]){
        const option=document.createElement('option');
        option.value=value;
        option.textContent=label;
        control.appendChild(option);
      }
    }else{
      control=document.createElement('input');
      control.type=definition.kind||'text';
    }
    control.dataset.location=locationId;
    control.dataset.field=definition.field;
    control.dataset.locationDataV452='1';
    if(definition.placeholder)control.placeholder=definition.placeholder;
    wrapper.append(caption,control);
    if(definition.field==='listingUrl'){
      const link=document.createElement('a');
      link.className='listing-link-v452';
      link.target='_blank';
      link.rel='noopener';
      link.hidden=true;
      wrapper.append(link);
    }
    bindField(control,()=>{
      const card=control.closest('[data-location-card]');
      if(card)syncCardState(card);
    });
    if(control.tagName==='SELECT'&&typeof bogatkaEnhanceSelect==='function'){
      bogatkaEnhanceSelect(control);
      syncPremium(control);
    }
    return wrapper;
  }

  function ensureInspectionFields(card){
    const section=inspectionSection(card);
    const locationId=card.dataset.locationCard;
    if(!section||!locationId)return null;
    let grid=section.querySelector(':scope > .inspection-extra-v452');
    if(!grid){
      grid=document.createElement('div');
      grid.className='inspection-extra-v452';
      grid.dataset.inspectionExtraV452='1';
      section.append(grid);
    }
    for(const definition of INSPECTION_FIELDS){
      let control=grid.querySelector(`[data-field="${definition.field}"]`);
      if(!control){
        const wrapper=createField(locationId,definition);
        grid.append(wrapper);
        control=wrapper.querySelector('[data-field]');
      }else bindField(control,()=>syncCardState(card));
    }
    return grid;
  }

  function normalizedListingUrl(value){
    const raw=String(value||'').trim();
    if(!raw)return null;
    try{
      const candidate=/^https?:\/\//i.test(raw)?raw:`https://${raw}`;
      const parsed=new URL(candidate);
      return ['http:','https:'].includes(parsed.protocol)?parsed.href:null;
    }catch(_){return null}
  }

  function syncSourceState(card){
    const source=card.querySelector('[data-field="objectSource"]');
    const other=card.querySelector('[data-field="objectSourceOther"]');
    const listing=card.querySelector('[data-field="listingUrl"]');
    if(!source||!other||!listing)return;
    const otherWrapper=fieldWrapper(other);
    const showOther=source.value==='Другое';
    if(otherWrapper){
      otherWrapper.hidden=!showOther;
      otherWrapper.setAttribute('aria-hidden',String(!showOther));
    }
    other.required=showOther;
    other.setAttribute('aria-required',String(showOther));
    const listingRequired=source.value==='Объявление';
    listing.required=listingRequired;
    listing.setAttribute('aria-required',String(listingRequired));
    const listingWrapper=fieldWrapper(listing);
    if(listingWrapper)listingWrapper.dataset.requiredMissing=String(listingRequired&&!filled(listing.value));
    const link=listingWrapper?.querySelector('.listing-link-v452');
    if(link){
      const href=normalizedListingUrl(listing.value);
      link.hidden=!filled(listing.value);
      link.classList.toggle('invalid',filled(listing.value)&&!href);
      if(href){
        link.href=href;
        link.textContent='Открыть объявление';
      }else{
        link.removeAttribute('href');
        link.textContent='Проверьте ссылку';
      }
    }
    syncPremium(source);
  }

  function ensureDecisionReason(card){
    const decision=card.querySelector('.decision');
    const locationId=card.dataset.locationCard;
    if(!decision||!locationId)return null;
    let wrapper=card.querySelector('.decision-reason-v452');
    if(!wrapper){
      wrapper=document.createElement('label');
      wrapper.className='decision-reason-v452';
      wrapper.innerHTML='<span class="profile-caption-v416">Причина решения</span><textarea rows="3" placeholder="Коротко укажите, почему локацию оставляем, ставим под вопрос или исключаем"></textarea><small class="decision-reason-warning-v452" hidden>Укажите причину выбранного решения.</small>';
      const control=wrapper.querySelector('textarea');
      control.dataset.location=locationId;
      control.dataset.field='decisionReason';
      control.dataset.locationDataV452='1';
      bindField(control,()=>syncDecisionReason(card));
      decision.insertAdjacentElement('afterend',wrapper);
    }
    card.querySelectorAll('input[type="radio"][data-field="decision"]').forEach(radio=>{
      if(radio.dataset.decisionReasonBoundV452==='1')return;
      radio.dataset.decisionReasonBoundV452='1';
      radio.addEventListener('change',()=>syncDecisionReason(card));
    });
    return wrapper;
  }

  function syncDecisionReason(card){
    const wrapper=card.querySelector('.decision-reason-v452');
    const control=wrapper?.querySelector('[data-field="decisionReason"]');
    if(!wrapper||!control)return;
    const selected=card.querySelector('input[type="radio"][data-field="decision"]:checked')?.value||'';
    const missing=filled(selected)&&!filled(control.value);
    wrapper.dataset.requiredMissing=String(missing);
    control.required=filled(selected);
    control.setAttribute('aria-required',String(filled(selected)));
    const warning=wrapper.querySelector('.decision-reason-warning-v452');
    if(warning)warning.hidden=!missing;
  }

  function ensurePowerBalance(card){
    const available=card.querySelector('[data-field="tech.powerKw"]');
    const required=card.querySelector('[data-field="tech.requiredPowerKw"]');
    if(!available||!required)return null;
    available.min='0';
    required.min='0';
    required.dataset.locationDataV452='1';
    const grid=required.closest('.grid-3')||required.parentElement?.parentElement;
    if(!grid)return null;
    let box=grid.querySelector(':scope > .power-balance-v452');
    if(!box){
      box=document.createElement('div');
      box.className='power-balance-v452';
      box.innerHTML='<span>Запас / дефицит мощности</span><strong data-power-balance-v452>Укажите доступную и требуемую мощность</strong>';
      fieldWrapper(required)?.insertAdjacentElement('afterend',box);
    }
    const update=()=>updatePowerBalance(card);
    for(const control of [available,required]){
      if(control.dataset.powerBalanceBoundV452==='1')continue;
      control.dataset.powerBalanceBoundV452='1';
      control.addEventListener('input',update);
      control.addEventListener('change',update);
    }
    return box;
  }

  function updatePowerBalance(card){
    const available=number(card.querySelector('[data-field="tech.powerKw"]')?.value);
    const required=number(card.querySelector('[data-field="tech.requiredPowerKw"]')?.value);
    const box=card.querySelector('.power-balance-v452');
    const output=box?.querySelector('[data-power-balance-v452]');
    if(!box||!output)return null;
    let text='Укажите доступную и требуемую мощность';
    let state='unknown';
    let balance=null;
    if(available!==null&&required!==null){
      balance=available-required;
      if(balance>0){text=`Запас ${formatNumber(balance)} кВт`;state='reserve'}
      else if(balance<0){text=`Дефицит ${formatNumber(balance)} кВт`;state='deficit'}
      else{text='Мощность без запаса';state='zero'}
    }
    if(output.textContent!==text)output.textContent=text;
    box.dataset.balanceState=state;
    return{available,required,balance,state,text};
  }

  async function restoreCard(card){
    const locationId=card.dataset.locationCard;
    if(!locationId||typeof getLocationData!=='function')return{};
    const data=await getLocationData(locationId);
    card.querySelectorAll('[data-location-data-v452][data-field]').forEach(control=>{
      if(control===document.activeElement||control.dataset.locationDataDirtyV452==='1')return;
      const value=typeof getNested==='function'?getNested(data,control.dataset.field):undefined;
      const next=value===undefined||value===null?'':String(value);
      if(control.value!==next){
        control.value=next;
        if(control.tagName==='SELECT')syncPremium(control);
      }
    });
    return data;
  }

  function syncCardState(card){
    syncSourceState(card);
    syncDecisionReason(card);
    updatePowerBalance(card);
  }

  function patchHistoryLabels(){
    const labels=window.BogatkaWorkflowV414?.FIELD_LABELS;
    if(labels)Object.assign(labels,FIELD_LABELS);
  }

  function extendGroup(group,requirements){
    if(!group||!requirements.length)return;
    const existing=new Set([...(group.missingLabels||[]),...(group._locationDataRequirementsV452||[])]);
    const additions=requirements.filter(item=>!existing.has(item.label));
    if(!additions.length)return;
    group._locationDataRequirementsV452=[...(group._locationDataRequirementsV452||[]),...additions.map(item=>item.label)];
    group.total+=additions.length;
    group.done+=additions.filter(item=>item.done).length;
    group.missingLabels=[...(group.missingLabels||[]),...additions.filter(item=>!item.done).map(item=>item.label)];
    group.missingCount=Math.max(0,group.total-group.done);
    group.ratio=group.total?group.done/group.total:1;
    group.percent=group.total?Math.round(group.done/group.total*100):100;
    group.detail=group.missingCount?`Не заполнено ${group.missingCount} из ${group.total} пунктов.`:'Раздел заполнен.';
  }

  function progressMissing(groups){
    return groups.filter(group=>group.missingCount>0).map(group=>{
      if(group.key==='scores')return `${group.missingCount} оценок из ${group.total}`;
      if(group.key==='photos')return `${group.missingCount} обязательных фото`;
      if(group.key==='checks')return `${group.missingCount} проверок перед арендой`;
      return `${group.title.toLowerCase()}: ${group.missingLabels.slice(0,3).join(', ')}${group.missingLabels.length>3?` и ещё ${group.missingLabels.length-3}`:''}`;
    });
  }

  function augmentMetric(metric){
    const data=metric.data||{};
    const groups=metric.progressGroups||[];
    const inspection=groups.find(group=>group.key==='inspection');
    const technical=groups.find(group=>group.key==='technical');
    const conclusion=groups.find(group=>group.key==='conclusion');
    const sourceRequirements=[
      {label:'источник объекта',done:filled(data.objectSource)},
      {label:'цель осмотра',done:filled(data.inspectionPurpose)},
      {label:'итог осмотра',done:filled(data.inspectionResult)},
    ];
    if(data.objectSource==='Объявление')sourceRequirements.push({label:'ссылка на объявление',done:filled(data.listingUrl)});
    if(data.objectSource==='Другое')sourceRequirements.push({label:'уточнение источника',done:filled(data.objectSourceOther)});
    extendGroup(inspection,sourceRequirements);
    extendGroup(technical,[{label:'требуемая мощность',done:filled(data?.tech?.requiredPowerKw)}]);
    if(filled(data.decision))extendGroup(conclusion,[{label:'причина решения',done:filled(data.decisionReason)}]);

    const api=window.BogatkaCardProgressV448;
    const weights=api?.GROUP_WEIGHTS||{};
    const percent=Math.round(groups.reduce((sum,group)=>sum+group.ratio*Number(group.weight??weights[group.key]??0),0));
    const completeGroups=groups.filter(group=>group.missingCount===0).length;
    const inspectionGroup=groups.find(group=>group.key==='inspection');
    const landlordGroup=groups.find(group=>group.key==='landlord');
    const basicDone=Number(inspectionGroup?.done||0)+Number(landlordGroup?.done||0);
    const basicTotal=Number(inspectionGroup?.total||0)+Number(landlordGroup?.total||0);
    const sections={
      basic:basicTotal?basicDone/basicTotal:1,
      scores:groups.find(group=>group.key==='scores')?.ratio||0,
      technical:technical?.ratio||0,
      photos:groups.find(group=>group.key==='photos')?.ratio||0,
      stops:groups.find(group=>group.key==='checks')?.ratio||0,
      conclusion:conclusion?.ratio||0,
    };
    const progress={groups,percent,completeGroups,totalGroups:groups.length,missing:progressMissing(groups),sections};
    metric.completion=percent;
    metric.sections=sections;
    metric.missing=progress.missing;
    metric.completedProgressGroups=completeGroups;
    metric.totalProgressGroups=groups.length;
    if(api?.scoreAnalysis&&api?.recommendation){
      const analysis=api.scoreAnalysis(data,window.BogatkaDecisionEngine?.WEIGHTS||{});
      metric.recommendation=api.recommendation(metric,analysis,progress);
    }
    return metric;
  }

  function installEngineWrapper(){
    engineAttempts+=1;
    const engine=window.BogatkaDecisionEngine;
    const current=engine?.computeAll;
    if(!engine||typeof current!=='function'||!current.__cardProgressV448){
      if(engineAttempts<160)setTimeout(installEngineWrapper,100);
      return false;
    }
    if(current.__locationDataV452)return true;
    const wrapped=async function(...args){
      const metrics=await current(...args);
      metrics.forEach(augmentMetric);
      return metrics;
    };
    Object.assign(wrapped,current);
    wrapped.__locationDataV452=true;
    wrapped.__cardProgressV448=true;
    wrapped.__base=current;
    engine.computeAll=wrapped;
    setTimeout(()=>{
      if(typeof updateSummary==='function')updateSummary().catch?.(console.error);
    },0);
    return true;
  }

  function applyViewerState(root=document){
    const viewer=isViewer();
    root.querySelectorAll?.('[data-location-data-v452]').forEach(control=>{
      if(viewer){
        if(!control.disabled)control.dataset.locationDataViewerDisabledV452='1';
        control.disabled=true;
      }else if(control.dataset.locationDataViewerDisabledV452==='1'){
        control.disabled=false;
        delete control.dataset.locationDataViewerDisabledV452;
      }
      if(control.tagName==='SELECT')syncPremium(control);
    });
  }

  async function enhanceCard(card){
    if(!card?.dataset?.locationCard)return false;
    ensureInspectionFields(card);
    ensureDecisionReason(card);
    ensurePowerBalance(card);
    await restoreCard(card);
    syncCardState(card);
    applyViewerState(card);
    card.dataset.locationDataV452='1';
    return true;
  }

  async function enhanceAll(){
    patchHistoryLabels();
    installEngineWrapper();
    for(const card of document.querySelectorAll('[data-location-card]'))await enhanceCard(card);
    applyViewerState(document);
    return true;
  }

  function schedule(delay=80){
    clearTimeout(timer);
    timer=setTimeout(()=>enhanceAll().catch(console.error),delay);
  }

  function audit(){
    const failures=[];
    if(typeof CHECKLIST!=='undefined'&&CHECKLIST.length!==35)failures.push(`checklist-count:${CHECKLIST.length}`);
    for(const card of document.querySelectorAll('[data-location-card]')){
      for(const definition of INSPECTION_FIELDS){
        if(!card.querySelector(`[data-field="${definition.field}"]`))failures.push(`${card.dataset.locationCard}:${definition.field}:missing`);
      }
      if(!card.querySelector('[data-field="tech.requiredPowerKw"]'))failures.push(`${card.dataset.locationCard}:requiredPower:missing`);
      if(!card.querySelector('.power-balance-v452'))failures.push(`${card.dataset.locationCard}:powerBalance:missing`);
      if(!card.querySelector('[data-field="decisionReason"]'))failures.push(`${card.dataset.locationCard}:decisionReason:missing`);
      for(const key of REMOVED_CHECKLIST_KEYS){
        if(card.querySelector(`[data-field="check.${key}"]`))failures.push(`${card.dataset.locationCard}:legacyChecklist:${key}:visible`);
      }
    }
    return{ok:failures.length===0,failures};
  }

  function install(){
    const root=document.getElementById('locations')||document.body;
    new MutationObserver(()=>schedule(100)).observe(root,{childList:true,subtree:true});
    schedule(20);
    [250,700,1500,3000,6000].forEach(delay=>setTimeout(()=>schedule(0),delay));
    viewerTimer=setInterval(()=>applyViewerState(document),1200);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('load',()=>schedule(30),{once:true});

  window.BogatkaLocationDataV452={
    version:VERSION,
    ready:true,
    SOURCE_OPTIONS,
    FIELD_LABELS,
    REMOVED_CHECKLIST_KEYS,
    normalizedListingUrl,
    updatePowerBalance,
    augmentMetric,
    enhanceAll,
    enhanceCard,
    applyViewerState,
    audit,
    get viewerTimer(){return viewerTimer},
  };
})();
