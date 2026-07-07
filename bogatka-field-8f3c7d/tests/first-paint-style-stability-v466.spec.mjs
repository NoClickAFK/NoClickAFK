import {test,expect,webkit,chromium} from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=first-paint-status-reason-v466';
const ACTIVE_STYLES=[
  'style.css','v21.css','v22.css','v23.css','cloud.css','premium-v30.css','auth-v31.css','members-v32.css','stability-v33.css','inspection-layout-v461.css',
  'polish-v34.css','insights-v331.css','compare-v332.css','decision-v340.css','critical-deal-v430.css','compare-v340.css','suite-v400.css','visual-v411.css',
  'decision-panel-v412.css','workflow-v414.css','workflow-fixes-v415.css','workflow-refine-v440.css','location-profile-v416.css','location-overview-v417.css',
  'location-panels-v419.css','location-card-collapse-v422.css','status-next-task-v447.css','card-progress-v448.css','quick-checklist-v451.css','location-data-v452.css',
];
const DARK_TEXT='rgb(28, 41, 51)';

test.setTimeout(120000);

function basename(value=''){
  try{return new URL(value,'http://local/').pathname.split('/').pop()}catch{return String(value).split('/').pop()}
}

async function installFirstPaintProbe(page){
  await page.addInitScript(({activeStyles})=>{
    localStorage.setItem('bogatka_access_authorized_v1','1');
    const active=new Set(activeStyles);
    const probe={domReady:false,visibleAt:null,lastSampleAt:0,done:false,additions:[],samples:[]};
    const appVisible=()=>{
      const app=document.getElementById('app');
      if(!app||app.classList.contains('hidden'))return false;
      const style=getComputedStyle(app);
      const rect=app.getBoundingClientRect();
      return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity||1)>0&&rect.width>0&&rect.height>0;
    };
    const fileName=value=>{
      try{return new URL(value,location.href).pathname.split('/').pop()}catch{return String(value||'').split('/').pop()}
    };
    const recordLink=node=>{
      if(!(node instanceof HTMLLinkElement)||String(node.rel).toLowerCase()!=='stylesheet')return;
      const name=fileName(node.href);
      probe.additions.push({name,active:active.has(name),afterDOMContentLoaded:probe.domReady,afterVisible:appVisible(),time:performance.now()});
    };
    const observer=new MutationObserver(records=>{
      for(const record of records){
        for(const node of record.addedNodes){
          if(node instanceof HTMLLinkElement)recordLink(node);
          if(node instanceof Element)node.querySelectorAll?.('link[rel="stylesheet"]').forEach(recordLink);
        }
      }
    });
    observer.observe(document,{subtree:true,childList:true});
    document.addEventListener('DOMContentLoaded',()=>{probe.domReady=true},{once:true});

    const styleSnapshot=(node,pseudo=null)=>{
      if(!node)return null;
      const style=getComputedStyle(node,pseudo);
      const rect=pseudo?null:node.getBoundingClientRect();
      return{
        backgroundColor:style.backgroundColor,
        backgroundImage:style.backgroundImage,
        color:style.color,
        borderColor:style.borderColor,
        borderWidth:style.borderWidth,
        borderRadius:style.borderRadius,
        minHeight:style.minHeight,
        paddingTop:style.paddingTop,
        paddingRight:style.paddingRight,
        paddingBottom:style.paddingBottom,
        paddingLeft:style.paddingLeft,
        fontFamily:style.fontFamily,
        fontSize:style.fontSize,
        fontWeight:style.fontWeight,
        lineHeight:style.lineHeight,
        transform:style.transform,
        transition:style.transition,
        width:style.width,
        height:style.height,
        rectWidth:rect?.width??null,
        rectHeight:rect?.height??null,
      };
    };
    const sample=now=>{
      if(!appVisible()){
        requestAnimationFrame(sample);
        return;
      }
      if(probe.visibleAt===null)probe.visibleAt=now;
      const elapsed=now-probe.visibleAt;
      if(elapsed<=3000||now-probe.lastSampleAt>=240){
        probe.lastSampleAt=now;
        const panel=document.getElementById('locationComparisonPanel');
        const summary=panel?.querySelector(':scope > summary');
        const chevron=panel?.querySelector('.comparison-chevron-v332');
        const badges=[...document.querySelectorAll('[data-card-recommendation-v448]')].map((node,index)=>({
          key:`${node.closest('[data-location-card]')?.dataset.locationCard||index}|${node.className}|${node.textContent.trim()}`,
          style:styleSnapshot(node),
        }));
        const reasonStatus=document.querySelector('[data-decision-reason-status-v412]');
        probe.samples.push({
          elapsed,
          panel:panel?{
            panel:styleSnapshot(panel),
            summary:styleSnapshot(summary),
            wrapper:styleSnapshot(chevron),
            arrow:styleSnapshot(chevron,'::before'),
            open:Boolean(panel.open),
          }:null,
          badges,
          reasonStatus:reasonStatus?{key:`${reasonStatus.dataset.state||''}|${reasonStatus.textContent.trim()}`,style:styleSnapshot(reasonStatus)}:null,
        });
      }
      if(elapsed<15000)requestAnimationFrame(sample);
      else{
        probe.done=true;
        observer.disconnect();
      }
    };
    window.__firstPaintStyleProbe=probe;
    requestAnimationFrame(sample);
  },{activeStyles:ACTIVE_STYLES});
}

