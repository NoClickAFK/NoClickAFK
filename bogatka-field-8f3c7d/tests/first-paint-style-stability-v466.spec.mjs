import {test,expect,webkit,chromium} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=first-paint-status-reason-v466';
const STYLES=[
  'style.css','v21.css','v22.css','v23.css','cloud.css','premium-v30.css','auth-v31.css','members-v32.css','stability-v33.css','inspection-layout-v461.css',
  'polish-v34.css','insights-v331.css','compare-v332.css','decision-v340.css','critical-deal-v430.css','compare-v340.css','suite-v400.css','visual-v411.css',
  'decision-panel-v412.css','workflow-v414.css','workflow-fixes-v415.css','workflow-refine-v440.css','location-profile-v416.css','location-overview-v417.css',
  'location-panels-v419.css','location-card-collapse-v422.css','status-next-task-v447.css','card-progress-v448.css','quick-checklist-v451.css','location-data-v452.css',
];
const DARK='rgb(28, 41, 51)';
test.setTimeout(120000);

async function installProbe(page){
  await page.addInitScript(({styles})=>{
    localStorage.setItem('bogatka_access_authorized_v1','1');
    const active=new Set(styles);
    const probe={domReady:false,visibleAt:null,lastAt:0,done:false,links:[],samples:[]};
    const visible=()=>{
      const app=document.getElementById('app');
      if(!app||app.classList.contains('hidden'))return false;
      const cs=getComputedStyle(app),r=app.getBoundingClientRect();
      return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0;
    };
    const name=href=>{try{return new URL(href,location.href).pathname.split('/').pop()}catch{return String(href||'').split('/').pop()}};
    const record=node=>{
      if(!(node instanceof HTMLLinkElement)||node.rel!=='stylesheet')return;
      const file=name(node.href);
      probe.links.push({file,active:active.has(file),afterDom:probe.domReady,afterVisible:visible()});
    };
    new MutationObserver(records=>records.forEach(recordSet=>recordSet.addedNodes.forEach(node=>{
      if(node instanceof HTMLLinkElement)record(node);
      if(node instanceof Element)node.querySelectorAll?.('link[rel="stylesheet"]').forEach(record);
    }))).observe(document,{subtree:true,childList:true});
    document.addEventListener('DOMContentLoaded',()=>{probe.domReady=true},{once:true});
    const snap=(node,pseudo=null)=>{
      if(!node)return null;
      const cs=getComputedStyle(node,pseudo),r=pseudo?null:node.getBoundingClientRect();
      return{
        backgroundColor:cs.backgroundColor,backgroundImage:cs.backgroundImage,color:cs.color,
        borderColor:cs.borderColor,borderWidth:cs.borderWidth,borderRadius:cs.borderRadius,
        minHeight:cs.minHeight,paddingTop:cs.paddingTop,paddingRight:cs.paddingRight,paddingBottom:cs.paddingBottom,paddingLeft:cs.paddingLeft,
        fontFamily:cs.fontFamily,fontSize:cs.fontSize,fontWeight:cs.fontWeight,lineHeight:cs.lineHeight,
        transform:cs.transform,transition:cs.transition,width:cs.width,height:cs.height,
        rectWidth:r?.width??null,rectHeight:r?.height??null,
      };
    };
    const sample=now=>{
      if(!visible())return requestAnimationFrame(sample);
      if(probe.visibleAt===null)probe.visibleAt=now;
      const elapsed=now-probe.visibleAt;
      if(elapsed<=3000||now-probe.lastAt>=240){
        probe.lastAt=now;
        const panel=document.getElementById('locationComparisonPanel');
        const summary=panel?.querySelector(':scope > summary');
        const arrow=panel?.querySelector('.comparison-chevron-v332');
        const badges=[...document.querySelectorAll('[data-card-recommendation-v448]')].map((node,index)=>({
          key:`${node.closest('[data-location-card]')?.dataset.locationCard||index}|${node.className}|${node.textContent.trim()}`,
          style:snap(node),
        }));
        const reason=document.querySelector('[data-decision-reason-status-v412]');
        probe.samples.push({
          elapsed,
          comparison:panel?{panel:snap(panel),summary:snap(summary),wrapper:snap(arrow),pseudo:snap(arrow,'::before')}:null,
          badges,
          reason:reason?{key:`${reason.dataset.state||''}|${reason.textContent.trim()}`,style:snap(reason)}:null,
        });
      }
      if(elapsed<15000)requestAnimationFrame(sample);else probe.done=true;
    };
    window.__firstPaintV466=probe;
    requestAnimationFrame(sample);
  },{styles:STYLES});
}

