(function(){
  'use strict';
  if(window.BogatkaSuiteSaveOrderV452?.ready)return;

  const VERSION='4.5.8';
  let attempts=0;
  let finalizeTimer=null;
  let finalizing=null;

  function preserveStatusWrapperMarker(){
    let current=window.updateSummary;
    if(typeof current!=='function'){
      try{current=updateSummary}catch(_){current=null}
    }
    if(typeof current!=='function')return false;
    current.__statusNextTaskV447=true;
    return true;
  }

  async function finalizeWorkflowUi(){
    if(finalizing)return finalizing;
    finalizing=(async()=>{
      preserveStatusWrapperMarker();
      await window.BogatkaStatusNextTaskV447?.enhanceAll?.();
      window.BogatkaWorkflowRefineV440?.enhanceAll?.();
      await window.BogatkaWorkflowIntegrityV457?.refreshNextTaskPanels?.();
      preserveStatusWrapperMarker();
      document.documentElement.dataset.workflowUiFinalizedV458='1';
      return true;
    })().finally(()=>{finalizing=null;});
    return finalizing;
  }

  function scheduleFinalize(delay=30){
    clearTimeout(finalizeTimer);
    finalizeTimer=setTimeout(()=>finalizeWorkflowUi().catch(console.error),delay);
  }

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
    preserveStatusWrapperMarker();
    const suite=window.BogatkaSuite;
    const original=suite?.addTask;
    if(!suite||typeof original!=='function'){
      if(attempts<160)setTimeout(install,80);
      return false;
    }
    if(!original.__suiteSaveOrderV452){
      const ordered=async function(locationId,task){
        await waitForFormSaves();
        const result=await original.call(suite,locationId,task);
        await finalizeWorkflowUi();
        return result;
      };
      ordered.__suiteSaveOrderV452=true;
      ordered.__base=original;
      suite.addTask=ordered;
    }
    scheduleFinalize(0);
    return true;
  }

  function observeRenders(){
    const root=document.getElementById('locations')||document.body;
    new MutationObserver(records=>{
      if(records.some(record=>record.addedNodes.length||record.removedNodes.length))scheduleFinalize(45);
    }).observe(root,{childList:true,subtree:true});
  }

  function boot(){
    install();
    observeRenders();
    [80,250,700,1500,3000,6000,12000,22000].forEach(delay=>setTimeout(()=>{preserveStatusWrapperMarker();install();scheduleFinalize(0);},delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  window.BogatkaSuiteSaveOrderV452={version:VERSION,ready:true,waitForFormSaves,install,preserveStatusWrapperMarker,finalizeWorkflowUi,scheduleFinalize};
})();