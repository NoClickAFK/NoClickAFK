import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=454';

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaLaunchGateV454?.ready&&window.BogatkaTrafficCompetitorsV453?.ready&&document.querySelector('[data-location-card]')),{timeout:30000});
  await page.evaluate(async()=>{await window.BogatkaTrafficCompetitorsV453.enhanceAll();await window.BogatkaLaunchGateV454.renderAll();});
  await page.waitForFunction(()=>window.BogatkaLaunchGateV454.audit().ok,{timeout:30000});
  return page.locator('[data-location-card]').first();
}

async function resetLocation(page,id,patch={}){
  await page.evaluate(async({id,patch})=>{
    const data=await getLocationData(id);
    Object.assign(data,patch);
    if(Object.hasOwn(patch,'launchProject')&&patch.launchProject===null)delete data.launchProject;
    data.updatedAt=new Date().toISOString();
    await idbPut(STORE,data,`location:${id}`);
    renderLocations();
  },{id,patch});
  await page.waitForFunction(()=>window.BogatkaLaunchGateV454?.audit().ok);
}

async function setConfirmedChecks(page,id,{keepProject=true}={}){
  await page.evaluate(async({locationId,keepProject})=>{
    const data=await getLocationData(locationId);
    data.decision='Оставить';
    data.decisionReason='Локация выбрана для запуска';
    data.criticalDealConditions=Object.fromEntries(window.BogatkaCriticalDeal.CONDITIONS.map(definition=>{
      const evidence=definition.evidenceTypes.find(option=>!['not_confirmed','oral_agreement'].includes(option.value))?.value||'other';
      return[definition.key,{status:'confirmed',evidenceType:evidence,note:evidence==='other'?'Подтверждено документом':'',updatedAt:new Date().toISOString(),updatedBy:'test'}];
    }));
    if(!keepProject)delete data.launchProject;
    data.updatedAt=new Date().toISOString();
    await idbPut(STORE,data,`location:${locationId}`);
    renderLocations();
  },{locationId:id,keepProject});
  await page.waitForFunction(()=>window.BogatkaLaunchGateV454?.audit().ok);
}

async function openLaunchDetails(page,id){
  await expect.poll(async()=>page.evaluate(async locationId=>{
    await window.BogatkaLaunchGateV454.renderAll();
    const card=document.querySelector(`[data-location-card="${CSS.escape(locationId)}"]`);
    window.BogatkaLocationCardCollapseV422?.setCollapsed?.(card,false,{persist:true});
    const details=card?.querySelector('[data-launch-details]');
    if(!details)return false;
    details.open=true;
    await new Promise(resolve=>setTimeout(resolve,120));
    const current=document.querySelector(`[data-location-card="${CSS.escape(locationId)}"] [data-launch-details]`);
    return Boolean(current===details&&current.open&&current.querySelector('.launch-gate-overlay-v454'));
  },id),{timeout:15000}).toBe(true);
  return page.locator(`[data-location-card="${id}"] [data-launch-details]`);
}

async function activateCurrentLaunchAction(page,id){
  await page.evaluate(async locationId=>{
    await window.BogatkaLaunchGateV454.renderAll();
    const card=document.querySelector(`[data-location-card="${CSS.escape(locationId)}"]`);
    window.BogatkaLocationCardCollapseV422?.setCollapsed?.(card,false,{persist:true});
    const details=card?.querySelector('[data-launch-details]');
    if(!details)throw new Error('Launch details are missing');
    details.open=true;
    const button=details.querySelector('[data-launch-activate-v454]');
    if(!button||button.disabled)throw new Error('Launch action is unavailable');
    button.click();
  },id);
}

test('status or decision never creates an opening project automatically',async({page})=>{
  let card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await resetLocation(page,id,{decision:'',status:'Кандидат',launchProject:null});
  card=page.locator(`[data-location-card="${id}"]`);
  await card.locator('[data-field="decision"][value="Оставить"]').check();
  await page.waitForFunction(async locationId=>(await getLocationData(locationId)).decision==='Оставить'&&window.BogatkaLaunchGateV454.pendingWrites===0,id);
  const stored=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(stored.launchProject?.enabled).not.toBe(true);
});

