import {test,expect} from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=location-report-collapse-v464';

async function openApp(page,width=390,height=900){
  await page.setViewportSize({width,height});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>{
    const card=document.querySelector('[data-location-card]');
    return Boolean(
      window.BogatkaLocationCardCollapseV422?.ready&&
      window.BogatkaCardProgressV448?.initialized&&
      window.BogatkaUIRefineV462?.ready&&
      window.BogatkaDecisionPanel?.ready&&
      window.BogatkaSyncIntegrity?.ready&&
      typeof window.exportLocationHtmlReport==='function'&&
      card?.querySelector('.location-actions [data-card-recommendation-v448]')&&
      card?.querySelector('.progress-card-toggle-v462')&&
      card?.querySelector('.decision-reason-section-v412')
    );
  },{timeout:30000});
}

async function expandCard(card){
  const toggle=card.locator('.location-collapse-toggle-v422');
  if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
  await expect(card.locator(':scope > .location-body')).toBeVisible();
}

async function actionSnapshot(card){
  return card.evaluate(node=>{
    const head=node.querySelector(':scope > .location-head');
    const actions=head.querySelector(':scope > .location-actions');
    const group=actions.querySelector('.location-action-buttons-v448');
    const status=actions.querySelector('[data-card-recommendation-v448]');
    const toggle=head.querySelector('.location-collapse-toggle-v422');
    const buttons=[...group.children].map(element=>{
      const rect=element.getBoundingClientRect();
      return{text:element.textContent.trim(),top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right,height:rect.height};
    });
    const statusRect=status.getBoundingClientRect();
    const toggleRect=toggle.getBoundingClientRect();
    return{
      buttons,
      statusTop:statusRect.top,
      statusRight:statusRect.right,
      statusDisplay:getComputedStyle(status).display,
      rightDelta:Math.abs(toggleRect.right-statusRect.right),
      headOverflow:head.scrollWidth-head.clientWidth,
      actionOverflow:actions.scrollWidth-actions.clientWidth,
      groupOverflow:group.scrollWidth-group.clientWidth,
    };
  });
}

test('mobile actions use two compact rows and a separated right-aligned status',async({page})=>{
  await openApp(page,1440,1000);
  const card=page.locator('[data-location-card]').first();
  const desktop=await actionSnapshot(card);
  expect(desktop.buttons.some(button=>Math.abs(button.height-36)>0.5)).toBe(true);

  for(const width of [320,375,390,430]){
    await page.setViewportSize({width,height:900});
    const mobile=await actionSnapshot(card);
    expect(mobile.headOverflow,`head overflow at ${width}`).toBeLessThanOrEqual(1);
    expect(mobile.actionOverflow,`action overflow at ${width}`).toBeLessThanOrEqual(1);
    expect(mobile.groupOverflow,`button overflow at ${width}`).toBeLessThanOrEqual(1);
    expect(mobile.rightDelta,`status right edge at ${width}`).toBeLessThanOrEqual(2);
    expect(mobile.statusDisplay).not.toBe('none');
    expect(mobile.buttons.map(button=>button.text)).toEqual([
      'Открыть на карте','Изменить адрес','Отчёт HTML',
      'Очистить локацию','Восстановить','В архив',
    ]);
    const first=mobile.buttons.slice(0,3);
    const second=mobile.buttons.slice(3,6);
    expect(Math.max(...first.map(item=>item.top))-Math.min(...first.map(item=>item.top)),`first row at ${width}`).toBeLessThanOrEqual(1);
    expect(Math.max(...second.map(item=>item.top))-Math.min(...second.map(item=>item.top)),`second row at ${width}`).toBeLessThanOrEqual(1);
    for(const button of mobile.buttons){
      expect(button.height,`${button.text} height at ${width}`).toBeGreaterThanOrEqual(36);
      expect(button.height,`${button.text} height at ${width}`).toBeLessThanOrEqual(38);
    }
    const secondBottom=Math.max(...second.map(item=>item.bottom));
    expect(mobile.statusTop-secondBottom,`status spacing at ${width}`).toBeGreaterThanOrEqual(14);
  }
});

