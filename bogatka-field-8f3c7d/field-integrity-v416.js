(function(){
  if(window.BogatkaFieldIntegrityV416?.ready)return;

  const VERSION='4.1.6';
  const FRIENDLY_STREET='Магазин с отдельным входом с улицы';
  const queues=new Map();
  let observer=null;
  let timer=null;

  function installSaveQueue(){
    if(typeof saveField!=='function')return false;
    if(saveField.__fieldIntegrityV416)return true;
    const base=saveField;
    const queued=async function(element){
      const locationId=element?.dataset?.location||'__global__';
      const previous=queues.get(locationId)||Promise.resolve();
      const current=previous.catch(()=>{}).then(()=>base(element));
      queues.set(locationId,current);
      try{return await current}
      finally{if(queues.get(locationId)===current)queues.delete(locationId)}
    };
    queued.__fieldIntegrityV416=true;
    queued.__base=base;
    saveField=queued;
    window.saveField=queued;
    return true;
  }

  function stabilizeObjectTypeOptions(root=document){
    root.querySelectorAll?.('select[data-field="objectType"]').forEach(select=>{
      const street=[...select.options].find(option=>{
        const text=option.textContent.trim();
        return option.value==='Стрит-ритейл'||text==='Стрит-ритейл'||text===FRIENDLY_STREET;
      });
      if(!street)return;
      let changed=false;
      if(street.value!=='Стрит-ритейл'){street.value='Стрит-ритейл';changed=true}
      if(street.textContent!==FRIENDLY_STREET){street.textContent=FRIENDLY_STREET;changed=true}
      const trigger=select.nextElementSibling;
      const triggerLabel=trigger?.querySelector?.('.premium-select-value');
      const selectedText=select.selectedOptions?.[0]?.textContent||'';
      const needsVisibleSync=trigger?.classList.contains('premium-select-trigger')&&(
        changed||trigger.dataset.syncedValue!==select.value||triggerLabel?.textContent!==selectedText
      );
      if(needsVisibleSync&&typeof bogatkaSyncPremiumSelect==='function')bogatkaSyncPremiumSelect(select,trigger);
    });
  }

  function run(){
    installSaveQueue();
    stabilizeObjectTypeOptions();
  }

  function schedule(){
    clearTimeout(timer);
    timer=setTimeout(run,0);
  }

  function install(){
    run();
    const root=document.getElementById('locations')||document.body;
    if(!observer){
      observer=new MutationObserver(schedule);
      observer.observe(root,{childList:true,subtree:true});
    }
    let attempts=0;
    const retry=setInterval(()=>{
      attempts+=1;
      run();
      if(saveField?.__fieldIntegrityV416||attempts>=80)clearInterval(retry);
    },100);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();

  window.BogatkaFieldIntegrityV416={
    version:VERSION,
    ready:true,
    installSaveQueue,
    stabilizeObjectTypeOptions,
    get pendingLocations(){return [...queues.keys()]},
    principle:'one-location-one-ordered-save-queue',
  };
})();
