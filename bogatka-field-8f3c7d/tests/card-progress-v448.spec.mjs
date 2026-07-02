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

test('header separates the recommendation panel from the compact semantic status',async({page})=>{
  const card=await openApp(page);
  await expect(card.locator(':scope > .location-head .scorebox')).toBeHidden();
  await expect(card.locator(':scope > .location-head .decision-score-v340')).toHaveCount(0);
  await expect(card.locator(':scope > .location-head .decision-complete-v340')).toHaveCount(0);

  const panel=card.locator('.card-recommendation-v448');
  const title=panel.locator(':scope > span');
  const reason=panel.locator(':scope > small');
  const status=panel.locator('[data-card-recommendation-v448]');
  await expect(title).toBeVisible();
  await expect(title).toHaveText('Текущая рекомендация');
  await expect(reason).toBeVisible();
  await expect(reason).toContainText('Оцените минимум 5 критериев');
  await expect(status).toBeVisible();
  await expect(status).toHaveText('Недостаточно оценок');

  const geometry=await panel.evaluate(element=>{
    const rect=element.getBoundingClientRect();
    const titleRect=element.querySelector(':scope > span').getBoundingClientRect();
    const reason=element.querySelector(':scope > small');
    const reasonRect=reason.getBoundingClientRect();
    const statusNode=element.querySelector(':scope > strong');
    const statusRect=statusNode.getBoundingClientRect();
    const statusStyle=getComputedStyle(statusNode);
    return{
      panelWidth:rect.width,
      panelHeight:rect.height,
      recommendationBottom:reasonRect.bottom,
      statusTop:statusRect.top,
      statusWidth:statusRect.width,
      statusHeight:statusRect.height,
      statusFontSize:statusStyle.fontSize,
      statusPadding:[statusStyle.paddingTop,statusStyle.paddingRight,statusStyle.paddingBottom,statusStyle.paddingLeft],
      statusBorderStyle:statusStyle.borderStyle,
      titleVisible:titleRect.height>0,
      emptyPrefix:getComputedStyle(reason,'::before').content,
      className:element.className,
    };
  });
  expect(geometry.panelWidth).toBeGreaterThan(250);
  expect(geometry.panelWidth).toBeLessThanOrEqual(330);
  expect(geometry.panelHeight).toBeGreaterThan(80);
  expect(geometry.statusTop-geometry.recommendationBottom).toBeGreaterThanOrEqual(7);
  expect(geometry.statusWidth).toBeLessThan(210);
  expect(geometry.statusHeight).toBe(34);
  expect(geometry.statusFontSize).toBe('12px');
  expect(geometry.statusPadding).toEqual(['7px','10px','7px','10px']);
  expect(geometry.statusBorderStyle).toBe('solid');
  expect(geometry.titleVisible).toBe(true);
  expect(geometry.emptyPrefix).toBe('none');
  expect(geometry.className).toContain('empty');

  const headerText=await card.locator(':scope > .location-head').innerText();
  expect(headerText.toUpperCase()).toContain('ТЕКУЩАЯ РЕКОМЕНДАЦИЯ');
  expect(headerText).toContain('Недостаточно оценок');
  expect(headerText).not.toContain('/ 70');
  expect(headerText).not.toContain('/100');
  expect(headerText).not.toMatch(/\b\d+%\b/);
});

test('recommendation status changes semantic color without changing compact geometry',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  const panel=card.locator('.card-recommendation-v448');
  const status=panel.locator('[data-card-recommendation-v448]');
  const before=await status.evaluate(element=>({background:getComputedStyle(element).backgroundColor,border:getComputedStyle(element).borderColor,height:element.getBoundingClientRect().height}));

  await saveData(page,id,{
    status:'Новый объект',objectType:'Торговый центр',date:'2026-07-02',time:'11:00',floorLocation:'1-й этаж',
    premiseCondition:'Готово к работе',premiseAvailability:'Свободно',landlordReadiness:'Готов обсуждать',
    ownerName:'ООО Арендодатель',contactRole:'Собственник',contact:'Иван',contactPhone:'+375290000000',
    score:{housing:'5',occupied:'5',foot:'5',car:'5',parking:'5',stop:'5',anchor:'5',visibility:'5'},
    tech:{totalArea:'100',rentPerMonth:'3000',powerKw:'40',openingHours:'09:00–21:00',utilities:'500',repairEstimate:'10000'},
    pros:'Хорошая видимость',cons:'Нужно уточнить условия',risks:'Нет подтверждённых рисков',questions:'Уточнить срок аренды',decision:'Оставить',criticalDealConditions:{},
  });
  await expect(panel).toHaveClass(/good/);
  await expect(status).toHaveText('Перспективно');
  const after=await status.evaluate(element=>({background:getComputedStyle(element).backgroundColor,border:getComputedStyle(element).borderColor,height:element.getBoundingClientRect().height}));
  expect(after.background).not.toBe(before.background);
  expect(after.border).not.toBe(before.border);
  expect(after.height).toBe(34);
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
    objectSource:'',inspectionPurpose:'',inspectionResult:'',
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
    objectSource:'Самостоятельный поиск',inspectionPurpose:'Первичный осмотр',inspectionResult:'Осмотр выполнен',
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

test('recommendation panel and compact status remain usable on a phone width',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const card=await openApp(page);
  const layout=await card.locator('.decision-progress-v448').evaluate(element=>({
    width:element.getBoundingClientRect().width,
    scrollWidth:element.scrollWidth,
    metricColumns:getComputedStyle(element.querySelector('.progress-metrics-v448')).gridTemplateColumns,
  }));
  const header=await card.locator('.card-recommendation-v448').evaluate(element=>{
    const status=element.querySelector(':scope > strong');
    const statusStyle=getComputedStyle(status);
    return{
      panelWidth:element.getBoundingClientRect().width,
      panelScrollWidth:element.scrollWidth,
      container:element.closest('.location-head-side-v422').getBoundingClientRect().width,
      statusWidth:status.getBoundingClientRect().width,
      statusHeight:status.getBoundingClientRect().height,
      whiteSpace:statusStyle.whiteSpace,
      overflow:statusStyle.overflow,
      textOverflow:statusStyle.textOverflow,
    };
  });
  expect(layout.scrollWidth).toBeLessThanOrEqual(Math.ceil(layout.width)+1);
  expect(layout.metricColumns.split(' ').length).toBe(1);
  expect(header.panelWidth).toBeLessThan(header.container);
  expect(header.panelScrollWidth).toBeLessThanOrEqual(Math.ceil(header.panelWidth)+1);
  expect(header.statusWidth).toBeLessThan(210);
  expect(header.statusHeight).toBe(34);
  expect(header.whiteSpace).toBe('nowrap');
  expect(header.overflow).toBe('hidden');
  expect(header.textOverflow).toBe('ellipsis');
});
