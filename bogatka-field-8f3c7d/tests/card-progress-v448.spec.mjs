import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=progress-navigation-hotfix';

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
    document.querySelector('[data-location-card] .location-actions [data-card-recommendation-v448]')&&
    window.BogatkaCardProgressV448?.initialized===true&&
    document.querySelector('[data-location-card] .progress-card-toggle-v462')
  ),{timeout:30000});
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
    await window.BogatkaCardProgressV448.renderAll();
    window.BogatkaCardProgressInitV448.refineAll();
  },{locationId:id,next:patch});
}

async function openProgressPlan(card){
  const outer=card.locator('.progress-card-toggle-v462');
  if(await outer.getAttribute('aria-expanded')!=='true')await outer.click();
  const inner=card.locator('.fill-plan-toggle-v462');
  if(await inner.count()&&await inner.getAttribute('aria-expanded')!=='true')await inner.click();
}

test('action row holds the only status and progress metrics use distinct copy',async({page})=>{
  await page.setViewportSize({width:1600,height:1100});
  const card=await openApp(page);
  const status=card.locator('.location-actions [data-card-recommendation-v448]');
  await expect(status).toBeVisible();
  await expect(status).toHaveText('Недостаточно оценок');
  await expect(status).toHaveClass(/empty/);
  await expect(card.locator('.location-head-side-v422 [data-card-recommendation-v448]')).toHaveCount(0);

  const outer=card.locator('.progress-card-toggle-v462');
  await expect(outer.locator('.progress-card-toggle-copy-v462 strong')).toHaveText('Общая оценка и готовность данных');
  await expect(outer.locator('.progress-card-toggle-copy-v462 span')).toHaveText('Здесь видно, насколько подходит локация и сколько данных уже собрано');
  await expect(outer.locator('[data-progress-card-summary-v462],.recommendation-status-v448')).toHaveCount(0);
  if(await outer.getAttribute('aria-expanded')!=='true')await outer.click();

  await expect(card.locator('.progress-metrics-v448>article')).toHaveCount(4);
  await expect(card.locator('[data-progress-quality-v448]')).toHaveText('Нет оценки');
  await expect(card.locator('[data-progress-quality-meta-v448]')).toHaveText('Оцените критерии ниже в карточке локации');
  await expect(card.locator('[data-progress-quality-meta-v448]')).not.toContainText('из 14 критериев');
  await expect(card.locator('[data-progress-coverage-v448]')).toHaveText('0%');
  await expect(card.locator('[data-progress-coverage-meta-v448]')).toHaveText('Оценено 0 из 14 критериев');
  await expect(card.locator('[data-progress-completion-meta-v448]')).toContainText('Заполнено');
  await expect(card.locator('[data-progress-checks-meta-v448]')).toHaveText('Проверок завершено');
  await expect(card.locator('.score-explanation-v448 strong')).toHaveText('Что означают показатели');
  await expect(card.locator('.score-explanation-v448 span')).toHaveText('Оценки ставятся ниже в разделе «Оценка локации». Качество показывает средний результат по заполненным критериям, а надёжность — сколько из 14 критериев уже оценено. Пустые критерии не снижают качество, но уменьшают надёжность');
  await expect(card.locator('.score-explanation-v448')).not.toContainText('1 балл = 0');
  await expect(card.locator('.quality-scale-labels-v448')).toHaveText(/0–39\s*слабая\s*40–59\s*доработать\s*60–74\s*перспективная\s*75–100\s*сильная/);

  const layout=await card.evaluate(node=>{
    const actions=node.querySelector('.location-actions');
    const buttons=actions.querySelector('.location-action-buttons-v448').getBoundingClientRect();
    const status=actions.querySelector('[data-card-recommendation-v448]').getBoundingClientRect();
    const metrics=node.querySelector('.progress-metrics-v448');
    const articles=[...metrics.children].map(item=>item.getBoundingClientRect());
    const progressToggle=node.querySelector('.progress-card-toggle-v462');
    return{
      actionOverflow:actions.scrollWidth-actions.clientWidth,
      centerDelta:Math.abs((buttons.top+buttons.height/2)-(status.top+status.height/2)),
      metricCount:articles.length,
      widthDelta:Math.max(...articles.map(item=>item.width))-Math.min(...articles.map(item=>item.width)),
      heightDelta:Math.max(...articles.map(item=>item.height))-Math.min(...articles.map(item=>item.height)),
      progressColumns:getComputedStyle(progressToggle).gridTemplateColumns.split(' ').length,
      progressStatusCount:node.querySelectorAll('[data-progress-card-summary-v462]').length,
    };
  });
  expect(layout.actionOverflow).toBeLessThanOrEqual(1);
  expect(layout.centerDelta).toBeLessThanOrEqual(3);
  expect(layout.metricCount).toBe(4);
  expect(layout.widthDelta).toBeLessThanOrEqual(2);
  expect(layout.heightDelta).toBeLessThanOrEqual(2);
  expect(layout.progressColumns).toBe(2);
  expect(layout.progressStatusCount).toBe(0);
});

