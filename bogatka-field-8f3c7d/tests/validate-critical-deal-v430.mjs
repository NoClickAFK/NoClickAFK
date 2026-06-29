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
assert.equal(deal.VERSION,'4.3.1');

const expectedTitles=[
  'Запросите документ, подтверждающий право сдавать помещение',
  'Уточните, нет ли других арендаторов, споров или ограничений',
  'Сверьте помещение с документами',
  'Зафиксируйте, что арендодатель должен сделать до передачи помещения',
  'Запросите проект договора аренды',
  'Получите письменное разрешение на необходимые работы',
  'Уточните, разрешён ли зоомагазин и нужный ассортимент',
  'Уточните, не планируются ли изменения, которые помешают работе',
];
const expectedKeys=['leaseAuthority','thirdPartyRights','documentedLayout','landlordObligations','investmentProtection','writtenWorkApproval','petStoreFormatApproval','futureDisruptionPlans'];
assert.equal(deal.CONDITIONS.length,8);
assert.deepEqual([...deal.CONDITIONS.map(item=>item.key)],expectedKeys);
assert.deepEqual([...deal.CONDITIONS.map(item=>item.title)],expectedTitles);
assert.ok(deal.CONDITIONS.every(item=>item.help.length>100),'Each lease check needs a clear, expanded explanation.');
assert.deepEqual([...deal.STATUSES.map(item=>item.label)],['Не проверено','Подтверждено','Нужно подтвердить письменно','Блокирует аренду','Не относится']);
assert.deepEqual([...deal.EVIDENCE_TYPES.map(item=>item.label)],['Пока ничем','Документ','Проект договора','Письмо / сообщение','Устная договорённость','Другое']);
assert.deepEqual([...deal.STATUSES.map(item=>item.value)],['unchecked','confirmed','needs_formalization','blocked','not_applicable']);
assert.deepEqual([...deal.EVIDENCE_TYPES.map(item=>item.value)],['not_confirmed','document','draft_contract','written_message','oral_promise','other']);

assert.equal(deal.validateCondition({status:'confirmed',evidenceType:'not_confirmed',note:''}).valid,false);
assert.equal(deal.validateCondition({status:'confirmed',evidenceType:'oral_promise',note:'Обещано устно'}).valid,false);
assert.equal(deal.validateCondition({status:'confirmed',evidenceType:'document',note:''}).valid,true);
for(const status of ['needs_formalization','blocked','not_applicable']){
  assert.equal(deal.validateCondition({status,evidenceType:'other',note:''}).valid,false);
  assert.equal(deal.validateCondition({status,evidenceType:'other',note:'Пояснение'}).valid,true);
}

const data={stopFactors:{legacyMarker:'preserve'},criticalDealConditions:{}};
const legacy=JSON.stringify(data.stopFactors);
assert.equal(deal.evaluate(data).code,'incomplete');
assert.equal(JSON.stringify(data.stopFactors),legacy);
data.criticalDealConditions=Object.fromEntries(expectedKeys.map(key=>[key,{status:'confirmed',evidenceType:'document',note:''}]));
assert.equal(deal.evaluate(data).text,'Все проверки перед арендой пройдены');
data.criticalDealConditions.investmentProtection={status:'needs_formalization',evidenceType:'draft_contract',note:'Ждём проект договора'};
assert.equal(deal.evaluate(data).text,'Продолжать можно только после письменного подтверждения');
data.criticalDealConditions.writtenWorkApproval={status:'blocked',evidenceType:'written_message',note:'Работы запрещены'};
assert.equal(deal.evaluate(data).text,'СТОП: есть условие, которое не позволяет арендовать помещение');

const ui=fs.readFileSync(path.join(root,'decision-ui-v340.js'),'utf8');
const report=fs.readFileSync(path.join(root,'report/fix-v400.js'),'utf8');
const reportStability=fs.readFileSync(path.join(root,'report-stability-v429.js'),'utf8');
const comparison=fs.readFileSync(path.join(root,'compare-v430.js'),'utf8');
assert.ok(ui.includes('Проверки перед арендой'));
assert.ok(ui.includes('Комментарий / что ещё нужно получить'));
assert.ok(ui.includes('data-collaboration'));
assert.ok(ui.includes("decision-panel-v412,.decision"));
assert.ok(report.includes('Проверки перед арендой'));
assert.ok(report.includes('left.gate.priority-right.gate.priority'));
assert.ok(reportStability.includes("querySelectorAll('.stop-factors-v340')"));
assert.ok(reportStability.includes('Чем подтверждено'));
assert.ok(comparison.includes('Перед арендой'));
console.log('Lease checks v431 validation passed.');
