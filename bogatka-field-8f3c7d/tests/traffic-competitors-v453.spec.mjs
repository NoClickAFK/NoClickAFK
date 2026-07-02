import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=453';
const REPORT='http://127.0.0.1:4173/bogatka-field-8f3c7d/report/index.html?token=test-v453';

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaTrafficCompetitorsV453?.ready&&document.querySelector('[data-location-card] .traffic-stage7-v453')&&document.querySelector('[data-location-card] .competitors-stage7-v453')),{timeout:30000});
  await page.evaluate(()=>window.BogatkaTrafficCompetitorsV453.enhanceAll());
  await page.waitForFunction(()=>window.BogatkaTrafficCompetitorsV453.audit().ok,{timeout:30000});
  return page.locator('[data-location-card]').first();
}

async function openSection(card,title){
  await card.evaluate((node,text)=>{const details=[...node.querySelectorAll('details')].find(item=>item.querySelector('summary')?.textContent.includes(text));if(details)details.open=true},title);
}

async function fillAndWait(page,control,locationId,predicate,value){
  await control.fill(value);
  await control.blur();
  await page.waitForFunction(async({locationId,predicate,value})=>{
    const data=await getLocationData(locationId);
    if(predicate.type==='legacy')return String(getNested(data,predicate.field)??'')===String(value);
    const rows=Array.isArray(data[predicate.collection])?data[predicate.collection]:[];
    return String(rows[predicate.index]?.[predicate.field]??'')===String(value);
  },{locationId,predicate,value});
}

async function chooseAndWait(page,control,locationId,predicate,value){
  await control.evaluate((select,next)=>{select.value=next;select.dispatchEvent(new Event('change',{bubbles:true}))},value);
  await page.waitForFunction(async({locationId,predicate,value})=>{
    const data=await getLocationData(locationId);
    const rows=Array.isArray(data[predicate.collection])?data[predicate.collection]:[];
    return String(rows[predicate.index]?.[predicate.field]??'')===String(value);
  },{locationId,predicate,value});
}

test('multiple traffic measurements persist while legacy traffic remains untouched',async({page})=>{
  let card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await page.evaluate(async locationId=>{const data=await getLocationData(locationId);data.traffic={...(data.traffic||{}),weekdayMorning:'77',dogWalkers:'4'};delete data.trafficMeasurements;await idbPut(STORE,data,`location:${locationId}`);renderLocations()},id);
  await page.waitForFunction(()=>window.BogatkaTrafficCompetitorsV453?.audit().ok);
  card=page.locator(`[data-location-card="${id}"]`);
  await openSection(card,'Полевой замер трафика');
  await expect(card.locator('.legacy-traffic-v453')).toContainText('77');
  await card.locator('[data-stage7-action="add-traffic"]').click();
  const first=card.locator('.traffic-measurement-v453').first();
  await fillAndWait(page,first.locator('[data-stage7-field="date"]'),id,{collection:'trafficMeasurements',index:0,field:'date'},'2026-07-02');
  await fillAndWait(page,first.locator('[data-stage7-field="peopleCount"]'),id,{collection:'trafficMeasurements',index:0,field:'peopleCount'},'42');
  await fillAndWait(page,first.locator('[data-stage7-field="weather"]'),id,{collection:'trafficMeasurements',index:0,field:'weather'},'Облачно');
  await card.locator('[data-stage7-action="add-traffic"]').click();
  const second=card.locator('.traffic-measurement-v453').nth(1);
  await fillAndWait(page,second.locator('[data-stage7-field="peopleCount"]'),id,{collection:'trafficMeasurements',index:1,field:'peopleCount'},'31');
  const stored=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(stored.traffic).toMatchObject({weekdayMorning:'77',dogWalkers:'4'});
  expect(stored.trafficMeasurements).toHaveLength(2);
  expect(stored.trafficMeasurements[0]).toMatchObject({date:'2026-07-02',peopleCount:'42',weather:'Облачно'});
  expect(stored.trafficMeasurements[1].peopleCount).toBe('31');
});

