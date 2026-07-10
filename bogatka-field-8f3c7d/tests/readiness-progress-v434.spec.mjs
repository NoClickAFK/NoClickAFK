import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=434';
const ARTIFACT_DIR=path.resolve('test-results/readiness-v434-review');

async function openApp(page,{width=1440,height=1100}={}){
  await page.setViewportSize({width,height});
  await page.addInitScript(()=>{
    localStorage.setItem('bogatka_access_authorized_v1','1');
    localStorage.removeItem('bogatka_build_meta_v426');
  });
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaReadinessProgressV434?.ready&&
    window.BogatkaCardProgressV448?.initialized&&
    window.BogatkaDecisionPanel?.ready&&
    document.querySelector('[data-location-card] .decision-progress-v448')&&
    document.querySelector('[data-location-card] [data-field="listingUrl"]')
  ),null,{timeout:30000});
  const card=page.locator('[data-location-card]').first();
  await card.evaluate(node=>window.BogatkaLocationCardCollapseV422?.setCollapsed?.(node,false,{persist:false}));
  return card;
}

async function patchData(page,id,patch){
  await page.evaluate(async({locationId,next})=>{
    const current=await getLocationData(locationId);
    const merged={...current,...next};
    for(const key of ['tech','score','criticalDealConditions']){
      if(next[key])merged[key]={...(current[key]||{}),...next[key]};
    }
    await idbPut(STORE,merged,`location:${locationId}`);
    await updateSummary();
    await window.BogatkaReadinessProgressV434.refresh();
  },{locationId:id,next:patch});
}

async function metricGroup(page,id,key){
  return page.evaluate(({locationId,groupKey})=>{
    const metric=(window.BogatkaDecisionUI?.lastMetrics||[]).find(item=>item.id===locationId);
    const group=metric?.progressGroups?.find(item=>item.key===groupKey);
    return group?JSON.parse(JSON.stringify(group)):null;
  },{locationId:id,groupKey:key});
}

async function openProgressPlan(card){
  const progress=card.locator('.progress-card-toggle-v462');
  if(await progress.getAttribute('aria-expanded')!=='true')await progress.click();
  const plan=card.locator('.fill-plan-toggle-v462');
  if(await plan.getAttribute('aria-expanded')!=='true')await plan.click();
}

async function screenshotCard(card,name){
  await mkdir(ARTIFACT_DIR,{recursive:true});
  await card.screenshot({path:path.join(ARTIFACT_DIR,name),animations:'disabled'});
}

const completeInspection={
  status:'Осмотрен',objectType:'Торговое помещение',date:'2026-07-10',time:'12:00',
  floorLocation:'1 этаж',premiseCondition:'Готово',premiseAvailability:'Свободно',
  landlordReadiness:'Готов обсуждать',inspectionPurpose:'Первичный осмотр',inspectionResult:'Параметры подтверждены',
};
const completeLandlord={
  ownerName:'ООО Собственник',contactRole:'Собственник',contact:'Иван Иванов',contactPhone:'+375290000000',
};

