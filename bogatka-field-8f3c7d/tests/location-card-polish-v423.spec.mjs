import { test, expect } from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=462';

async function openApp(page){
  await page.setViewportSize({width:1440,height:1000});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>{
    const card=document.querySelector('[data-location-card]');
    return Boolean(window.BogatkaLocationCardCollapseV422?.ready&&window.BogatkaCardProgressV448?.ready&&card?.querySelector('.location-collapse-toggle-v422')&&card?.querySelector('.card-recommendation-v448'));
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

test('header uses a premium recommendation panel with a separate compact semantic status',async({page})=>{
  await openApp(page);
  const result=await page.locator('[data-location-card]').first().evaluate(card=>{
    const side=card.querySelector('.location-head-side-v422');
    const recommendation=side.querySelector('.card-recommendation-v448');
    const recommendationRect=recommendation.getBoundingClientRect();
    const title=recommendation.querySelector(':scope > span');
    const reason=recommendation.querySelector(':scope > small');
    const status=recommendation.querySelector(':scope > strong');
    const titleStyle=getComputedStyle(title);
    const reasonStyle=getComputedStyle(reason);
    const statusRect=status.getBoundingClientRect();
    const statusStyle=getComputedStyle(status);
    const button=side.querySelector('.location-collapse-toggle-v422');
    const buttonRect=button.getBoundingClientRect();
    const buttonStyle=getComputedStyle(button);
    const arrowRect=button.querySelector('.location-collapse-chevron-v422').getBoundingClientRect();
    const actions=card.querySelector('.location-actions').getBoundingClientRect();
    return {
      recommendationWidth:Math.round(recommendationRect.width),
      recommendationHeight:Math.round(recommendationRect.height),
      titleBorderWidth:titleStyle.borderTopWidth,
      titleRadius:titleStyle.borderTopLeftRadius,
      reasonBorderWidth:reasonStyle.borderBottomWidth,
      reasonRadius:reasonStyle.borderBottomLeftRadius,
      statusWidth:Math.round(statusRect.width),
      statusHeight:Math.round(statusRect.height),
      statusBorderWidth:statusStyle.borderTopWidth,
      statusBorderColor:statusStyle.borderTopColor,
      statusRadius:statusStyle.borderTopLeftRadius,
      statusFontSize:statusStyle.fontSize,
      statusGap:Math.round(statusRect.top-reason.getBoundingClientRect().bottom),
      actionCenterDelta:Math.abs((actions.top+actions.bottom)/2-(statusRect.top+statusRect.bottom)/2),
      oldMetricCount:side.querySelectorAll('.decision-score-v340,.decision-complete-v340').length,
      rawVisible:getComputedStyle(side.querySelector(':scope > .scorebox')).display!=='none',
      buttonWidth:Math.round(buttonRect.width),
      buttonHeight:Math.round(buttonRect.height),
      buttonBackground:buttonStyle.backgroundColor,
      buttonBorderWidth:buttonStyle.borderTopWidth,
      buttonRadius:buttonStyle.borderTopLeftRadius,
      gap:Math.round(buttonRect.left-recommendationRect.right),
      arrowCenterDeltaX:Math.abs((buttonRect.left+buttonRect.width/2)-(arrowRect.left+arrowRect.width/2)),
      arrowCenterDeltaY:Math.abs((buttonRect.top+buttonRect.height/2)-(arrowRect.top+arrowRect.height/2)),
    };
  });

  expect(result.recommendationWidth).toBeGreaterThan(250);
  expect(result.recommendationWidth).toBeLessThanOrEqual(330);
  expect(result.recommendationHeight).toBeGreaterThan(80);
  expect(result.titleBorderWidth).toBe('1px');
  expect(result.titleRadius).toBe('15px');
  expect(result.reasonBorderWidth).toBe('1px');
  expect(result.reasonRadius).toBe('15px');
  expect(result.statusWidth).toBeLessThan(210);
  expect(result.statusHeight).toBe(34);
  expect(result.statusBorderWidth).toBe('1px');
  expect(result.statusBorderColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(result.statusRadius).toBe('10px');
  expect(result.statusFontSize).toBe('12px');
  expect(result.statusGap).toBeGreaterThanOrEqual(30);
  expect(result.statusGap).toBeLessThanOrEqual(70);
  expect(result.actionCenterDelta).toBeLessThanOrEqual(3);
  expect(result.oldMetricCount).toBe(0);
  expect(result.rawVisible).toBe(false);
  expect(result.buttonWidth).toBe(34);
  expect(result.buttonHeight).toBe(34);
  expect(result.buttonBackground).not.toBe('rgba(0, 0, 0, 0)');
  expect(result.buttonBorderWidth).toBe('1px');
  expect(result.buttonRadius).toBe('10px');
  expect(result.gap).toBeGreaterThanOrEqual(9);
  expect(result.gap).toBeLessThanOrEqual(14);
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
