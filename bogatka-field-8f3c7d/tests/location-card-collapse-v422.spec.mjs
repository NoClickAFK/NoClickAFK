import {test,expect} from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=pr67-status-row';

async function openApp(page){
  await page.setViewportSize({width:1440,height:1000});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>{
    const card=document.querySelector('[data-location-card]');
    return Boolean(
      window.BogatkaLocationCardCollapseV422?.ready&&
      window.BogatkaCardProgressV448?.ready&&
      document.querySelectorAll('[data-location-card]').length>1&&
      card?.querySelector('.location-actions [data-card-recommendation-v448]')&&
      card?.querySelector('.location-head-side-v422 .location-collapse-toggle-v422')
    );
  },{timeout:30000});
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
  await expect(first.locator('.location-actions [data-card-recommendation-v448]')).toBeVisible();
  await expect(first.locator('.scorebox')).toBeHidden();
  await expect(second.locator(':scope > .location-body')).toBeVisible();

  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(locationId=>Boolean(
    window.BogatkaLocationCardCollapseV422?.ready&&
    window.BogatkaCardProgressV448?.ready&&
    document.querySelector(`[data-location-card="${CSS.escape(locationId)}"] .location-actions [data-card-recommendation-v448]`)
  ),firstId,{timeout:30000});
  const reloaded=page.locator(`[data-location-card="${firstId}"]`);
  await expect(reloaded.locator('.location-collapse-toggle-v422')).toHaveAttribute('aria-expanded','false');
  await expect(reloaded.locator(':scope > .location-body')).toBeHidden();
  await expect(reloaded.locator('.location-actions [data-card-recommendation-v448]')).toBeVisible();
  await reloaded.locator('.location-collapse-toggle-v422').click();
  await expect(reloaded.locator(':scope > .location-body')).toBeVisible();
});

test('status is right-aligned in the action row while collapse arrow stays upper-right',async({page})=>{
  await openApp(page);
  const result=await page.locator('[data-location-card]').first().evaluate(card=>{
    const head=card.querySelector(':scope > .location-head');
    const actions=head.querySelector('.location-actions');
    const buttons=actions.querySelector(':scope > .location-action-buttons-v448');
    const status=actions.querySelector(':scope > .card-recommendation-head-v448 [data-card-recommendation-v448]');
    const side=head.querySelector(':scope > .location-head-side-v422');
    const toggle=side.querySelector(':scope > .location-collapse-toggle-v422');
    const actionRect=actions.getBoundingClientRect();
    const buttonsRect=buttons.getBoundingClientRect();
    const statusRect=status.getBoundingClientRect();
    const toggleRect=toggle.getBoundingClientRect();
    const headRect=head.getBoundingClientRect();
    const style=getComputedStyle(status);
    return{
      statusParent:status.closest('.location-actions')===actions,
      buttonGroupParent:buttons.parentElement===actions,
      toggleParent:toggle.parentElement===side,
      statusInSide:side.contains(status),
      statusWidth:statusRect.width,
      statusHeight:statusRect.height,
      statusBorderWidth:style.borderTopWidth,
      statusRadius:style.borderTopLeftRadius,
      statusFontSize:style.fontSize,
      centerDelta:Math.abs((buttonsRect.top+buttonsRect.height/2)-(statusRect.top+statusRect.height/2)),
      rightGap:Math.abs(actionRect.right-statusRect.right),
      buttonStatusGap:statusRect.left-buttonsRect.right,
      toggleTop:toggleRect.top-headRect.top,
      statusTop:statusRect.top-headRect.top,
      headOverflow:head.scrollWidth-head.clientWidth,
      actionOverflow:actions.scrollWidth-actions.clientWidth,
    };
  });
  expect(result.statusParent).toBe(true);
  expect(result.buttonGroupParent).toBe(true);
  expect(result.toggleParent).toBe(true);
  expect(result.statusInSide).toBe(false);
  expect(result.statusWidth).toBeLessThan(220);
  expect(result.statusHeight).toBeGreaterThanOrEqual(30);
  expect(result.statusBorderWidth).toBe('1px');
  expect(result.statusRadius).toBe('10px');
  expect(result.statusFontSize).toBe('11px');
  expect(result.centerDelta).toBeLessThanOrEqual(3);
  expect(result.rightGap).toBeLessThanOrEqual(2);
  expect(result.buttonStatusGap).toBeGreaterThanOrEqual(7);
  expect(result.toggleTop).toBeLessThan(result.statusTop);
  expect(result.headOverflow).toBeLessThanOrEqual(1);
  expect(result.actionOverflow).toBeLessThanOrEqual(1);
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
    return Boolean(card?.classList.contains('location-card-collapsed-v422')&&card.querySelector('.location-actions [data-card-recommendation-v448]'));
  },id,{timeout:30000});

  const rerendered=page.locator(`[data-location-card="${id}"]`);
  await expect(rerendered.locator(':scope > .location-body')).toBeHidden();
  await rerendered.locator('.location-collapse-toggle-v422').click();
  await expect(rerendered.locator('[data-field="floorLocation"]')).toHaveValue('1-й этаж, отдельный вход');
});
