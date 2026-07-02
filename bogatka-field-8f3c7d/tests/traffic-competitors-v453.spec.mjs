import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=453';
const REPORT='http://127.0.0.1:4173/bogatka-field-8f3c7d/report/index.html?token=test-v453';

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaTrafficCompetitorsV453?.ready&&document.querySelector('[data-location-card]')),{timeout:30000});
  await page.evaluate(()=>window.BogatkaTrafficCompetitorsV453.enhanceAll());
  await page.waitForFunction(()=>window.BogatkaTrafficCompetitorsV453.audit().ok,{timeout:30000});
  return page.locator('[data-location-card]').first();
}

async function openSection(card,title){
  await card.evaluate((node,text)=>{
    const details=[...node.querySelectorAll('details')].find(item=>item.querySelector('summary')?.textContent.includes(text));
    if(details)details.open=true;
  },title);
}

async function waitArrayValue(page,locationId,collection,index,field,value){
  await page.waitForFunction(async({locationId,collection,index,field,value})=>{
    const data=await getLocationData(locationId);
    return String(data?.[collection]?.[index]?.[field]??'')===String(value);
  },{locationId,collection,index,field,value},{timeout:15000});
}

async function fillArray(page,control,locationId,collection,index,field,value){
  await control.fill(value);
  await control.blur();
  await waitArrayValue(page,locationId,collection,index,field,value);
}

async function chooseArray(page,control,locationId,collection,index,field,value){
  await control.selectOption(value);
  await waitArrayValue(page,locationId,collection,index,field,value);
}

test('multiple traffic measurements persist and legacy traffic stays stored',async({page})=>{
  let card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await page.evaluate(async locationId=>{
    const data=await getLocationData(locationId);
    data.traffic={...(data.traffic||{}),weekdayMorning:'77',dogWalkers:'4'};
    delete data.trafficMeasurements;
    await idbPut(STORE,data,`location:${locationId}`);
    renderLocations();
  },id);
  await page.waitForFunction(()=>window.BogatkaTrafficCompetitorsV453.audit().ok);
  card=page.locator(`[data-location-card="${id}"]`);
  await openSection(card,'Полевой замер трафика');
  await expect(card.locator('.legacy-traffic-v453')).toContainText('77');

  await card.locator('[data-stage7-action="add-traffic"]').click();
  const first=card.locator('.traffic-measurement-v453').first();
  await fillArray(page,first.locator('[data-stage7-field="date"]'),id,'trafficMeasurements',0,'date','2026-07-02');
  await fillArray(page,first.locator('[data-stage7-field="peopleCount"]'),id,'trafficMeasurements',0,'peopleCount','42');
  await fillArray(page,first.locator('[data-stage7-field="weather"]'),id,'trafficMeasurements',0,'weather','Облачно');

  await card.locator('[data-stage7-action="add-traffic"]').click();
  const second=card.locator('.traffic-measurement-v453').nth(1);
  await fillArray(page,second.locator('[data-stage7-field="peopleCount"]'),id,'trafficMeasurements',1,'peopleCount','31');

  const stored=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(stored.traffic).toMatchObject({weekdayMorning:'77',dogWalkers:'4'});
  expect(stored.trafficMeasurements).toHaveLength(2);
  expect(stored.trafficMeasurements[0]).toMatchObject({date:'2026-07-02',peopleCount:'42',weather:'Облачно'});
  expect(stored.trafficMeasurements[1].peopleCount).toBe('31');
});

test('legacy first competitor remains and extra competitors use a separate list',async({page})=>{
  let card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await page.evaluate(async locationId=>{
    const data=await getLocationData(locationId);
    data.competitor={name:'Старый конкурент',distance:'350 м',strengths:'Известный магазин',weaknesses:'Маленький склад'};
    delete data.competitors;
    await idbPut(STORE,data,`location:${locationId}`);
    renderLocations();
  },id);
  await page.waitForFunction(()=>window.BogatkaTrafficCompetitorsV453.audit().ok);
  card=page.locator(`[data-location-card="${id}"]`);
  await openSection(card,'Конкуренты и окружение');

  const legacy=card.locator('.competitor-card-v453[data-competitor-legacy="1"]');
  await expect(legacy.locator('[data-stage7-field="name"]')).toHaveValue('Старый конкурент');
  const legacyFlow=legacy.locator('[data-stage7-field="flow"]');
  await legacyFlow.fill('8–12 покупателей в час');
  await legacyFlow.blur();
  await page.waitForFunction(async locationId=>(await getLocationData(locationId))?.competitor?.flow==='8–12 покупателей в час',id);

  await card.locator('[data-stage7-action="add-competitor"]').click();
  const extra=card.locator('.competitor-card-v453[data-competitor-legacy="0"]').first();
  await fillArray(page,extra.locator('[data-stage7-field="name"]'),id,'competitors',0,'name','Маркетплейс рядом');
  await chooseArray(page,extra.locator('[data-stage7-field="type"]'),id,'competitors',0,'type','Пункт выдачи / маркетплейс');
  await fillArray(page,extra.locator('[data-stage7-field="distance"]'),id,'competitors',0,'distance','2 минуты');

  const stored=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(stored.competitor).toMatchObject({name:'Старый конкурент',distance:'350 м',flow:'8–12 покупателей в час'});
  expect(stored.competitors).toHaveLength(1);
  expect(stored.competitors[0]).toMatchObject({name:'Маркетплейс рядом',type:'Пункт выдачи / маркетплейс',distance:'2 минуты'});
});

