import { test, expect } from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=462';

test('mobile compact recommendation status stays overflow free',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>{
    const card=document.querySelector('[data-location-card]');
    return Boolean(window.BogatkaLocationCardCollapseV422?.ready&&window.BogatkaCardProgressV448?.ready&&card?.querySelector('.location-head-side-v422 [data-card-recommendation-v448]'));
  });

  const layout=await page.locator('[data-location-card]').first().evaluate(card=>{
    const head=card.querySelector(':scope > .location-head').getBoundingClientRect();
    const side=card.querySelector('.location-head-side-v422');
    const sideRect=side.getBoundingClientRect();
    const status=side.querySelector('[data-card-recommendation-v448]').getBoundingClientRect();
    const toggle=side.querySelector('.location-collapse-toggle-v422').getBoundingClientRect();
    return{
      headWidth:head.width,
      sideWidth:sideRect.width,
      overflow:side.scrollWidth-side.clientWidth,
      statusWidth:status.width,
      statusHeight:status.height,
      gapToToggle:toggle.left-status.right,
      largePanelCount:side.querySelectorAll('.card-recommendation-v448').length,
    };
  });

  expect(layout.sideWidth).toBeGreaterThan(layout.headWidth-40);
  expect(layout.overflow).toBeLessThanOrEqual(1);
  expect(layout.statusWidth).toBeLessThan(210);
  expect(layout.statusHeight).toBeGreaterThanOrEqual(30);
  expect(layout.gapToToggle).toBeGreaterThanOrEqual(8);
  expect(layout.largePanelCount).toBe(0);

  const card=page.locator('[data-location-card]').first();
  await card.locator('.location-collapse-toggle-v422').click();
  await expect(card.locator(':scope > .location-body')).toBeHidden();
  await expect(card.locator('[data-card-recommendation-v448]')).toBeVisible();
});

