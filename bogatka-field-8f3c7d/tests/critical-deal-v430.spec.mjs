import {test,expect} from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=430';

async function openApp(page,{width=1440,height=1100}={}){
  await page.setViewportSize({width,height});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaCriticalDeal?.VERSION==='4.3.0'&&
    window.BogatkaDecisionEngine?.VERSION==='4.3.0'&&
    document.querySelector('[data-location-card] [data-critical-deal]')
  ),{timeout:20000});
}

function condition(card,key){
  return card.locator(`[data-critical-condition="${key}"]`);
}

test('canonical section renders eight ordered conditions and new option vocabularies',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const section=card.locator('[data-critical-deal]');
  await expect(section.locator('summary strong')).toHaveText('Критические условия сделки');
  await expect(section.locator('.critical-condition-card-v430')).toHaveCount(8);
  await expect(section.locator('.critical-condition-copy-v430 strong')).toHaveText([
    'Право сдачи помещения подтверждено',
    'На помещение нет прав третьих лиц и незавершённых споров',
    'Фактическая планировка соответствует документам',
    'Обязательства арендодателя до запуска и ответственность за задержку зафиксированы',
    'Срок аренды и условия расторжения защищают вложения',
    'Необходимые работы разрешены собственником письменно',
    'Формат и ассортимент зоомагазина разрешены правилами объекта',
    'Нет известных планов, способных сорвать работу точки',
  ]);
  await expect(section.locator('[data-critical-field="status"]').first().locator('option')).toHaveText([
    'Не проверено','Подтверждено','Нужно закрепить','Блокирует сделку','Не применимо',
  ]);
  await expect(section.locator('[data-critical-field="evidenceType"]').first().locator('option')).toHaveText([
    'Не подтверждено','Документ','Проект договора','Письмо / сообщение','Устное обещание','Иное',
  ]);
  await expect(section).not.toContainText('Нет проблемы');
  await expect(section).not.toContainText('Есть риск / уточнить');
  await expect(section).not.toContainText('Есть стоп-фактор');

  const layout=await section.locator('.critical-grid-v430').evaluate(element=>({
    columns:getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length,
    overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
  }));
  expect(layout.columns).toBe(2);
  expect(layout.overflow).toBeLessThanOrEqual(1);
});

test('conditions persist, validate and leave legacy stop factors and scores untouched',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const id=await card.getAttribute('data-location-card');
  const scoreBefore=await card.locator('.scorebox strong').textContent();
  const weightedBefore=await card.locator('[data-weighted-score]').textContent();

  await page.evaluate(async locationId=>{
    const data=await getLocationData(locationId);
    data.stopFactors={...(data.stopFactors||{}),legalUse:'block',legacyMarker:'preserve-me'};
    await idbPut(STORE,data,`location:${locationId}`);
  },id);

  const authority=condition(card,'leaseAuthority');
  await authority.locator('[data-critical-field="status"]').selectOption('confirmed');
  await expect(authority.locator('[data-critical-error]')).toHaveAttribute('data-message',/укажите основание/i);
  await authority.locator('[data-critical-field="evidenceType"]').selectOption('document');
  await authority.locator('[data-critical-field="note"]').fill('Получена выписка, собственник подтверждён.');
  await authority.locator('[data-critical-field="note"]').blur();

  const investment=condition(card,'investmentProtection');
  await investment.locator('[data-critical-field="status"]').selectOption('needs_formalization');
  await expect(investment.locator('[data-critical-error]')).toHaveAttribute('data-message',/Добавьте пояснение/);
  await investment.locator('[data-critical-field="evidenceType"]').selectOption('draft_contract');
  await investment.locator('[data-critical-field="note"]').fill('Добавить компенсацию неотделимых улучшений.');
  await investment.locator('[data-critical-field="note"]').blur();
  await expect(card.locator('[data-critical-gate]')).toHaveText('Продолжать только после письменного закрепления условий');

  const workApproval=condition(card,'writtenWorkApproval');
  await workApproval.locator('[data-critical-field="status"]').selectOption('blocked');
  await expect(workApproval.locator('[data-critical-error]')).toHaveAttribute('data-message',/Добавьте пояснение/);
  await workApproval.locator('[data-critical-field="evidenceType"]').selectOption('written_message');
  await workApproval.locator('[data-critical-field="note"]').fill('Арендодатель письменно отказал в установке внешнего блока кондиционера.');
  await workApproval.locator('[data-critical-field="note"]').blur();

  await expect(card.locator('[data-critical-gate]')).toHaveText('СТОП: есть условие, блокирующее сделку');
  await expect(card.locator('[data-recommendation]')).toHaveText('СТОП');
  await expect(card.locator('.scorebox strong')).toHaveText(scoreBefore||'0');
  await expect(card.locator('[data-weighted-score]')).toHaveText(weightedBefore||'0');

  await page.waitForFunction(async locationId=>{
    const data=await getLocationData(locationId);
    return data.criticalDealConditions?.leaseAuthority?.evidenceType==='document'&&
      data.criticalDealConditions?.investmentProtection?.note?.includes('компенсацию')&&
      data.criticalDealConditions?.writtenWorkApproval?.status==='blocked';
  },id);

  const stored=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(stored.stopFactors.legalUse).toBe('block');
  expect(stored.stopFactors.legacyMarker).toBe('preserve-me');

  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(locationId=>Boolean(document.querySelector(`[data-location-card="${CSS.escape(locationId)}"] [data-critical-deal]`)),id);
  const reloaded=page.locator(`[data-location-card="${id}"]`);
  await expect(condition(reloaded,'leaseAuthority').locator('[data-critical-field="status"]')).toHaveValue('confirmed');
  await expect(condition(reloaded,'leaseAuthority').locator('[data-critical-field="evidenceType"]')).toHaveValue('document');
  await expect(condition(reloaded,'leaseAuthority').locator('[data-critical-field="note"]')).toHaveValue('Получена выписка, собственник подтверждён.');
  await expect(reloaded.locator('[data-critical-gate]')).toHaveText('СТОП: есть условие, блокирующее сделку');
});

