(function(){
  'use strict';
  if(window.BogatkaQuickChecklistStabilityV451?.ready)return;

  const VERSION='4.5.1';
  let attempts=0;
  let timer=null;

  function installIdempotentSelectSync(){
    const current=window.bogatkaSyncPremiumSelect;
    if(typeof current!=='function')return false;
    if(current.__quickChecklistIdempotentV451)return true;
    const wrapped=function(select,trigger){
      if(!select||!trigger)return;
      const selected=select.selectedOptions?.[0]||select.options?.[select.selectedIndex]||select.options?.[0];
      const nextText=selected?.textContent||'Выберите';
      const valueNode=trigger.querySelector('.premium-select-value');
      if(valueNode&&valueNode.textContent!==nextText)valueNode.textContent=nextText;
      if(trigger.disabled!==select.disabled)trigger.disabled=select.disabled;
    };
    wrapped.__quickChecklistIdempotentV451=true;
    wrapped.__base=current;
    window.bogatkaSyncPremiumSelect=wrapped;
    try{bogatkaSyncPremiumSelect=wrapped}catch(_){ }
    return true;
  }

  function stabilizeBadge(badge){
    if(!badge||badge.dataset.idempotentTextV451==='1')return;
    let current=badge.textContent||'';
    try{
      Object.defineProperty(badge,'textContent',{
        configurable:true,
        get(){return current},
        set(value){
          const next=String(value??'');
          if(next===current)return;
          current=next;
          badge.replaceChildren(document.createTextNode(next));
        },
      });
      badge.dataset.idempotentTextV451='1';
    }catch(_){
      badge.dataset.idempotentTextV451='unsupported';
    }
  }

  function alignProfiles(root=document){
    const api=window.BogatkaLocationGlobalV421;
    if(!api?.alignPairedCaptions)return false;
    root.querySelectorAll?.('[data-location-card]').forEach(card=>{
      api.syncPairState?.(card);
      api.alignPairedCaptions(card);
    });
    if(root.matches?.('[data-location-card]')){
      api.syncPairState?.(root);
      api.alignPairedCaptions(root);
    }
    return true;
  }

  function stabilizeAll(){
    attempts+=1;
    const selectReady=installIdempotentSelectSync();
    document.querySelectorAll('.check-group-progress-v451').forEach(stabilizeBadge);
    alignProfiles(document);
    if(attempts<120&&(!window.BogatkaQuickChecklistV451?.ready||!selectReady))setTimeout(stabilizeAll,100);
  }

  function schedule(delay=50){
    clearTimeout(timer);
    timer=setTimeout(stabilizeAll,delay);
  }

  function install(){
    stabilizeAll();
    const root=document.getElementById('locations')||document.body;
    root.addEventListener('click',event=>{
      if(!event.target.closest('.panel-toggle-v419'))return;
      const card=event.target.closest('[data-location-card]');
      if(!card)return;
      alignProfiles(card);
      setTimeout(()=>alignProfiles(card),50);
    });
    new MutationObserver(()=>schedule(40)).observe(root,{childList:true,subtree:true});
    [120,400,900,1800,3500,5800,7300].forEach(delay=>setTimeout(stabilizeAll,delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('load',()=>setTimeout(stabilizeAll,30),{once:true});

  window.BogatkaQuickChecklistStabilityV451={
    version:VERSION,
    ready:true,
    stabilizeAll,
    installIdempotentSelectSync,
    alignProfiles,
  };
})();
