import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=434';
const REPORT='http://127.0.0.1:4173/bogatka-field-8f3c7d/report/index.html?token=test-v452';

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaLocationDataV452?.ready&&
    window.BogatkaLocationDataStabilityV452?.ready&&
    window.BogatkaQuickChecklistV451?.ready&&
    window.BogatkaReadinessProgressV434?.ready&&
    document.querySelector('[data-location-card]')
  ),{timeout:30000});
  await page.evaluate(()=>window.BogatkaLocationDataStabilityV452.stabilize());
  await page.waitForFunction(()=>Boolean(
    window.BogatkaDecisionEngine?.computeAll?.__readinessProgressV434&&
    document.querySelector('[data-location-card] [data-field="objectSource"]')&&
    document.querySelector('[data-location-card] [data-field="tech.requiredPowerKw"]')&&
    document.querySelector('[data-location-card] [data-field="decisionReason"]')
  ),{timeout:30000});
  const card=page.locator('[data-location-card]').first();
  await card.evaluate(node=>window.BogatkaLocationCardCollapseV422?.setCollapsed?.(node,false,{persist:false}));
  return card;
}

async function waitSaved(page,locationId,field,value){
  await page.waitForFunction(async ({locationId,field,value})=>{
    const pending=window.BogatkaFieldIntegrityV416?.pendingLocations||[];
    if(pending.includes(locationId))return false;
    const data=await getLocationData(locationId);
    return getNested(data,field)===value;
  },{locationId,field,value});
}

async function fillAndWait(page,control,locationId,field,value){
  await control.fill(value);
  await control.blur();
  await waitSaved(page,locationId,field,value);
}

async function selectAndWait(page,control,locationId,field,value){
  await control.evaluate((select,next)=>{
    select.value=next;
    select.dispatchEvent(new Event('change',{bubbles:true}));
  },value);
  await waitSaved(page,locationId,field,value);
}

async function openSection(card,title){
  await card.evaluate((node,text)=>{
    const details=[...node.querySelectorAll('details')].find(item=>item.querySelector('summary')?.textContent.includes(text));
    if(details)details.open=true;
  },title);
}

test('active checklist contains only factual checks and preserves hidden legacy values',async({page})=>{
  const card=await openApp(page);
  await page.evaluate(()=>window.BogatkaLocationDataV452.enhanceAll());
  await page.waitForFunction(()=>window.BogatkaLocationDataV452.audit().ok);
  const id=await card.getAttribute('data-location-card');
  const state=await page.evaluate(()=>({count:CHECKLIST.length,keys:CHECKLIST.map(item=>item[0]),waste:CHECKLIST.find(item=>item[0]==='waste_route')?.[1]}));
  expect(state.count).toBe(35);
  expect(state.keys).not.toEqual(expect.arrayContaining(['pet_owners','area_ok','layout_ok','power_ok']));
  expect(state.waste).toBe('Определены место и порядок вывоза упаковки и мусора');
  for(const key of ['pet_owners','area_ok','layout_ok','power_ok'])await expect(card.locator(`[data-field="check.${key}"]`)).toHaveCount(0);

  await page.evaluate(async locationId=>{
    const data=await getLocationData(locationId);
    data.check={...(data.check||{}),pet_owners:true,area_ok:'no',layout_ok:'not_applicable',power_ok:true};
    await idbPut(STORE,data,`location:${locationId}`);
    renderLocations();
  },id);
  await page.evaluate(()=>window.BogatkaLocationDataStabilityV452.stabilize());
  await page.waitForFunction(()=>window.BogatkaLocationDataV452.audit().ok);
  const stored=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(stored.check).toMatchObject({pet_owners:true,area_ok:'no',layout_ok:'not_applicable',power_ok:true});
  for(const key of ['pet_owners','area_ok','layout_ok','power_ok'])await expect(page.locator(`[data-location-card="${id}"] [data-field="check.${key}"]`)).toHaveCount(0);
});

