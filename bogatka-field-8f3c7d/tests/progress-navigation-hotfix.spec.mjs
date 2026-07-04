import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=progress-navigation-hotfix';

async function openApp(page){
  await page.setViewportSize({width:1440,height:900});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaCardProgressInitV448?.ready&&
    window.BogatkaCardProgressV448?.ready&&
    window.BogatkaLocationPanelsV419?.ready&&
    window.BogatkaLocationEvaluationRefineV446?.ready&&
    document.querySelector('[data-location-card] .progress-card-toggle-v462')
  ),{timeout:30000});
  const card=page.locator('[data-location-card]').first();
  await card.evaluate(node=>window.BogatkaLocationCardCollapseV422?.setCollapsed?.(node,false,{persist:false}));
  const id=await card.getAttribute('data-location-card');
  await page.evaluate(async locationId=>{
    const current=await getLocationData(locationId);
    const empty={
      ...current,
      status:'',objectType:'',objectTypeOther:'',date:'',time:'',floorLocation:'',premiseCondition:'',premiseAvailability:'',landlordReadiness:'',
      ownerName:'',contactRole:'',contactRoleOther:'',contact:'',contactPhone:'',contactMessenger:'',contactEmail:'',
      score:{},tech:{},pros:'',cons:'',risks:'',questions:'',decision:'',criticalDealConditions:{},
    };
    await idbPut(STORE,empty,`location:${locationId}`);
    await updateSummary();
  },id);
  await page.waitForFunction(()=>document.querySelectorAll('[data-location-card] .fill-plan-item-v448').length===7,{timeout:15000});
  const outer=card.locator('.progress-card-toggle-v462');
  if(await outer.getAttribute('aria-expanded')!=='true')await outer.click();
  const inner=card.locator('.fill-plan-toggle-v462');
  if(await inner.getAttribute('aria-expanded')!=='true')await inner.click();
  return card;
}

const expected={
  inspection:'Параметры осмотра',
  landlord:'Арендодатель и условия',
  scores:'Оценка локации',
  technical:'Технические и финансовые параметры',
  photos:'Фотографии по категориям',
  checks:'Проверки перед арендой',
  conclusion:'Предварительное решение по локации',
};

async function buttonFor(card,key){
  return card.locator(`[data-progress-target-v448="${key}"]`);
}

async function closePanel(panel){
  const toggle=panel.locator(':scope > .panel-toggle-v419');
  if(await toggle.getAttribute('aria-expanded')==='true')await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded','false');
}

test('all seven fill-plan actions use canonical targets and preserve accordion state',async({page})=>{
  const card=await openApp(page);
  const plan=card.locator('[data-fill-plan-list-v448]');
  await expect(plan.locator('.fill-plan-item-v448')).toHaveCount(7);
  await expect(plan.locator('.fill-plan-copy-v448>span')).toHaveCount(0);
  await expect(plan).not.toContainText(/Следующий приоритет|Далее/i);

  for(const [key,title] of Object.entries(expected)){
    const button=await buttonFor(card,key);
    await expect(button).toHaveCount(1);
    await expect(button.locator('xpath=..').locator('.fill-plan-copy-v448 strong')).toHaveText(title);
  }

  const inspection=card.locator('.inspection-card-v416');
  const landlord=card.locator('.landlord-card-v416');
  await closePanel(inspection);
  await closePanel(landlord);

  await (await buttonFor(card,'inspection')).click();
  await expect(inspection.locator(':scope > .panel-toggle-v419')).toHaveAttribute('aria-expanded','true');
  await expect(landlord.locator(':scope > .panel-toggle-v419')).toHaveAttribute('aria-expanded','false');
  await expect(inspection).toHaveAttribute('data-progress-target-section-v448','inspection');
  await (await buttonFor(card,'inspection')).click();
  await expect(inspection.locator(':scope > .panel-toggle-v419')).toHaveAttribute('aria-expanded','true');

  await (await buttonFor(card,'landlord')).click();
  await expect(landlord.locator(':scope > .panel-toggle-v419')).toHaveAttribute('aria-expanded','true');
  await expect(inspection.locator(':scope > .panel-toggle-v419')).toHaveAttribute('aria-expanded','true');
  await (await buttonFor(card,'landlord')).click();
  await expect(landlord.locator(':scope > .panel-toggle-v419')).toHaveAttribute('aria-expanded','true');

  const score=card.locator('select[data-field^="score."]').first().locator('xpath=ancestor::details[1]');
  await expect(score.locator(':scope > summary')).toHaveText('Оценка локации');
  await expect(card).not.toContainText('Сравнительная оценка потенциала локации — 70 баллов');
  await score.evaluate(node=>node.open=false);
  await (await buttonFor(card,'scores')).click();
  await expect(score).toHaveAttribute('open','');
  await expect(score).toHaveAttribute('data-progress-target-section-v448','scores');
  await (await buttonFor(card,'scores')).click();
  await expect(score).toHaveAttribute('open','');

  for(const key of ['technical','photos','checks','conclusion']){
    const button=await buttonFor(card,key);
    await button.click();
    const target=card.locator(`[data-progress-target-section-v448="${key}"]`);
    await expect(target).toHaveCount(1);
    if(key!=='conclusion')await expect(target).toHaveAttribute('open','');
    await expect(target).toContainText(expected[key]);
  }

  await expect(card.locator('.score-explanation-v448 strong')).toHaveText('Что означают показатели');
  await expect(card.locator('.score-explanation-v448 span')).toHaveText('Оценки ставятся ниже в разделе «Оценка локации». Качество показывает средний результат по заполненным критериям, а надёжность — сколько из 14 критериев уже оценено. Пустые критерии не снижают качество, но уменьшают надёжность');

  const layout=await card.evaluate(node=>({
    cardOverflow:node.scrollWidth-node.clientWidth,
    planOverflow:node.querySelector('[data-fill-plan-list-v448]').scrollWidth-node.querySelector('[data-fill-plan-list-v448]').clientWidth,
  }));
  expect(layout.cardOverflow).toBeLessThanOrEqual(1);
  expect(layout.planOverflow).toBeLessThanOrEqual(1);
});
