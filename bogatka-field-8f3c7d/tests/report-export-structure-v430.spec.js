const {test,expect}=require('@playwright/test');

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=report-export-v430';

async function openApp(page){
  await page.route('**/functions/v1/bogatka-version',route=>route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({version:'4.3.0',versionToken:'430',sourceCommit:'report430abcdef',ahead:1}),
  }));
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaLiveReport?.ready===true&&
    window.BogatkaLiveReport.build?.__reportAuthorityV428===true&&
    typeof window.BogatkaLiveReport.polishLocationCard==='function'&&
    typeof window.buildLocationReportHtml==='function'
  ),{timeout:30000});
  await page.waitForFunction(()=>document.querySelectorAll('[data-location-card]').length>1,{timeout:15000});
}

function assertCleanReportShape(result){
  expect(result.cards).toBeGreaterThan(0);
  expect(result.controls).toBe(0);
  expect(result.actions).toBe(0);
  expect(result.rawDetails).toBe(0);
  expect(result.taskExamples).toBe(0);
  expect(result.histories).toBe(0);
  expect(result.emptyDecisionShell).toBe(false);
  expect(result.reportSections).toBeGreaterThan(4);
  expect(result.normalized).toBe(result.cards);
  expect(result.text).not.toContain('Примеры задач');
  expect(result.text).not.toContain('История изменений');
}

test('full HTML export uses normalized report sections and no app-only workflow UI',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async()=>{
    const html=await window.BogatkaLiveReport.build();
    const doc=new DOMParser().parseFromString(html,'text/html');
    return {
      cards:doc.querySelectorAll('.report-location-card').length,
      normalized:doc.querySelectorAll('.report-location-normalized-v430').length,
      reportSections:doc.querySelectorAll('.report-location-card .report-export-section-v430').length,
      controls:doc.querySelectorAll('.report-location-card input,.report-location-card select,.report-location-card textarea').length,
      actions:doc.querySelectorAll('.report-location-card .location-actions,.report-location-card [data-action],.report-location-card button:not(.report-photo-open)').length,
      rawDetails:doc.querySelectorAll('.report-location-card details').length,
      taskExamples:doc.querySelectorAll('.task-examples-v414,[data-task-examples],[data-task-examples-v414]').length,
      histories:doc.querySelectorAll('[data-collab-pane="history"],.history-list-v400,.history-item-v400').length,
      emptyDecisionShell:[...doc.querySelectorAll('.report-section')].some(section=>/причина решения/i.test(section.textContent)&&!section.querySelector('.report-control-value,.report-empty-state')),
      comparison:Boolean(doc.querySelector('.report-comparison')),
      text:doc.body.textContent,
    };
  });

  assertCleanReportShape(result);
  expect(result.comparison).toBe(true);
});

test('single-location HTML export reuses the same normalized report card pipeline',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async()=>{
    const selected=locations.find(item=>!item.archivedAt);
    const data=await getLocationData(selected.id);
    data.decision='Оставить';
    data.decisionReason='Проверочная причина решения для одного отчёта';
    await idbPut(STORE,data,`location:${selected.id}`);
    const control=document.querySelector(`[data-location-card="${CSS.escape(selected.id)}"] [data-field="decisionReason"]`);
    if(control)control.value=data.decisionReason;

    const html=await window.buildLocationReportHtml(selected.id);
    const doc=new DOMParser().parseFromString(html,'text/html');
    return {
      cards:doc.querySelectorAll('.report-location-card').length,
      normalized:doc.querySelectorAll('.report-location-normalized-v430').length,
      reportSections:doc.querySelectorAll('.report-location-card .report-export-section-v430').length,
      controls:doc.querySelectorAll('.report-location-card input,.report-location-card select,.report-location-card textarea').length,
      actions:doc.querySelectorAll('.report-location-card .location-actions,.report-location-card [data-action],.report-location-card button:not(.report-photo-open)').length,
      rawDetails:doc.querySelectorAll('.report-location-card details').length,
      taskExamples:doc.querySelectorAll('.task-examples-v414,[data-task-examples],[data-task-examples-v414]').length,
      histories:doc.querySelectorAll('[data-collab-pane="history"],.history-list-v400,.history-item-v400').length,
      emptyDecisionShell:[...doc.querySelectorAll('.report-section')].some(section=>/причина решения/i.test(section.textContent)&&!section.querySelector('.report-control-value,.report-empty-state')),
      comparison:Boolean(doc.querySelector('.report-comparison')),
      globalSummary:[...doc.querySelectorAll('h2')].some(node=>node.textContent.trim()==='Общая сводка'),
      reason:doc.body.textContent.includes(data.decisionReason),
      text:doc.body.textContent,
    };
  });

  assertCleanReportShape(result);
  expect(result.cards).toBe(1);
  expect(result.comparison).toBe(false);
  expect(result.globalSummary).toBe(false);
  expect(result.reason).toBe(true);
});

test('export report desktop and print CSS keep cards unclipped and actions print-hidden',async({page,context})=>{
  await openApp(page);
  const html=await page.evaluate(()=>window.BogatkaLiveReport.build());
  const reportPage=await context.newPage({viewport:{width:1440,height:1200}});
  await reportPage.setContent(html,{waitUntil:'load'});

  const desktop=await reportPage.evaluate(()=>({
    overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    sectionDisplay:getComputedStyle(document.querySelector('.report-export-section-v430')).display,
    sectionBreak:getComputedStyle(document.querySelector('.report-export-section-v430')).breakInside,
    bodyDisplay:getComputedStyle(document.querySelector('.report-export-section-v430>.report-section-body')).display,
  }));
  expect(desktop.overflow).toBeLessThanOrEqual(1);
  expect(desktop.sectionDisplay).toBe('block');
  expect(desktop.bodyDisplay).toBe('block');

  await reportPage.emulateMedia({media:'print'});
  const print=await reportPage.evaluate(()=>({
    actions:getComputedStyle(document.querySelector('.report-actions')).display,
    pageStyle:[...document.styleSheets].some(sheet=>[...sheet.cssRules||[]].some(rule=>String(rule.cssText).includes('@page')&&String(rule.cssText).includes('A4 portrait'))),
    sectionBreak:getComputedStyle(document.querySelector('.report-export-section-v430')).breakInside,
  }));
  expect(print.actions).toBe('none');
  expect(print.pageStyle).toBe(true);
  expect(['avoid','avoid-page']).toContain(print.sectionBreak);
});
