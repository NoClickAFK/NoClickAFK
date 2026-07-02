import { test, expect } from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=459';

test('mobile recommendation stays compact, right aligned, and overflow free',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>{
    const card=document.querySelector('[data-location-card]');
    return Boolean(window.BogatkaLocationCardCollapseV422?.ready&&window.BogatkaCardProgressV448?.ready&&card?.querySelector('.location-head-side-v422 .card-recommendation-v448'));
  });

  const layout=await page.locator('[data-location-card]').first().evaluate(card=>{
    const head=card.querySelector(':scope > .location-head').getBoundingClientRect();
    const title=card.querySelector('.location-title-wrap').getBoundingClientRect();
    const side=card.querySelector('.location-head-side-v422');
    const sideRect=side.getBoundingClientRect();
    const recommendation=side.querySelector('.card-recommendation-v448').getBoundingClientRect();
    const toggle=side.querySelector('.location-collapse-toggle-v422').getBoundingClientRect();
    return {
      headWidth:head.width,
      titleWidth:title.width,
      sideWidth:sideRect.width,
      sideLeft:sideRect.left,
      headLeft:head.left,
      overflow:side.scrollWidth-side.clientWidth,
      recommendationWidth:recommendation.width,
      recommendationHeight:recommendation.height,
      gapToToggle:toggle.left-recommendation.right,
      oldMetricCount:side.querySelectorAll(':scope > .scorebox:not([hidden]),.decision-score-v340,.decision-complete-v340').length,
    };
  });

  expect(layout.titleWidth).toBeGreaterThan(layout.headWidth-40);
  expect(layout.sideWidth).toBeGreaterThan(layout.headWidth-40);
  expect(Math.abs(layout.sideLeft-layout.headLeft)).toBeLessThanOrEqual(20);
  expect(layout.overflow).toBeLessThanOrEqual(1);
  expect(layout.recommendationWidth).toBeLessThan(210);
  expect(layout.recommendationHeight).toBe(34);
  expect(layout.gapToToggle).toBeGreaterThanOrEqual(6);
  expect(layout.gapToToggle).toBeLessThanOrEqual(8);
  expect(layout.oldMetricCount).toBe(0);

  const card=page.locator('[data-location-card]').first();
  await card.locator('.location-collapse-toggle-v422').click();
  await expect(card.locator(':scope > .location-body')).toBeHidden();
  await expect(card.locator('.card-recommendation-v448')).toBeVisible();
});
