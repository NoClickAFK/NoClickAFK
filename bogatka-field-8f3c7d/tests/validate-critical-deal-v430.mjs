import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve('bogatka-field-8f3c7d');
const source=fs.readFileSync(path.join(root,'critical-deal-schema-v430.js'),'utf8');
const context={window:{}};
vm.runInNewContext(source,context,{filename:'critical-deal-schema-v430.js'});
const deal=context.window.BogatkaCriticalDeal;
assert.ok(deal,'Canonical critical-deal schema is not exported.');

const expectedTitles=[
  'Право сдачи помещения подтверждено',
  'На помещение нет прав третьих лиц и незавершённых споров',
  'Фактическая планировка соответствует документам',
  'Обязательства арендодателя до запуска и ответственность за задержку зафиксированы',
  'Срок аренды и условия расторжения защищают вложения',
  'Необходимые работы разрешены собственником письменно',
  'Формат и ассортимент зоомагазина разрешены правилами объекта',
  'Нет известных планов, способных сорвать работу точки',
];
const expectedKeys=['leaseAuthority','thirdPartyRights','documentedLayout','landlordObligations','investmentProtection','writtenWorkApproval','petStoreFormatApproval','futureDisruptionPlans'];
assert.equal(deal.CONDITIONS.length,8);
assert.deepEqual([...deal.CONDITIONS.map(item=>item.key)],expectedKeys);
assert.deepEqual([...deal.CONDITIONS.map(item=>item.title)],expectedTitles);
assert.equal(new Set(deal.CONDITIONS.map(item=>item.key)).size,8);
assert.deepEqual([...deal.STATUSES.map(item=>item.value)],['unchecked','confirmed','needs_formalization','blocked','not_applicable']);
assert.deepEqual([...deal.EVIDENCE_TYPES.map(item=>item.value)],['not_confirmed','document','draft_contract','written_message','oral_promise','other']);

assert.equal(deal.validateCondition({status:'confirmed',evidenceType:'not_confirmed',note:''}).valid,false);
assert.equal(deal.validateCondition({status:'confirmed',evidenceType:'oral_promise',note:'Обещано устно'}).valid,false);
assert.equal(deal.validateCondition({status:'confirmed',evidenceType:'document',note:''}).valid,true);
for(const status of ['needs_formalization','blocked','not_applicable']){
  assert.equal(deal.validateCondition({status,evidenceType:'other',note:''}).valid,false,`${status} must require a note`);
  assert.equal(deal.validateCondition({status,evidenceType:'other',note:'Пояснение'}).valid,true,`${status} must accept a note`);
}

const data={stopFactors:{legalUse:'block'},criticalDealConditions:{}};
const legacy=JSON.stringify(data.stopFactors);
assert.equal(deal.evaluate(data).code,'incomplete');
assert.equal(JSON.stringify(data.stopFactors),legacy,'Legacy stopFactors were mutated.');

data.criticalDealConditions=Object.fromEntries(expectedKeys.map(key=>[key,{status:'confirmed',evidenceType:'document',note:''}]));
assert.equal(deal.evaluate(data).code,'confirmed');
data.criticalDealConditions.futureDisruptionPlans={status:'not_applicable',evidenceType:'other',note:'Для отдельно стоящего объекта не применимо'};
assert.equal(deal.evaluate(data).code,'confirmed');
data.criticalDealConditions.writtenWorkApproval={status:'unchecked',evidenceType:'not_confirmed',note:''};
assert.equal(deal.evaluate(data).code,'incomplete');
data.criticalDealConditions.investmentProtection={status:'needs_formalization',evidenceType:'draft_contract',note:'Добавить компенсацию'};
assert.equal(deal.evaluate(data).code,'needs_formalization');
data.criticalDealConditions.leaseAuthority={status:'blocked',evidenceType:'document',note:'Подписант не уполномочен'};
assert.equal(deal.evaluate(data).code,'blocked');
assert.equal(deal.evaluate(data).text,'СТОП: есть условие, блокирующее сделку');

const ui=fs.readFileSync(path.join(root,'decision-ui-v340.js'),'utf8');
const report=fs.readFileSync(path.join(root,'report/fix-v400.js'),'utf8');
const reportStability=fs.readFileSync(path.join(root,'report-stability-v429.js'),'utf8');
const comparison=fs.readFileSync(path.join(root,'compare-v430.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.ok(ui.includes('Критические условия сделки'));
assert.ok(!ui.includes('Нет проблемы'));
assert.ok(!ui.includes('Есть риск / уточнить'));
assert.ok(!ui.includes('Есть стоп-фактор'));
assert.ok(report.includes('deal.CONDITIONS')||report.includes('gate.entries'));
assert.ok(report.includes('left.gate.priority-right.gate.priority'),'Public report must rank blocked deals after non-blocked deals.');
assert.ok(reportStability.includes("querySelectorAll('.stop-factors-v340')"),'Final HTML/PDF report must remove legacy stop-factor blocks.');
assert.ok(comparison.includes('Условия сделки'));
const schemaIndex=index.indexOf('./critical-deal-schema-v430.js');
const loaderIndex=index.indexOf('./v23.js');
assert.ok(schemaIndex>=0&&loaderIndex>=0&&schemaIndex<loaderIndex,'Canonical schema must load before the dynamic patch loader.');
console.log('Critical deal v430 validation passed.');
