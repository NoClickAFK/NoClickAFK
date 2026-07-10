const {test,expect}=require('@playwright/test');
const {openApp,seedFixtures,pageFromHtml}=require('./report-premium-v433.helpers.js');

test('malicious title and address remain literal text and cannot execute',async({page,context})=>{
  await openApp(page);
  const generated=await page.evaluate(async()=>{
    const selected=locations.find(item=>!item.archivedAt);
    selected.title='Test <img src=x onerror="window.__bogatkaXss=1">';
    selected.address='Address <svg onload="window.__bogatkaXss=2"></svg>';
    const data=await getLocationData(selected.id);
    data.decision='Оставить';
    data.decisionReason='Безопасный текст';
    await idbPut(STORE,data,`location:${selected.id}`);
    if(typeof saveLocations==='function')await saveLocations();
    if(typeof updateSummary==='function')await updateSummary();
    return window.buildLocationReportHtml(selected.id);
  });
  const report=await pageFromHtml(context,generated,{width:1280,height:900});
  const state=await report.evaluate(()=>({
    injectedImage:Boolean(document.querySelector('img[src="x"]')),
    injectedSvg:Boolean(document.querySelector('.report-hero-v433 svg')),
    xss:window.__bogatkaXss,
    title:document.querySelector('.report-display-v433')?.textContent||'',
    address:document.querySelector('.report-address-v433')?.textContent||'',
  }));
  expect(state.injectedImage).toBe(false);
  expect(state.injectedSvg).toBe(false);
  expect(state.xss).toBeUndefined();
  expect(state.title).toContain('<img src=x onerror="window.__bogatkaXss=1">');
  expect(state.address).toContain('<svg onload="window.__bogatkaXss=2"></svg>');
  const toggle=report.locator('.report-section-accordion-v432 .report-accordion-summary-v432').first();
  const before=await toggle.getAttribute('aria-expanded');
  await toggle.click();
  expect(await toggle.getAttribute('aria-expanded')).not.toBe(before);
  expect(await report.evaluate(()=>window.__bogatkaXss)).toBeUndefined();
});

test('user version-like text is preserved while generator metadata remains 4.3.3',async({page,context})=>{
  await openApp(page);
  const text='Contract specification 4.3.2 remains valid; protocol 4.3.1 remains archived.';
  const html=await page.evaluate(async text=>{
    const selected=locations.find(item=>!item.archivedAt);
    const data=await getLocationData(selected.id);
    data.decision='Оставить';
    data.decisionReason=text;
    await idbPut(STORE,data,`location:${selected.id}`);
    if(typeof updateSummary==='function')await updateSummary();
    return window.buildLocationReportHtml(selected.id);
  },text);
  const report=await pageFromHtml(context,html);
  const result=await report.evaluate(()=>({body:document.body.textContent,generator:document.querySelector('meta[name="generator"]')?.content,version:document.querySelector('.report-version-v433')?.textContent}));
  expect(result.body).toContain(text);
  expect(result.body).toContain('4.3.2');
  expect(result.body).toContain('4.3.1');
  expect(result.generator).toBe('Bogatka premium export 4.3.3');
  expect(result.version).toBe('4.3.3');
});

test('mobile and print layouts are unclipped and print expands all report content',async({page,context})=>{
  await openApp(page);
  const generated=await seedFixtures(page);
  const mobile=await pageFromHtml(context,generated.single,{width:390,height:900});
  const mobileState=await mobile.evaluate(()=>({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,titleSize:Number.parseFloat(getComputedStyle(document.querySelector('.report-display-v433')).fontSize),pills:[...document.querySelectorAll('.report-status')].filter(node=>node.getClientRects().length).map(node=>{const rect=node.getBoundingClientRect();return{left:rect.left,right:rect.right}})}));
  expect(mobileState.overflow).toBeLessThanOrEqual(1);
  expect(mobileState.titleSize).toBeGreaterThanOrEqual(36);
  expect(mobileState.pills.every(rect=>rect.right<=390&&rect.left>=0)).toBe(true);
  const printed=await pageFromHtml(context,generated.full,{width:1440,height:1000,print:true});
  const printState=await printed.evaluate(()=>({collapsed:[...document.querySelectorAll('.report-accordion-body-v432[hidden]')].map(node=>getComputedStyle(node).display),chevrons:[...document.querySelectorAll('.report-chevron-v432')].map(node=>getComputedStyle(node).display),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,wholeLocationAvoid:getComputedStyle(document.querySelector('.report-location-dossier-v433')).breakInside,pageStyle:/@page\s*\{[^}]*size\s*:\s*A4/i.test(document.querySelector('#reportFinalV432')?.textContent||'')}));
  expect(printState.collapsed.every(value=>value==='block')).toBe(true);
  expect(printState.chevrons.every(value=>value==='none')).toBe(true);
  expect(printState.overflow).toBeLessThanOrEqual(1);
  expect(printState.wholeLocationAvoid).not.toMatch(/avoid/);
  expect(printState.pageStyle).toBe(true);
});
