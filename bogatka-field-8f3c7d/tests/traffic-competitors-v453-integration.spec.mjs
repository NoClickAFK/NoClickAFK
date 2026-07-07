import {test,expect,webkit} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('bogatka-field-8f3c7d');
const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=ios-mobile-typography-marker-hotfix';
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

async function openPreparedCard(page,width=1440,height=1000){
  await page.setViewportSize({width,height});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaInspectionLayoutV461?.ready&&
    window.BogatkaLocationDataV452?.ready&&
    window.BogatkaTrafficCompetitorsV453?.ready&&
    window.BogatkaTechnicalEconomicsV450?.ready&&
    window.BogatkaQuickChecklistV451?.ready&&
    document.querySelector('[data-location-card]')&&
    document.querySelector('.critical-deal-v430')&&
    document.querySelector('.economy-v400')&&
    document.querySelector('.launch-project-v400')
  ),{timeout:30000});
  await page.evaluate(async()=>{
    try{cloudRole=null}catch(_){ }
    window.cloudRole=null;
    await window.BogatkaTrafficCompetitorsV453.enhanceAll();
    await window.BogatkaTechnicalEconomicsV450.enhanceAll();
    const card=document.querySelector('[data-location-card]');
    window.BogatkaLocationCardCollapseV422?.setCollapsed?.(card,false,{persist:false});
    for(const details of card.querySelectorAll('details'))details.open=true;
  });
  const card=page.locator('[data-location-card]').first();
  if(await card.locator('.traffic-measurement-v453').count()===0)await card.locator('[data-stage7-action="add-traffic"]').click();
  await expect(card.locator('.traffic-measurement-v453').first()).toBeVisible();
  await expect(card.locator('.quick-checklist-v451 .check-row .premium-select-trigger').first()).toBeVisible();
  return card;
}

async function typographySnapshot(card){
  return card.evaluate(node=>{
    const visible=control=>control?.nextElementSibling?.classList.contains('premium-select-trigger')?control.nextElementSibling:control;
    const labelNode=control=>{
      const wrapper=control?.closest('label.field,.stage7-field-v453');
      return wrapper?.querySelector('.profile-caption-v416,.evaluation-caption-v446,.technical-caption-v450')||wrapper||null;
    };
    const field=name=>[...node.querySelectorAll(`[data-field="${name}"]`)].find(item=>!item.hasAttribute('data-stage6-marker-v461'));
    const style=(element,pseudo='')=>{
      const value=getComputedStyle(element,pseudo);
      return{size:value.fontSize,weight:value.fontWeight,lineHeight:value.lineHeight,color:value.color,opacity:value.opacity};
    };
    const traffic=node.querySelector('.traffic-measurement-v453');
    const controls={
      inspection:field('inspectionPurpose'),
      landlordInput:field('ownerName'),
      landlordSelect:field('contactRole'),
      landlordTextarea:field('rentConditions'),
      technical:field('tech.rentPerMonth'),
      trafficInput:traffic?.querySelector('[data-stage7-field="peopleCount"]'),
      trafficSelect:traffic?.querySelector('[data-stage7-field="durationMinutes"]'),
      trafficComment:traffic?.querySelector('[data-stage7-field="comment"]'),
      decision:node.querySelector('.decision-reason-section-v412 textarea'),
      decisionTitle:node.querySelector('.decision-reason-title-v412'),
      decisionHelper:node.querySelector('.decision-reason-helper-v412'),
      quickTrigger:node.querySelector('.quick-checklist-v451 .check-row .premium-select-trigger'),
    };
    const labels={
      inspection:labelNode(controls.inspection),
      landlord:labelNode(controls.landlordInput),
      technical:labelNode(controls.technical),
      traffic:labelNode(controls.trafficInput),
    };
    const cardStyle=getComputedStyle(node);
    return{
      missing:[
        ...Object.entries(controls).filter(([,value])=>!value).map(([key])=>key),
        ...Object.entries(labels).filter(([,value])=>!value).map(([key])=>`label:${key}`),
      ],
      labels:Object.fromEntries(Object.entries(labels).map(([key,value])=>[key,style(value)])),
      decisionAccordion:{
        title:style(controls.decisionTitle),
        helper:style(controls.decisionHelper),
      },
      nativeValue:style(controls.landlordInput),
      customSelects:{
        landlord:style(visible(controls.landlordSelect)),
        traffic:style(visible(controls.trafficSelect)),
      },
      quickTitle:style(controls.quickTrigger?.closest('.check-row')?.querySelector(':scope > span:first-of-type')),
      quickValue:style(controls.quickTrigger),
      placeholders:{
        input:style(controls.landlordInput,'::placeholder'),
        textarea:style(controls.landlordTextarea,'::placeholder'),
        traffic:style(controls.trafficComment,'::placeholder'),
        decision:style(controls.decision,'::placeholder'),
      },
      placeholderHosts:{
        input:style(controls.landlordInput),
        textarea:style(controls.landlordTextarea),
        traffic:style(controls.trafficComment),
        decision:style(controls.decision),
      },
      placeholderTokens:{
        size:cardStyle.getPropertyValue('--form-placeholder-font-size').trim(),
        weight:cardStyle.getPropertyValue('--form-placeholder-font-weight').trim(),
        lineHeight:cardStyle.getPropertyValue('--form-placeholder-line-height').trim(),
      },
      helper:style(traffic?.querySelector('[data-weekday-v453]')),
      error:style(node.querySelector('.decision-reason-warning-v452')),
      cardOverflow:node.scrollWidth-node.clientWidth,
      pageOverflow:document.documentElement.scrollWidth-window.innerWidth,
    };
  });
}

