const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=433';
const ARTIFACT_DIR=path.resolve('test-results/report-v433-review');
// This exact-head test also owns the final review artifact contract for v4.3.3.

async function openApp(page){
  await page.route('**/functions/v1/bogatka-version',route=>route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({version:'4.3.3',versionToken:'433',sourceCommit:'report433abcdef',ahead:1}),
  }));
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaLiveReport?.build?.__reportFinalizeV433&&
    window.BogatkaLiveReport?.build?.__reportFinalizeV432&&
    typeof window.BogatkaReportFinalizeV433?.finalizeHtml==='function'&&
    typeof window.buildLocationReportHtml==='function'&&
    document.querySelector('[data-location-card]')
  ),{timeout:45000});
}

async function generateFixtures(page){
  return page.evaluate(async()=>{
    const active=locations.filter(item=>!item.archivedAt);
    const selected=active[0];
    const weaker=active[1]||active[0];
    const data=await getLocationData(selected.id);
    data.decision='Оставить';
    data.decisionReason='Локация соответствует рабочему порогу по качеству, имеет приемлемую аренду и подтверждённый поток. Перед подписанием договора нужно зафиксировать условия ремонта и арендные каникулы.';
    data.status='Осмотрено';
    data.objectType='Торговое помещение';
    data.score={housing:4,occupied:4,foot:4,car:3,parking:4,stop:4,anchor:3,visibility:4,sign:3,loading:3,condition:4,storage:3,competition:3,overall:4};
    data.tech={totalArea:'80',rentPerMonth:'3000',utilities:'400',repairEstimate:'12000',equipmentEstimate:'8000',deposit:'3000',powerKw:'15'};
    data.economy={monthlyRevenue:'60000',grossMarginPct:'38',taxRatePct:'5',payroll:'5000',marketing:'900',logistics:'700',otherOpex:'600',initialStock:'20000',workingCapital:'6000',forecastNote:'Прогноз построен по сопоставимой действующей точке.'};
    data.trafficMeasurements=[{date:'2026-07-09',startTime:'10:00',peopleCount:'144',targetCustomers:'28',comment:'Стабильный поток в утренний период, заметная доля целевой аудитории.'}];
    data.competitors=[{name:'Конкурент рядом',distance:'150 м',prices:'сопоставимые',strengths:'видимость',weaknesses:'ограниченная парковка'}];
    await idbPut(STORE,data,`location:${selected.id}`);
    if(weaker&&weaker.id!==selected.id){
      const weakData=await getLocationData(weaker.id);
      weakData.decision='';weakData.tech={};weakData.economy={};weakData.score={};
      await idbPut(STORE,weakData,`location:${weaker.id}`);
    }
    if(typeof updateSummary==='function')await updateSummary();
    return {single:await window.buildLocationReportHtml(selected.id),full:await window.BogatkaLiveReport.build()};
  });
}

async function inspectReport(context,html,{width=1440,height=1400,print=false}={}){
  const reportPage=await context.newPage();
  await reportPage.setViewportSize({width,height});
  await reportPage.setContent(html,{waitUntil:'load'});
  if(print)await reportPage.emulateMedia({media:'print'});
  const result=await reportPage.evaluate(()=>{
    const px=value=>Number.parseFloat(value||'0');
    const h1=document.querySelector('.report-cover h1');
    const h2=document.querySelector('.report-summary h2,.report-comparison h2,.report-location-header h2');
    const h3=document.querySelector('.report-section-label-v432 strong,.report-section-title h3,.report-section h3');
    const bodyValue=document.querySelector('.report-field strong');
    const fieldGrid=document.querySelector('.report-field-grid');
    const section=document.querySelector('.report-section-accordion-v432');
    const pills=[...document.querySelectorAll('.report-status')];
    const hiddenBody=document.querySelector('.report-accordion-body-v432[hidden]');
    return {
      styleCount:document.querySelectorAll('#reportFinalV432[data-version="4.3.3"]').length,
      generator:document.querySelector('meta[name="generator"]')?.content||'',
      h1:px(getComputedStyle(h1).fontSize),
      h2:px(getComputedStyle(h2).fontSize),
      h3:px(getComputedStyle(h3).fontSize),
      body:px(getComputedStyle(bodyValue).fontSize),
      fieldGridBorder:px(getComputedStyle(fieldGrid).borderTopWidth),
      sectionRadius:section?px(getComputedStyle(section).borderRadius):0,
      sectionShadow:section?getComputedStyle(section).boxShadow:'none',
      pillHeights:pills.map(node=>Math.round(node.getBoundingClientRect().height)),
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      collapsedDisplay:hiddenBody?getComputedStyle(hiddenBody).display:null,
      actions:document.querySelector('.report-actions')?getComputedStyle(document.querySelector('.report-actions')).display:null,
      pageStyle:/@page\s*\{[^}]*size\s*:\s*A4/i.test(document.querySelector('#reportFinalV432')?.textContent||''),
      locationCount:document.querySelectorAll('.report-location').length,
      locationAccordions:document.querySelectorAll('.report-location-accordion-v432').length,
      sectionAccordions:document.querySelectorAll('.report-section-accordion-v432').length,
      nestedAppBlocks:document.querySelectorAll('.report-location-card,.inspection-card-v416,.landlord-card-v416,.economy-v400,.traffic-stage7-v453,.launch-v455').length,
      title:document.title,
    };
  });
  return {reportPage,result};
}

