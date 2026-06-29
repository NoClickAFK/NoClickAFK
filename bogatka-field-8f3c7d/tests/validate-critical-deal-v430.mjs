import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve('bogatka-field-8f3c7d');
const source=fs.readFileSync(path.join(root,'critical-deal-schema-v430.js'),'utf8');
const context={window:{}};
vm.runInNewContext(source,context,{filename:'critical-deal-schema-v430.js'});
const deal=context.window.BogatkaCriticalDeal;
assert.ok(deal,'Canonical lease-check schema is not exported.');
assert.equal(deal.VERSION,'4.3.2');

const expectedKeys=[
  'leaseAuthority','investmentProtection','thirdPartyRights','documentedLayout','landlordObligations',
  'writtenWorkApproval','petStoreFormatApproval','futureDisruptionPlans','premisesCondition','additionalPayments'
];
const expectedTitles=[
  'Проверьте собственника помещения и уточните, кто подпишет договор',
  'Получите проект договора аренды',
  'Уточните, нет ли других арендаторов, споров или ограничений',
  'Сверьте фактическое помещение с техническими документами',
  'Зафиксируйте, что арендодатель должен сделать до передачи помещения',
  'Получите письменное разрешение на необходимые работы',
  'Уточните, разрешены ли зоомагазин и нужный ассортимент',
  'Уточните, нет ли планов, которые в дальнейшем могут помешать работе магазина',
  'Зафиксируйте состояние помещения и все имеющиеся недостатки',
  'Уточните все обязательные платежи кроме основной аренды'
];
assert.equal(deal.CONDITIONS.length,10);
assert.deepEqual([...deal.CONDITIONS.map(item=>item.key)],expectedKeys);
assert.deepEqual([...deal.CONDITIONS.map(item=>item.title)],expectedTitles);
assert.ok(deal.CONDITIONS.every(item=>item.help.length>120),'Each lease check needs a clear expanded explanation.');
assert.ok(deal.CONDITIONS.every(item=>item.evidenceLabel&&item.evidenceTypes.length>=6),'Each lease check needs its own evidence label and options.');
assert.deepEqual([...deal.STATUSES.map(item=>item.label)],['Не проверено','В работе / ждём ответ','Подтверждено','Нужно подтвердить письменно','Блокирует аренду']);
assert.deepEqual([...deal.STATUSES.map(item=>item.value)],['unchecked','in_progress','confirmed','needs_formalization','blocked']);
assert.equal(deal.STATUSES.some(item=>item.value==='not_applicable'),false);

assert.deepEqual([...deal.evidenceOptions('investmentProtection').map(item=>item.label)],[
  'Проект не получен','Проект получен','Наши правки отправлены','Правки и изменения обсуждаются','Проект согласован','Есть только устная договорённость','Другое'
]);
assert.deepEqual([...deal.evidenceOptions('documentedLayout').map(item=>item.label)],[
  'Пока ничем','Технический паспорт','Поэтажный план','Согласованная проектная документация','План помещения — приложение к договору','Письмо / сообщение','Другое'
]);
assert.equal(deal.evidenceOptions('leaseAuthority').some(item=>item.label==='Проект договора'),false);

const legacyNotApplicable=deal.normalizeCondition({status:'not_applicable',evidenceType:'written_message',note:'Старый комментарий'},'leaseAuthority');
assert.equal(legacyNotApplicable.status,'unchecked');
assert.equal(legacyNotApplicable.note,'Старый комментарий');
assert.equal(deal.normalizeCondition({status:'confirmed',evidenceType:'draft_contract'},'investmentProtection').evidenceType,'draft_received');
assert.equal(deal.normalizeCondition({status:'confirmed',evidenceType:'oral_promise'},'landlordObligations').evidenceType,'oral_agreement');

assert.equal(deal.validateCondition({status:'confirmed',evidenceType:'not_confirmed',note:''},'leaseAuthority').valid,false);
assert.equal(deal.validateCondition({status:'confirmed',evidenceType:'oral_agreement',note:'Обещано устно'},'leaseAuthority').valid,false);
assert.equal(deal.validateCondition({status:'confirmed',evidenceType:'ownership_information',note:''},'leaseAuthority').valid,true);
assert.equal(deal.validateCondition({status:'in_progress',evidenceType:'not_confirmed',note:''},'leaseAuthority').valid,false);
assert.equal(deal.validateCondition({status:'in_progress',evidenceType:'not_confirmed',note:'Ждём доверенность'},'leaseAuthority').valid,true);
assert.equal(deal.validateCondition({status:'confirmed',evidenceType:'other',note:''},'leaseAuthority').valid,false);
assert.equal(deal.validateCondition({status:'confirmed',evidenceType:'other',note:'Подтверждено другим документом'},'leaseAuthority').valid,true);

const data={stopFactors:{legacyMarker:'preserve'},criticalDealConditions:{}};
const legacy=JSON.stringify(data.stopFactors);
assert.equal(deal.evaluate(data).code,'incomplete');
assert.equal(deal.evaluate(data).badge,'10 не проверено');
assert.equal(JSON.stringify(data.stopFactors),legacy);
data.criticalDealConditions=Object.fromEntries(deal.CONDITIONS.map(definition=>[
  definition.key,
  {status:'confirmed',evidenceType:definition.evidenceTypes.find(item=>item.value!=='not_confirmed'&&!deal.isOralEvidence(item.value)&&item.value!=='other').value,note:''}
]));
assert.equal(deal.evaluate(data).text,'Все проверки перед арендой пройдены');
data.criticalDealConditions.investmentProtection={status:'needs_formalization',evidenceType:'draft_received',note:'Нужно согласовать правки'};
assert.equal(deal.evaluate(data).text,'Продолжать можно только после письменного подтверждения');
data.criticalDealConditions.writtenWorkApproval={status:'blocked',evidenceType:'written_message',note:'Работы запрещены'};
assert.equal(deal.evaluate(data).text,'СТОП: есть условие, которое не позволяет арендовать помещение');

const ui=fs.readFileSync(path.join(root,'decision-ui-v340.js'),'utf8');
const css=fs.readFileSync(path.join(root,'critical-deal-v430.css'),'utf8');
const report=fs.readFileSync(path.join(root,'report/fix-v400.js'),'utf8');
const comparison=fs.readFileSync(path.join(root,'compare-v430.js'),'utf8');
assert.ok(ui.includes('evidenceOptions'));
assert.ok(ui.includes('evidenceLabel'));
assert.ok(ui.includes('schemaVersion'));
assert.ok(!ui.includes('section.open=true'));
assert.ok(css.includes("content:'▶'"));
assert.ok(css.includes('.launch-project-v400>summary'));
assert.ok(css.includes('.economy-v400>summary'));
assert.ok(report.includes('entry.definition.evidenceLabel'));
assert.ok(report.includes('deal.evidenceLabel(entry.value.evidenceType,entry.definition)'));
assert.ok(comparison.includes('Перед арендой'));
console.log('Lease checks v432 validation passed.');