async function openApp(page,viewport={width:1440,height:1000}){
  await page.setViewportSize(viewport);
  await installFirstPaintProbe(page);
  await page.goto(APP_URL,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaCardProgressV448?.initialized&&
    window.BogatkaDecisionPanel?.ready&&
    document.querySelector('#locationComparisonPanel .comparison-chevron-v332')&&
    document.querySelectorAll('[data-card-recommendation-v448]').length>1
  ),{timeout:30000});
}

function stableByKey(samples,field){
  const signatures=new Map();
  for(const sample of samples){
    const entries=field==='badges'?sample.badges:(sample[field]?[sample[field]]:[]);
    for(const entry of entries){
      if(!entry?.style)continue;
      const style={...entry.style};
      delete style.transition;
      const signature=JSON.stringify(style);
      const values=signatures.get(entry.key)||new Set();
      values.add(signature);
      signatures.set(entry.key,values);
    }
  }
  return [...signatures.entries()].map(([key,values])=>({key,count:values.size}));
}

async function collectFirstPaint(page){
  await page.waitForFunction(()=>window.__firstPaintStyleProbe?.done===true,{timeout:25000});
  return await page.evaluate(activeStyles=>{
    const manifest=[...document.head.querySelectorAll('link[rel="stylesheet"]')]
      .map(link=>new URL(link.href,location.href).pathname.split('/').pop())
      .filter(name=>activeStyles.includes(name));
    return{probe:window.__firstPaintStyleProbe,manifest};
  },ACTIVE_STYLES);
}

function assertFirstPaint(result){
  expect(result.manifest).toEqual(ACTIVE_STYLES);
  expect(new Set(result.manifest).size).toBe(ACTIVE_STYLES.length);
  const late=result.probe.additions.filter(item=>item.active&&(item.afterDOMContentLoaded||item.afterVisible));
  expect(late).toEqual([]);

  const panelSamples=result.probe.samples.filter(sample=>sample.panel);
  expect(panelSamples.length).toBeGreaterThan(10);
  const first=panelSamples[0].panel;
  const final=panelSamples.at(-1).panel;
  expect(first.panel.backgroundColor).toBe('rgb(255, 250, 240)');
  expect(first.panel.borderColor).toBe('rgb(216, 184, 96)');
  expect(first.panel.borderWidth).toBe('2px');
  expect(first.panel.borderRadius).toBe('18px');
  expect(first.summary.backgroundImage).toBe(final.summary.backgroundImage);
  expect(first.panel.backgroundColor).toBe(final.panel.backgroundColor);
  expect(first.panel.borderColor).toBe(final.panel.borderColor);
  expect(panelSamples.every(sample=>sample.panel.wrapper.transform==='none')).toBe(true);
  expect(panelSamples.every(sample=>sample.panel.wrapper.width==='34px'&&sample.panel.wrapper.height==='34px')).toBe(true);
  expect(panelSamples.every(sample=>sample.panel.arrow.width==='11px'&&sample.panel.arrow.height==='11px')).toBe(true);
  expect(new Set(panelSamples.map(sample=>sample.panel.arrow.transform)).size).toBe(1);
  expect(new Set(panelSamples.map(sample=>sample.panel.panel.backgroundColor)).size).toBe(1);
  expect(new Set(panelSamples.map(sample=>sample.panel.panel.borderColor)).size).toBe(1);

  const badgeStability=stableByKey(result.probe.samples,'badges');
  expect(badgeStability.length).toBeGreaterThan(1);
  expect(badgeStability.every(item=>item.count===1)).toBe(true);
  for(const sample of result.probe.samples){
    for(const badge of sample.badges){
      expect(badge.style.color).toBe(DARK_TEXT);
      expect(badge.style.fontSize).toBe('11px');
      expect(badge.style.fontWeight).toBe('800');
      expect(badge.style.lineHeight).toBe('13.2px');
      expect(badge.style.borderRadius).toBe('999px');
      expect(badge.style.minHeight).toBe('28px');
    }
  }
  const reasonStability=stableByKey(result.probe.samples,'reasonStatus');
  expect(reasonStability.every(item=>item.count===1)).toBe(true);
}