test('legacy first competitor is preserved and additional competitors use a separate list',async({page})=>{
  let card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await page.evaluate(async locationId=>{const data=await getLocationData(locationId);data.competitor={name:'Старый конкурент',distance:'350 м',strengths:'Известный магазин',weaknesses:'Маленький склад'};delete data.competitors;await idbPut(STORE,data,`location:${locationId}`);renderLocations()},id);
  await page.waitForFunction(()=>window.BogatkaTrafficCompetitorsV453?.audit().ok);
  card=page.locator(`[data-location-card="${id}"]`);
  await openSection(card,'Конкуренты и окружение');
  const legacy=card.locator('.competitor-card-v453[data-competitor-legacy="1"]');
  await expect(legacy.locator('[data-stage7-field="name"]')).toHaveValue('Старый конкурент');
  await fillAndWait(page,legacy.locator('[data-stage7-field="flow"]'),id,{type:'legacy',field:'competitor.flow'},'8–12 покупателей в час');
  await card.locator('[data-stage7-action="add-competitor"]').click();
  const extra=card.locator('.competitor-card-v453[data-competitor-legacy="0"]').first();
  await fillAndWait(page,extra.locator('[data-stage7-field="name"]'),id,{collection:'competitors',index:0,field:'name'},'Маркетплейс рядом');
  await chooseAndWait(page,extra.locator('[data-stage7-field="type"]'),id,{collection:'competitors',index:0,field:'type'},'Пункт выдачи / маркетплейс');
  await fillAndWait(page,extra.locator('[data-stage7-field="distance"]'),id,{collection:'competitors',index:0,field:'distance'},'2 минуты');
  const stored=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(stored.competitor).toMatchObject({name:'Старый конкурент',distance:'350 м',flow:'8–12 покупателей в час'});
  expect(stored.competitors).toHaveLength(1);
  expect(stored.competitors[0]).toMatchObject({name:'Маркетплейс рядом',type:'Пункт выдачи / маркетплейс',distance:'2 минуты'});
});

test('viewer cannot edit traffic measurements or competitor cards',async({page})=>{
  const card=await openApp(page);
  await openSection(card,'Полевой замер трафика');
  await openSection(card,'Конкуренты и окружение');
  await card.locator('[data-stage7-action="add-traffic"]').click();
  await page.evaluate(()=>{cloudRole='viewer';window.BogatkaTrafficCompetitorsV453.applyViewerState(document)});
  for(const control of await card.locator('.traffic-stage7-v453 input,.traffic-stage7-v453 select,.traffic-stage7-v453 textarea,.competitors-stage7-v453 input,.competitors-stage7-v453 select,.competitors-stage7-v453 textarea').all())await expect(control).toBeDisabled();
  await expect(card.locator('[data-stage7-action="add-traffic"]')).toBeHidden();
  await expect(card.locator('[data-stage7-action="add-competitor"]')).toBeHidden();
});

test('live and public reports include structured traffic and competitors',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await openSection(card,'Полевой замер трафика');
  await openSection(card,'Конкуренты и окружение');
  await card.locator('[data-stage7-action="add-traffic"]').click();
  await fillAndWait(page,card.locator('.traffic-measurement-v453').first().locator('[data-stage7-field="peopleCount"]'),id,{collection:'trafficMeasurements',index:0,field:'peopleCount'},'55');
  await fillAndWait(page,card.locator('.competitor-card-v453[data-competitor-legacy="1"] [data-stage7-field="name"]'),id,{type:'legacy',field:'competitor.name'},'Зоомагазин для отчёта');
  const html=await page.evaluate(()=>window.BogatkaLiveReport.build());
  expect(html).toContain('55');
  expect(html).toContain('Зоомагазин для отчёта');
  await page.route('**/bogatka-public-report?*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({name:'Тест',snapshot:{locations:[],photos:[]}})}));
  await page.goto(REPORT,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.BogatkaPublicTrafficCompetitorsV453?.ready);
  const result=await page.evaluate(()=>({traffic:window.BogatkaPublicTrafficCompetitorsV453.trafficHtml({trafficMeasurements:[{peopleCount:'55',durationMinutes:'30',weather:'Дождь'}]}),competitors:window.BogatkaPublicTrafficCompetitorsV453.competitorsHtml({competitor:{name:'Зоомагазин для отчёта'}})}));
  expect(result.traffic).toContain('55');
  expect(result.traffic).toContain('30 минут');
  expect(result.competitors).toContain('Зоомагазин для отчёта');
});

test('v453 assets load after v452 and are cached',async({page})=>{
  await openApp(page);
  const integration=await page.evaluate(async()=>{const scripts=[...document.scripts].map(x=>x.getAttribute('src')||''),styles=[...document.querySelectorAll('link[rel="stylesheet"]')].map(x=>x.getAttribute('href')||''),worker=await fetch('./sw-v340.js').then(r=>r.text());return{stage6:scripts.findIndex(x=>x.includes('location-data-stability-v452.js')),stage7:scripts.findIndex(x=>x.includes('traffic-competitors-v453.js')),css:styles.some(x=>x.includes('traffic-competitors-v453.css')),cachedJs:worker.includes('./traffic-competitors-v453.js'),cachedCss:worker.includes('./traffic-competitors-v453.css'),cachedPublic:worker.includes('./report/traffic-competitors-v453.js')}});
  expect(integration.stage7).toBeGreaterThan(integration.stage6);
  expect(integration.css).toBe(true);
  expect(integration.cachedJs).toBe(true);
  expect(integration.cachedCss).toBe(true);
  expect(integration.cachedPublic).toBe(true);
});
