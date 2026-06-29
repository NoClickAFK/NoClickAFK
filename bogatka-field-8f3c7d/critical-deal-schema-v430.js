(function(){
  'use strict';
  if(window.BogatkaCriticalDeal)return;

  const VERSION='4.3.1';
  const CONDITIONS=[
    {key:'leaseAuthority',title:'Запросите документ, подтверждающий право сдавать помещение',help:'Попросите выписку или другой документ, где указан собственник помещения. Если переговоры ведёт не собственник, попросите доверенность или другой документ, который разрешает этому человеку подписывать договор аренды.'},
    {key:'thirdPartyRights',title:'Уточните, нет ли других арендаторов, споров или ограничений',help:'Спросите, занято ли помещение сейчас, есть ли действующий договор аренды или субаренды, судебный спор, арест или другое ограничение. Попросите подтвердить ответ документом, если это возможно.'},
    {key:'documentedLayout',title:'Сверьте помещение с документами',help:'Попросите план помещения. Сравните с ним площадь, входы, стены, перегородки и другие изменения. Если помещение переделывали, уточните, оформлены ли эти изменения официально.'},
    {key:'landlordObligations',title:'Зафиксируйте, что арендодатель должен сделать до передачи помещения',help:'Составьте список работ и документов, которые должен подготовить арендодатель. Укажите точные сроки и что будет, если он задержит ремонт, электричество, доступ, документы или другие обещанные работы.'},
    {key:'investmentProtection',title:'Запросите проект договора аренды',help:'Попросите отправить проект договора на почту или в мессенджер. Проверьте срок аренды, продление, повышение арендной платы, досрочное расторжение, возврат депозита и компенсацию вложений в ремонт.'},
    {key:'writtenWorkApproval',title:'Получите письменное разрешение на необходимые работы',help:'Перечислите все изменения, которые нужны для магазина: ремонт, вывеска, кондиционер, вентиляция, перегородки, проводка и оборудование. Получите письменное согласие собственника на каждую важную работу.'},
    {key:'petStoreFormatApproval',title:'Уточните, разрешён ли зоомагазин и нужный ассортимент',help:'Спросите, можно ли открыть в этом помещении зоомагазин, продавать нужные товары, хранить корм и работать в выбранном режиме. Если у объекта есть свои правила, попросите показать их.'},
    {key:'futureDisruptionPlans',title:'Уточните, не планируются ли изменения, которые помешают работе',help:'Спросите о будущем ремонте, реконструкции, продаже объекта, закрытии входов, изменении парковки или других планах. Важно понять, не станет ли помещение неудобным или недоступным после открытия.'}
  ];
  const STATUSES=[
    {value:'unchecked',label:'Не проверено'},
    {value:'confirmed',label:'Подтверждено'},
    {value:'needs_formalization',label:'Нужно подтвердить письменно'},
    {value:'blocked',label:'Блокирует аренду'},
    {value:'not_applicable',label:'Не относится'}
  ];
  const EVIDENCE_TYPES=[
    {value:'not_confirmed',label:'Пока ничем'},
    {value:'document',label:'Документ'},
    {value:'draft_contract',label:'Проект договора'},
    {value:'written_message',label:'Письмо / сообщение'},
    {value:'oral_promise',label:'Устная договорённость'},
    {value:'other',label:'Другое'}
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
    if(condition.status==='confirmed'&&condition.evidenceType==='not_confirmed')errors.push('Для статуса «Подтверждено» укажите, чем это подтверждено.');
    if(condition.status==='confirmed'&&condition.evidenceType==='oral_promise')errors.push('Устной договорённости недостаточно. Выберите «Нужно подтвердить письменно».');
    if(['needs_formalization','blocked','not_applicable'].includes(condition.status)&&empty(condition.note))errors.push('Добавьте пояснение в поле «Комментарий / что ещё нужно получить».');
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
    let text='Все проверки перед арендой пройдены';
    let compactText='Подтверждено';
    let className='confirmed';
    let priority=0;
    if(counts.blocked){
      code='blocked';text='СТОП: есть условие, которое не позволяет арендовать помещение';compactText='СТОП';className='blocked';priority=4;
    }else if(counts.needs_formalization){
      code='needs_formalization';text='Продолжать можно только после письменного подтверждения';compactText='Нужно письменно';className='needs-formalization';priority=3;
    }else if(pending){
      code='incomplete';text='Проверки перед арендой пройдены не полностью';compactText='Не полностью';className='incomplete';priority=2;
    }
    const badge=counts.blocked
      ?`${counts.blocked} блокирует аренду`
      :counts.needs_formalization
        ?`${counts.needs_formalization} нужно подтвердить письменно`
        :pending
          ?`${pending} не проверено`
          :'Все проверки пройдены';
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