async function boot(page,viewport={width:1440,height:1000},probe=true){
  await page.setViewportSize(viewport);
  if(probe)await installProbe(page);else await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaCardProgressV448?.initialized&&window.BogatkaDecisionPanel?.ready&&
    document.querySelector('#locationComparisonPanel .comparison-chevron-v332')&&document.querySelectorAll('[data-card-recommendation-v448]').length>1
  ),{timeout:30000});
}

function styleVariants(samples,field){
  const map=new Map();
  for(const sample of samples){
    const entries=field==='badges'?sample.badges:(sample[field]?[sample[field]]:[]);
    for(const entry of entries){
      const style={...entry.style};delete style.transition;
      const set=map.get(entry.key)||new Set();set.add(JSON.stringify(style));map.set(entry.key,set);
    }
  }
  return [...map.values()].map(set=>set.size);
}

async function firstPaintResult(page){
  await page.waitForFunction(()=>window.__firstPaintV466?.done===true,{timeout:25000});
  return page.evaluate(styles=>({
    manifest:[...document.head.querySelectorAll('link[rel="stylesheet"]')]
      .map(link=>new URL(link.href,location.href).pathname.split('/').pop()).filter(name=>styles.includes(name)),
    probe:window.__firstPaintV466,
  }),STYLES);
}

function assertFirstPaint(result){
  expect(result.manifest).toEqual(STYLES);
  expect(new Set(result.manifest).size).toBe(STYLES.length);
  expect(result.probe.links.filter(item=>item.active&&(item.afterDom||item.afterVisible))).toEqual([]);
  const rows=result.probe.samples.filter(sample=>sample.comparison);
  expect(rows.length).toBeGreaterThan(10);
  const first=rows[0].comparison,final=rows.at(-1).comparison;
  expect(first.panel.backgroundColor).toBe('rgb(255, 250, 240)');
  expect(first.panel.borderColor).toBe('rgb(216, 184, 96)');
  expect(first.panel.borderWidth).toBe('2px');
  expect(first.panel.borderRadius).toBe('18px');
  expect(first.summary.backgroundImage).toBe(final.summary.backgroundImage);
  expect(rows.every(row=>row.comparison.panel.backgroundColor===first.panel.backgroundColor)).toBe(true);
  expect(rows.every(row=>row.comparison.panel.borderColor===first.panel.borderColor)).toBe(true);
  expect(rows.every(row=>row.comparison.wrapper.transform==='none')).toBe(true);
  expect(rows.every(row=>row.comparison.wrapper.width==='34px'&&row.comparison.wrapper.height==='34px')).toBe(true);
  expect(rows.every(row=>row.comparison.pseudo.width==='11px'&&row.comparison.pseudo.height==='11px')).toBe(true);
  expect(new Set(rows.map(row=>row.comparison.pseudo.transform)).size).toBe(1);
  expect(first.pseudo.transition.includes('0s')).toBe(true);
  expect(styleVariants(result.probe.samples,'badges').every(count=>count===1)).toBe(true);
  expect(styleVariants(result.probe.samples,'reason').every(count=>count===1)).toBe(true);
  for(const sample of result.probe.samples)for(const badge of sample.badges){
    expect(badge.style.color).toBe(DARK);
    expect(badge.style.fontSize).toBe('11px');
    expect(badge.style.fontWeight).toBe('800');
    expect(badge.style.borderRadius).toBe('999px');
    expect(badge.style.minHeight).toBe('28px');
  }
}

