(function(){
  if(window.BogatkaLocationPanelsRenderV419?.ready)return;

  let installAttempts=0;
  let refreshRevision=0;

  async function refreshAfterRender(revision){
    if(revision!==refreshRevision)return false;
    try{
      await window.BogatkaLocationProfileV416?.enhanceAll?.();
      await window.BogatkaLocationOverviewV417?.enhanceAll?.();
      await window.BogatkaLocationPanelsV419?.enhanceAll?.({force:true});
      await window.BogatkaLocationGlobalV421?.enhanceAll?.({force:true});
      await window.BogatkaStatusNextTaskV447?.enhanceAll?.();
      await window.BogatkaTechnicalEconomicsV450?.enhanceAll?.();
      return true;
    }catch(error){
      console.error(error);
      return false;
    }
  }

  function scheduleRefresh(){
    const revision=++refreshRevision;
    setTimeout(()=>refreshAfterRender(revision),900);
    setTimeout(()=>refreshAfterRender(revision),1600);
  }

  function installRenderHook(){
    installAttempts+=1;
    const current=window.renderLocations;
    if(typeof current!=='function'){
      if(installAttempts<100)setTimeout(installRenderHook,100);
      return false;
    }
    if(current.__locationPanelsRenderV419)return true;

    const wrapped=function(...args){
      const result=current.apply(this,args);
      scheduleRefresh();
      return result;
    };
    wrapped.__locationPanelsRenderV419=true;
    wrapped.__base=current;
    window.renderLocations=wrapped;
    try{renderLocations=wrapped}catch(_){}
    return true;
  }

  installRenderHook();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installRenderHook,{once:true});
  window.addEventListener('load',installRenderHook,{once:true});

  window.BogatkaLocationPanelsRenderV419={
    version:'4.5.0',
    ready:true,
    installRenderHook,
    scheduleRefresh,
    refreshAfterRender,
  };
})();
