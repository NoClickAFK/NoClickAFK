import {test,expect} from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=440';
const TITLES=[
  'Уточните, кто собственник помещения и кто будет подписывать договор',
  'Получите проект договора аренды',
  'Уточните, нет ли других арендаторов, споров или ограничений',
  'Сверьте фактическое помещение с техническими документами',
  'Зафиксируйте, что арендодатель должен сделать до передачи помещения',
  'Получите письменное разрешение на необходимые работы',
  'Уточните, разрешено ли открыть зоомагазин и продавать нужный ассортимент',
  'Уточните, нет ли планов, которые в дальнейшем могут помешать работе магазина',
  'Зафиксируйте состояние помещения и все имеющиеся недостатки',
  'Уточните все обязательные платежи кроме основной аренды',
];

async function openApp(page,{width=1440,height=1100}={}){
  await page.setViewportSize({width,height});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaCriticalDeal?.VERSION==='4.3.3'&&
    window.BogatkaDecisionEngine&&
    document.querySelector('[data-location-card] [data-critical-deal]')&&
    document.querySelector('[data-location-card] [data-collaboration]')&&
    document.querySelector('[data-location-card] [data-economy-details]')&&
    document.querySelector('[data-location-card] [data-launch-details]')&&
    document.querySelector('[data-location-card] .decision-panel-v412')
  ),{timeout:20000});
}

const condition=(card,key)=>card.locator(`[data-critical-condition="${key}"]`);

async function expandLeaseChecks(card){
  const section=card.locator('[data-critical-deal]');
  if(!(await section.evaluate(element=>element.open)))await section.locator(':scope > summary').click();
  await expect(section.locator('.critical-grid-v430')).toBeVisible();
  return section;
}

test('ten tailored lease checks are collapsed and use the same accordion presentation',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const section=card.locator('[data-critical-deal]');
  await expect(section).not.toHaveAttribute('open','');
  await expect(section.locator('summary strong')).toHaveText('Проверки перед арендой');
  await expect(section.locator('summary small')).toHaveText('Что нужно уточнить и получить от арендодателя перед авансом и подписанием договора.');
  await expect(section.locator('[data-critical-summary]')).toHaveText('10 не проверено');
  await section.locator(':scope > summary').click();
  await expect(section.locator('.critical-condition-copy-v430 strong')).toHaveText(TITLES);
  await expect(section.locator('.critical-condition-card-v430')).toHaveCount(10);
  const statusOptions=section.locator('[data-critical-field="status"]').first().locator('option');
  await expect(statusOptions).toHaveText(['Не проверено','В работе / ждём ответ','Подтверждено','Нужно подтвердить письменно','Блокирует аренду']);
  expect(await statusOptions.allTextContents()).not.toContain('Не относится');

  const authority=condition(card,'leaseAuthority');
  await expect(authority.locator('[data-critical-field="evidenceType"] option')).toHaveText([
    'Пока ничем','Сведения о собственнике помещения','Доверенность','Разрешение собственника на субаренду','Письменное подтверждение собственника','Письмо / сообщение','Устная договорённость','Другое',
  ]);
  const contract=condition(card,'investmentProtection');
  await expect(contract.locator('[data-critical-field="status"] option')).toHaveText([
    'Не выполнено','В работе / ждём проект договора','Выполнено','Нужен письменный проект договора','Блокирует аренду',
  ]);
  await expect(contract.locator('[data-critical-field="evidenceType"] option')).toHaveText([
    'Проект договора не получен','Проект договора получен','Наши правки отправлены','Правки и изменения обсуждаются','Проект договора согласован','Есть только устная договорённость','Другое',
  ]);
  await expect(condition(card,'documentedLayout').locator('[data-critical-field="evidenceType"] option').first()).toHaveText('Пока ни с какими');
  await expect(condition(card,'landlordObligations').locator('[data-critical-field="evidenceType"] option')).toHaveText([
    'Пока нигде','Согласованный перечень работ','График выполнения работ','Письмо / сообщение собственника или арендодателя','Пункт договора / приложение','Устная договорённость','Другое',
  ]);
  await expect(condition(card,'writtenWorkApproval').locator('[data-critical-field="evidenceType"] option')).toHaveText([
    'Пока нигде','Письменное согласование собственника','Согласованный перечень работ','Согласованный план / схема','Пункт договора / приложение','Устная договорённость','Другое',
  ]);
  await expect(condition(card,'premisesCondition').locator('[data-critical-field="evidenceType"] option').first()).toHaveText('Пока нигде');

  const order=await card.evaluate(element=>{
    const children=[...element.querySelector(':scope > .location-body').children];
    return [children.indexOf(element.querySelector('[data-critical-deal]')),children.indexOf(element.querySelector('[data-collaboration]')),children.indexOf(element.querySelector('.decision-panel-v412'))];
  });
  expect(order[1]).toBe(order[0]+1);
  expect(order[2]).toBe(order[1]+1);

  const presentation=await card.evaluate(element=>{
    const lease=element.querySelector('[data-critical-deal]>summary');
    const economy=element.querySelector('[data-economy-details]>summary');
    const launch=element.querySelector('[data-launch-details]>summary');
    const collaboration=element.querySelector('[data-collaboration]>summary');
    return {
      leaseArrow:getComputedStyle(lease,'::before').content,
      economyArrow:getComputedStyle(economy,'::before').content,
      launchArrow:getComputedStyle(launch,'::before').content,
      leaseDisplay:getComputedStyle(lease).display,
      economyDisplay:getComputedStyle(economy).display,
      launchDisplay:getComputedStyle(launch).display,
      leaseFont:getComputedStyle(lease).fontSize,
      collaborationFont:getComputedStyle(collaboration).fontSize,
      economyStatusAlign:getComputedStyle(element.querySelector('[data-economy-status]')).justifySelf,
    };
  });
  expect(presentation.leaseArrow).toContain('▶');
  expect(presentation.economyArrow).toContain('▶');
  expect(presentation.launchArrow).toContain('▶');
  expect(presentation.leaseDisplay).toBe('grid');
  expect(presentation.economyDisplay).toBe('grid');
  expect(presentation.launchDisplay).toBe('grid');
  expect(presentation.leaseFont).toBe(presentation.collaborationFont);
  expect(presentation.economyStatusAlign).toBe('end');
});

