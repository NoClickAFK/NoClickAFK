(function(){
  if(window.BogatkaLocationCardCollapseV422?.ready)return;
  const VERSION='4.2.2';
  const STORAGE_PREFIX='bogatka.location.collapsed.v422.';
  let timer=null;
  let renderHookAttempts=0;

  const key=id=>`${STORAGE_PREFIX}${id}`;
  const read=id=>{try{return localStorage.getItem(key(id))==='1'}catch(_){return false}};
  const write=(id,value)=>{try{localStorage.setItem(key(id),value?'1':'0')}catch(_){}};

  function isEditing(){
    if(window.BogatkaUIStability?.isEditing?.())return true;
    const active=document.activeElement;
    const root=document.getElementById('locations');
    return Boolean(active&&root?.contains(active)&&active.matches?.('input,textarea,select,[contenteditable="true"]'));
  }

  function attr(element,name,value){
    if(element.getAttribute(name)!==value)element.setAttribute(name,value);
  }

  function setCollapsed(card,collapsed,{persist=false}={}){
    const id=card?.dataset.locationCard;
    const body=card?.querySelector(':scope > .location-body');
    const button=card?.querySelector(':scope > .location-head .location-collapse-toggle-v422');
    if(!id||!body||!button)return false;
    if(card.classList.contains('location-card-collapsed-v422')!==collapsed)card.classList.toggle('location-card-collapsed-v422',collapsed);
    if(body.hidden!==collapsed)body.hidden=collapsed;
    attr(body,'aria-hidden',String(collapsed));
    attr(button,'aria-expanded',String(!collapsed));
    attr(button,'aria-label',collapsed?'Развернуть локацию':'Свернуть локацию');
    button.title=collapsed?'Развернуть локацию':'Свернуть локацию';
    if(persist)write(id,collapsed);
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
      setCollapsed(card,!card.classList.contains('location-card-collapsed-v422'),{persist:true});
    });
    side.appendChild(button);
    return button;
  }

  function ensureHeaderSide(card){
    const head=card.querySelector(':scope > .location-head');
    const score=head?.querySelector('.scorebox');
    if(!head||!score)return null;
    let side=head.querySelector(':scope > .location-head-side-v422');
    if(!side){
      side=document.createElement('div');
      side.className='location-head-side-v422';
      head.appendChild(side);
    }
    if(score.parentElement!==side)side.appendChild(score);
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
    if(!button)return false;
    attr(button,'aria-controls',body.id);
    setCollapsed(card,read(id));
    card.dataset.locationCollapseV422='1';
    return true;
  }

  function enhanceAll({force=false}={}){
    if(!force&&isEditing()){
      schedule(400);
      return false;
    }
    document.querySelectorAll('[data-location-card]').forEach(enhanceCard);
    return true;
  }

  function schedule(delay=80){
    if(timer)return;
    timer=setTimeout(()=>{
      timer=null;
      try{enhanceAll()}catch(error){console.error(error)}
    },delay);
  }

  function afterRender(){
    for(const delay of [40,650])setTimeout(()=>{
      if(isEditing())schedule(400);
      else enhanceAll({force:true});
    },delay);
  }

  function installRenderHook(){
    renderHookAttempts+=1;
    const current=window.renderLocations;
    if(typeof current!=='function'){
      if(renderHookAttempts<100)setTimeout(installRenderHook,100);
      return false;
    }
    if(current.__locationCardCollapseV422)return true;
    const wrapped=function(...args){
      const result=current.apply(this,args);
      afterRender();
      return result;
    };
    wrapped.__locationCardCollapseV422=true;
    wrapped.__base=current;
    window.renderLocations=wrapped;
    try{renderLocations=wrapped}catch(_){}
    return true;
  }

  function install(){
    const root=document.getElementById('locations')||document.body;
    new MutationObserver(()=>schedule(80)).observe(root,{childList:true});
    installRenderHook();
    schedule(10);
    setTimeout(()=>{if(!isEditing())enhanceAll({force:true})},450);
    setTimeout(()=>{if(!isEditing())enhanceAll({force:true})},1400);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();

  window.BogatkaLocationCardCollapseV422={
    version:VERSION,ready:true,enhanceAll,setCollapsed,installRenderHook,
    audit(){
      const failures=[];
      for(const card of document.querySelectorAll('[data-location-card]')){
        const id=card.dataset.locationCard;
        const body=card.querySelector(':scope > .location-body');
        const side=card.querySelector(':scope > .location-head > .location-head-side-v422');
        if(!body)failures.push(`${id}:body:missing`);
        if(!side)failures.push(`${id}:side:missing`);
        if(!side?.querySelector(':scope > .scorebox'))failures.push(`${id}:scorebox:missing`);
        if(!side?.querySelector(':scope > .location-collapse-toggle-v422'))failures.push(`${id}:toggle:missing`);
      }
      return {ok:failures.length===0,failures};
    },
  };
})();
