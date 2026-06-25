(function(){
  if(window.__bogatkaArchiveLabelV400)return;
  window.__bogatkaArchiveLabelV400=true;
  function canEdit(){return typeof cloudRole==='undefined'||cloudRole!=='viewer'}
  function apply(){
    const button=document.getElementById('deleteLocationBtn');
    if(button){button.textContent='В архив';button.classList.remove('danger');button.classList.add('warning')}
    document.querySelectorAll('[data-archive-delete]').forEach(action=>{
      const item=locations.find(location=>location.id===action.dataset.archiveDelete);
      action.classList.toggle('hidden',!item?.custom);
    });
    const viewer=!canEdit();
    document.querySelectorAll('#addLocationBtn,#importBtn,#clearAllBtn,#saveLocationBtn,#deleteLocationBtn,[data-location-card] input,[data-location-card] textarea,[data-location-card] select,[data-action="edit-location"],[data-action="save-gps"],[data-action="clear-location"],[data-action="restore-location"],[data-action="archive-location"],[data-archive-restore],[data-archive-delete]').forEach(element=>{
      if(viewer){if(!element.disabled)element.dataset.viewerDisabled='1';element.disabled=true;element.setAttribute('aria-disabled','true')}
      else if(element.dataset.viewerDisabled==='1'){element.disabled=false;element.removeAttribute('aria-disabled');delete element.dataset.viewerDisabled}
    });
    document.body.classList.toggle('viewer-mode-v400',viewer);
    const label=document.getElementById('versionLabel');if(label)label.textContent='4.0.0';
  }
  apply();
  let timer=null;
  new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(apply,60)}).observe(document.body,{childList:true,subtree:true});
  setInterval(apply,1500);
})();
