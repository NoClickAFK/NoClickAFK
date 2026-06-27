import { test, expect } from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=417';

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.BogatkaLocationProfileV416?.ready&&window.BogatkaLocationOverviewV417?.ready&&window.BogatkaObjectTypeNormalizeV416?.ready);
  await page.waitForFunction(()=>document.querySelector('[data-location-card] [data-overview-field="inspectionBy"]'));
}

test('object type no longer reverts to Other after choosing another option',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
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
  const id=await card.getAttribute('data-location-card');
  await card.locator('[data-field="objectType"]').selectOption('Другое');
  await page.waitForTimeout(700);
  await card.locator('[data-field="objectTypeOther"]').fill('Нестандартный павильон');
  await page.waitForTimeout(700);
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.BogatkaLocationOverviewV417?.ready&&document.querySelector('[data-location-card] [data-overview-field="inspectionBy"]'));

  const reloaded=page.locator(`[data-location-card="${id}"]`);
  await expect(reloaded.locator('[data-field="objectType"]')).toHaveValue('Другое');
  await expect(reloaded.locator('[data-object-other] .profile-caption-v416')).toHaveText('Уточните другой тип объекта');
  await expect(reloaded.locator('[data-field="objectTypeOther"]')).toBeVisible();
  await expect(reloaded.locator('[data-field="objectTypeOther"]')).toHaveValue('Нестандартный павильон');
});

test('operational inspection fields render and persist after rerender',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const id=await card.getAttribute('data-location-card');

  await card.locator('[data-field="inspectionBy"]').fill('Дмитрий');
  await card.locator('[data-field="floorLocation"]').fill('1-й этаж, вход с улицы');
  await card.locator('[data-field="premiseCondition"]').selectOption('Нужен косметический ремонт');
  await card.locator('[data-field="premiseAvailability"]').selectOption('Освобождается');
  await card.locator('[data-field="availableFrom"]').fill('2026-07-15');
  await card.locator('[data-field="nextActionDate"]').fill('2026-06-30');
  await card.locator('[data-field="nextAction"]').fill('Получить план помещения и проект договора');
  await page.waitForTimeout(1200);

  const saved=await page.evaluate(async locationId=>getLocationData(locationId),id);
  expect(saved).toMatchObject({
    inspectionBy:'Дмитрий',
    floorLocation:'1-й этаж, вход с улицы',
    premiseCondition:'Нужен косметический ремонт',
    premiseAvailability:'Освобождается',
    availableFrom:'2026-07-15',
    nextActionDate:'2026-06-30',
    nextAction:'Получить план помещения и проект договора',
  });

  await page.evaluate(()=>renderLocations());
  await page.waitForFunction(locationId=>document.querySelector(`[data-location-card="${CSS.escape(locationId)}"] [data-overview-field="inspectionBy"]`),id);
  const rerendered=page.locator(`[data-location-card="${id}"]`);
  await expect(rerendered.locator('[data-field="inspectionBy"]')).toHaveValue('Дмитрий');
  await expect(rerendered.locator('[data-field="premiseAvailability"]')).toHaveValue('Освобождается');
  await expect(rerendered.locator('[data-field="nextAction"]')).toHaveValue('Получить план помещения и проект договора');
});

test('phone and email fields have consistent inner spacing',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
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

test('report contains operational inspection details',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  await card.locator('[data-field="inspectionBy"]').fill('Проверяющий');
  await card.locator('[data-field="nextAction"]').fill('Запросить технический план');
  await page.waitForTimeout(800);
  const html=await page.evaluate(()=>buildReportHtml());
  expect(html).toContain('Параметры осмотра и следующий шаг');
  expect(html).toContain('Проверяющий');
  expect(html).toContain('Запросить технический план');
});