test('tailored answers persist without changing scores or legacy stop factors',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const id=await card.getAttribute('data-location-card');
  const scoreBefore=await card.locator('.scorebox strong').textContent();
  await page.evaluate(async locationId=>{
    const data=await getLocationData(locationId);
    data.stopFactors={...(data.stopFactors||{}),legacyMarker:'preserve-me'};
    await idbPut(STORE,data,`location:${locationId}`);
  },id);
  await expandLeaseChecks(card);
  await condition(card,'leaseAuthority').locator('[data-critical-field="status"]').selectOption('confirmed');
  await condition(card,'leaseAuthority').locator('[data-critical-field="evidenceType"]').selectOption('ownership_information');
  await condition(card,'investmentProtection').locator('[data-critical-field="status"]').selectOption('in_progress');
  await condition(card,'investmentProtection').locator('[data-critical-field="evidenceType"]').selectOption('amendments_discussed');
  await condition(card,'investmentProtection').locator('[data-critical-field="note"]').fill('Обсуждаем срок аренды и возврат депозита.');
  await condition(card,'additionalPayments').locator('[data-critical-field="status"]').selectOption('confirmed');
  await condition(card,'additionalPayments').locator('[data-critical-field="evidenceType"]').selectOption('additional_cost_calculation');
  await condition(card,'additionalPayments').locator('[data-critical-field="note"]').fill('Получен расчёт всех дополнительных платежей.');
  await condition(card,'additionalPayments').locator('[data-critical-field="note"]').blur();
  await page.waitForFunction(async locationId=>{
    const data=await getLocationData(locationId);
    return data.criticalDealConditions?.leaseAuthority?.evidenceType==='ownership_information'&&data.criticalDealConditions?.investmentProtection?.evidenceType==='amendments_discussed'&&data.criticalDealConditions?.additionalPayments?.status==='confirmed';
  },id);
  const stored=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(stored.stopFactors.legacyMarker).toBe('preserve-me');
  await expect(card.locator('.scorebox strong')).toHaveText(scoreBefore||'0');
});

