import { test, expect } from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=425';
const FRIENDLY_STREET='Магазин с отдельным входом с улицы';

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.BogatkaLocationProfileV416?.version==='4.2.5');
  await page.waitForFunction(()=>document.querySelector('[data-location-card] [data-field="contactRole"]'));
}

test('profile renders contact role and keeps rent only in technical parameters',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  await expect(card.locator('[data-field="objectType"] option').nth(2)).toHaveText(FRIENDLY_STREET);
  await expect(card.locator('[data-field="contactRole"] option')).toHaveText([
    'Не выбрано','Собственник','Директор','Управляющий','Представитель собственника','Агент / посредник','Другое',
  ]);
  await expect(card.locator('.landlord-grid-v416 [data-field="rent"]')).toHaveCount(0);
  await expect(card.locator('[data-field="tech.rentPerMonth"]')).toHaveCount(1);
  expect(await page.evaluate(()=>window.BogatkaLocationProfileV416.audit())).toMatchObject({ok:true});
});

test('profile fields persist after a full rerender',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const id=await card.getAttribute('data-location-card');
  await card.locator('[data-field="tech.rentPerMonth"]').fill('1500');
  await card.locator('[data-field="ownerName"]').fill('Тестовая организация');
  await card.locator('[data-field="contactRole"]').selectOption('Управляющий');
  await card.locator('[data-field="contact"]').fill('Тестовый контакт');
  await page.waitForTimeout(900);

  const saved=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(saved.rent).toBe('');
  expect(saved.tech.rentPerMonth).toBe('1500');
  expect(saved.contactRole).toBe('Управляющий');

  await page.evaluate(()=>renderLocations());
  await page.waitForFunction(locationId=>document.querySelector(`[data-location-card="${CSS.escape(locationId)}"] [data-field="contactRole"]`),id);
  const rerendered=page.locator(`[data-location-card="${id}"]`);
  await expect(rerendered.locator('[data-field="tech.rentPerMonth"]')).toHaveValue('1500');
  await expect(rerendered.locator('[data-field="contactRole"]')).toHaveValue('Управляющий');
});

test('other contact role reveals a synchronized clarification field',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const role=card.locator('[data-field="contactRole"]');
  const other=card.locator('[data-field="contactRoleOther"]');
  await expect(other).toBeHidden();
  await role.selectOption('Другое');
  await expect(other).toBeVisible();
  await other.fill('Юрист организации');
  await page.waitForTimeout(700);
  const id=await card.getAttribute('data-location-card');
  const saved=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(saved.contactRole).toBe('Другое');
  expect(saved.contactRoleOther).toBe('Юрист организации');
});

test('generated report includes the contact role and excludes duplicate landlord rent',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  await card.locator('[data-field="ownerName"]').fill('Тестовая организация');
  await card.locator('[data-field="contactRole"]').selectOption('Директор');
  await page.waitForTimeout(700);
  const html=await page.evaluate(()=>buildReportHtml());
  expect(html).toContain('Роль контактного лица');
  expect(html).toContain('Директор');
  expect(html).not.toContain('<b>Аренда:</b>');
});