test('listing URL belongs to landlord and recalculates idempotently on the same loaded card',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await patchData(page,id,{
    ...completeInspection,...completeLandlord,
    objectSource:'Объявление',listingUrl:'',objectSourceOther:'',inspectionParticipants:'',
  });
  await openProgressPlan(card);

  const inspectionBefore=await metricGroup(page,id,'inspection');
  const landlordBefore=await metricGroup(page,id,'landlord');
  expect(inspectionBefore.missingLabels).not.toContain('ссылка на объявление');
  expect(inspectionBefore.missingLabels).not.toContain('источник объекта');
  expect(landlordBefore.missingLabels).toEqual(['ссылка на объявление']);
  expect(landlordBefore.title).toBe('Арендодатель и условия');

  const landlordItem=card.locator('.fill-plan-item-v448').filter({has:card.locator('[data-progress-target-v448="landlord"]')});
  await expect(landlordItem.locator('.fill-plan-copy-v448 strong')).toHaveText('Арендодатель и условия');
  await expect(landlordItem.locator('.fill-plan-copy-v448 small')).toContainText('ссылка на объявление');
  await landlordItem.locator('[data-progress-target-v448="landlord"]').click();
  await expect(card.locator('.landlord-card-v416')).toHaveAttribute('data-progress-target-section-v448','landlord');
  await expect(card.locator('.landlord-card-v416 [data-field="listingUrl"]')).toHaveCount(1);
  await screenshotCard(card,'01-listing-url-missing-landlord.png');

  const initialTotal=landlordBefore.total;
  const listing=card.locator('.landlord-card-v416 [data-field="listingUrl"]');
  await listing.fill('https://example.com/location-card');
  await page.waitForFunction(locationId=>{
    const metric=(window.BogatkaDecisionUI?.lastMetrics||[]).find(item=>item.id===locationId);
    const group=metric?.progressGroups?.find(item=>item.key==='landlord');
    return group&&!group.missingLabels.includes('ссылка на объявление');
  },id,{timeout:5000});
  const landlordFilled=await metricGroup(page,id,'landlord');
  expect(landlordFilled.total).toBe(initialTotal);
  expect(landlordFilled.done).toBe(initialTotal);
  await expect(card.locator('.fill-plan-item-v448 [data-progress-target-v448="landlord"]')).toHaveCount(0);
  await screenshotCard(card,'02-listing-url-filled-without-reload.png');

  await listing.fill('');
  await page.waitForFunction(locationId=>{
    const metric=(window.BogatkaDecisionUI?.lastMetrics||[]).find(item=>item.id===locationId);
    return metric?.progressGroups?.find(item=>item.key==='landlord')?.missingLabels.includes('ссылка на объявление');
  },id,{timeout:5000});
  const landlordCleared=await metricGroup(page,id,'landlord');
  expect(landlordCleared.total).toBe(initialTotal);
  expect(landlordCleared.missingLabels).toEqual(['ссылка на объявление']);

  const idempotence=await page.evaluate(locationId=>{
    const metric=(window.BogatkaDecisionUI?.lastMetrics||[]).find(item=>item.id===locationId);
    const totals=[];
    const labels=[];
    for(let index=0;index<6;index++){
      window.BogatkaReadinessProgressV434.applyMetric(metric);
      const group=metric.progressGroups.find(item=>item.key==='landlord');
      totals.push(group.total);
      labels.push(group.requirements.map(item=>item.label));
    }
    return{totals,labels,privateCache:metric.progressGroups.some(group=>('_locationDataRequirementsV452' in group))};
  },id);
  expect(new Set(idempotence.totals).size).toBe(1);
  for(const labels of idempotence.labels)expect(new Set(labels).size).toBe(labels.length);
  expect(idempotence.privateCache).toBe(false);

  await patchData(page,id,{objectSource:'Другое',objectSourceOther:'',listingUrl:''});
  const landlordOther=await metricGroup(page,id,'landlord');
  expect(landlordOther.missingLabels).toContain('уточнение источника объекта');
  expect(landlordOther.missingLabels).not.toContain('ссылка на объявление');
});

test('minimum photo plan is exactly 13 and caps completion at 100 percent',async({page})=>{
  const card=await openApp(page);
  const evidence=await page.evaluate(()=>{
    const exact={street:2,entrance:2,parking:1,traffic:1,competitors:1,interior:2,storage:1,engineering:2,documents:1,other:0};
    const photos=[];
    for(const [category,required] of Object.entries(exact)){
      for(let index=0;index<required+3;index++)photos.push({locationId:'synthetic-photo-plan',category});
    }
    const plan=window.BogatkaSuite.photoPlanFor('synthetic-photo-plan',photos);
    return{runtimePlan:{...window.BogatkaSuite.PHOTO_PLAN},plan};
  });
  expect(evidence.runtimePlan).toEqual({street:2,entrance:2,parking:1,traffic:1,competitors:1,interior:2,storage:1,engineering:2,documents:1,other:0});
  expect(evidence.plan.requiredTotal).toBe(13);
  expect(evidence.plan.completed).toBe(13);
  expect(evidence.plan.percent).toBe(100);
  expect(evidence.plan.total).toBeGreaterThan(13);

  const photoDetails=card.locator(':scope .location-body > details').filter({has:page.getByText('Фотографии по категориям',{exact:true})}).first();
  if(!(await photoDetails.evaluate(node=>node.open))){await photoDetails.locator(':scope > summary').click();}
  await expect(card.locator('.photo-plan-head-v400 strong')).toHaveText('Минимальный фотоплан');
  await expect(card.locator('[data-photo-plan-total]')).toContainText('/13');
  await expect(card.locator('.photo-plan-v400')).not.toContainText('Обязательный фотоплан');
  await expect(card.locator('.photo-plan-v400')).not.toContainText('/24');
  await screenshotCard(card,'03-minimum-photo-plan-13.png');
});