test('location status keeps semantic color without a duplicated progress status',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  const status=card.locator('.location-actions [data-card-recommendation-v448]');
  const before=await status.evaluate(element=>({background:getComputedStyle(element).backgroundColor,border:getComputedStyle(element).borderColor}));
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
  await expect(card.locator('[data-progress-card-summary-v462]')).toHaveCount(0);
  const after=await status.evaluate(element=>({background:getComputedStyle(element).backgroundColor,border:getComputedStyle(element).borderColor}));
  expect(after.background).not.toBe(before.background);
  expect(after.border).not.toBe(before.border);
});

test('quality excludes blanks while only reliability reports evaluated criteria',async({page})=>{
  const card=await openApp(page);
  const analysis=await page.evaluate(()=>({
    one:window.BogatkaCardProgressV448.scoreAnalysis({score:{foot:'5'}},window.BogatkaDecisionEngine.WEIGHTS),
    mixed:window.BogatkaCardProgressV448.scoreAnalysis({score:{foot:'5',housing:'1'}},window.BogatkaDecisionEngine.WEIGHTS),
  }));
  expect(analysis.one).toMatchObject({answered:1,coveragePercent:12,qualityScore:100,ratingScore:12});
  expect(analysis.mixed).toMatchObject({answered:2,coveragePercent:20,qualityScore:60,ratingScore:12});

  const id=await card.getAttribute('data-location-card');
  await saveData(page,id,{score:{housing:'5',occupied:'5',foot:'5',car:'5',parking:'5',stop:'5',anchor:'5',visibility:'5'}});
  await expect(card.locator('[data-progress-quality-v448]')).toHaveText('100/100');
  await expect(card.locator('[data-progress-quality-meta-v448]')).toHaveText('Средний результат по заполненным критериям');
  await expect(card.locator('[data-progress-quality-meta-v448]')).not.toContainText('из 14 критериев');
  await expect(card.locator('[data-progress-coverage-v448]')).toHaveText('57%');
  await expect(card.locator('[data-progress-coverage-meta-v448]')).toHaveText('Оценено 8 из 14 критериев');
});

