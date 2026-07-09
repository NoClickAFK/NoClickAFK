const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=431';
const ARTIFACT_DIR=path.resolve('test-results/report-v431-review');

async function openApp(page){
  await page.route('**/functions/v1/bogatka-version',route=>route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({version:'4.3.1',versionToken:'431',sourceCommit:'report431abcdef',ahead:1}),
  }));
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaLiveReport?.build?.__reportFinalizeV431&&
    typeof window.BogatkaReportFinalizeV431?.renderReport==='function'&&
    typeof window.BogatkaReportFinalizeV431?.exportLocationHtmlReport==='function'&&
    typeof window.buildLocationReportHtml==='function'&&
    document.getElementById('locationComparisonPanel')&&
    document.querySelector('[data-location-card]')
  ),{timeout:35000});
}

function inspectReport(html){
  const doc=new DOMParser().parseFromString(html,'text/html');
  const text=doc.body.textContent||'';
  const styleText=[...doc.querySelectorAll('style')].map(style=>style.textContent||'').join('\n');
  const appButtons=[...doc.querySelectorAll('button')].filter(button=>!button.closest('.report-actions')).length;
  return {
    semanticDocument:doc.querySelectorAll('.report-document').length,
    semanticLocations:doc.querySelectorAll('.report-location').length,
    semanticSections:doc.querySelectorAll('.report-section').length,
    rawDetails:doc.querySelectorAll('details').length,
    rawEconomyDetails:doc.querySelectorAll('details.economy-v400,.economy-v400').length,
    appCards:doc.querySelectorAll('.report-location-card,.location-panels-v419,.inspection-card-v416,.landlord-card-v416,.decision-panel-v412,.economy-v400,.traffic-stage7-v453,.launch-v455').length,
    hiddenBodies:doc.querySelectorAll('.report-location-body[aria-hidden="true"],.location-body[aria-hidden="true"]').length,
    controls:doc.querySelectorAll('input,select,textarea').length+appButtons,
    runtimeAttrs:doc.querySelectorAll('[data-location-collapse-v422],[data-location-global-aligned-v421],[data-location-data-v452],[data-traffic-competitors-v453],[data-profile-v416],[data-overview-v417],[data-inspection-layout-v461],[data-inspection-layout-v462]').length,
    wrongZeroMetrics:/0\s*\/70[\s\S]{0,80}0\s*\/100[\s\S]{0,80}0\s*%/.test(text),
    migrationText:text.includes('Существующие данные сохранены в прежнем объекте competitor'),
    helperText:/Новые шаги создавайте|Каждый замер сохраняется отдельно|Примеры задач|Нужно заполнить|Причина пока не заполнена/.test(text),
    emptyPhotoPlan:(text.match(/0\/24/g)||[]).length,
    emptyDecisionShell:/Причина решения[\s\S]{0,80}(?:Нужно заполнить|Причина пока не заполнена|—)/.test(text),
    brokenCss:/,(?:score-scale|collaboration-v|report-progress|report-head|score-label|report-section-body)|\.collaboration-v400>\.report-section-body/.test(styleText),
    text,
  };
}

async function inspectInPage(page,html){
  return page.evaluate(({source,html})=>{
    const inspect=(new Function(`return (${source});`))();
    return inspect(html);
  },{source:inspectReport.toString(),html});
}

function expectFinalSemanticReport(result){
  expect(result.semanticDocument).toBe(1);
  expect(result.semanticLocations).toBeGreaterThan(0);
  expect(result.semanticSections).toBeGreaterThan(0);
  expect(result.rawDetails).toBe(0);
  expect(result.rawEconomyDetails).toBe(0);
  expect(result.appCards).toBe(0);
  expect(result.hiddenBodies).toBe(0);
  expect(result.controls).toBe(0);
  expect(result.runtimeAttrs).toBe(0);
  expect(result.wrongZeroMetrics).toBe(false);
  expect(result.migrationText).toBe(false);
  expect(result.helperText).toBe(false);
  expect(result.emptyPhotoPlan).toBe(0);
  expect(result.emptyDecisionShell).toBe(false);
  expect(result.brokenCss).toBe(false);
}

