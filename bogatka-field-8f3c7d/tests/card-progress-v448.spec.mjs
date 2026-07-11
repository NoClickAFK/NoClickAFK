import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=434';

async function openApp(page,width=1600,height=1100){
  await page.setViewportSize({width,height});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaCardProgressV448?.initialized&&
    window.BogatkaReadinessProgressV434?.ready&&
    window.BogatkaCardProgressReportV448?.ready&&
    window.BogatkaStatusNextTaskV447?.ready&&
    window.BogatkaDecisionPanel?.ready&&
    window.BogatkaLiveReport?.build?.__reportStabilityV429&&
    window.BogatkaLiveReport.build.__cardProgressV448&&
    window.BogatkaLiveReport.build.__cardProgressReportV448&&
    document.querySelector('[data-location-card] .progress-card-toggle-v462')&&
    document.querySelector('[data-location-card] .decision-reason-section-v412')
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
    await window.BogatkaReadinessProgressV434.refresh();
    window.BogatkaCardProgressInitV448.refineAll();
  },{locationId:id,next:patch});
}

async function closeAccordion(toggle){if(await toggle.getAttribute('aria-expanded')==='true')await toggle.click()}
const numericStyle=values=>values.map(value=>Number.parseFloat(value));
const expectNear=(actual,expected,tolerance=.02)=>{expect(actual).toHaveLength(expected.length);actual.forEach((value,index)=>expect(Math.abs(value-expected[index])).toBeLessThanOrEqual(tolerance))};

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
  const expected={inspection:'Параметры осмотра',landlord:'Арендодатель и условия',scores:'Оценка локации',technical:'Технические и финансовые параметры',photos:'Фотографии по категориям',checks:'Проверки перед арендой',conclusion:'Предварительное решение по локации'};
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
      reportLocations:doc.querySelectorAll('.report-location').length,
      reportHasRawProgress:Boolean(doc.querySelector('[data-progress-quality-v448],[data-fill-plan-list-v448]')),
      reportVersion:doc.querySelector('.report-meta-footer')?.textContent||'',
    };
  });
  expect(result.progressOverflow).toBeLessThanOrEqual(1);
  expect(result.actionOverflow).toBeLessThanOrEqual(1);
  expect(result.metricColumns.split(' ').length).toBe(1);
  expect(result.authoritative).toBe(true);
  expect(result.stable).toBe(true);
  expect(result.reportLocations).toBeGreaterThan(0);
  expect(result.reportHasRawProgress).toBe(false);
  expect(result.reportVersion).toContain('4.3.3');
});