test('all fill-plan buttons use exact section names and open stable targets',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await saveData(page,id,{
    status:'',objectType:'',date:'',time:'',floorLocation:'',premiseCondition:'',premiseAvailability:'',landlordReadiness:'',
    objectSource:'',inspectionPurpose:'',inspectionResult:'',ownerName:'',contactRole:'',contact:'',contactPhone:'',contactMessenger:'',contactEmail:'',score:{},tech:{},criticalDealConditions:{},pros:'',cons:'',risks:'',questions:'',decision:'',
  });
  await openProgressPlan(card);

  const plan=card.locator('[data-fill-plan-list-v448]');
  const expected={
    inspection:'Параметры осмотра',
    landlord:'Арендодатель и условия',
    scores:'Оценка локации',
    technical:'Технические и финансовые параметры',
    photos:'Фотографии по категориям',
    checks:'Проверки перед арендой',
    conclusion:'Предварительное решение по локации',
  };
  await expect(plan.locator('.fill-plan-item-v448')).toHaveCount(7);
  await expect(plan.locator('.fill-plan-copy-v448>span')).toHaveCount(0);
  const descriptions=plan.locator('.fill-plan-copy-v448>small');
  await expect(descriptions).toHaveCount(7);
  expect((await descriptions.allTextContents()).every(text=>/\S/.test(text)&&/(остал|не хватает|не завершено|статус|контакт|площад|плюс|минус|риск)/i.test(text))).toBe(true);
  await expect(plan).not.toContainText(/Следующий приоритет|Далее/i);
  for(const [target,title] of Object.entries(expected)){
    await expect(plan.locator(`[data-progress-target-v448="${target}"]`).locator('xpath=..').locator('.fill-plan-copy-v448 strong')).toHaveText(title);
  }

  const inspection=card.locator('.inspection-card-v416');
  const landlord=card.locator('.landlord-card-v416');
  const inspectionToggle=inspection.locator(':scope > .panel-toggle-v419');
  const landlordToggle=landlord.locator(':scope > .panel-toggle-v419');
  if(await inspectionToggle.getAttribute('aria-expanded')==='true')await inspectionToggle.click();
  if(await landlordToggle.getAttribute('aria-expanded')==='true')await landlordToggle.click();

  const clickTarget=async target=>{
    await plan.locator(`[data-progress-target-v448="${target}"]`).click();
    const node=card.locator(`[data-progress-target-section-v448="${target}"]`);
    await expect(node).toHaveCount(1);
    await expect(node).toHaveClass(/progress-target-flash-v448/);
    return node;
  };
  const expectScrolled=async node=>{
    await expect.poll(()=>node.evaluate(element=>{
      const top=Math.round(element.getBoundingClientRect().top);
      return top>=60&&top<=100;
    })).toBe(true);
  };

  await expectScrolled(await clickTarget('inspection'));
  await expect(inspectionToggle).toHaveAttribute('aria-expanded','true');
  await expect(landlordToggle).toHaveAttribute('aria-expanded','false');
  await plan.locator('[data-progress-target-v448="inspection"]').click();
  await expect(inspectionToggle).toHaveAttribute('aria-expanded','true');

  await expectScrolled(await clickTarget('landlord'));
  await expect(landlordToggle).toHaveAttribute('aria-expanded','true');
  await expect(inspectionToggle).toHaveAttribute('aria-expanded','true');
  await plan.locator('[data-progress-target-v448="landlord"]').click();
  await expect(landlordToggle).toHaveAttribute('aria-expanded','true');

  const score=await clickTarget('scores');
  await expect(score).toHaveAttribute('open','');
  await expect(score.locator(':scope > summary')).toHaveText('Оценка локации');
  await expectScrolled(score);
  await plan.locator('[data-progress-target-v448="scores"]').click();
  await expect(score).toHaveAttribute('open','');

  for(const target of ['technical','photos','checks','conclusion']){
    const node=await clickTarget(target);
    if(await node.evaluate(element=>element.tagName==='DETAILS'))await expect(node).toHaveAttribute('open','');
    await expect(node).toContainText(expected[target]);
  }
  await expect(card).not.toContainText('Сравнительная оценка потенциала локации — 70 баллов');
});