test('viewer cannot edit stage 7 controls',async({page})=>{
  const card=await openApp(page);
  await openSection(card,'Полевой замер трафика');
  await openSection(card,'Конкуренты и окружение');
  await card.locator('[data-stage7-action="add-traffic"]').click();
  await page.evaluate(()=>{
    cloudRole='viewer';
    window.cloudRole='viewer';
    window.BogatkaTrafficCompetitorsV453.applyViewerState(document);
  });
  for(const control of await card.locator('.traffic-stage7-v453 input,.traffic-stage7-v453 select,.traffic-stage7-v453 textarea,.competitors-stage7-v453 input,.competitors-stage7-v453 select,.competitors-stage7-v453 textarea').all())await expect(control).toBeDisabled();
  await expect(card.locator('[data-stage7-action="add-traffic"]')).toBeHidden();
  await expect(card.locator('[data-stage7-action="add-competitor"]')).toBeHidden();
});

test('live and public reports contain structured stage 7 data',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await openSection(card,'Полевой замер трафика');
  await openSection(card,'Конкуренты и окружение');
  await card.locator('[data-stage7-action="add-traffic"]').click();
  await fillArray(page,card.locator('.traffic-measurement-v453').first().locator('[data-stage7-field="peopleCount"]'),id,'trafficMeasurements',0,'peopleCount','55');
  const legacyName=card.locator('.competitor-card-v453[data-competitor-legacy="1"] [data-stage7-field="name"]');
  await legacyName.fill('Зоомагазин для отчёта');
  await legacyName.blur();
  await page.waitForFunction(async locationId=>(await getLocationData(locationId))?.competitor?.name==='Зоомагазин для отчёта',id);

  const html=await page.evaluate(()=>window.BogatkaLiveReport.build());
  expect(html).toContain('55');
  expect(html).toContain('Зоомагазин для отчёта');

  await page.route('**/bogatka-public-report?*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({name:'Тест',snapshot:{locations:[],photos:[]}})}));
  await page.goto(REPORT,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.BogatkaPublicTrafficCompetitorsV453?.ready,{timeout:30000});
  const result=await page.evaluate(()=>({
    traffic:window.BogatkaPublicTrafficCompetitorsV453.trafficHtml({trafficMeasurements:[{peopleCount:'55',durationMinutes:'30',weather:'Дождь'}]}),
    competitors:window.BogatkaPublicTrafficCompetitorsV453.competitorsHtml({competitor:{name:'Зоомагазин для отчёта'}}),
  }));
  expect(result.traffic).toContain('55');
  expect(result.traffic).toContain('30 минут');
  expect(result.competitors).toContain('Зоомагазин для отчёта');
});

test('stage 7 assets load and are cached',async({page})=>{
  await openApp(page);
  const integration=await page.evaluate(async()=>{
    const scripts=[...document.scripts].map(node=>node.getAttribute('src')||'');
    const styles=[...document.querySelectorAll('link[rel="stylesheet"]')].map(node=>node.getAttribute('href')||'');
    const worker=await fetch('./sw-v340.js').then(response=>response.text());
    return{
      script:scripts.some(src=>src.includes('traffic-competitors-v453.js')),
      css:styles.some(href=>href.includes('traffic-competitors-v453.css')),
      cachedScript:worker.includes('./traffic-competitors-v453.js'),
      cachedCss:worker.includes('./traffic-competitors-v453.css'),
      cachedPublic:worker.includes('./report/traffic-competitors-v453.js'),
    };
  });
  expect(integration).toEqual({script:true,css:true,cachedScript:true,cachedCss:true,cachedPublic:true});
});
