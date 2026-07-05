import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('bogatka-field-8f3c7d');
const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=form-typography-hotfix';
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('v453 assets are loaded and cached once',()=>{
  const durable=read('durable-fields-v452.js');
  const worker=read('sw-v340.js');
  const publicLoader=read('report/location-details-v452.js');
  const occurrences=(text,value)=>text.split(value).length-1;

  expect(durable).toContain("href:'./traffic-competitors-v453.css'");
  expect(durable).toContain("src:'./traffic-competitors-v453.js'");
  expect(occurrences(worker,'./traffic-competitors-v453.css')).toBe(1);
  expect(occurrences(worker,'./traffic-competitors-v453.js')).toBe(1);
  expect(occurrences(worker,'./report/traffic-competitors-v453.js')).toBe(1);
  expect(publicLoader).toContain("'./traffic-competitors-v453.js'");
  expect(publicLoader).toContain('script.src=src');
});

test('v453 preserves legacy storage without visible migration UI',()=>{
  const source=read('traffic-competitors-v453.js');
  expect(source).toContain("const TRAFFIC_KEY='trafficMeasurements'");
  expect(source).toContain("const COMPETITORS_KEY='competitors'");
  expect(source).toContain('data.traffic');
  expect(source).toContain('legacyCompatibilityHtml');
  expect(source).not.toContain('delete data.traffic');
  expect(source).not.toContain('delete data.competitor');
  expect(source).not.toContain('class="legacy-traffic-v453"');
  expect(source).not.toContain('Ранее сохранённые поля');
  expect(source).not.toContain('Эти значения сохранены без преобразования и не удаляются.');
});

test('traffic form exposes canonical keys with premium duration and weather options',()=>{
  const source=read('traffic-competitors-v453.js');
  for(const key of ['date','startTime','durationMinutes','weather','peopleCount','targetCustomers','dogWalkers','competitorVisitors','parkingOccupiedPct','comment']){
    expect(source).toContain(`['${key}'`);
  }
  expect(source).toContain("['90','90 минут']");
  expect(source).toContain("['120','120 минут']");
  expect(source).toContain("['Переменная облачность','Переменная облачность']");
  expect(source).toContain('selectOptions(options,current,key)');
  expect(source).toContain("field!=='parkingOccupiedPct'||number<=100");
});

test('active form styles consume one semantic typography token set',()=>{
  const shared=read('style.css');
  const profile=read('location-profile-v416.css');
  const inspection=read('inspection-layout-v461.css');
  const traffic=read('traffic-competitors-v453.css');
  const decision=read('location-data-v452.css');
  const lease=read('critical-deal-v430.css');
  const mobile=read('v22.css');

  for(const token of [
    '--form-label-font-size','--form-label-font-weight','--form-label-line-height',
    '--form-control-font-size','--form-control-font-weight','--form-control-line-height',
    '--form-placeholder-font-size','--form-placeholder-font-weight','--form-placeholder-color',
    '--form-helper-font-size','--form-helper-line-height','--form-error-font-size','--form-error-line-height',
  ])expect(shared).toContain(token);

  for(const source of [profile,inspection,traffic,decision]){
    expect(source).toContain('var(--form-label-font-size)');
    expect(source).toContain('var(--form-label-font-weight)');
  }
  for(const source of [profile,inspection,traffic]){
    expect(source).toContain('var(--form-control-font-size)');
    expect(source).toContain('var(--form-control-font-weight)');
  }
  expect(traffic).toContain('var(--form-placeholder-font-size)');
  expect(traffic).toContain('var(--form-placeholder-font-weight)');
  expect(decision).toContain('var(--form-error-font-size)');
  expect(lease).toContain('var(--form-helper-font-size)');
  expect(lease).toContain('var(--form-error-font-size)');
  expect(mobile).not.toContain('@media(max-width:700px){input,select,textarea{font-size:16px!important');
  expect(shared).toContain('[data-location-card]{--form-control-font-size:16px;--form-placeholder-font-size:16px}');
});

