(function(){
  if(window.BogatkaFieldIntegrityV416?.ready)return;
  const VERSION='4.1.6';
  const FRIENDLY_STREET='Магазин с отдельным входом с улицы';
  const queues=new Map();
  let observer=null;
  let timer=null;

  function enqueueLocation(locationId,task){
    const key=locationId||'__global__';
    const previous=queues.get(key)||Promise.resolve();
    const current=previous.catch(()=>{}).then(task);
    queues.set(key,current);
    return current.finally(()=>{if(queues.get(key)===current)queues.delete(key)});
  }

  function installSaveQueue(){
    if(typeof saveField!=='function')return false;
    if(saveField.__fieldIntegrityV416)return true;
    const base=saveField;
    const queued=async function(element){
      const locationId=element?.dataset?.location||'__global__';
      return enqueueLocation(locationId,()=>base(element));
    };
    queued.__fieldIntegrityV416=true;
    queued.__base=base;
    saveField=queued;
    window.saveField=queued;
    return true;
  }

  function syncVisible(select,trigger){
    if(window.BogatkaSelectSync?.syncVisibleSelect){
      window.BogatkaSelectSync.syncVisibleSelect(select);
    }else if(typeof bogatkaSyncPremiumSelect==='function'){
      bogatkaSyncPremiumSelect(select,trigger);
      trigger.dataset.syncedValue=select.value;
    }
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
      const label=trigger?.querySelector?.('.premium-select-value');
      const selectedText=select.selectedOptions?.[0]?.textContent||'';
      if(trigger?.classList.contains('premium-select-trigger')&&(changed||trigger.dataset.syncedValue!==select.value||label?.textContent!==selectedText))syncVisible(select,trigger);
    });
  }

  function run(){installSaveQueue();stabilizeObjectTypeOptions()}
  function schedule(){
    if(timer)return;
    timer=setTimeout(()=>{timer=null;run()},0);
  }
  function install(){
    run();
    const root=document.getElementById('locations')||document.body;
    if(!observer){observer=new MutationObserver(schedule);observer.observe(root,{childList:true,subtree:true})}
    let attempts=0;
    const retry=setInterval(()=>{attempts+=1;run();if(saveField?.__fieldIntegrityV416||attempts>=80)clearInterval(retry)},100);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.BogatkaFieldIntegrityV416={version:VERSION,ready:true,installSaveQueue,enqueueLocation,stabilizeObjectTypeOptions,get pendingLocations(){return [...queues.keys()]},principle:'one-location-one-ordered-save-queue'};
})();