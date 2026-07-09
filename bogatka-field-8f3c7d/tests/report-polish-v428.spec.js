const {test,expect}=require('@playwright/test');

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=428';

async function openApp(page){
  await page.route('**/functions/v1/bogatka-version',route=>route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({version:'4.2.8',versionToken:'428',sourceCommit:'report428abcdef',ahead:1}),
  }));
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaLiveReport?.build?.__reportPolishV428&&
    typeof window.BogatkaLiveReport?.polishLocationCard==='function'&&
    document.getElementById('locationComparisonPanel')&&
    document.querySelector('[data-location-card]')
  ),{timeout:20000});
}

test('comparison panel is collapsed after a page reload',async({page})=>{
  await openApp(page);
  const panel=page.locator('#locationComparisonPanel');
  await expect(panel).not.toHaveAttribute('open','');
  await panel.evaluate(element=>{element.open=true});
  await expect(panel).toHaveAttribute('open','');

  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaLiveReport?.build?.__reportPolishV428&&document.getElementById('locationComparisonPanel')),{timeout:20000});
  await expect(page.locator('#locationComparisonPanel')).not.toHaveAttribute('open','');
});

test('report keeps compact comparison and removes workflow-only sections',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async()=>{
    const panel=document.getElementById('locationComparisonPanel');
    panel.open=false;
    const html=await window.BogatkaLiveReport.build();
    const doc=new DOMParser().parseFromString(html,'text/html');
    const first=doc.querySelector('.report-location-card');
    return {
      panelOpenAfterBuild:panel.open,
      compactComparison:doc.querySelectorAll('.report-comparison-table').length,
      detailedComparison:doc.querySelectorAll('.report-detailed-comparison').length,
      metrics:first?.querySelectorAll('.report-head-metric-v428').length||0,
      status:first?.querySelectorAll('.report-head-status-v428').length||0,
      normalized:doc.querySelectorAll('.report-location-normalized-v430').length,
      reportSections:first?.querySelectorAll('.report-export-section-v430').length||0,
      rawDetails:first?.querySelectorAll('details').length||0,
      economies:doc.querySelectorAll('.economy-v400').length,
      launches:doc.querySelectorAll('.launch-project-v400').length,
      histories:doc.querySelectorAll('[data-collab-pane="history"],.history-list-v400,.history-item-v400').length,
      taskExamples:doc.querySelectorAll('.task-examples-v414,.task-form-help-v414,[data-task-examples],[data-task-examples-v414]').length,
      technicalDecisionCopy:doc.querySelectorAll('.decision-copy-v412 p').length,
      technicalOverview:doc.querySelectorAll('.decision-overview-v340').length,
      collaborationTitle:first?.querySelector('.collaboration-v400>.report-section-header')?.textContent?.trim()||'',
      reportText:doc.body.textContent,
      html,
    };
  });

  expect(result.panelOpenAfterBuild).toBe(false);
  expect(result.compactComparison).toBe(1);
  expect(result.detailedComparison).toBe(0);
  expect(result.metrics).toBe(3);
  expect(result.status).toBe(1);
  expect(result.normalized).toBeGreaterThan(0);
  expect(result.reportSections).toBeGreaterThan(4);
  expect(result.rawDetails).toBe(0);
  expect(result.economies).toBe(0);
  expect(result.launches).toBe(0);
  expect(result.histories).toBe(0);
  expect(result.taskExamples).toBe(0);
  expect(result.technicalDecisionCopy).toBe(0);
  expect(result.technicalOverview).toBe(0);
  expect(result.collaborationTitle).toBe('Задачи и комментарии');
  expect(result.reportText).not.toContain('Полная таблица сравнения');
  expect(result.reportText).not.toContain('Примеры задач — нажмите');
  expect(result.reportText).not.toContain('Проект открытия магазина');
  expect(result.reportText).not.toContain('Экономическая модель и окупаемость');
});

test('report score, collaboration and decision blocks use separated grid layouts',async({page,context})=>{
  await openApp(page);
  const html=await page.evaluate(()=>window.BogatkaLiveReport.build());
  const reportPage=await context.newPage();
  await reportPage.setContent(html,{waitUntil:'load'});

  const styles=await reportPage.evaluate(()=>{
    const styleOf=selector=>{
      const element=document.querySelector(selector);
      if(!element)return null;
      const style=getComputedStyle(element);
      return {display:style.display,columns:style.gridTemplateColumns,gap:style.gap,breakInside:style.breakInside};
    };
    return {
      head:styleOf('.report-head-metrics-v428'),
      scoreScale:styleOf('.score-scale-v331,.score-scale-v415'),
      scoreGuidance:styleOf('.score-label-v414>small'),
      collaboration:styleOf('.collaboration-v400>.report-section-body'),
      decision:styleOf('.decision-actions-v412'),
      section:styleOf('.report-export-section-v430'),
    };
  });

  expect(styles.head?.display).toBe('grid');
  expect(styles.head?.columns.split(' ').length).toBe(3);
  expect(styles.scoreScale?.display).toBe('grid');
  expect(styles.scoreGuidance?.display).toBe('grid');
  expect(styles.collaboration?.display).toBe('grid');
  expect(styles.decision?.display).toBe('grid');
  expect(styles.section?.display).toBe('block');
});
