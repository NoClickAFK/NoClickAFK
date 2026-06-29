import {test,expect} from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=431';
const TITLES=[
  'Запросите документ, подтверждающий право сдавать помещение',
  'Уточните, нет ли других арендаторов, споров или ограничений',
  'Сверьте помещение с документами',
  'Зафиксируйте, что арендодатель должен сделать до передачи помещения',
  'Запросите проект договора аренды',
  'Получите письменное разрешение на необходимые работы',
  'Уточните, разрешён ли зоомагазин и нужный ассортимент',
  'Уточните, не планируются ли изменения, которые помешают работе',
];

async function openApp(page,{width=1440,height=1100}={}){
  await page.setViewportSize({width,height});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaCriticalDeal?.VERSION==='4.3.1'&&
    window.BogatkaDecisionEngine?.VERSION==='4.3.1'&&
    document.querySelector('[data-location-card] [data-critical-deal]')&&
    document.querySelector('[data-location-card] [data-collaboration]')&&
    document.querySelector('[data-location-card] .decision-panel-v412')
  ),{timeout:20000});
}

const condition=(card,key)=>card.locator(`[data-critical-condition="${key}"]`);

test('lease checks use simple wording and sit before the preliminary decision',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const section=card.locator('[data-critical-deal]');
  await expect(section.locator('summary strong')).toHaveText('Проверки перед арендой');
  await expect(section.locator('summary small')).toHaveText('Что нужно уточнить и получить от арендодателя перед авансом и подписанием договора.');
  await expect(section.locator('.critical-condition-copy-v430 strong')).toHaveText(TITLES);
  await expect(section.locator('[data-critical-field="status"]').first().locator('option')).toHaveText([
    'Не проверено','Подтверждено','Нужно подтвердить письменно','Блокирует аренду','Не относится',
  ]);
  await expect(section.locator('[data-critical-field="evidenceType"]').first().locator('option')).toHaveText([
    'Пока ничем','Документ','Проект договора','Письмо / сообщение','Устная договорённость','Другое',
  ]);
  await expect(section.locator('.critical-condition-help-v430').first()).toHaveAttribute('data-help',/собственник.*доверенность/s);
  const order=await card.evaluate(element=>{
    const children=[...element.querySelector(':scope > .location-body').children];
    return [
      children.indexOf(element.querySelector('[data-collaboration]')),
      children.indexOf(element.querySelector('[data-critical-deal]')),
      children.indexOf(element.querySelector('.decision-panel-v412')),
    ];
  });
  expect(order[1]).toBe(order[0]+1);
  expect(order[2]).toBe(order[1]+1);
});

test('lease checks persist and do not change legacy data or scores',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const id=await card.getAttribute('data-location-card');
  const scoreBefore=await card.locator('.scorebox strong').textContent();
  await page.evaluate(async locationId=>{
    const data=await getLocationData(locationId);
    data.stopFactors={legacyMarker:'preserve-me'};
    await idbPut(STORE,data,`location:${locationId}`);
  },id);
  const authority=condition(card,'leaseAuthority');
  await authority.locator('[data-critical-field="status"]').selectOption('confirmed');
  await expect(authority.locator('[data-critical-error]')).toHaveAttribute('data-message',/чем это подтверждено/i);
  await authority.locator('[data-critical-field="evidenceType"]').selectOption('document');
  await authority.locator('[data-critical-field="note"]').fill('Получена выписка.');
  const contract=condition(card,'investmentProtection');
  await contract.locator('[data-critical-field="status"]').selectOption('needs_formalization');
  await contract.locator('[data-critical-field="evidenceType"]').selectOption('draft_contract');
  await contract.locator('[data-critical-field="note"]').fill('Проект договора отправят на почту.');
  await contract.locator('[data-critical-field="note"]').blur();
  await expect(card.locator('[data-critical-gate]')).toHaveText('Продолжать можно только после письменного подтверждения');
  await page.waitForFunction(async locationId=>(await getLocationData(locationId)).criticalDealConditions?.investmentProtection?.note?.includes('почту'),id);
  const stored=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(stored.stopFactors.legacyMarker).toBe('preserve-me');
  await expect(card.locator('.scorebox strong')).toHaveText(scoreBefore||'0');
});

test('oral agreement requires written confirmation and a blocker overrides the recommendation',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const landlord=condition(card,'landlordObligations');
  await landlord.locator('[data-critical-field="status"]').selectOption('confirmed');
  await landlord.locator('[data-critical-field="evidenceType"]').selectOption('oral_promise');
  await expect(landlord.locator('[data-critical-field="status"]')).toHaveValue('needs_formalization');
  const works=condition(card,'writtenWorkApproval');
  await works.locator('[data-critical-field="status"]').selectOption('blocked');
  await works.locator('[data-critical-field="note"]').fill('Собственник запретил необходимую вентиляцию.');
  await works.locator('[data-critical-field="note"]').blur();
  await expect(card.locator('[data-critical-gate]')).toHaveText('СТОП: есть условие, которое не позволяет арендовать помещение');
  await expect(card.locator('[data-recommendation]')).toHaveText('СТОП');
});

test('reports and mobile layout use the new lease-check presentation',async({page})=>{
  await openApp(page,{width:390,height:844});
  const card=page.locator('[data-location-card]').first();
  const toggle=card.locator('.location-collapse-toggle-v422');
  if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
  const section=card.locator('[data-critical-deal]');
  await section.evaluate(element=>{element.open=true});
  const grid=section.locator('.critical-grid-v430');
  await expect(grid).toBeVisible();
  expect(await grid.evaluate(element=>getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length)).toBe(1);
  await expect(grid.locator('.premium-select-trigger').first()).toBeVisible();
  await page.waitForFunction(()=>window.BogatkaLiveReport?.build?.__reportStabilityV429,{timeout:20000});
  const html=await page.evaluate(()=>window.buildReportHtml());
  expect(html).toContain('Проверки перед арендой');
  expect(html).toContain('Чем подтверждено');
  expect(html).toContain('Комментарий / что ещё нужно получить');
  expect(html).not.toContain('Критические условия сделки');
  expect(html).not.toContain('Стоп-факторы');
});