for(const viewport of [{name:'desktop',width:1440,height:1100},{name:'mobile',width:390,height:900}]){
  test(`decision reason uses the canonical single-shell geometry on ${viewport.name}`,async({page})=>{
    const card=await openApp(page,viewport.width,viewport.height);
    const progressToggle=card.locator('.progress-card-toggle-v462');
    const reason=card.locator('.decision-reason-section-v412');
    const reasonToggle=reason.locator(':scope > summary');
    await closeAccordion(progressToggle);
    if(await reasonToggle.getAttribute('aria-expanded')==='true')await reasonToggle.click();
    await expect(reason.locator(':scope > .decision-reason-body-v412')).toBeHidden();

    const closed=await card.evaluate(node=>{
      const progress=node.querySelector('.decision-progress-v448.progress-card-v462');
      const progressToggle=progress.querySelector(':scope > .progress-card-toggle-v462');
      const reason=node.querySelector('.decision-reason-section-v412');
      const reasonToggle=reason.querySelector(':scope > summary');
      const title=reason.querySelector('.decision-reason-title-v412');
      const description=reason.querySelector('.decision-reason-description-v412');
      const chevron=reason.querySelector('.decision-reason-chevron-v412');
      const progressTitle=progressToggle.querySelector('.progress-card-toggle-copy-v462 strong');
      const progressDescription=progressToggle.querySelector('.progress-card-toggle-copy-v462 span');
      const progressChevron=progressToggle.querySelector('.progress-card-chevron-v462');
      const outerRect=reason.getBoundingClientRect();
      const summaryRect=reasonToggle.getBoundingClientRect();
      const progressRect=progress.getBoundingClientRect();
      const progressToggleRect=progressToggle.getBoundingClientRect();
      const style=node=>getComputedStyle(node);
      return{
        reasonHeight:outerRect.height,progressHeight:progressRect.height,summaryHeight:summaryRect.height,progressToggleHeight:progressToggleRect.height,
        background:style(reasonToggle).backgroundImage,progressBackground:style(progressToggle).backgroundImage,outerBackground:style(reason).backgroundImage,outerPadding:style(reason).padding,
        radius:style(reasonToggle).borderRadius,progressRadius:style(progressToggle).borderRadius,
        title:[style(title).fontSize,style(title).fontWeight,style(title).lineHeight],progressTitle:[style(progressTitle).fontSize,style(progressTitle).fontWeight,style(progressTitle).lineHeight],
        description:[style(description).fontSize,style(description).fontWeight,style(description).lineHeight,style(description).color],progressDescription:[style(progressDescription).fontSize,style(progressDescription).fontWeight,style(progressDescription).lineHeight,style(progressDescription).color],
        chevron:[chevron.getBoundingClientRect().width,chevron.getBoundingClientRect().height,style(chevron).borderRightWidth,style(chevron).color],progressChevron:[progressChevron.getBoundingClientRect().width,progressChevron.getBoundingClientRect().height,style(progressChevron).borderRightWidth,style(progressChevron).color],
        edges:{left:Math.abs(outerRect.left-summaryRect.left),right:Math.abs(outerRect.right-summaryRect.right),top:Math.abs(outerRect.top-summaryRect.top),bottom:Math.abs(outerRect.bottom-summaryRect.bottom)},
        legacyLabelCount:reason.querySelectorAll(':scope > label.decision-reason-v452').length,nestedReasonCount:reason.querySelectorAll('.decision-reason-section-v412').length,overflow:reason.scrollWidth-reason.clientWidth,
      };
    });

    expect(closed.background).toBe(closed.progressBackground);
    expect(closed.outerBackground).not.toBe('none');
    expect(closed.outerPadding).toBe('0px');
    expect(closed.radius).toBe(closed.progressRadius);
    expect(closed.title.slice(0,2)).toEqual(['17px','700']);
    expect(closed.progressTitle.slice(0,2)).toEqual(['17px','700']);
    expectNear(numericStyle([closed.title[2]]),numericStyle([closed.progressTitle[2]]));
    expect(closed.description.slice(0,2)).toEqual(closed.progressDescription.slice(0,2));
    expectNear(numericStyle([closed.description[2]]),numericStyle([closed.progressDescription[2]]));
    expect(closed.description[3]).toBe(closed.progressDescription[3]);
    expectNear(numericStyle(closed.chevron.slice(0,3)),numericStyle(closed.progressChevron.slice(0,3)));
    expect(closed.chevron[3]).toBe(closed.progressChevron[3]);
    expect(closed.legacyLabelCount).toBe(0);
    expect(closed.nestedReasonCount).toBe(0);
    expect(closed.overflow).toBeLessThanOrEqual(1);
    expect(closed.edges.left).toBeLessThanOrEqual(1);
    expect(closed.edges.right).toBeLessThanOrEqual(1);
    expect(closed.edges.top).toBeLessThanOrEqual(1);
    expect(closed.edges.bottom).toBeLessThanOrEqual(1);
    if(viewport.width>600){expect(Math.abs(closed.reasonHeight-closed.progressHeight)).toBeLessThanOrEqual(2);expect(Math.abs(closed.summaryHeight-closed.progressToggleHeight)).toBeLessThanOrEqual(2)}

    const topBefore=await reason.evaluate(node=>node.getBoundingClientRect().top);
    await reasonToggle.click();
    await expect(reasonToggle).toHaveAttribute('aria-expanded','true');
    await expect(reason.locator(':scope > .decision-reason-body-v412')).toBeVisible();
    const opened=await reason.evaluate(node=>{
      const summary=node.querySelector(':scope > summary');
      const body=node.querySelector(':scope > .decision-reason-body-v412');
      const outer=getComputedStyle(node);const summaryStyle=getComputedStyle(summary);
      return{top:node.getBoundingClientRect().top,bodyParent:body.parentElement===node,borderWidth:outer.borderTopWidth,summaryDivider:summaryStyle.borderBottomWidth,bottomRadius:outer.borderBottomLeftRadius,nestedWhiteCard:body.querySelector('.decision-reason-v452')!==null};
    });
    expect(Math.abs(opened.top-topBefore)).toBeLessThanOrEqual(1);
    expect(opened.bodyParent).toBe(true);
    expect(opened.borderWidth).toBe('1px');
    expect(opened.summaryDivider).toBe('1px');
    expect(opened.bottomRadius).not.toBe('0px');
    expect(opened.nestedWhiteCard).toBe(false);
    await reasonToggle.click();
    await expect(reasonToggle).toHaveAttribute('aria-expanded','false');
  });
}

