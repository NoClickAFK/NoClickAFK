(function(){
  'use strict';
  if(window.BogatkaObjectTypeResetStabilityV453?.ready)return;
  const queues=new Map();

  function enqueue(locationId,task){
    const previous=queues.get(locationId)||Promise.resolve();
    const current=previous.catch(()=>{}).then(task);
    queues.set(locationId,current);
    return current.finally(()=>{if(queues.get(locationId)===current)queues.delete(locationId);});
  }

  function syncVisible(select){
    if(window.BogatkaSelectSync?.syncVisibleSelect)window.BogatkaSelectSync.syncVisibleSelect(select);
    else if(typeof window.bogatkaSyncPremiumSelect==='function')window.bogatkaSyncPremiumSelect(select,select.nextElementSibling);
    const id=select.dataset.location;
    const other=document.querySelector(`[data-object-other="${CSS.escape(id)}"]`);
    if(other){other.hidden=true;other.classList.add('hidden');}
  }

  function handle(event){
    const select=event.target?.closest?.('select[data-location][data-field="objectType"]');
    if(!select||select.value!==''||!document.getElementById('locations')?.contains(select))return;
    event.stopImmediatePropagation();
    event.stopPropagation();
    const locationId=select.dataset.location;
    const revision=Number(select.dataset.objectTypeResetRevisionV421||0)+1;
    select.dataset.objectTypeResetRevisionV421=String(revision);
    select.dataset.objectTypeLastValueV421='';
    select.dataset.objectTypeResetPendingV421='1';
    select.dataset.profileDirtyV416='1';
    syncVisible(select);
    window.showSaving?.();
    enqueue(locationId,async()=>{
      const data=await getLocationData(locationId);
      data.objectType='';
      data.updatedAt=new Date().toISOString();
      await idbPut(STORE,data,`location:${locationId}`);
      select.value='';
      select.dataset.objectTypeLastValueV421='';
      syncVisible(select);
      window.updateLocationTotal?.(locationId,data);
      await window.updateSummary?.();
      select.value='';
      syncVisible(select);
      delete select.dataset.objectTypeResetPendingV421;
      delete select.dataset.profileDirtyV416;
      window.showSaved?.();
    }).catch(error=>window.showError?.(error)||console.error(error));
  }

  document.addEventListener('change',handle,true);
  window.BogatkaObjectTypeResetStabilityV453={version:'4.5.3',ready:true,syncVisible,get pendingWrites(){return queues.size;}};
})();
