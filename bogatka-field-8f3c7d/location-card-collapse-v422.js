(function(){
  if(window.BogatkaLocationCardCollapseV422?.ready)return;

  const VERSION='4.2.2';
  const STORAGE_PREFIX='bogatka.location.collapsed.v422.';
  let timer=null;

  function storageKey(id){
    return `${STORAGE_PREFIX}${id}`;
  }

  function readCollapsed(id){
    try{return localStorage.getItem(storageKey(id))==='1'}catch(_){return false}
  }

  function writeCollapsed(id,collapsed){
    try{localStorage.setItem(storageKey(id),collapsed?'1':'0')}catch(_){}
  }

  function setCollapsed(card,collapsed,{persist=false}={}){
    const id=card?.dataset.locationCard;
    const body=card?.querySelector(':scope > .location-body');
    const button=card?.querySelector(':scope > .location-head .location-collapse-toggle-v422');
    if(!id||!body||!button)return false;

    card.classList.toggle('location-card-collapsed-v422',collapsed);
    body.hidden=collapsed;
    body.setAttribute('aria-hidden',String(collapsed));
    button.setAttribute('aria-expanded',String(!collapsed));
    button.setAttribute('aria-label',collapsed?'Развернуть локацию':'Свернуть локацию');
    button.title=collapsed?'Развернуть локацию':'Свернуть локацию';
    if(persist)writeCollapsed(id,collapsed);
    return true;
  }

  function ensureButton(card,side){
    let button=side.querySelector(':scope > .location-collapse-toggle-v422');
    if(button)return button;
    button=document.createElement('button');
    button.type='button';
    button.className='location-collapse-toggle-v422';
    button.innerHTML='<span class="location-collapse-chevron-v422" aria-hidden="true"></span>';
    button.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      const collapsed=!card.classList.contains('location-card-collapsed-v422');
      setCollapsed(card,collapsed,{persist:true});
    });
    side.appendChild(button);
    return button;
  }

  function ensureHeaderSide(card){
    const head=card.querySelector(':scope > .location-head');
    const scorebox=head?.querySelector('.scorebox');
    if(!head||!scorebox)return null;

    let side=head.querySelector(':scope > .location-head-side-v422');
    if(!side){
      side=document.createElement('div');
      side.className='location-head-side-v422';
      head.appendChild(side);
    }

    if(scorebox.parentElement!==side)side.appendChild(scorebox);
    const decision=head.querySelector('.decision-head-v340');
    if(decision&&decision.parentElement!==side)side.appendChild(decision);
    ensureButton(card,side);
    return side;
  }

  function enhanceCard(card){
    const id=card.dataset.locationCard;
    const body=card.querySelector(':scope > .location-body');
    if(!id||!body)return false;
    if(!body.id)body.id=`location-body-${id.replace(/[^a-z0-9_-]/gi,'-')}`;
    const side=ensureHeaderSide(card);
    const button=side?.querySelector('.location-collapse-toggle-v422');
    if(!side||!button)return false;
    button.setAttribute('aria-controls',body.id);
    setCollapsed(card,readCollapsed(id));
    card.dataset.locationCollapseV422='1';
    return true;
  }

  function enhanceAll(){
    for(const card of document.querySelectorAll('[data-location-card]'))enhanceCard(card);
  }

  function schedule(delay=80){
    clearTimeout(timer);
    timer=setTimeout(()=>{
      try{enhanceAll()}catch(error){console.error(error)}
    },delay);
  }

  function install(){
    const root=document.getElementById('locations')||document.body;
    new MutationObserver(()=>schedule(100)).observe(root,{childList:true,subtree:true});
    schedule(10);
    setTimeout(()=>schedule(0),450);
    setTimeout(()=>schedule(0),1400);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();

  window.BogatkaLocationCardCollapseV422={
    version:VERSION,
    ready:true,
    enhanceAll,
    setCollapsed,
    audit(){
      const failures=[];
      for(const card of document.querySelectorAll('[data-location-card]')){
        const id=card.dataset.locationCard;
        const body=card.querySelector(':scope > .location-body');
        const side=card.querySelector(':scope > .location-head > .location-head-side-v422');
        const score=side?.querySelector(':scope > .scorebox');
        const decision=side?.querySelector(':scope > .decision-head-v340');
        const button=side?.querySelector(':scope > .location-collapse-toggle-v422');
        if(!body)failures.push(`${id}:body:missing`);
        if(!side)failures.push(`${id}:side:missing`);
        if(!score)failures.push(`${id}:scorebox:missing`);
        if(!decision)failures.push(`${id}:decision-metrics:missing`);
        if(!button)failures.push(`${id}:toggle:missing`);
      }
      return {ok:failures.length===0,failures};
    },
  };
})();
