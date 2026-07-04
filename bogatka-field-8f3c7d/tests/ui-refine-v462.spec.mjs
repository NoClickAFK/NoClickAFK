import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=462';

async function openApp(page,width=1600,height=1200){
  await page.setViewportSize({width,height});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaUIRefineV462?.ready&&
    window.BogatkaInspectionLayoutV461?.ready&&
    window.BogatkaLocationPanelsV419?.ready&&
    window.BogatkaCardProgressV448?.ready&&
    document.querySelector('[data-location-card] .progress-card-toggle-v462')&&
    document.querySelector('[data-location-card][data-inspection-layout-v462="1"]')
  ),{timeout:30000});
  const card=page.locator('[data-location-card]').first();
  await card.evaluate(node=>window.BogatkaLocationCardCollapseV422?.setCollapsed?.(node,false,{persist:false}));
  await card.evaluate(node=>{
    for(const panel of node.querySelectorAll('.inspection-card-v416,.landlord-card-v416')){
      panel.classList.remove('panel-closed-v419');
      panel.dataset.panelOpenV419='1';
      panel.querySelector('.panel-toggle-v419')?.setAttribute('aria-expanded','true');
    }
  });
  await page.evaluate(async()=>{
    await window.BogatkaLocationPanelsV419.enhanceAll({force:true});
    window.BogatkaInspectionLayoutV461.enhanceAll();
  });
  await card.locator('.location-panels-v419').waitFor({state:'visible'});
  await page.waitForTimeout(120);
  return card;
}

test('large recommendation copies are removed and shared compact status remains',async({page})=>{
  const card=await openApp(page);
  await expect(card.locator('.card-recommendation-v448')).toHaveCount(0);
  await expect(card.locator('[data-card-recommendation-reason-v448]')).toHaveCount(0);
  const status=card.locator('[data-card-recommendation-v448]');
  await expect(status).toBeVisible();
  await expect(status).toHaveText('Недостаточно оценок');

  const outer=card.locator('.progress-card-toggle-v462');
  await expect(outer.locator('.progress-card-toggle-copy-v462 strong')).toHaveText('Общая оценка и готовность данных');
  await expect(outer.locator('.progress-card-toggle-copy-v462 span')).toHaveText('Здесь видно, насколько подходит локация и сколько данных уже собрано');
  if(await outer.getAttribute('aria-expanded')!=='true')await outer.click();
  await expect(card.locator('.progress-recommendation-v448')).toHaveCount(0);
  await expect(card.locator('.progress-metrics-v448>article')).toHaveCount(4);
  const progressStatus=card.locator('[data-progress-card-summary-v462]');
  await expect(progressStatus).toHaveText('Недостаточно оценок');

  const result=await card.evaluate(node=>{
    const status=node.querySelector('[data-card-recommendation-v448]');
    const progressStatus=node.querySelector('[data-progress-card-summary-v462]');
    const arrow=node.querySelector('.location-collapse-toggle-v422').getBoundingClientRect();
    const rect=status.getBoundingClientRect();
    const semantic=['empty','weak','medium','good','priority','risk','stop'];
    return{
      gap:arrow.left-rect.right,
      headerClass:semantic.find(name=>status.classList.contains(name)),
      progressClass:semantic.find(name=>progressStatus.classList.contains(name)),
      oldText:node.querySelector(':scope > .location-head').innerText,
    };
  });
  expect(result.gap).toBeGreaterThanOrEqual(8);
  expect(result.headerClass).toBe(result.progressClass);
  expect(result.oldText.toUpperCase()).not.toContain('ТЕКУЩАЯ РЕКОМЕНДАЦИЯ');
});

test('inspection and landlord cards use one native grid rhythm without overflow',async({page})=>{
  const card=await openApp(page);
  for(const field of ['objectSource','listingUrl','objectSourceOther','inspectionParticipants']){
    expect(await card.locator(`[data-field="${field}"]`).evaluate(node=>node.closest('.landlord-grid-v416')!==null)).toBe(true);
  }
  await expect(card.locator('.landlord-inspection-v461')).toHaveCount(0);

  const result=await card.evaluate(node=>{
    const inspection=node.querySelector('.inspection-grid-v416');
    const landlord=node.querySelector('.landlord-grid-v416');
    const leftCard=node.querySelector('.inspection-card-v416').getBoundingClientRect();
    const rightCard=node.querySelector('.landlord-card-v416').getBoundingClientRect();
    const visibleControl=name=>{
      const control=node.querySelector(`[data-field="${name}"]`);
      return control?.nextElementSibling?.classList.contains('premium-select-trigger')?control.nextElementSibling:control;
    };
    const fields=['objectSource','listingUrl','inspectionParticipants'].map(name=>visibleControl(name).getBoundingClientRect());
    const landlordRect=landlord.getBoundingClientRect();
    const sample=node.querySelector('.landlord-grid-v416>label.field:not([hidden])');
    const caption=sample.querySelector(':scope > .profile-caption-v416');
    return{
      inspectionRowGap:getComputedStyle(inspection).rowGap,
      landlordRowGap:getComputedStyle(landlord).rowGap,
      fieldGap:getComputedStyle(sample).gap,
      captionMinHeight:getComputedStyle(caption).minHeight,
      heightDelta:Math.abs(leftCard.height-rightCard.height),
      fieldsInside:fields.every(rect=>rect.left>=landlordRect.left-1&&rect.right<=landlordRect.right+1),
      overflow:landlord.scrollWidth-landlord.clientWidth,
      listingPadding:[getComputedStyle(visibleControl('listingUrl')).paddingLeft,getComputedStyle(visibleControl('listingUrl')).paddingRight],
      participantPadding:[getComputedStyle(visibleControl('inspectionParticipants')).paddingLeft,getComputedStyle(visibleControl('inspectionParticipants')).paddingRight],
    };
  });
  expect(result.inspectionRowGap).toBe('12px');
  expect(result.landlordRowGap).toBe('12px');
  expect(result.fieldGap).toBe('5px');
  expect(result.captionMinHeight).toBe('16px');
  expect(result.heightDelta).toBeLessThanOrEqual(2);
  expect(result.fieldsInside).toBe(true);
  expect(result.overflow).toBeLessThanOrEqual(1);
  expect(result.listingPadding).toEqual(result.participantPadding);
  expect(result.listingPadding).toEqual(['10px','10px']);
});

