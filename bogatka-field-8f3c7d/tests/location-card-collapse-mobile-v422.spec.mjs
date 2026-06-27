import { test, expect } from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=422';

test('mobile metric rail spans the full location header without overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>{
    const card=document.querySelector('[data-location-card]');
    return Boolean(window.BogatkaLocationCardCollapseV422?.ready&&card?.querySelector('.location-head-side-v422 .decision-complete-v340'));
  });

  const layout=await page.locator('[data-location-card]').first().evaluate(card=>{
    const head=card.querySelector(':scope > .location-head').getBoundingClientRect();
    const title=card.querySelector('.location-title-wrap').getBoundingClientRect();
    const side=card.querySelector('.location-head-side-v422');
    const sideRect=side.getBoundingClientRect();
    const boxes=[...side.querySelectorAll(':scope > .scorebox,.decision-score-v340,.decision-complete-v340')].map(node=>node.getBoundingClientRect().width);
    return {
      headWidth:head.width,
      titleWidth:title.width,
      sideWidth:sideRect.width,
      sideLeft:sideRect.left,
      headLeft:head.left,
      overflow:side.scrollWidth-side.clientWidth,
      boxWidths:boxes,
    };
  });

  expect(layout.titleWidth).toBeGreaterThan(layout.headWidth-40);
  expect(layout.sideWidth).toBeGreaterThan(layout.headWidth-40);
  expect(Math.abs(layout.sideLeft-layout.headLeft)).toBeLessThanOrEqual(20);
  expect(layout.overflow).toBeLessThanOrEqual(1);
  for(const width of layout.boxWidths)expect(width).toBeGreaterThan(70);

  const card=page.locator('[data-location-card]').first();
  await card.locator('.location-collapse-toggle-v422').click();
  await expect(card.locator(':scope > .location-body')).toBeHidden();
});
