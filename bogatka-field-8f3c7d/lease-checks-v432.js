(function(){
  'use strict';
  if(window.__bogatkaLeaseChecksV432)return;
  window.__bogatkaLeaseChecksV432=true;
  const deal=window.BogatkaCriticalDeal;
  if(!deal)return;
  const baseIsCompleted=deal.isCompleted.bind(deal);
  deal.isCompleted=function(value,keyOrDefinition){
    if(keyOrDefinition)return baseIsCompleted(value,keyOrDefinition);
    const status=value?.status==='not_applicable'?'unchecked':value?.status||'unchecked';
    const evidenceType=value?.evidenceType==='oral_promise'?'oral_agreement':value?.evidenceType||'not_confirmed';
    const note=String(value?.note??'').trim();
    if(['unchecked','in_progress'].includes(status))return false;
    if(status==='confirmed'&&(evidenceType==='not_confirmed'||deal.isOralEvidence(evidenceType)))return false;
    if(['needs_formalization','blocked'].includes(status)&&!note)return false;
    if(evidenceType==='other'&&!note)return false;
    return true;
  };
  if(window.BogatkaDecisionEngine)window.BogatkaDecisionEngine.VERSION='4.3.2';
})();