test('progress card styling is restored and both accordion levels work independently',async({page})=>{
  const card=await openApp(page);
  const outer=card.locator('.progress-card-toggle-v462');
  const content=card.locator('.progress-card-content-v462');
  const inner=card.locator('.fill-plan-toggle-v462');
  const list=card.locator('[data-fill-plan-list-v448]');

  await expect(outer).toHaveAttribute('aria-expanded','false');
  await expect(content).toBeHidden();
  await outer.click();
  await expect(outer).toHaveAttribute('aria-expanded','true');
  await expect(content).toBeVisible();

  await expect(inner).toHaveAttribute('aria-expanded','false');
  await expect(list).toBeHidden();
  await inner.click();
  await expect(inner).toHaveAttribute('aria-expanded','true');
  await expect(list).toBeVisible();

  const styles=await card.evaluate(node=>{
    const metrics=node.querySelector('.progress-metrics-v448');
    const article=metrics.querySelector('article');
    const scale=node.querySelector('.quality-scale-v448');
    return{
      metricsDisplay:getComputedStyle(metrics).display,
      metricsColumns:getComputedStyle(metrics).gridTemplateColumns.split(' ').length,
      articleRadius:getComputedStyle(article).borderRadius,
      scaleBackground:getComputedStyle(scale).backgroundColor,
      metricCount:metrics.children.length,
      recommendationCards:node.querySelectorAll('.progress-recommendation-v448').length,
      heightDelta:Math.max(...[...metrics.children].map(item=>item.getBoundingClientRect().height))-Math.min(...[...metrics.children].map(item=>item.getBoundingClientRect().height)),
      cssLoaded:[...document.querySelectorAll('link[rel="stylesheet"]')].some(link=>(link.getAttribute('href')||'').includes('card-progress-v448.css')),
    };
  });
  expect(styles.metricsDisplay).toBe('grid');
  expect(styles.metricCount).toBe(4);
  expect(styles.recommendationCards).toBe(0);
  expect(styles.heightDelta).toBeLessThanOrEqual(2);
  expect(styles.metricsColumns).toBe(4);
  expect(styles.articleRadius).toBe('13px');
  expect(styles.cssLoaded).toBe(true);
  expect(styles.scaleBackground).not.toBe('rgba(0, 0, 0, 0)');
});

test('accordion state survives reload and mobile layout stays overflow free',async({page})=>{
  const card=await openApp(page,390,900);
  await card.locator('.progress-card-toggle-v462').click();
  await card.locator('.fill-plan-toggle-v462').click();
  const id=await card.getAttribute('data-location-card');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(async locationId=>{
    if(!window.BogatkaUIRefineV462?.ready||!window.BogatkaCardProgressV448?.ready)return false;
    if(!document.querySelector(`[data-location-card="${CSS.escape(locationId)}"] .progress-card-toggle-v462`)){
      await window.BogatkaCardProgressV448.renderAll();
      window.BogatkaUIRefineV462.enhanceAll();
    }
    return Boolean(document.querySelector(`[data-location-card="${CSS.escape(locationId)}"] .progress-card-toggle-v462`));
  },id,{timeout:30000});
  const reloaded=page.locator(`[data-location-card="${id}"]`);
  await expect(reloaded.locator('.progress-card-toggle-v462')).toHaveAttribute('aria-expanded','true');
  await expect(reloaded.locator('.fill-plan-toggle-v462')).toHaveAttribute('aria-expanded','true');
  const overflow=await reloaded.evaluate(node=>({width:node.clientWidth,scroll:node.scrollWidth}));
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.width+1);
});

test('consolidated progress assets are cached once and patch assets are absent',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  const worker=await page.evaluate(()=>fetch('./sw-v340.js').then(response=>response.text()));
  const progressStyles=await page.evaluate(()=>[...document.querySelectorAll('link[rel="stylesheet"]')]
    .map(link=>link.getAttribute('href')||'')
    .filter(href=>href.includes('card-progress-v448.css')));
  expect(worker).toContain('./card-progress-v448.css');
  expect(worker).not.toContain('./card-progress-v460.css');
  expect(worker).not.toContain('./ui-refine-v462.css');
  expect(worker).not.toContain('./ui-refine-v462.js');
  expect(progressStyles).toEqual(['./card-progress-v448.css']);
});