test('legacy values are shown safely without rewriting raw data',async({page})=>{
  await openApp(page);
  const id=await page.locator('[data-location-card]').first().getAttribute('data-location-card');
  await page.evaluate(async locationId=>{
    const data=await getLocationData(locationId);
    data.criticalDealConditions={...(data.criticalDealConditions||{}),
      futureDisruptionPlans:{status:'not_applicable',evidenceType:'written_message',note:'Старый комментарий сохранён.'},
      investmentProtection:{status:'confirmed',evidenceType:'draft_contract',note:'Проект был получен ранее.'},
      landlordObligations:{status:'confirmed',evidenceType:'written_message',note:'Работы были согласованы сообщением.'},
      writtenWorkApproval:{status:'confirmed',evidenceType:'written_message',note:'Согласование было получено сообщением.'},
    };
    await idbPut(STORE,data,`location:${locationId}`);
  },id);
  await page.reload({waitUntil:'networkidle'});
  const card=page.locator(`[data-location-card="${id}"]`);
  await expandLeaseChecks(card);
  await expect(condition(card,'futureDisruptionPlans').locator('[data-critical-field="status"]')).toHaveValue('unchecked');
  await expect(condition(card,'investmentProtection').locator('[data-critical-field="evidenceType"]')).toHaveValue('draft_received');
  await expect(condition(card,'landlordObligations').locator('[data-critical-field="evidenceType"]')).toHaveValue('landlord_letter');
  await expect(condition(card,'writtenWorkApproval').locator('[data-critical-field="evidenceType"]')).toHaveValue('owner_written_approval');
  const raw=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(raw.criticalDealConditions.futureDisruptionPlans.status).toBe('not_applicable');
  expect(raw.criticalDealConditions.landlordObligations.evidenceType).toBe('written_message');
  expect(raw.criticalDealConditions.writtenWorkApproval.evidenceType).toBe('written_message');
});

test('oral agreement requires writing and a blocker overrides recommendation',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  await expandLeaseChecks(card);
  const landlord=condition(card,'landlordObligations');
  await landlord.locator('[data-critical-field="status"]').selectOption('confirmed');
  await landlord.locator('[data-critical-field="evidenceType"]').selectOption('oral_agreement');
  await expect(landlord.locator('[data-critical-field="status"]')).toHaveValue('needs_formalization');
  const works=condition(card,'writtenWorkApproval');
  await works.locator('[data-critical-field="status"]').selectOption('blocked');
  await works.locator('[data-critical-field="note"]').fill('Собственник запретил необходимую вентиляцию.');
  await works.locator('[data-critical-field="note"]').blur();
  await expect(card.locator('[data-critical-gate]')).toHaveText('СТОП: есть условие, которое не позволяет арендовать помещение');
  await expect(card.locator('[data-recommendation]')).toHaveText('СТОП');
});

test('reports viewer mode and mobile layout support all ten checks',async({page})=>{
  await openApp(page,{width:390,height:844});
  const card=page.locator('[data-location-card]').first();
  const toggle=card.locator('.location-collapse-toggle-v422');
  if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
  const section=await expandLeaseChecks(card);
  const grid=section.locator('.critical-grid-v430');
  expect(await grid.evaluate(element=>getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length)).toBe(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.waitForFunction(()=>window.BogatkaLiveReport?.build?.__reportStabilityV429,{timeout:20000});
  const html=await page.evaluate(()=>window.buildReportHtml());
  expect(html).toContain('Уточните, кто собственник помещения и кто будет подписывать договор');
  expect(html).toContain('Проверки перед арендой');
  await page.evaluate(()=>{cloudRole='viewer'});
  await expect(section.locator('select').first()).toBeDisabled({timeout:5000});
  await expect(section.locator('textarea').first()).toBeDisabled();
});