test('inspection, landlord, traffic and decision controls share computed typography',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaInspectionLayoutV461?.ready&&
    window.BogatkaLocationDataV452?.ready&&
    window.BogatkaTrafficCompetitorsV453?.ready&&
    document.querySelector('[data-location-card]')
  ),{timeout:30000});
  await page.evaluate(async()=>{
    try{cloudRole=null}catch(_){ }
    window.cloudRole=null;
    await window.BogatkaTrafficCompetitorsV453.enhanceAll();
    const card=document.querySelector('[data-location-card]');
    window.BogatkaLocationCardCollapseV422?.setCollapsed?.(card,false,{persist:false});
    const traffic=[...card.querySelectorAll('details')].find(item=>item.querySelector(':scope > summary')?.textContent.includes('Полевой замер трафика'));
    if(traffic)traffic.open=true;
  });

  const card=page.locator('[data-location-card]').first();
  if(await card.locator('.traffic-measurement-v453').count()===0)await card.locator('[data-stage7-action="add-traffic"]').click();
  await expect(card.locator('.traffic-measurement-v453').first()).toBeVisible();

  const desktop=await card.evaluate(node=>{
    const visible=control=>control?.nextElementSibling?.classList.contains('premium-select-trigger')?control.nextElementSibling:control;
    const caption=control=>control?.closest('label.field')?.querySelector(':scope > .profile-caption-v416,:scope > .evaluation-caption-v446,:scope > .technical-caption-v450')||control?.closest('label.field');
    const field=name=>[...node.querySelectorAll(`[data-field="${name}"]`)].find(item=>!item.hasAttribute('data-stage6-marker-v461'));
    const style=(element,pseudo='')=>{
      const value=getComputedStyle(element,pseudo);
      return{family:value.fontFamily,size:value.fontSize,weight:value.fontWeight,lineHeight:value.lineHeight,color:value.color,opacity:value.opacity};
    };
    const reference=field('inspectionPurpose');
    const referenceLabel=caption(reference);
    const referencePlaceholder=field('inspectionResult');
    const traffic=node.querySelector('.traffic-measurement-v453');
    const controls=[field('ownerName'),field('listingUrl'),field('inspectionParticipants'),traffic.querySelector('[data-stage7-field="peopleCount"]'),traffic.querySelector('[data-stage7-field="durationMinutes"]'),traffic.querySelector('[data-stage7-field="weather"]'),traffic.querySelector('[data-stage7-field="comment"]'),node.querySelector('.decision-reason-v452 textarea')];
    const placeholders=[field('ownerName'),field('listingUrl'),field('inspectionParticipants'),traffic.querySelector('[data-stage7-field="peopleCount"]'),traffic.querySelector('[data-stage7-field="comment"]'),node.querySelector('.decision-reason-v452 textarea')];
    return{
      referenceControl:style(visible(reference)),
      referenceLabel:style(referenceLabel),
      referencePlaceholder:style(referencePlaceholder,'::placeholder'),
      controls:controls.map(control=>style(visible(control))),
      labels:controls.map(control=>style(caption(control))),
      placeholders:placeholders.map(control=>style(control,'::placeholder')),
      helper:style(traffic.querySelector('[data-weekday-v453]')),
      error:style(node.querySelector('.decision-reason-warning-v452')),
      overflow:node.scrollWidth-node.clientWidth,
    };
  });

  for(const value of desktop.controls)expect(value).toEqual(desktop.referenceControl);
  for(const value of desktop.labels)expect(value).toEqual(desktop.referenceLabel);
  for(const value of desktop.placeholders)expect(value).toEqual(desktop.referencePlaceholder);
  expect(desktop.referenceControl.size).toBe('12px');
  expect(desktop.referenceControl.weight).toBe('700');
  expect(desktop.referenceLabel.size).toBe('11px');
  expect(desktop.referenceLabel.weight).toBe('800');
  expect(desktop.referencePlaceholder.size).toBe('12px');
  expect(desktop.referencePlaceholder.weight).toBe('500');
  expect(desktop.helper.size).toBe('10px');
  expect(desktop.helper.weight).toBe('400');
  expect(desktop.error.size).toBe('10px');
  expect(desktop.error.weight).toBe('700');
  expect(desktop.overflow).toBeLessThanOrEqual(1);

  await page.setViewportSize({width:390,height:900});
  const mobile=await card.evaluate(node=>{
    const visible=control=>control?.nextElementSibling?.classList.contains('premium-select-trigger')?control.nextElementSibling:control;
    const field=name=>[...node.querySelectorAll(`[data-field="${name}"]`)].find(item=>!item.hasAttribute('data-stage6-marker-v461'));
    const traffic=node.querySelector('.traffic-measurement-v453');
    const controls=[field('inspectionPurpose'),field('ownerName'),traffic.querySelector('[data-stage7-field="peopleCount"]'),traffic.querySelector('[data-stage7-field="durationMinutes"]'),traffic.querySelector('[data-stage7-field="comment"]'),node.querySelector('.decision-reason-v452 textarea')];
    const placeholders=[field('inspectionResult'),field('ownerName'),traffic.querySelector('[data-stage7-field="peopleCount"]'),traffic.querySelector('[data-stage7-field="comment"]'),node.querySelector('.decision-reason-v452 textarea')];
    return{
      controls:controls.map(control=>getComputedStyle(visible(control)).fontSize),
      placeholders:placeholders.map(control=>getComputedStyle(control,'::placeholder').fontSize),
      weights:placeholders.map(control=>getComputedStyle(control,'::placeholder').fontWeight),
      overflow:node.scrollWidth-node.clientWidth,
    };
  });
  expect(new Set(mobile.controls)).toEqual(new Set(['16px']));
  expect(new Set(mobile.placeholders)).toEqual(new Set(['16px']));
  expect(new Set(mobile.weights)).toEqual(new Set(['500']));
  expect(mobile.overflow).toBeLessThanOrEqual(1);
});

test('public report supports structured traffic and competitor lists',()=>{
  const source=read('report/traffic-competitors-v453.js');
  expect(source).toContain('trafficMeasurements');
  expect(source).toContain('data.competitors');
  expect(source).toContain('Ближайший прямой конкурент');
});
