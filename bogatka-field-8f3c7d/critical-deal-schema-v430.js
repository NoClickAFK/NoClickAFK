(function(){
  'use strict';
  if(window.BogatkaCriticalDeal)return;

  const VERSION='4.3.2';
  const option=(value,label)=>({value,label});
  const baseEvidence=[option('not_confirmed','Пока ничем')];
  const evidence=(specific,{oral=true}={})=>[
    ...baseEvidence,
    ...specific,
    option('written_message','Письмо / сообщение'),
    ...(oral?[option('oral_agreement','Устная договорённость')]:[]),
    option('other','Другое')
  ];

  const CONDITIONS=[
    {
      key:'leaseAuthority',
      title:'Проверьте собственника помещения и уточните, кто подпишет договор',
      help:'Уточните, на кого зарегистрировано помещение и кто будет подписывать договор аренды. Если договор подписывает не сам собственник и не руководитель организации-собственника, запросите доверенность с правом заключать договор аренды. Если помещение сдаётся в субаренду, запросите подтверждение, что собственник это разрешил.',
      evidenceLabel:'Чем подтверждены собственник и право подписи',
      evidenceTypes:evidence([
        option('ownership_information','Сведения о собственнике помещения'),
        option('power_of_attorney','Доверенность'),
        option('sublease_consent','Разрешение собственника на субаренду'),
        option('owner_written_confirmation','Письменное подтверждение собственника')
      ])
    },
    {
      key:'investmentProtection',
      title:'Получите проект договора аренды',
      help:'Попросите отправить проект договора на почту или в мессенджер. Проверьте срок аренды, условия продления, повышение арендной платы, досрочное расторжение, возврат депозита и компенсацию вложений в ремонт, если такие вложения планируются.',
      evidenceLabel:'На каком этапе проект договора',
      evidenceTypes:[
        option('not_confirmed','Проект не получен'),
        option('draft_received','Проект получен'),
        option('amendments_sent','Наши правки отправлены'),
        option('amendments_discussed','Правки и изменения обсуждаются'),
        option('draft_agreed','Проект согласован'),
        option('oral_agreement','Есть только устная договорённость'),
        option('other','Другое')
      ]
    },
    {
      key:'thirdPartyRights',
      title:'Уточните, нет ли других арендаторов, споров или ограничений',
      help:'Уточните, занято ли помещение сейчас, есть ли действующий договор аренды или субаренды, залог, арест, судебный спор или другое ограничение. Попросите подтвердить ответ письменно.',
      evidenceLabel:'Чем подтверждено отсутствие проблем',
      evidenceTypes:evidence([
        option('landlord_written_confirmation','Письменное подтверждение арендодателя'),
        option('sublease_consent','Разрешение собственника на субаренду'),
        option('contract_warranty','Гарантия арендодателя в договоре')
      ])
    },
    {
      key:'documentedLayout',
      title:'Сверьте фактическое помещение с техническими документами',
      help:'Попросите технический паспорт и план помещения. Сравните площадь, входы, стены, перегородки и подсобные помещения. Если помещение переделывали, уточните, оформлены ли эти изменения официально.',
      evidenceLabel:'С какими документами сверили помещение',
      evidenceTypes:evidence([
        option('technical_passport','Технический паспорт'),
        option('floor_plan','Поэтажный план'),
        option('approved_project_docs','Согласованная проектная документация'),
        option('contract_plan_attachment','План помещения — приложение к договору')
      ],{oral:false})
    },
    {
      key:'landlordObligations',
      title:'Зафиксируйте, что арендодатель должен сделать до передачи помещения',
      help:'Составьте точный список работ и документов, которые должен подготовить арендодатель до передачи помещения. Укажите, что именно он должен сделать и к какой дате. Отдельно отметьте работы, без которых нельзя начинать ремонт или готовить магазин к открытию.',
      evidenceLabel:'Где зафиксированы работы и сроки',
      evidenceTypes:evidence([
        option('agreed_work_list','Согласованный перечень работ'),
        option('work_schedule','График выполнения работ'),
        option('landlord_letter','Письмо собственника или арендодателя'),
        option('contract_clause_attachment','Пункт договора / приложение')
      ])
    },
    {
      key:'writtenWorkApproval',
      title:'Получите письменное разрешение на необходимые работы',
      help:'Перечислите все изменения, которые нужны для магазина: ремонт, вывеска, кондиционер, вентиляция, перегородки, проводка и оборудование. Получите письменное согласование собственника на каждую важную работу.',
      evidenceLabel:'Где согласованы работы',
      evidenceTypes:evidence([
        option('owner_written_approval','Письменное согласование собственника'),
        option('agreed_work_list','Согласованный перечень работ'),
        option('approved_plan','Согласованный план / схема'),
        option('contract_clause_attachment','Пункт договора / приложение')
      ])
    },
    {
      key:'petStoreFormatApproval',
      title:'Уточните, разрешены ли зоомагазин и нужный ассортимент',
      help:'Уточните, можно ли использовать это помещение для розничной торговли. Отдельно спросите, разрешают ли собственник и правила объекта открыть зоомагазин, продавать нужные товары, хранить корм и работать в выбранном режиме.',
      evidenceLabel:'Чем подтверждено разрешение',
      evidenceTypes:evidence([
        option('technical_use','Назначение помещения в технических документах'),
        option('object_rules','Правила объекта / торгового центра'),
        option('landlord_written_consent','Письменное согласие арендодателя'),
        option('permitted_use_clause','Пункт договора о разрешённом использовании')
      ])
    },
    {
      key:'futureDisruptionPlans',
      title:'Уточните, нет ли планов, которые в дальнейшем могут помешать работе магазина',
      help:'Спросите о будущем ремонте, реконструкции, продаже объекта, закрытии входов, изменении парковки или режима доступа. Важно понять, не станет ли помещение неудобным или недоступным после открытия.',
      evidenceLabel:'Чем подтверждён ответ',
      evidenceTypes:evidence([
        option('owner_written_response','Письменный ответ собственника'),
        option('management_company_response','Ответ управляющей компании'),
        option('repair_plan','План / график ремонта или реконструкции'),
        option('access_compensation_clause','Условие договора о доступе и компенсации')
      ])
    },
    {
      key:'premisesCondition',
      title:'Зафиксируйте состояние помещения и все имеющиеся недостатки',
      help:'Осмотрите помещение и запишите всё, что уже повреждено или работает плохо. Проверьте протечки, сырость, плесень, электричество, отопление, вентиляцию, пол, стены, потолок, окна и двери. Сделайте фотографии и отметьте, какие недостатки должен устранить собственник, а какие останутся без изменений.',
      evidenceLabel:'Где зафиксировано состояние помещения',
      evidenceTypes:evidence([
        option('photo_video','Фото и видео'),
        option('inspection_act','Акт осмотра помещения'),
        option('agreed_defect_list','Согласованный перечень недостатков'),
        option('transfer_act','Акт передачи помещения')
      ])
    },
    {
      key:'additionalPayments',
      title:'Уточните все обязательные платежи кроме основной аренды',
      help:'Попросите полный список дополнительных платежей. Уточните стоимость коммунальных услуг, эксплуатации здания, охраны, уборки, вывоза отходов, рекламы торгового центра, обслуживания общей территории и парковки. Отдельно спросите о сезонных, разовых и других платежах, которые могут появиться после открытия. Узнайте, как рассчитываются эти суммы и могут ли они меняться.',
      evidenceLabel:'Чем подтверждены платежи',
      evidenceTypes:evidence([
        option('additional_cost_calculation','Расчёт дополнительных платежей'),
        option('previous_bills','Счета за прошлые месяцы'),
        option('tariffs_rules','Тарифы / правила объекта'),
        option('contract_clause_attachment','Пункт договора / приложение')
      ])
    }
  ];

  const STATUSES=[
    option('unchecked','Не проверено'),
    option('in_progress','В работе / ждём ответ'),
    option('confirmed','Подтверждено'),
    option('needs_formalization','Нужно подтвердить письменно'),
    option('blocked','Блокирует аренду')
  ];
  const conditionMap=new Map(CONDITIONS.map(item=>[item.key,item]));
  const statusValues=new Set(STATUSES.map(item=>item.value));
  const statusLabels=Object.fromEntries(STATUSES.map(item=>[item.value,item.label]));
  const EVIDENCE_TYPES=[...new Map(CONDITIONS.flatMap(item=>item.evidenceTypes).map(item=>[item.value,item])).values()];
  const empty=value=>String(value??'').trim()==='';
  const LEGACY_EVIDENCE_MAP={
    document:{
      leaseAuthority:'ownership_information',
      investmentProtection:'draft_received',
      thirdPartyRights:'landlord_written_confirmation',
      documentedLayout:'technical_passport',
      landlordObligations:'agreed_work_list',
      writtenWorkApproval:'owner_written_approval',
      petStoreFormatApproval:'landlord_written_consent',
      futureDisruptionPlans:'owner_written_response'
    },
    draft_contract:{
      leaseAuthority:'owner_written_confirmation',
      investmentProtection:'draft_received',
      thirdPartyRights:'contract_warranty',
      documentedLayout:'contract_plan_attachment',
      landlordObligations:'contract_clause_attachment',
      writtenWorkApproval:'contract_clause_attachment',
      petStoreFormatApproval:'permitted_use_clause',
      futureDisruptionPlans:'access_compensation_clause'
    },
    written_message:{investmentProtection:'draft_received'}
  };

  function definitionOf(keyOrDefinition){
    if(keyOrDefinition&&typeof keyOrDefinition==='object')return keyOrDefinition;
    return conditionMap.get(String(keyOrDefinition||''))||null;
  }

  function evidenceOptions(keyOrDefinition){
    return definitionOf(keyOrDefinition)?.evidenceTypes||EVIDENCE_TYPES;
  }

  function defaultCondition(){
    return {status:'unchecked',evidenceType:'not_confirmed',note:'',updatedAt:null,updatedBy:null};
  }

  function normalizeStatus(value){
    if(value==='not_applicable')return 'unchecked';
    return statusValues.has(value)?value:'unchecked';
  }

  function normalizeEvidence(value,keyOrDefinition){
    const definition=definitionOf(keyOrDefinition);
    let normalized=value;
    if(normalized==='oral_promise')normalized='oral_agreement';
    const mapped=LEGACY_EVIDENCE_MAP[normalized]?.[definition?.key];
    if(mapped)normalized=mapped;
    const allowed=new Set(evidenceOptions(definition).map(item=>item.value));
    return allowed.has(normalized)?normalized:'not_confirmed';
  }

  function normalizeCondition(value,keyOrDefinition){
    const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    return {
      status:normalizeStatus(source.status),
      evidenceType:normalizeEvidence(source.evidenceType,keyOrDefinition),
      note:String(source.note??''),
      updatedAt:source.updatedAt||null,
      updatedBy:source.updatedBy||null
    };
  }

  function normalizeState(data){
    const source=data?.criticalDealConditions&&typeof data.criticalDealConditions==='object'?data.criticalDealConditions:{};
    return Object.fromEntries(CONDITIONS.map(definition=>[definition.key,normalizeCondition(source[definition.key],definition)]));
  }

  function isOralEvidence(value){return value==='oral_agreement'||value==='oral_promise';}

  function validateCondition(value,keyOrDefinition){
    const definition=definitionOf(keyOrDefinition);
    const condition=normalizeCondition(value,definition);
    const errors=[];
    if(condition.status==='confirmed'&&condition.evidenceType==='not_confirmed')errors.push('Для статуса «Подтверждено» выберите подходящее подтверждение.');
    if(condition.status==='confirmed'&&isOralEvidence(condition.evidenceType))errors.push('Устной договорённости недостаточно. Выберите «Нужно подтвердить письменно».');
    if(['in_progress','needs_formalization','blocked'].includes(condition.status)&&empty(condition.note))errors.push('Добавьте пояснение в поле «Комментарий / что ещё нужно получить».');
    if(condition.evidenceType==='other'&&empty(condition.note))errors.push('Для варианта «Другое» обязательно добавьте комментарий.');
    return {valid:errors.length===0,errors,condition};
  }

  function isCompleted(value,keyOrDefinition){
    const validation=validateCondition(value,keyOrDefinition);
    return validation.valid&&!['unchecked','in_progress'].includes(validation.condition.status);
  }

  function evaluate(data){
    const state=normalizeState(data);
    const entries=CONDITIONS.map(definition=>({definition,value:state[definition.key],validation:validateCondition(state[definition.key],definition)}));
    const counts={unchecked:0,in_progress:0,confirmed:0,needs_formalization:0,blocked:0,invalid:0,completed:0};
    for(const entry of entries){
      counts[entry.value.status]+=1;
      if(!entry.validation.valid)counts.invalid+=1;
      if(isCompleted(entry.value,entry.definition))counts.completed+=1;
    }
    const invalidCompletion=entries.filter(entry=>!entry.validation.valid&&!['blocked','needs_formalization','in_progress'].includes(entry.value.status)).length;
    const pending=counts.unchecked+counts.in_progress+invalidCompletion;
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
      code='incomplete';text='Проверки перед арендой пройдены не полностью';compactText=`${pending} не завершено`;className='incomplete';priority=2;
    }
    let badge='Все проверки пройдены';
    if(counts.blocked)badge=`${counts.blocked} блокирует аренду`;
    else if(counts.needs_formalization)badge=`${counts.needs_formalization} нужно подтвердить письменно`;
    else if(counts.unchecked&&counts.in_progress)badge=`${counts.unchecked} не проверено · ${counts.in_progress} в работе`;
    else if(counts.unchecked)badge=`${counts.unchecked} не проверено`;
    else if(counts.in_progress)badge=`${counts.in_progress} в работе`;
    else if(invalidCompletion)badge=`${invalidCompletion} нужно уточнить`;
    return {state,entries,counts,pending,code,text,compactText,className,priority,badge};
  }

  function statusLabel(value){return statusLabels[normalizeStatus(value)]||statusLabels.unchecked;}
  function evidenceLabel(value,keyOrDefinition){
    const normalized=normalizeEvidence(value,keyOrDefinition);
    const labels=Object.fromEntries(evidenceOptions(keyOrDefinition).map(item=>[item.value,item.label]));
    return labels[normalized]||labels.not_confirmed||'Пока ничем';
  }

  window.BogatkaCriticalDeal={
    VERSION,
    CONDITIONS,
    STATUSES,
    EVIDENCE_TYPES,
    defaultCondition,
    definitionOf,
    evidenceOptions,
    normalizeCondition,
    normalizeState,
    validateCondition,
    isCompleted,
    isOralEvidence,
    evaluate,
    statusLabel,
    evidenceLabel
  };
})();
