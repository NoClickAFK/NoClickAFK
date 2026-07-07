import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=location-report-collapse-v464';

async function openApp(page,width=1600,height=1100){
  await page.setViewportSize({width,height});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaCardProgressV448?.initialized&&
    window.BogatkaCardProgressReportV448?.ready&&
    window.BogatkaStatusNextTaskV447?.ready&&
    window.BogatkaLiveReport?.build?.__reportStabilityV429&&
    window.BogatkaLiveReport.build.__cardProgressV448&&
    window.BogatkaLiveReport.build.__cardProgressReportV448&&
    document.querySelector('[data-location-card] .progress-card-toggle-v462')
  ),{timeout:30000});
  const card=page.locator('[data-location-card]').first();
  await card.evaluate(node=>window.BogatkaLocationCardCollapseV422.setCollapsed(node,false,{persist:false}));
  return card;
}

async function saveData(page,id,patch){
  await page.evaluate(async({locationId,next})=>{
    const current=await getLocationData(locationId);
    const merged={...current,...next};
    if(next.tech)merged.tech={...(current.tech||{}),...next.tech};
    if(next.score)merged.score={...(current.score||{}),...next.score};
    await idbPut(STORE,merged,`location:${locationId}`);
    await updateSummary();
    await window.BogatkaCardProgressV448.renderAll();
    window.BogatkaCardProgressInitV448.refineAll();
  },{locationId:id,next:patch});
}

test('progress card keeps canonical copy, metrics and the single action-row status',async({page})=>{
  const card=await openApp(page);
  const status=card.locator('.location-actions [data-card-recommendation-v448]');
  await expect(status).toBeVisible();
  await expect(card.locator('.location-head-side-v422 [data-card-recommendation-v448]')).toHaveCount(0);
  const outer=card.locator('.progress-card-toggle-v462');
  await expect(outer.locator('.progress-card-toggle-copy-v462 strong')).toHaveText('Общая оценка и готовность данных');
  await expect(outer.locator('.progress-card-toggle-copy-v462 span')).toHaveText('Здесь видно, насколько подходит локация и сколько данных уже собрано');
  await outer.click();
  await expect(card.locator('.progress-metrics-v448>article')).toHaveCount(4);
  await expect(card.locator('[data-progress-quality-v448]')).toHaveText('Нет оценки');
  await expect(card.locator('[data-progress-coverage-meta-v448]')).toHaveText('Оценено 0 из 14 критериев');
  await expect(card.locator('[data-progress-checks-meta-v448]')).toHaveText('Проверок завершено');
  await expect(card.locator('[data-progress-card-summary-v462]')).toHaveCount(0);
});

test('fill-plan targets remain navigable after opening an initially collapsed location',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await saveData(page,id,{status:'',objectType:'',score:{},tech:{},criticalDealConditions:{},pros:'',cons:'',risks:'',questions:'',decision:''});
  const outer=card.locator('.progress-card-toggle-v462');
  if(await outer.getAttribute('aria-expanded')!=='true')await outer.click();
  const inner=card.locator('.fill-plan-toggle-v462');
  if(await inner.getAttribute('aria-expanded')!=='true')await inner.click();
  const plan=card.locator('[data-fill-plan-list-v448]');
  await expect(plan.locator('.fill-plan-item-v448')).toHaveCount(7);
  await expect(plan).not.toContainText(/Следующий приоритет|Далее/i);
  const expected={
    inspection:'Параметры осмотра',landlord:'Арендодатель и условия',scores:'Оценка локации',
    technical:'Технические и финансовые параметры',photos:'Фотографии по категориям',
    checks:'Проверки перед арендой',conclusion:'Предварительное решение по локации',
  };
  for(const [target,title] of Object.entries(expected)){
    const button=plan.locator(`[data-progress-target-v448="${target}"]`);
    await expect(button.locator('xpath=..').locator('.fill-plan-copy-v448 strong')).toHaveText(title);
    await button.click();
    const section=card.locator(`[data-progress-target-section-v448="${target}"]`);
    await expect(section).toHaveCount(1);
    await expect(section).toHaveClass(/progress-target-flash-v448/);
  }
});

test('progress remains overflow free on mobile and the global report engine stays authoritative',async({page})=>{
  const card=await openApp(page,390,844);
  const outer=card.locator('.progress-card-toggle-v462');
  if(await outer.getAttribute('aria-expanded')!=='true')await outer.click();
  const result=await card.evaluate(async node=>{
    const progress=node.querySelector('.decision-progress-v448');
    const actions=node.querySelector('.location-actions');
    const html=await window.BogatkaLiveReport.build();
    const doc=new DOMParser().parseFromString(html,'text/html');
    return{
      progressOverflow:progress.scrollWidth-progress.clientWidth,
      actionOverflow:actions.scrollWidth-actions.clientWidth,
      metricColumns:getComputedStyle(progress.querySelector('.progress-metrics-v448')).gridTemplateColumns,
      authoritative:window.buildReportHtml===window.BogatkaLiveReport.build,
      stable:Boolean(window.BogatkaLiveReport.build.__reportStabilityV429),
      reportText:doc.body.textContent,
    };
  });
  expect(result.progressOverflow).toBeLessThanOrEqual(1);
  expect(result.actionOverflow).toBeLessThanOrEqual(1);
  expect(result.metricColumns.split(' ').length).toBe(1);
  expect(result.authoritative).toBe(true);
  expect(result.stable).toBe(true);
  expect(result.reportText).toContain('Оценка и готовность данных');
});
