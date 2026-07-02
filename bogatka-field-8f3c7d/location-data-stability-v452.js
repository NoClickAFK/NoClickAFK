(function(){
  'use strict';
  if(window.BogatkaLocationDataStabilityV452?.ready)return;

  const VERSION='4.5.2';
  const DURABLE_FIELDS=new Set([
    'objectSource','objectSourceOther','listingUrl','inspectionPurpose','inspectionParticipants','inspectionResult',
    'floorLocation','premiseCondition','premiseAvailability','landlordReadiness',
    'decision','decisionReason','tech.powerKw','tech.requiredPowerKw',
  ]);
  const durableTimers=new Map();
  const durableRevisions=new Map();
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

  function number(value){
    if(typeof value==='number')return Number.isFinite(value)?value:null;
    if(typeof value!=='string')return null;
    const match=value.replace(/\s+/g,'').replace(',','.').match(/-?\d+(?:\.\d+)?/);
    return match&&Number.isFinite(Number(match[0]))?Number(match[0]):null;
  }

  function formatNumber(value){
    return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Math.abs(Number(value)));
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

  function renderStoredPowerBalance(card,data){
    const availableControl=card.querySelector('[data-field="tech.powerKw"]');
    const requiredControl=card.querySelector('[data-field="tech.requiredPowerKw"]');
    const locationId=card.dataset.locationCard;
    if(controlIsProtected(availableControl,locationId)||controlIsProtected(requiredControl,locationId)){
      window.BogatkaLocationDataV452?.updatePowerBalance?.(card);
      return false;
    }
    const available=number(data?.tech?.powerKw);
    const required=number(data?.tech?.requiredPowerKw);
    const box=card.querySelector('.power-balance-v452');
    const output=box?.querySelector('[data-power-balance-v452]');
    if(!box||!output)return false;
    if(available===null||required===null){
      window.BogatkaLocationDataV452?.updatePowerBalance?.(card);
      return false;
    }
    const balance=available-required;
    let text='Мощность без запаса';
    let state='zero';
    if(balance>0){text=`Запас ${formatNumber(balance)} кВт`;state='reserve'}
    else if(balance<0){text=`Дефицит ${formatNumber(balance)} кВт`;state='deficit'}
    if(output.textContent!==text)output.textContent=text;
    box.dataset.balanceState=state;
    return true;
  }

  async function hydrateCard(card){
    const api=window.BogatkaLocationDataV452;
    const locationId=card?.dataset?.locationCard;
    if(!api||!locationId||typeof getLocationData!=='function')return false;
    const protectedAtStart=pendingLocation(locationId);
    const data=await getLocationData(locationId);
    card.querySelectorAll('[data-location-data-v452][data-field]').forEach(control=>{
      if(protectedAtStart||controlIsProtected(control,locationId))return;
      const value=typeof getNested==='function'?getNested(data,control.dataset.field):undefined;
      const next=value===undefined||value===null?'':String(value);
      if(control.value!==next){
        control.value=next;
        syncPremium(control);
      }
    });
    const available=card.querySelector('[data-field="tech.powerKw"]');
    if(!protectedAtStart&&available&&!controlIsProtected(available,locationId)){
      const stored=data?.tech?.powerKw;
      const next=stored===undefined||stored===null?'':String(stored);
      if(available.value!==next)available.value=next;
    }
    if(!protectedAtStart)renderStoredPowerBalance(card,data);else api.updatePowerBalance?.(card);
    return true;
  }

  async function hydrateExistingCards(){
    for(const card of document.querySelectorAll('[data-location-card]'))await hydrateCard(card);
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
    const revision=Number(durableRevisions.get(key)||0)+1;
    durableRevisions.set(key,revision);
    clearTimeout(durableTimers.get(key));
    durableTimers.set(key,setTimeout(async()=>{
      durableTimers.delete(key);
      try{
        await persistSnapshot(locationId,field,value);
        const card=target.closest?.('[data-location-card]');
        if(card)await hydrateCard(card);
        setTimeout(async()=>{
          if(durableRevisions.get(key)!==revision)return;
          try{
            await persistSnapshot(locationId,field,value);
            if(card)await hydrateCard(card);
          }catch(error){console.error(error)}
        },520);
      }catch(error){console.error(error)}
    },immediate?15:110));
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
    await hydrateExistingCards();
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
    setTimeout(()=>hydrateExistingCards().catch(console.error),140);
    [500,1400,3000].forEach(delay=>setTimeout(()=>{
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
    const card=target?.closest?.('[data-location-card]')||target;
    if(!card?.matches?.('[data-location-card]'))return;
    [80,320,700,1300,2200,3600].forEach(delay=>setTimeout(()=>hydrateCard(card).catch(console.error),delay));
  }

  function scheduleUiSettlement(){
    [950,1550].forEach(delay=>setTimeout(async()=>{
      try{
        const ui=window.BogatkaUIStability;
        if(ui?.pending&&!ui.hasActiveEditor?.())await (ui.settleAfterBlur?.()||ui.flush?.());
      }catch(error){console.error(error)}
    },delay));
  }

  function install(){
    installRenderHook();
    const root=document.getElementById('locations')||document.body;
    new MutationObserver(()=>schedule(80)).observe(root,{childList:true,subtree:true});
    new MutationObserver(records=>{
      const cards=new Set();
      for(const record of records){
        const element=record.target.nodeType===Node.ELEMENT_NODE?record.target:record.target.parentElement;
        const output=element?.closest?.('[data-power-balance-v452]');
        if(output?.textContent.includes('Укажите доступную и требуемую мощность')){
          const card=output.closest('[data-location-card]');
          if(card)cards.add(card);
        }
      }
      cards.forEach(schedulePowerRefresh);
    }).observe(root,{childList:true,characterData:true,subtree:true});
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
    hydrateExistingCards,
    persistSnapshot,
    renderStoredPowerBalance,
    installRenderHook,
    get attempts(){return attempts},
    get stablePasses(){return stablePasses},
  };
})();
