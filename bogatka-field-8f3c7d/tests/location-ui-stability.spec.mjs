import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=location-ui-stability-red';

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaCardProgressV448?.initialized&&window.BogatkaUIRefineV462?.ready&&window.BogatkaLocationDataV452?.ready),{timeout:30000});
}

test('newly created location is canonically enhanced before it is scrolled into view',async({page})=>{
  await openApp(page);
  await page.getByRole('button',{name:/Добавить локацию/i}).click();
  await page.locator('#locationTitle').fill('UI stability fixture');
  await page.locator('#locationAddress').fill('Гродно, тестовый адрес UI');
  await page.locator('#locationModal').getByRole('button',{name:/Сохранить/i}).click();
  const card=page.locator('[data-location-card]').filter({hasText:'UI stability fixture'});
  await expect(card).toHaveCount(1);
  await expect(card.locator('.decision-progress-v448.progress-card-v462')).toHaveCount(1);
  await expect(card.locator('.progress-card-toggle-v462')).toHaveCount(1);
  await expect(card.locator('.progress-card-content-v462')).toHaveCount(1);
  await expect(card.locator('.fill-plan-toggle-v462')).toHaveCount(1);
  await expect(card.locator('.fill-plan-chevron-v462')).toHaveCount(1);
});

test('decision reason exposes a canonical accordion and explicit save feedback',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  await expect(card.locator('.decision-reason-section-v412')).toHaveCount(1);
  await expect(card.locator('.decision-reason-toggle-v412')).toHaveCount(1);
  await expect(card.locator('[data-decision-reason-save-v412]')).toHaveCount(1);
});
