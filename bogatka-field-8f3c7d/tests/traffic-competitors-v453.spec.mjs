import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=453';
const REPORT='http://127.0.0.1:4173/bogatka-field-8f3c7d/report/index.html?token=test-v453';

async function editor(page){await page.evaluate(()=>{try{cloudRole=null}catch(_){ }window.cloudRole=null;window.BogatkaTrafficCompetitorsV453?.applyViewerState?.(document);});}

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaTrafficCompetitorsV453?.ready&&window.BogatkaTrafficCompetitorsPersistenceV453?.ready&&window.BogatkaTrafficCompetitorsCompatV453?.ready&&document.querySelector('[data-location-card]')),{timeout:30000});
  await editor(page);await page.evaluate(()=>window.BogatkaTrafficCompetitorsV453.enhanceAll());
  await page.waitForFunction(()=>window.BogatkaTrafficCompetitorsV453.audit().ok,{timeout:30000});
  return page.locator('[data-location-card]').first();
}

async function reveal(card,title){
  await card.evaluate((node,text)=>{
    window.BogatkaLocationCardCollapseV422?.setCollapsed?.(node,false,{persist:true});
    const details=[...node.querySelectorAll('details')].find(item=>item.querySelector(':scope > summary')?.textContent.includes(text));
    if(!details)return;
    details.open=true;
    for(let current=details;current&&current!==node;current=current.parentElement){
      if(current.tagName==='DETAILS')current.open=true;
      current.hidden=false;
      current.classList.remove('hidden','panel-closed-v419','collapsed');
      if(current.dataset?.panelOpenV419!==undefined)current.dataset.panelOpenV419='1';
    }
    window.BogatkaTrafficCompetitorsCompatV453?.openAncestors?.(details);
  },title);
}

async function openSection(page,card,title){await reveal(card,title);await editor(page);await page.waitForTimeout(160);await reveal(card,title);await editor(page);}
async function waitValue(page,id,list,index,field,value){await page.waitForFunction(async({id,list,index,field,value})=>String((await getLocationData(id))?.[list]?.[index]?.[field]??'')===String(value),{id,list,index,field,value},{timeout:15000});await page.waitForFunction(()=>window.BogatkaTrafficCompetitorsPersistenceV453.pendingWrites===0,{timeout:15000});}
async function fill(page,control,id,list,index,field,value){await control.fill(value);await control.blur();await waitValue(page,id,list,index,field,value);}
async function choose(page,control,id,list,index,field,value){await control.selectOption(value);await waitValue(page,id,list,index,field,value);}
async function seed(page,id,patch){await page.evaluate(async({id,patch})=>{const data=await getLocationData(id);Object.assign(data,patch);await idbPut(STORE,data,`location:${id}`);renderLocations();},{id,patch});await page.waitForFunction(()=>window.BogatkaTrafficCompetitorsV453.audit().ok);await editor(page);}

test('multiple traffic measurements persist and legacy traffic stays stored',async({page})=>{
  let card=await openApp(page);const id=await card.getAttribute('data-location-card');await seed(page,id,{traffic:{weekdayMorning:'77',dogWalkers:'4'},trafficMeasurements:[]});
  card=page.locator(`[data-location-card="${id}"]`);await openSection(page,card,'Полевой замер трафика');await expect(card.locator('.legacy-traffic-v453')).toContainText('77');
  const add=card.locator('[data-stage7-action="add-traffic"]');await expect(add).toBeVisible();await add.click();
  const first=card.locator('.traffic-measurement-v453').first();await fill(page,first.locator('[data-stage7-field="date"]'),id,'trafficMeasurements',0,'date','2026-07-02');await fill(page,first.locator('[data-stage7-field="peopleCount"]'),id,'trafficMeasurements',0,'peopleCount','42');await fill(page,first.locator('[data-stage7-field="weather"]'),id,'trafficMeasurements',0,'weather','Облачно');
  await add.click();await fill(page,card.locator('.traffic-measurement-v453').nth(1).locator('[data-stage7-field="peopleCount"]'),id,'trafficMeasurements',1,'peopleCount','31');
  const stored=await page.evaluate(locationId=>getLocationData(locationId),id);expect(stored.traffic).toMatchObject({weekdayMorning:'77',dogWalkers:'4'});expect(stored.trafficMeasurements).toHaveLength(2);
});

