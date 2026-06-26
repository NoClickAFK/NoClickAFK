import { test, expect } from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=412';

async function authorize(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
}

async function waitForV412(page){
  await page.waitForFunction(()=>window.BogatkaSyncMerge?.version==='4.1.2');
  await page.waitForFunction(()=>window.BogatkaSyncIntegrity?.ready===true);
  await page.waitForFunction(()=>window.BogatkaDecisionPanel?.ready===true);
}

test('three-way merge preserves independent edits from different devices',async({page})=>{
  await authorize(page);
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await waitForV412(page);

  const result=await page.evaluate(()=>{
    const merge=window.BogatkaSyncMerge.merge;
    const base={traffic:{morning:'10'},check:{visible:false},contact:'Старый контакт',tasks:[{id:'a',title:'Базовая',status:'todo'}]};
    const local={traffic:{morning:'10'},check:{visible:true},contact:'Старый контакт',tasks:[{id:'a',title:'Базовая',status:'done'},{id:'local',title:'С телефона'}]};
    const remote={traffic:{morning:'25'},check:{visible:false},contact:'Анна',tasks:[{id:'a',title:'Изменённая на ПК',status:'todo'},{id:'remote',title:'С компьютера'}]};
    return merge(base,local,remote,{preferLocal:true});
  });

  expect(result.traffic.morning).toBe('25');
  expect(result.check.visible).toBe(true);
  expect(result.contact).toBe('Анна');
  expect(result.tasks.map(item=>item.id).sort()).toEqual(['a','local','remote']);
  expect(result.tasks.find(item=>item.id==='a')).toMatchObject({title:'Изменённая на ПК',status:'done'});
});

test('first sync unions surviving local fields with populated cloud fields',async({page})=>{
  await authorize(page);
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await waitForV412(page);

  const result=await page.evaluate(()=>{
    const merge=window.BogatkaSyncMerge.merge;
    return {
      union:merge(undefined,{check:{shortStop:true},status:'',date:''},{status:'Кандидат',date:'2026-06-26',traffic:{morning:'26'},check:{housing:true}},{preferLocal:false}),
      deletion:merge({contact:'Анна',notes:'старое'},{notes:'новое'},{contact:'Анна',notes:'старое'},{preferLocal:true,explicitReset:true}),
      conflict:merge({rent:'1000'},{rent:'1200'},{rent:'1100'},{preferLocal:true}),
    };
  });

  expect(result.union).toMatchObject({status:'Кандидат',date:'2026-06-26',traffic:{morning:'26'},check:{shortStop:true,housing:true}});
  expect(result.deletion).toEqual({notes:'новое'});
  expect(result.conflict.rent).toBe('1200');
});

test('decision radios are presented as one explanatory full-width panel',async({page})=>{
  await authorize(page);
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await waitForV412(page);

  const card=page.locator('[data-location-card]').first();
  const panel=card.locator('.decision-panel-v412');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.decision-copy-v412 strong')).toHaveText('Предварительное решение по локации');
  await expect(panel.locator('.decision-copy-v412 p')).toContainText('Решение можно изменить позже');
  await expect(panel.locator('.decision-actions-v412 label')).toHaveCount(3);

  const question=panel.locator('label[data-decision-value="Под вопросом"]');
  await question.click();
  await expect(question.locator('input')).toBeChecked();
  await expect(question).toHaveClass(/selected/);
  await expect(question).toContainText('нужны дополнительные данные');

  const geometry=await panel.evaluate(element=>({
    panelWidth:element.getBoundingClientRect().width,
    bodyWidth:element.closest('.location-body').getBoundingClientRect().width,
    actionHeight:element.querySelector('.decision-actions-v412 label').getBoundingClientRect().height,
  }));
  expect(Math.abs(geometry.panelWidth-geometry.bodyWidth)).toBeLessThanOrEqual(2);
  expect(geometry.actionHeight).toBeGreaterThanOrEqual(40);
});