async function assertComparisonInteraction(page){
  const panel=page.locator('#locationComparisonPanel');
  const summary=panel.locator(':scope > summary');
  const before=await panel.evaluate(node=>{
    const chevron=node.querySelector('.comparison-chevron-v332');
    return{
      background:getComputedStyle(node).backgroundColor,
      wrapper:getComputedStyle(chevron).transform,
      arrow:getComputedStyle(chevron,'::before').transform,
    };
  });
  await summary.click();
  await expect(summary).toHaveAttribute('aria-expanded','true');
  await expect(panel).toHaveClass(/comparison-interaction-ready-v430/);
  const opened=await panel.evaluate(node=>{
    const chevron=node.querySelector('.comparison-chevron-v332');
    return{
      background:getComputedStyle(node).backgroundColor,
      wrapper:getComputedStyle(chevron).transform,
      arrow:getComputedStyle(chevron,'::before').transform,
      rows:node.querySelectorAll('tbody tr').length,
    };
  });
  expect(opened.background).toBe(before.background);
  expect(opened.wrapper).toBe('none');
  expect(opened.arrow).not.toBe(before.arrow);
  expect(opened.rows).toBeGreaterThan(0);

  const rank=panel.locator('[data-compare-sort="rank"]');
  const rankText=await rank.textContent();
  await rank.click();
  await expect(rank).not.toHaveText(rankText);
  const firstAddress=panel.locator('[data-compare-location]').first();
  const targetId=await firstAddress.getAttribute('data-compare-location');
  await firstAddress.click();
  await expect(page.locator(`[data-location-card="${targetId}"]`)).toHaveClass(/compare-highlight-v332/);

  await summary.click();
  await expect(summary).toHaveAttribute('aria-expanded','false');
  const closed=await panel.evaluate(node=>{
    const chevron=node.querySelector('.comparison-chevron-v332');
    return{background:getComputedStyle(node).backgroundColor,wrapper:getComputedStyle(chevron).transform,arrow:getComputedStyle(chevron,'::before').transform};
  });
  expect(closed.background).toBe(before.background);
  expect(closed.wrapper).toBe('none');
  expect(closed.arrow).toBe(before.arrow);
}

test('Chromium first visible frame already has the final stylesheet cascade',async({page})=>{
  await openApp(page);
  const result=await collectFirstPaint(page);
  assertFirstPaint(result);
  await assertComparisonInteraction(page);
});

test('WebKit first visible frame already has the final stylesheet cascade',async()=>{
  const browser=await webkit.launch();
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    const page=await context.newPage();
    await openApp(page);
    const result=await collectFirstPaint(page);
    assertFirstPaint(result);
    await assertComparisonInteraction(page);
  }finally{
    await browser.close();
  }
});

function typography(style){
  return{
    fontFamily:style.fontFamily,
    fontSize:style.fontSize,
    fontWeight:style.fontWeight,
    lineHeight:style.lineHeight,
    letterSpacing:style.letterSpacing,
    fontKerning:style.fontKerning,
    textRendering:style.textRendering,
  };
}