function assertTypographyAndStructure(result){
  expect(result.styleCount).toBe(1);
  expect(result.generator).toContain('premium export 4.3.3');
  expect(result.h1).toBeGreaterThanOrEqual(34);
  expect(result.h1).toBeLessThanOrEqual(40);
  expect(result.h2).toBeGreaterThanOrEqual(24);
  expect(result.h2).toBeLessThanOrEqual(28);
  expect(result.h3).toBeGreaterThanOrEqual(18);
  expect(result.h3).toBeLessThanOrEqual(20);
  expect(result.body).toBeGreaterThanOrEqual(14);
  expect(result.body).toBeLessThanOrEqual(15);
  expect(result.fieldGridBorder).toBe(0);
  expect(result.sectionRadius).toBeLessThanOrEqual(1);
  expect(result.sectionShadow).toBe('none');
  expect(result.nestedAppBlocks).toBe(0);
  expect(result.overflow).toBeLessThanOrEqual(1);
  expect(new Set(result.pillHeights).size).toBeLessThanOrEqual(1);
  expect(result.pillHeights.every(height=>height>=30&&height<=34)).toBe(true);
}

test('v4.3.3 export uses editorial hierarchy, flat data groups and consistent status pills',async({page,context})=>{
  await openApp(page);
  const generated=await generateFixtures(page);
  const single=await inspectReport(context,generated.single,{width:1280,height:1400});
  assertTypographyAndStructure(single.result);
  expect(single.result.locationCount).toBe(1);
  expect(single.result.sectionAccordions).toBeGreaterThanOrEqual(5);
  const full=await inspectReport(context,generated.full,{width:1440,height:1500});
  assertTypographyAndStructure(full.result);
  expect(full.result.locationAccordions).toBeGreaterThan(0);
  expect(full.result.title).toContain('Управленческий');
});

test('v4.3.3 print expands collapsed report content and preserves A4 output rules',async({page,context})=>{
  await openApp(page);
  const generated=await generateFixtures(page);
  const print=await inspectReport(context,generated.full,{width:1440,height:1500,print:true});
  expect(print.result.pageStyle).toBe(true);
  expect(print.result.actions).toBe('none');
  expect(print.result.collapsedDisplay).toBe('block');
  expect(print.result.locationCount).toBeGreaterThan(1);
});

test('creates final premium report review artifacts',async({page,context,browserName})=>{
  await openApp(page);
  const generated=await generateFixtures(page);
  fs.mkdirSync(ARTIFACT_DIR,{recursive:true});
  fs.writeFileSync(path.join(ARTIFACT_DIR,'single-location-premium.html'),generated.single);
  fs.writeFileSync(path.join(ARTIFACT_DIR,'full-report-premium.html'),generated.full);
  fs.writeFileSync(path.join(ARTIFACT_DIR,'full-report-print-preview.html'),generated.full);

  const single=await inspectReport(context,generated.single,{width:1280,height:1400});
  assertTypographyAndStructure(single.result);
  await single.reportPage.screenshot({path:path.join(ARTIFACT_DIR,'single-location-premium.png'),fullPage:true});

  const full=await inspectReport(context,generated.full,{width:1440,height:1600});
  assertTypographyAndStructure(full.result);
  await full.reportPage.screenshot({path:path.join(ARTIFACT_DIR,'full-report-premium.png'),fullPage:true});
  await full.reportPage.emulateMedia({media:'print'});
  const printSmoke=await full.reportPage.evaluate(()=>({
    actions:getComputedStyle(document.querySelector('.report-actions')).display,
    pageStyle:/@page\s*\{[^}]*size\s*:\s*A4/i.test(document.querySelector('#reportFinalV432')?.textContent||''),
    locations:document.querySelectorAll('.report-location').length,
    accordions:document.querySelectorAll('.report-accordion-v432').length,
    collapsedPrinted:getComputedStyle(document.querySelector('.report-accordion-body-v432[hidden]')).display,
    version:document.querySelector('#reportFinalV432')?.dataset.version||'',
    media:'print',
  }));
  expect(printSmoke.actions).toBe('none');
  expect(printSmoke.pageStyle).toBe(true);
  expect(printSmoke.collapsedPrinted).toBe('block');
  expect(printSmoke.version).toBe('4.3.3');
  fs.writeFileSync(path.join(ARTIFACT_DIR,'print-smoke.json'),JSON.stringify(printSmoke,null,2));

  const pdfResultPath=path.join(ARTIFACT_DIR,'pdf-result.json');
  if(browserName==='chromium'){
    try{
      await full.reportPage.pdf({path:path.join(ARTIFACT_DIR,'full-report-print-smoke.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});
      fs.writeFileSync(pdfResultPath,JSON.stringify({ok:true,version:'4.3.3'},null,2));
    }catch(error){
      fs.writeFileSync(pdfResultPath,JSON.stringify({ok:false,error:String(error?.message||error)},null,2));
      throw error;
    }
  }else if(!fs.existsSync(pdfResultPath)){
    fs.writeFileSync(pdfResultPath,JSON.stringify({ok:false,skipped:`PDF generation is not supported for ${browserName}`},null,2));
  }
});