test('decision reason header matches canonical progress header on desktop and mobile',async({page})=>{
  await openApp(page,1440,1000);
  const card=page.locator('[data-location-card]').first();
  await expandCard(card);
  const progress=card.locator('.progress-card-toggle-v462');
  const reason=card.locator('.decision-reason-section-v412');
  if(await progress.getAttribute('aria-expanded')==='true')await progress.click();
  await reason.evaluate(node=>{node.open=false;node.removeAttribute('open')});

  const snapshot=async()=>card.evaluate(node=>{
    const progress=node.querySelector('.progress-card-toggle-v462');
    const reasonSection=node.querySelector('.decision-reason-section-v412');
    const reason=reasonSection.querySelector(':scope > summary');
    const progressTitle=progress.querySelector('.progress-card-toggle-copy-v462 strong');
    const reasonTitle=reason.querySelector('.decision-reason-title-v412');
    const progressDescription=progress.querySelector('.progress-card-toggle-copy-v462 span');
    const reasonDescription=reason.querySelector('.decision-reason-description-v412');
    const progressChevron=progress.querySelector('.progress-card-chevron-v462');
    const reasonChevron=reason.querySelector('.decision-reason-chevron-v412');
    const copy=reason.querySelector('.decision-reason-copy-v412');
    const style=node=>getComputedStyle(node);
    return{
      progressHeight:progress.getBoundingClientRect().height,
      reasonHeight:reason.getBoundingClientRect().height,
      progressBackground:style(progress).backgroundImage,
      reasonBackground:style(reason).backgroundImage,
      progressTitle:[style(progressTitle).fontSize,style(progressTitle).fontWeight,style(progressTitle).lineHeight],
      reasonTitle:[style(reasonTitle).fontSize,style(reasonTitle).fontWeight,style(reasonTitle).lineHeight],
      progressDescription:[style(progressDescription).fontSize,style(progressDescription).lineHeight],
      reasonDescription:[style(reasonDescription).fontSize,style(reasonDescription).lineHeight],
      progressChevron:[style(progressChevron).width,style(progressChevron).height,style(progressChevron).transform],
      reasonChevron:[style(reasonChevron).width,style(reasonChevron).height,style(reasonChevron).transform],
      sectionRadius:style(reasonSection).borderTopLeftRadius,
      summaryRadius:style(reason).borderTopLeftRadius,
      copyBackground:style(copy).backgroundColor,
      overflow:style(reasonSection).overflow,
      statusVisible:reason.querySelector('[data-decision-reason-status-v412]').getBoundingClientRect().width>0,
      description:reasonDescription.textContent.trim(),
    };
  });

  for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});
    const state=await snapshot();
    expect(Math.abs(state.progressHeight-state.reasonHeight),`height parity at ${width}`).toBeLessThanOrEqual(2);
    expect(state.reasonBackground).toBe(state.progressBackground);
    expect(state.progressTitle).toEqual(['17px','800','21.25px']);
    expect(state.reasonTitle).toEqual(state.progressTitle);
    expect(state.progressDescription).toEqual(['12px','16.8px']);
    expect(state.reasonDescription).toEqual(state.progressDescription);
    expect(state.progressChevron.slice(0,2)).toEqual(['11px','11px']);
    expect(state.reasonChevron).toEqual(state.progressChevron);
    expect(state.sectionRadius).toBe('17px');
    expect(state.summaryRadius).toBe('17px');
    expect(state.copyBackground).toBe('rgba(0, 0, 0, 0)');
    expect(state.overflow).toBe('hidden');
    expect(state.statusVisible).toBe(true);
    expect(state.description).toBe('Зафиксируйте ключевые аргументы, которые повлияли на решение по локации.');
  }

  await progress.click();
  await reason.locator(':scope > summary').click();
  const opened=await card.evaluate(node=>{
    const progress=node.querySelector('.progress-card-toggle-v462');
    const reason=node.querySelector('.decision-reason-section-v412');
    const reasonSummary=reason.querySelector(':scope > summary');
    return{
      progressTransform:getComputedStyle(progress.querySelector('.progress-card-chevron-v462')).transform,
      reasonTransform:getComputedStyle(reason.querySelector('.decision-reason-chevron-v412')).transform,
      reasonRadius:getComputedStyle(reasonSummary).borderBottomLeftRadius,
      divider:getComputedStyle(reasonSummary).borderBottomWidth,
    };
  });
  expect(opened.reasonTransform).toBe(opened.progressTransform);
  expect(opened.reasonRadius).toBe('0px');
  expect(opened.divider).toBe('1px');

  const id=await card.getAttribute('data-location-card');
  const value='— поток подтверждён;\n— аренда приемлема.';
  const saved=await page.evaluate(async({locationId,text})=>{
    const card=document.querySelector(`[data-location-card="${CSS.escape(locationId)}"]`);
    const decision=card.querySelector('input[data-field="decision"][value="Оставить"]');
    decision.checked=true;
    decision.dispatchEvent(new Event('change',{bubbles:true}));
    const control=card.querySelector('[data-field="decisionReason"]');
    control.value=text;
    control.dispatchEvent(new Event('input',{bubbles:true}));
    const result=await window.BogatkaDecisionPanel.flushReason(card);
    return{result,stored:(await getLocationData(locationId)).decisionReason,status:card.querySelector('[data-decision-reason-status-v412]').textContent};
  },{locationId:id,text:value});
  expect(saved).toEqual({result:true,stored:value,status:'Сохранено'});
});

