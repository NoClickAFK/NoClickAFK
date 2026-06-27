(function(){
  if(window.BogatkaLocationOverviewV417?.ready)return;

  const VERSION='4.1.7';
  const FIELD_DEFINITIONS=[
    {field:'inspectionBy',label:'Осмотр проводил',kind:'text',placeholder:'Имя сотрудника'},
    {field:'floorLocation',label:'Этаж / расположение',kind:'text',placeholder:'Например: 1-й этаж, отдельный вход'},
    {field:'premiseCondition',label:'Состояние помещения',kind:'select',options:[
      ['','Не выбрано'],['Готово к работе','Готово к работе'],['Нужен косметический ремонт','Нужен косметический ремонт'],['Нужен существенный ремонт','Нужен существенный ремонт'],['Не оценено','Не оценено'],
    ]},
    {field:'premiseAvailability',label:'Доступность помещения',kind:'select',options:[
      ['','Не выбрано'],['Свободно','Свободно'],['Занято','Занято'],['Освобождается','Освобождается'],['Неизвестно','Неизвестно'],
    ]},
    {field:'availableFrom',label:'Доступно с',kind:'date'},
    {field:'nextActionDate',label:'Дата следующего действия',kind:'date'},
    {field:'nextAction',label:'Следующий шаг по локации',kind:'textarea',placeholder:'Например: запросить план, согласовать повторный осмотр, получить проект договора',wide:true},
  ];
  const FIELD_LABELS={
    inspectionBy:'Осмотр проводил',
    floorLocation:'Этаж / расположение',
    premiseCondition:'Состояние помещения',
    premiseAvailability:'Доступность помещения',
    availableFrom:'Доступно с',
    nextActionDate:'Дата следующего действия',
    nextAction:'Следующий шаг по локации',
  };

  let timer=null;
  let reportAttempts=0;

  function syncPremium(select){
    const trigger=select.nextElementSibling;
    if(!trigger?.classList.contains('premium-select-trigger'))return;
    const selectedText=select.selectedOptions?.[0]?.textContent||'';
    const valueNode=trigger.querySelector('.premium-select-value');
    if(trigger.dataset.syncedValue===select.value&&valueNode?.textContent===selectedText)return;
    if(window.BogatkaSelectSync?.syncVisibleSelect){
      window.BogatkaSelectSync.syncVisibleSelect(select);
      return;
    }
    if(typeof bogatkaSyncPremiumSelect==='function'){
      bogatkaSyncPremiumSelect(select,trigger);
      trigger.dataset.syncedValue=select.value;
    }
  }

  function bindField(control){
    if(!control||control.dataset.overviewBoundV417==='1')return;
    control.dataset.overviewBoundV417='1';
    const eventName=control.tagName==='TEXTAREA'||['text','number','tel','email'].includes(control.type)?'input':'change';
    control.addEventListener(eventName,()=>{
      showSaving();
      clearTimeout(control._overviewSaveTimerV417);
      const revision=Number(control.dataset.overviewRevisionV417||0)+1;
      control.dataset.overviewRevisionV417=String(revision);
      control.dataset.profileDirtyV416='1';
      const delay=eventName==='change'?80:250;
      control._overviewSaveTimerV417=setTimeout(async()=>{
        try{
          await saveField(control);
        }catch(error){
          showError(error);
        }finally{
          if(control.dataset.overviewRevisionV417===String(revision)){
            delete control.dataset.profileDirtyV416;
            control._overviewSaveTimerV417=null;
          }
        }
      },delay);
    });
  }

  function createControl(definition,locationId){
    let control;
    if(definition.kind==='textarea'){
      control=document.createElement('textarea');
      control.rows=2;
    }else if(definition.kind==='select'){
      control=document.createElement('select');
      for(const [value,label] of definition.options||[]){
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
    control.dataset.overviewV417='1';
    if(definition.placeholder)control.placeholder=definition.placeholder;
    bindField(control);
    return control;
  }

  function createField(definition,locationId){
    const wrapper=document.createElement('label');
    wrapper.className=`field overview-field-v417${definition.wide?' profile-wide-v416 inspection-action-v417':''}`;
    wrapper.dataset.overviewField=definition.field;
    const caption=document.createElement('span');
    caption.className='profile-caption-v416';
    caption.textContent=definition.label;
    wrapper.append(caption,createControl(definition,locationId));
    return wrapper;
  }

  function syncOtherTypeField(card){
    const select=card.querySelector('select[data-field="objectType"]');
    const wrapper=card.querySelector('[data-object-other]');
    if(!select||!wrapper)return;
    const caption=wrapper.querySelector(':scope > .profile-caption-v416');
    const captionText='Уточните другой тип объекта';
    if(caption&&caption.textContent!==captionText)caption.textContent=captionText;
    const input=wrapper.querySelector('[data-field="objectTypeOther"]');
    const placeholder='Например: помещение при АЗС, киоск, часть действующего магазина';
    if(input&&input.placeholder!==placeholder)input.placeholder=placeholder;
    wrapper.classList.toggle('hidden',select.value!=='Другое');
    if(select.dataset.overviewOtherBoundV417!=='1'){
      select.dataset.overviewOtherBoundV417='1';
      const update=()=>wrapper.classList.toggle('hidden',select.value!=='Другое');
      select.addEventListener('change',update);
      select.addEventListener('bogatka:object-type-restored',update);
    }
  }

  async function restoreFields(card){
    const id=card.dataset.locationCard;
    const data=await getLocationData(id);
    for(const control of card.querySelectorAll('[data-overview-v417][data-field]')){
      if(control===document.activeElement||control.dataset.profileDirtyV416==='1')continue;
      const value=getNested(data,control.dataset.field);
      const next=value===undefined||value===null?'':String(value);
      if(control.value!==next)control.value=next;
      if(control.tagName==='SELECT')syncPremium(control);
    }
    syncOtherTypeField(card);
  }

  async function enhanceCard(card){
    const id=card.dataset.locationCard;
    const grid=card.querySelector('.inspection-grid-v416');
    if(!id||!grid)return;

    const subtitle=card.querySelector('.inspection-card-v416 .profile-section-head-v416 span');
    const subtitleText='Статус, формат, состояние помещения и следующий шаг.';
    if(subtitle&&subtitle.textContent!==subtitleText)subtitle.textContent=subtitleText;
    syncOtherTypeField(card);

    const undo=grid.querySelector('.inspection-note-v416');
    for(const definition of FIELD_DEFINITIONS){
      let wrapper=grid.querySelector(`[data-overview-field="${definition.field}"]`);
      if(!wrapper){
        wrapper=createField(definition,id);
        grid.insertBefore(wrapper,undo||null);
      }else{
        bindField(wrapper.querySelector('[data-field]'));
      }
    }

    card.dataset.overviewV417='1';
    await restoreFields(card);
  }

  function installHistoryLabels(){
    const labels=window.BogatkaWorkflowV414?.FIELD_LABELS;
    if(labels)Object.assign(labels,FIELD_LABELS,{objectTypeOther:'Уточнение другого типа объекта'});
  }

  function formatDate(value){
    if(!value)return '—';
    const match=String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match?`${match[3]}.${match[2]}.${match[1]}`:String(value);
  }

  function addReportInspection(documentReport,section,data){
    section.querySelector('.report-inspection-v417')?.remove();
    const block=documentReport.createElement('section');
    block.className='report-inspection-v417';
    const heading=documentReport.createElement('h3');
    heading.textContent='Параметры осмотра и следующий шаг';
    const grid=documentReport.createElement('div');
    grid.className='report-inspection-grid-v417';
    const entries=[
      ['Осмотр проводил',data.inspectionBy],
      ['Этаж / расположение',data.floorLocation],
      ['Состояние помещения',data.premiseCondition],
      ['Доступность помещения',data.premiseAvailability],
      ['Доступно с',formatDate(data.availableFrom)],
      ['Дата следующего действия',formatDate(data.nextActionDate)],
      ['Следующий шаг',data.nextAction],
    ];
    for(const [name,value] of entries){
      const item=documentReport.createElement('div');
      const strong=documentReport.createElement('b');
      strong.textContent=`${name}:`;
      item.append(strong,documentReport.createTextNode(` ${value||'—'}`));
      if(name==='Следующий шаг')item.classList.add('wide');
      grid.appendChild(item);
    }
    block.append(heading,grid);
    const landlord=section.querySelector('.report-landlord-v416');
    if(landlord)landlord.insertAdjacentElement('beforebegin',block);
    else section.querySelector('.report-summary-grid')?.insertAdjacentElement('afterend',block);
  }

  function installReportWrapper(){
    reportAttempts+=1;
    if(typeof window.buildReportHtml!=='function'){
      if(reportAttempts<100)setTimeout(installReportWrapper,200);
      return;
    }
    if(window.buildReportHtml.__locationOverviewV417)return;
    const base=window.buildReportHtml;
    const wrapped=async function(...args){
      const html=await base(...args);
      const parser=new DOMParser();
      const documentReport=parser.parseFromString(html,'text/html');
      const sections=[...documentReport.querySelectorAll('.report-location')];
      for(let index=0;index<sections.length;index++){
        const section=sections[index];
        const id=section.dataset.locationId||locations[index]?.id;
        if(!id)continue;
        addReportInspection(documentReport,section,await getLocationData(id));
      }
      if(!documentReport.querySelector('#reportOverviewStyleV417')){
        const style=documentReport.createElement('style');
        style.id='reportOverviewStyleV417';
        style.textContent='.report-inspection-v417{margin:16px 0}.report-inspection-grid-v417{display:grid;grid-template-columns:1fr 1fr;gap:8px}.report-inspection-grid-v417>div{padding:9px;border:1px solid #dce6e0;border-radius:9px;background:#f7faf8;white-space:pre-wrap}.report-inspection-grid-v417>.wide{grid-column:1/-1}@media(max-width:700px){.report-inspection-grid-v417{grid-template-columns:1fr}.report-inspection-grid-v417>.wide{grid-column:auto}}';
        documentReport.head.appendChild(style);
      }
      return `<!doctype html>\n${documentReport.documentElement.outerHTML}`;
    };
    wrapped.__locationOverviewV417=true;
    wrapped.__base=base;
    window.buildReportHtml=wrapped;
    try{buildReportHtml=wrapped}catch(_){}
  }

  async function enhanceAll(){
    installHistoryLabels();
    installReportWrapper();
    for(const card of document.querySelectorAll('[data-location-card]'))await enhanceCard(card);
  }

  function schedule(delay=60){
    clearTimeout(timer);
    timer=setTimeout(()=>enhanceAll().catch(console.error),delay);
  }

  function install(){
    const root=document.getElementById('locations')||document.body;
    new MutationObserver(()=>schedule(80)).observe(root,{childList:true,subtree:true});
    schedule(30);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  window.addEventListener('load',()=>schedule(100),{once:true});

  window.BogatkaLocationOverviewV417={
    version:VERSION,
    ready:true,
    enhanceAll,
    restoreFields,
    audit(){
      const failures=[];
      const required=FIELD_DEFINITIONS.map(item=>item.field);
      for(const card of document.querySelectorAll('[data-location-card]')){
        const id=card.dataset.locationCard;
        for(const field of required){
          if(!card.querySelector(`[data-location="${CSS.escape(id)}"][data-field="${field}"]`))failures.push(`${id}:${field}`);
        }
      }
      return {ok:failures.length===0,failures};
    },
  };
})();
