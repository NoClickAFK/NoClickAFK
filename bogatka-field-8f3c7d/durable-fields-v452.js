(function(){
  'use strict';
  if(window.BogatkaDurableFieldsV452?.ready)return;

  const VERSION='4.5.2';
  const WORKFLOW_FIX_VERSION='4.5.7';
  const FIELDS=new Set([
    'objectSource','objectSourceOther','listingUrl','inspectionPurpose','inspectionParticipants','inspectionResult',
    'decision','decisionReason','tech.powerKw','tech.requiredPowerKw',
  ]);
  const snapshots=new Map();
  const timers=new Map();
  const queues=new Map();
  const PRIORITY_ORDER={critical:0,high:1,normal:2};
  const PRIORITY_LABELS={critical:'Критический',high:'Высокий',normal:'Обычный'};
  const TASK_STATUS_LABELS={todo:'К выполнению',doing:'В работе',waiting:'Ожидает',done:'Готово'};
  const STATUS_ORDER={
    'Новый объект':1,
    'Связались с арендодателем':2,
    'Осмотр запланирован':3,
    'Осмотрен':4,
    'Собираем информацию':5,
    'Проверяем документы':6,
    'Ведём переговоры':7,
    'Выбран':8,
    'Кандидат':1,
    'Осмотрена':4,
    'Переговоры':7,
    'Оставить':8,
    'Исключить':9,
    '':99,
  };
  let workflowTimer=null;

  function pendingLocation(locationId){
    const pending=window.BogatkaFieldIntegrityV416?.pendingLocations||[];
    return pending.includes(locationId);
  }

  async function waitForBaseQueue(locationId,timeoutMs=5000){
    const started=Date.now();
    while(pendingLocation(locationId)&&Date.now()-started<timeoutMs){
      await new Promise(resolve=>setTimeout(resolve,25));
    }
  }

  function snapshotFrom(target){
    const locationId=target?.dataset?.location;
    const field=target?.dataset?.field;
    if(!locationId||!FIELDS.has(field))return null;
    if(target.type==='radio'&&!target.checked)return null;
    const value=target.type==='checkbox'?target.checked:target.value;
    const key=`${locationId}:${field}`;
    const snapshot={key,locationId,field,value};
    snapshots.set(key,snapshot);
    return snapshot;
  }

  function enqueue(snapshot){
    if(!snapshot||typeof getLocationData!=='function'||typeof idbPut!=='function'||typeof setNested!=='function')return Promise.resolve(false);
    const previous=queues.get(snapshot.locationId)||Promise.resolve();
    const task=previous.catch(()=>{}).then(async()=>{
      await waitForBaseQueue(snapshot.locationId);
      const data=await getLocationData(snapshot.locationId);
      const current=typeof getNested==='function'?getNested(data,snapshot.field):undefined;
      if(String(current??'')===String(snapshot.value??''))return true;
      setNested(data,snapshot.field,snapshot.value);
      data.updatedAt=new Date().toISOString();
      await idbPut(STORE,data,`location:${snapshot.locationId}`);
      return true;
    });
    const tracked=task.finally(()=>{
      if(queues.get(snapshot.locationId)===tracked)queues.delete(snapshot.locationId);
    });
    queues.set(snapshot.locationId,tracked);
    return tracked;
  }

  function capture(target,immediate=false){
    const snapshot=snapshotFrom(target);
    if(!snapshot)return;
    clearTimeout(timers.get(snapshot.key));
    timers.delete(snapshot.key);
    if(immediate){
      enqueue(snapshot).catch(console.error);
      return;
    }
    timers.set(snapshot.key,setTimeout(()=>{
      timers.delete(snapshot.key);
      enqueue(snapshot).catch(console.error);
    },120));
  }

  async function flush(){
    for(const [key,timer] of timers){
      clearTimeout(timer);
      timers.delete(key);
      const snapshot=snapshots.get(key);
      if(snapshot)enqueue(snapshot).catch(console.error);
    }
    const active=[...queues.values()];
    if(active.length)await Promise.allSettled(active);
    const pendingIds=[...new Set([...snapshots.values()].map(item=>item.locationId))];
    for(const locationId of pendingIds)await waitForBaseQueue(locationId);
    const hydration=window.BogatkaLocationDataStabilityV452;
    if(hydration?.hydrateCard){
      for(const card of document.querySelectorAll('[data-location-card]'))await hydration.hydrateCard(card);
    }
    return true;
  }

  function numericDate(value,suffix=''){
    if(!value)return Number.POSITIVE_INFINITY;
    const parsed=Date.parse(`${value}${suffix}`);
    return Number.isFinite(parsed)?parsed:Number.POSITIVE_INFINITY;
  }

  function compareOptionalDates(left,right,suffix=''){
    const leftValue=numericDate(left,suffix);
    const rightValue=numericDate(right,suffix);
    if(leftValue===rightValue)return 0;
    if(!Number.isFinite(leftValue))return 1;
    if(!Number.isFinite(rightValue))return-1;
    return leftValue-rightValue;
  }

  function pickNextTask(data={}){
    const tasks=Array.isArray(data.tasks)?data.tasks.filter(task=>task&&task.status!=='done'&&String(task.title||'').trim()):[];
    tasks.sort((left,right)=>{
      const priority=(PRIORITY_ORDER[left.priority]??PRIORITY_ORDER.normal)-(PRIORITY_ORDER[right.priority]??PRIORITY_ORDER.normal);
      if(priority)return priority;
      const due=compareOptionalDates(left.dueDate,right.dueDate,'T23:59:59');
      if(due)return due;
      const created=compareOptionalDates(left.createdAt,right.createdAt);
      if(created)return created;
      return String(left.title||'').localeCompare(String(right.title||''),'ru');
    });
    return tasks[0]||null;
  }

  function formatDueDate(value){
    if(!value)return'';
    const date=new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime())?String(value):date.toLocaleDateString('ru-RU');
  }

  function taskPresentation(data={}){
    const task=pickNextTask(data);
    if(task){
      const meta=[
        PRIORITY_LABELS[task.priority]||PRIORITY_LABELS.normal,
        TASK_STATUS_LABELS[task.status]||task.status,
        task.assignee?`Ответственный: ${task.assignee}`:'Ответственный не назначен',
        task.dueDate?`Срок: ${formatDueDate(task.dueDate)}`:'Без срока',
      ];
      return{kind:'task',title:String(task.title).trim(),meta:meta.filter(Boolean).join(' · '),priority:task.priority||'normal',task};
    }
    const legacy=String(data.nextAction||'').trim();
    if(legacy){
      const date=data.nextActionDate?` · Дата: ${formatDueDate(data.nextActionDate)}`:'';
      return{kind:'legacy',title:legacy,meta:`Ранее записанный следующий шаг${date}. Новые шаги создавайте в разделе «Задачи».`,priority:'normal',task:null};
    }
    return{kind:'empty',title:'Активных задач нет',meta:'Добавьте задачу в разделе «Совместная работа».',priority:'normal',task:null};
  }

  async function refreshNextTaskPanels(){
    if(typeof getLocationData!=='function')return;
    if(!document.querySelector('[data-next-task-v447]'))await window.BogatkaStatusNextTaskV447?.enhanceAll?.();
    for(const card of document.querySelectorAll('[data-location-card]')){
      const locationId=card.dataset.locationCard;
      const panel=card.querySelector(`[data-next-task-v447="${CSS.escape(locationId||'')}"]`);
      if(!locationId||!panel)continue;
      const presentation=taskPresentation(await getLocationData(locationId));
      panel.dataset.nextTaskKind=presentation.kind;
      panel.dataset.nextTaskPriority=presentation.priority;
      const title=panel.querySelector('[data-next-task-title-v447]');
      const meta=panel.querySelector('[data-next-task-meta-v447]');
      if(title&&title.textContent!==presentation.title)title.textContent=presentation.title;
      if(meta&&meta.textContent!==presentation.meta)meta.textContent=presentation.meta;
    }
  }

  function statusRank(value){
    return STATUS_ORDER[String(value||'')]??90;
  }

  function applyStatusSort(){
    const root=document.getElementById('locations');
    const mode=document.getElementById('locationSortMode')?.value;
    const metrics=window.BogatkaDecisionUI?.lastMetrics||[];
    if(!root||mode!=='status'||!metrics.length)return false;
    const active=document.activeElement;
    if(active&&root.contains(active)&&active.matches('input,textarea,select,[contenteditable="true"]'))return false;
    const items=[...metrics].sort((left,right)=>statusRank(left?.data?.status)-statusRank(right?.data?.status)||(left.rank||0)-(right.rank||0));
    const desired=items.map(metric=>metric.id);
    const current=[...root.querySelectorAll(':scope > [data-location-card]')].map(card=>card.dataset.locationCard).filter(id=>desired.includes(id));
    if(current.length===desired.length&&current.every((id,index)=>id===desired[index]))return true;
    for(const metric of items){
      const card=root.querySelector(`[data-location-card="${CSS.escape(metric.id)}"]`);
      if(card)root.appendChild(card);
    }
    return true;
  }

  function stabilizeDecisionWrappers(){
    const engine=window.BogatkaDecisionEngine;
    if(!window.BogatkaCardProgressV448?.ready||!window.BogatkaTechnicalEconomicsV450?.ready||typeof engine?.computeAll!=='function')return false;
    engine.computeAll.__cardProgressV448=true;
    engine.computeAll.__technicalEconomicsV450=true;
    return true;
  }

  async function applyWorkflowIntegrity(){
    stabilizeDecisionWrappers();
    await refreshNextTaskPanels();
    applyStatusSort();
  }

  function installUpdateSummaryWrapper(){
    if(typeof window.updateSummary!=='function'&&typeof updateSummary!=='function')return false;
    const current=window.updateSummary||updateSummary;
    if(current.__workflowIntegrityV457)return true;
    const wrapped=async function(...args){
      const result=await current(...args);
      await applyWorkflowIntegrity();
      return result;
    };
    Object.assign(wrapped,current);
    wrapped.__workflowIntegrityV457=true;
    wrapped.__base=current;
    window.updateSummary=wrapped;
    try{updateSummary=wrapped}catch(_){ }
    return true;
  }

  function scheduleWorkflowIntegrity(delay=40){
    clearTimeout(workflowTimer);
    workflowTimer=setTimeout(()=>{
      installUpdateSummaryWrapper();
      applyWorkflowIntegrity().catch(console.error);
    },delay);
  }

  function workflowAudit(){
    const dated=pickNextTask({tasks:[
      {id:'undated',title:'Без срока',priority:'normal',status:'todo',createdAt:'2026-01-01T00:00:00Z'},
      {id:'dated',title:'Со сроком',priority:'normal',status:'todo',dueDate:'2026-07-10',createdAt:'2026-06-01T00:00:00Z'},
    ]});
    const compute=window.BogatkaDecisionEngine?.computeAll;
    const failures=[];
    if(dated?.id!=='dated')failures.push('dated-task-priority');
    if(!(statusRank('Новый объект')<statusRank('Осмотрен')&&statusRank('Осмотрен')<statusRank('Выбран')))failures.push('status-order');
    if(window.BogatkaCardProgressV448?.ready&&window.BogatkaTechnicalEconomicsV450?.ready&&(!compute?.__cardProgressV448||!compute?.__technicalEconomicsV450))failures.push('decision-wrapper-markers');
    return{ok:failures.length===0,failures};
  }

  function install(){
    const root=document.getElementById('locations')||document.body;
    const listener=event=>{
      const target=event.target;
      if(!target?.dataset?.field)return;
      capture(target,event.type==='change'||event.type==='blur');
    };
    root.addEventListener('input',listener,true);
    root.addEventListener('change',listener,true);
    root.addEventListener('blur',listener,true);
    document.addEventListener('change',event=>{
      if(event.target?.id==='locationSortMode')setTimeout(()=>applyStatusSort(),0);
    });
    installUpdateSummaryWrapper();
    [0,80,200,500,1000,2000,4000,8000,15000,22000].forEach(delay=>setTimeout(()=>scheduleWorkflowIntegrity(0),delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();

  window.BogatkaDurableFieldsV452={
    version:VERSION,
    ready:true,
    FIELDS,
    capture,
    flush,
    get pendingWrites(){return queues.size+timers.size},
  };
  window.BogatkaWorkflowIntegrityV457={
    version:WORKFLOW_FIX_VERSION,
    ready:true,
    pickNextTask,
    taskPresentation,
    statusRank,
    applyStatusSort,
    stabilizeDecisionWrappers,
    refreshNextTaskPanels,
    audit:workflowAudit,
  };
  if(typeof loadBogatkaPatch==='function')loadBogatkaPatch('script',{src:'./suite-save-order-v452.js'});
})();