test('lease warning remains secondary to the completed-check count',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  const criticalDealConditions=await page.evaluate(()=>Object.fromEntries(
    window.BogatkaCriticalDeal.CONDITIONS.map((definition,index)=>{
      if(index===0)return[definition.key,{status:'needs_formalization',evidenceType:'not_confirmed',note:'Получить письменное подтверждение'}];
      const evidence=window.BogatkaCriticalDeal.evidenceOptions(definition).find(item=>!['not_confirmed','oral_agreement','oral_promise'].includes(item.value));
      return[definition.key,{status:'confirmed',evidenceType:evidence.value,note:''}];
    })
  ));
  await saveData(page,id,{criticalDealConditions});
  const outer=card.locator('.progress-card-toggle-v462');
  if(await outer.getAttribute('aria-expanded')!=='true')await outer.click();
  const primary=card.locator('[data-progress-checks-v448]');
  const note=card.locator('[data-progress-checks-note-v448]');
  await expect(primary).toHaveText('10 из 10');
  await expect(card.locator('[data-progress-checks-meta-v448]')).toHaveText('Проверок завершено');
  await expect(primary).not.toHaveText('Нужно письменно');
  await expect(note).toBeVisible();
  await expect(note).toHaveText('Есть пункты без письменного подтверждения');
  const hierarchy=await card.evaluate(node=>{
    const primary=node.querySelector('[data-progress-checks-v448]');
    const note=node.querySelector('[data-progress-checks-note-v448]');
    return{primarySize:parseFloat(getComputedStyle(primary).fontSize),primaryWeight:Number(getComputedStyle(primary).fontWeight),noteSize:parseFloat(getComputedStyle(note).fontSize),noteWeight:Number(getComputedStyle(note).fontWeight)};
  });
  expect(hierarchy.noteSize).toBeLessThan(hierarchy.primarySize);
  expect(hierarchy.noteWeight).toBeLessThan(hierarchy.primaryWeight);
});

test('authoritative report remains unchanged by the visual-only correction',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await saveData(page,id,{score:{housing:'4',occupied:'4',foot:'5',car:'3',parking:'4',stop:'3',anchor:'4',visibility:'5'}});
  const report=await page.evaluate(async()=>{
    const html=await window.BogatkaLiveReport.build();
    const doc=new DOMParser().parseFromString(html,'text/html');
    return{text:doc.body.textContent,authoritative:window.buildReportHtml===window.BogatkaLiveReport.build,stable:Boolean(window.BogatkaLiveReport.build.__reportStabilityV429),staged:Boolean(window.BogatkaLiveReport.build.__cardProgressV448),integrated:Boolean(window.BogatkaLiveReport.build.__cardProgressReportV448)};
  });
  expect(report).toMatchObject({authoritative:true,stable:true,staged:true,integrated:true});
  expect(report.text).toContain('Оценка и готовность данных');
  expect(report.text).toContain('Качество локации');
});

test('mobile action status and progress remain overflow free without duplication',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const card=await openApp(page);
  const outer=card.locator('.progress-card-toggle-v462');
  await expect(outer.locator('[data-progress-card-summary-v462],.recommendation-status-v448')).toHaveCount(0);
  if(await outer.getAttribute('aria-expanded')!=='true')await outer.click();
  const layout=await card.evaluate(node=>{
    const progress=node.querySelector('.decision-progress-v448');
    const plan=node.querySelector('.fill-plan-v448');
    const actions=node.querySelector('.location-actions');
    const status=actions.querySelector('[data-card-recommendation-v448]').getBoundingClientRect();
    const actionRect=actions.getBoundingClientRect();
    return{
      progressOverflow:progress.scrollWidth-progress.clientWidth,
      planOverflow:plan.scrollWidth-plan.clientWidth,
      actionOverflow:actions.scrollWidth-actions.clientWidth,
      metricColumns:getComputedStyle(progress.querySelector('.progress-metrics-v448')).gridTemplateColumns,
      statusInside:status.left>=actionRect.left-1&&status.right<=actionRect.right+1,
      progressStatusCount:progress.querySelectorAll('[data-progress-card-summary-v462]').length,
    };
  });
  expect(layout.progressOverflow).toBeLessThanOrEqual(1);
  expect(layout.planOverflow).toBeLessThanOrEqual(1);
  expect(layout.actionOverflow).toBeLessThanOrEqual(1);
  expect(layout.metricColumns.split(' ').length).toBe(1);
  expect(layout.statusInside).toBe(true);
  expect(layout.progressStatusCount).toBe(0);
});
