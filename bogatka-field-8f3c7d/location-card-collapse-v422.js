(function(){
  if(window.BogatkaLocationCardCollapseV422?.ready)return;

  const VERSION='4.2.2';
  const STORAGE_PREFIX='bogatka.location.collapsed.v422.';
  const sessionState=new Map();
  let renderHookAttempts=0;

  const key=id=>`${STORAGE_PREFIX}${id}`;
  const read=id=>{
    if(!sessionState.has(id))sessionState.set(id,true);
    return sessionState.get(id);
  };
  const write=(id,value)=>sessionState.set(id,Boolean(value));

  function forgetLegacyState(id){
    try{localStorage.removeItem(key(id))}catch(_){ }
  }

  function installMobileActionStyle(){
    if(document.getElementById('locationCardMobileActionsV464'))return;
    const style=document.createElement('style');
    style.id='locationCardMobileActionsV464';
    style.textContent=`
      @media(max-width:700px){
        html [data-location-card]>.location-head[data-location-header-grid-v422="1"]>.location-actions.location-header-actions-v422{
          grid-template-rows:auto auto!important;
          row-gap:14px!important;
          column-gap:10px!important;
        }
        html [data-location-card]>.location-head[data-location-header-grid-v422="1"] .location-action-buttons-v448{
          grid-template-columns:repeat(3,minmax(0,1fr))!important;
          gap:7px!important;
        }
        html [data-location-card]>.location-head[data-location-header-grid-v422="1"] .location-action-buttons-v448>*{
          width:100%!important;
          min-width:0!important;
          height:36px!important;
          min-height:36px!important;
          max-height:38px!important;
          padding:5px 4px!important;
          font-size:11px!important;
          line-height:1.15!important;
          white-space:normal!important;
          text-align:center!important;
          box-sizing:border-box!important;
        }
        html [data-location-card]>.location-head[data-location-header-grid-v422="1"] .card-recommendation-head-v448{
          grid-column:1!important;
          grid-row:2!important;
          justify-self:end!important;
          align-self:start!important;
          margin:0!important;
        }
      }
      @media(max-width:360px){
        html [data-location-card]>.location-head[data-location-header-grid-v422="1"] .location-action-buttons-v448{gap:6px!important}
        html [data-location-card]>.location-head[data-location-header-grid-v422="1"] .location-action-buttons-v448>*{padding:5px 3px!important;font-size:10.5px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function attr(element,name,value){
    if(element.getAttribute(name)!==value)element.setAttribute(name,value);
  }

  function setCollapsed(card,collapsed,{persist=false}={}){
    const id=card?.dataset.locationCard;
    const body=card?.querySelector(':scope > .location-body');
    const button=card?.querySelector(':scope > .location-head .location-collapse-toggle-v422');
    if(!id||!body||!button)return false;
    const next=Boolean(collapsed);
    if(card.classList.contains('location-card-collapsed-v422')!==next)card.classList.toggle('location-card-collapsed-v422',next);
    if(body.hidden!==next)body.hidden=next;
    attr(body,'aria-hidden',String(next));
    attr(button,'aria-expanded',String(!next));
    attr(button,'aria-label',next?'Развернуть локацию':'Свернуть локацию');
    button.title=next?'Развернуть локацию':'Свернуть локацию';
    if(persist)write(id,next);
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
    ensureButton(card,side);
    return side;
  }

  function ensureHeaderGrid(card,side){
    const head=card.querySelector(':scope > .location-head');
    const title=head?.querySelector(':scope > .location-title-wrap');
    const actions=title?.querySelector(':scope > .location-actions')||head?.querySelector(':scope > .location-actions');
    if(!head||!title||!actions||!side)return false;
    if(actions.parentElement!==head)head.insertBefore(actions,side);
    actions.classList.add('location-header-actions-v422');
    const recommendation=side.querySelector(':scope > .decision-head-v340');
    if(recommendation&&recommendation.parentElement!==actions)actions.appendChild(recommendation);
    head.dataset.locationHeaderGridV422='1';
    return true;
  }

  function enhanceCard(card){
    const id=card?.dataset?.locationCard;
    const body=card?.querySelector(':scope > .location-body');
    if(!id||!body)return false;
    if(!body.id)body.id=`location-body-${id.replace(/[^a-z0-9_-]/gi,'-')}`;
    const side=ensureHeaderSide(card);
    const button=side?.querySelector('.location-collapse-toggle-v422');
    if(!button)return false;
    ensureHeaderGrid(card,side);
    attr(button,'aria-controls',body.id);
    forgetLegacyState(id);
    setCollapsed(card,read(id));
    card.dataset.locationCollapseV422='1';
    return true;
  }

  function enhanceAll(){
    document.querySelectorAll('[data-location-card]').forEach(enhanceCard);
    return true;
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
      enhanceAll();
      return result;
    };
    wrapped.__locationCardCollapseV422=true;
    wrapped.__base=current;
    window.renderLocations=wrapped;
    try{renderLocations=wrapped}catch(_){ }
    return true;
  }

  function install(){
    installMobileActionStyle();
    installRenderHook();
    enhanceAll();
    window.addEventListener('load',()=>{
      installRenderHook();
      enhanceAll();
    },{once:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();

  window.BogatkaLocationCardCollapseV422={
    version:VERSION,ready:true,enhanceAll,enhanceCard,setCollapsed,installRenderHook,
    getSessionState:id=>read(id),
    audit(){
      const failures=[];
      for(const card of document.querySelectorAll('[data-location-card]')){
        const id=card.dataset.locationCard;
        const body=card.querySelector(':scope > .location-body');
        const side=card.querySelector(':scope > .location-head > .location-head-side-v422');
        const actions=card.querySelector(':scope > .location-head > .location-actions');
        if(!body)failures.push(`${id}:body:missing`);
        if(!side)failures.push(`${id}:side:missing`);
        if(!side?.querySelector(':scope > .scorebox'))failures.push(`${id}:scorebox:missing`);
        if(!side?.querySelector(':scope > .location-collapse-toggle-v422'))failures.push(`${id}:toggle:missing`);
        if(!actions)failures.push(`${id}:actions:grid-missing`);
      }
      return {ok:failures.length===0,failures};
    },
  };
})();