test('source, listing and repeat-inspection basis persist without rerendering the card',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await card.evaluate(node=>node.dataset.identityV452='kept');
  const source=card.locator('[data-field="objectSource"]');
  await selectAndWait(page,source,id,'objectSource','Объявление');
  const listing=card.locator('[data-field="listingUrl"]');
  await expect(listing).toHaveAttribute('required','');
  await fillAndWait(page,listing,id,'listingUrl','example.com/object-17');
  await fillAndWait(page,card.locator('[data-field="inspectionPurpose"]'),id,'inspectionPurpose','Повторная проверка и замеры');
  await fillAndWait(page,card.locator('[data-field="inspectionParticipants"]'),id,'inspectionParticipants','Директор и инженер');
  await fillAndWait(page,card.locator('[data-field="inspectionResult"]'),id,'inspectionResult','Площадь подтверждена, нужен расчёт мощности');
  await expect(card.locator('.listing-link-v452')).toHaveAttribute('href','https://example.com/object-17');
  await expect(card).toHaveAttribute('data-identity-v452','kept');

  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(locationId=>window.BogatkaLocationDataV452?.ready&&document.querySelector(`[data-location-card="${CSS.escape(locationId)}"] [data-field="inspectionResult"]`)?.value.includes('Площадь'),id);
  const reloaded=page.locator(`[data-location-card="${id}"]`);
  await expect(reloaded.locator('[data-field="objectSource"]')).toHaveValue('Объявление');
  await expect(reloaded.locator('[data-field="listingUrl"]')).toHaveValue('example.com/object-17');
  await expect(reloaded.locator('[data-field="inspectionPurpose"]')).toHaveValue('Повторная проверка и замеры');
  await expect(reloaded.locator('[data-field="inspectionParticipants"]')).toHaveValue('Директор и инженер');
  await expect(reloaded.locator('[data-field="inspectionResult"]')).toHaveValue('Площадь подтверждена, нужен расчёт мощности');
});

test('required power is saved and reserve or deficit is calculated automatically',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await openSection(card,'Технические и финансовые параметры');
  const available=card.locator('[data-field="tech.powerKw"]');
  const required=card.locator('[data-field="tech.requiredPowerKw"]');
  await expect(available).toBeVisible();
  await fillAndWait(page,available,id,'tech.powerKw','15');
  await fillAndWait(page,required,id,'tech.requiredPowerKw','20');
  await expect(card.locator('[data-power-balance-v452]')).toHaveText('Дефицит 5 кВт');
  await expect(card.locator('.power-balance-v452')).toHaveAttribute('data-balance-state','deficit');
  await fillAndWait(page,available,id,'tech.powerKw','25');
  await expect(card.locator('[data-power-balance-v452]')).toHaveText('Запас 5 кВт');
  await expect(card.locator('.power-balance-v452')).toHaveAttribute('data-balance-state','reserve');
});

test('selected preliminary decision completes progress while reason remains optional',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  const decision=card.locator('input[type="radio"][data-field="decision"][value="Под вопросом"]');
  await decision.check();
  await waitSaved(page,id,'decision','Под вопросом');
  const reason=card.locator('[data-field="decisionReason"]');
  await expect(reason).not.toHaveAttribute('required','');
  await expect(reason).toHaveAttribute('aria-required','false');
  await expect(card.locator('.decision-reason-warning-v452')).toBeHidden();

  await page.waitForFunction(async locationId=>{
    const metric=(await window.BogatkaDecisionEngine.computeAll()).find(item=>item.id===locationId);
    const group=metric?.progressGroups?.find(item=>item.key==='conclusion');
    return metric?.data?.decision==='Под вопросом'&&group?.total===1&&group?.done===1&&group?.missingCount===0;
  },id);
  const before=await page.evaluate(async locationId=>(await window.BogatkaDecisionEngine.computeAll()).find(item=>item.id===locationId),id);
  expect(before.progressGroups.find(group=>group.key==='conclusion')).toMatchObject({total:1,done:1,missingCount:0,missingLabels:[]});

  await fillAndWait(page,reason,id,'decisionReason','Нужно согласовать меньшую арендную ставку');
  const stored=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(stored.decisionReason).toBe('Нужно согласовать меньшую арендную ставку');
  const after=await page.evaluate(async locationId=>(await window.BogatkaDecisionEngine.computeAll()).find(item=>item.id===locationId),id);
  expect(after.progressGroups.find(group=>group.key==='conclusion')).toMatchObject({total:1,done:1,missingCount:0,missingLabels:[]});
});