async function compareInteraction(page){
  const panel=page.locator('#locationComparisonPanel'),summary=panel.locator(':scope > summary');
  const before=await panel.evaluate(node=>{
    const arrow=node.querySelector('.comparison-chevron-v332');
    return{background:getComputedStyle(node).backgroundColor,wrapper:getComputedStyle(arrow).transform,pseudo:getComputedStyle(arrow,'::before').transform};
  });
  await summary.click();
  await expect(summary).toHaveAttribute('aria-expanded','true');
  await expect(panel).toHaveClass(/comparison-interaction-ready-v430/);
  const open=await panel.evaluate(node=>{
    const arrow=node.querySelector('.comparison-chevron-v332');
    return{background:getComputedStyle(node).backgroundColor,wrapper:getComputedStyle(arrow).transform,pseudo:getComputedStyle(arrow,'::before').transform,rows:node.querySelectorAll('tbody tr').length};
  });
  expect(open.background).toBe(before.background);expect(open.wrapper).toBe('none');expect(open.pseudo).not.toBe(before.pseudo);expect(open.rows).toBeGreaterThan(0);
  const rank=panel.locator('[data-compare-sort="rank"]'),rankBefore=await rank.textContent();
  await rank.click();await expect(rank).not.toHaveText(rankBefore);
  const address=panel.locator('[data-compare-location]').first(),id=await address.getAttribute('data-compare-location');
  await address.click();await expect(page.locator(`[data-location-card="${id}"]`)).toHaveClass(/compare-highlight-v332/);
  await summary.click();await expect(summary).toHaveAttribute('aria-expanded','false');
  const close=await panel.evaluate(node=>{const arrow=node.querySelector('.comparison-chevron-v332');return{background:getComputedStyle(node).backgroundColor,wrapper:getComputedStyle(arrow).transform,pseudo:getComputedStyle(arrow,'::before').transform}});
  expect(close).toEqual(before);
}

test('Chromium first paint uses the final static cascade for 15 seconds',async({page})=>{
  await boot(page);assertFirstPaint(await firstPaintResult(page));await compareInteraction(page);
});

test('WebKit first paint uses the final static cascade for 15 seconds',async()=>{
  const browser=await webkit.launch();
  try{const page=await browser.newPage({viewport:{width:1440,height:1000}});await boot(page);assertFirstPaint(await firstPaintResult(page));await compareInteraction(page)}finally{await browser.close()}
});

