import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=448';

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaCardProgressV448?.ready&&
    window.BogatkaCardProgressReportV448?.ready&&
    window.BogatkaStatusNextTaskV447?.ready&&
    window.BogatkaLiveReport?.build?.__reportStabilityV429&&
    window.BogatkaLiveReport.build.__cardProgressV448&&
    window.BogatkaLiveReport.build.__cardProgressReportV448&&
    window.buildReportHtml===window.BogatkaLiveReport.build&&
    document.querySelector('[data-location-card] .decision-progress-v448')
  ),{timeout:25000});
  return page.locator('[data-location-card]').first();
}

async function saveData(page,id,patch){
  await page.evaluate(async({locationId,next})=>{
    const current=await getLocationData(locationId);
    const merged={...current,...next};
    if(next.tech)merged.tech={...(current.tech||{}),...next.tech};
    if(next.score)merged.score={...(current.score||{}),...next.score};
    await idbPut(STORE,merged,`location:${locationId}`);
    await updateSummary();
  },{locationId:id,next:patch});
}

test('header keeps only textual recommendation and removes three numeric boxes',async({page})=>{
  const card=await openApp(page);
  await expect(card.locator(':scope > .location-head .scorebox')).toBeHidden();
  await expect(card.locator(':scope > .location-head .decision-score-v340')).toHaveCount(0);
  await expect(card.locator(':scope > .location-head .decision-complete-v340')).toHaveCount(0);
  await expect(card.locator('[data-card-recommendation-v448]')).toBeVisible();
  await expect(card.locator('[data-card-recommendation-reason-v448]')).not.toHaveText('');
  const headerText=await card.locator(':scope > .location-head').innerText();
  expect(headerText).not.toContain('/ 70');
  expect(headerText).not.toContain('/100');
  expect(headerText).not.toMatch(/\b\d+%\b/);
});

test('quality excludes blank criteria while coverage records how much was evaluated',async({page})=>{
  await openApp(page);
  const analysis=await page.evaluate(()=>({
    one:window.BogatkaCardProgressV448.scoreAnalysis({score:{foot:'5'}},window.BogatkaDecisionEngine.WEIGHTS),
    mixed:window.BogatkaCardProgressV448.scoreAnalysis({score:{foot:'5',housing:'1'}},window.BogatkaDecisionEngine.WEIGHTS),
  }));
  expect(analysis.one).toMatchObject({answered:1,coveragePercent:12,qualityScore:100,ratingScore:12});
  expect(analysis.mixed).toMatchObject({answered:2,coveragePercent:20,qualityScore:60,ratingScore:12});

  const card=page.locator('[data-location-card]').first();
  const id=await card.getAttribute('data-location-card');
  await saveData(page,id,{score:{housing:'5',occupied:'5',foot:'5',car:'5',parking:'5',stop:'5',anchor:'5',visibility:'5'}});
  await expect(card.locator('[data-progress-quality-v448]')).toHaveText('100/100');
  await expect(card.locator('[data-progress-coverage-v448]')).toHaveText('57%');
  await expect(card.locator('[data-progress-coverage-meta-v448]')).toHaveText('8 из 14 критериев');
  await expect(card.locator('.score-explanation-v448')).toContainText('Пустые критерии не занижают качество');
});

test('fill plan follows the real workflow and opens the required section',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await saveData(page,id,{
    status:'',objectType:'',date:'',time:'',floorLocation:'',premiseCondition:'',premiseAvailability:'',landlordReadiness:'',
    ownerName:'',contactRole:'',contact:'',contactPhone:'',contactMessenger:'',contactEmail:'',score:{},tech:{},pros:'',cons:'',risks:'',questions:'',decision:'',
  });
  const active=card.locator('.fill-plan-item-v448.active');
  await expect(active.locator('.fill-plan-copy-v448 strong')).toHaveText('Осмотр и статус');
  await expect(active.locator('.fill-plan-copy-v448 small')).toContainText('статус работы');
  await expect(card.locator('.fill-plan-v448')).not.toContainText('Ещё заполнить:');
  await active.locator('button').click();
  await expect(card.locator('.inspection-card-v416')).toHaveClass(/progress-target-flash-v448/);

  await saveData(page,id,{
    status:'Новый объект',objectType:'Торговый центр',date:'2026-07-01',time:'12:00',floorLocation:'1-й этаж',
    premiseCondition:'Готово к работе',premiseAvailability:'Свободно',landlordReadiness:'Готов обсуждать',
    ownerName:'ООО Арендодатель',contactRole:'Собственник',contact:'Иван',contactPhone:'+375290000000',
  });
  await expect(card.locator('.fill-plan-item-v448.active .fill-plan-copy-v448 strong')).toHaveText('Сравнительная оценка');
  await expect(card.locator('[data-fill-plan-summary-v448]')).toContainText('2 из 7 разделов готовы');
});

test('authoritative HTML and PDF report keeps the expanded evaluation block',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await saveData(page,id,{score:{housing:'4',occupied:'4',foot:'5',car:'3',parking:'4',stop:'3',anchor:'4',visibility:'5'}});
  const report=await page.evaluate(async()=>{
    const html=await window.BogatkaLiveReport.build();
    const doc=new DOMParser().parseFromString(html,'text/html');
    return{
      text:doc.body.textContent,
      authoritative:window.buildReportHtml===window.BogatkaLiveReport.build,
      stable:Boolean(window.BogatkaLiveReport.build.__reportStabilityV429),
      staged:Boolean(window.BogatkaLiveReport.build.__cardProgressV448),
      reportIntegrated:Boolean(window.BogatkaLiveReport.build.__cardProgressReportV448),
    };
  });
  expect(report.authoritative).toBe(true);
  expect(report.stable).toBe(true);
  expect(report.staged).toBe(true);
  expect(report.reportIntegrated).toBe(true);
  expect(report.text).toContain('Оценка и готовность данных');
  expect(report.text).toContain('Качество локации');
  expect(report.text).toContain('Что заполнить дальше');
  expect(report.text).toContain('Пустые критерии не занижают качество');
});

test('expanded block remains usable on a phone width',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const card=await openApp(page);
  const layout=await card.locator('.decision-progress-v448').evaluate(element=>({
    width:element.getBoundingClientRect().width,
    scrollWidth:element.scrollWidth,
    metricColumns:getComputedStyle(element.querySelector('.progress-metrics-v448')).gridTemplateColumns,
    buttons:[...element.querySelectorAll('.fill-plan-item-v448 button')].map(button=>button.getBoundingClientRect().width),
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(Math.ceil(layout.width)+1);
  expect(layout.metricColumns.split(' ').length).toBe(1);
  expect(layout.buttons.every(width=>width>250)).toBe(true);
});