async function markerSnapshot(card){
  return card.evaluate(node=>{
    const affected=[node.querySelector('.critical-deal-v430'),node.querySelector('.economy-v400'),node.querySelector('.launch-project-v400')];
    const freeze=document.createElement('style');
    freeze.textContent='.critical-deal-v430>summary::before,.economy-v400>summary::before,.launch-project-v400>summary::before{transition:none!important}';
    node.append(freeze);
    const marker=details=>{
      const summary=details.querySelector(':scope > summary');
      const base=getComputedStyle(summary);
      const before=getComputedStyle(summary,'::before');
      const standards=getComputedStyle(summary,'::marker');
      const after=getComputedStyle(summary,'::after');
      return{
        listStyleType:base.listStyleType,
        appearance:base.appearance,
        webkitAppearance:base.webkitAppearance,
        markerContent:standards.content,
        markerSize:standards.fontSize,
        beforeContent:before.content,
        beforeBorderWidth:before.borderLeftWidth,
        beforeBorderStyle:before.borderLeftStyle,
        beforeColor:before.borderLeftColor,
        beforeTransform:before.transform,
        afterContent:after.content,
      };
    };
    for(const details of affected)details.open=false;
    const closed=affected.map(marker);
    const badges=[
      affected[0]?.querySelector('.critical-summary-badge-v430'),
      affected[1]?.querySelector('.economy-status-v400'),
      affected[2]?.querySelector('.launch-progress-label-v400'),
    ].map(element=>({text:element?.textContent.trim()||'',visible:Boolean(element&&getComputedStyle(element).display!=='none'&&element.getBoundingClientRect().width>0)}));
    const titles=affected.map(details=>details?.querySelector(':scope > summary')?.textContent.trim()||'');
    for(const details of affected)details.open=true;
    const opened=affected.map(marker);
    freeze.remove();
    return{
      missing:affected.map((value,index)=>value?null:index).filter(value=>value!==null),
      closed,opened,badges,titles,
      overflow:document.documentElement.scrollWidth-window.innerWidth,
    };
  });
}

