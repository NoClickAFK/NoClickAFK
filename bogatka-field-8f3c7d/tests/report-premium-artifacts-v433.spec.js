const {test,expect}=require('@playwright/test');
const {fs,path,ARTIFACT_DIR,BEFORE_FIXTURE,openApp,seedFixtures,pageFromHtml}=require('./report-premium-v433.helpers.js');

test('creates exact-head premium report review artifacts',async({page,context,browserName})=>{
  await openApp(page);
  const generated=await seedFixtures(page);
  fs.mkdirSync(ARTIFACT_DIR,{recursive:true});
  fs.writeFileSync(path.join(ARTIFACT_DIR,'single-location-premium.html'),generated.single);
  fs.writeFileSync(path.join(ARTIFACT_DIR,'full-report-premium.html'),generated.full);
  fs.writeFileSync(path.join(ARTIFACT_DIR,'full-report-print-preview.html'),generated.full);

  const single=await pageFromHtml(context,generated.single,{width:1440,height:900});
  const afterViewportBuffer=await single.screenshot({path:path.join(ARTIFACT_DIR,'single-location-first-viewport.png')});
  await single.setViewportSize({width:1440,height:1400});
  await single.screenshot({path:path.join(ARTIFACT_DIR,'single-location-premium.png'),fullPage:true});
  const economy=single.locator('.report-section-accordion-v432').filter({hasText:'Экономическая модель'}).first();
  if(await economy.getAttribute('data-open')!=='true')await economy.locator('.report-accordion-summary-v432').click();
  await economy.screenshot({path:path.join(ARTIFACT_DIR,'single-location-economy.png')});

  const full=await pageFromHtml(context,generated.full,{width:1440,height:1600});
  await full.screenshot({path:path.join(ARTIFACT_DIR,'full-report-premium.png'),fullPage:true});
  await full.setViewportSize({width:1440,height:1000});
  await full.evaluate(()=>window.scrollTo(0,0));
  await full.screenshot({path:path.join(ARTIFACT_DIR,'full-report-first-viewport.png')});
  const firstCard=full.locator('.report-location-dossier-v433').first();
  if(await firstCard.count()){
    const toggle=firstCard.locator('.report-location-summary-v433');
    if(await toggle.getAttribute('aria-expanded')==='true')await toggle.click();
    await firstCard.scrollIntoViewIfNeeded();
    await full.screenshot({path:path.join(ARTIFACT_DIR,'full-report-location-cards.png')});
  }

  const beforeHtml=fs.readFileSync(BEFORE_FIXTURE,'utf8');
  const before=await pageFromHtml(context,beforeHtml,{width:1440,height:900});
  const beforeBuffer=await before.screenshot();
  const sheet=await context.newPage();
  await sheet.setViewportSize({width:2920,height:1040});
  await sheet.setContent(`<!doctype html><style>*{box-sizing:border-box}body{margin:0;background:#20231f;color:white;font:16px Arial;padding:30px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.label{margin:0 0 12px;font-weight:700;letter-spacing:.08em}.frame{overflow:hidden;height:900px;background:white}.frame img{display:block;width:1440px;height:900px;object-fit:cover;object-position:top left}</style><div class="grid"><div><p class="label">BEFORE · PR #87</p><div class="frame"><img src="data:image/png;base64,${beforeBuffer.toString('base64')}"></div></div><div><p class="label">AFTER · FINAL V4.3.3</p><div class="frame"><img src="data:image/png;base64,${afterViewportBuffer.toString('base64')}"></div></div></div>`,{waitUntil:'load'});
  await sheet.screenshot({path:path.join(ARTIFACT_DIR,'before-after-contact-sheet.png')});

  await full.emulateMedia({media:'print'});
  const printSmoke=await full.evaluate(()=>({
    version:document.querySelector('#reportFinalV432')?.dataset.version||'',
    generator:document.querySelector('meta[name="generator"]')?.content||'',
    actions:getComputedStyle(document.querySelector('.report-actions')).display,
    collapsedPrinted:[...document.querySelectorAll('.report-accordion-body-v432[hidden]')].every(node=>getComputedStyle(node).display==='block'),
    chevronsHidden:[...document.querySelectorAll('.report-chevron-v432')].every(node=>getComputedStyle(node).display==='none'),
    horizontalOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    locations:document.querySelectorAll('.report-location-dossier-v433').length,
    media:'print',
  }));
  expect(printSmoke.actions).toBe('none');
  expect(printSmoke.collapsedPrinted).toBe(true);
  expect(printSmoke.chevronsHidden).toBe(true);
  expect(printSmoke.horizontalOverflow).toBeLessThanOrEqual(1);
  fs.writeFileSync(path.join(ARTIFACT_DIR,'print-smoke.json'),JSON.stringify(printSmoke,null,2));
  const resultPath=path.join(ARTIFACT_DIR,'pdf-result.json');
  if(browserName==='chromium'){
    try{
      const pdfPath=path.join(ARTIFACT_DIR,'full-report-print-smoke.pdf');
      await full.pdf({path:pdfPath,format:'A4',printBackground:true,preferCSSPageSize:true});
      fs.writeFileSync(resultPath,JSON.stringify({ok:true,version:'4.3.3',bytes:fs.statSync(pdfPath).size},null,2));
    }catch(error){
      fs.writeFileSync(resultPath,JSON.stringify({ok:false,error:String(error?.message||error)},null,2));
      throw error;
    }
  }else if(!fs.existsSync(resultPath)){
    fs.writeFileSync(resultPath,JSON.stringify({ok:false,skipped:`PDF generation is not supported for ${browserName}`},null,2));
  }
});
