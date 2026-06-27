import { test, expect } from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=422';

async function openApp(page){
  await page.setViewportSize({width:1440,height:1000});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.BogatkaLocationCardCollapseV422?.ready&&document.querySelectorAll('[data-location-card]').length>1);
  await page.waitForFunction(()=>{
    const card=document.querySelector('[data-location-card]');
    return Boolean(window.BogatkaLocationCardCollapseV422.audit().ok&&card?.querySelector('.location-collapse-toggle-v422')&&card?.querySelector('.decision-score-v340')&&card?.querySelector('.decision-complete-v340'));
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
  await expect(first.locator('.scorebox')).toBeVisible();
  await expect(first.locator('.decision-score-v340')).toBeVisible();
  await expect(first.locator('.decision-complete-v340')).toBeVisible();
  await expect(second.locator(':scope > .location-body')).toBeVisible();

  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(locationId=>Boolean(window.BogatkaLocationCardCollapseV422?.ready&&document.querySelector(`[data-location-card="${CSS.escape(locationId)}"] .location-collapse-toggle-v422`)),firstId);
  const reloaded=page.locator(`[data-location-card="${firstId}"]`);
  await expect(reloaded.locator('.location-collapse-toggle-v422')).toHaveAttribute('aria-expanded','false');
  await expect(reloaded.locator(':scope > .location-body')).toBeHidden();

  await reloaded.locator('.location-collapse-toggle-v422').click();
  await expect(reloaded.locator(':scope > .location-body')).toBeVisible();
});

test('raw score, weighted score and completion metrics have equal boxes and equal gaps',async({page})=>{
  await openApp(page);
  const result=await page.locator('[data-location-card]').first().evaluate(card=>{
    const boxes=[
      card.querySelector('.location-head-side-v422 > .scorebox'),
      card.querySelector('.location-head-side-v422 .decision-score-v340'),
      card.querySelector('.location-head-side-v422 .decision-complete-v340'),
    ];
    const rects=boxes.map(box=>box.getBoundingClientRect());
    const fonts=boxes.map(box=>getComputedStyle(box.querySelector('strong')).fontSize);
    return {
      widths:rects.map(rect=>Math.round(rect.width*10)/10),
      heights:rects.map(rect=>Math.round(rect.height*10)/10),
      gaps:[
        Math.round((rects[1].left-rects[0].right)*10)/10,
        Math.round((rects[2].left-rects[1].right)*10)/10,
      ],
      fonts,
    };
  });

  expect(Math.max(...result.widths)-Math.min(...result.widths)).toBeLessThanOrEqual(1);
  expect(Math.max(...result.heights)-Math.min(...result.heights)).toBeLessThanOrEqual(1);
  expect(Math.abs(result.gaps[0]-result.gaps[1])).toBeLessThanOrEqual(1);
  expect(new Set(result.fonts).size).toBe(1);
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
    return Boolean(card?.querySelector('.location-collapse-toggle-v422')&&card.classList.contains('location-card-collapsed-v422'));
  },id);

  const rerendered=page.locator(`[data-location-card="${id}"]`);
  await expect(rerendered.locator(':scope > .location-body')).toBeHidden();
  await rerendered.locator('.location-collapse-toggle-v422').click();
  await expect(rerendered.locator('[data-field="floorLocation"]')).toHaveValue('1-й этаж, отдельный вход');
});
