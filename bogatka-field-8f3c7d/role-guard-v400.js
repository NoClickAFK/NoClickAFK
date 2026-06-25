(function(){
  if(window.__bogatkaRoleGuardV400)return;
  window.__bogatkaRoleGuardV400=true;
  const selectors=['#addLocationBtn','#importBtn','#clearAllBtn','#saveLocationBtn','#deleteLocationBtn','[data-location-card] input','[data-location-card] textarea','[data-location-card] select','[data-action="edit-location"]','[data-action="save-gps"]','[data-action="clear-location"]','[data-action="restore-location"]','[data-action="archive-location"]','.photo-add','[data-archive-restore]','[data-archive-delete]'];
  function apply(){
    const viewer=typeof cloudRole!=='undefined'&&cloudRole==='viewer';
    document.querySelectorAll(selectors.join(',')).forEach(element=>{
      if(viewer){
        if(!element.disabled&&element.getAttribute('aria-disabled')!=='true')element.dataset.viewerDisabled='1';
        element.disabled=true;
        element.setAttribute('aria-disabled','true');
        element.classList.add('viewer-locked-v400');
      }else if(element.dataset.viewerDisabled==='1'){
        element.disabled=false;
        element.removeAttribute('aria-disabled');
        element.classList.remove('viewer-locked-v400');
        delete element.dataset.viewerDisabled;
      }
    });
    document.body.classList.toggle('viewer-mode-v400',viewer);
  }
  apply();
  let timer=null;
  new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(apply,60)}).observe(document.body,{childList:true,subtree:true});
  setInterval(apply,1500);
})();
