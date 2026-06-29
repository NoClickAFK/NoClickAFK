(function(){
  if(window.__bogatkaViewerExtraV400)return;
  window.__bogatkaViewerExtraV400=true;
  const selector='[data-global],[data-location-card] button,.photo-add,.photo-delete,.photo-edit-switch input,.critical-deal-v430 select,.critical-deal-v430 textarea';
  function apply(){
    const viewer=typeof cloudRole!=='undefined'&&cloudRole==='viewer';
    document.querySelectorAll(selector).forEach(element=>{
      if(viewer){
        if(!element.disabled)element.dataset.viewerExtraDisabled='1';
        element.disabled=true;
        element.setAttribute('aria-disabled','true');
        element.classList.add('viewer-locked-v400');
      }else if(element.dataset.viewerExtraDisabled==='1'){
        element.disabled=false;
        element.removeAttribute('aria-disabled');
        element.classList.remove('viewer-locked-v400');
        delete element.dataset.viewerExtraDisabled;
      }
    });
  }
  apply();
  let timer=null;
  new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(apply,60)}).observe(document.body,{childList:true,subtree:true});
  setInterval(apply,1500);
})();
