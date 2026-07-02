(function(){
  'use strict';
  if(window.BogatkaCriticalDealPersistenceV453?.ready)return;

  const VERSION='4.5.3';
  const DEAL=window.BogatkaCriticalDeal;
  const queues=new Map();
  const timers=new Map();
  let lastError=null;

  const isViewer=()=>{try{return window.cloudRole==='viewer'||cloudRole==='viewer'}catch(_){return false}};
  const actorId=()=>{const actor=window.BogatkaSuite?.currentActor?.();return actor?.id||actor?.email||actor?.name||null};

  function conditionSnapshot(section,key){
    return{
      status:section.querySelector(`[data-critical-key="${CSS.escape(key)}"][data-critical-field="status"]`)?.value||'unchecked',
      evidenceType:section.querySelector(`[data-critical-key="${CSS.escape(key)}"][data-critical-field="evidenceType"]`)?.value||'not_confirmed',
      note:section.querySelector(`[data-critical-key="${CSS.escape(key)}"][data-critical-field="note"]`)?.value||'',
    };
  }

  function allSnapshots(section){
    const values={};
    for(const definition of DEAL.CONDITIONS)values[definition.key]=conditionSnapshot(section,definition.key);
    return values;
  }

  function syncSelect(select,value){
    if(!select)return;
    if(select.value!==value)select.value=value;
    if(window.BogatkaSelectSync?.syncVisibleSelect)window.BogatkaSelectSync.syncVisibleSelect(select);
    else{
      const trigger=select.nextElementSibling?.classList.contains('premium-select-trigger')?select.nextElementSibling:null;
      if(trigger&&typeof window.bogatkaSyncPremiumSelect==='function')window.bogatkaSyncPremiumSelect(select,trigger);
    }
  }

  function normalizeOral(section,key,snapshot){
    if(snapshot.status==='confirmed'&&DEAL.isOralEvidence(snapshot.evidenceType)){
      snapshot.status='needs_formalization';
      syncSelect(section.querySelector(`[data-critical-key="${CSS.escape(key)}"][data-critical-field="status"]`),snapshot.status);
    }
    return snapshot;
  }

  function renderLocal(section){
    const data={criticalDealConditions:allSnapshots(section)};
    const gate=DEAL.evaluate(data);
    const id=section.dataset.criticalDeal;
    const badge=section.querySelector(`[data-critical-summary="${CSS.escape(id)}"]`);
    if(badge)badge.textContent=gate.badge;
    const result=section.querySelector(`[data-critical-gate="${CSS.escape(id)}"]`);
    if(result){result.textContent=gate.text;result.className=`critical-deal-gate-v430 ${gate.className}`;}
    for(const entry of gate.entries){
      const card=section.querySelector(`[data-critical-condition="${CSS.escape(entry.definition.key)}"]`);
      if(!card)continue;
      const error=card.querySelector('[data-critical-error]');
      const message=entry.validation.errors.join(' ');
      if(error)error.dataset.message=message;
      card.classList.toggle('critical-condition-invalid-v430',Boolean(message));
      card.querySelectorAll('select,textarea').forEach(control=>control.setAttribute('aria-invalid',message?'true':'false'));
    }
    const locationCard=section.closest('[data-location-card]');
    locationCard?.classList.toggle('has-stop-factor-v340',gate.code==='blocked');
    locationCard?.classList.toggle('has-risk-factor-v340',gate.code==='needs_formalization');
    if(gate.code==='blocked'){
      const recommendation=locationCard?.querySelector('[data-recommendation]');
      if(recommendation){recommendation.textContent='СТОП';recommendation.className='decision-recommendation-v340 stop';}
      const overview=locationCard?.querySelector('[data-overview-recommendation]');
      if(overview)overview.textContent='СТОП';
    }
    return gate;
  }

  function enqueue(locationId,task){
    const previous=queues.get(locationId)||Promise.resolve();
    const next=previous.catch(()=>{}).then(task);
    queues.set(locationId,next);
    next.finally(async()=>{
      if(queues.get(locationId)!==next)return;
      queues.delete(locationId);
      try{await window.updateSummary?.();window.showSaved?.();}
      catch(error){lastError=error;window.showError?.(error)||console.error(error);}
    });
    return next;
  }

  function persist(section,key,snapshot){
    const locationId=section.dataset.criticalDeal;
    window.showSaving?.();
    return enqueue(locationId,async()=>{
      const data=await getLocationData(locationId);
      data.criticalDealConditions={...(data.criticalDealConditions||{})};
      const previous=DEAL.normalizeCondition(data.criticalDealConditions[key],key);
      data.criticalDealConditions[key]={...previous,...snapshot,updatedAt:new Date().toISOString(),updatedBy:actorId()};
      data.updatedAt=new Date().toISOString();
      await idbPut(STORE,data,`location:${locationId}`);
      window.updateLocationTotal?.(locationId,data);
    });
  }

  function scheduleNote(section,key,snapshot,{immediate=false}={}){
    const locationId=section.dataset.criticalDeal;
    const timerKey=`${locationId}:${key}`;
    clearTimeout(timers.get(timerKey));
    timers.delete(timerKey);
    if(immediate)return persist(section,key,snapshot);
    timers.set(timerKey,setTimeout(()=>{
      timers.delete(timerKey);
      persist(section,key,snapshot).catch(error=>{lastError=error;window.showError?.(error)||console.error(error);});
    },180));
    return Promise.resolve();
  }

  function handle(event){
    const control=event.target?.closest?.('[data-critical-field][data-critical-key][data-critical-location]');
    if(!control||isViewer())return;
    const section=control.closest('[data-critical-deal]');
    if(!section)return;
    event.stopImmediatePropagation();
    event.stopPropagation();
    const key=control.dataset.criticalKey;
    const snapshot=normalizeOral(section,key,conditionSnapshot(section,key));
    renderLocal(section);
    if(control.dataset.criticalField==='note'){
      scheduleNote(section,key,snapshot,{immediate:event.type==='blur'}).catch(error=>{lastError=error;window.showError?.(error)||console.error(error);});
    }else{
      persist(section,key,snapshot).catch(error=>{lastError=error;window.showError?.(error)||console.error(error);});
    }
  }

  document.addEventListener('change',handle,true);
  document.addEventListener('input',handle,true);
  document.addEventListener('blur',handle,true);

  window.BogatkaCriticalDealPersistenceV453={
    version:VERSION,ready:true,conditionSnapshot,allSnapshots,renderLocal,
    get pendingWrites(){return queues.size+timers.size},
    get lastError(){return lastError;},
  };
})();