test('comparison panel is collapsed after a page reload',async({page})=>{
  await openApp(page);
  const panel=page.locator('#locationComparisonPanel');
  await expect(panel).not.toHaveAttribute('open','');
  await panel.evaluate(element=>{element.open=true});
  await expect(panel).toHaveAttribute('open','');

  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaLiveReport?.build?.__reportFinalizeV431&&document.getElementById('locationComparisonPanel')),{timeout:35000});
  await expect(page.locator('#locationComparisonPanel')).not.toHaveAttribute('open','');
});

test('final semantic report export removes workflow-only sections and raw app DOM',async({page})=>{
  await openApp(page);
  const html=await page.evaluate(()=>window.BogatkaLiveReport.build());
  const result=await inspectInPage(page,html);

  expectFinalSemanticReport(result);
  expect(result.text).toContain('Сравнение локаций');
  expect(result.text).not.toContain('Полная таблица сравнения');
  expect(result.text).not.toContain('Экономическая модель и окупаемость');
});

test('full report keeps filled sections for low-completion locations',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async()=>{
    const selected=locations.find(item=>!item.archivedAt);
    const data=await getLocationData(selected.id);
    data.status='';
    data.objectType='';
    data.decision='';
    data.decisionReason='';
    data.score={};
    data.tech={totalArea:'42',rentPerMonth:'1200',utilities:'300',repairEstimate:'15000',equipmentEstimate:'8000',deposit:'1200',powerKw:'8'};
    data.economy={monthlyRevenue:'26000',grossMarginPct:'35',taxRatePct:'5',payroll:'3000',marketing:'500',logistics:'400',otherOpex:'600',initialStock:'12000',workingCapital:'5000',forecastNote:'Тестовый прогноз по аналогу'};
    data.trafficMeasurements=[{date:'2026-07-09',startTime:'12:00',peopleCount:'123',targetCustomers:'17',comment:'Тестовый поток'}];
    data.competitors=[{name:'Тестовый конкурент',distance:'120 м',prices:'выше',strengths:'видимость',weaknesses:'парковка'}];
    data.questions='Тестовый открытый вопрос';
    await idbPut(STORE,data,`location:${selected.id}`);
    if(typeof updateSummary==='function')await updateSummary();
    const html=await window.BogatkaLiveReport.build();
    const doc=new DOMParser().parseFromString(html,'text/html');
    const card=doc.querySelector(`[data-report-location-id="${selected.id}"]`);
    return {text:card?.textContent||'',html};
  });
  const inspected=await inspectInPage(page,result.html);
  expectFinalSemanticReport(inspected);
  expect(result.text).toContain('Технические параметры');
  expect(result.text).toContain('Экономическая модель');
  expect(result.text).toContain('Трафик');
  expect(result.text).toContain('Конкуренты');
  expect(result.text).toContain('Тестовый конкурент');
  expect(result.text).toContain('Тестовый открытый вопрос');
  expect(result.text).toContain('Валовая маржа');
  expect(result.text).toContain('Расчётная окупаемость');
});

