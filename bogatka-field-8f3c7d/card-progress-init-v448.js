(function(){
  'use strict';
  if(window.BogatkaCardProgressInitV448?.ready)return;

  const VERSION='4.4.8';
  let skippedBootstrapRefresh=false;
  let attempts=0;

  function installBootstrapGate(){
    if(window.__bogatkaCardProgressBootstrapGateV448)return true;
    if(typeof window.updateSummary!=='function'&&typeof updateSummary!=='function')return false;
    const base=window.updateSummary||updateSummary;
    const gated=async function(...args){
      if(!skippedBootstrapRefresh){
        skippedBootstrapRefresh=true;
        return null;
      }
      return base(...args);
    };
    gated.__cardProgressBootstrapGateV448=true;
    gated.__base=base;
    window.__bogatkaCardProgressBootstrapGateV448=true;
    window.updateSummary=gated;
    try{updateSummary=gated}catch(_){ }
    return true;
  }

  async function settleInitialMetrics(){
    attempts+=1;
    const api=window.BogatkaCardProgressV448;
    const metrics=window.BogatkaDecisionUI?.lastMetrics;
    if(!api?.ready||!Array.isArray(metrics)||!metrics.length){
      if(attempts<160)setTimeout(settleInitialMetrics,80);
      return;
    }
    api.transformMetrics(metrics);
    await api.renderAll();
    api.initialized=true;
    window.dispatchEvent(new CustomEvent('bogatka:card-progress-ready',{detail:{version:VERSION}}));
  }

  function install(){
    if(!installBootstrapGate()){
      setTimeout(install,50);
      return;
    }
    setTimeout(settleInitialMetrics,0);
  }

  install();
  window.BogatkaCardProgressInitV448={
    version:VERSION,
    ready:true,
    get skippedBootstrapRefresh(){return skippedBootstrapRefresh},
  };
})();
