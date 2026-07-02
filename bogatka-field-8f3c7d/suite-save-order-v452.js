(function(){
  'use strict';
  if(window.BogatkaSuiteSaveOrderV452?.ready)return;

  const VERSION='4.5.2';
  let attempts=0;

  async function waitForFormSaves(timeoutMs=5000){
    const started=Date.now();
    while(Date.now()-started<timeoutMs){
      const active=[...document.querySelectorAll('[data-location][data-field]')].some(control=>control._saveTimer||control._overviewSaveTimerV417||control._locationDataSaveTimerV452);
      const queued=(window.BogatkaFieldIntegrityV416?.pendingLocations||[]).length>0;
      if(!active&&!queued)break;
      await new Promise(resolve=>setTimeout(resolve,25));
    }
    await window.BogatkaDurableFieldsV452?.flush?.();
  }

  function install(){
    attempts+=1;
    const suite=window.BogatkaSuite;
    const original=suite?.addTask;
    if(!suite||typeof original!=='function'){
      if(attempts<160)setTimeout(install,80);
      return false;
    }
    if(original.__suiteSaveOrderV452)return true;
    const ordered=async function(locationId,task){
      await waitForFormSaves();
      const result=await original.call(suite,locationId,task);
      await window.BogatkaStatusNextTaskV447?.enhanceAll?.();
      return result;
    };
    ordered.__suiteSaveOrderV452=true;
    ordered.__base=original;
    suite.addTask=ordered;
    return true;
  }

  install();
  [250,700,1500,3000].forEach(delay=>setTimeout(install,delay));

  window.BogatkaSuiteSaveOrderV452={version:VERSION,ready:true,waitForFormSaves,install};
})();
