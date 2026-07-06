import { test, expect } from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=462';

async function openApp(page){
  await page.setViewportSize({width:1440,height:1000});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>{
    const card=document.querySelector('[data-location-card]');
    return Boolean(window.BogatkaLocationCardCollapseV422?.ready&&window.BogatkaCardProgressV448?.ready&&card?.querySelector('.location-collapse-toggle-v422')&&card?.querySelector('.location-actions [data-card-recommendation-v448]'));
  });
}

test('archive manager has a visible rounded frame',async({page})=>{
  await openApp(page);
  const styles=await page.evaluate(()=>{
    let panel=document.getElementById('archiveManagerV400');
    if(!panel){
      panel=document.createElement('details');
      panel.id='archiveManagerV400';
      panel.className='archive-manager-v400';
      panel.innerHTML='<summary><span>Архив локаций</span><span>1</span></summary><div class="archive-list-v400"></div>';
      document.getElementById('locations').before(panel);
    }
    panel.classList.remove('hidden');
    const style=getComputedStyle(panel);
    const summaryStyle=getComputedStyle(panel.querySelector(':scope > summary'));
    return {
      borderWidth:style.borderTopWidth,
      borderStyle:style.borderTopStyle,
      borderColor:style.borderTopColor,
      radius:style.borderTopLeftRadius,
      overflow:style.overflow,
      summaryRadius:summaryStyle.borderTopLeftRadius,
    };
  });
  expect(styles.borderWidth).toBe('2px');
  expect(styles.borderStyle).toBe('solid');
  expect(styles.borderColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(styles.radius).toBe('18px');
  expect(styles.overflow).toBe('hidden');
  expect(styles.summaryRadius).toBe('16px');
});

test('collapsed location has no divider seam below the rounded header',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const toggle=card.locator('.location-collapse-toggle-v422');
  if(await toggle.getAttribute('aria-expanded')==='true')await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded','false');

  const styles=await card.evaluate(element=>{
    const cardStyle=getComputedStyle(element);
    const headStyle=getComputedStyle(element.querySelector(':scope > .location-head'));
    return {
      overflow:cardStyle.overflow,
      borderBottomWidth:headStyle.borderBottomWidth,
      bottomLeftRadius:headStyle.borderBottomLeftRadius,
      bottomRightRadius:headStyle.borderBottomRightRadius,
    };
  });
  expect(styles.overflow).toBe('hidden');
  expect(styles.borderBottomWidth).toBe('0px');
  expect(styles.bottomLeftRadius).toBe('17px');
  expect(styles.bottomRightRadius).toBe('17px');
});

test('status aligns with action buttons while collapse button remains upper-right',async({page})=>{
  await openApp(page);
  const result=await page.locator('[data-location-card]').first().evaluate(card=>{
    const head=card.querySelector(':scope > .location-head');
    const actions=head.querySelector('.location-actions');
    const buttons=actions.querySelector('.location-action-buttons-v448');
    const status=actions.querySelector('[data-card-recommendation-v448]');
    const side=head.querySelector('.location-head-side-v422');
    const button=side.querySelector('.location-collapse-toggle-v422');
    const actionRect=actions.getBoundingClientRect();
    const buttonsRect=buttons.getBoundingClientRect();
    const statusRect=status.getBoundingClientRect();
    const buttonRect=button.getBoundingClientRect();
    const arrowRect=button.querySelector('.location-collapse-chevron-v422').getBoundingClientRect();
    const statusStyle=getComputedStyle(status);
    const buttonStyle=getComputedStyle(button);
    return{
      statusWidth:statusRect.width,statusHeight:statusRect.height,statusBorderWidth:statusStyle.borderTopWidth,
      statusBorderColor:statusStyle.borderTopColor,statusRadius:statusStyle.borderTopLeftRadius,statusFontSize:statusStyle.fontSize,
      statusInActions:status.closest('.location-actions')===actions,statusInSide:side.contains(status),
      actionCenterDelta:Math.abs((buttonsRect.top+buttonsRect.height/2)-(statusRect.top+statusRect.height/2)),
      statusRightGap:Math.abs(actionRect.right-statusRect.right),buttonWidth:buttonRect.width,buttonHeight:buttonRect.height,
      buttonBackground:buttonStyle.backgroundColor,buttonBorderWidth:buttonStyle.borderTopWidth,buttonRadius:buttonStyle.borderTopLeftRadius,
      buttonAboveStatus:buttonRect.top<statusRect.top,
      arrowCenterDeltaX:Math.abs((buttonRect.left+buttonRect.width/2)-(arrowRect.left+arrowRect.width/2)),
      arrowCenterDeltaY:Math.abs((buttonRect.top+buttonRect.height/2)-(arrowRect.top+arrowRect.height/2)),
    };
  });
  expect(result.statusWidth).toBeLessThan(220);
  expect(result.statusHeight).toBeGreaterThanOrEqual(30);
  expect(result.statusBorderWidth).toBe('0px');
  expect(result.statusRadius).toBe('10px');
  expect(result.statusFontSize).toBe('11px');
  expect(result.statusInActions).toBe(true);
  expect(result.statusInSide).toBe(false);
  expect(result.actionCenterDelta).toBeLessThanOrEqual(3);
  expect(result.statusRightGap).toBeLessThanOrEqual(2);
  expect(Math.round(result.buttonWidth)).toBe(34);
  expect(Math.round(result.buttonHeight)).toBe(34);
  expect(result.buttonBackground).not.toBe('rgba(0, 0, 0, 0)');
  expect(result.buttonBorderWidth).toBe('1px');
  expect(result.buttonRadius).toBe('10px');
  expect(result.buttonAboveStatus).toBe(true);
  expect(result.arrowCenterDeltaX).toBeLessThanOrEqual(1);
  expect(result.arrowCenterDeltaY).toBeLessThanOrEqual(1);
});

test('comparison accordion uses the same button language with its own warm palette',async({page})=>{
  await openApp(page);
  const panel=page.locator('#locationComparisonPanel');
  const summary=panel.locator(':scope > summary');
  const button=panel.locator('.comparison-chevron-v332');
  await expect(button).toBeVisible();

  const closed=await button.evaluate(element=>{
    const style=getComputedStyle(element);
    const before=getComputedStyle(element,'::before');
    const rect=element.getBoundingClientRect();
    return {
      width:Math.round(rect.width),
      height:Math.round(rect.height),
      background:style.backgroundColor,
      borderWidth:style.borderTopWidth,
      borderColor:style.borderTopColor,
      radius:style.borderTopLeftRadius,
      arrowTransform:before.transform,
    };
  });
  expect(closed.width).toBe(34);
  expect(closed.height).toBe(34);
  expect(closed.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(closed.borderWidth).toBe('1px');
  expect(closed.borderColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(closed.radius).toBe('10px');

  await summary.click();
  await expect(panel).toHaveAttribute('open','');
  const openTransform=await button.evaluate(element=>getComputedStyle(element,'::before').transform);
  expect(openTransform).not.toBe(closed.arrowTransform);
});
