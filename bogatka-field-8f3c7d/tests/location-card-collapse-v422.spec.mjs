import {test,expect} from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=location-report-collapse-v464';

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

async function expectAllCollapsed(page){
  const cards=page.locator('[data-location-card]');
  const count=await cards.count();
  expect(count).toBeGreaterThan(1);
  for(let index=0;index<count;index++){
    const card=cards.nth(index);
    await expect(card).toHaveClass(/location-card-collapsed-v422/);
    await expect(card.locator(':scope > .location-body')).toBeHidden();
    await expect(card.locator('.location-collapse-toggle-v422')).toHaveAttribute('aria-expanded','false');
    await expect(card.locator('.location-collapse-toggle-v422')).toHaveAttribute('aria-label','Развернуть локацию');
  }
}

test('all cards start collapsed, ignore legacy expanded state and reset on reload',async({page})=>{
  await openApp(page);
  await expectAllCollapsed(page);

  const cards=page.locator('[data-location-card]');
  const first=cards.first();
  const second=cards.nth(1);
  const firstId=await first.getAttribute('data-location-card');
  await page.evaluate(locationId=>localStorage.setItem(`bogatka.location.collapsed.v422.${locationId}`,'0'),firstId);
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaLocationCardCollapseV422?.ready&&document.querySelector('[data-location-card] .location-collapse-toggle-v422')),{timeout:30000});
  await expectAllCollapsed(page);

  const reloaded=page.locator(`[data-location-card="${firstId}"]`);
  await reloaded.locator('.location-collapse-toggle-v422').click();
  await expect(reloaded.locator(':scope > .location-body')).toBeVisible();
  await expect(reloaded.locator('.location-collapse-toggle-v422')).toHaveAttribute('aria-expanded','true');
  await expect(reloaded.locator('.location-collapse-toggle-v422')).toHaveAttribute('aria-label','Свернуть локацию');
  await expect(second.locator(':scope > .location-body')).toBeHidden();

  await page.evaluate(async()=>{
    await updateSummary();
    window.BogatkaLocationCardCollapseV422.enhanceAll();
  });
  await expect(reloaded.locator(':scope > .location-body')).toBeVisible();

  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaLocationCardCollapseV422?.ready&&document.querySelector('[data-location-card] .location-collapse-toggle-v422')),{timeout:30000});
  await expectAllCollapsed(page);
});

test('desktop status remains aligned and desktop actions keep their approved dimensions',async({page})=>{
  await openApp(page);
  const result=await page.locator('[data-location-card]').first().evaluate(card=>{
    const head=card.querySelector(':scope > .location-head');
    const actions=head.querySelector('.location-actions');
    const buttons=actions.querySelector(':scope > .location-action-buttons-v448');
    const status=actions.querySelector(':scope > .card-recommendation-head-v448 [data-card-recommendation-v448]');
    const toggle=head.querySelector('.location-collapse-toggle-v422');
    const buttonRects=[...buttons.children].map(node=>node.getBoundingClientRect());
    const actionsRect=actions.getBoundingClientRect();
    const statusRect=status.getBoundingClientRect();
    const toggleRect=toggle.getBoundingClientRect();
    return{
      labels:[...buttons.children].map(node=>node.textContent.trim()),
      heights:buttonRects.map(rect=>rect.height),
      statusParent:status.closest('.location-actions')===actions,
      rightGap:Math.abs(actionsRect.right-statusRect.right),
      toggleAboveStatus:toggleRect.top<statusRect.top,
      headOverflow:head.scrollWidth-head.clientWidth,
      actionOverflow:actions.scrollWidth-actions.clientWidth,
    };
  });
  expect(result.labels.slice(0,3)).toEqual(['Открыть на карте','Изменить адрес','Отчёт HTML']);
  expect(result.labels).not.toContain('Сохранить GPS');
  expect(result.statusParent).toBe(true);
  expect(result.rightGap).toBeLessThanOrEqual(2);
  expect(result.toggleAboveStatus).toBe(true);
  expect(result.headOverflow).toBeLessThanOrEqual(1);
  expect(result.actionOverflow).toBeLessThanOrEqual(1);
  expect(Math.max(...result.heights)-Math.min(...result.heights)).toBeLessThanOrEqual(2);
  expect(result.heights.some(height=>height!==36)).toBe(true);
});

test('expanded state and saved form data survive a same-document rerender only',async({page})=>{
  await openApp(page);
  const first=page.locator('[data-location-card]').first();
  const id=await first.getAttribute('data-location-card');
  await first.locator('.location-collapse-toggle-v422').click();
  await expect(first.locator(':scope > .location-body')).toBeVisible();
  const floor=first.locator('[data-field="floorLocation"]');
  await floor.fill('1-й этаж, отдельный вход');
  await floor.blur();
  await expect.poll(()=>page.evaluate(async locationId=>(await getLocationData(locationId)).floorLocation,id)).toBe('1-й этаж, отдельный вход');

  await page.evaluate(()=>renderLocations());
  await page.waitForFunction(locationId=>{
    const card=document.querySelector(`[data-location-card="${CSS.escape(locationId)}"]`);
    return Boolean(card&&!card.classList.contains('location-card-collapsed-v422')&&card.querySelector('.location-actions [data-card-recommendation-v448]'));
  },id,{timeout:30000});

  const rerendered=page.locator(`[data-location-card="${id}"]`);
  await expect(rerendered.locator(':scope > .location-body')).toBeVisible();
  await expect(rerendered.locator('[data-field="floorLocation"]')).toHaveValue('1-й этаж, отдельный вход');
});