function expectDesktop(snapshot){
  expect(snapshot.missing).toEqual([]);
  for(const [name,label] of Object.entries(snapshot.labels))expect(label,`desktop canonical label: ${name}`).toMatchObject({size:'11px',weight:'800',lineHeight:'14.85px'});
  expect(snapshot.decisionAccordion.title).toMatchObject({size:'17px',weight:'800',lineHeight:'21.25px'});
  expect(snapshot.decisionAccordion.helper).toMatchObject({size:'12px',weight:'400',lineHeight:'18px'});
  expect(snapshot.nativeValue).toMatchObject({size:'12px',weight:'700',lineHeight:'16.2px'});
  for(const select of Object.values(snapshot.customSelects)){
    expect(select).toMatchObject({size:'12px',weight:'700'});
    expect(Number.parseFloat(select.lineHeight)).toBeCloseTo(16.2,4);
  }
  for(const placeholder of Object.values(snapshot.placeholders)){
    expect(placeholder).toMatchObject({size:'12px',weight:'500'});
    expect(['normal','16.2px']).toContain(placeholder.lineHeight);
  }
  expect(snapshot.helper).toMatchObject({size:'10px',weight:'400',lineHeight:'14px'});
  expect(snapshot.error).toMatchObject({size:'10px',weight:'700',lineHeight:'13.5px'});
}

function expectMobile(snapshot,{allowWebKitPseudoFallback=false}={}){
  expect(snapshot.missing).toEqual([]);
  expect(snapshot.placeholderTokens).toEqual({size:'11px',weight:'400',lineHeight:'1.4'});
  for(const [name,label] of Object.entries(snapshot.labels))expect(label,`mobile canonical label: ${name}`).toMatchObject({size:'11px',weight:'800',lineHeight:'14.85px'});
  expect(snapshot.decisionAccordion.title).toMatchObject({size:'15px',weight:'800',lineHeight:'18.75px'});
  expect(snapshot.decisionAccordion.helper).toMatchObject({size:'12px',weight:'400',lineHeight:'18px'});
  expect(snapshot.nativeValue).toMatchObject({size:'16px',weight:'600',lineHeight:'21.6px'});
  for(const select of Object.values(snapshot.customSelects)){
    expect(select).toMatchObject({size:'12px',weight:'700'});
    expect(Number.parseFloat(select.lineHeight)).toBeCloseTo(16.2,4);
  }
  expect(snapshot.quickTitle).toMatchObject({size:'11px',weight:'700',lineHeight:'14.85px'});
  expect(snapshot.quickValue).toMatchObject({size:'10px',weight:'800',lineHeight:'13.5px'});
  const explicit=[];
  for(const [key,placeholder] of Object.entries(snapshot.placeholders)){
    if(placeholder.size==='11px'&&placeholder.weight==='400'){
      explicit.push(placeholder);
      if(placeholder.lineHeight!=='normal')expect(Number.parseFloat(placeholder.lineHeight)).toBeCloseTo(15.4,4);
      continue;
    }
    expect(allowWebKitPseudoFallback).toBe(true);
    const host=snapshot.placeholderHosts[key];
    expect(placeholder).toMatchObject({size:host.size,weight:host.weight,lineHeight:host.lineHeight});
  }
  if(explicit.length){
    expect(new Set(explicit.map(value=>`${value.size}/${value.weight}/${value.color}/${value.opacity}`)).size).toBe(1);
    expect(Number.parseFloat(explicit[0].size)).toBeLessThan(Number.parseFloat(snapshot.customSelects.landlord.size));
  }
  expect(snapshot.helper).toMatchObject({size:'10px',weight:'400',lineHeight:'14px'});
  expect(snapshot.error).toMatchObject({size:'10px',weight:'700',lineHeight:'14px'});
  expect(snapshot.cardOverflow).toBeLessThanOrEqual(1);
  expect(snapshot.pageOverflow).toBeLessThanOrEqual(1);
}

