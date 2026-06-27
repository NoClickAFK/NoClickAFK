import { test, expect } from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=416';
const FRIENDLY_STREET='Магазин с отдельным входом с улицы';

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.BogatkaLocationProfileV416?.ready&&window.BogatkaSyncFieldCompatV416?.ready&&window.BogatkaFieldIntegrityV416?.ready&&window.BogatkaObjectTypeNormalizeV416?.ready);
  await page.waitForFunction(()=>document.querySelector('[data-location-card] .location-overview-v416'));
}

test('location profile renders friendly object type and all structured fields',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  await expect(card.locator('.inspection-card-v416')).toBeVisible();
  await expect(card.locator('.landlord-card-v416')).toBeVisible();
  await expect(card.locator('[data-field="objectType"] option')).toContainText(['Не выбран','Торговый центр',FRIENDLY_STREET,'Первый этаж жилого дома','Рынок / павильон','Отдельное здание','Другое']);
  await expect(card.locator('[data-field="objectType"] option').nth(2)).toHaveAttribute('value','Стрит-ритейл');

  const audit=await page.evaluate(()=>window.BogatkaLocationProfileV416.audit());
  expect(audit.ok).toBe(true);
  expect(audit.cards).toBeGreaterThan(0);
});

test('top location fields persist together and restore after a full rerender',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const id=await card.getAttribute('data-location-card');

  await card.locator('[data-field="status"]').selectOption({label:'Осмотрена'});
  await card.locator('[data-field="objectType"]').selectOption('Стрит-ритейл');
  await card.locator('[data-field="date"]').fill('2026-06-27');
  await card.locator('[data-field="time"]').fill('09:45');
  await card.locator('[data-field="rent"]').fill('1500');
  await card.locator('[data-field="ownerName"]').fill('ООО Арендодатель');
  await card.locator('[data-field="contact"]').fill('Антон Иванов');
  await card.locator('[data-field="contactPhone"]').fill('+375 29 111-22-33');
  await card.locator('[data-field="contactEmail"]').fill('anton@example.com');
  await card.locator('[data-field="contactMessenger"]').fill('Telegram @anton');
  await card.locator('[data-field="rentConditions"]').fill('Депозит один месяц, каникулы 30 дней');
  await card.locator('[data-field="contactNotes"]').fill('Связываться после 10:00');
  await page.waitForTimeout(1400);

  const saved=await page.evaluate(async locationId=>getLocationData(locationId),id);
  expect(saved).toMatchObject({
    status:'Осмотрена',objectType:'Стрит-ритейл',date:'2026-06-27',time:'09:45',rent:'1500',
    ownerName:'ООО Арендодатель',contact:'Антон Иванов',contactPhone:'+375 29 111-22-33',
    contactEmail:'anton@example.com',contactMessenger:'Telegram @anton',
    rentConditions:'Депозит один месяц, каникулы 30 дней',contactNotes:'Связываться после 10:00',
  });

  await page.evaluate(()=>renderLocations());
  await page.waitForFunction(locationId=>document.querySelector(`[data-location-card="${CSS.escape(locationId)}"] .location-overview-v416`),id);
  const rerendered=page.locator(`[data-location-card="${id}"]`);
  await expect(rerendered.locator('[data-field="objectType"]')).toHaveValue('Стрит-ритейл');
  await expect(rerendered.locator('[data-field="contactPhone"]')).toHaveValue('+375 29 111-22-33');
  await expect(rerendered.locator('[data-field="rentConditions"]')).toHaveValue('Депозит один месяц, каникулы 30 дней');
  await expect(rerendered.locator('[data-field="objectType"] + .premium-select-trigger')).toContainText(FRIENDLY_STREET);
});

test('other object type exposes a dedicated synchronized description field',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const id=await card.getAttribute('data-location-card');
  await card.locator('[data-field="objectType"]').selectOption('Другое');
  const custom=card.locator('[data-field="objectTypeOther"]');
  await expect(custom).toBeVisible();
  await custom.fill('Помещение при автозаправочной станции');
  await page.waitForTimeout(900);
  const saved=await page.evaluate(async locationId=>getLocationData(locationId),id);
  expect(saved.objectType).toBe('Другое');
  expect(saved.objectTypeOther).toBe('Помещение при автозаправочной станции');
});

test('remote row columns restore canonical status and object type',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(()=>window.BogatkaSyncFieldCompatV416.hydrateRow({
    id:'remote-row',status:'Осмотрена',object_type:'Магазин с отдельным входом с улицы',form_data:{date:'2026-06-27',rent:'1200',objectType:'Street retail'},
  }));
  expect(result.object_type).toBe('Стрит-ритейл');
  expect(result.form_data).toEqual({date:'2026-06-27',rent:'1200',objectType:'Стрит-ритейл',status:'Осмотрена'});
});

test('legacy local object type is repaired without losing its selection',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const id=await card.getAttribute('data-location-card');
  await page.evaluate(async locationId=>{
    const data=await getLocationData(locationId);
    data.objectType='Магазин с отдельным входом с улицы';
    await idbPut(STORE,data,'location:'+locationId);
    await window.BogatkaObjectTypeNormalizeV416.repair();
  },id);
  await expect(card.locator('[data-field="objectType"]')).toHaveValue('Стрит-ритейл');
  const saved=await page.evaluate(async locationId=>getLocationData(locationId),id);
  expect(saved.objectType).toBe('Стрит-ритейл');
});

test('new location modal creates a complete profile card',async({page})=>{
  await openApp(page);
  const suffix=Date.now();
  await page.locator('#addLocationBtn').click();
  await expect(page.locator('#locationModal')).not.toHaveClass(/hidden/);
  await expect(page.locator('.location-modal-guide-v416')).toBeVisible();
  await page.locator('#locationTitle').fill(`Тестовая точка ${suffix}`);
  await page.locator('#locationAddress').fill(`Гродно, Тестовая улица, ${suffix}`);
  await page.locator('#locationNote').fill('Проверка формы добавления локации');
  await page.locator('#saveLocationBtn').click();

  const card=page.locator('[data-location-card]').filter({hasText:`Тестовая точка ${suffix}`});
  await expect(card).toHaveCount(1);
  await expect(card.locator('.location-overview-v416')).toBeVisible();
  await expect(card.locator('[data-field="objectTypeOther"]')).toHaveCount(1);
  await expect(card.locator('[data-field="contactPhone"]')).toHaveCount(1);
  await expect(card.locator('[data-field="rentConditions"]')).toHaveCount(1);
});

test('generated report uses friendly object type and structured landlord details',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  await card.locator('[data-field="objectType"]').selectOption('Стрит-ритейл');
  await card.locator('[data-field="ownerName"]').fill('ООО Отчёт');
  await card.locator('[data-field="contactPhone"]').fill('+375 29 555-55-55');
  await page.waitForTimeout(900);
  const html=await page.evaluate(()=>buildReportHtml());
  expect(html).toContain(FRIENDLY_STREET);
  expect(html).toContain('ООО Отчёт');
  expect(html).toContain('+375 29 555-55-55');
  expect(html).toContain('Арендодатель и условия');
});
