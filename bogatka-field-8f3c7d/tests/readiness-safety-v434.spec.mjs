import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=434';

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaReadinessProgressV434?.ready&&
    window.BogatkaDecisionEngine?.computeAll?.__readinessTerminalV434&&
    window.BogatkaCriticalDeal?.CONDITIONS?.length===10&&
    window.BogatkaLaunchGateV454?.ready&&
    document.querySelector('[data-location-card]')
  ),null,{timeout:30000});
  const card=page.locator('[data-location-card]').first();
  const id=await card.getAttribute('data-location-card');
  await card.evaluate(node=>window.BogatkaLocationCardCollapseV422?.setCollapsed?.(node,false,{persist:false}));
  return{card,id};
}

async function writeLocation(page,id,mutate){
  await page.evaluate(async({locationId,source})=>{
    const data=await getLocationData(locationId);
    const apply=new Function('data',source);
    apply(data);
    data.updatedAt=new Date().toISOString();
    await idbPut(STORE,data,`location:${locationId}`);
  },{locationId:id,source:`(${mutate.toString()})(data)`});
}

test('score, critical blocker and recommendation contracts remain unchanged',async({page})=>{
  const {id}=await openApp(page);
  await writeLocation(page,id,data=>{
    data.score=Object.fromEntries(Object.keys(window.BogatkaDecisionEngine.WEIGHTS).map(key=>[key,5]));
    data.decision='Оставить';
    data.decisionReason='Сильные показатели и подтверждённые условия';
    data.criticalDealConditions=Object.fromEntries(window.BogatkaCriticalDeal.CONDITIONS.map(definition=>{
      const evidence=definition.evidenceTypes.find(option=>!['not_confirmed','oral_agreement'].includes(option.value))?.value||'other';
      return[definition.key,{status:'confirmed',evidenceType:evidence,note:evidence==='other'?'Подтверждено документом':'',updatedAt:new Date().toISOString(),updatedBy:'test'}];
    }));
    delete data.launchProject;
  });
  let metric=await page.evaluate(async locationId=>(await window.BogatkaDecisionEngine.computeAll()).find(item=>item.id===locationId),id);
  expect(metric.rawScore).toBe(70);
  expect(metric.weighted).toBe(100);
  expect(metric.answeredScores).toBe(14);
  expect(metric.scoreCoverage).toBe(100);
  expect(metric.dealGate.counts.completed).toBe(10);
  expect(metric.dealGate.counts.blocked).toBe(0);
  expect(metric.progressGroups.find(group=>group.key==='conclusion')).toMatchObject({total:1,done:1,missingCount:0});
  let stored=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(stored.launchProject?.enabled).not.toBe(true);

  await writeLocation(page,id,data=>{
    const key=window.BogatkaCriticalDeal.CONDITIONS[0].key;
    data.criticalDealConditions[key]={...(data.criticalDealConditions[key]||{}),status:'blocked',note:'Тестовый blocker'};
  });
  metric=await page.evaluate(async locationId=>(await window.BogatkaDecisionEngine.computeAll()).find(item=>item.id===locationId),id);
  expect(metric.dealGate.counts.blocked).toBe(1);
  expect(metric.blocks).toBe(1);
  expect(metric.recommendation).toMatchObject({label:'СТОП',className:'stop'});
  stored=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(stored.launchProject?.enabled).not.toBe(true);
});

test('viewer restrictions, optional reason persistence and premium report access remain intact',async({page})=>{
  const {card,id}=await openApp(page);
  await writeLocation(page,id,data=>{
    data.decision='Под вопросом';
    data.decisionReason='Сохранённая необязательная аргументация';
    data.pros='';data.cons='';data.risks='';data.questions='';
  });
  await page.evaluate(async()=>{await window.BogatkaDecisionUI.refresh();await window.BogatkaCardProgressV448.renderAll();await window.BogatkaDecisionPanel.enhanceAll()});
  const reason=card.locator('[data-field="decisionReason"]');
  await expect(reason).toHaveValue('Сохранённая необязательная аргументация');
  await expect(reason).toHaveAttribute('aria-required','false');
  const metric=await page.evaluate(async locationId=>(await window.BogatkaDecisionEngine.computeAll()).find(item=>item.id===locationId),id);
  expect(metric.progressGroups.find(group=>group.key==='conclusion')).toMatchObject({total:1,done:1,missingCount:0});

  const html=await page.evaluate(()=>window.BogatkaLiveReport.build());
  expect(html).toContain('Сохранённая необязательная аргументация');
  expect(html).not.toContain('data-field="decisionReason"');

  await page.evaluate(()=>{
    try{cloudRole='viewer'}catch(_){}
    window.cloudRole='viewer';
    window.BogatkaLocationDataV452?.applyViewerState?.(document);
    window.BogatkaDecisionPanel?.enhanceAll?.();
  });
  for(const field of ['objectSource','listingUrl','inspectionPurpose','inspectionResult','decisionReason'])await expect(card.locator(`[data-field="${field}"]`)).toBeDisabled();
  const stored=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(stored.decisionReason).toBe('Сохранённая необязательная аргументация');
});
