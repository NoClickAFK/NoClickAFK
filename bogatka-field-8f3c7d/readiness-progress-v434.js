(function(){
  'use strict';
  if(window.BogatkaReadinessProgressV434?.ready)return;

  const VERSION='4.3.4';
  const OPTIONAL_REASON_HINT='Необязательно — можно кратко зафиксировать аргументы решения.';
  const VALID_DECISIONS=new Set(['Оставить','Под вопросом','Исключить']);
  const PHOTO_PLAN=Object.freeze({street:2,entrance:2,parking:1,traffic:1,competitors:1,interior:2,storage:1,engineering:2,documents:1,other:0});
  const PHOTO_LABELS={street:'улица и окружение',entrance:'вход и фасад',parking:'парковка',traffic:'трафик',competitors:'конкуренты',interior:'помещение',storage:'склад',engineering:'инженерия',documents:'документы',other:'прочее'};
  const GROUP_ORDER=['inspection','landlord','scores','technical','photos','checks','conclusion'];
  const GROUP_WEIGHTS={inspection:12,landlord:8,scores:25,technical:15,photos:20,checks:10,conclusion:10};
  const GROUP_META={inspection:{title:'Параметры осмотра',target:'inspection'},landlord:{title:'Арендодатель и условия',target:'landlord'},scores:{title:'Оценка локации',target:'scores'},technical:{title:'Технические и финансовые параметры',target:'technical'},photos:{title:'Фотографии по категориям',target:'photos'},checks:{title:'Проверки перед арендой',target:'checks'},conclusion:{title:'Предварительное решение по локации',target:'conclusion'}};
  let engineTerminal=null;
  let apiTransformTerminal=null;
  let refreshTimer=null;

  const filled=value=>value!==undefined&&value!==null&&(typeof value!=='string'||value.trim()!=='');
  const requirement=(label,done)=>({label,done:Boolean(done)});
  const simple=(label,value)=>requirement(label,filled(value));

  function inspectionRequirements(data={}){
    const items=[simple('статус работы',data.status),simple('тип объекта',data.objectType),simple('дата осмотра',data.date),simple('время осмотра',data.time),simple('этаж / расположение',data.floorLocation),simple('состояние помещения',data.premiseCondition),simple('доступность помещения',data.premiseAvailability),simple('готовность собственника',data.landlordReadiness),simple('цель осмотра',data.inspectionPurpose),simple('итог осмотра',data.inspectionResult)];
    if(data.objectType==='Другое')items.splice(2,0,simple('уточнение типа объекта',data.objectTypeOther));
    return items;
  }

  function landlordRequirements(data={}){
    const items=[simple('собственник / организация',data.ownerName),simple('роль контактного лица',data.contactRole),simple('контактное лицо',data.contact),requirement('телефон, мессенджер или email',[data.contactPhone,data.contactMessenger,data.contactEmail].some(filled)),simple('источник объекта',data.objectSource)];
    if(data.contactRole==='Другое')items.splice(2,0,simple('уточнение роли контактного лица',data.contactRoleOther));
    if(data.objectSource==='Объявление')items.push(simple('ссылка на объявление',data.listingUrl));
    if(data.objectSource==='Другое')items.push(simple('уточнение источника объекта',data.objectSourceOther));
    return items;
  }

  function technicalRequirements(data={}){
    return[simple('общая площадь',data?.tech?.totalArea),simple('аренда в месяц',data?.tech?.rentPerMonth),simple('электрическая мощность',data?.tech?.powerKw),simple('требуемая мощность',data?.tech?.requiredPowerKw),simple('режим работы',data?.tech?.openingHours),simple('коммунальные расходы',data?.tech?.utilities),simple('оценка ремонта',data?.tech?.repairEstimate)];
  }

  function conclusionRequirements(data={}){return[requirement('предварительное решение',VALID_DECISIONS.has(String(data.decision||'').trim()))]}

  function requirementGroup(key,items,detail=''){
    const meta=GROUP_META[key];
    const normalized=items.map(item=>({label:String(item.label),done:Boolean(item.done)}));
    const total=normalized.length;
    const done=normalized.filter(item=>item.done).length;
    const missingLabels=normalized.filter(item=>!item.done).map(item=>item.label);
    return{key,title:meta.title,target:meta.target,weight:GROUP_WEIGHTS[key],requirements:normalized,done,total,ratio:total?done/total:1,percent:total?Math.round(done/total*100):100,missingCount:Math.max(0,total-done),missingLabels,detail};
  }

  function scoreGroup(data={}){
    const weights=window.BogatkaDecisionEngine?.WEIGHTS||{};
    const group=requirementGroup('scores',Object.keys(weights).map(key=>simple(key,data?.score?.[key])));
    group.detail=group.missingCount?`Оценено ${group.done} из ${group.total} критериев.`:'Все 14 критериев оценены.';
    return group;
  }

  function photoGroup(metric={}){
    const plan=metric.photoPlan||{};
    const total=Number(plan.requiredTotal||13);
    const done=Math.min(total,Number(plan.completed||0));
    const missing=Array.isArray(plan.missing)?plan.missing:[];
    const missingLabels=missing.map(item=>`${PHOTO_LABELS[item.category]||item.category}: ещё ${item.missing}`);
    const missingCount=Math.max(0,total-done);
    return{key:'photos',title:GROUP_META.photos.title,target:'photos',weight:GROUP_WEIGHTS.photos,done,total,ratio:total?done/total:1,percent:total?Math.min(100,Math.round(done/total*100)):100,missingCount,missingLabels,detail:missingCount?`Не хватает ${missingCount} фото до минимального фотоплана.`:'Минимальный фотоплан выполнен.'};
  }

  function checksGroup(metric={}){
    const entries=metric.dealGate?.entries||[];
    const total=entries.length||10;
    const deal=window.BogatkaCriticalDeal;
    const complete=entry=>Boolean(deal?.isCompleted?.(entry.value,entry.definition));
    const done=entries.length?entries.filter(complete).length:Number(metric.stopAnswered||0);
    const missingLabels=entries.filter(entry=>!complete(entry)).map(entry=>entry.definition?.title||'проверка');
    return{key:'checks',title:GROUP_META.checks.title,target:'checks',weight:GROUP_WEIGHTS.checks,done,total,ratio:total?done/total:1,percent:total?Math.round(done/total*100):100,missingCount:Math.max(0,total-done),missingLabels,detail:Math.max(0,total-done)?`Не завершено ${Math.max(0,total-done)} из ${total} проверок.`:'Все проверки завершены.'};
  }

  function progressMissing(groups){
    return groups.filter(group=>group.missingCount>0).map(group=>{
      if(group.key==='scores')return `${group.missingCount} оценок из ${group.total}`;
      if(group.key==='photos')return `${group.missingCount} фото до минимального фотоплана`;
      if(group.key==='checks')return `${group.missingCount} проверок перед арендой`;
      return `${group.title.toLowerCase()}: ${group.missingLabels.slice(0,3).join(', ')}${group.missingLabels.length>3?` и ещё ${group.missingLabels.length-3}`:''}`;
    });
  }

  function buildProgress(metric={}){
    const data=metric.data||{};
    const groups=[requirementGroup('inspection',inspectionRequirements(data)),requirementGroup('landlord',landlordRequirements(data)),scoreGroup(data),requirementGroup('technical',technicalRequirements(data)),photoGroup(metric),checksGroup(metric),requirementGroup('conclusion',conclusionRequirements(data))];
    const percent=Math.round(groups.reduce((sum,group)=>sum+group.ratio*group.weight,0));
    const completeGroups=groups.filter(group=>group.missingCount===0).length;
    const inspection=groups.find(group=>group.key==='inspection');
    const landlord=groups.find(group=>group.key==='landlord');
    const basicDone=inspection.done+landlord.done;
    const basicTotal=inspection.total+landlord.total;
    const sections={basic:basicTotal?basicDone/basicTotal:1,scores:groups.find(group=>group.key==='scores')?.ratio||0,technical:groups.find(group=>group.key==='technical')?.ratio||0,photos:groups.find(group=>group.key==='photos')?.ratio||0,stops:groups.find(group=>group.key==='checks')?.ratio||0,conclusion:groups.find(group=>group.key==='conclusion')?.ratio||0};
    return{groups,percent,completeGroups,totalGroups:groups.length,missing:progressMissing(groups),sections};
  }

  function applyMetric(metric={}){
    const progress=buildProgress(metric);
    metric.completion=progress.percent;
    metric.sections=progress.sections;
    metric.missing=progress.missing;
    metric.progressGroups=progress.groups;
    metric.completedProgressGroups=progress.completeGroups;
    metric.totalProgressGroups=progress.totalGroups;
    const api=window.BogatkaCardProgressV448;
    if(api?.scoreAnalysis&&api?.recommendation){const analysis=api.scoreAnalysis(metric.data||{},window.BogatkaDecisionEngine?.WEIGHTS||{});metric.recommendation=api.recommendation(metric,analysis,progress)}
    return metric;
  }

  function transformMetrics(metrics=[]){for(const metric of metrics)applyMetric(metric);return metrics}

  function installPhotoPlan(){
    const suite=window.BogatkaSuite;
    if(!suite?.PHOTO_PLAN)return false;
    for(const key of Object.keys(suite.PHOTO_PLAN))if(!(key in PHOTO_PLAN))delete suite.PHOTO_PLAN[key];
    Object.assign(suite.PHOTO_PLAN,PHOTO_PLAN);
    return true;
  }

  function markTerminal(wrapped,current){
    Object.assign(wrapped,current);
    Object.defineProperties(wrapped,{
      __readinessProgressV434:{value:true,configurable:true},
      __readinessTerminalV434:{value:true,configurable:true},
      __locationDataV452:{value:true,configurable:true},
      __base:{value:current,configurable:true},
    });
    return wrapped;
  }

  function installApi(){
    const api=window.BogatkaCardProgressV448;
    if(!api?.ready)return false;
    api.buildProgress=buildProgress;
    api.applyMetricV434=applyMetric;
    const current=api.transformMetrics;
    if(typeof current==='function'&&current!==apiTransformTerminal&&!current.__readinessTerminalV434){
      const wrapped=markTerminal(function(metrics){return transformMetrics(current.call(api,metrics))},current);
      api.transformMetrics=wrapped;apiTransformTerminal=wrapped;
    }
    return true;
  }

  function installEngineTerminal(){
    const engine=window.BogatkaDecisionEngine;
    const current=engine?.computeAll;
    if(!engine||typeof current!=='function')return false;
    if(current===engineTerminal||current.__readinessTerminalV434){engineTerminal=current;return true}
    const wrapped=markTerminal(async function(...args){installPhotoPlan();return transformMetrics(await current.apply(engine,args))},current);
    engine.computeAll=wrapped;engineTerminal=wrapped;
    return true;
  }

  function enforceOptionalReason(root=document){
    root.querySelectorAll?.('[data-field="decisionReason"]').forEach(control=>{
      if(control.required)control.required=false;
      if(control.getAttribute('aria-required')!=='false')control.setAttribute('aria-required','false');
      const section=control.closest('.decision-reason-section-v412,.decision-reason-v452');
      if(section){if(section.dataset.requiredMissing!=='false')section.dataset.requiredMissing='false';const warning=section.querySelector('.decision-reason-warning-v452');if(warning&&!warning.hasAttribute('hidden'))warning.setAttribute('hidden','')}
    });
    root.querySelectorAll?.('.decision-reason-description-v412,.decision-reason-helper-v412').forEach(node=>{if(node.textContent!==OPTIONAL_REASON_HINT)node.textContent=OPTIONAL_REASON_HINT});
  }

  function refreshPhotoCopy(root=document){root.querySelectorAll?.('.photo-plan-head-v400 strong').forEach(node=>{if(node.textContent!=='Минимальный фотоплан')node.textContent='Минимальный фотоплан'})}

  async function refresh(){
    installPhotoPlan();installApi();installEngineTerminal();enforceOptionalReason();refreshPhotoCopy();
    if(typeof window.BogatkaDecisionUI?.refresh==='function')await window.BogatkaDecisionUI.refresh();
    await window.BogatkaCardProgressV448?.renderAll?.();
    enforceOptionalReason();refreshPhotoCopy();
  }

  function schedule(delay=420){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refresh().catch(console.error),delay)}
  function ensureTerminal(){installPhotoPlan();installApi();installEngineTerminal()}

  function install(){
    const root=document.getElementById('locations')||document.body;
    ensureTerminal();enforceOptionalReason(root);refreshPhotoCopy(root);
    root.addEventListener('input',event=>{if(event.target?.matches?.('[data-field="listingUrl"],[data-field="objectSourceOther"],[data-field="inspectionPurpose"],[data-field="inspectionResult"]'))schedule(700)},true);
    root.addEventListener('change',event=>{if(event.target?.matches?.('[data-field="objectSource"],[data-field="decision"]'))schedule(180)},true);
    new MutationObserver(()=>{ensureTerminal();enforceOptionalReason(root);refreshPhotoCopy(root)}).observe(root,{childList:true,subtree:true});
    [0,120,280,520,900,1500,2500,4000,7000].forEach(delay=>setTimeout(ensureTerminal,delay));
    schedule(0);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.BogatkaReadinessProgressV434={version:VERSION,ready:true,PHOTO_PLAN,GROUP_ORDER,GROUP_WEIGHTS,inspectionRequirements,landlordRequirements,technicalRequirements,conclusionRequirements,buildProgress,applyMetric,transformMetrics,installPhotoPlan,installApi,installEngineTerminal,refresh};
})();
