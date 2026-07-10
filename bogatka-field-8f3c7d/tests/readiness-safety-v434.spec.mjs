import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=434';
const PUBLIC_REPORT='http://127.0.0.1:4173/bogatka-field-8f3c7d/report/index.html?token=photo-plan-v434';

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

test('optional decision reason survives repeated delayed v452 sync passes',async({page})=>{
  const {card,id}=await openApp(page);
  await writeLocation(page,id,data=>{
    data.decision='Оставить';
    data.decisionReason='';
  });
  await page.evaluate(async locationId=>{
    await restoreAllForms({preserveActive:false});
    const card=document.querySelector(`[data-location-card="${CSS.escape(locationId)}"]`);
    const decision=card.querySelector('[data-field="decision"][value="Оставить"]');
    decision.checked=true;
    for(const delay of [0,30,80])setTimeout(()=>window.BogatkaLocationDataV452.enhanceCard(card),delay);
  },id);
  await page.waitForTimeout(240);
  await expect.poll(()=>card.evaluate(node=>[...node.querySelectorAll('[data-field="decisionReason"]')].map(control=>({required:control.required,aria:control.getAttribute('aria-required'),missing:control.closest('.decision-reason-section-v412,.decision-reason-v452')?.dataset.requiredMissing||'',warningHidden:control.closest('.decision-reason-section-v412,.decision-reason-v452')?.querySelector('.decision-reason-warning-v452')?.hidden??true}))),{timeout:5000}).toEqual(expect.arrayContaining([expect.objectContaining({required:false,aria:'false',missing:'false',warningHidden:true})]));
  for(const control of await card.locator('[data-field="decisionReason"]').all()){
    await expect(control).not.toHaveAttribute('required','');
    await expect(control).toHaveAttribute('aria-required','false');
  }
  await expect(card.locator('.decision-reason-warning-v452')).toBeHidden();
});

test('readiness terminal keeps ownership through the scheduled 10s v452 stability pass',async({page})=>{
  const {id}=await openApp(page);
  await writeLocation(page,id,data=>{
    data.decision='Оставить';
    data.decisionReason='';
    data.pros='';data.cons='';data.risks='';data.questions='';
  });
  const before=await page.evaluate(()=>({
    sameOwner:window.BogatkaDecisionEngine.computeAll.__locationDataV452Owner===window.BogatkaLocationDataV452.augmentMetric,
    terminal:Boolean(window.BogatkaDecisionEngine.computeAll.__readinessTerminalV434),
    functionRef:window.BogatkaDecisionEngine.computeAll,
  }));
  expect(before.sameOwner).toBe(true);
  expect(before.terminal).toBe(true);
  await page.waitForTimeout(10500);
  const after=await page.evaluate(async locationId=>{
    const current=window.BogatkaDecisionEngine.computeAll;
    const marker=current.__locationDataV452Owner===window.BogatkaLocationDataV452.augmentMetric;
    const ensureResult=window.BogatkaLocationDataStabilityV452.ensureEngine();
    const sameAfterEnsure=current===window.BogatkaDecisionEngine.computeAll;
    const metric=(await window.BogatkaDecisionEngine.computeAll()).find(item=>item.id===locationId);
    const conclusion=metric.progressGroups.find(group=>group.key==='conclusion');
    return{marker,ensureResult,sameAfterEnsure,terminal:Boolean(current.__readinessTerminalV434),conclusion:{total:conclusion.total,done:conclusion.done,missingCount:conclusion.missingCount,labels:conclusion.requirements.map(item=>item.label)}};
  },id);
  expect(after).toMatchObject({
    marker:true,
    ensureResult:true,
    sameAfterEnsure:true,
    terminal:true,
    conclusion:{total:1,done:1,missingCount:0,labels:['предварительное решение']},
  });
});

test('built-in self-test accepts the 13-photo minimum plan',async({page})=>{
  await openApp(page);
  await page.waitForFunction(()=>Boolean(window.BogatkaSelftest?.run),null,{timeout:30000});
  const photoCheck=await page.evaluate(async()=>{
    const result=await window.BogatkaSelftest.run();
    return result.checks.find(item=>item.name==='photo plan');
  });
  expect(photoCheck).toMatchObject({ok:true});
  expect(photoCheck.details).toContain('"requiredTotal":13');
});

test('public snapshot report uses the same 13-photo minimum plan',async({page})=>{
  await page.route('**/bogatka-public-report?*',route=>route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({
      name:'Проверка фотоплана 4.3.4',
      created_at:'2026-07-10T17:00:00.000Z',
      snapshot:{
        project:{name:'Богатка'},
        global:{},
        locations:[{id:'public-v434',title:'Тестовая локация',address:'Гродно',status:'Новый объект',form_data:{}}],
        photos:[],
      },
    }),
  }));
  await page.goto(PUBLIC_REPORT,{waitUntil:'networkidle'});
  const root=page.locator('#reportRoot');
  await expect(root).toContainText('Минимальный фотоплан: 0/13');
  await expect(root).not.toContainText('/24');
  await expect(root).toContainText('Улица и окружение: 0/2');
  await expect(root).toContainText('Подходы, вход и вывеска: 0/2');
  await expect(root).toContainText('Инженерия и безопасность: 0/2');
});