test('individual final semantic report export keeps authoritative score and recommendation data',async({page})=>{
  await openApp(page);
  const generated=await page.evaluate(async()=>{
    const selected=locations.find(item=>!item.archivedAt);
    const data=await getLocationData(selected.id);
    data.decision='Оставить';
    data.decisionReason='';
    data.status='Осмотрено';
    data.objectType='Торговое помещение';
    data.score={housing:4,occupied:4,foot:4,car:3,parking:4,stop:4,anchor:3,visibility:4,sign:3,loading:3,condition:4,storage:3,competition:3,overall:4};
    data.tech={...(data.tech||{}),totalArea:'80',rentPerMonth:'3000',powerKw:'15'};
    data.economy={...(data.economy||{}),monthlyRevenue:'60000',grossMarginPct:'38',taxRatePct:'5',payroll:'5000',initialStock:'20000'};
    await idbPut(STORE,data,`location:${selected.id}`);
    if(typeof updateSummary==='function')await updateSummary();
    const html=await window.buildLocationReportHtml(selected.id);
    const doc=new DOMParser().parseFromString(html,'text/html');
    const metricValues=[...doc.querySelectorAll('.report-metrics strong')].map(node=>node.textContent.trim());
    const status=doc.querySelector('.report-metrics .report-status')?.textContent?.trim()||'';
    return {html,metricValues,status};
  });
  const result={...(await inspectInPage(page,generated.html)),metricValues:generated.metricValues,status:generated.status};

  expectFinalSemanticReport(result);
  expect(result.semanticLocations).toBe(1);
  expect(result.text).toContain('Оставить');
  expect(result.text).toContain('Причина решения не заполнена.');
  expect(result.text).toContain('Валовая маржа');
  expect(result.text).toContain('Расчётная окупаемость');
  expect(result.metricValues[0]).not.toBe('0');
  expect(result.metricValues[1]).not.toBe('0');
  expect(result.metricValues[2]).not.toBe('0%');
  expect(result.status).not.toBe('Недостаточно данных');
});

test('fixture snippets from failed production exports are rejected by the report regression rules',async({page})=>{
  await openApp(page);
  const brokenSingle='<!doctype html><style>.score-scale-v331,score-scale-v415{display:grid}.collaboration-v400>.details-body,collaboration-v400>.report-section-body{display:grid}</style><article class="report-location-card" data-location-collapse-v422><div class="report-head-metrics-v428">0 /70 0 /100 0% Недостаточно данных</div><section class="decision-reason-section-v412"><h3>Причина решения</h3><p>Нужно заполнить — Причина пока не заполнена</p></section></article>';
  const brokenFull='<!doctype html><details class="economy-v400"><summary>Экономическая модель и окупаемость</summary></details><div class="report-location-body" aria-hidden="true"></div><p>Существующие данные сохранены в прежнем объекте competitor</p><p>0/24</p><p>0/24</p>';
  const single=await inspectInPage(page,brokenSingle);
  const full=await inspectInPage(page,brokenFull);
  expect(single.rawDetails+single.appCards+single.runtimeAttrs).toBeGreaterThan(0);
  expect(single.wrongZeroMetrics).toBe(true);
  expect(single.brokenCss).toBe(true);
  expect(single.emptyDecisionShell).toBe(true);
  expect(full.rawDetails).toBeGreaterThan(0);
  expect(full.rawEconomyDetails).toBeGreaterThan(0);
  expect(full.hiddenBodies).toBeGreaterThan(0);
  expect(full.migrationText).toBe(true);
  expect(full.emptyPhotoPlan).toBeGreaterThan(1);
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
    return {metrics:styleOf('.report-metrics'),fields:styleOf('.report-field-grid'),section:styleOf('.report-section'),location:styleOf('.report-location')};
  });

  expect(styles.metrics?.display).toBe('grid');
  expect(styles.fields?.display).toBe('grid');
  expect(styles.section?.display).toBe('block');
  expect(styles.location?.display).toBe('block');
});

test('export report desktop, mobile and print CSS keep semantic cards unclipped',async({page,context})=>{
  await openApp(page);
  const html=await page.evaluate(()=>window.BogatkaLiveReport.build());
  const reportPage=await context.newPage({viewport:{width:1440,height:1200}});
  await reportPage.setContent(html,{waitUntil:'load'});

  const desktop=await reportPage.evaluate(()=>({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,actions:getComputedStyle(document.querySelector('.report-actions')).display,sectionDisplay:getComputedStyle(document.querySelector('.report-section')).display}));
  expect(desktop.overflow).toBeLessThanOrEqual(1);
  expect(desktop.sectionDisplay).toBe('block');

  await reportPage.setViewportSize({width:390,height:900});
  const mobile=await reportPage.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(mobile).toBeLessThanOrEqual(1);

  await reportPage.emulateMedia({media:'print'});
  const print=await reportPage.evaluate(()=>({actions:getComputedStyle(document.querySelector('.report-actions')).display,pageStyle:[...document.styleSheets].some(sheet=>[...(sheet.cssRules||[])].some(rule=>String(rule.cssText).includes('@page')&&String(rule.cssText).includes('A4 portrait'))),locationBreak:getComputedStyle(document.querySelector('.report-location')).breakInside}));
  expect(print.actions).toBe('none');
  expect(print.pageStyle).toBe(true);
  expect(['avoid','avoid-page']).toContain(print.locationBreak);
});