test('ineligible existing project is hidden without losing its DOM or data',async({page})=>{
  let card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await resetLocation(page,id,{decision:'Под вопросом',launchProject:{enabled:true,stage:'Ремонт',targetDate:'',manager:'',budget:'',notes:'',milestones:[{id:'legacy',title:'Существующий этап',status:'doing',assignee:'Иван',dueDate:'2026-08-01',order:0}]}});
  card=page.locator(`[data-location-card="${id}"]`);
  await page.evaluate(()=>window.BogatkaLaunchGateV454.renderAll());
  const details=card.locator('[data-launch-details]');
  const body=details.locator('.details-body');
  await expect(details).toHaveAttribute('data-launch-gate-v454','decision');
  await expect(body).toBeHidden();
  expect(await body.innerHTML()).toContain('Существующий этап');

  await setConfirmedChecks(page,id,{keepProject:true});
  card=page.locator(`[data-location-card="${id}"]`);
  await page.evaluate(()=>window.BogatkaLaunchGateV454.renderAll());
  const restored=card.locator('[data-launch-details]');
  await expect(restored).toHaveAttribute('data-launch-gate-v454','ready');
  await expect(restored.locator('.launch-gate-overlay-v454')).toHaveCount(0);
  await expect(restored.locator('.details-body')).toContainText('Существующий этап');
  const stored=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(stored.launchProject.milestones[0]).toMatchObject({id:'legacy',title:'Существующий этап',status:'doing',assignee:'Иван'});
});

test('keep decision still requires every pre-lease check',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await resetLocation(page,id,{decision:'Оставить',criticalDealConditions:{},launchProject:null});
  await page.evaluate(()=>window.BogatkaLaunchGateV454.renderAll());
  const details=await openLaunchDetails(page,id);
  await expect(details).toHaveAttribute('data-launch-gate-v454','checks');
  await expect(details.locator('[data-open-deal-checks-v454]')).toBeVisible();
  await expect(details.locator('[data-launch-activate-v454]')).toHaveCount(0);
});

test('eligible location activates opening project only by explicit action',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await setConfirmedChecks(page,id,{keepProject:false});
  await page.evaluate(()=>window.BogatkaLaunchGateV454.renderAll());
  const details=await openLaunchDetails(page,id);
  await expect(details).toHaveAttribute('data-launch-gate-v454','ready');
  await activateCurrentLaunchAction(page,id);
  await page.waitForFunction(async locationId=>(await getLocationData(locationId)).launchProject?.enabled===true&&window.BogatkaLaunchGateV454.pendingWrites===0,id);
  const stored=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(stored.decision).toBe('Оставить');
  expect(stored.launchProject.milestones.length).toBeGreaterThan(0);
});

test('viewer cannot activate an eligible opening project',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await setConfirmedChecks(page,id,{keepProject:false});
  await page.evaluate(async()=>{cloudRole='viewer';window.cloudRole='viewer';await window.BogatkaLaunchGateV454.renderAll();});
  const details=await openLaunchDetails(page,id);
  await expect(details.locator('[data-launch-activate-v454]')).toBeDisabled();
  const stored=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(stored.launchProject?.enabled).not.toBe(true);
});

test('reports hide a launch project when the gate is not passed',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await resetLocation(page,id,{decision:'Исключить',launchProject:{enabled:true,stage:'Ремонт',milestones:[{id:'legacy-report',title:'НЕ ПОКАЗЫВАТЬ В ОТЧЁТЕ',status:'doing',order:0}]}});
  await page.waitForFunction(()=>Boolean(window.BogatkaLiveReport?.build?.__launchGateV454),null,{timeout:30000});
  const html=await page.evaluate(()=>window.BogatkaLiveReport.build());
  expect(html).not.toContain('НЕ ПОКАЗЫВАТЬ В ОТЧЁТЕ');
});
