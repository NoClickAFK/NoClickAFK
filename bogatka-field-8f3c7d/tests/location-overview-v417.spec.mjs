import { test, expect } from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=418';

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.BogatkaLocationProfileV416?.ready&&window.BogatkaLocationOverviewV417?.ready&&window.BogatkaObjectTypeNormalizeV416?.ready);
  await page.waitForFunction(()=>document.querySelector('[data-location-card] [data-overview-field="floorLocation"]'));
}

async function openPanel(card,kind){
  const button=card.locator(`.profile-accordion-${kind}-v418 > .profile-accordion-toggle-v418`);
  if(await button.getAttribute('aria-expanded')!=='true')await button.click();
  await expect(button).toHaveAttribute('aria-expanded','true');
}

test('object type no longer reverts to Other after choosing another option',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  await openPanel(card,'inspection');
  const id=await card.getAttribute('data-location-card');
  const select=card.locator('[data-field="objectType"]');
  const other=card.locator('[data-field="objectTypeOther"]');

  await select.selectOption('Другое');
  await page.waitForTimeout(700);
  await expect(other).toBeVisible();
  await other.fill('Помещение при АЗС');
  await page.waitForTimeout(700);

  await select.selectOption('Торговый центр');
  await page.waitForTimeout(1200);
  await expect(select).toHaveValue('Торговый центр');
  await expect(other).toBeHidden();

  const saved=await page.evaluate(async locationId=>getLocationData(locationId),id);
  expect(saved.objectType).toBe('Торговый центр');
});

test('other object type label is precise and survives reload',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  await openPanel(card,'inspection');
  const id=await card.getAttribute('data-location-card');
  await card.locator('[data-field="objectType"]').selectOption('Другое');
  await page.waitForTimeout(700);
  await card.locator('[data-field="objectTypeOther"]').fill('Нестандартный павильон');
  await page.waitForTimeout(700);
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.BogatkaLocationOverviewV417?.ready&&document.querySelector('[data-location-card] [data-overview-field="floorLocation"]'));

  const reloaded=page.locator(`[data-location-card="${id}"]`);
  await openPanel(reloaded,'inspection');
  await expect(reloaded.locator('[data-field="objectType"]')).toHaveValue('Другое');
  await expect(reloaded.locator('[data-object-other] .profile-caption-v416')).toHaveText('Уточните другой тип объекта');
  await expect(reloaded.locator('[data-field="objectTypeOther"]')).toBeVisible();
  await expect(reloaded.locator('[data-field="objectTypeOther"]')).toHaveValue('Нестандартный павильон');
});

test('panels are separate accordions and collapsed by default',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const inspection=card.locator('.profile-accordion-inspection-v418 > .profile-accordion-toggle-v418');
  const landlord=card.locator('.profile-accordion-landlord-v418 > .profile-accordion-toggle-v418');

  await expect(inspection).toHaveAttribute('aria-expanded','false');
  await expect(landlord).toHaveAttribute('aria-expanded','false');
  await inspection.click();
  await expect(inspection).toHaveAttribute('aria-expanded','true');
  await expect(landlord).toHaveAttribute('aria-expanded','false');
  await landlord.click();
  await expect(landlord).toHaveAttribute('aria-expanded','true');
  await inspection.click();
  await expect(inspection).toHaveAttribute('aria-expanded','false');
  await expect(landlord).toHaveAttribute('aria-expanded','true');
});

test('only useful inspection fields remain and persist after rerender',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  await openPanel(card,'inspection');
  const id=await card.getAttribute('data-location-card');

  for(const field of ['inspectionBy','premiseAvailability','availableFrom','nextActionDate']){
    await expect(card.locator(`[data-overview-field="${field}"]`)).toHaveCount(0);
  }

  await card.locator('[data-field="floorLocation"]').fill('1-й этаж, вход с улицы');
  await card.locator('[data-field="premiseCondition"]').selectOption('Нужен косметический ремонт');
  await card.locator('[data-field="nextAction"]').fill('Получить план помещения и проект договора');
  await page.waitForTimeout(1200);

  const saved=await page.evaluate(async locationId=>getLocationData(locationId),id);
  expect(saved).toMatchObject({
    floorLocation:'1-й этаж, вход с улицы',
    premiseCondition:'Нужен косметический ремонт',
    nextAction:'Получить план помещения и проект договора',
  });

  await page.evaluate(()=>renderLocations());
  await page.waitForFunction(locationId=>document.querySelector(`[data-location-card="${CSS.escape(locationId)}"] [data-overview-field="floorLocation"]`),id);
  const rerendered=page.locator(`[data-location-card="${id}"]`);
  await openPanel(rerendered,'inspection');
  await expect(rerendered.locator('[data-field="floorLocation"]')).toHaveValue('1-й этаж, вход с улицы');
  await expect(rerendered.locator('[data-field="premiseCondition"]')).toHaveValue('Нужен косметический ремонт');
  await expect(rerendered.locator('[data-field="nextAction"]')).toHaveValue('Получить план помещения и проект договора');
});

test('landlord fields follow the compact two-column order',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  await openPanel(card,'landlord');
  const order=await card.locator('.landlord-grid-v416').evaluate(grid=>[...grid.children].map(item=>item.querySelector('[data-field]')?.dataset.field).filter(Boolean));
  expect(order).toEqual([
    'rent','ownerName','contact','contactPhone','contactMessenger','contactEmail','rentConditions','contactNotes',
  ]);
  await expect(card.locator('[data-field="rent"]').locator('..')).not.toHaveClass(/profile-wide-v416/);
  await expect(card.locator('[data-field="ownerName"]').locator('..')).not.toHaveClass(/profile-wide-v416/);
  await expect(card.locator('[data-field="rentConditions"]').locator('..')).toHaveClass(/profile-wide-v416/);
  await expect(card.locator('[data-field="contactNotes"]').locator('..')).toHaveClass(/profile-wide-v416/);
});

test('phone and email fields have consistent inner spacing',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  await openPanel(card,'landlord');
  const spacing=await card.locator('[data-field="contactPhone"]').evaluate(element=>({
    phoneLeft:getComputedStyle(element).paddingLeft,
    phoneRight:getComputedStyle(element).paddingRight,
  }));
  const emailSpacing=await card.locator('[data-field="contactEmail"]').evaluate(element=>({
    emailLeft:getComputedStyle(element).paddingLeft,
    emailRight:getComputedStyle(element).paddingRight,
  }));
  expect(spacing).toEqual({phoneLeft:'12px',phoneRight:'12px'});
  expect(emailSpacing).toEqual({emailLeft:'12px',emailRight:'12px'});
});

test('report contains only the retained operational inspection details',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  await openPanel(card,'inspection');
  await card.locator('[data-field="floorLocation"]').fill('Первый этаж');
  await card.locator('[data-field="premiseCondition"]').selectOption('Готово к работе');
  await card.locator('[data-field="nextAction"]').fill('Запросить технический план');
  await page.waitForTimeout(800);
  const html=await page.evaluate(()=>buildReportHtml());
  expect(html).toContain('Параметры осмотра и следующий шаг');
  expect(html).toContain('Первый этаж');
  expect(html).toContain('Готово к работе');
  expect(html).toContain('Запросить технический план');
  expect(html).not.toContain('Доступность помещения');
  expect(html).not.toContain('Дата следующего действия');
});
