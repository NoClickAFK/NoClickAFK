(function(){
  'use strict';
  if(window.BogatkaLocationDataStabilityV452?.ready)return;

  const VERSION='4.5.2';
  let attempts=0;
  let timer=null;
  let stablePasses=0;

  function ensureEngine(){
    const api=window.BogatkaLocationDataV452;
    const engine=window.BogatkaDecisionEngine;
    const current=engine?.computeAll;
    if(!api?.augmentMetric||typeof current!=='function')return false;
    if(current.__locationDataV452)return true;
    if(!current.__cardProgressV448)return false;
    const wrapped=async function(...args){
      const metrics=await current(...args);
      metrics.forEach(api.augmentMetric);
      return metrics;
    };
    Object.assign(wrapped,current);
    wrapped.__locationDataV452=true;
    wrapped.__cardProgressV448=true;
    wrapped.__base=current;
    engine.computeAll=wrapped;
    return true;
  }

  async function stabilize(){
    attempts+=1;
    const api=window.BogatkaLocationDataV452;
    if(api?.enhanceAll)await api.enhanceAll();
    const engineReady=ensureEngine();
    const audit=api?.audit?.();
    const ready=Boolean(engineReady&&audit?.ok);
    stablePasses=ready?stablePasses+1:0;
    if(attempts<160&&stablePasses<4)setTimeout(stabilize,120);
    return{ready,audit,engineReady,attempts,stablePasses};
  }

  function schedule(delay=60){
    clearTimeout(timer);
    timer=setTimeout(()=>stabilize().catch(console.error),delay);
  }

  function install(){
    const root=document.getElementById('locations')||document.body;
    new MutationObserver(()=>schedule(80)).observe(root,{childList:true,subtree:true});
    schedule(20);
    [300,900,1800,3500,6500,10000].forEach(delay=>setTimeout(()=>schedule(0),delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('load',()=>schedule(20),{once:true});

  window.BogatkaLocationDataStabilityV452={version:VERSION,ready:true,stabilize,ensureEngine,get attempts(){return attempts},get stablePasses(){return stablePasses}};
})();