test('viewer cannot edit v452 fields and lease checks remain unchanged',async({page})=>{
  const card=await openApp(page);
  await page.evaluate(()=>{cloudRole='viewer';window.BogatkaLocationDataV452.applyViewerState(document)});
  for(const field of ['objectSource','listingUrl','inspectionPurpose','inspectionParticipants','inspectionResult','decisionReason','tech.requiredPowerKw'])await expect(card.locator(`[data-field="${field}"]`)).toBeDisabled();
  const lease=await page.evaluate(()=>({version:window.BogatkaCriticalDeal?.VERSION,count:window.BogatkaCriticalDeal?.CONDITIONS?.length}));
  expect(lease).toEqual({version:'4.3.3',count:10});
});

test('live HTML report contains v452 data and explicit checklist states',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await selectAndWait(page,card.locator('[data-field="objectSource"]'),id,'objectSource','Рекомендация');
  await fillAndWait(page,card.locator('[data-field="inspectionPurpose"]'),id,'inspectionPurpose','Проверка перед переговорами');
  await fillAndWait(page,card.locator('[data-field="inspectionResult"]'),id,'inspectionResult','Можно продолжать работу');
  await openSection(card,'Причина решения');
  await fillAndWait(page,card.locator('[data-field="decisionReason"]'),id,'decisionReason','Хороший вход и приемлемая аренда');
  await selectAndWait(page,card.locator('[data-field="check.housing_dense"]'),id,'check.housing_dense','no');
  await selectAndWait(page,card.locator('[data-field="check.housing_occupied"]'),id,'check.housing_occupied','not_applicable');

  const html=await page.evaluate(()=>window.BogatkaLiveReport.build());
  expect(html).toContain('Как нашли объект');
  expect(html).toContain('Рекомендация');
  expect(html).toContain('Проверка перед переговорами');
  expect(html).toContain('Можно продолжать работу');
  expect(html).toContain('Хороший вход и приемлемая аренда');
  expect(html).toContain('Нет');
  expect(html).toContain('Не требуется');
});

test('v452 assets are loaded and cached after stage 5',async({page})=>{
  await openApp(page);
  const integration=await page.evaluate(async()=>{
    const scripts=[...document.scripts].map(item=>item.getAttribute('src')||'');
    const styles=[...document.querySelectorAll('link[rel="stylesheet"]')].map(item=>item.getAttribute('href')||'');
    const worker=await fetch('./sw-v340.js').then(response=>response.text());
    return{stage5:scripts.findIndex(src=>src.includes('quick-checklist-report-v451.js')),stage6:scripts.findIndex(src=>src.includes('location-data-v452.js')),stability:scripts.findIndex(src=>src.includes('location-data-stability-v452.js')),readiness:scripts.findIndex(src=>src.includes('readiness-progress-v434.js')),css:styles.some(href=>href.includes('location-data-v452.css')),cachedJs:worker.includes('./location-data-v452.js'),cachedStability:worker.includes('./location-data-stability-v452.js'),cachedReadiness:worker.includes('./readiness-progress-v434.js'),cachedCss:worker.includes('./location-data-v452.css'),cachedPublic:worker.includes('./report/location-data-v452.js')};
  });
  expect(integration.stage6).toBeGreaterThan(integration.stage5);
  expect(integration.stability).toBeGreaterThan(integration.stage6);
  expect(integration.readiness).toBeGreaterThan(integration.stability);
  expect(integration.css).toBe(true);
  expect(integration.cachedJs).toBe(true);
  expect(integration.cachedStability).toBe(true);
  expect(integration.cachedReadiness).toBe(true);
  expect(integration.cachedCss).toBe(true);
  expect(integration.cachedPublic).toBe(true);
});

test('public report helper renders all four checklist states without removed subjective items',async({page})=>{
  await page.route('**/bogatka-public-report?*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({name:'Тест',snapshot:{locations:[],photos:[]}})}));
  await page.goto(REPORT,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.BogatkaPublicLocationDataV452?.ready);
  const result=await page.evaluate(()=>{
    const html=window.BogatkaPublicLocationDataV452.renderExplicitChecklist({check:{housing_dense:'yes',housing_occupied:'no',foot_traffic:'not_applicable'}});
    return{html,count:CHECKLIST.length,keys:CHECKLIST.map(item=>item[0])};
  });
  expect(result.count).toBe(35);
  expect(result.html).toContain('Да');
  expect(result.html).toContain('Нет');
  expect(result.html).toContain('Не требуется');
  expect(result.html).toContain('Не проверено');
  expect(result.keys).not.toContain('area_ok');
  expect(result.keys).not.toContain('layout_ok');
  expect(result.keys).not.toContain('power_ok');
  expect(result.keys).not.toContain('pet_owners');
});
