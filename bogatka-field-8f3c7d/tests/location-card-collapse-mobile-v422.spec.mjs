import {test,expect} from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=pr67-mobile-status-row';

async function openApp(page,width=390,height=844){
  await page.setViewportSize({width,height});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>{
    const card=document.querySelector('[data-location-card]');
    return Boolean(window.BogatkaLocationCardCollapseV422?.ready&&window.BogatkaCardProgressV448?.initialized&&window.BogatkaUIRefineV462?.ready&&card?.querySelector('.location-actions [data-card-recommendation-v448]'));
  },{timeout:30000});
}

test('mobile action area keeps status without overflow while arrow stays upper-right',async({page})=>{
  await openApp(page);

  const card=page.locator('[data-location-card]').first();
  const layout=await card.evaluate(node=>{
    const head=node.querySelector(':scope > .location-head');
    const actions=head.querySelector('.location-actions');
    const buttons=actions.querySelector('.location-action-buttons-v448');
    const status=actions.querySelector('[data-card-recommendation-v448]');
    const side=head.querySelector('.location-head-side-v422');
    const toggle=side.querySelector('.location-collapse-toggle-v422');
    const actionRect=actions.getBoundingClientRect();
    const statusRect=status.getBoundingClientRect();
    const toggleRect=toggle.getBoundingClientRect();
    const buttonRects=[...buttons.children].map(item=>item.getBoundingClientRect());
    const overlaps=buttonRects.some(rect=>!(rect.right<=statusRect.left||rect.left>=statusRect.right||rect.bottom<=statusRect.top||rect.top>=statusRect.bottom));
    return{
      headOverflow:head.scrollWidth-head.clientWidth,
      actionOverflow:actions.scrollWidth-actions.clientWidth,
      statusParent:status.closest('.location-actions')===actions,
      statusInSide:side.contains(status),
      toggleParent:toggle.parentElement===side,
      statusInside:statusRect.left>=actionRect.left-1&&statusRect.right<=actionRect.right+1,
      overlaps,
      statusHeight:statusRect.height,
      toggleAboveStatus:toggleRect.top<statusRect.top,
    };
  });
  expect(layout.headOverflow).toBeLessThanOrEqual(1);
  expect(layout.actionOverflow).toBeLessThanOrEqual(1);
  expect(layout.statusParent).toBe(true);
  expect(layout.statusInSide).toBe(false);
  expect(layout.toggleParent).toBe(true);
  expect(layout.statusInside).toBe(true);
  expect(layout.overlaps).toBe(false);
  expect(layout.statusHeight).toBeGreaterThanOrEqual(30);
  expect(layout.toggleAboveStatus).toBe(true);

  await card.locator('.location-collapse-toggle-v422').click();
  await expect(card.locator(':scope > .location-body')).toBeHidden();
  await expect(card.locator('.location-actions [data-card-recommendation-v448]')).toBeVisible();
});

test('new location receives canonical progress accordions before save action finishes',async({page})=>{
  await openApp(page,1440,1000);
  await page.locator('#addLocationBtn').click();
  await page.locator('#locationTitle').fill('Новая тестовая локация UI');
  await page.locator('#locationAddress').fill('Гродно, тестовый адрес UI');
  await page.locator('#saveLocationBtn').click();
  const card=page.locator('[data-location-card]').filter({hasText:'Новая тестовая локация UI'});
  await expect(card).toHaveCount(1);
  await expect(card.locator('.decision-progress-v448.progress-card-v462')).toHaveCount(1);
  await expect(card.locator('.progress-card-toggle-v462')).toHaveCount(1);
  await expect(card.locator('.progress-card-content-v462')).toHaveCount(1);
  await expect(card.locator('.fill-plan-toggle-v462')).toHaveCount(1);
  await expect(card.locator('.fill-plan-chevron-v462')).toHaveCount(1);
  await expect(card).not.toContainText(/Следующий приоритет|Далее/);
});
