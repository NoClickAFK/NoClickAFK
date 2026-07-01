(function(){
  if(window.BogatkaLocationGlobalV421?.ready)return;

  const VERSION='4.2.1';
  const GLOBAL_FIELDS=['premiseAvailability','landlordReadiness'];
  const ALIGN_PAIRS=[
    ['status','objectType'],
    ['date','time'],
    ['floorLocation','premiseCondition'],
    ['premiseAvailability','landlordReadiness'],
    ['ownerName','contactRole'],
    ['contact','contactPhone'],
    ['contactMessenger','contactEmail'],
  ];
  // Report generation is native to location-overview-v421; no wrapped.__locationGlobalV421 hook is installed.
  let timer=null;

  function ensureStyle(){
    const href='./location-global-v421.css';
    if(document.querySelector(`link[href="${href}"]`))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=href;
    document.head.appendChild(link);
  }

  function isEditing(){
    if(window.BogatkaUIStability?.isEditing?.())return true;
    const active=document.activeElement;
    const root=document.getElementById('locations');
    return Boolean(active&&root?.contains(active)&&active.matches?.('input,textarea,select,[contenteditable="true"]'));
  }

  function controlOf(card,field){
    return card.querySelector(`[data-field="${field}"]`);
  }

  function wrapperOf(control){
    return control?.closest('label.field,label.object-other')||null;
  }

  function captionOf(card,field){
    return wrapperOf(controlOf(card,field))?.querySelector(':scope > .profile-caption-v416')||null;
  }

  function alignPairedCaptions(card){
    for(const [leftField,rightField] of ALIGN_PAIRS){
      const left=captionOf(card,leftField);
      const right=captionOf(card,rightField);
      if(!left||!right)continue;
      left.style.minHeight='32px';
      right.style.minHeight='32px';
      const height=Math.max(32,Math.ceil(left.scrollHeight),Math.ceil(right.scrollHeight));
      left.style.minHeight=`${height}px`;
      right.style.minHeight=`${height}px`;
    }
    card.dataset.locationGlobalAlignedV421='1';
  }

  function prepareGlobalField(card,field){
    const control=controlOf(card,field);
    const wrapper=wrapperOf(control);
    if(!control||!wrapper)return false;
    wrapper.classList.add('global-field-v421','panel-field-v419');
    wrapper.hidden=false;
    wrapper.classList.remove('panel-hidden-v419','hidden');
    wrapper.removeAttribute('aria-hidden');
    wrapper.dataset.globalField=field;
    control.dataset.globalV421='1';
    return true;
  }

  function syncOtherType(card){
    const select=controlOf(card,'objectType');
    const wrapper=card.querySelector('[data-object-other]');
    if(!select||!wrapper)return;
    const update=()=>{
      const hidden=select.value!=='Другое';
      wrapper.hidden=hidden;
      wrapper.classList.toggle('hidden',hidden);
    };
    update();
    if(select.dataset.globalOtherBoundV421!=='1'){
      select.dataset.globalOtherBoundV421='1';
      select.addEventListener('change',update);
      select.addEventListener('bogatka:object-type-restored',update);
    }
  }

  function syncPairState(card){
    const overview=card.querySelector('.location-panels-v419');
    if(!overview)return;
    const inspection=overview.querySelector('.inspection-card-v416');
    const landlord=overview.querySelector('.landlord-card-v416');
    const bothOpen=Boolean(inspection&&landlord&&!inspection.classList.contains('panel-closed-v419')&&!landlord.classList.contains('panel-closed-v419'));
    overview.classList.toggle('panels-both-open-v421',bothOpen);
  }

  function enhanceCard(card){
    GLOBAL_FIELDS.forEach(field=>prepareGlobalField(card,field));
    syncOtherType(card);
    syncPairState(card);
    alignPairedCaptions(card);
  }

  async function enhanceAll(options={}){
    ensureStyle();
    if(!options.force&&isEditing()){
      schedule(350);
      return false;
    }
    const labels=window.BogatkaWorkflowV414?.FIELD_LABELS;
    if(labels)Object.assign(labels,{
      premiseAvailability:'Доступность помещения',
      landlordReadiness:'Готовность собственника',
    });
    for(const card of document.querySelectorAll('[data-location-card]'))enhanceCard(card);
    return true;
  }

  function schedule(delay=80){
    clearTimeout(timer);
    timer=setTimeout(()=>enhanceAll().catch(console.error),delay);
  }

  function install(){
    ensureStyle();
    enhanceAll({force:true}).catch(console.error);
    const root=document.getElementById('locations')||document.body;
    root.addEventListener('click',event=>{
      if(!event.target.closest('.panel-toggle-v419'))return;
      const card=event.target.closest('[data-location-card]');
      if(card)setTimeout(()=>{
        syncPairState(card);
        alignPairedCaptions(card);
      },0);
    });
    new MutationObserver(()=>schedule(100)).observe(root,{childList:true,subtree:true});
    window.addEventListener('resize',()=>schedule(80));
    schedule(20);
    setTimeout(()=>schedule(0),500);
    setTimeout(()=>schedule(0),1500);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();

  window.BogatkaLocationGlobalV421={
    version:VERSION,
    ready:true,
    enhanceAll,
    syncPairState,
    alignPairedCaptions,
    audit(){
      const failures=[];
      for(const card of document.querySelectorAll('[data-location-card]')){
        for(const field of GLOBAL_FIELDS){
          const control=controlOf(card,field);
          const wrapper=wrapperOf(control);
          if(!control||!wrapper)failures.push(`${card.dataset.locationCard}:${field}:missing`);
          else if(wrapper.hidden||wrapper.classList.contains('panel-hidden-v419'))failures.push(`${card.dataset.locationCard}:${field}:hidden`);
        }
        if(card.dataset.locationGlobalAlignedV421!=='1')failures.push(`${card.dataset.locationCard}:alignment:pending`);
      }
      return {ok:failures.length===0,failures};
    },
  };
})();
