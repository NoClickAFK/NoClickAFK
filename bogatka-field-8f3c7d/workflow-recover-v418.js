(function(){
  if(window.BogatkaWorkflowRecoverV418?.ready)return;
  let observer=null;
  let pending=false;

  async function recover(){
    pending=false;
    if(document.querySelector('[data-location-card] .structured-notes-v414')){
      observer?.disconnect();
      observer=null;
      return true;
    }
    try{
      await window.BogatkaWorkflowV414?.enhanceAll?.();
    }catch(error){
      console.error(error);
    }
    const ready=Boolean(document.querySelector('[data-location-card] .structured-notes-v414'));
    if(ready){
      observer?.disconnect();
      observer=null;
    }
    return ready;
  }

  function schedule(delay=60){
    if(pending)return;
    pending=true;
    setTimeout(recover,delay);
  }

  function install(){
    const root=document.getElementById('locations')||document.body;
    observer=new MutationObserver(()=>schedule(80));
    observer.observe(root,{childList:true,subtree:true});
    schedule(0);
    setTimeout(recover,250);
    setTimeout(recover,800);
    setTimeout(recover,1800);
    setTimeout(recover,3500);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();

  window.BogatkaWorkflowRecoverV418={version:'4.1.8',ready:true,recover,schedule};
})();