test('produces review artifacts for fixed single, full and print export',async({page,context,browserName})=>{
  test.skip(browserName!=='chromium','PDF review artifact is Chromium-only.');
  await openApp(page);
  const generated=await page.evaluate(async()=>{
    const selected=locations.find(item=>!item.archivedAt);
    const data=await getLocationData(selected.id);
    data.decision='Оставить';
    data.decisionReason='';
    data.status='Осмотрено';
    data.objectType='Торговое помещение';
    data.score={housing:4,occupied:4,foot:4,car:3,parking:4,stop:4,anchor:3,visibility:4,sign:3,loading:3,condition:4,storage:3,competition:3,overall:4};
    data.tech={totalArea:'80',rentPerMonth:'3000',utilities:'400',repairEstimate:'12000',equipmentEstimate:'8000',deposit:'3000',powerKw:'15'};
    data.economy={monthlyRevenue:'60000',grossMarginPct:'38',taxRatePct:'5',payroll:'5000',marketing:'900',logistics:'700',otherOpex:'600',initialStock:'20000',workingCapital:'6000',forecastNote:'Review artifact fixture'};
    data.trafficMeasurements=[{date:'2026-07-09',startTime:'10:00',peopleCount:'144',targetCustomers:'28',comment:'Review artifact traffic'}];
    data.competitors=[{name:'Review artifact competitor',distance:'150 м',prices:'сопоставимые'}];
    await idbPut(STORE,data,`location:${selected.id}`);
    if(typeof updateSummary==='function')await updateSummary();
    return {single:await window.buildLocationReportHtml(selected.id),full:await window.BogatkaLiveReport.build()};
  });
  fs.mkdirSync(ARTIFACT_DIR,{recursive:true});
  fs.writeFileSync(path.join(ARTIFACT_DIR,'single-location-fixed.html'),generated.single);
  fs.writeFileSync(path.join(ARTIFACT_DIR,'full-report-fixed.html'),generated.full);
  const singlePage=await context.newPage({viewport:{width:1280,height:1400}});
  await singlePage.setContent(generated.single,{waitUntil:'load'});
  await singlePage.screenshot({path:path.join(ARTIFACT_DIR,'single-location-fixed.png'),fullPage:true});
  const fullPage=await context.newPage({viewport:{width:1440,height:1600}});
  await fullPage.setContent(generated.full,{waitUntil:'load'});
  await fullPage.screenshot({path:path.join(ARTIFACT_DIR,'full-report-fixed.png'),fullPage:true});
  await fullPage.emulateMedia({media:'print'});
  const printSmoke=await fullPage.evaluate(()=>({actions:getComputedStyle(document.querySelector('.report-actions')).display,pageStyle:[...document.styleSheets].some(sheet=>[...(sheet.cssRules||[])].some(rule=>String(rule.cssText).includes('@page')&&String(rule.cssText).includes('A4 portrait'))),locations:document.querySelectorAll('.report-location').length,sections:document.querySelectorAll('.report-section').length}));
  expect(printSmoke.actions).toBe('none');
  expect(printSmoke.pageStyle).toBe(true);
  await fullPage.pdf({path:path.join(ARTIFACT_DIR,'full-report-print-smoke.pdf'),format:'A4',printBackground:true});
  fs.writeFileSync(path.join(ARTIFACT_DIR,'print-smoke.json'),JSON.stringify(printSmoke,null,2));
});