test('decision alone completes conclusion and reason remains optional and persistent',async({page})=>{
  let card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  const direct=await page.evaluate(()=>{
    const api=window.BogatkaReadinessProgressV434;
    const values=['','Оставить','Под вопросом','Исключить'];
    return values.map(decision=>{
      const progress=api.buildProgress({data:{decision,pros:'',cons:'',risks:'',questions:'',decisionReason:''},photoPlan:{requiredTotal:13,completed:0,missing:[]},dealGate:{entries:[]}});
      const group=progress.groups.find(item=>item.key==='conclusion');
      return{decision,total:group.total,done:group.done,missingLabels:group.missingLabels};
    });
  });
  expect(direct[0]).toMatchObject({decision:'',total:1,done:0,missingLabels:['предварительное решение']});
  for(const item of direct.slice(1))expect(item).toMatchObject({total:1,done:1,missingLabels:[]});

  await patchData(page,id,{decision:'Оставить',pros:'',cons:'',risks:'',questions:'',decisionReason:''});
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaReadinessProgressV434?.ready&&document.querySelector('[data-location-card] .decision-reason-section-v412')),{timeout:30000});
  card=page.locator(`[data-location-card="${id}"]`);
  await card.evaluate(node=>window.BogatkaLocationCardCollapseV422?.setCollapsed?.(node,false,{persist:false}));
  await openProgressPlan(card);
  const conclusion=await metricGroup(page,id,'conclusion');
  expect(conclusion).toMatchObject({total:1,done:1,missingCount:0});
  await expect(card.locator('.fill-plan-item-v448 [data-progress-target-v448="conclusion"]')).toHaveCount(0);

  const reason=card.locator('.decision-reason-section-v412');
  const control=reason.locator('[data-field="decisionReason"]');
  await expect(control).not.toHaveAttribute('required','');
  await expect(control).toHaveAttribute('aria-required','false');
  await expect(reason).toHaveAttribute('data-required-missing','false');
  await expect(reason.locator('[data-decision-reason-status-v412]')).toHaveText('Необязательно');
  await expect(reason.locator('.decision-reason-description-v412')).toContainText('Необязательно');
  const visual=await reason.evaluate(node=>({
    border:getComputedStyle(node).borderTopColor,
    state:node.dataset.reasonState,
    requiredMissing:node.dataset.requiredMissing,
  }));
  expect(visual.state).toBe('optional');
  expect(visual.requiredMissing).toBe('false');
  expect(visual.border).not.toBe('rgb(216, 162, 162)');
  await screenshotCard(card,'04-decision-complete-reason-optional.png');

  const toggle=reason.locator(':scope > summary');
  if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
  await control.fill('Существующая аргументация решения');
  await reason.locator('[data-decision-reason-save-v412]').click();
  await expect(reason.locator('[data-decision-reason-status-v412]')).toHaveText('Сохранено');
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaDecisionPanel?.ready&&document.querySelector('[data-location-card] [data-field="decisionReason"]')),{timeout:30000});
  card=page.locator(`[data-location-card="${id}"]`);
  await expect(card.locator('[data-field="decisionReason"]')).toHaveValue('Существующая аргументация решения');
});

test.afterAll(async()=>{
  await mkdir(ARTIFACT_DIR,{recursive:true});
  await writeFile(path.join(ARTIFACT_DIR,'evidence.json'),JSON.stringify({
    version:'4.3.4',
    photoPlan:{street:2,entrance:2,parking:1,traffic:1,competitors:1,interior:2,storage:1,engineering:2,documents:1,other:0,total:13},
    conclusionRequirements:['decision'],
    listingUrlOwner:'landlord',
  },null,2));
});
