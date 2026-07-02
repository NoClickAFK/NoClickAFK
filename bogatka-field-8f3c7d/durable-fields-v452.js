(function(){
  'use strict';
  if(window.BogatkaDurableFieldsV452?.ready)return;

  const VERSION='4.5.2';
  const FIELDS=new Set([
    'objectSource','objectSourceOther','listingUrl','inspectionPurpose','inspectionParticipants','inspectionResult',
    'decision','decisionReason','tech.powerKw','tech.requiredPowerKw',
    'inspectionBy','floorLocation','premiseCondition','premiseAvailability','landlordReadiness','availableFrom','nextActionDate','nextAction',
  ]);
  const snapshots=new Map();
  const timers=new Map();
  const queues=new Map();

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
})();
