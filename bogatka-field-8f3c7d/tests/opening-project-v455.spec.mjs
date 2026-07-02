import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=455';

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaOpeningProjectV455?.ready&&window.BogatkaLaunchGateV454?.ready&&window.BogatkaSuite?.ensureLaunchProject?.__openingProjectV455),{timeout:30000});
  await page.evaluate(async()=>{await window.BogatkaLaunchGateV454.renderAll();await window.BogatkaOpeningProjectV455.renderAll();});
  return page.locator('[data-location-card]').first();
}

async function makeEligible(page,id,project){
  await page.evaluate(async({id,project})=>{
    const data=await getLocationData(id);
    data.decision='Оставить';
    data.decisionReason='Локация выбрана';
    data.criticalDealConditions=Object.fromEntries(window.BogatkaCriticalDeal.CONDITIONS.map(definition=>{
      const evidence=definition.evidenceTypes.find(option=>!['not_confirmed','oral_agreement'].includes(option.value))?.value||'other';
      return[definition.key,{status:'confirmed',evidenceType:evidence,note:evidence==='other'?'Подтверждено':'',updatedAt:new Date().toISOString(),updatedBy:'test'}];
    }));
    if(project===null)delete data.launchProject;else if(project)data.launchProject=project;
    data.updatedAt=new Date().toISOString();
    await idbPut(STORE,data,`location:${id}`);
    renderLocations();
  },{id,project});
  await page.waitForFunction(()=>window.BogatkaLaunchGateV454?.audit().ok);
}

async function openLaunch(card,{firstPhase=false}={}){
  const details=card.locator('[data-launch-details]');
  await details.evaluate(node=>{node.open=true;});
  await expect(details.locator('[data-launch-body]')).toBeVisible();
  if(firstPhase){
    const phase=card.locator('.launch-v455-phase').first();
    await phase.evaluate(node=>{node.open=true;});
    await expect(phase.locator('.launch-v455-phase-body')).toBeVisible();
  }
}

test('new opening project receives all seven phases',async({page})=>{
  let card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await makeEligible(page,id,null);
  card=page.locator(`[data-location-card="${id}"]`);
  await page.evaluate(async locationId=>{
    const data=await getLocationData(locationId);
    window.BogatkaSuite.ensureLaunchProject(data);
    await idbPut(STORE,data,`location:${locationId}`);
    await updateSummary();
    await window.BogatkaOpeningProjectV455.renderAll();
  },id);
  const stored=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(stored.launchProject.schemaVersion).toBe('4.5.5');
  expect(new Set(stored.launchProject.milestones.map(item=>item.phase)).size).toBe(7);
  expect(stored.launchProject.milestones.length).toBeGreaterThan(30);
  await expect(card.locator('.launch-v455-phase')).toHaveCount(7);
});

test('legacy project remains unchanged until explicit expansion',async({page})=>{
  let card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  const legacy={enabled:true,stage:'Ремонт',targetDate:'',manager:'',budget:'',notes:'',milestones:[{id:'legacy-one',title:'Старый особый этап',status:'doing',assignee:'Иван',dueDate:'2026-08-01',order:0}]};
  await makeEligible(page,id,legacy);
  card=page.locator(`[data-location-card="${id}"]`);
  await page.evaluate(async()=>{await window.BogatkaLaunchGateV454.renderAll();await window.BogatkaOpeningProjectV455.renderAll();});
  await openLaunch(card);
  const before=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(before.launchProject.milestones).toHaveLength(1);
  const expand=card.locator('[data-launch-v455-action="expand"]');
  await expect(expand).toBeVisible();
  await expand.click();
  await page.waitForFunction(async locationId=>(await getLocationData(locationId)).launchProject?.schemaVersion==='4.5.5',id);
  const after=await page.evaluate(locationId=>getLocationData(locationId),id);
  const preserved=after.launchProject.milestones.find(item=>item.id==='legacy-one');
  expect(preserved).toMatchObject({title:'Старый особый этап',status:'doing',assignee:'Иван',dueDate:'2026-08-01'});
  expect(after.launchProject.milestones.length).toBeGreaterThan(30);
});

test('phase milestone status and assignee persist',async({page})=>{
  let card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await makeEligible(page,id,null);
  await page.evaluate(async locationId=>{
    const data=await getLocationData(locationId);window.BogatkaSuite.ensureLaunchProject(data);await idbPut(STORE,data,`location:${locationId}`);await updateSummary();await window.BogatkaOpeningProjectV455.renderAll();
  },id);
  card=page.locator(`[data-location-card="${id}"]`);
  await openLaunch(card,{firstPhase:true});
  const first=card.locator('[data-launch-milestone-v455]').first();
  const milestoneId=await first.getAttribute('data-launch-milestone-v455');
  await first.locator('[data-launch-v455-status]').selectOption('doing');
  await first.locator('[data-launch-v455-assignee]').fill('Ответственный тест');
  await first.locator('[data-launch-v455-assignee]').blur();
  await page.waitForFunction(async({id,milestoneId})=>{
    const item=(await getLocationData(id)).launchProject?.milestones?.find(row=>row.id===milestoneId);
    return item?.status==='doing'&&item?.assignee==='Ответственный тест';
  },{id,milestoneId});
});

test('viewer sees grouped project but cannot edit it',async({page})=>{
  let card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await makeEligible(page,id,null);
  await page.evaluate(async locationId=>{
    const data=await getLocationData(locationId);window.BogatkaSuite.ensureLaunchProject(data);await idbPut(STORE,data,`location:${locationId}`);cloudRole='viewer';window.cloudRole='viewer';await updateSummary();await window.BogatkaOpeningProjectV455.renderAll();
  },id);
  card=page.locator(`[data-location-card="${id}"]`);
  await expect(card.locator('.launch-v455-phase')).toHaveCount(7);
  for(const control of await card.locator('.launch-v455 input,.launch-v455 select,.launch-v455 textarea').all())await expect(control).toBeDisabled();
  await expect(card.locator('[data-launch-v455-action]')).toHaveCount(0);
});

test('HTML report groups opening milestones by phase',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await makeEligible(page,id,null);
  await page.evaluate(async locationId=>{
    const data=await getLocationData(locationId);window.BogatkaSuite.ensureLaunchProject(data);await idbPut(STORE,data,`location:${locationId}`);await updateSummary();
  },id);
  await page.waitForFunction(()=>Boolean(window.BogatkaLiveReport?.build?.__openingProjectV455),null,{timeout:30000});
  const html=await page.evaluate(()=>window.BogatkaLiveReport.build());
  expect(html).toContain('1. Договор и передача помещения');
  expect(html).toContain('7. Реклама и открытие');
  expect(html).toContain('Договор аренды подписан');
});