async function visualCheck(page,testInfo,label){
  await page.evaluate(()=>window.BogatkaLocationCardCollapseV422.setCollapsed(document.querySelector('[data-location-card]'),false,{persist:false}));
  const card=page.locator('[data-location-card]').first(),reason=card.locator('.decision-reason-section-v412'),toggle=reason.locator(':scope > summary');
  if(await toggle.getAttribute('aria-expanded')==='true')await toggle.click();

  const pills=await card.evaluate(node=>['.critical-summary-badge-v430','.economy-status-v400','.launch-progress-label-v400','.decision-reason-status-v412','[data-card-recommendation-v448]'].map(selector=>{
    const element=node.querySelector(selector);if(!element)return{selector,missing:true};
    const cs=getComputedStyle(element),r=element.getBoundingClientRect();
    return{selector,fontFamily:cs.fontFamily,fontSize:cs.fontSize,fontWeight:cs.fontWeight,lineHeight:cs.lineHeight,radius:cs.borderRadius,paddingTop:cs.paddingTop,paddingBottom:cs.paddingBottom,color:cs.color,height:r.height};
  }));
  expect(pills.every(item=>!item.missing),`${label}: semantic pills`).toBe(true);
  for(const item of pills){
    expect(item.fontFamily).toBe(pills[0].fontFamily);expect(item.fontSize).toBe(pills[0].fontSize);expect(item.fontWeight).toBe(pills[0].fontWeight);
    expect(item.lineHeight).toBe(pills[0].lineHeight);expect(item.radius).toBe(pills[0].radius);expect(item.paddingTop).toBe(pills[0].paddingTop);
    expect(item.paddingBottom).toBe(pills[0].paddingBottom);expect(item.color).toBe(DARK);expect(Math.abs(item.height-pills[0].height)).toBeLessThanOrEqual(2);
  }

  const closed=await card.evaluate(node=>{
    const type=element=>{const cs=getComputedStyle(element);return{fontFamily:cs.fontFamily,fontSize:cs.fontSize,fontWeight:cs.fontWeight,lineHeight:cs.lineHeight,letterSpacing:cs.letterSpacing,fontKerning:cs.fontKerning,textRendering:cs.textRendering}};
    const progress=node.querySelector('.progress-card-toggle-v462'),reason=node.querySelector('.decision-reason-section-v412'),summary=reason.querySelector(':scope > summary');
    return{
      progressTitle:type(progress.querySelector('.progress-card-toggle-copy-v462 strong')),reasonTitle:type(reason.querySelector('.decision-reason-title-v412')),
      progressDescription:type(progress.querySelector('.progress-card-toggle-copy-v462 span')),reasonDescription:type(reason.querySelector('.decision-reason-description-v412')),
      nested:reason.querySelectorAll('.decision-reason-section-v412,.decision-reason-v452 label').length,height:summary.getBoundingClientRect().height,
    };
  });
  expect(closed.reasonTitle).toEqual(closed.progressTitle);expect(closed.reasonDescription).toEqual(closed.progressDescription);expect(closed.nested).toBe(0);

  await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','true');
  const opened=await reason.evaluate(node=>{
    const summary=node.querySelector(':scope > summary'),body=node.querySelector(':scope > .decision-reason-body-v412'),button=node.querySelector('[data-decision-reason-save-v412]');
    const outer=getComputedStyle(node),ss=getComputedStyle(summary),bs=getComputedStyle(body),btn=getComputedStyle(button),r=node.getBoundingClientRect();
    const left=document.elementFromPoint(r.left+1,r.bottom-1),right=document.elementFromPoint(r.right-1,r.bottom-1),center=document.elementFromPoint(r.left+r.width/2,r.bottom-2);
    return{
      overflow:outer.overflow,radius:outer.borderBottomLeftRadius,border:outer.borderBottomWidth,
      summaryLeft:ss.borderBottomLeftRadius,summaryRight:ss.borderBottomRightRadius,divider:ss.borderBottomWidth,
      bodyLeft:bs.borderBottomLeftRadius,bodyRight:bs.borderBottomRightRadius,bodyBorder:bs.borderBottomWidth,
      leftClipped:!node.contains(left),rightClipped:!node.contains(right),centerInside:node.contains(center),height:summary.getBoundingClientRect().height,
      button:{classes:button.className,height:button.getBoundingClientRect().height,padding:[btn.paddingTop,btn.paddingRight,btn.paddingBottom,btn.paddingLeft],fontSize:btn.fontSize,fontWeight:btn.fontWeight,radius:btn.borderRadius},
    };
  });
  expect(['clip','hidden']).toContain(opened.overflow);expect(opened.radius).toBe('17px');expect(opened.border).toBe('1px');
  expect(opened.summaryLeft).toBe('0px');expect(opened.summaryRight).toBe('0px');expect(opened.divider).toBe('1px');
  expect(opened.bodyLeft).toBe('16px');expect(opened.bodyRight).toBe('16px');expect(opened.bodyBorder).toBe('0px');
  expect(opened.leftClipped).toBe(true);expect(opened.rightClipped).toBe(true);expect(opened.centerInside).toBe(true);expect(Math.abs(opened.height-closed.height)).toBeLessThanOrEqual(1);
  expect(opened.button.classes).toContain('small');expect(opened.button.classes).toContain('decision-reason-save-v412');
  expect(opened.button.height).toBeGreaterThanOrEqual(32);expect(opened.button.height).toBeLessThanOrEqual(34);expect(opened.button.padding).toEqual(['7px','10px','7px','10px']);expect(opened.button.fontSize).toBe('12px');
  const shot=await reason.screenshot({animations:'disabled'});expect(shot.byteLength).toBeGreaterThan(1000);await testInfo.attach(`${label}-reason-open`,{body:shot,contentType:'image/png'});
}

test('semantic pills and reason shell are canonical in Chromium and WebKit desktop/mobile',async({},testInfo)=>{
  for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
    const browser=await type.launch();
    try{
      for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:900}]){
        const context=await browser.newContext({viewport}),page=await context.newPage();
        await boot(page,viewport,false);await visualCheck(page,testInfo,`${engine}-${viewport.name}`);await context.close();
      }
    }finally{await browser.close()}
  }
});