test('oral promise is normalized to formalization and not-applicable requires explanation',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const landlord=condition(card,'landlordObligations');
  await landlord.locator('[data-critical-field="status"]').selectOption('confirmed');
  await landlord.locator('[data-critical-field="evidenceType"]').selectOption('oral_promise');
  await expect(landlord.locator('[data-critical-field="status"]')).toHaveValue('needs_formalization');

  const plans=condition(card,'futureDisruptionPlans');
  await plans.locator('[data-critical-field="status"]').selectOption('not_applicable');
  await expect(plans.locator('[data-critical-error]')).toHaveAttribute('data-message',/Добавьте пояснение/);
  await plans.locator('[data-critical-field="note"]').fill('Для данного отдельно стоящего объекта условие не применимо.');
  await plans.locator('[data-critical-field="note"]').blur();
  await expect(plans.locator('[data-critical-error]')).toHaveAttribute('data-message','');
});

test('HTML and print report share the canonical eight-condition output',async({page})=>{
  await openApp(page);
  await page.waitForFunction(()=>window.BogatkaLiveReport?.build?.__reportStabilityV429,{timeout:20000});
  const id=await page.locator('[data-location-card]').first().getAttribute('data-location-card');
  await page.evaluate(async locationId=>{
    const data=await getLocationData(locationId);
    data.criticalDealConditions=Object.fromEntries(window.BogatkaCriticalDeal.CONDITIONS.map((item,index)=>[item.key,{
      status:index===0?'needs_formalization':'confirmed',
      evidenceType:index===0?'draft_contract':'document',
      note:index===0?'Добавить компенсацию неотделимых улучшений.':'',
      updatedAt:new Date().toISOString(),
      updatedBy:'CI',
    }]));
    await idbPut(STORE,data,`location:${locationId}`);
    await updateSummary();
  },id);

  const html=await page.evaluate(()=>window.buildReportHtml());
  expect(html).toContain('Критические условия сделки');
  for(const title of await page.evaluate(()=>window.BogatkaCriticalDeal.CONDITIONS.map(item=>item.title)))expect(html).toContain(title);
  expect(html).toContain('Нужно закрепить');
  expect(html).toContain('Проект договора');
  expect(html).toContain('Добавить компенсацию неотделимых улучшений.');
  expect(html).toContain('—');
  expect(html).not.toContain('Стоп-факторы');
  expect(html).not.toContain('Нет проблемы');
  expect(html).not.toContain('Есть риск / уточнить');
  expect(html).not.toContain('Есть стоп-фактор');
  expect(html).not.toContain('Проверить собственника, полномочия представителя');
  const parsed=await page.evaluate(source=>{
    const documentReport=new DOMParser().parseFromString(source,'text/html');
    const sections=[...documentReport.querySelectorAll('.critical-deal-v430')];
    return {
      cards:documentReport.querySelectorAll('.critical-condition-card-v430').length,
      sectionCounts:sections.map(section=>section.querySelectorAll('.critical-condition-card-v430').length),
      controls:documentReport.querySelectorAll('.critical-deal-v430 select,.critical-deal-v430 textarea').length,
      hasPrint:source.includes('@media print'),
    };
  },html);
  expect(parsed.cards).toBeGreaterThanOrEqual(8);
  expect(parsed.cards%8).toBe(0);
  expect(parsed.sectionCounts.length).toBeGreaterThan(0);
  expect(parsed.sectionCounts.every(count=>count===8)).toBe(true);
  expect(parsed.controls).toBe(0);
  expect(parsed.hasPrint).toBe(true);
});

test('viewer can read the section but cannot edit it',async({page})=>{
  await openApp(page);
  await page.evaluate(()=>{cloudRole='viewer'});
  const section=page.locator('[data-location-card]').first().locator('[data-critical-deal]');
  await expect(section).toBeVisible();
  await expect(section.locator('select').first()).toBeDisabled({timeout:5000});
  await expect(section.locator('textarea').first()).toBeDisabled();
});

test('mobile layout is single-column without horizontal overflow',async({page})=>{
  await openApp(page,{width:390,height:844});
  const grid=page.locator('[data-location-card]').first().locator('.critical-grid-v430');
  const layout=await grid.evaluate(element=>({
    columns:getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length,
    overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
  }));
  expect(layout.columns).toBe(1);
  expect(layout.overflow).toBeLessThanOrEqual(1);
  await expect(grid.locator('select').first()).toBeAttached();
  await expect(grid.locator('.premium-select-trigger').first()).toBeVisible();
  await expect(grid.locator('textarea').first()).toBeVisible();
});
