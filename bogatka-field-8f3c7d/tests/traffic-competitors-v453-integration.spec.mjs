import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('bogatka-field-8f3c7d');
const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=mobile-form-typography-arrow-hotfix';
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

async function openPreparedCard(page,width=1440,height=1000){
  await page.setViewportSize({width,height});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaInspectionLayoutV461?.ready&&
    window.BogatkaLocationDataV452?.ready&&
    window.BogatkaTrafficCompetitorsV453?.ready&&
    document.querySelector('[data-location-card]')&&
    document.querySelector('.critical-deal-v430')&&
    document.querySelector('.economy-v400')&&
    document.querySelector('.launch-project-v400')
  ),{timeout:30000});
  await page.evaluate(async()=>{
    try{cloudRole=null}catch(_){ }
    window.cloudRole=null;
    await window.BogatkaTrafficCompetitorsV453.enhanceAll();
    const card=document.querySelector('[data-location-card]');
    window.BogatkaLocationCardCollapseV422?.setCollapsed?.(card,false,{persist:false});
    for(const details of card.querySelectorAll('details'))details.open=true;
  });
  const card=page.locator('[data-location-card]').first();
  if(await card.locator('.traffic-measurement-v453').count()===0)await card.locator('[data-stage7-action="add-traffic"]').click();
  await expect(card.locator('.traffic-measurement-v453').first()).toBeVisible();
  return card;
}

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

test('active forms use desktop baseline and one mobile semantic token set',()=>{
  const shared=read('style.css');
  const profile=read('location-profile-v416.css');
  const inspection=read('inspection-layout-v461.css');
  const traffic=read('traffic-competitors-v453.css');
  const decision=read('location-data-v452.css');
  const lease=read('critical-deal-v430.css');
  const mobile=read('v22.css');

  expect(shared).toContain('--form-label-font-size:11px;--form-label-font-weight:800;--form-label-line-height:1.35');
  expect(shared).toContain('--form-control-font-size:12px;--form-control-font-weight:700;--form-control-line-height:1.35');
  expect(shared).toContain('--form-placeholder-font-size:12px;--form-placeholder-font-weight:500;--form-placeholder-line-height:1.35');
  expect(shared).toContain('--form-helper-font-size:10px;--form-helper-font-weight:400;--form-helper-line-height:1.4');
  expect(shared).toContain('--form-error-font-size:10px;--form-error-font-weight:700;--form-error-line-height:1.35');
  expect(shared).toContain('--form-label-font-size:13px;--form-label-font-weight:700;--form-label-line-height:1.3');
  expect(shared).toContain('--form-control-font-size:16px;--form-control-font-weight:600;--form-control-line-height:1.35');
  expect(shared).toContain('--form-placeholder-font-size:14px;--form-placeholder-font-weight:400;--form-placeholder-line-height:1.35');
  expect(shared).toContain('--form-helper-font-size:12px;--form-helper-font-weight:400;--form-helper-line-height:1.4');
  expect(shared).toContain('--form-error-font-size:12px;--form-error-line-height:1.4');

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

  expect(lease).toContain(':is(.critical-deal-v430,.economy-v400,.launch-project-v400)>summary::before');
  expect(lease).toContain('border-left:8px solid currentColor');
  expect(lease).not.toContain("content:'▶'");
  expect(lease).not.toContain('content:"▶"');
});