test('legacy competitor remains and extra competitors persist separately',async({page})=>{
  let card=await openApp(page);const id=await card.getAttribute('data-location-card');await seed(page,id,{competitor:{name:'Старый конкурент',distance:'350 м'},competitors:[]});
  card=page.locator(`[data-location-card="${id}"]`);await openSection(page,card,'Конкуренты и окружение');
  const legacy=card.locator('.competitor-card-v453[data-competitor-legacy="1"]');await expect(legacy.locator('[data-stage7-field="name"]')).toHaveValue('Старый конкурент');await expect(legacy.locator('[data-stage7-field="flow"]')).toBeVisible();
  await legacy.locator('[data-stage7-field="flow"]').fill('8–12 покупателей в час');await legacy.locator('[data-stage7-field="flow"]').blur();await page.waitForFunction(async locationId=>(await getLocationData(locationId))?.competitor?.flow==='8–12 покупателей в час',id);
  await card.locator('[data-stage7-action="add-competitor"]').click();const extra=card.locator('.competitor-card-v453[data-competitor-legacy="0"]').first();await fill(page,extra.locator('[data-stage7-field="name"]'),id,'competitors',0,'name','Маркетплейс рядом');await choose(page,extra.locator('[data-stage7-field="type"]'),id,'competitors',0,'type','Пункт выдачи / маркетплейс');
  expect((await page.evaluate(locationId=>getLocationData(locationId),id)).competitors[0].name).toBe('Маркетплейс рядом');
});

test('viewer cannot edit stage 7 controls',async({page})=>{const card=await openApp(page);await openSection(page,card,'Полевой замер трафика');await card.locator('[data-stage7-action="add-traffic"]').click();await page.evaluate(()=>{cloudRole='viewer';window.cloudRole='viewer';window.BogatkaTrafficCompetitorsV453.applyViewerState(document);});for(const control of await card.locator('.traffic-stage7-v453 input,.traffic-stage7-v453 select,.traffic-stage7-v453 textarea').all())await expect(control).toBeDisabled();await expect(card.locator('[data-stage7-action="add-traffic"]')).toBeHidden();});

test('live and public reports contain structured stage 7 data',async({page,context})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await openSection(page,card,'Полевой замер трафика');
  await card.locator('[data-stage7-action="add-traffic"]').click();
  await fill(page,card.locator('.traffic-measurement-v453').first().locator('[data-stage7-field="peopleCount"]'),id,'trafficMeasurements',0,'peopleCount','55');
  expect(await page.evaluate(()=>window.BogatkaLiveReport.build())).toContain('55');

  const reportPage=await context.newPage();
  await reportPage.route('**/bogatka-public-report?*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({name:'Тест',snapshot:{locations:[],photos:[]}})}));
  await reportPage.goto(REPORT,{waitUntil:'domcontentloaded'});
  await reportPage.waitForFunction(()=>window.BogatkaPublicTrafficCompetitorsV453?.ready,{timeout:30000});
  expect(await reportPage.evaluate(()=>window.BogatkaPublicTrafficCompetitorsV453.trafficHtml({trafficMeasurements:[{peopleCount:'55'}]}))).toContain('55');
  await reportPage.close();
});

test('stage 7 assets load and are cached',async({page})=>{await openApp(page);const worker=await page.evaluate(()=>fetch('./sw-v340.js').then(response=>response.text()));expect(worker).toContain('./traffic-competitors-v453.js');expect(worker).toContain('./report/traffic-competitors-v453.js');});