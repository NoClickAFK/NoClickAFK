(function(){
  'use strict';
  if(window.BogatkaTrafficCompetitorsCompatV453?.ready)return;
  let timer=null;

  function openAncestors(details){
    if(!details?.open)return;
    let parent=details.parentElement?.closest('details');
    while(parent){if(!parent.open)parent.open=true;parent=parent.parentElement?.closest('details');}
    const card=details.closest('[data-location-card]');
    card?.classList.remove('location-collapsed-v422','collapsed');
    const body=card?.querySelector(':scope > .location-body');
    if(body?.hidden)body.hidden=false;
  }

  function apply(root=document){
    root.querySelectorAll?.('.competitor-card-v453[data-competitor-legacy="1"] [data-stage7-field="name"]').forEach(input=>{
      const caption=input.closest('label')?.querySelector(':scope > .profile-caption-v416,:scope > .evaluation-caption-v446');
      if(!caption)return;
      if(!caption.classList.contains('evaluation-caption-v446'))caption.classList.add('evaluation-caption-v446');
      if(caption.textContent!=='Ближайший прямой конкурент')caption.textContent='Ближайший прямой конкурент';
    });
    root.querySelectorAll?.('[data-location-card] details').forEach(details=>{
      const title=details.querySelector(':scope > summary')?.textContent||'';
      if(!/Полевой замер трафика|Конкуренты и окружение/.test(title)||details.dataset.stage7CompatBound==='1')return;
      details.dataset.stage7CompatBound='1';
      details.addEventListener('toggle',()=>openAncestors(details));
      openAncestors(details);
    });
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(()=>apply(document),30);}
  const root=document.getElementById('locations')||document.body;
  new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
  [0,100,300,700,1500,3000].forEach(delay=>setTimeout(schedule,delay));

  window.BogatkaTrafficCompetitorsCompatV453={version:'4.5.3',ready:true,apply,openAncestors};
})();
