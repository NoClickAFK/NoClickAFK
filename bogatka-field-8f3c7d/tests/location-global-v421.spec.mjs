import { test, expect } from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=425';

async function openApp(page){
  await page.setViewportSize({width:1440,height:1000});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.BogatkaLocationPanelsV419?.ready&&window.BogatkaLocationGlobalV421?.ready&&window.BogatkaObjectTypeNormalizeV416?.ready);
  await page.waitForFunction(()=>window.BogatkaLocationPanelsV419.audit().ok&&window.BogatkaLocationGlobalV421.audit().ok);
}

async function setPanel(card,selector,open){
  const panel=card.locator(selector);
  const toggle=panel.locator(':scope > .panel-toggle-v419');
  const current=await toggle.getAttribute('aria-expanded');
  if((current==='true')!==open)await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded',String(open));
}

test('object type can be reset to not selected and stays empty after reload',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const id=await card.getAttribute('data-location-card');
  const select=card.locator('select[data-field="objectType"]');
  await select.selectOption('Торговый центр');
  await page.waitForTimeout(700);
  await expect(select).toHaveValue('Торговый центр');
  await select.selectOption('');
  await page.waitForTimeout(1100);
  await expect(select).toHaveValue('');
  const saved=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(saved.objectType).toBe('');
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.BogatkaLocationGlobalV421?.ready&&window.BogatkaLocationGlobalV421.audit().ok);
  await expect(page.locator(`[data-location-card="${id}"] select[data-field="objectType"]`)).toHaveValue('');
});

test('global inspection dropdowns are visible, persist and appear in the report',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const id=await card.getAttribute('data-location-card');
  const availability=card.locator('select[data-field="premiseAvailability"]');
  const readiness=card.locator('select[data-field="landlordReadiness"]');
  await expect(availability).toBeVisible();
  await expect(readiness).toBeVisible();
  await availability.selectOption('Свободно');
  await readiness.selectOption('Заинтересован');
  await page.waitForTimeout(900);
  const saved=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(saved.premiseAvailability).toBe('Свободно');
  expect(saved.landlordReadiness).toBe('Заинтересован');
  const html=await page.evaluate(()=>buildReportHtml());
  expect(html).toContain('Доступность помещения:');
  expect(html).toContain('Свободно');
  expect(html).toContain('Готовность собственника:');
  expect(html).toContain('Заинтересован');
});

test('paired controls share one grid and every caption has the same gap to its control',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  await setPanel(card,'.inspection-card-v416',true);
  await setPanel(card,'.landlord-card-v416',true);
  const result=await card.evaluate(element=>{
    const controlNode=field=>{
      const control=element.querySelector(`[data-field="${field}"]`);
      if(!control)return null;
      const wrapper=control.closest('label.field,label.object-other,label.contact-role-other-v425');
      const visible=wrapper?.querySelector('.premium-select-trigger')||control;
      return {control:visible,caption:wrapper?.querySelector(':scope > .profile-caption-v416')};
    };
    const pairs=[
      ['status','objectType'],['date','time'],['floorLocation','premiseCondition'],
      ['premiseAvailability','landlordReadiness'],['ownerName','contactRole'],['contact','contactPhone'],
      ['contactMessenger','contactEmail'],
    ];
    const pairDeltas=pairs.map(([left,right])=>{
      const a=controlNode(left)?.control?.getBoundingClientRect();
      const b=controlNode(right)?.control?.getBoundingClientRect();
      return a&&b?Math.abs(a.top-b.top):999;
    });
    const fields=['status','objectType','date','time','floorLocation','premiseCondition','premiseAvailability','landlordReadiness','ownerName','contactRole','contact','contactPhone','contactMessenger','contactEmail','nextAction','rentConditions','contactNotes'];
    const gaps=fields.map(field=>{
      const nodes=controlNode(field);
      if(!nodes?.caption||!nodes?.control)return null;
      const caption=nodes.caption.getBoundingClientRect();
      const control=nodes.control.getBoundingClientRect();
      return Math.round((control.top-caption.bottom)*10)/10;
    }).filter(value=>value!==null);
    return {pairDeltas,gaps};
  });
  for(const delta of result.pairDeltas)expect(delta).toBeLessThanOrEqual(2);
  expect(Math.max(...result.gaps)-Math.min(...result.gaps)).toBeLessThanOrEqual(1);
});

test('both open cards end on one line, while a closed neighbour remains compact',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  await setPanel(card,'.inspection-card-v416',true);
  await setPanel(card,'.landlord-card-v416',true);
  await page.waitForFunction(()=>document.querySelector('[data-location-card] .location-panels-v419')?.classList.contains('panels-both-open-v421'));
  const bothOpen=await card.evaluate(element=>{
    const left=element.querySelector('.inspection-card-v416').getBoundingClientRect();
    const right=element.querySelector('.landlord-card-v416').getBoundingClientRect();
    return {bottomDelta:Math.abs(left.bottom-right.bottom),heightDelta:Math.abs(left.height-right.height)};
  });
  expect(bothOpen.bottomDelta).toBeLessThanOrEqual(2);
  expect(bothOpen.heightDelta).toBeLessThanOrEqual(2);
  await setPanel(card,'.landlord-card-v416',false);
  const oneClosed=await card.evaluate(element=>{
    const left=element.querySelector('.inspection-card-v416').getBoundingClientRect();
    const right=element.querySelector('.landlord-card-v416').getBoundingClientRect();
    const rightToggle=element.querySelector('.landlord-card-v416 > .panel-toggle-v419').getBoundingClientRect();
    return {leftHeight:left.height,rightHeight:right.height,rightToggleHeight:rightToggle.height};
  });
  expect(oneClosed.leftHeight).toBeGreaterThan(oneClosed.rightHeight+100);
  expect(oneClosed.rightHeight).toBeLessThanOrEqual(oneClosed.rightToggleHeight+5);
});