function expectMarkers(snapshot){
  expect(snapshot.missing).toEqual([]);
  expect(snapshot.titles.join(' ')).not.toMatch(/[▶⏵⏩⏯🔽🔼🔺🔻]/u);
  for(const state of snapshot.closed){
    expect(state.listStyleType).toBe('none');
    expect(state.appearance).toBe('none');
    expect(state.webkitAppearance).toBe('none');
    expect(['""','none']).toContain(state.markerContent);
    expect(state.markerSize).toBe('0px');
    expect(state.beforeContent).toBe('""');
    expect(state.beforeBorderWidth).toBe('8px');
    expect(state.beforeBorderStyle).toBe('solid');
    expect(state.beforeTransform).toBe('none');
    expect(['none','normal','""']).toContain(state.afterContent);
  }
  expect(new Set(snapshot.closed.map(value=>`${value.beforeBorderWidth}/${value.beforeBorderStyle}/${value.beforeColor}`)).size).toBe(1);
  expect(snapshot.opened.every(value=>value.beforeTransform!=='none')).toBe(true);
  expect(snapshot.badges.every(value=>value.visible&&value.text.length>0)).toBe(true);
  expect(snapshot.overflow).toBeLessThanOrEqual(1);
}

test('assets preserve legacy traffic and public report integration',()=>{
  const durable=read('durable-fields-v452.js');
  const worker=read('sw-v340.js');
  const source=read('traffic-competitors-v453.js');
  const style=read('style.css');
  const trafficStyle=read('traffic-competitors-v453.css');
  const publicLoader=read('report/location-details-v452.js');
  const publicReport=read('report/traffic-competitors-v453.js');
  const occurrences=(text,value)=>text.split(value).length-1;
  expect(durable).toContain("href:'./traffic-competitors-v453.css'");
  expect(durable).toContain("src:'./traffic-competitors-v453.js'");
  expect(occurrences(worker,'./traffic-competitors-v453.css')).toBe(1);
  expect(occurrences(worker,'./traffic-competitors-v453.js')).toBe(1);
  expect(occurrences(worker,'./report/traffic-competitors-v453.js')).toBe(1);
  expect(publicLoader).toContain("'./traffic-competitors-v453.js'");
  expect(source).toContain("const TRAFFIC_KEY='trafficMeasurements'");
  expect(source).toContain("const COMPETITORS_KEY='competitors'");
  expect(source).toContain('data.traffic');
  expect(source).not.toContain('delete data.traffic');
  expect(source).not.toContain('delete data.competitor');
  expect(publicReport).toContain('trafficMeasurements');
  expect(publicReport).toContain('data.competitors');
  expect(style).toContain('--form-placeholder-font-size:11px;--form-placeholder-font-weight:400;--form-placeholder-line-height:1.4');
  expect(style).toContain('textarea)::placeholder{font-size:var(--form-placeholder-font-size)!important');
  expect(trafficStyle).toContain('.stage7-field-v453 input::placeholder,.stage7-field-v453 textarea::placeholder');
  expect(trafficStyle).toContain('font-size:var(--form-placeholder-font-size)');
  expect(trafficStyle).toContain('font-weight:var(--form-placeholder-font-weight)');
  expect(trafficStyle).toContain('line-height:var(--form-placeholder-line-height)');
});

test('desktop baseline is unchanged and mobile hierarchy matches the quick checklist reference',async({page})=>{
  const card=await openPreparedCard(page,1440,1000);
  expectDesktop(await typographySnapshot(card));
  await page.setViewportSize({width:390,height:900});
  expectMobile(await typographySnapshot(card));
  const id=await card.getAttribute('data-location-card');
  const owner=card.locator('[data-field="ownerName"]').first();
  await owner.fill('Проверка компактной мобильной формы');
  await owner.blur();
  await page.waitForFunction(async({id,value})=>(await getLocationData(id)).ownerName===value,{id,value:'Проверка компактной мобильной формы'});
  await expect(owner).toHaveValue('Проверка компактной мобильной формы');
});

test('Chromium hides native markers and rotates one custom triangle',async({page})=>{
  const card=await openPreparedCard(page,390,900);
  expectMarkers(await markerSnapshot(card));
});

test('WebKit mobile verifies compact forms and direct Safari marker suppression',async()=>{
  test.setTimeout(120000);
  const browser=await webkit.launch();
  try{
    const context=await browser.newContext({viewport:{width:390,height:900}});
    const page=await context.newPage();
    const card=await openPreparedCard(page,390,900);
    expectMobile(await typographySnapshot(card),{allowWebKitPseudoFallback:true});
    expectMarkers(await markerSnapshot(card));
  }finally{
    await browser.close();
  }
});