test('summary refresh and no-op hydration preserve the opened card in the current document',async({page})=>{
  await openApp(page,390,900);
  const cards=page.locator('[data-location-card]');
  const first=cards.first();
  const second=cards.nth(1);
  const id=await first.getAttribute('data-location-card');
  await expandCard(first);
  await expect(second.locator(':scope > .location-body')).toBeHidden();
  await page.evaluate(async locationId=>{
    await updateSummary();
    const data=await getLocationData(locationId);
    await window.BogatkaSyncIntegrity.hydrateLocationCard(locationId,structuredClone(data));
    window.BogatkaLocationCardCollapseV422.enhanceAll();
  },id);
  await expect(first.locator(':scope > .location-body')).toBeVisible();
  await expect(first.locator('.location-collapse-toggle-v422')).toHaveAttribute('aria-expanded','true');
  await expect(second.locator(':scope > .location-body')).toBeHidden();
});

test('new locations receive canonical UI and start collapsed',async({page})=>{
  await openApp(page,1440,1000);
  await page.locator('#addLocationBtn').click();
  await page.locator('#locationTitle').fill('Новая тестовая локация UI');
  await page.locator('#locationAddress').fill('Гродно, тестовый адрес UI');
  await page.locator('#saveLocationBtn').click();
  const card=page.locator('[data-location-card]').filter({hasText:'Новая тестовая локация UI'});
  await expect(card).toHaveCount(1);
  await expect(card).toHaveClass(/location-card-collapsed-v422/);
  await expect(card.locator(':scope > .location-body')).toBeHidden();
  await expect(card.locator('.decision-progress-v448.progress-card-v462')).toHaveCount(1);
  await expect(card.locator('.progress-card-toggle-v462')).toHaveCount(1);
  await expect(card.locator('.decision-reason-section-v412')).toHaveCount(1);
  await expect(card.locator('[data-action="export-location-html"]')).toHaveText('Отчёт HTML');
  await expect(card.locator('[data-action="save-gps"]')).toHaveCount(0);
});
