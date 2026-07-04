const fs=require('fs');
const {chromium}=require('@playwright/test');
const OUT='/tmp/bogatka-pr67-review';
const URL='https://noclickafk.github.io/NoClickAFK/bogatka-field-8f3c7d/?v=pr67-18f53d';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
fs.mkdirSync(OUT,{recursive:true});
(async()=>{
  const result={url:URL,attempts:[],desktop:null,mobile:null,pageErrors:[],consoleErrors:[],failedRequests:[],passed:false};
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1600,height:1100}});
  page.on('pageerror',e=>result.pageErrors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push(m.text())});
  page.on('requestfailed',r=>result.failedRequests.push(`${r.url()} :: ${r.failure()?.errorText||'failed'}`));
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  let ready=false;
  for(let attempt=1;attempt<=8;attempt++){
    let response=null;
    try{
      response=await page.goto(`${URL}&diag=${attempt}&t=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:45000});
      try{await page.waitForFunction(()=>Boolean(window.BogatkaCardProgressV448?.ready&&window.BogatkaLocationCardCollapseV422?.ready&&document.querySelector('[data-location-card]')),{timeout:20000})}catch(_){ }
      const state=await page.evaluate(()=>({url:location.href,title:document.title,body:document.body?.innerText?.slice(0,700)||'',card:Boolean(document.querySelector('[data-location-card]')),progressReady:Boolean(window.BogatkaCardProgressV448?.ready),collapseReady:Boolean(window.BogatkaLocationCardCollapseV422?.ready),scripts:[...document.scripts].map(s=>s.src).filter(Boolean).slice(-8)}));
      state.httpStatus=response?.status()??null;
      result.attempts.push(state);
      ready=state.card&&state.progressReady&&state.collapseReady;
      if(ready)break;
    }catch(error){result.attempts.push({error:String(error),httpStatus:response?.status()??null,url:page.url()})}
    await sleep(5000);
  }
  if(ready){
    result.desktop=await page.evaluate(()=>{
      const card=document.querySelector('[data-location-card]');
      const toggle=card.querySelector('.progress-card-toggle-v462');
      const listing=[...card.querySelectorAll('[data-field="listingUrl"]')].find(n=>!n.hasAttribute('data-stage6-marker-v461'));
      const style=listing?getComputedStyle(listing):null;
      return {largeRecommendation:document.querySelectorAll('.card-recommendation-v448').length,oldRecommendation:document.body.innerText.includes('Текущая рекомендация'),statusInActions:Boolean(card.querySelector('.location-actions [data-card-recommendation-v448]')),statusInSide:Boolean(card.querySelector('.location-head-side-v422 [data-card-recommendation-v448]')),progressStatus:toggle?.querySelectorAll('[data-progress-card-summary-v462],.recommendation-status-v448').length??-1,metricCount:card.querySelectorAll('.progress-metrics-v448>article').length,qualityCopy:card.querySelector('[data-progress-quality-meta-v448]')?.textContent.trim()||'',coverageCopy:card.querySelector('[data-progress-coverage-meta-v448]')?.textContent.trim()||'',explanationHeading:card.querySelector('.score-explanation-v448 strong')?.textContent.trim()||'',explanationText:card.querySelector('.score-explanation-v448 span')?.textContent.trim()||'',oldFormula:document.body.innerText.includes('1 балл = 0'),listingFound:Boolean(listing),listingPaddingLeft:style?.paddingLeft||'',listingPaddingRight:style?.paddingRight||'',overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
    });
    const first=page.locator('[data-location-card]').first();
    await first.evaluate(card=>window.BogatkaLocationCardCollapseV422.setCollapsed(card,false,{persist:false}));
    const progress=first.locator('.progress-card-toggle-v462');
    if(await progress.getAttribute('aria-expanded')!=='true')await progress.click();
    await first.screenshot({path:`${OUT}/01-production-desktop.png`});
    await page.setViewportSize({width:390,height:1000});
    await page.reload({waitUntil:'domcontentloaded'});
    try{await page.waitForFunction(()=>Boolean(window.BogatkaCardProgressV448?.ready&&window.BogatkaLocationCardCollapseV422?.ready&&document.querySelector('.location-actions [data-card-recommendation-v448]')),{timeout:30000})}catch(_){ }
    const card=page.locator('[data-location-card]').first();
    if(await card.count()){
      await card.evaluate(n=>window.BogatkaLocationCardCollapseV422.setCollapsed(n,true,{persist:false}));
      await page.waitForTimeout(300);
      result.mobile=await card.evaluate(n=>{const h=n.querySelector(':scope > .location-head'),a=h.querySelector('.location-actions'),b=a.querySelector('.location-action-buttons-v448'),s=a.querySelector('[data-card-recommendation-v448]'),side=h.querySelector('.location-head-side-v422'),arrow=side.querySelector('.location-collapse-toggle-v422'),ar=a.getBoundingClientRect(),sr=s.getBoundingClientRect(),rr=arrow.getBoundingClientRect(),br=[...b.children].map(x=>x.getBoundingClientRect()),hit=(x,y)=>!(x.right<=y.left||x.left>=y.right||x.bottom<=y.top||x.top>=y.bottom);return{statusInActions:s.closest('.location-actions')===a,statusInSide:side.contains(s),overlapsButtons:br.some(x=>hit(x,sr)),overlapsArrow:hit(rr,sr),inside:sr.left>=ar.left-1&&sr.right<=ar.right+1,headOverflow:h.scrollWidth-h.clientWidth,actionOverflow:a.scrollWidth-a.clientWidth,documentOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,arrowAbove:rr.top<sr.top}});
      await card.locator(':scope > .location-head').screenshot({path:`${OUT}/02-production-mobile-header.png`});
    }
    const d=result.desktop,m=result.mobile;
    result.passed=Boolean(d&&m&&d.largeRecommendation===0&&!d.oldRecommendation&&d.statusInActions&&!d.statusInSide&&d.progressStatus===0&&d.metricCount===4&&d.explanationHeading==='Что означают показатели'&&!d.oldFormula&&d.listingFound&&d.listingPaddingLeft==='10px'&&d.listingPaddingRight==='10px'&&d.overflow<=1&&m.statusInActions&&!m.statusInSide&&!m.overlapsButtons&&!m.overlapsArrow&&m.inside&&m.headOverflow<=1&&m.actionOverflow<=1&&m.documentOverflow<=1&&m.arrowAbove);
  }
  fs.writeFileSync(`${OUT}/production-diagnostic.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
  await browser.close();
})().catch(error=>{fs.writeFileSync(`${OUT}/production-diagnostic-error.txt`,String(error?.stack||error));console.error(error)});