test('decision reason status follows dirty, saved, optional and hydration states deterministically',async({page})=>{
  let card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await page.evaluate(async locationId=>{
    const data=await getLocationData(locationId);data.decision='';data.decisionReason='';await idbPut(STORE,data,`location:${locationId}`);
    document.querySelectorAll(`[data-location="${CSS.escape(locationId)}"][data-field="decision"]`).forEach(radio=>radio.checked=false);
    await window.BogatkaDecisionPanel.enhanceCard(document.querySelector(`[data-location-card="${CSS.escape(locationId)}"]`));
  },id);

  const reason=card.locator('.decision-reason-section-v412');
  const toggle=reason.locator(':scope > summary');
  if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
  const textarea=reason.locator('[data-field="decisionReason"]');
  const status=reason.locator('[data-decision-reason-status-v412]');
  const feedback=reason.locator('[data-decision-reason-feedback-v412]');
  const save=reason.locator('[data-decision-reason-save-v412]');
  await expect(status).toHaveText('Не заполнено');
  await textarea.fill('Подходящий поток и заселённый район');
  await expect(status).toHaveText('Есть изменения');
  await expect(feedback).toHaveText('Есть несохранённые изменения');
  await save.click();
  await expect(status).toHaveText('Сохранено');
  await expect(feedback).toHaveText('Причина сохранена');

  await textarea.fill('Подходящий поток, заселённый район и приемлемая аренда');
  await expect(status).toHaveText('Есть изменения');
  await save.click();
  await expect(status).toHaveText('Сохранено');
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaDecisionPanel?.ready&&window.BogatkaReadinessProgressV434?.ready&&document.querySelector('[data-location-card] .decision-reason-section-v412')),{timeout:30000});
  card=page.locator(`[data-location-card="${id}"]`);
  await card.evaluate(node=>window.BogatkaLocationCardCollapseV422.setCollapsed(node,false,{persist:false}));
  await expect(card.locator('[data-field="decisionReason"]')).toHaveValue('Подходящий поток, заселённый район и приемлемая аренда');
  await expect(card.locator('[data-decision-reason-status-v412]')).toHaveText('Сохранено');

  await page.evaluate(async locationId=>{const data=await getLocationData(locationId);data.decision='Оставить';data.decisionReason='';await idbPut(STORE,data,`location:${locationId}`)},id);
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaDecisionPanel?.ready&&window.BogatkaReadinessProgressV434?.ready&&document.querySelector('[data-location-card] .decision-reason-section-v412')),{timeout:30000});
  card=page.locator(`[data-location-card="${id}"]`);
  await card.evaluate(node=>window.BogatkaLocationCardCollapseV422.setCollapsed(node,false,{persist:false}));
  await expect(card.locator('[data-decision-reason-status-v412]')).toHaveText('Необязательно');
  await expect(card.locator('[data-field="decisionReason"]')).toHaveAttribute('aria-required','false');
  await expect(card.locator('.decision-reason-section-v412')).toHaveAttribute('data-required-missing','false');

  const protectedResult=await card.evaluate(async node=>{
    const control=node.querySelector('[data-field="decisionReason"]');control.focus();control.value='Локальный несохранённый текст';control.dataset.locationDataDirtyV452='1';control.dispatchEvent(new Event('input',{bubbles:true}));
    const data=await getLocationData(node.dataset.locationCard);data.decisionReason='Чистое удалённое значение';await idbPut(STORE,data,`location:${node.dataset.locationCard}`);await window.BogatkaDecisionPanel.enhanceCard(node);
    return{value:control.value,status:node.querySelector('[data-decision-reason-status-v412]').textContent,active:document.activeElement===control};
  });
  expect(protectedResult).toEqual({value:'Локальный несохранённый текст',status:'Есть изменения',active:true});

  await card.evaluate(async node=>{const control=node.querySelector('[data-field="decisionReason"]');control.blur();delete control.dataset.locationDataDirtyV452;await window.BogatkaDecisionPanel.enhanceCard(node)});
  await expect(card.locator('[data-field="decisionReason"]')).toHaveValue('Чистое удалённое значение');
  await expect(card.locator('[data-decision-reason-status-v412]')).toHaveText('Сохранено');
});