test('desktop typography stays unchanged while mobile forms use compact hierarchy',async({page})=>{
  const card=await openPreparedCard(page);
  const id=await card.getAttribute('data-location-card');

  const desktop=await card.evaluate(node=>{
    const visible=control=>control?.nextElementSibling?.classList.contains('premium-select-trigger')?control.nextElementSibling:control;
    const caption=control=>{
      const wrapper=control?.closest('label.field,.decision-reason-v452');
      return wrapper?.querySelector(':scope > .profile-caption-v416,:scope > .evaluation-caption-v446,:scope > .technical-caption-v450')||wrapper;
    };
    const field=name=>[...node.querySelectorAll(`[data-field="${name}"]`)].find(item=>!item.hasAttribute('data-stage6-marker-v461'));
    const style=(element,pseudo='')=>{
      const value=getComputedStyle(element,pseudo);
      return{family:value.fontFamily,size:value.fontSize,weight:value.fontWeight,lineHeight:value.lineHeight,color:value.color,opacity:value.opacity};
    };
    const inspection=field('inspectionPurpose');
    const inspectionPlaceholder=field('inspectionResult');
    const landlord=field('ownerName');
    const landlordSelect=field('contactRole');
    const landlordTextarea=field('rentConditions');
    const missing={inspection,inspectionPlaceholder,landlord,landlordSelect,landlordTextarea};
    return{
      missing:Object.entries(missing).filter(([,value])=>!value).map(([key])=>key),
      inspectionLabel:style(caption(inspection)),
      landlordLabel:style(caption(landlord)),
      inspectionControl:style(visible(inspection)),
      landlordControl:style(visible(landlord)),
      selectValue:style(visible(landlordSelect)),
      inspectionPlaceholder:style(inspectionPlaceholder,'::placeholder'),
      landlordPlaceholder:style(landlord,'::placeholder'),
      textareaPlaceholder:style(landlordTextarea,'::placeholder'),
    };
  });

  expect(desktop.missing).toEqual([]);
  expect(desktop.inspectionLabel).toEqual(desktop.landlordLabel);
  expect(desktop.inspectionControl).toEqual(desktop.landlordControl);
  expect(desktop.inspectionControl).toEqual(desktop.selectValue);
  expect(desktop.inspectionPlaceholder).toEqual(desktop.landlordPlaceholder);
  expect(desktop.inspectionPlaceholder).toEqual(desktop.textareaPlaceholder);
  expect(desktop.inspectionLabel).toMatchObject({size:'11px',weight:'800',lineHeight:'14.85px'});
  expect(desktop.inspectionControl).toMatchObject({size:'12px',weight:'700',lineHeight:'16.2px'});
  expect(desktop.inspectionPlaceholder).toMatchObject({size:'12px',weight:'500',lineHeight:'16.2px'});

  await page.setViewportSize({width:390,height:900});
  const mobile=await card.evaluate(node=>{
    const visible=control=>control?.nextElementSibling?.classList.contains('premium-select-trigger')?control.nextElementSibling:control;
    const caption=control=>{
      const wrapper=control?.closest('label.field,.decision-reason-v452');
      return wrapper?.querySelector(':scope > .profile-caption-v416,:scope > .evaluation-caption-v446,:scope > .technical-caption-v450')||wrapper;
    };
    const field=name=>[...node.querySelectorAll(`[data-field="${name}"]`)].find(item=>!item.hasAttribute('data-stage6-marker-v461'));
    const style=(element,pseudo='')=>{
      const value=getComputedStyle(element,pseudo);
      return{family:value.fontFamily,size:value.fontSize,weight:value.fontWeight,lineHeight:value.lineHeight,color:value.color,opacity:value.opacity};
    };
    const traffic=node.querySelector('.traffic-measurement-v453');
    const controls={
      landlordInput:field('ownerName'),
      landlordSelect:field('contactRole'),
      landlordTextarea:field('rentConditions'),
      technicalInput:field('tech.rentPerMonth'),
      technicalReadonly:field('tech.rentPerSqm'),
      technicalHolidays:field('tech.rentHolidays'),
      technicalIndexation:field('tech.indexation'),
      technicalHours:field('tech.openingHours'),
      trafficInput:traffic?.querySelector('[data-stage7-field="peopleCount"]'),
      trafficSelect:traffic?.querySelector('[data-stage7-field="durationMinutes"]'),
      trafficWeather:traffic?.querySelector('[data-stage7-field="weather"]'),
      trafficComment:traffic?.querySelector('[data-stage7-field="comment"]'),
      decision:node.querySelector('.decision-reason-v452 textarea'),
    };
    const placeholderKeys=['landlordInput','landlordTextarea','technicalReadonly','technicalHolidays','technicalIndexation','technicalHours','trafficInput','trafficComment','decision'];
    const labelKeys=['landlordInput','landlordSelect','landlordTextarea','technicalInput','technicalHolidays','technicalIndexation','technicalHours','trafficInput','trafficSelect','trafficWeather','trafficComment','decision'];
    const controlKeys=Object.keys(controls);
    const missing=Object.entries(controls).filter(([,value])=>!value).map(([key])=>key);
    return{
      missing,
      labels:labelKeys.map(key=>style(caption(controls[key]))),
      values:controlKeys.map(key=>style(visible(controls[key]))),
      placeholders:placeholderKeys.map(key=>style(controls[key],'::placeholder')),
      helper:style(traffic?.querySelector('[data-weekday-v453]')),
      error:style(node.querySelector('.decision-reason-warning-v452')),
      cardOverflow:node.scrollWidth-node.clientWidth,
      pageOverflow:document.documentElement.scrollWidth-window.innerWidth,
    };
  });

  expect(mobile.missing).toEqual([]);
  expect(new Set(mobile.labels.map(value=>`${value.size}/${value.weight}/${value.lineHeight}`))).toEqual(new Set(['13px/700/16.9px']));
  expect(new Set(mobile.values.map(value=>`${value.size}/${value.weight}/${value.lineHeight}`))).toEqual(new Set(['16px/600/21.6px']));
  expect(new Set(mobile.placeholders.map(value=>`${value.size}/${value.weight}/${value.lineHeight}/${value.color}/${value.opacity}`)).size).toBe(1);
  expect(mobile.placeholders[0]).toMatchObject({size:'14px',weight:'400',lineHeight:'18.9px'});
  expect(Number.parseFloat(mobile.placeholders[0].size)).toBeLessThan(Number.parseFloat(mobile.values[0].size));
  expect(Number.parseInt(mobile.placeholders[0].weight,10)).toBeLessThanOrEqual(500);
  expect(Number.parseFloat(mobile.values[0].size)).toBeGreaterThanOrEqual(16);
  expect(mobile.helper).toMatchObject({size:'12px',weight:'400',lineHeight:'16.8px'});
  expect(mobile.error).toMatchObject({size:'12px',weight:'700',lineHeight:'16.8px'});
  expect(mobile.cardOverflow).toBeLessThanOrEqual(1);
  expect(mobile.pageOverflow).toBeLessThanOrEqual(1);

  const owner=card.locator('[data-field="ownerName"]').first();
  await owner.fill('Проверка мобильного сохранения');
  await owner.blur();
  await page.waitForFunction(async({id,value})=>(await getLocationData(id)).ownerName===value,{id,value:'Проверка мобильного сохранения'});
  await expect(owner).toHaveValue('Проверка мобильного сохранения');
});

