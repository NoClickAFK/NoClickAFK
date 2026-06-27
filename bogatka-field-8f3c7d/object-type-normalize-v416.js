(function(){
  if(window.BogatkaObjectTypeNormalizeV416?.ready)return;
  const running=new Set();
  const pendingEmptyResets=new Set();
  let timer=null;

  function normalize(value){
    const shared=window.BogatkaSyncFieldCompatV416?.normalizeObjectType;
    if(typeof shared==='function')return shared(value);
    const text=String(value??'').trim();
    return ['Магазин с отдельным входом с улицы','Стрит ритейл','Street retail','street retail','street-retail'].includes(text)?'Стрит-ритейл':text;
  }

  function polishProfileInputs(){
    document.querySelectorAll('input[data-location][data-field="rent"]').forEach(input=>input.placeholder='Например: 1200');
    document.querySelectorAll('input[data-location][data-field="contact"]').forEach(input=>input.placeholder='Имя и должность');
  }

  function syncVisible(select){
    if(window.BogatkaSelectSync?.syncVisibleSelect)window.BogatkaSelectSync.syncVisibleSelect(select);
    else{
      const trigger=select.nextElementSibling;
      if(trigger?.classList.contains('premium-select-trigger')&&typeof bogatkaSyncPremiumSelect==='function'){
        bogatkaSyncPremiumSelect(select,trigger);
        trigger.dataset.syncedValue=select.value;
      }
    }
  }

  function previousVisibleValue(select){
    const trigger=select.nextElementSibling;
    return select.dataset.objectTypeLastValueV421||trigger?.dataset?.syncedValue||'';
  }

  async function persistIntentionalEmpty(select,revision){
    const id=select.dataset.location;
    try{
      if(typeof saveField==='function')await saveField(select);
      else if(typeof getLocationData==='function'&&typeof idbPut==='function'&&typeof STORE!=='undefined'){
        const data=await getLocationData(id);
        data.objectType='';
        data.updatedAt=new Date().toISOString();
        await idbPut(STORE,data,'location:'+id);
      }
      select.dataset.objectTypeLastValueV421='';
    }catch(error){
      if(typeof showError==='function')showError(error);
      else console.error(error);
    }finally{
      setTimeout(()=>{
        if(select.dataset.objectTypeResetRevisionV421!==String(revision))return;
        pendingEmptyResets.delete(id);
        delete select.dataset.objectTypeResetPendingV421;
        delete select.dataset.profileDirtyV416;
        schedule();
      },450);
    }
  }

  function handleObjectTypeChange(select){
    const id=select?.dataset.location;
    if(!id)return;
    const previous=previousVisibleValue(select);
    const revision=Number(select.dataset.objectTypeResetRevisionV421||0)+1;
    select.dataset.objectTypeResetRevisionV421=String(revision);
    if(select.value!==''){
      select.dataset.objectTypeLastValueV421=select.value;
      pendingEmptyResets.delete(id);
      delete select.dataset.objectTypeResetPendingV421;
      return;
    }
    if(!previous)return;
    pendingEmptyResets.add(id);
    select.dataset.objectTypeResetPendingV421='1';
    select.dataset.profileDirtyV416='1';
    syncVisible(select);
    Promise.resolve().then(()=>persistIntentionalEmpty(select,revision));
  }

  async function repair(){
    polishProfileInputs();
    if(typeof getLocationData!=='function'||typeof idbPut!=='function'||typeof STORE==='undefined')return;
    for(const select of document.querySelectorAll('select[data-location][data-field="objectType"]')){
      const id=select.dataset.location;
      if(!id||running.has(id)||pendingEmptyResets.has(id)||select.dataset.objectTypeResetPendingV421==='1'||document.activeElement===select||select.dataset.profileDirtyV416==='1')continue;
      running.add(id);
      try{
        const data=await getLocationData(id);
        const stored=data.objectType;
        const canonical=normalize(stored);
        const repaired=Boolean(stored&&canonical&&stored!==canonical);
        if(repaired){
          data.objectType=canonical;
          data.updatedAt=new Date().toISOString();
          await idbPut(STORE,data,'location:'+id);
        }

        const current=select.value;
        const currentIsEmpty=!current;
        const currentIsLegacy=current===stored&&repaired;
        if(canonical&&(currentIsEmpty||currentIsLegacy)){
          select.value=canonical;
          select.dataset.objectTypeLastValueV421=canonical;
          syncVisible(select);
          select.dispatchEvent(new CustomEvent('bogatka:object-type-restored',{bubbles:true,detail:{value:canonical}}));
        }else if(canonical){
          select.dataset.objectTypeLastValueV421=canonical;
        }else if(!stored){
          select.dataset.objectTypeLastValueV421='';
        }
      }catch(error){console.warn('Не удалось нормализовать тип объекта',error)}
      finally{running.delete(id)}
    }
  }

  function schedule(){
    clearTimeout(timer);
    timer=setTimeout(()=>repair().catch(console.error),60);
  }

  function install(){
    const root=document.getElementById('locations')||document.body;
    root.addEventListener('change',event=>{
      const select=event.target?.closest?.('select[data-location][data-field="objectType"]');
      if(select&&root.contains(select))handleObjectTypeChange(select);
    },true);
    schedule();
    new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  window.BogatkaObjectTypeNormalizeV416={version:'4.2.1',ready:true,normalize,repair,polishProfileInputs,handleObjectTypeChange};
})();
