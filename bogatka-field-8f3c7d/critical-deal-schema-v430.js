(function(){
  'use strict';
  if(window.BogatkaCriticalDeal)return;

  const VERSION='4.3.0';
  const CONDITIONS=[
    {key:'leaseAuthority',title:'Право сдачи помещения подтверждено',help:'Проверить собственника, полномочия представителя и право подписывать договор аренды.'},
    {key:'thirdPartyRights',title:'На помещение нет прав третьих лиц и незавершённых споров',help:'Проверить действующих арендаторов, субарендаторов, споры и иные права на помещение.'},
    {key:'documentedLayout',title:'Фактическая планировка соответствует документам',help:'Сверить площадь, входы, перегородки и перепланировку с техническими документами.'},
    {key:'landlordObligations',title:'Обязательства арендодателя до запуска и ответственность за задержку зафиксированы',help:'Зафиксировать работы, документы, сроки и последствия задержки со стороны арендодателя.'},
    {key:'investmentProtection',title:'Срок аренды и условия расторжения защищают вложения',help:'Проверить срок договора, продление, досрочное расторжение и защиту вложений.'},
    {key:'writtenWorkApproval',title:'Необходимые работы разрешены собственником письменно',help:'Получить письменное разрешение на ремонт, инженерные работы, вывеску и оборудование.'},
    {key:'petStoreFormatApproval',title:'Формат и ассортимент зоомагазина разрешены правилами объекта',help:'Проверить ограничения объекта на формат магазина, ассортимент и хранение товара.'},
    {key:'futureDisruptionPlans',title:'Нет известных планов, способных сорвать работу точки',help:'Уточнить реконструкцию, ремонт, продажу объекта, закрытие входов и другие будущие изменения.'}
  ];
  const STATUSES=[
    {value:'unchecked',label:'Не проверено'},
    {value:'confirmed',label:'Подтверждено'},
    {value:'needs_formalization',label:'Нужно закрепить'},
    {value:'blocked',label:'Блокирует сделку'},
    {value:'not_applicable',label:'Не применимо'}
  ];
  const EVIDENCE_TYPES=[
    {value:'not_confirmed',label:'Не подтверждено'},
    {value:'document',label:'Документ'},
    {value:'draft_contract',label:'Проект договора'},
    {value:'written_message',label:'Письмо / сообщение'},
    {value:'oral_promise',label:'Устное обещание'},
    {value:'other',label:'Иное'}
  ];
  const statusValues=new Set(STATUSES.map(item=>item.value));
  const evidenceValues=new Set(EVIDENCE_TYPES.map(item=>item.value));
  const statusLabels=Object.fromEntries(STATUSES.map(item=>[item.value,item.label]));
  const evidenceLabels=Object.fromEntries(EVIDENCE_TYPES.map(item=>[item.value,item.label]));
  const empty=value=>String(value??'').trim()==='';

  function defaultCondition(){
    return {status:'unchecked',evidenceType:'not_confirmed',note:'',updatedAt:null,updatedBy:null};
  }

  function normalizeCondition(value){
    const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    return {
      status:statusValues.has(source.status)?source.status:'unchecked',
      evidenceType:evidenceValues.has(source.evidenceType)?source.evidenceType:'not_confirmed',
      note:String(source.note??''),
      updatedAt:source.updatedAt||null,
      updatedBy:source.updatedBy||null
    };
  }

  function normalizeState(data){
    const source=data?.criticalDealConditions&&typeof data.criticalDealConditions==='object'?data.criticalDealConditions:{};
    return Object.fromEntries(CONDITIONS.map(condition=>[condition.key,normalizeCondition(source[condition.key])]));
  }

  function validateCondition(value){
    const condition=normalizeCondition(value);
    const errors=[];
    if(condition.status==='confirmed'&&condition.evidenceType==='not_confirmed')errors.push('Для статуса «Подтверждено» укажите основание.');
    if(condition.status==='confirmed'&&condition.evidenceType==='oral_promise')errors.push('Устное обещание нельзя считать подтверждением. Выберите «Нужно закрепить».');
    if(['needs_formalization','blocked','not_applicable'].includes(condition.status)&&empty(condition.note))errors.push('Добавьте пояснение в поле «Основание / что требуется закрепить».');
    return {valid:errors.length===0,errors,condition};
  }

  function isCompleted(value){
    const validation=validateCondition(value);
    return validation.valid&&validation.condition.status!=='unchecked';
  }

  function evaluate(data){
    const state=normalizeState(data);
    const entries=CONDITIONS.map(definition=>({definition,value:state[definition.key],validation:validateCondition(state[definition.key])}));
    const counts={unchecked:0,confirmed:0,needs_formalization:0,blocked:0,not_applicable:0,invalid:0,completed:0};
    for(const entry of entries){
      counts[entry.value.status]+=1;
      if(!entry.validation.valid)counts.invalid+=1;
      if(isCompleted(entry.value))counts.completed+=1;
    }
    const invalidCompletion=entries.filter(entry=>!entry.validation.valid&&!['blocked','needs_formalization'].includes(entry.value.status)).length;
    const pending=counts.unchecked+invalidCompletion;
    let code='confirmed';
    let text='Критические условия сделки подтверждены';
    let compactText='Подтверждено';
    let className='confirmed';
    let priority=0;
    if(counts.blocked){
      code='blocked';text='СТОП: есть условие, блокирующее сделку';compactText='СТОП';className='blocked';priority=4;
    }else if(counts.needs_formalization){
      code='needs_formalization';text='Продолжать только после письменного закрепления условий';compactText='Нужно закрепить';className='needs-formalization';priority=3;
    }else if(pending){
      code='incomplete';text='Критические условия проверены не полностью';compactText='Не полностью';className='incomplete';priority=2;
    }
    const badge=counts.blocked
      ?`${counts.blocked} блокирует сделку`
      :counts.needs_formalization
        ?`${counts.needs_formalization} нужно закрепить`
        :pending
          ?`${pending} не проверено`
          :'Все условия подтверждены';
    return {state,entries,counts,pending,code,text,compactText,className,priority,badge};
  }

  function statusLabel(value){return statusLabels[value]||statusLabels.unchecked;}
  function evidenceLabel(value){return evidenceLabels[value]||evidenceLabels.not_confirmed;}

  window.BogatkaCriticalDeal={
    VERSION,
    CONDITIONS,
    STATUSES,
    EVIDENCE_TYPES,
    defaultCondition,
    normalizeCondition,
    normalizeState,
    validateCondition,
    isCompleted,
    evaluate,
    statusLabel,
    evidenceLabel
  };
})();
