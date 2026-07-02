import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=457';

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaWorkflowIntegrityV457?.ready&&window.BogatkaDecisionEngine?.computeAll&&document.querySelector('[data-location-card]')),{timeout:30000});
  await page.waitForFunction(()=>window.BogatkaWorkflowIntegrityV457.audit().ok,{timeout:30000});
}

test('dated same-priority task is selected before an unscheduled task',async({page})=>{
  await openApp(page);
  const selected=await page.evaluate(()=>window.BogatkaWorkflowIntegrityV457.pickNextTask({tasks:[
    {id:'undated',title:'Без срока',priority:'normal',status:'todo',createdAt:'2026-01-01T00:00:00Z'},
    {id:'dated',title:'Со сроком',priority:'normal',status:'todo',dueDate:'2026-07-10',createdAt:'2026-06-01T00:00:00Z'},
  ]}));
  expect(selected.id).toBe('dated');
});

test('new workflow statuses have a stable chronological order',async({page})=>{
  await openApp(page);
  const ranks=await page.evaluate(()=>[
    'Новый объект','Связались с арендодателем','Осмотр запланирован','Осмотрен',
    'Собираем информацию','Проверяем документы','Ведём переговоры','Выбран',
  ].map(value=>window.BogatkaWorkflowIntegrityV457.statusRank(value)));
  expect(ranks).toEqual([1,2,3,4,5,6,7,8]);
});

test('decision engine keeps card progress and technical economy wrappers active',async({page})=>{
  await openApp(page);
  const state=await page.evaluate(()=>({
    cardProgress:Boolean(window.BogatkaDecisionEngine.computeAll.__cardProgressV448),
    technicalEconomics:Boolean(window.BogatkaDecisionEngine.computeAll.__technicalEconomicsV450),
    audit:window.BogatkaWorkflowIntegrityV457.audit(),
  }));
  expect(state.cardProgress).toBe(true);
  expect(state.technicalEconomics).toBe(true);
  expect(state.audit.ok).toBe(true);
});
