(function(){
  'use strict';
  const deal=window.BogatkaCriticalDeal;
  if(!deal||window.__bogatkaCriticalDealRefineV433)return;
  window.__bogatkaCriticalDealRefineV433=true;
  const option=(value,label)=>({value,label});
  const byKey=new Map(deal.CONDITIONS.map(item=>[item.key,item]));
  const setOptions=(key,items)=>{byKey.get(key).evidenceTypes=items.map(([value,label])=>option(value,label));};

  byKey.get('leaseAuthority').title='Уточните, кто собственник помещения и кто будет подписывать договор';
  byKey.get('leaseAuthority').help='Узнайте, на кого зарегистрировано помещение и кто подпишет договор аренды. Если договор подписывает не сам собственник и не руководитель организации-собственника, запросите доверенность с правом заключать договор аренды. Если помещение сдаётся в субаренду, запросите подтверждение, что собственник это разрешил.';
  byKey.get('investmentProtection').statusLabels={unchecked:'Не выполнено',in_progress:'В работе / ждём проект договора',confirmed:'Выполнено',needs_formalization:'Нужен письменный проект договора',blocked:'Блокирует аренду'};
  byKey.get('investmentProtection').help='Попросите отправить проект договора на почту или в мессенджер. Проверьте срок аренды, условия продления, порядок повышения арендной платы, условия досрочного расторжения, а также возврата депозита и компенсации вложений в ремонт, если такие вложения планируются.';
  byKey.get('thirdPartyRights').help='Нужно узнать, свободно ли помещение сейчас, нет ли действующего договора аренды или субаренды, залога, ареста, судебного спора либо других ограничений. Попросите подтвердить ответ письменно.';
  byKey.get('landlordObligations').title='Зафиксируйте, что арендодатель должен сделать до передачи помещения';
  byKey.get('landlordObligations').help='Составьте точный список работ и документов, которые должен подготовить арендодатель до передачи помещения (ремонт, электрика, устранение недостатков, технический паспорт, акт передачи помещения и пр.). Укажите, что именно он должен сделать и к какой дате. Отдельно отметьте работы, без которых нельзя начинать ремонт или готовить магазин к открытию.';
  byKey.get('writtenWorkApproval').help='Перечислите все изменения, которые необходимы вам для открытия магазина (ремонт, вывеска, кондиционер, вентиляция, перегородки, проводка, оборудование и пр.). Получите письменное согласование собственника на каждую важную работу до начала ремонта.';
  byKey.get('petStoreFormatApproval').title='Уточните, разрешено ли открыть зоомагазин и продавать нужный ассортимент';
  byKey.get('petStoreFormatApproval').help='Проверьте, можно ли использовать помещение для розничной торговли и открыть в нём зоомагазин. Ограничения могут быть связаны с назначением помещения, правилами торгового центра, санитарными требованиями или условиями собственника — например, с хранением кормов, продажей животных либо отдельных категорий товаров. Также подтвердите, что разрешены нужный ассортимент и выбранный режим работы.';
  setOptions('investmentProtection',[
    ['not_confirmed','Проект договора не получен'],['draft_received','Проект договора получен'],['amendments_sent','Наши правки отправлены'],['amendments_discussed','Правки и изменения обсуждаются'],['draft_agreed','Проект договора согласован'],['oral_agreement','Есть только устная договорённость'],['other','Другое']
  ]);
  setOptions('documentedLayout',[
    ['not_confirmed','Пока ни с какими'],['technical_passport','Технический паспорт'],['floor_plan','Поэтажный план'],['approved_project_docs','Согласованная проектная документация'],['contract_plan_attachment','План помещения — приложение к договору'],['written_message','Письмо / сообщение'],['other','Другое']
  ]);
  setOptions('landlordObligations',[
    ['not_confirmed','Пока нигде'],['agreed_work_list','Согласованный перечень работ'],['work_schedule','График выполнения работ'],['landlord_letter','Письмо / сообщение собственника или арендодателя'],['contract_clause_attachment','Пункт договора / приложение'],['oral_agreement','Устная договорённость'],['other','Другое']
  ]);
  setOptions('writtenWorkApproval',[
    ['not_confirmed','Пока нигде'],['owner_written_approval','Письменное согласование собственника'],['agreed_work_list','Согласованный перечень работ'],['approved_plan','Согласованный план / схема'],['contract_clause_attachment','Пункт договора / приложение'],['oral_agreement','Устная договорённость'],['other','Другое']
  ]);
  setOptions('premisesCondition',[
    ['not_confirmed','Пока нигде'],['photo_video','Фото и видео'],['inspection_act','Акт осмотра помещения'],['agreed_defect_list','Согласованный перечень недостатков'],['transfer_act','Акт передачи помещения'],['written_message','Письмо / сообщение'],['oral_agreement','Устная договорённость'],['other','Другое']
  ]);

  const baseNormalize=deal.normalizeCondition.bind(deal);
  const baseValidate=deal.validateCondition.bind(deal);
  const baseEvaluate=deal.evaluate.bind(deal);
  const legacy={landlordObligations:{written_message:'landlord_letter'},writtenWorkApproval:{written_message:'owner_written_approval'}};
  const definition=value=>value&&typeof value==='object'?value:byKey.get(String(value||''));
  const mappedValue=(value,keyOrDefinition)=>{
    const def=definition(keyOrDefinition);
    const source=value&&typeof value==='object'?value:{};
    const mapped=legacy[def?.key]?.[source.evidenceType];
    return mapped?{...source,evidenceType:mapped}:source;
  };
  const contextualErrors=(errors,def)=>def?.key==='investmentProtection'?errors.map(message=>message.replace('«Подтверждено»','«Выполнено»').replace('«Нужно подтвердить письменно»','«Нужен письменный проект договора»')):errors;
  deal.normalizeCondition=(value,keyOrDefinition)=>baseNormalize(mappedValue(value,keyOrDefinition),keyOrDefinition);
  deal.validateCondition=(value,keyOrDefinition)=>{
    const def=definition(keyOrDefinition);
    const result=baseValidate(mappedValue(value,def),def);
    return {...result,errors:contextualErrors(result.errors,def)};
  };
  deal.isCompleted=(value,keyOrDefinition)=>{const result=deal.validateCondition(value,keyOrDefinition);return result.valid&&!['unchecked','in_progress'].includes(result.condition.status);};
  deal.evaluate=data=>{
    const source=data?.criticalDealConditions||{};
    const copy={...data,criticalDealConditions:{...source}};
    for(const key of Object.keys(legacy))copy.criticalDealConditions[key]=mappedValue(source[key],key);
    const gate=baseEvaluate(copy);
    gate.entries=gate.entries.map(entry=>entry.definition.key==='investmentProtection'?{...entry,validation:{...entry.validation,errors:contextualErrors(entry.validation.errors,entry.definition)}}:entry);
    return gate;
  };
  deal.statusOptions=keyOrDefinition=>{
    const def=definition(keyOrDefinition);
    return deal.STATUSES.map(item=>option(item.value,def?.statusLabels?.[item.value]||item.label));
  };
  deal.statusLabel=(value,keyOrDefinition)=>deal.statusOptions(keyOrDefinition).find(item=>item.value===value)?.label||'Не проверено';
  deal.VERSION='4.3.3';
})();
