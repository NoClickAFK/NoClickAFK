(function(){
  if(window.BogatkaLocationProfileV416?.ready)return;

  const VERSION='4.2.5';
  const FRIENDLY_STREET='Магазин с отдельным входом с улицы';
  const CONTACT_ROLE_OPTIONS=[
    ['','Не выбрано'],
    ['Собственник','Собственник'],
    ['Директор','Директор'],
    ['Управляющий','Управляющий'],
    ['Представитель собственника','Представитель собственника'],
    ['Агент / посредник','Агент / посредник'],
    ['Другое','Другое'],
  ];
  const EXTRA_FIELDS=[
    {field:'ownerName',label:'Собственник / организация',kind:'text',placeholder:'Название организации или ФИО собственника'},
    {field:'contactRole',label:'Роль контактного лица',kind:'select',options:CONTACT_ROLE_OPTIONS},
    {field:'contactPhone',label:'Телефон',kind:'tel',placeholder:'+375 29 000-00-00'},
    {field:'contactEmail',label:'Email',kind:'email',placeholder:'name@example.com'},
    {field:'contactMessenger',label:'Мессенджер',kind:'text',placeholder:'Telegram, Viber, WhatsApp'},
    {field:'rentConditions',label:'Дополнительные условия аренды',kind:'textarea',placeholder:'Депозит, каникулы, коммунальные, индексация, ремонт',wide:true},
    {field:'contactNotes',label:'Дополнительная информация',kind:'textarea',placeholder:'Удобное время связи, договорённости и важные детали',wide:true},
  ];
  const FIELD_LABELS={
    objectTypeOther:'Уточнение типа объекта',
    ownerName:'Собственник / организация',
    contactRole:'Роль контактного лица',
    contactRoleOther:'Уточнение роли контактного лица',
    contactPhone:'Телефон арендодателя',
    contactEmail:'Email арендодателя',
    contactMessenger:'Мессенджер арендодателя',
    rentConditions:'Дополнительные условия аренды',
    contactNotes:'Дополнительная информация по контакту',
  };

  let timer=null;
  let reportAttempts=0;

  function filled(value){
    return value!==undefined&&value!==null&&String(value).trim()!=='';
  }

  function labelOf(control){
    return control?.closest('label.field,label.object-other,label.contact-role-other-v425')||null;
  }

  function relabel(label,text){
    if(!label)return;
    let caption=label.querySelector(':scope > .profile-caption-v416');
    if(!caption){
      [...label.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE&&node.textContent.trim()).forEach(node=>node.remove());
      caption=document.createElement('span');
      caption.className='profile-caption-v416';
      label.prepend(caption);
    }
    if(caption.textContent!==text)caption.textContent=text;
  }

  function bindField(control){
    if(!control||control.dataset.profileBoundV416==='1')return;
    control.dataset.profileBoundV416='1';
    const eventName=control.tagName==='TEXTAREA'||['text','tel','email','number'].includes(control.type)?'input':'change';
    control.addEventListener(eventName,()=>{
      showSaving();
      clearTimeout(control._profileSaveTimerV416);
      const revision=Number(control.dataset.profileRevisionV416||0)+1;
      control.dataset.profileRevisionV416=String(revision);
      control.dataset.profileDirtyV416='1';
      const delay=eventName==='change'?80:250;
      control._profileSaveTimerV416=setTimeout(async()=>{
        try{
          await saveField(control);
        }catch(error){
          showError(error);
        }finally{
          if(control.dataset.profileRevisionV416===String(revision)){
            delete control.dataset.profileDirtyV416;
            control._profileSaveTimerV416=null;
          }
        }
      },delay);
    });
  }

  function makeControl(locationId,definition){
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
    if(definition.placeholder)control.placeholder=definition.placeholder;
    if(definition.kind==='tel')control.autocomplete='tel';
    if(definition.kind==='email')control.autocomplete='email';
    bindField(control);
    return control;
  }

  function makeField(locationId,definition){
    const wrapper=document.createElement('label');
    wrapper.className=`field profile-field-v416${definition.wide?' profile-wide-v416':''}`;
    wrapper.dataset.profileField=definition.field;
    const caption=document.createElement('span');
    caption.className='profile-caption-v416';
    caption.textContent=definition.label;
    wrapper.append(caption,makeControl(locationId,definition));
    return wrapper;
  }

  function syncPremium(select){
    if(!select)return;
    const trigger=select.nextElementSibling;
    if(window.BogatkaSelectSync?.syncVisibleSelect)window.BogatkaSelectSync.syncVisibleSelect(select);
    else if(trigger?.classList.contains('premium-select-trigger')&&typeof bogatkaSyncPremiumSelect==='function'){
      bogatkaSyncPremiumSelect(select,trigger);
      trigger.dataset.syncedValue=select.value;
    }
  }

  function ensureObjectType(locationId,select){
    const street=[...select.options].find(option=>option.value==='Стрит-ритейл'||option.textContent.trim()==='Стрит-ритейл'||option.textContent.trim()===FRIENDLY_STREET);
    if(street){
      street.value='Стрит-ритейл';
      if(street.textContent!==FRIENDLY_STREET)street.textContent=FRIENDLY_STREET;
    }
    select.setAttribute('aria-label','Тип объекта');
    syncPremium(select);

    let wrapper=document.querySelector(`[data-object-other="${CSS.escape(locationId)}"]`);
    if(!wrapper){
      wrapper=document.createElement('label');
      wrapper.className='field object-other hidden profile-wide-v416';
      wrapper.dataset.objectOther=locationId;
      const caption=document.createElement('span');
      caption.className='profile-caption-v416';
      caption.textContent='Уточните другой тип объекта';
      const input=document.createElement('input');
      input.type='text';
      input.dataset.location=locationId;
      input.dataset.field='objectTypeOther';
      input.dataset.profileV416='1';
      input.placeholder='Например: помещение при АЗС, киоск, часть действующего магазина';
      wrapper.append(caption,input);
      bindField(input);
    }else{
      wrapper.classList.add('profile-wide-v416');
      relabel(wrapper,'Уточните другой тип объекта');
      bindField(wrapper.querySelector('[data-field="objectTypeOther"]'));
    }

    const update=()=>wrapper.classList.toggle('hidden',select.value!=='Другое');
    if(select.dataset.objectTypeV416!=='1'){
      select.dataset.objectTypeV416='1';
      select.addEventListener('change',update);
      select.addEventListener('bogatka:object-type-restored',update);
    }
    update();
    return wrapper;
  }

  function ensureContactRoleOther(locationId,select){
    if(!select)return null;
    select.setAttribute('aria-label','Роль контактного лица');
    let wrapper=document.querySelector(`[data-contact-role-other="${CSS.escape(locationId)}"]`);
    if(!wrapper){
      wrapper=document.createElement('label');
      wrapper.className='field contact-role-other-v425 hidden profile-wide-v416';
      wrapper.dataset.contactRoleOther=locationId;
      const caption=document.createElement('span');
      caption.className='profile-caption-v416';
      caption.textContent='Уточните роль контактного лица';
      const input=document.createElement('input');
      input.type='text';
      input.dataset.location=locationId;
      input.dataset.field='contactRoleOther';
      input.dataset.profileV416='1';
      input.placeholder='Например: бухгалтер, юрист, администратор объекта';
      wrapper.append(caption,input);
      bindField(input);
    }else{
      relabel(wrapper,'Уточните роль контактного лица');
      bindField(wrapper.querySelector('[data-field="contactRoleOther"]'));
    }
    const update=()=>{
      wrapper.classList.toggle('hidden',select.value!=='Другое');
      wrapper.hidden=select.value!=='Другое';
    };
    if(select.dataset.contactRoleV425!=='1'){
      select.dataset.contactRoleV425='1';
      select.addEventListener('change',update);
    }
    update();
    syncPremium(select);
    return wrapper;
  }

  function sectionHeader(title,copy){
    const head=document.createElement('div');
    head.className='profile-section-head-v416';
    const strong=document.createElement('strong');
    strong.textContent=title;
    const span=document.createElement('span');
    span.textContent=copy;
    head.append(strong,span);
    return head;
  }

  async function migrateLegacyRent(card,data){
    if(!data||data?.migrations?.rentToTechV425)return data;
    const next={...data,tech:{...(data.tech||{})},migrations:{...(data.migrations||{})}};
    if(filled(next.rent)&&!filled(next.tech.rentPerMonth))next.tech.rentPerMonth=String(next.rent).trim();
    next.rent='';
    next.migrations.rentToTechV425=true;
    next.updatedAt=new Date().toISOString();
    await idbPut(STORE,next,`location:${card.dataset.locationCard}`);
    const techRent=card.querySelector('[data-field="tech.rentPerMonth"]');
    if(techRent&&techRent!==document.activeElement)techRent.value=next.tech.rentPerMonth||'';
    return next;
  }

  async function restoreNewFields(card){
    const id=card.dataset.locationCard;
    let data=await getLocationData(id);
    data=await migrateLegacyRent(card,data);
    card.querySelectorAll('[data-profile-v416][data-field]').forEach(control=>{
      if(control===document.activeElement||control.dataset.profileDirtyV416==='1')return;
      const value=getNested(data,control.dataset.field);
      const next=value===undefined||value===null?'':String(value);
      if(control.value!==next)control.value=next;
      if(control.tagName==='SELECT')syncPremium(control);
    });
    const role=card.querySelector('select[data-field="contactRole"]');
    ensureContactRoleOther(id,role);
  }

  function orderLandlordFields(grid,locationId,contactLabel){
    const byField=field=>labelOf(grid.querySelector(`[data-location="${CSS.escape(locationId)}"][data-field="${field}"]`));
    const owner=byField('ownerName');
    const role=byField('contactRole');
    const roleOther=grid.querySelector(`[data-contact-role-other="${CSS.escape(locationId)}"]`);
    const phone=byField('contactPhone');
    const messenger=byField('contactMessenger');
    const email=byField('contactEmail');
    const conditions=byField('rentConditions');
    const notes=byField('contactNotes');
    [owner,role,roleOther,contactLabel,phone,messenger,email,conditions,notes].forEach(node=>node&&grid.appendChild(node));
  }

  async function enhanceCard(card){
    const locationId=card.dataset.locationCard;
    const body=card.querySelector(':scope > .location-body');
    if(!locationId||!body)return;

    const status=body.querySelector('select[data-field="status"]');
    const objectType=body.querySelector('select[data-field="objectType"]');
    const date=body.querySelector('input[data-field="date"]');
    const time=body.querySelector('input[data-field="time"]');
    const rent=body.querySelector('input[data-field="rent"]');
    const contact=body.querySelector('input[data-field="contact"]');
    if(!status||!objectType||!date||!time||!rent||!contact)return;

    let overview=body.querySelector(':scope > .location-overview-v416');
    if(!overview){
      overview=document.createElement('div');
      overview.className='location-overview-v416';

      const inspection=document.createElement('section');
      inspection.className='inspection-card-v416';
      inspection.append(sectionHeader('Параметры осмотра','Статус, формат объекта и время проверки локации.'));
      const inspectionGrid=document.createElement('div');
      inspectionGrid.className='inspection-grid-v416';
      inspection.append(inspectionGrid);

      const landlord=document.createElement('section');
      landlord.className='landlord-card-v416';
      landlord.append(sectionHeader('Арендодатель и условия','Собственник, роль контактного лица, контакты и договорённости.'));
      const landlordGrid=document.createElement('div');
      landlordGrid.className='landlord-grid-v416';
      landlord.append(landlordGrid);

      overview.append(inspection,landlord);
      body.prepend(overview);
    }

    const inspectionGrid=overview.querySelector('.inspection-grid-v416');
    const landlordGrid=overview.querySelector('.landlord-grid-v416');
    const objectOther=ensureObjectType(locationId,objectType);

    const statusLabel=labelOf(status),objectLabel=labelOf(objectType),dateLabel=labelOf(date),timeLabel=labelOf(time);
    const rentLabel=labelOf(rent),contactLabel=labelOf(contact);
    relabel(statusLabel,'Статус');
    relabel(objectLabel,'Тип объекта');
    relabel(dateLabel,'Дата осмотра');
    relabel(timeLabel,'Время осмотра');
    relabel(contactLabel,'Контактное лицо');

    [statusLabel,objectLabel,objectOther,dateLabel,timeLabel].forEach(label=>label&&inspectionGrid.appendChild(label));
    if(rentLabel){
      rentLabel.hidden=true;
      rentLabel.classList.add('profile-hidden-v425');
      rentLabel.setAttribute('aria-hidden','true');
    }
    contactLabel&&landlordGrid.appendChild(contactLabel);

    for(const definition of EXTRA_FIELDS){
      let control=landlordGrid.querySelector(`[data-location="${CSS.escape(locationId)}"][data-field="${definition.field}"]`);
      if(!control){
        const field=makeField(locationId,definition);
        landlordGrid.appendChild(field);
        control=field.querySelector('[data-field]');
      }else bindField(control);
    }

    const role=landlordGrid.querySelector('select[data-field="contactRole"]');
    const roleOther=ensureContactRoleOther(locationId,role);
    if(roleOther&&roleOther.parentElement!==landlordGrid)landlordGrid.appendChild(roleOther);
    orderLandlordFields(landlordGrid,locationId,contactLabel);

    const undo=body.querySelector(`[data-undo-note="${CSS.escape(locationId)}"]`);
    if(undo){
      undo.classList.add('inspection-note-v416');
      inspectionGrid.appendChild(undo);
    }
    const statusRow=body.querySelector(':scope > .status-row');
    const quickGrid=body.querySelector(':scope > .quick-grid');
    if(statusRow&&!statusRow.children.length)statusRow.remove();
    if(quickGrid&&![...quickGrid.children].some(child=>!child.hidden))quickGrid.remove();

    await restoreNewFields(card);
    card.dataset.profileV416='1';
  }

  function enhanceModal(){
    const modal=document.querySelector('#locationModal .modal-card');
    if(!modal)return;
    const address=modal.querySelector('#locationAddress');
    const title=modal.querySelector('#locationTitle');
    const note=modal.querySelector('#locationNote');
    if(address){address.required=true;address.autocomplete='street-address'}
    if(title)title.autocomplete='organization';
    if(note)note.rows=3;
    if(!modal.querySelector('.location-modal-guide-v416')){
      const guide=document.createElement('div');
      guide.className='location-modal-guide-v416';
      guide.textContent='Создайте карточку по точному адресу. Статус, тип объекта, финансовые параметры и контакты заполните уже внутри новой локации.';
      modal.querySelector('#locationModalTitle')?.insertAdjacentElement('afterend',guide);
    }
  }

  function installHistoryLabels(){
    const labels=window.BogatkaWorkflowV414?.FIELD_LABELS;
    if(labels)Object.assign(labels,FIELD_LABELS);
  }

  function friendlyObjectType(data){
    if(data?.objectType==='Стрит-ритейл')return FRIENDLY_STREET;
    if(data?.objectType==='Другое'&&data?.objectTypeOther)return `Другое: ${data.objectTypeOther}`;
    return data?.objectType||'—';
  }

  function friendlyContactRole(data){
    if(data?.contactRole==='Другое'&&data?.contactRoleOther)return `Другое: ${data.contactRoleOther}`;
    return data?.contactRole||'—';
  }

  function replaceReportValue(section,label,value){
    const cell=[...section.querySelectorAll('.report-summary-grid > div')].find(item=>item.querySelector('b')?.textContent.trim()===label);
    if(!cell)return;
    const strong=cell.querySelector('b');
    cell.replaceChildren(strong,document.createTextNode(` ${value||'—'}`));
  }

  function addReportContacts(documentReport,section,data){
    section.querySelector('.report-landlord-v416')?.remove();
    const block=documentReport.createElement('section');
    block.className='report-landlord-v416';
    const heading=documentReport.createElement('h3');
    heading.textContent='Арендодатель и условия';
    const grid=documentReport.createElement('div');
    grid.className='report-landlord-grid-v416';
    const entries=[
      ['Собственник / организация',data.ownerName],['Роль контактного лица',friendlyContactRole(data)],
      ['Контактное лицо',data.contact],['Телефон',data.contactPhone],['Мессенджер',data.contactMessenger],
      ['Email',data.contactEmail],['Дополнительные условия',data.rentConditions],['Дополнительная информация',data.contactNotes],
    ];
    for(const [name,value] of entries){
      const item=documentReport.createElement('div');
      const strong=documentReport.createElement('b');
      strong.textContent=`${name}:`;
      item.append(strong,documentReport.createTextNode(` ${value||'—'}`));
      grid.appendChild(item);
    }
    block.append(heading,grid);
    section.querySelector('.report-summary-grid')?.insertAdjacentElement('afterend',block);
  }

  function installReportWrapper(){
    reportAttempts+=1;
    if(typeof window.buildReportHtml!=='function'){
      if(reportAttempts<80)setTimeout(installReportWrapper,250);
      return;
    }
    if(window.buildReportHtml.__locationProfileV425)return;
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
        const data=await getLocationData(id);
        replaceReportValue(section,'Тип объекта:',friendlyObjectType(data));
        addReportContacts(documentReport,section,data);
      }
      if(!documentReport.querySelector('#reportProfileStyleV416')){
        const style=documentReport.createElement('style');
        style.id='reportProfileStyleV416';
        style.textContent='.report-landlord-v416{margin:16px 0}.report-landlord-grid-v416{display:grid;grid-template-columns:1fr 1fr;gap:8px}.report-landlord-grid-v416>div{padding:9px;border:1px solid #dce6e0;border-radius:9px;background:#f7faf8;white-space:pre-wrap}@media(max-width:700px){.report-landlord-grid-v416{grid-template-columns:1fr}}';
        documentReport.head.appendChild(style);
      }
      return `<!doctype html>\n${documentReport.documentElement.outerHTML}`;
    };
    wrapped.__locationProfileV416=true;
    wrapped.__locationProfileV425=true;
    wrapped.__base=base;
    window.buildReportHtml=wrapped;
    try{buildReportHtml=wrapped}catch(_){}
  }

  async function enhanceAll(){
    enhanceModal();
    installHistoryLabels();
    installReportWrapper();
    for(const card of document.querySelectorAll('[data-location-card]'))await enhanceCard(card);
  }

  function schedule(delay=60){
    clearTimeout(timer);
    timer=setTimeout(()=>enhanceAll().catch(console.error),delay);
  }

  const observer=new MutationObserver(()=>schedule(70));
  function install(){
    const root=document.getElementById('locations')||document.body;
    observer.observe(root,{childList:true,subtree:true});
    schedule(20);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  window.addEventListener('load',()=>schedule(80),{once:true});

  window.BogatkaLocationProfileV416={
    version:VERSION,
    ready:true,
    enhanceAll,
    friendlyObjectType,
    friendlyContactRole,
    audit(){
      const cards=[...document.querySelectorAll('[data-location-card]')];
      const required=['status','objectType','date','time','contact','ownerName','contactRole','contactRoleOther','contactPhone','contactEmail','contactMessenger','rentConditions','contactNotes'];
      const failures=[];
      for(const card of cards){
        const id=card.dataset.locationCard;
        for(const field of required)if(!card.querySelector(`[data-location="${CSS.escape(id)}"][data-field="${field}"]`))failures.push(`${id}:${field}`);
        if(card.querySelector('.landlord-grid-v416 [data-field="rent"]'))failures.push(`${id}:duplicate-rent-visible`);
        const select=card.querySelector('[data-field="objectType"]');
        if(select&&![...select.options].some(option=>option.textContent===FRIENDLY_STREET))failures.push(`${id}:friendly-object-type-label`);
        const role=card.querySelector('[data-field="contactRole"]');
        if(role&&![...role.options].some(option=>option.value==='Другое'))failures.push(`${id}:contact-role-other-option`);
      }
      return {ok:failures.length===0,cards:cards.length,failures};
    },
  };
})();
