import { test, expect } from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=423';

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

test('header metrics are compact and the collapse button stays visibly separated',async({page})=>{
  await openApp(page);
  const result=await page.locator('[data-location-card]').first().evaluate(card=>{
    const side=card.querySelector('.location-head-side-v422');
    const boxes=[
      side.querySelector(':scope > .scorebox'),
      side.querySelector('.decision-score-v340'),
      side.querySelector('.decision-complete-v340'),
    ];
    const rects=boxes.map(box=>box.getBoundingClientRect());
    const button=side.querySelector('.location-collapse-toggle-v422');
    const buttonRect=button.getBoundingClientRect();
    const buttonStyle=getComputedStyle(button);
    const recommendation=side.querySelector('.decision-recommendation-v340');
    const recommendationStyle=getComputedStyle(recommendation);
    return {
      widths:rects.map(rect=>Math.round(rect.width)),
      heights:rects.map(rect=>Math.round(rect.height)),
      fonts:boxes.map(box=>getComputedStyle(box.querySelector('strong')).fontSize),
      buttonWidth:Math.round(buttonRect.width),
      buttonBackground:buttonStyle.backgroundColor,
      buttonBorderWidth:buttonStyle.borderTopWidth,
      buttonRadius:buttonStyle.borderTopLeftRadius,
      spaceBeforeButton:Math.round(buttonRect.left-rects[2].right),
      recommendationWidth:Math.round(recommendation.getBoundingClientRect().width),
      recommendationRadius:recommendationStyle.borderTopLeftRadius,
    };
  });

  expect(result.widths).toEqual([70,70,70]);
  expect(result.heights).toEqual([70,70,70]);
  expect(result.fonts).toEqual(['19px','19px','19px']);
  expect(result.buttonWidth).toBe(38);
  expect(result.buttonBackground).not.toBe('rgba(0, 0, 0, 0)');
  expect(result.buttonBorderWidth).toBe('1px');
  expect(result.buttonRadius).toBe('11px');
  expect(result.spaceBeforeButton).toBeGreaterThanOrEqual(20);
  expect(result.recommendationWidth).toBeLessThanOrEqual(230);
  expect(result.recommendationRadius).toBe('11px');
});
