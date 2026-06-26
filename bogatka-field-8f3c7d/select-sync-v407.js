(function(){
  if(window.__bogatkaSelectSyncV407)return;
  window.__bogatkaSelectSyncV407=true;

  function visibleTrigger(select){
    const trigger=select?.nextElementSibling;
    return trigger?.classList?.contains('premium-select-trigger')?trigger:null;
  }

  function syncVisibleSelect(select){
    if(!(select instanceof HTMLSelectElement))return false;
    const trigger=visibleTrigger(select);
    if(!trigger)return false;
    if(typeof bogatkaSyncPremiumSelect==='function')bogatkaSyncPremiumSelect(select,trigger);
    else{
      const selected=select.selectedOptions?.[0]||select.options[select.selectedIndex]||select.options[0];
      const label=trigger.querySelector('.premium-select-value');
      if(label)label.textContent=selected?.textContent||'Выберите';
      trigger.disabled=select.disabled;
    }
    trigger.dataset.syncedValue=select.value;
    return true;
  }

  function syncLocationSelects(locationId){
    const selector=`select[data-location="${CSS.escape(locationId)}"][data-field]`;
    document.querySelectorAll(selector).forEach(syncVisibleSelect);
  }

  if(typeof bogatkaRefreshLocationFields==='function'){
    const baseRefreshLocationFields=bogatkaRefreshLocationFields;
    bogatkaRefreshLocationFields=async function refreshLocationFieldsWithVisibleSelects(locationId){
      const result=await baseRefreshLocationFields(locationId);
      syncLocationSelects(locationId);
      return result;
    };
    window.bogatkaRefreshLocationFields=bogatkaRefreshLocationFields;
  }

  if(typeof restoreAllForms==='function'){
    const baseRestoreAllForms=restoreAllForms;
    restoreAllForms=async function restoreAllFormsWithVisibleSelects(...args){
      const result=await baseRestoreAllForms(...args);
      document.querySelectorAll('select[data-location][data-field]').forEach(syncVisibleSelect);
      return result;
    };
    window.restoreAllForms=restoreAllForms;
  }

  document.addEventListener('change',event=>{
    const select=event.target instanceof HTMLSelectElement?event.target:null;
    if(!select)return;
    if(!select.matches('[data-location][data-field],[data-stop-location][data-stop-key]'))return;
    syncVisibleSelect(select);
    setTimeout(()=>{
      if(!window.BogatkaCloudStability?.hasPendingLocalChanges?.())return;
      window.BogatkaCloudStability.queueAutomaticSync?.(250);
    },500);
  },false);

  window.BogatkaSelectSync={
    version:'4.0.7',
    syncVisibleSelect,
    syncLocationSelects,
    principle:'hidden-select-and-visible-trigger-always-share-one-value',
  };
})();
