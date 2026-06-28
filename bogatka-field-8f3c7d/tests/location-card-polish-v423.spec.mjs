import { test, expect } from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=424';

async function openApp(page){
  await page.setViewportSize({width:1440,height:1000});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>{
    const card=document.querySelector('[data-location-card]');
    return Boolean(window.BogatkaLocationCardCollapseV422?.ready&&card?.querySelector('.location-collapse-toggle-v422')&&card?.querySelector('.decision-complete-v340'));
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

test('header metrics use one compact color and the status keeps its own bordered color',async({page})=>{
  await openApp(page);
  const result=await page.locator('[data-location-card]').first().evaluate(card=>{
    const side=card.querySelector('.location-head-side-v422');
    const boxes=[
      side.querySelector(':scope > .scorebox'),
      side.querySelector('.decision-score-v340'),
      side.querySelector('.decision-complete-v340'),
    ];
    const rects=boxes.map(box=>box.getBoundingClientRect());
    const styles=boxes.map(box=>getComputedStyle(box));
    const button=side.querySelector('.location-collapse-toggle-v422');
    const buttonRect=button.getBoundingClientRect();
    const buttonStyle=getComputedStyle(button);
    const arrowRect=button.querySelector('.location-collapse-chevron-v422').getBoundingClientRect();
    const recommendation=side.querySelector('.decision-recommendation-v340');
    const recommendationStyle=getComputedStyle(recommendation);
    return {
      widths:rects.map(rect=>Math.round(rect.width)),
      heights:rects.map(rect=>Math.round(rect.height)),
      fonts:boxes.map(box=>getComputedStyle(box.querySelector('strong')).fontSize),
      backgrounds:styles.map(style=>style.backgroundColor),
      borders:styles.map(style=>style.borderTopColor),
      buttonWidth:Math.round(buttonRect.width),
      buttonHeight:Math.round(buttonRect.height),
      buttonBackground:buttonStyle.backgroundColor,
      buttonBorderWidth:buttonStyle.borderTopWidth,
      buttonRadius:buttonStyle.borderTopLeftRadius,
      arrowCenterDeltaX:Math.abs((buttonRect.left+buttonRect.width/2)-(arrowRect.left+arrowRect.width/2)),
      arrowCenterDeltaY:Math.abs((buttonRect.top+buttonRect.height/2)-(arrowRect.top+arrowRect.height/2)),
      recommendationBorderWidth:recommendationStyle.borderTopWidth,
      recommendationBorderColor:recommendationStyle.borderTopColor,
      recommendationBackground:recommendationStyle.backgroundColor,
      recommendationRadius:recommendationStyle.borderTopLeftRadius,
    };
  });

  expect(result.widths).toEqual([64,64,64]);
  expect(result.heights).toEqual([64,64,64]);
  expect(result.fonts).toEqual(['18px','18px','18px']);
  expect(new Set(result.backgrounds).size).toBe(1);
  expect(new Set(result.borders).size).toBe(1);
  expect(result.buttonWidth).toBe(34);
  expect(result.buttonHeight).toBe(34);
  expect(result.buttonBackground).not.toBe('rgba(0, 0, 0, 0)');
  expect(result.buttonBorderWidth).toBe('1px');
  expect(result.buttonRadius).toBe('10px');
  expect(result.arrowCenterDeltaX).toBeLessThanOrEqual(1);
  expect(result.arrowCenterDeltaY).toBeLessThanOrEqual(1);
  expect(result.recommendationBorderWidth).toBe('1px');
  expect(result.recommendationBorderColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(result.recommendationBackground).not.toBe('rgba(0, 0, 0, 0)');
  expect(result.recommendationRadius).toBe('10px');
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