async function visualSnapshot(page,testInfo,label){
  await page.waitForFunction(()=>Boolean(
    window.BogatkaDecisionPanel?.ready&&
    document.querySelector('[data-location-card] .progress-card-toggle-v462')&&
    document.querySelector('[data-location-card] .decision-reason-section-v412')
  ),{timeout:30000});
  await page.evaluate(()=>{
    const card=document.querySelector('[data-location-card]');
    window.BogatkaLocationCardCollapseV422.setCollapsed(card,false,{persist:false});
  });
  const card=page.locator('[data-location-card]').first();
  const reason=card.locator('.decision-reason-section-v412');
  const reasonSummary=reason.locator(':scope > summary');
  if(await reasonSummary.getAttribute('aria-expanded')==='true')await reasonSummary.click();

  const pills=await card.evaluate(node=>{
    const selectors=['.critical-summary-badge-v430','.economy-status-v400','.launch-progress-label-v400','.decision-reason-status-v412','[data-card-recommendation-v448]'];
    return selectors.map(selector=>{
      const element=node.querySelector(selector);
      if(!element)return{selector,missing:true};
      const style=getComputedStyle(element);
      const rect=element.getBoundingClientRect();
      return{
        selector,
        text:element.textContent.trim(),
        fontFamily:style.fontFamily,
        fontSize:style.fontSize,
        fontWeight:style.fontWeight,
        lineHeight:style.lineHeight,
        radius:style.borderRadius,
        paddingTop:style.paddingTop,
        paddingBottom:style.paddingBottom,
        color:style.color,
        height:rect.height,
      };
    });
  });
  expect(pills.every(pill=>!pill.missing),`${label}: all operational status pills exist`).toBe(true);
  const reference=pills[0];
  for(const pill of pills){
    expect(pill.fontFamily,`${label}: ${pill.selector} font`).toBe(reference.fontFamily);
    expect(pill.fontSize,`${label}: ${pill.selector} size`).toBe(reference.fontSize);
    expect(pill.fontWeight,`${label}: ${pill.selector} weight`).toBe(reference.fontWeight);
    expect(pill.lineHeight,`${label}: ${pill.selector} line height`).toBe(reference.lineHeight);
    expect(pill.radius,`${label}: ${pill.selector} radius`).toBe(reference.radius);
    expect(pill.paddingTop,`${label}: ${pill.selector} top padding`).toBe(reference.paddingTop);
    expect(pill.paddingBottom,`${label}: ${pill.selector} bottom padding`).toBe(reference.paddingBottom);
    expect(pill.color,`${label}: ${pill.selector} dark text`).toBe(DARK_TEXT);
    expect(Math.abs(pill.height-reference.height),`${label}: ${pill.selector} height`).toBeLessThanOrEqual(2);
  }

  const closed=await card.evaluate(node=>{
    const progress=node.querySelector('.progress-card-toggle-v462');
    const progressTitle=progress.querySelector('.progress-card-toggle-copy-v462 strong');
    const progressDescription=progress.querySelector('.progress-card-toggle-copy-v462 span');
    const reason=node.querySelector('.decision-reason-section-v412');
    const reasonSummary=reason.querySelector(':scope > summary');
    const reasonTitle=reason.querySelector('.decision-reason-title-v412');
    const reasonDescription=reason.querySelector('.decision-reason-description-v412');
    return{
      progressTitle:typography(getComputedStyle(progressTitle)),
      reasonTitle:typography(getComputedStyle(reasonTitle)),
      progressDescription:typography(getComputedStyle(progressDescription)),
      reasonDescription:typography(getComputedStyle(reasonDescription)),
      nested:reason.querySelectorAll('.decision-reason-section-v412,.decision-reason-v452 label').length,
      reasonHeight:reasonSummary.getBoundingClientRect().height,
    };
  });
  expect(closed.reasonTitle).toEqual(closed.progressTitle);
  expect(closed.reasonDescription).toEqual(closed.progressDescription);
  expect(closed.nested).toBe(0);

  await reasonSummary.click();
  await expect(reasonSummary).toHaveAttribute('aria-expanded','true');
  const opened=await reason.evaluate(node=>{
    const summary=node.querySelector(':scope > summary');
    const body=node.querySelector(':scope > .decision-reason-body-v412');
    const button=node.querySelector('[data-decision-reason-save-v412]');
    const outer=getComputedStyle(node);
    const summaryStyle=getComputedStyle(summary);
    const bodyStyle=getComputedStyle(body);
    const buttonStyle=getComputedStyle(button);
    const rect=node.getBoundingClientRect();
    const hit=(x,y)=>document.elementFromPoint(x,y);
    const leftHit=hit(rect.left+1,rect.bottom-1);
    const rightHit=hit(rect.right-1,rect.bottom-1);
    const centerHit=hit(rect.left+rect.width/2,rect.bottom-2);
    return{
      outerRadius:outer.borderBottomLeftRadius,
      overflow:outer.overflow,
      borderWidth:outer.borderBottomWidth,
      summaryBottomLeft:summaryStyle.borderBottomLeftRadius,
      summaryBottomRight:summaryStyle.borderBottomRightRadius,
      divider:summaryStyle.borderBottomWidth,
      bodyBottomLeft:bodyStyle.borderBottomLeftRadius,
      bodyBottomRight:bodyStyle.borderBottomRightRadius,
      bodyBorder:bodyStyle.borderBottomWidth,
      leftCornerClipped:!node.contains(leftHit),
      rightCornerClipped:!node.contains(rightHit),
      centerInside:node.contains(centerHit),
      headerHeight:summary.getBoundingClientRect().height,
      button:{
        classes:button.className,
        height:button.getBoundingClientRect().height,
        paddingTop:buttonStyle.paddingTop,
        paddingRight:buttonStyle.paddingRight,
        paddingBottom:buttonStyle.paddingBottom,
        paddingLeft:buttonStyle.paddingLeft,
        fontSize:buttonStyle.fontSize,
        fontWeight:buttonStyle.fontWeight,
        radius:buttonStyle.borderRadius,
      },
    };
  });
  expect(['clip','hidden']).toContain(opened.overflow);
  expect(opened.outerRadius).toBe('17px');
  expect(opened.borderWidth).toBe('1px');
  expect(opened.summaryBottomLeft).toBe('0px');
  expect(opened.summaryBottomRight).toBe('0px');
  expect(opened.divider).toBe('1px');
  expect(opened.bodyBottomLeft).toBe('16px');
  expect(opened.bodyBottomRight).toBe('16px');
  expect(opened.bodyBorder).toBe('0px');
  expect(opened.leftCornerClipped).toBe(true);
  expect(opened.rightCornerClipped).toBe(true);
  expect(opened.centerInside).toBe(true);
  expect(Math.abs(opened.headerHeight-closed.reasonHeight)).toBeLessThanOrEqual(1);
  expect(opened.button.classes).toContain('small');
  expect(opened.button.classes).toContain('decision-reason-save-v412');
  expect(opened.button.height).toBeGreaterThanOrEqual(32);
  expect(opened.button.height).toBeLessThanOrEqual(34);
  expect(opened.button.paddingTop).toBe('7px');
  expect(opened.button.paddingBottom).toBe('7px');
  expect(opened.button.paddingRight).toBe('10px');
  expect(opened.button.paddingLeft).toBe('10px');
  expect(opened.button.fontSize).toBe('12px');

  const screenshot=await reason.screenshot({animations:'disabled'});
  expect(screenshot.byteLength).toBeGreaterThan(1000);
  await testInfo.attach(`${label}-reason-open-corners`,{body:screenshot,contentType:'image/png'});
}

test('semantic pills and reason shell are canonical in Chromium and WebKit desktop/mobile',async({},{},testInfo)=>{
  for(const [engine,browserType] of [['chromium',chromium],['webkit',webkit]]){
    const browser=await browserType.launch();
    try{
      for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:900}]){
        const context=await browser.newContext({viewport});
        const page=await context.newPage();
        await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
        await page.goto(APP_URL,{waitUntil:'networkidle'});
        await visualSnapshot(page,testInfo,`${engine}-${viewport.name}`);
        await context.close();
      }
    }finally{
      await browser.close();
    }
  }
});