test('three workflow accordions use one accessible non-emoji arrow and keep badges',async({page})=>{
  const card=await openPreparedCard(page,390,900);
  const result=await card.evaluate(node=>{
    const affected=[node.querySelector('.critical-deal-v430'),node.querySelector('.economy-v400'),node.querySelector('.launch-project-v400')];
    const correct=[...node.querySelectorAll(':scope .location-body > details')].filter(details=>{
      const title=details.querySelector(':scope > summary')?.textContent||'';
      return title.includes('Конкуренты и окружение')||title.includes('Фотографии по категориям')||title.includes('Совместная работа: задачи, комментарии и история');
    }).slice(0,2);
    const pseudo=details=>{
      const summary=details.querySelector(':scope > summary');
      const value=getComputedStyle(summary,'::before');
      return{content:value.content,borderLeftWidth:value.borderLeftWidth,borderLeftStyle:value.borderLeftStyle,borderLeftColor:value.borderLeftColor,transform:value.transform};
    };
    for(const details of affected)details.open=false;
    const closed=affected.map(pseudo);
    const titles=affected.map(details=>details.querySelector(':scope > summary').textContent.trim());
    const badges=[
      affected[0].querySelector('.critical-summary-badge-v430'),
      affected[1].querySelector('.economy-status-v400'),
      affected[2].querySelector('.launch-progress-label-v400'),
    ].map(element=>({text:element?.textContent.trim()||'',visible:Boolean(element&&getComputedStyle(element).display!=='none'&&element.getBoundingClientRect().width>0)}));
    for(const details of affected)details.open=true;
    const opened=affected.map(pseudo);
    return{
      missing:affected.map((value,index)=>value?null:index).filter(value=>value!==null),
      closed,opened,titles,badges,
      correctCount:correct.length,
      correctBefore:correct.map(details=>getComputedStyle(details.querySelector(':scope > summary'),'::before').content),
      overflow:document.documentElement.scrollWidth-window.innerWidth,
    };
  });

  expect(result.missing).toEqual([]);
  expect(result.correctCount).toBe(2);
  expect(result.titles.join(' ')).not.toMatch(/[▶⏵⏩⏯🔽🔼🔺🔻]/u);
  expect(new Set(result.closed.map(value=>JSON.stringify(value)))).toHaveLength(1);
  expect(result.closed[0]).toMatchObject({content:'""',borderLeftWidth:'8px',borderLeftStyle:'solid',transform:'none'});
  expect(result.opened.every(value=>value.transform!=='none')).toBe(true);
  expect(result.badges.every(value=>value.visible&&value.text.length>0)).toBe(true);
  expect(result.correctBefore.every(value=>value==='none')).toBe(true);
  expect(result.overflow).toBeLessThanOrEqual(1);
});

test('public report supports structured traffic and competitor lists',()=>{
  const source=read('report/traffic-competitors-v453.js');
  expect(source).toContain('trafficMeasurements');
  expect(source).toContain('data.competitors');
  expect(source).toContain('Ближайший прямой конкурент');
});
