(function(){
  if(window.BogatkaLocationGlobalV421?.ready)return;

  const VERSION='4.2.1';
  const AVAILABILITY_OPTIONS=[
    ['','Не выбрано'],
    ['Свободно','Свободно сейчас'],
    ['Занято','Занято'],
    ['Освобождается','Освобождается'],
    ['Неизвестно','Неизвестно'],
  ];
  const LANDLORD_READINESS_OPTIONS=[
    ['','Не выбрано'],
    ['Готов обсуждать','Готов обсуждать'],
    ['Заинтересован','Заинтересован'],
    ['Нужна пауза','Нужна пауза'],
    ['Не заинтересован','Не заинтересован'],
  ];
  const ORDER=[
    'status','objectType','objectTypeOther','date','time','floorLocation','premiseCondition',
    'premiseAvailability','landlordReadiness','nextAction',
  ];
  let timer=null;
  let reportAttempts=0;

  function controlOf(card,field){
    return card.querySelector(`[data-field="${field}"]`);
  }

  function wrapperOf(control){
    return control?.closest('label.field,label.object-other')||null;
  }

  function syncPremium(select){
    if(!select||select.tagName!=='SELECT')return;
    if(window.BogatkaSelectSync?.syncVisibleSelect)window.BogatkaSelectSync.syncVisibleSelect(select);
    else{
      const trigger=select.nextElementSibling;
      if(trigger?.classList.contains('premium-select-trigger')&&typeof bogatkaSyncPremiumSelect==='function'){
        bogatkaSyncPremiumSelect(select,trigger);
        trigger.dataset.syncedValue=select.value;
      }
    }
  }

  function bindField(control){
    if(!control||control.dataset.globalBoundV421==='1'||control.dataset.overviewBoundV417==='1'||control.dataset.profileBoundV416==='1')return;
    control.dataset.globalBoundV421='1';
    control.addEventListener('change',()=>{
      if(typeof showSaving==='function')showSaving();
      clearTimeout(control._globalSaveTimerV421);
      const revision=Number(control.dataset.globalRevisionV421||0)+1;
      control.dataset.globalRevisionV421=String(revision);
      control.dataset.profileDirtyV416='1';
      control._globalSaveTimerV421=setTimeout(async()=>{
        try{
          if(typeof saveField==='function')await saveField(control);
        }catch(error){
          if(typeof showError==='function')showError(error);
          else console.error(error);
        }finally{
          if(control.dataset.globalRevisionV421===String(revision)){
            delete control.dataset.profileDirtyV416;
            control._globalSaveTimerV421=null;
          }
        }
      },80);
    });
  }

  function replaceOptions(select,options){
    const currentValue=select.value;
    const signature=options.map(([value,label])=>`${value}:${label}`).join('|');
    if(select.dataset.globalOptionsV421!==signature){
      select.replaceChildren(...options.map(([value,label])=>{
        const option=document.createElement('option');
        option.value=value;
        option.textContent=label;
        return option;
      }));
      select.dataset.globalOptionsV421=signature;
      select.value=currentValue;
    }
    syncPremium(select);
  }

  function createSelectField(locationId,field,label,options){
    const wrapper=document.createElement('label');
    wrapper.className='field overview-field-v417 panel-field-v419 global-field-v421';
    wrapper.dataset.overviewField=field;
    wrapper.dataset.panelField=field;
    wrapper.dataset.globalField=field;
    const caption=document.createElement('span');
    caption.className='profile-caption-v416';
    caption.textContent=label;
    const select=document.createElement('select');
    select.dataset.location=locationId;
    select.dataset.field=field;
    select.dataset.profileV416='1';
    select.dataset.overviewV417='1';
    select.dataset.panelV419='1';
    select.dataset.globalV421='1';
    replaceOptions(select,options);
    wrapper.append(caption,select);
    bindField(select);
    return wrapper;
  }

  function ensureCaption(wrapper,text){
    if(!wrapper)return;
    let caption=wrapper.querySelector(':scope > .profile-caption-v416');
    if(!caption){
      caption=document.createElement('span');
      caption.className='profile-caption-v416';
      wrapper.prepend(caption);
    }
    caption.textContent=text;
  }

  function ensureField(card,grid,field,label,options){
    let control=controlOf(card,field);
    if(!control){
      const wrapper=createSelectField(card.dataset.locationCard,field,label,options);
      grid.appendChild(wrapper);
      control=wrapper.querySelector('select');
    }
    const wrapper=wrapperOf(control);
    wrapper?.classList.add('global-field-v421','panel-field-v419');
    if(wrapper){
      wrapper.hidden=false;
      wrapper.classList.remove('panel-hidden-v419','hidden');
      wrapper.removeAttribute('aria-hidden');
      wrapper.dataset.globalField=field;
    }
    control.dataset.globalV421='1';
    ensureCaption(wrapper,label);
    replaceOptions(control,options);
    bindField(control);
    return control;
  }

  function reorder(grid,card){
    const desired=ORDER.map(field=>wrapperOf(controlOf(card,field))).filter(Boolean);
    const wanted=new Set(desired);
    const current=[...grid.children].filter(node=>wanted.has(node));
    if(current.length===desired.length&&current.every((node,index)=>node===desired[index]))return;
    const fragment=document.createDocumentFragment();
    desired.forEach(node=>fragment.appendChild(node));
    const note=grid.querySelector('.inspection-note-v416');
    grid.insertBefore(fragment,note||null);
  }

  function syncPairState(card){
    const overview=card.querySelector('.location-panels-v419');
    if(!overview)return;
    const inspection=overview.querySelector('.inspection-card-v416');
    const landlord=overview.querySelector('.landlord-card-v416');
    const bothOpen=Boolean(inspection&&landlord&&!inspection.classList.contains('panel-closed-v419')&&!landlord.classList.contains('panel-closed-v419'));
    overview.classList.toggle('panels-both-open-v421',bothOpen);
  }

  async function restore(card){
    if(typeof getLocationData!=='function'||typeof getNested!=='function')return;
    const data=await getLocationData(card.dataset.locationCard);
    for(const control of card.querySelectorAll('[data-global-v421][data-field]')){
      if(control===document.activeElement||control.dataset.profileDirtyV416==='1')continue;
      const value=getNested(data,control.dataset.field);
      const next=value===undefined||value===null?'':String(value);
      if(control.value!==next)control.value=next;
      syncPremium(control);
    }
  }

  async function enhanceCard(card){
    const grid=card.querySelector('.inspection-grid-v416');
    if(!grid||!card.dataset.locationCard)return;
    ensureField(card,grid,'premiseAvailability','Доступность помещения',AVAILABILITY_OPTIONS);
    ensureField(card,grid,'landlordReadiness','Готовность собственника',LANDLORD_READINESS_OPTIONS);
    reorder(grid,card);
    syncPairState(card);
    await restore(card);
  }

  function reportChainHas(fn,marker){
    const visited=new Set();
    let current=fn;
    while(typeof current==='function'&&!visited.has(current)){
      if(current[marker])return true;
      visited.add(current);
      current=current.__base;
    }
    return false;
  }

  function upsertReportValue(documentReport,grid,label,value){
    let item=[...grid.children].find(node=>node.querySelector('b')?.textContent.replace(':','').trim()===label);
    if(!item){
      item=documentReport.createElement('div');
      const strong=documentReport.createElement('b');
      strong.textContent=`${label}:`;
      item.appendChild(strong);
      grid.appendChild(item);
    }
    const strong=item.querySelector('b');
    item.replaceChildren(strong,documentReport.createTextNode(` ${value||'—'}`));
  }

  function addReportPatch(){
    reportAttempts+=1;
    const current=window.buildReportHtml;
    if(typeof current!=='function'){
      if(reportAttempts<120)setTimeout(addReportPatch,200);
      return;
    }
    if(current.__locationGlobalV421)return;
    if(!reportChainHas(current,'__locationPanelsV419')){
      if(reportAttempts<120)setTimeout(addReportPatch,200);
      return;
    }
    const base=current;
    const wrapped=async function(...args){
      const html=await base(...args);
      const parser=new DOMParser();
      const documentReport=parser.parseFromString(html,'text/html');
      const sections=[...documentReport.querySelectorAll('.report-location')];
      for(let index=0;index<sections.length;index++){
        const section=sections[index];
        const grid=section.querySelector('.report-inspection-grid-v417');
        const id=section.dataset.locationId||window.locations?.[index]?.id;
        if(!grid||!id||typeof getLocationData!=='function')continue;
        const data=await getLocationData(id);
        upsertReportValue(documentReport,grid,'Доступность помещения',data.premiseAvailability);
        upsertReportValue(documentReport,grid,'Готовность собственника',data.landlordReadiness);
      }
      return `<!doctype html>\n${documentReport.documentElement.outerHTML}`;
    };
    wrapped.__locationGlobalV421=true;
    wrapped.__locationPanelsV419=true;
    wrapped.__base=base;
    window.buildReportHtml=wrapped;
    try{buildReportHtml=wrapped}catch(_){}
  }

  async function enhanceAll(){
    const labels=window.BogatkaWorkflowV414?.FIELD_LABELS;
    if(labels)Object.assign(labels,{
      premiseAvailability:'Доступность помещения',
      landlordReadiness:'Готовность собственника',
    });
    addReportPatch();
    for(const card of document.querySelectorAll('[data-location-card]'))await enhanceCard(card);
  }

  function schedule(delay=80){
    clearTimeout(timer);
    timer=setTimeout(()=>enhanceAll().catch(console.error),delay);
  }

  function install(){
    const root=document.getElementById('locations')||document.body;
    root.addEventListener('click',event=>{
      if(!event.target.closest('.panel-toggle-v419'))return;
      const card=event.target.closest('[data-location-card]');
      if(card)setTimeout(()=>syncPairState(card),0);
    });
    new MutationObserver(()=>schedule(100)).observe(root,{childList:true,subtree:true});
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
    audit(){
      const failures=[];
      for(const card of document.querySelectorAll('[data-location-card]')){
        for(const field of ['premiseAvailability','landlordReadiness']){
          const control=controlOf(card,field);
          const wrapper=wrapperOf(control);
          if(!control||!wrapper)failures.push(`${card.dataset.locationCard}:${field}:missing`);
          else if(wrapper.hidden||wrapper.classList.contains('panel-hidden-v419'))failures.push(`${card.dataset.locationCard}:${field}:hidden`);
        }
      }
      return {ok:failures.length===0,failures};
    },
  };
})();
