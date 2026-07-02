(function(){
  'use strict';
  if(window.BogatkaTrafficCompetitorsCompatV453?.ready)return;
  let timer=null;

  function isStage7Details(details){
    const title=details?.querySelector(':scope > summary')?.textContent||'';
    return /Полевой замер трафика|Конкуренты и окружение/.test(title);
  }

  function revealAncestor(element){
    if(!element||element.nodeType!==Node.ELEMENT_NODE)return;
    if(element.tagName==='DETAILS')element.open=true;
    if(element.hidden)element.hidden=false;
    element.classList.remove('hidden','panel-closed-v419','collapsed','location-card-collapsed-v422','location-collapsed-v422');
    if(element.dataset?.panelOpenV419!==undefined)element.dataset.panelOpenV419='1';
    const panelToggle=element.querySelector?.(':scope > .panel-toggle-v419');
    if(panelToggle)panelToggle.setAttribute('aria-expanded','true');
  }

  function openAncestors(details){
    if(!details?.open||!isStage7Details(details))return;
    const card=details.closest('[data-location-card]');
    if(window.BogatkaLocationCardCollapseV422?.setCollapsed)window.BogatkaLocationCardCollapseV422.setCollapsed(card,false,{persist:true});
    for(let current=details;current&&current!==card;current=current.parentElement)revealAncestor(current);
    revealAncestor(card?.querySelector(':scope > .location-body'));
  }

  function apply(root=document){
    root.querySelectorAll?.('.competitor-card-v453[data-competitor-legacy="1"] [data-stage7-field="name"]').forEach(input=>{
      const caption=input.closest('label')?.querySelector(':scope > .profile-caption-v416,:scope > .evaluation-caption-v446');
      if(!caption)return;
      if(!caption.classList.contains('evaluation-caption-v446'))caption.classList.add('evaluation-caption-v446');
      if(caption.textContent!=='Ближайший прямой конкурент')caption.textContent='Ближайший прямой конкурент';
    });
    root.querySelectorAll?.('[data-location-card] details').forEach(openAncestors);
    root.querySelectorAll?.('[data-location-card]').forEach(card=>{
      const hydration=window.BogatkaLocationDataStabilityV452?.hydrateCard?.(card);
      hydration?.catch?.(console.error);
    });
  }

  document.addEventListener('toggle',event=>openAncestors(event.target),true);
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>apply(document),30);}
  const root=document.getElementById('locations')||document.body;
  new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
  [0,100,300,700,1500,3000].forEach(delay=>setTimeout(schedule,delay));

  window.BogatkaTrafficCompetitorsCompatV453={version:'4.5.3',ready:true,apply,openAncestors,isStage7Details,revealAncestor};
})();
