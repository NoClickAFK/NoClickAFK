import { test, expect } from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=425';

async function openApp(page){
  await page.setViewportSize({width:1440,height:1000});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.BogatkaLocationProfileV416?.version==='4.2.5'&&document.querySelector('[data-location-card] [data-field="contactRole"]'));
  await page.waitForFunction(()=>window.BogatkaLocationProfileV416.audit().ok);
}

test('landlord panel replaces duplicate rent with contact role',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const landlord=card.locator('.landlord-grid-v416');
  const role=landlord.locator('select[data-field="contactRole"]');
  const owner=landlord.locator('[data-field="ownerName"]');

  await expect(landlord.locator('[data-field="rent"]')).toHaveCount(0);
  await expect(card.locator('[data-field="tech.rentPerMonth"]')).toHaveCount(1);
  await expect(owner).toBeVisible();
  await expect(role).toBeAttached();
  await expect(role.locator('option')).toHaveText([
    'Не выбрано','Собственник','Директор','Управляющий','Представитель собственника','Агент / посредник','Другое',
  ]);

  const aligned=await page.evaluate(()=>{
    const card=document.querySelector('[data-location-card]');
    const owner=card.querySelector('[data-field="ownerName"]').closest('label').getBoundingClientRect();
    const role=card.querySelector('[data-field="contactRole"]').closest('label').getBoundingClientRect();
    return Math.abs(owner.top-role.top);
  });
  expect(aligned).toBeLessThanOrEqual(2);
});

test('other contact role reveals and persists its clarification field',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const id=await card.getAttribute('data-location-card');
  const role=card.locator('select[data-field="contactRole"]');
  const other=card.locator('[data-field="contactRoleOther"]');
  const wrapper=other.locator('..');

  await expect(wrapper).toBeHidden();
  await role.selectOption('Другое');
  await expect(wrapper).toBeVisible();
  await other.fill('Юрист организации');
  await other.blur();
  await page.waitForTimeout(500);

  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(locationId=>{
    const card=document.querySelector(`[data-location-card="${CSS.escape(locationId)}"]`);
    return Boolean(window.BogatkaLocationProfileV416?.version==='4.2.5'&&card?.querySelector('[data-field="contactRole"]'));
  },id);

  const reloaded=page.locator(`[data-location-card="${id}"]`);
  await expect(reloaded.locator('[data-field="contactRole"]')).toHaveValue('Другое');
  await expect(reloaded.locator('[data-field="contactRoleOther"]')).toHaveValue('Юрист организации');
  await expect(reloaded.locator('[data-contact-role-other]')).toBeVisible();
});

test('legacy landlord rent migrates once into technical rent',async({page})=>{
  await openApp(page);
  const id=await page.locator('[data-location-card]').first().getAttribute('data-location-card');

  await page.evaluate(async locationId=>{
    const data=await getLocationData(locationId);
    data.rent='1375';
    data.tech={...(data.tech||{}),rentPerMonth:''};
    if(data.migrations)delete data.migrations.rentToTechV425;
    await idbPut(STORE,data,`location:${locationId}`);
    renderLocations();
  },id);

  await page.waitForFunction(locationId=>{
    const card=document.querySelector(`[data-location-card="${CSS.escape(locationId)}"]`);
    return Boolean(card?.querySelector('[data-field="tech.rentPerMonth"]')?.value==='1375');
  },id);

  const stored=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(stored.rent).toBe('');
  expect(stored.tech.rentPerMonth).toBe('1375');
  expect(stored.migrations.rentToTechV425).toBe(true);

  const card=page.locator(`[data-location-card="${id}"]`);
  await expect(card.locator('.landlord-grid-v416 [data-field="rent"]')).toHaveCount(0);
  await expect(card.locator('[data-field="tech.rentPerMonth"]')).toHaveValue('1375');
});
