const {test,expect}=require('@playwright/test');

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=429';

async function openApp(page){
  await page.route('**/functions/v1/bogatka-version',route=>route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({version:'4.2.8',versionToken:'429',sourceCommit:'report429abcdef',ahead:1}),
  }));
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaLiveReport?.build?.__reportStabilityV429&&
    window.buildReportHtml===window.BogatkaLiveReport.build&&
    document.getElementById('locationComparisonPanel')&&
    document.querySelector('[data-location-card]')
  ),{timeout:20000});
}

test('v429 remains authoritative while delayed legacy callbacks finish',async({page})=>{
  await openApp(page);
  const state=await page.evaluate(async()=>{
    const samples=[];
    const started=performance.now();
    while(performance.now()-started<5300){
      samples.push(Boolean(
        window.BogatkaLiveReport?.build?.__reportStabilityV429&&
        window.buildReportHtml===window.BogatkaLiveReport.build&&
        window.exportHtmlReport===window.BogatkaLiveReport.build.__htmlAction&&
        window.openPdfReport===window.BogatkaLiveReport.build.__pdfAction
      ));
      await new Promise(resolve=>setTimeout(resolve,25));
    }
    return {samples,finalMarker:Boolean(window.BogatkaLiveReport?.build?.__reportStabilityV429)};
  });
  expect(state.samples.length).toBeGreaterThan(100);
  expect(state.samples.every(Boolean)).toBe(true);
  expect(state.finalMarker).toBe(true);
});

test('comparison summary stays visible and visually collapsed during report snapshots',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async()=>{
    const panel=document.getElementById('locationComparisonPanel');
    panel.open=false;
    panel.removeAttribute('open');
    const initialHeight=panel.getBoundingClientRect().height;
    const samples=[];
    const timer=setInterval(()=>samples.push({
      visibility:getComputedStyle(panel).visibility,
      height:panel.getBoundingClientRect().height,
      display:getComputedStyle(panel).display,
    }),10);
    await window.BogatkaLiveReport.build();
    clearInterval(timer);
    return {
      samples,
      initialHeight,
      finalHeight:panel.getBoundingClientRect().height,
      finalOpen:panel.open,
      finalVisibility:getComputedStyle(panel).visibility,
      snapshotClassLeft:panel.classList.contains('comparison-report-snapshot-v429')||panel.classList.contains('comparison-report-snapshot-closed-v429'),
    };
  });

  expect(result.samples.length).toBeGreaterThan(5);
  expect(result.samples.every(sample=>sample.visibility==='visible')).toBe(true);
  expect(result.samples.every(sample=>sample.display!=='none')).toBe(true);
  expect(Math.max(...result.samples.map(sample=>Math.abs(sample.height-result.initialHeight)))).toBeLessThanOrEqual(2);
  expect(result.finalOpen).toBe(false);
  expect(result.finalVisibility).toBe('visible');
  expect(Math.abs(result.finalHeight-result.initialHeight)).toBeLessThanOrEqual(2);
  expect(result.snapshotClassLeft).toBe(false);
});

test('report header keeps compact equal metrics to the right of the address',async({page,context})=>{
  await openApp(page);
  const html=await page.evaluate(()=>window.BogatkaLiveReport.build());
  const reportPage=await context.newPage();
  await reportPage.setViewportSize({width:1000,height:900});
  await reportPage.setContent(html,{waitUntil:'load'});

  const layout=await reportPage.evaluate(()=>{
    const head=document.querySelector('.report-location-card .location-head');
    const title=document.querySelector('.report-location-card .location-title-wrap');
    const metrics=document.querySelector('.report-head-metrics-v428');
    const cards=metrics?[...metrics.querySelectorAll('.report-head-metric-v428')]:[];
    const status=metrics?.querySelector('.report-head-status-v428');
    const computed=head?getComputedStyle(head):null;
    const rect=element=>element?.getBoundingClientRect();
    return {
      columns:computed?.gridTemplateColumns||'',
      paddingRight:computed?parseFloat(computed.paddingRight):0,
      head:rect(head),
      title:rect(title),
      metrics:rect(metrics),
      cards:cards.map(rect),
      status:rect(status),
    };
  });

  expect(layout.metrics).toBeTruthy();
  expect(layout.cards).toHaveLength(3);
  expect(layout.columns.split(' ').length).toBe(2);
  expect(Math.abs(layout.metrics.y-layout.title.y)).toBeLessThanOrEqual(2);
  expect(layout.metrics.x).toBeGreaterThan(layout.title.x);
  expect(layout.metrics.width).toBeGreaterThanOrEqual(300);
  expect(layout.metrics.width).toBeLessThanOrEqual(318);
  expect(Math.abs((layout.head.right-layout.metrics.right)-layout.paddingRight)).toBeLessThanOrEqual(2);
  expect(Math.max(...layout.cards.map(card=>card.width))-Math.min(...layout.cards.map(card=>card.width))).toBeLessThanOrEqual(1);
  expect(Math.abs(layout.status.width-layout.metrics.width)).toBeLessThanOrEqual(1);
  expect(layout.cards.every(card=>card.height<70)).toBe(true);
});
