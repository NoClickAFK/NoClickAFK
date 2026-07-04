const fs=require('fs');
const {chromium}=require('@playwright/test');
const URL='https://noclickafk.github.io/NoClickAFK/bogatka-field-8f3c7d/?v=pr67-18f53d';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
fs.mkdirSync('/tmp/pr67-production',{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1600,height:1100}});
  const pageErrors=[],consoleErrors=[],failedRequests=[];
  page.on('pageerror',error=>pageErrors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
  page.on('requestfailed',request=>failedRequests.push(`${request.url()} :: ${request.failure()?.errorText||'failed'}`));
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  let deployed=false,lastReason='';
  for(let attempt=1;attempt<=20;attempt++){
    try{
      await page.goto(`${URL}&attempt=${attempt}&t=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:45000});
      await page.waitForFunction(()=>Boolean(window.BogatkaCardProgressV448?.ready&&window.BogatkaLocationCardCollapseV422?.ready&&document.querySelector('[data-location-card]')),{timeout:30000});
      const state=await page.evaluate(()=>({
        explanation:document.querySelector('.score-explanation-v448 strong')?.textContent.trim()||'',
        actionStatus:Boolean(document.querySelector('.location-actions [data-card-recommendation-v448]')),
        oldFormula:document.body.innerText.includes('1 балл = 0'),
        oldRecommendation:document.body.innerText.includes('Текущая рекомендация')
      }));
      if(state.explanation==='Что означают показатели'&&state.actionStatus&&!state.oldFormula&&!state.oldRecommendation){deployed=true;break}
      lastReason=JSON.stringify(state);
    }catch(error){lastReason=String(error)}
    await delay(10000);
  }
  if(!deployed)throw new Error(`deployment timeout: ${lastReason}`);
  const desktop=await page.evaluate(()=>{
    const card=document.querySelector('[data-location-card]');
    const toggle=card.querySelector('.progress-card-toggle-v462');
    const listing=[...card.querySelectorAll('[data-field="listingUrl"]')].find(node=>!node.hasAttribute('data-stage6-marker-v461'));
    const listingStyle=listing?getComputedStyle(listing):null;
    return {
      largeRecommendation:document.querySelectorAll('.card-recommendation-v448').length,
      oldRecommendation:document.body.innerText.includes('Текущая рекомендация'),
      statusInActions:Boolean(card.querySelector('.location-actions [data-card-recommendation-v448]')),
      statusInSide:Boolean(card.querySelector('.location-head-side-v422 [data-card-recommendation-v448]')),
      progressStatus:toggle?.querySelectorAll('[data-progress-card-summary-v462],.recommendation-status-v448').length??-1,
      metricCount:card.querySelectorAll('.progress-metrics-v448>article').length,
      qualityCopy:card.querySelector('[data-progress-quality-meta-v448]')?.textContent.trim()||'',
      coverageCopy:card.querySelector('[data-progress-coverage-meta-v448]')?.textContent.trim()||'',
      explanationHeading:card.querySelector('.score-explanation-v448 strong')?.textContent.trim()||'',
      explanationText:card.querySelector('.score-explanation-v448 span')?.textContent.trim()||'',
      oldFormula:document.body.innerText.includes('1 балл = 0'),
      listingUrlFound:Boolean(listing),
      listingPaddingLeft:listingStyle?.paddingLeft||'',
      listingPaddingRight:listingStyle?.paddingRight||'',
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
    };
  });
  if(desktop.largeRecommendation||desktop.oldRecommendation||!desktop.statusInActions||desktop.statusInSide||desktop.progressStatus!==0||desktop.metricCount!==4||!desktop.coverageCopy.startsWith('Оценено ')||desktop.explanationHeading!=='Что означают показатели'||!desktop.explanationText.includes('Качество показывает средний результат')||desktop.oldFormula||!desktop.listingUrlFound||desktop.listingPaddingLeft!=='10px'||desktop.listingPaddingRight!=='10px'||desktop.overflow>1)throw new Error(`desktop failed ${JSON.stringify(desktop)}`);
  const first=page.locator('[data-location-card]').first();
  await first.evaluate(card=>window.BogatkaLocationCardCollapseV422.setCollapsed(card,false,{persist:false}));
  const progress=first.locator('.progress-card-toggle-v462');
  if(await progress.getAttribute('aria-expanded')!=='true')await progress.click();
  await first.screenshot({path:'/tmp/pr67-production/desktop.png'});
  await page.setViewportSize({width:390,height:1000});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Boolean(window.BogatkaCardProgressV448?.ready&&window.BogatkaLocationCardCollapseV422?.ready&&document.querySelector('.location-actions [data-card-recommendation-v448]')),{timeout:30000});
  const card=page.locator('[data-location-card]').first();
  await card.evaluate(node=>window.BogatkaLocationCardCollapseV422.setCollapsed(node,true,{persist:false}));
  await page.waitForTimeout(300);
  const mobile=await card.evaluate(node=>{
    const head=node.querySelector(':scope > .location-head');
    const actions=head.querySelector('.location-actions');
    const buttons=actions.querySelector('.location-action-buttons-v448');
    const status=actions.querySelector('[data-card-recommendation-v448]');
    const side=head.querySelector('.location-head-side-v422');
    const arrow=side.querySelector('.location-collapse-toggle-v422');
    const actionRect=actions.getBoundingClientRect(),statusRect=status.getBoundingClientRect(),arrowRect=arrow.getBoundingClientRect();
    const buttonRects=[...buttons.children].map(child=>child.getBoundingClientRect());
    const intersects=(a,b)=>!(a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom);
    return {
      statusInActions:status.closest('.location-actions')===actions,
      statusInSide:side.contains(status),
      overlapsButtons:buttonRects.some(rect=>intersects(rect,statusRect)),
      overlapsArrow:intersects(arrowRect,statusRect),
      inside:statusRect.left>=actionRect.left-1&&statusRect.right<=actionRect.right+1,
      statusWidth:statusRect.width,
      statusHeight:statusRect.height,
      headOverflow:head.scrollWidth-head.clientWidth,
      actionOverflow:actions.scrollWidth-actions.clientWidth,
      documentOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      arrowAbove:arrowRect.top<statusRect.top
    };
  });
  if(!mobile.statusInActions||mobile.statusInSide||mobile.overlapsButtons||mobile.overlapsArrow||!mobile.inside||mobile.headOverflow>1||mobile.actionOverflow>1||mobile.documentOverflow>1||!mobile.arrowAbove)throw new Error(`mobile failed ${JSON.stringify(mobile)}`);
  await card.locator(':scope > .location-head').screenshot({path:'/tmp/pr67-production/mobile-production-header.png'});
  const meaningfulConsole=consoleErrors.filter(text=>!text.includes('favicon'));
  const meaningfulFailed=failedRequests.filter(text=>!text.includes('favicon'));
  if(pageErrors.length||meaningfulConsole.length||meaningfulFailed.length)throw new Error(`runtime errors ${JSON.stringify({pageErrors,meaningfulConsole,meaningfulFailed})}`);
  const result={verifiedAt:new Date().toISOString(),url:URL,mainSha:'18f53d08141c903e8a4c204632d24384ba13f222',desktop,mobile,pageErrors,consoleErrors:meaningfulConsole,failedRequests:meaningfulFailed};
  fs.writeFileSync('/tmp/pr67-production/verification.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});