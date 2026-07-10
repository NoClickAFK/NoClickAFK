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
    window.BogatkaDecisionPanel?.ready&&
    document.querySelector('[data-location-card] .progress-card-toggle-v462')&&
    document.querySelector('[data-location-card] .decision-reason-section-v412')
  ),null,{timeout:30000});
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
    await window.BogatkaReadinessProgressV434.refresh();
  },{locationId:id,next:patch});
}

async function openToggle(toggle){if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();}
async function closeToggle(toggle){if(await toggle.getAttribute('aria-expanded')==='true')await toggle.click();}

test('progress card keeps canonical copy, metrics and fill-plan navigation',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await saveData(page,id,{status:'',objectType:'',score:{},tech:{},criticalDealConditions:{},decision:''});
  const status=card.locator('.location-actions [data-card-recommendation-v448]');
  await expect(status).toBeVisible();
  await expect(card.locator('.location-head-side-v422 [data-card-recommendation-v448]')).toHaveCount(0);
  const outer=card.locator('.progress-card-toggle-v462');
  await expect(outer.locator('.progress-card-toggle-copy-v462 strong')).toHaveText('Общая оценка и готовность данных');
  await expect(outer.locator('.progress-card-toggle-copy-v462 span')).toContainText('насколько подходит локация');
  await openToggle(outer);
  await expect(card.locator('.progress-metrics-v448>article')).toHaveCount(4);
  await expect(card.locator('[data-progress-coverage-meta-v448]')).toHaveText('Оценено 0 из 14 критериев');
  const inner=card.locator('.fill-plan-toggle-v462');
  await openToggle(inner);
  const expected={
    inspection:'Параметры осмотра',landlord:'Арендодатель и условия',scores:'Оценка локации',
    technical:'Технические и финансовые параметры',photos:'Фотографии по категориям',
    checks:'Проверки перед арендой',conclusion:'Предварительное решение по локации',
  };
  for(const [target,title] of Object.entries(expected)){
    const button=card.locator(`[data-progress-target-v448="${target}"]`);
    await expect(button.locator('xpath=..').locator('.fill-plan-copy-v448 strong')).toHaveText(title);
    await button.click();
    await expect(card.locator(`[data-progress-target-section-v448="${target}"]`)).toHaveClass(/progress-target-flash-v448/);
  }
});

test('progress remains overflow free on mobile and report authority stays intact',async({page})=>{
  const card=await openApp(page,390,844);
  await openToggle(card.locator('.progress-card-toggle-v462'));
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
      reportText:doc.body.textContent,
    };
  });
  expect(result.progressOverflow).toBeLessThanOrEqual(1);
  expect(result.actionOverflow).toBeLessThanOrEqual(1);
  expect(result.metricColumns.split(' ').length).toBe(1);
  expect(result.authoritative).toBe(true);
  expect(result.reportText).toContain('Оценка и готовность данных');
});

for(const viewport of [{name:'desktop',width:1440,height:1100},{name:'mobile',width:390,height:900}]){
  test(`decision reason keeps canonical accordion geometry on ${viewport.name}`,async({page})=>{
    const card=await openApp(page,viewport.width,viewport.height);
    const progress=card.locator('.progress-card-toggle-v462');
    const reason=card.locator('.decision-reason-section-v412');
    const summary=reason.locator(':scope > summary');
    await closeToggle(progress);
    if(await summary.getAttribute('aria-expanded')==='true')await summary.click();
    await expect(reason.locator(':scope > .decision-reason-body-v412')).toBeHidden();
    const closed=await card.evaluate(node=>{
      const progress=node.querySelector('.decision-progress-v448.progress-card-v462');
      const progressToggle=progress.querySelector(':scope > .progress-card-toggle-v462');
      const reason=node.querySelector('.decision-reason-section-v412');
      const reasonToggle=reason.querySelector(':scope > summary');
      const style=node=>getComputedStyle(node);
      return{
        reasonHeight:reason.getBoundingClientRect().height,
        progressHeight:progress.getBoundingClientRect().height,
        summaryHeight:reasonToggle.getBoundingClientRect().height,
        progressToggleHeight:progressToggle.getBoundingClientRect().height,
        background:style(reasonToggle).backgroundImage,
        progressBackground:style(progressToggle).backgroundImage,
        radius:style(reasonToggle).borderRadius,
        progressRadius:style(progressToggle).borderRadius,
        overflow:reason.scrollWidth-reason.clientWidth,
        nested:reason.querySelectorAll('.decision-reason-section-v412').length,
      };
    });
    expect(closed.background).toBe(closed.progressBackground);
    expect(closed.radius).toBe(closed.progressRadius);
    expect(closed.overflow).toBeLessThanOrEqual(1);
    expect(closed.nested).toBe(1);
    if(viewport.width>600){
      expect(Math.abs(closed.reasonHeight-closed.progressHeight)).toBeLessThanOrEqual(2);
      expect(Math.abs(closed.summaryHeight-closed.progressToggleHeight)).toBeLessThanOrEqual(2);
    }
    await summary.click();
    await expect(reason.locator(':scope > .decision-reason-body-v412')).toBeVisible();
  });
}

test('decision reason remains optional, saveable and hydration safe',async({page})=>{
  let card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await saveData(page,id,{decision:'Оставить',decisionReason:''});
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaDecisionPanel?.ready&&window.BogatkaReadinessProgressV434?.ready&&document.querySelector('[data-location-card] .decision-reason-section-v412')),{timeout:30000});
  card=page.locator(`[data-location-card="${id}"]`);
  await card.evaluate(node=>window.BogatkaLocationCardCollapseV422.setCollapsed(node,false,{persist:false}));
  const reason=card.locator('.decision-reason-section-v412');
  const summary=reason.locator(':scope > summary');
  await expect(reason.locator('[data-decision-reason-status-v412]')).toHaveText('Необязательно');
  const textarea=reason.locator('[data-field="decisionReason"]');
  await expect(textarea).toHaveAttribute('aria-required','false');
  await expect(reason).toHaveAttribute('data-required-missing','false');
  await openToggle(summary);
  await textarea.fill('Подходящий поток и приемлемая аренда');
  await expect(reason.locator('[data-decision-reason-status-v412]')).toHaveText('Есть изменения');
  await reason.locator('[data-decision-reason-save-v412]').click();
  await expect(reason.locator('[data-decision-reason-status-v412]')).toHaveText('Сохранено');
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaDecisionPanel?.ready&&document.querySelector('[data-location-card] [data-field="decisionReason"]')),{timeout:30000});
  card=page.locator(`[data-location-card="${id}"]`);
  await expect(card.locator('[data-field="decisionReason"]')).toHaveValue('Подходящий поток и приемлемая аренда');

  const protectedResult=await card.evaluate(async node=>{
    const control=node.querySelector('[data-field="decisionReason"]');
    control.focus();
    control.value='Локальный несохранённый текст';
    control.dataset.locationDataDirtyV452='1';
    control.dispatchEvent(new Event('input',{bubbles:true}));
    const data=await getLocationData(node.dataset.locationCard);
    data.decisionReason='Удалённое значение';
    await idbPut(STORE,data,`location:${node.dataset.locationCard}`);
    await window.BogatkaDecisionPanel.enhanceCard(node);
    return{value:control.value,status:node.querySelector('[data-decision-reason-status-v412]').textContent,active:document.activeElement===control};
  });
  expect(protectedResult).toEqual({value:'Локальный несохранённый текст',status:'Есть изменения',active:true});
});
