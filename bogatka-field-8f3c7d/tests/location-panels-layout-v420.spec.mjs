import { test, expect } from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=420';

async function openApp(page){
  await page.setViewportSize({width:1440,height:1000});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.BogatkaLocationPanelsV419?.ready&&document.querySelector('[data-location-card] .panel-toggle-v419'));
  await page.waitForFunction(()=>window.BogatkaLocationPanelsV419.audit().ok);
}

async function setPanel(page,sectionSelector,open){
  const section=page.locator('[data-location-card]').first().locator(sectionSelector);
  const toggle=section.locator(':scope > .panel-toggle-v419');
  const current=await toggle.getAttribute('aria-expanded');
  if((current==='true')!==open)await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded',String(open));
  return {section,toggle};
}

test('location panel header matches the comparison accordion visual pattern',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const panel=card.locator('.inspection-card-v416');
  const toggle=panel.locator(':scope > .panel-toggle-v419');
  const chevron=toggle.locator('.panel-chevron-v419');
  const comparison=page.locator('#locationComparisonPanel');
  const comparisonSummary=comparison.locator(':scope > summary');

  await setPanel(page,'.inspection-card-v416',false);
  if(await comparison.evaluate(element=>element.open))await comparisonSummary.click();

  const styles=await page.evaluate(()=>{
    const panel=document.querySelector('[data-location-card] .inspection-card-v416');
    const toggle=panel.querySelector(':scope > .panel-toggle-v419');
    const chevron=toggle.querySelector('.panel-chevron-v419');
    const comparison=document.querySelector('#locationComparisonPanel');
    const summary=comparison.querySelector(':scope > summary');
    const panelStyle=getComputedStyle(panel);
    const toggleStyle=getComputedStyle(toggle);
    const chevronStyle=getComputedStyle(chevron);
    const comparisonStyle=getComputedStyle(comparison);
    const summaryStyle=getComputedStyle(summary);
    const toggleRect=toggle.getBoundingClientRect();
    const chevronRect=chevron.getBoundingClientRect();
    return {
      panelBorder:panelStyle.border,
      comparisonBorder:comparisonStyle.border,
      panelRadius:panelStyle.borderRadius,
      comparisonRadius:comparisonStyle.borderRadius,
      toggleBackground:toggleStyle.backgroundImage,
      summaryBackground:summaryStyle.backgroundImage,
      chevronWidth:chevronStyle.width,
      chevronHeight:chevronStyle.height,
      chevronRadius:chevronStyle.borderRadius,
      chevronBackground:chevronStyle.backgroundColor,
      chevronFontSize:chevronStyle.fontSize,
      chevronRight:chevronStyle.borderRightWidth,
      chevronBottom:chevronStyle.borderBottomWidth,
      centerDelta:Math.abs((toggleRect.top+toggleRect.height/2)-(chevronRect.top+chevronRect.height/2)),
    };
  });

  expect(styles.panelBorder).toBe(styles.comparisonBorder);
  expect(styles.panelRadius).toBe(styles.comparisonRadius);
  expect(styles.toggleBackground).toBe(styles.summaryBackground);
  expect(styles.chevronWidth).toBe('11px');
  expect(styles.chevronHeight).toBe('11px');
  expect(styles.chevronRadius).toBe('0px');
  expect(styles.chevronBackground).toBe('rgba(0, 0, 0, 0)');
  expect(styles.chevronFontSize).toBe('0px');
  expect(styles.chevronRight).toBe('2px');
  expect(styles.chevronBottom).toBe('2px');
  expect(styles.centerDelta).toBeLessThanOrEqual(2);
});

test('each location panel collapses to its own header without stretching to the neighbour',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();

  const inspection=await setPanel(page,'.inspection-card-v416',true);
  const landlord=await setPanel(page,'.landlord-card-v416',false);
  await expect(landlord.section.locator('.landlord-grid-v416')).toBeHidden();

  const firstState=await card.evaluate(element=>{
    const left=element.querySelector('.inspection-card-v416');
    const right=element.querySelector('.landlord-card-v416');
    const rightToggle=right.querySelector(':scope > .panel-toggle-v419');
    return {
      leftHeight:left.getBoundingClientRect().height,
      rightHeight:right.getBoundingClientRect().height,
      rightToggleHeight:rightToggle.getBoundingClientRect().height,
    };
  });
  expect(firstState.leftHeight).toBeGreaterThan(firstState.rightHeight+120);
  expect(firstState.rightHeight).toBeLessThanOrEqual(firstState.rightToggleHeight+5);

  await setPanel(page,'.inspection-card-v416',false);
  await setPanel(page,'.landlord-card-v416',true);
  await expect(card.locator('.inspection-grid-v416')).toBeHidden();

  const secondState=await card.evaluate(element=>{
    const left=element.querySelector('.inspection-card-v416');
    const right=element.querySelector('.landlord-card-v416');
    const leftToggle=left.querySelector(':scope > .panel-toggle-v419');
    return {
      leftHeight:left.getBoundingClientRect().height,
      rightHeight:right.getBoundingClientRect().height,
      leftToggleHeight:leftToggle.getBoundingClientRect().height,
    };
  });
  expect(secondState.rightHeight).toBeGreaterThan(secondState.leftHeight+120);
  expect(secondState.leftHeight).toBeLessThanOrEqual(secondState.leftToggleHeight+5);

  await setPanel(page,'.landlord-card-v416',false);
  const closedState=await card.evaluate(element=>{
    const panels=[...element.querySelectorAll('.inspection-card-v416,.landlord-card-v416')];
    return panels.map(panel=>({
      panelHeight:panel.getBoundingClientRect().height,
      toggleHeight:panel.querySelector(':scope > .panel-toggle-v419').getBoundingClientRect().height,
    }));
  });
  for(const state of closedState)expect(state.panelHeight).toBeLessThanOrEqual(state.toggleHeight+5);
});

test('chevron rotates between the same down and up states as the comparison panel',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const toggle=card.locator('.inspection-card-v416 > .panel-toggle-v419');
  const chevron=toggle.locator('.panel-chevron-v419');

  await setPanel(page,'.inspection-card-v416',false);
  const closedTransform=await chevron.evaluate(element=>getComputedStyle(element).transform);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded','true');
  const openTransform=await chevron.evaluate(element=>getComputedStyle(element).transform);

  expect(closedTransform).not.toBe(openTransform);
  expect(closedTransform).not.toBe('none');
  expect(openTransform).not.toBe('none');
});
