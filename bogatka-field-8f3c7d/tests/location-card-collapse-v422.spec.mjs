import { test, expect } from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=448';

async function openApp(page){
  await page.setViewportSize({width:1440,height:1000});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.BogatkaLocationCardCollapseV422?.ready&&window.BogatkaCardProgressV448?.ready&&document.querySelectorAll('[data-location-card]').length>1);
  await page.waitForFunction(()=>{
    const card=document.querySelector('[data-location-card]');
    return Boolean(window.BogatkaLocationCardCollapseV422.audit().ok&&card?.querySelector('.location-collapse-toggle-v422')&&card?.querySelector('.card-recommendation-v448'));
  });
}

test('whole location card collapses to its header and remembers state independently',async({page})=>{
  await openApp(page);
  const cards=page.locator('[data-location-card]');
  const first=cards.first();
  const second=cards.nth(1);
  const firstId=await first.getAttribute('data-location-card');
  const toggle=first.locator('.location-collapse-toggle-v422');

  await expect(toggle).toHaveAttribute('aria-expanded','true');
  await expect(first.locator(':scope > .location-body')).toBeVisible();
  await toggle.click();

  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await expect(first.locator(':scope > .location-body')).toBeHidden();
  await expect(first.locator(':scope > .location-head')).toBeVisible();
  await expect(first.locator('.location-title-wrap h2')).toBeVisible();
  await expect(first.locator('.location-actions')).toBeVisible();
  await expect(first.locator('.scorebox')).toBeHidden();
  await expect(first.locator('.decision-score-v340')).toHaveCount(0);
  await expect(first.locator('.decision-complete-v340')).toHaveCount(0);
  await expect(first.locator('.card-recommendation-v448')).toBeVisible();
  await expect(second.locator(':scope > .location-body')).toBeVisible();

  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(locationId=>Boolean(window.BogatkaLocationCardCollapseV422?.ready&&window.BogatkaCardProgressV448?.ready&&document.querySelector(`[data-location-card="${CSS.escape(locationId)}"] .location-collapse-toggle-v422`)),firstId);
  const reloaded=page.locator(`[data-location-card="${firstId}"]`);
  await expect(reloaded.locator('.location-collapse-toggle-v422')).toHaveAttribute('aria-expanded','false');
  await expect(reloaded.locator(':scope > .location-body')).toBeHidden();
  await expect(reloaded.locator('.card-recommendation-v448')).toBeVisible();

  await reloaded.locator('.location-collapse-toggle-v422').click();
  await expect(reloaded.locator(':scope > .location-body')).toBeVisible();
});

test('header keeps one stable recommendation card instead of three numeric boxes',async({page})=>{
  await openApp(page);
  const result=await page.locator('[data-location-card]').first().evaluate(card=>{
    const recommendation=card.querySelector('.location-head-side-v422 .card-recommendation-v448');
    const rect=recommendation.getBoundingClientRect();
    const style=getComputedStyle(recommendation);
    return {
      width:Math.round(rect.width*10)/10,
      height:Math.round(rect.height*10)/10,
      borderWidth:style.borderTopWidth,
      radius:style.borderTopLeftRadius,
      oldMetricCount:card.querySelectorAll('.location-head-side-v422 .decision-score-v340,.location-head-side-v422 .decision-complete-v340').length,
      rawVisible:getComputedStyle(card.querySelector('.location-head-side-v422 > .scorebox')).display!=='none',
    };
  });

  expect(result.width).toBeGreaterThan(230);
  expect(result.height).toBeGreaterThanOrEqual(70);
  expect(result.borderWidth).toBe('1px');
  expect(result.radius).toBe('15px');
  expect(result.oldMetricCount).toBe(0);
  expect(result.rawVisible).toBe(false);
});

test('collapse state survives full card rerender without changing saved form data',async({page})=>{
  await openApp(page);
  const first=page.locator('[data-location-card]').first();
  const id=await first.getAttribute('data-location-card');
  const floor=first.locator('[data-field="floorLocation"]');
  await floor.fill('1-й этаж, отдельный вход');
  await page.waitForTimeout(900);
  await floor.blur();
  await first.locator('.location-collapse-toggle-v422').click();
  await expect(first.locator(':scope > .location-body')).toBeHidden();

  await page.evaluate(()=>renderLocations());
  await page.waitForFunction(locationId=>{
    const card=document.querySelector(`[data-location-card="${CSS.escape(locationId)}"]`);
    return Boolean(card?.querySelector('.location-collapse-toggle-v422')&&card.classList.contains('location-card-collapsed-v422')&&card.querySelector('.card-recommendation-v448'));
  },id);

  const rerendered=page.locator(`[data-location-card="${id}"]`);
  await expect(rerendered.locator(':scope > .location-body')).toBeHidden();
  await rerendered.locator('.location-collapse-toggle-v422').click();
  await expect(rerendered.locator('[data-field="floorLocation"]')).toHaveValue('1-й этаж, отдельный вход');
});
