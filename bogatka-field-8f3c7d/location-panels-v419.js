(function(){
  if(window.BogatkaLocationPanelsV419?.ready)return;

  const VERSION='4.1.9';
  const FIELD_LABELS={
    floorLocation:'Этаж / расположение',
    premiseCondition:'Состояние помещения',
    nextAction:'Следующий шаг по локации',
  };
  const INSPECTION_KEEP=['status','objectType','objectTypeOther','date','time','floorLocation','premiseCondition','nextAction'];
  const INSPECTION_REMOVE=['inspectionBy','premiseAvailability','availableFrom','nextActionDate'];
  const LANDLORD_ORDER=['rent','ownerName','contact','contactPhone','contactMessenger','contactEmail','rentConditions','contactNotes'];
  let timer=null;
  let reportAttempts=0;

  function isOpen(section){
    return section?.dataset.panelOpenV419!=='0';
  }

  function controlOfField(card,field){
    return card.querySelector(`[data-field="${field}"]`);
  }

  function fieldWrapper(control){
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

  function setCaption(wrapper,text){
    if(!wrapper)return;
    let caption=wrapper.querySelector(':scope > .profile-caption-v416');
    if(!caption){
      caption=document.createElement('span');
      caption.className='profile-caption-v416';
      wrapper.prepend(caption);
    }
    if(caption.textContent!==text)caption.textContent=text;
  }

  function bindField(control){
    if(!control||control.dataset.panelBoundV419==='1')return;
    control.dataset.panelBoundV419='1';
    const eventName=control.tagName==='TEXTAREA'||['text','number','tel','email'].includes(control.type)?'input':'change';
    control.addEventListener(eventName,()=>{
      if(typeof showSaving==='function')showSaving();
      clearTimeout(control._panelSaveTimerV419);
      const revision=Number(control.dataset.panelRevisionV419||0)+1;
      control.dataset.panelRevisionV419=String(revision);
      control.dataset.profileDirtyV416='1';
      control._panelSaveTimerV419=setTimeout(async()=>{
        try{
          if(typeof saveField==='function')await saveField(control);
        }catch(error){
          if(typeof showError==='function')showError(error);
          else console.error(error);
        }finally{
          if(control.dataset.panelRevisionV419===String(revision)){
            delete control.dataset.profileDirtyV416;
            control._panelSaveTimerV419=null;
          }
        }
      },eventName==='change'?80:250);
    });
  }

  function createField(locationId,definition){
    const wrapper=document.createElement('label');
    wrapper.className=`field panel-field-v419${definition.wide?' profile-wide-v416 panel-wide-v419':''}`;
    wrapper.dataset.panelField=definition.field;
    const caption=document.createElement('span');
    caption.className='profile-caption-v416';
    caption.textContent=definition.label;
    let control;
    if(definition.kind==='textarea'){
      control=document.createElement('textarea');
      control.rows=2;
    }else if(definition.kind==='select'){
      control=document.createElement('select');
      for(const [value,label] of definition.options){
        const option=document.createElement('option');
        option.value=value;
        option.textContent=label;
        control.appendChild(option);
      }
    }else{
      control=document.createElement('input');
      control.type=definition.kind||'text';
    }
    control.dataset.location=locationId;
    control.dataset.field=definition.field;
    control.dataset.profileV416='1';
    control.dataset.panelV419='1';
    if(definition.placeholder)control.placeholder=definition.placeholder;
    wrapper.append(caption,control);
    bindField(control);
    return wrapper;
  }

  function ensureInspectionFields(card,grid,id){
    const definitions=[
      {field:'floorLocation',label:'Этаж / расположение',kind:'text',placeholder:'Например: 1-й этаж, отдельный вход'},
      {field:'premiseCondition',label:'Состояние помещения',kind:'select',options:[
        ['','Не выбрано'],['Готово к работе','Готово к работе'],['Нужен косметический ремонт','Нужен косметический ремонт'],['Нужен существенный ремонт','Нужен существенный ремонт'],['Не оценено','Не оценено'],
      ]},
      {field:'nextAction',label:'Следующий шаг по локации',kind:'textarea',placeholder:'Например: запросить план, согласовать повторный осмотр, получить проект договора',wide:true},
    ];
    for(const definition of definitions){
      let control=controlOfField(card,definition.field);
      if(!control){
        const wrapper=createField(id,definition);
        grid.appendChild(wrapper);
        control=wrapper.querySelector('[data-field]');
      }else{
        const wrapper=fieldWrapper(control);
        if(wrapper){
          wrapper.classList.add('panel-field-v419');
          if(definition.wide)wrapper.classList.add('profile-wide-v416','panel-wide-v419');
          setCaption(wrapper,definition.label);
          if(!grid.contains(wrapper))grid.appendChild(wrapper);
        }
        bindField(control);
      }
    }
  }

  function makeToggle(section,title,copy,storageKey){
    let head=section.querySelector(':scope > .panel-toggle-v419');
    const existing=section.querySelector(':scope > .profile-section-head-v416');
    if(!head){
      head=document.createElement('button');
      head.type='button';
      head.className='panel-toggle-v419';
      head.innerHTML='<span class="panel-title-v419"></span><span class="panel-copy-v419"></span><span class="panel-chevron-v419">⌄</span>';
      section.prepend(head);
      head.addEventListener('click',()=>{
        const next=!isOpen(section);
        section.dataset.panelOpenV419=next?'1':'0';
        try{localStorage.setItem(storageKey,next?'1':'0')}catch(_){}
        updateOpenState(section);
      });
    }
    if(existing)existing.remove();
    head.querySelector('.panel-title-v419').textContent=title;
    head.querySelector('.panel-copy-v419').textContent=copy;
    if(section.dataset.panelOpenV419===undefined){
      let saved='1';
      try{saved=localStorage.getItem(storageKey)||'1'}catch(_){}
      section.dataset.panelOpenV419=saved==='0'?'0':'1';
    }
    updateOpenState(section);
  }

  function updateOpenState(section){
    const open=isOpen(section);
    section.classList.toggle('panel-closed-v419',!open);
    const chevron=section.querySelector('.panel-chevron-v419');
    if(chevron)chevron.textContent=open?'⌃':'⌄';
  }

  function arrangeInspection(card,section,grid,id){
    makeToggle(section,'Параметры осмотра','Статус, формат, состояние помещения и следующий шаг.','bogatka.panel.inspection.open');
    ensureInspectionFields(card,grid,id);
    for(const field of INSPECTION_REMOVE){
      const wrapper=fieldWrapper(controlOfField(card,field));
      if(wrapper)wrapper.remove();
    }
    const nodes=[];
    for(const field of INSPECTION_KEEP){
      const control=controlOfField(card,field);
      const wrapper=fieldWrapper(control);
      if(wrapper)nodes.push(wrapper);
    }
    const undo=grid.querySelector('.inspection-note-v416');
    for(const wrapper of nodes){
      if(wrapper.dataset.fieldArrangedV419!=='1')wrapper.dataset.fieldArrangedV419='1';
      grid.insertBefore(wrapper,undo||null);
    }
    const other=fieldWrapper(controlOfField(card,'objectTypeOther'));
    if(other)setCaption(other,'Уточните другой тип объекта');
  }

  function arrangeLandlord(card,section,grid){
    makeToggle(section,'Арендодатель и условия','Аренда, собственник, контакты и договорённости.','bogatka.panel.landlord.open');
    for(const field of LANDLORD_ORDER){
      const control=controlOfField(card,field);
      const wrapper=fieldWrapper(control);
      if(!wrapper)continue;
      wrapper.classList.remove('profile-wide-v416','panel-wide-v419');
      wrapper.dataset.landlordOrderV419=field;
      if(field==='rentConditions'||field==='contactNotes')wrapper.classList.add('profile-wide-v416','panel-wide-v419');
      grid.appendChild(wrapper);
    }
    setCaption(fieldWrapper(controlOfField(card,'rent')),'Аренда, BYN / месяц');
    setCaption(fieldWrapper(controlOfField(card,'ownerName')),'Собственник / организация');
    setCaption(fieldWrapper(controlOfField(card,'contact')),'Контактное лицо');
    setCaption(fieldWrapper(controlOfField(card,'contactPhone')),'Телефон');
    setCaption(fieldWrapper(controlOfField(card,'contactEmail')),'Email');
    setCaption(fieldWrapper(controlOfField(card,'contactMessenger')),'Мессенджер');
  }

  async function restore(card){
    if(typeof getLocationData!=='function'||typeof getNested!=='function')return;
    const id=card.dataset.locationCard;
    const data=await getLocationData(id);
    card.querySelectorAll('[data-panel-v419][data-field]').forEach(control=>{
      if(control===document.activeElement||control.dataset.profileDirtyV416==='1')return;
      const value=getNested(data,control.dataset.field);
      const next=value===undefined||value===null?'':String(value);
      if(control.value!==next)control.value=next;
      syncPremium(control);
    });
  }

  async function enhanceCard(card){
    const id=card.dataset.locationCard;
    const overview=card.querySelector('.location-overview-v416');
    if(!id||!overview)return;
    overview.classList.add('location-panels-v419');
    const inspection=overview.querySelector('.inspection-card-v416');
    const landlord=overview.querySelector('.landlord-card-v416');
    const inspectionGrid=overview.querySelector('.inspection-grid-v416');
    const landlordGrid=overview.querySelector('.landlord-grid-v416');
    if(inspection&&inspectionGrid)arrangeInspection(card,inspection,inspectionGrid,id);
    if(landlord&&landlordGrid)arrangeLandlord(card,landlord,landlordGrid);
    await restore(card);
  }

  async function enhanceAll(){
    const labels=window.BogatkaWorkflowV414?.FIELD_LABELS;
    if(labels)Object.assign(labels,FIELD_LABELS);
    for(const card of document.querySelectorAll('[data-location-card]'))await enhanceCard(card);
  }

  function addReportPatch(){
    reportAttempts+=1;
    if(typeof window.buildReportHtml!=='function'){
      if(reportAttempts<100)setTimeout(addReportPatch,200);
      return;
    }
    if(window.buildReportHtml.__locationPanelsV419)return;
    const base=window.buildReportHtml;
    const wrapped=async function(...args){
      const html=await base(...args);
      const parser=new DOMParser();
      const doc=parser.parseFromString(html,'text/html');
      for(const block of doc.querySelectorAll('.report-inspection-v417')){
        const items=[...block.querySelectorAll('.report-inspection-grid-v417>div')];
        for(const item of items){
          const label=item.querySelector('b')?.textContent.replace(':','').trim();
          if(['Осмотр проводил','Доступность помещения','Доступно с','Дата следующего действия'].includes(label))item.remove();
        }
      }
      return `<!doctype html>\n${doc.documentElement.outerHTML}`;
    };
    wrapped.__locationPanelsV419=true;
    wrapped.__base=base;
    window.buildReportHtml=wrapped;
    try{buildReportHtml=wrapped}catch(_){}
  }

  function schedule(delay=80){
    clearTimeout(timer);
    timer=setTimeout(()=>enhanceAll().catch(console.error),delay);
  }

  function install(){
    addReportPatch();
    const root=document.getElementById('locations')||document.body;
    new MutationObserver(()=>schedule(120)).observe(root,{childList:true,subtree:true});
    schedule(20);
    setTimeout(()=>schedule(0),500);
    setTimeout(()=>schedule(0),1500);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  window.BogatkaLocationPanelsV419={version:VERSION,ready:true,enhanceAll,audit(){
    const failures=[];
    for(const card of document.querySelectorAll('[data-location-card]')){
      for(const field of INSPECTION_REMOVE){
        if(fieldWrapper(controlOfField(card,field)))failures.push(`${card.dataset.locationCard}:${field}:visible`);
      }
      for(const field of ['status','objectType','date','time','floorLocation','premiseCondition','nextAction','rent','ownerName','contact','contactPhone','contactMessenger','contactEmail','rentConditions','contactNotes']){
        if(!fieldWrapper(controlOfField(card,field)))failures.push(`${card.dataset.locationCard}:${field}:missing`);
      }
    }
    return {ok:failures.length===0,failures};
  }};
})();
