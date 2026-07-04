import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=460';

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

async function openProgressPlan(card){
  const outer=card.locator('.progress-card-toggle-v462');
  if(await outer.count()&&await outer.getAttribute('aria-expanded')!=='true')await outer.click();
  const inner=card.locator('.fill-plan-toggle-v462');
  if(await inner.count()&&await inner.getAttribute('aria-expanded')!=='true')await inner.click();
}

test('header and progress section keep only one compact semantic recommendation status',async({page})=>{
  const card=await openApp(page);
  await expect(card.locator('.card-recommendation-v448')).toHaveCount(0);
  const headerStatus=card.locator('[data-card-recommendation-v448]');
  await expect(headerStatus).toBeVisible();
  await expect(headerStatus).toHaveText('Недостаточно оценок');
  await expect(headerStatus).toHaveClass(/empty/);

  const outer=card.locator('.progress-card-toggle-v462');
  if(await outer.getAttribute('aria-expanded')!=='true')await outer.click();
  await expect(card.locator('.progress-card-toggle-copy-v462 strong')).toHaveText('Общая оценка и готовность данных');
  await expect(card.locator('.progress-card-toggle-copy-v462 span')).toHaveText('Здесь видно, насколько подходит локация и сколько данных уже собрано');
  await expect(card.locator('.progress-recommendation-v448')).toHaveCount(0);
  await expect(card.locator('.progress-metrics-v448>article')).toHaveCount(4);
  const progressStatus=card.locator('[data-progress-card-summary-v462]');
  await expect(progressStatus).toHaveText('Недостаточно оценок');

  const result=await card.evaluate(node=>{
    const headerStatus=node.querySelector('[data-card-recommendation-v448]');
    const progressStatus=node.querySelector('[data-progress-card-summary-v462]');
    const toggle=node.querySelector('.location-collapse-toggle-v422').getBoundingClientRect();
    const statusRect=headerStatus.getBoundingClientRect();
    const metrics=node.querySelector('.progress-metrics-v448');
    const articles=[...metrics.children].map(item=>item.getBoundingClientRect());
    const semantic=['empty','weak','medium','good','priority','risk','stop'];
    return{
      headerClass:semantic.find(name=>headerStatus.classList.contains(name)),
      progressClass:semantic.find(name=>progressStatus.classList.contains(name)),
      statusHeight:Math.round(statusRect.height),
      gapToToggle:Math.round(toggle.left-statusRect.right),
      metricCount:articles.length,
      widthDelta:Math.max(...articles.map(item=>item.width))-Math.min(...articles.map(item=>item.width)),
      metricsCoverage:Math.abs(articles[0].left-metrics.getBoundingClientRect().left)+Math.abs(articles.at(-1).right-metrics.getBoundingClientRect().right),
      headerText:node.querySelector(':scope > .location-head').innerText,
    };
  });
  expect(result.headerClass).toBe(result.progressClass);
  expect(result.statusHeight).toBeGreaterThanOrEqual(30);
  expect(result.gapToToggle).toBeGreaterThanOrEqual(8);
  expect(result.metricCount).toBe(4);
  expect(result.widthDelta).toBeLessThanOrEqual(2);
  expect(result.metricsCoverage).toBeLessThanOrEqual(2);
  expect(result.headerText.toUpperCase()).not.toContain('ТЕКУЩАЯ РЕКОМЕНДАЦИЯ');
  expect(result.headerText).not.toContain('Оцените минимум 5 критериев');
});

test('recommendation status changes shared semantic color without changing compact geometry',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  const status=card.locator('[data-card-recommendation-v448]');
  const before=await status.evaluate(element=>({
    background:getComputedStyle(element).backgroundColor,
    border:getComputedStyle(element).borderColor,
    height:element.getBoundingClientRect().height,
  }));

  await saveData(page,id,{
    status:'Новый объект',objectType:'Торговый центр',date:'2026-07-02',time:'11:00',floorLocation:'1-й этаж',
    premiseCondition:'Готово к работе',premiseAvailability:'Свободно',landlordReadiness:'Готов обсуждать',
    ownerName:'ООО Арендодатель',contactRole:'Собственник',contact:'Иван',contactPhone:'+375290000000',
    score:{housing:'5',occupied:'5',foot:'5',car:'5',parking:'5',stop:'5',anchor:'5',visibility:'5'},
    tech:{totalArea:'100',rentPerMonth:'3000',powerKw:'40',openingHours:'09:00–21:00',utilities:'500',repairEstimate:'10000'},
    pros:'Хорошая видимость',cons:'Нужно уточнить условия',risks:'Нет подтверждённых рисков',questions:'Уточнить срок аренды',decision:'Оставить',criticalDealConditions:{},
  });
  await expect(status).toHaveClass(/good/);
  await expect(status).toHaveText('Перспективно');
  const progressStatus=card.locator('[data-progress-card-summary-v462]');
  await expect(progressStatus).toHaveClass(/good/);
  const after=await status.evaluate(element=>({
    background:getComputedStyle(element).backgroundColor,
    border:getComputedStyle(element).borderColor,
    height:element.getBoundingClientRect().height,
  }));
  const progressColors=await progressStatus.evaluate(element=>({
    background:getComputedStyle(element).backgroundColor,
    border:getComputedStyle(element).borderColor,
  }));
  expect(after.background).not.toBe(before.background);
  expect(after.border).not.toBe(before.border);
  expect(progressColors).toEqual({background:after.background,border:after.border});
  expect(after.height).toBeGreaterThanOrEqual(30);
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
  await expect(card.locator('[data-progress-coverage-meta-v448]')).toHaveText('Оценено 8 из 14 критериев');
  await expect(card.locator('.score-explanation-v448')).toContainText('Пустые критерии не занижают качество');
});

