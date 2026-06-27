(function(){
  if(window.BogatkaLocationOverviewInitV417?.ready)return;
  let scheduled=false;

  async function run(){
    scheduled=false;
    try{
      await window.BogatkaLocationOverviewV417?.enhanceAll?.();
    }catch(error){
      console.error(error);
    }
  }

  function schedule(delay=40){
    if(scheduled)return;
    scheduled=true;
    setTimeout(run,delay);
  }

  function install(){
    const root=document.getElementById('locations')||document.body;
    new MutationObserver(()=>schedule(80)).observe(root,{childList:true,subtree:true});
    run();
    setTimeout(run,180);
    setTimeout(run,700);
    setTimeout(run,1600);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();

  window.BogatkaLocationOverviewInitV417={version:'4.1.7',ready:true,run,schedule};
})();
