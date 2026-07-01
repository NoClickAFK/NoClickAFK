import {test,expect} from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=451';

const EXPECTED_SCORE_LABELS=[
  'Плотность жилой застройки',
  'Фактическая заселённость района',
  'Интенсивность пешеходного потока',
  'Удобство автомобильного подъезда',
  'Доступность общественного транспорта',
  'Поток от соседних объектов',
  'Удобство парковки',
  'Заметность входа и фасада',
  'Видимость будущей вывески',
  'Удобство разгрузки и перемещения товара',
  'Соответствие помещения формату магазина',
  'Простота подготовки помещения к запуску',
  'Качество складской и подсобной зоны',
  'Общий потенциал локации',
];

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaLocationEvaluationRefineV446?.ready&&
    window.BogatkaLandlordConditionsV449?.ready&&
    window.BogatkaQuickChecklistV451?.ready&&
    window.BogatkaQuickChecklistV451.audit().ok&&
    document.querySelector('[data-location-card] .score-table')&&
    document.querySelector('[data-location-card] [data-field="rentConditions"]')
  ),{timeout:25000});
}

test('quick checklist contains only on-site facts and preserves hidden legacy values',async({page})=>{
  await openApp(page);
  const definitions=await page.evaluate(()=>({
    groups:[...new Set(CHECKLIST.map(item=>item[2]))],
    keys:CHECKLIST.map(item=>item[0]),
    labels:CHECKLIST.map(item=>item[1]),
  }));

  expect(definitions.groups).toEqual([
    'Район и спрос','Якоря и окружение','Вход и фасад','Логистика','Помещение','Инженерия','Безопасность','Специфика зоотоваров',
  ]);
  expect(definitions.groups).not.toContain('Юридические условия');
  expect(definitions.groups).not.toContain('Конкуренция');
  expect(definitions.groups).not.toContain('Аренда');
  expect(definitions.keys).not.toContain('ground_floor');
  expect(definitions.keys).not.toContain('delivery_route');
  expect(definitions.keys).not.toContain('humidity_control');
  expect(definitions.labels).toContain('Есть заметное место для вывески');
  expect(definitions.labels).toContain('Можно выделить достаточно места под склад');
  expect(definitions.labels).toContain('Есть сухая зона хранения кормов со стабильной температурой');

  const card=page.locator('[data-location-card]').first();
  const checklist=card.locator('details').filter({has:page.locator('summary:text-is("Быстрый чек-лист")')});
  await checklist.locator(':scope > summary').click();
  await expect(checklist.locator('.check-row')).toHaveCount(definitions.keys.length);
  const headings=await checklist.locator('.check-group h4').evaluateAll(nodes=>nodes.map(node=>node.firstChild?.textContent?.trim()||''));
  expect(headings).toEqual(definitions.groups);
  await expect(checklist.locator('.check-group-progress-v451')).toHaveCount(definitions.groups.length);

  const locationId=await card.getAttribute('data-location-card');
  await page.evaluate(async id=>{
    const data=await getLocationData(id);
    data.check={...(data.check||{}),allowed_use:true,rent_reasonable:true,no_door_competitor:true,ground_floor:true};
    await idbPut(STORE,data,`location:${id}`);
  },locationId);
  await page.reload({waitUntil:'networkidle'});
  const stored=await page.evaluate(id=>getLocationData(id),locationId);
  expect(stored.check.allowed_use).toBe(true);
  expect(stored.check.rent_reasonable).toBe(true);
  expect(stored.check.no_door_competitor).toBe(true);
  expect(stored.check.ground_floor).toBe(true);
});

test('comparative evaluation keeps fourteen five-point criteria and the approved wording',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const scoreSection=card.locator('details').filter({has:page.locator('summary:text-is("Сравнительная оценка потенциала локации — 70 баллов")')});
  await expect(scoreSection).toHaveCount(1);
  if(!(await scoreSection.evaluate(element=>element.open)))await scoreSection.locator(':scope > summary').click();

  const scoreState=await page.evaluate(()=>({
    count:SCORES.length,
    keys:SCORES.map(item=>item[0]),
    labels:SCORES.map(item=>item[1]),
    maximum:SCORES.length*5,
  }));
  expect(scoreState.count).toBe(14);
  expect(scoreState.maximum).toBe(70);
  expect(scoreState.labels).toEqual(EXPECTED_SCORE_LABELS);
  expect(scoreState.keys).toEqual(['housing','occupied','foot','car','stop','anchor','parking','visibility','sign','loading','competition','condition','storage','overall']);

  await expect(scoreSection.locator('.score-label-v414 > strong')).toHaveText(EXPECTED_SCORE_LABELS);
  await expect(scoreSection.locator('.score-guide-v331 p')).toHaveText('Чек-лист подтверждает наличие конкретных условий, а оценка помогает сравнить локации по спросу, потоку, доступности, заметности и пригодности помещения.');
  await expect(scoreSection.locator('.score-guide-note-v331')).toContainText('ставьте балл только после проверки факта');
  await expect(scoreSection.locator('.score-guide-note-v331')).not.toContainText('Слабость конкурентов рядом');
  await expect(scoreSection.locator('select[data-field^="score."]')).toHaveCount(14);
  await expect(card.locator('.scorebox small')).toContainText('/ 70');

  await expect(scoreSection.locator('[data-field="score.competition"]').locator('xpath=ancestor::tr').locator('.score-label-v414 > strong')).toHaveText('Соответствие помещения формату магазина');
  await expect(scoreSection.locator('[data-field="score.condition"]').locator('xpath=ancestor::tr').locator('.score-label-v414 > strong')).toHaveText('Простота подготовки помещения к запуску');

  const comparison=page.locator('#locationComparisonPanel');
  await expect(comparison).toHaveCount(1);
  if(!(await comparison.evaluate(element=>element.open)))await comparison.locator(':scope > summary').click();
  await expect(comparison.locator('thead')).toContainText('Соответствие формату');
  await expect(comparison.locator('thead')).not.toContainText('Конкуренты');
});

test('traffic, landlord proposal and competitor labels use the approved copy',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();

  const traffic=card.locator('[data-field="traffic.dogWalkers"]');
  await expect(traffic.locator('xpath=ancestor::label')).toContainText('Люди с собаками за 30 минут');

  const rentConditions=card.locator('[data-field="rentConditions"]');
  await expect(rentConditions.locator('xpath=ancestor::label').locator(':scope > .profile-caption-v416,:scope > .evaluation-caption-v446')).toHaveText('Что предварительно предложил арендодатель');
  await expect(rentConditions).toHaveAttribute('placeholder','Ставка, депозит, каникулы, коммунальные платежи, индексация, ремонт, срок аренды');

  const competitor=card.locator('[data-field="competitor.name"]');
  await expect(competitor.locator('xpath=ancestor::label').locator(':scope > .evaluation-caption-v446')).toHaveText('Ближайший прямой конкурент');
});
