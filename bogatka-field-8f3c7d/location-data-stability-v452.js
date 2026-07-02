(function(){
  'use strict';
  if(window.BogatkaLocationDataStabilityV452?.ready)return;

  const VERSION='4.5.2';
  const DURABLE_FIELDS=new Set([
    'objectSource','objectSourceOther','listingUrl','inspectionPurpose','inspectionParticipants','inspectionResult',
    'decision','decisionReason','tech.requiredPowerKw',
  ]);
  const durableTimers=new Map();
  let attempts=0;
  let timer=null;
  let stablePasses=0;
  let renderAttempts=0;
  let renderRevision=0;

  function pendingLocation(locationId){
    const pending=window.BogatkaFieldIntegrityV416?.pendingLocations||[];
    return pending.includes(locationId);
  }

  function controlIsProtected(control,locationId){
    return !control||control===document.activeElement||control.dataset.locationDataDirtyV452==='1'||pendingLocation(locationId);
  }

  function syncPremium(select){
    if(!select||select.tagName!=='SELECT')return;
    const trigger=select.nextElementSibling?.classList.contains('premium-select-trigger')?select.nextElementSibling:null;
    const selectedText=select.selectedOptions?.[0]?.textContent||'';
    const valueNode=trigger?.querySelector('.premium-select-value');
    if(trigger&&trigger.dataset.syncedValue===select.value&&valueNode?.textContent===selectedText&&trigger.disabled===select.disabled)return;
    if(window.BogatkaSelectSync?.syncVisibleSelect)window.BogatkaSelectSync.syncVisibleSelect(select);
    else if(trigger&&typeof bogatkaSyncPremiumSelect==='function')bogatkaSyncPremiumSelect(select,trigger);
    const current=select.nextElementSibling?.classList.contains('premium-select-trigger')?select.nextElementSibling:null;
    if(current){
      current.dataset.syncedValue=select.value;
      current.disabled=select.disabled;
      current.setAttribute('aria-disabled',String(select.disabled));
    }
  }

  async function hydrateCard(card){
    const api=window.BogatkaLocationDataV452;
    const locationId=card?.dataset?.locationCard;
    if(!api||!locationId||typeof getLocationData!=='function')return false;
    const data=await getLocationData(locationId);
    card.querySelectorAll('[data-location-data-v452][data-field]').forEach(control=>{
      if(controlIsProtected(control,locationId))return;
      const value=typeof getNested==='function'?getNested(data,control.dataset.field):undefined;
      const next=value===undefined||value===null?'':String(value);
      if(control.value!==next){
        control.value=next;
        syncPremium(control);
      }
    });
    const available=card.querySelector('[data-field="tech.powerKw"]');
    if(available&&!controlIsProtected(available,locationId)){
      const stored=data?.tech?.powerKw;
      const next=stored===undefined||stored===null?'':String(stored);
      if(available.value!==next)available.value=next;
    }
    api.updatePowerBalance?.(card);
    return true;
  }

  async function waitForBaseQueue(locationId,timeoutMs=3000){
    const started=Date.now();
    while(pendingLocation(locationId)&&Date.now()-started<timeoutMs){
      await new Promise(resolve=>setTimeout(resolve,25));
    }
  }

  async function persistSnapshot(locationId,field,value){
    if(!locationId||!field||typeof getLocationData!=='function'||typeof idbPut!=='function'||typeof setNested!=='function')return false;
    await waitForBaseQueue(locationId);
    const data=await getLocationData(locationId);
    if(String(getNested(data,field)??'')===String(value??''))return true;
    setNested(data,field,value);
    data.updatedAt=new Date().toISOString();
    await idbPut(STORE,data,`location:${locationId}`);
    return true;
  }

  function queueDurableSnapshot(target,immediate=false){
    const locationId=target?.dataset?.location;
    const field=target?.dataset?.field;
    if(!locationId||!DURABLE_FIELDS.has(field))return;
    if(target.type==='radio'&&!target.checked)return;
    const value=target.type==='checkbox'?target.checked:target.value;
    const key=`${locationId}:${field}`;
    clearTimeout(durableTimers.get(key));
    durableTimers.set(key,setTimeout(async()=>{
      durableTimers.delete(key);
      try{
        await persistSnapshot(locationId,field,value);
        const card=target.closest?.('[data-location-card]');
        if(card)await hydrateCard(card);
      }catch(error){console.error(error)}
    },immediate?10:90));
  }

  function ensureEngine(){
    const api=window.BogatkaLocationDataV452;
    const engine=window.BogatkaDecisionEngine;
    const current=engine?.computeAll;
    if(!api?.augmentMetric||typeof current!=='function')return false;
    if(current.__locationDataV452Owner===api.augmentMetric)return true;
    if(!current.__cardProgressV448)return false;
    const wrapped=async function(...args){
      const metrics=await current(...args);
      metrics.forEach(api.augmentMetric);
      return metrics;
    };
    Object.assign(wrapped,current);
    wrapped.__locationDataV452=true;
    wrapped.__cardProgressV448=true;
    wrapped.__base=current;
    Object.defineProperty(wrapped,'__locationDataV452Owner',{value:api.augmentMetric,enumerable:false,configurable:false});
    engine.computeAll=wrapped;
    return true;
  }

  async function stabilize(){
    attempts+=1;
    const api=window.BogatkaLocationDataV452;
    if(api?.enhanceAll)await api.enhanceAll();
    for(const card of document.querySelectorAll('[data-location-card]'))await hydrateCard(card);
    const engineReady=ensureEngine();
    const audit=api?.audit?.();
    const ready=Boolean(engineReady&&audit?.ok);
    stablePasses=ready?stablePasses+1:0;
    if(attempts<180&&stablePasses<6)setTimeout(stabilize,120);
    return{ready,audit,engineReady,attempts,stablePasses};
  }

  function schedule(delay=60){
    clearTimeout(timer);
    timer=setTimeout(()=>stabilize().catch(console.error),delay);
  }

  function scheduleAfterRender(){
    const revision=++renderRevision;
    [60,320,800,1500,2600].forEach(delay=>setTimeout(()=>{
      if(revision===renderRevision)schedule(0);
    },delay));
  }

  function installRenderHook(){
    renderAttempts+=1;
    const current=window.renderLocations||((typeof renderLocations==='function')?renderLocations:null);
    if(typeof current!=='function'){
      if(renderAttempts<120)setTimeout(installRenderHook,80);
      return false;
    }
    if(current.__locationDataStabilityV452)return true;
    const wrapped=function(...args){
      const result=current.apply(this,args);
      scheduleAfterRender();
      return result;
    };
    Object.assign(wrapped,current);
    wrapped.__locationDataStabilityV452=true;
    wrapped.__base=current;
    window.renderLocations=wrapped;
    try{renderLocations=wrapped}catch(_){ }
    return true;
  }

  function schedulePowerRefresh(target){
    const card=target?.closest?.('[data-location-card]');
    if(!card)return;
    [320,700,1300].forEach(delay=>setTimeout(()=>hydrateCard(card).catch(console.error),delay));
  }

  function scheduleUiSettlement(){
    [950,1550].forEach(delay=>setTimeout(async()=>{
      try{
        const ui=window.BogatkaUIStability;
        if(ui?.pending&&!ui.isEditing?.())await ui.flush?.();
      }catch(error){console.error(error)}
    },delay));
  }

  function install(){
    installRenderHook();
    const root=document.getElementById('locations')||document.body;
    new MutationObserver(()=>schedule(80)).observe(root,{childList:true,subtree:true});
    const inputListener=event=>{
      const field=event.target?.dataset?.field;
      if(DURABLE_FIELDS.has(field))queueDurableSnapshot(event.target,event.type==='blur'||event.type==='change');
      if(field==='tech.powerKw'||field==='tech.requiredPowerKw')schedulePowerRefresh(event.target);
      if(event.type==='blur')scheduleUiSettlement();
    };
    root.addEventListener('input',inputListener,true);
    root.addEventListener('change',inputListener,true);
    root.addEventListener('blur',inputListener,true);
    schedule(20);
    [300,900,1800,3500,6500,10000].forEach(delay=>setTimeout(()=>{
      installRenderHook();
      schedule(0);
    },delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('load',()=>{
    installRenderHook();
    scheduleAfterRender();
  },{once:true});
  window.addEventListener('pageshow',()=>scheduleAfterRender());

  window.BogatkaLocationDataStabilityV452={
    version:VERSION,
    ready:true,
    stabilize,
    ensureEngine,
    hydrateCard,
    persistSnapshot,
    installRenderHook,
    get attempts(){return attempts},
    get stablePasses(){return stablePasses},
  };
})();
