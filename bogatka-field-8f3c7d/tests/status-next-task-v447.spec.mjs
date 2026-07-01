import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=447';
const TOKEN='0123456789abcdef0123456789abcdef0123456789abcdef';

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaStatusNextTaskV447?.ready&&
    window.BogatkaSuite&&
    window.BogatkaLiveReport?.build?.__statusNextTaskV447&&
    window.BogatkaLiveReport.build.__reportStabilityV429&&
    window.buildReportHtml===window.BogatkaLiveReport.build&&
    document.querySelector('[data-location-card] [data-next-task-v447]')
  ),{timeout:20000});
  return page.locator('[data-location-card]').first();
}

test('status is a work stage and decision separately starts the opening project',async({page})=>{
  let card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  const status=card.locator('select[data-field="status"]');
  await expect(status.locator('option')).toHaveText([
    'Не выбран','Новый объект','Связались с арендодателем','Осмотр запланирован','Осмотрен',
    'Собираем информацию','Проверяем документы','Ведём переговоры','Выбран',
  ]);
  await expect(status.locator('xpath=ancestor::label').locator(':scope > .profile-caption-v416')).toHaveText('Статус работы с объектом');
  await expect(status.locator('xpath=ancestor::label').locator(':scope > .status-caption-v447')).toHaveCount(0);

  await page.evaluate(async locationId=>{
    const data=await idbGet(STORE,`location:${locationId}`)||{};
    data.status='Кандидат';
    delete data.decision;
    delete data.launchProject;
    await idbPut(STORE,data,`location:${locationId}`);
  },id);
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.BogatkaStatusNextTaskV447?.ready&&document.querySelector('[data-next-task-v447]'));
  card=page.locator(`[data-location-card="${id}"]`);
  await expect(card.locator('select[data-field="status"]')).toHaveValue('Новый объект');
  expect(await page.evaluate(locationId=>idbGet(STORE,`location:${locationId}`).then(data=>data.status),id)).toBe('Кандидат');

  await card.locator('select[data-field="status"]').selectOption('Выбран');
  await page.waitForFunction(async locationId=>(await idbGet(STORE,`location:${locationId}`))?.status==='Выбран',id);
  expect(await page.evaluate(locationId=>idbGet(STORE,`location:${locationId}`).then(data=>Boolean(data.launchProject?.enabled)),id)).toBe(false);

  await card.locator('input[data-field="decision"][value="Оставить"]').check();
  await page.waitForFunction(async locationId=>{
    const data=await idbGet(STORE,`location:${locationId}`);
    return data?.decision==='Оставить'&&data?.launchProject?.enabled===true;
  },id);
});

test('next step selects the strongest active task and preserves an old manual step',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  const panel=card.locator('[data-next-task-v447]');
  await page.evaluate(async locationId=>{
    const data=await getLocationData(locationId);
    data.nextAction='Старый шаг';
    data.tasks=[
      {id:'normal',title:'Обычная задача',priority:'normal',status:'todo',dueDate:'2026-07-02'},
      {id:'high',title:'Высокая задача',priority:'high',status:'doing',dueDate:'2026-07-10'},
      {id:'critical',title:'Критическая задача',priority:'critical',status:'waiting',dueDate:''},
    ];
    await idbPut(STORE,data,`location:${locationId}`);
    await updateSummary();
  },id);
  await expect(panel.locator('[data-next-task-title-v447]')).toHaveText('Критическая задача');
  await expect(panel.locator('[data-next-task-meta-v447]')).toContainText('Критический');

  await page.evaluate(async locationId=>window.BogatkaSuite.updateTask(locationId,'critical',{status:'done'}),id);
  await expect(panel.locator('[data-next-task-title-v447]')).toHaveText('Высокая задача');
  await page.evaluate(async locationId=>{
    await window.BogatkaSuite.updateTask(locationId,'high',{status:'done'});
    await window.BogatkaSuite.updateTask(locationId,'normal',{status:'done'});
  },id);
  await expect(panel.locator('[data-next-task-title-v447]')).toHaveText('Старый шаг');
  await expect(panel.locator('[data-next-task-meta-v447]')).toContainText('Ранее записанный следующий шаг');
  await expect(card.locator('[data-field="nextAction"]')).toBeHidden();
  await expect(card.locator('[data-field="nextActionDate"]')).toBeHidden();
});

test('authoritative HTML and PDF builder includes normalized status and next task',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  const result=await page.evaluate(async locationId=>{
    const data=await idbGet(STORE,`location:${locationId}`)||{};
    data.status='Кандидат';
    data.tasks=[{id:'report',title:'Получить технический паспорт',priority:'critical',status:'todo',assignee:'Анна',dueDate:'2026-07-15'}];
    await idbPut(STORE,data,`location:${locationId}`);
    await updateSummary();
    const html=await window.BogatkaLiveReport.build();
    return {
      text:new DOMParser().parseFromString(html,'text/html').body.textContent,
      authoritative:window.buildReportHtml===window.BogatkaLiveReport.build,
      stable:Boolean(window.BogatkaLiveReport.build.__reportStabilityV429),
      staged:Boolean(window.BogatkaLiveReport.build.__statusNextTaskV447),
    };
  },id);
  expect(result.authoritative).toBe(true);
  expect(result.stable).toBe(true);
  expect(result.staged).toBe(true);
  expect(result.text).toContain('Новый объект');
  expect(result.text).toContain('Получить технический паспорт');
  expect(result.text).toContain('Критический');
});

test('shared report normalizes status and shows the active task',async({page})=>{
  await page.route('**/functions/v1/bogatka-public-report*',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({id:'report-1',name:'Тестовый отчёт',created_at:'2026-07-01T10:00:00Z',snapshot:{
      project:{name:'Богатка'},global:{inspector:'Дмитрий'},photos:[],locations:[{
        id:'location-1',title:'Тестовая локация',address:'Гродно',status:'Кандидат',
        form_data:{status:'Кандидат',tasks:[
          {id:'high',title:'Высокая задача',priority:'high',status:'todo'},
          {id:'critical',title:'Главная критическая задача',priority:'critical',status:'doing'},
        ]},
      }],
    }}),
  }));
  await page.goto(`http://127.0.0.1:4173/bogatka-field-8f3c7d/report/?token=${TOKEN}`,{waitUntil:'networkidle'});
  const article=page.locator('#reportRoot article.location');
  await expect(article).toContainText('Статус: Новый объект');
  await expect(article).toContainText('Следующий шаг: Главная критическая задача');
  await expect(article).toContainText('Критический');
});