test('fill plan follows the real workflow and opens the required section',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await saveData(page,id,{
    status:'',objectType:'',date:'',time:'',floorLocation:'',premiseCondition:'',premiseAvailability:'',landlordReadiness:'',
    objectSource:'',inspectionPurpose:'',inspectionResult:'',
    ownerName:'',contactRole:'',contact:'',contactPhone:'',contactMessenger:'',contactEmail:'',score:{},tech:{},pros:'',cons:'',risks:'',questions:'',decision:'',
  });
  await openProgressPlan(card);
  const active=card.locator('.fill-plan-item-v448.active');
  await expect(active.locator('.fill-plan-copy-v448 strong')).toHaveText('Осмотр и статус');
  await expect(active.locator('.fill-plan-copy-v448 small')).toContainText('статус работы');
  await expect(card.locator('.fill-plan-v448')).not.toContainText('Ещё заполнить:');
  await active.locator('button').click();
  await expect(card.locator('.inspection-card-v416')).toHaveClass(/progress-target-flash-v448/);

  await saveData(page,id,{
    status:'Новый объект',objectType:'Торговый центр',date:'2026-07-01',time:'12:00',floorLocation:'1-й этаж',
    premiseCondition:'Готово к работе',premiseAvailability:'Свободно',landlordReadiness:'Готов обсуждать',
    objectSource:'Самостоятельный поиск',inspectionPurpose:'Первичный осмотр',inspectionResult:'Осмотр выполнен',
    ownerName:'ООО Арендодатель',contactRole:'Собственник',contact:'Иван',contactPhone:'+375290000000',
  });
  await expect(card.locator('.fill-plan-item-v448.active .fill-plan-copy-v448 strong')).toHaveText('Сравнительная оценка');
  await expect(card.locator('[data-fill-plan-summary-v448]')).toContainText('2 из 7 разделов готовы');
});

test('lease metric uses completion count as primary and written-proof warning as secondary note',async({page})=>{
  const card=await openApp(page);
  const outer=card.locator('.progress-card-toggle-v462');
  if(await outer.getAttribute('aria-expanded')!=='true')await outer.click();
  const primary=card.locator('[data-progress-checks-v448]');
  const secondary=card.locator('[data-progress-checks-meta-v448]');
  const note=card.locator('[data-progress-checks-note-v448]');
  await expect(primary).toHaveText(/\d+ из 10/);
  await expect(secondary).toHaveText('Проверок завершено');
  await expect(primary).not.toHaveText('Нужно письменно');
  if(await note.isVisible()){
    await expect(note).toHaveText('Есть пункты без письменного подтверждения');
    const hierarchy=await card.evaluate(node=>{
      const primary=node.querySelector('[data-progress-checks-v448]');
      const note=node.querySelector('[data-progress-checks-note-v448]');
      return{
        primarySize:parseFloat(getComputedStyle(primary).fontSize),
        primaryWeight:Number(getComputedStyle(primary).fontWeight),
        noteSize:parseFloat(getComputedStyle(note).fontSize),
        noteWeight:Number(getComputedStyle(note).fontWeight),
      };
    });
    expect(hierarchy.noteSize).toBeLessThan(hierarchy.primarySize);
    expect(hierarchy.noteWeight).toBeLessThan(hierarchy.primaryWeight);
  }
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

test('compact status and progress metrics remain usable on a phone width',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const card=await openApp(page);
  const outer=card.locator('.progress-card-toggle-v462');
  if(await outer.getAttribute('aria-expanded')!=='true')await outer.click();
  const layout=await card.locator('.decision-progress-v448').evaluate(element=>({
    width:element.getBoundingClientRect().width,
    scrollWidth:element.scrollWidth,
    metricColumns:getComputedStyle(element.querySelector('.progress-metrics-v448')).gridTemplateColumns,
  }));
  const header=await card.locator('[data-card-recommendation-v448]').evaluate(element=>{
    const side=element.closest('.location-head-side-v422');
    return{
      statusWidth:element.getBoundingClientRect().width,
      statusHeight:element.getBoundingClientRect().height,
      sideWidth:side.getBoundingClientRect().width,
      sideScrollWidth:side.scrollWidth,
    };
  });
  expect(layout.scrollWidth).toBeLessThanOrEqual(Math.ceil(layout.width)+1);
  expect(layout.metricColumns.split(' ').length).toBe(1);
  expect(header.statusWidth).toBeLessThan(header.sideWidth);
  expect(header.statusHeight).toBeGreaterThanOrEqual(30);
  expect(header.sideScrollWidth).toBeLessThanOrEqual(Math.ceil(header.sideWidth)+1);
});

