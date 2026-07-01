import {test,expect} from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=447';
const REPORT_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/report/?token=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaStatusNextTaskV447?.ready&&
    window.BogatkaSuite&&
    document.querySelector('[data-location-card] select[data-field="status"]')&&
    document.querySelector('[data-next-task-v447]')
  ),{timeout:20000});
  return page.locator('[data-location-card]').first();
}

async function refreshCard(page){
  await page.evaluate(async()=>{await updateSummary();});
  await page.waitForTimeout(120);
}

test('status shows work stages while the decision remains separate',async({page})=>{
  let card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  const status=card.locator('select[data-field="status"]');

  await expect(status.locator('option')).toHaveText([
    'Не выбран',
    'Новый объект',
    'Связались с арендодателем',
    'Осмотр запланирован',
    'Осмотрен',
    'Собираем информацию',
    'Проверяем документы',
    'Ведём переговоры',
    'Выбран',
  ]);
  await expect(status.locator('xpath=ancestor::label').locator(':scope > .profile-caption-v416,:scope > .status-caption-v447')).toHaveText('Статус работы с объектом');

  await page.evaluate(async locationId=>{
    const raw=await idbGet(STORE,`location:${locationId}`)||{};
    raw.status='Кандидат';
    delete raw.launchProject;
    await idbPut(STORE,raw,`location:${locationId}`);
  },id);
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.BogatkaStatusNextTaskV447?.ready&&document.querySelector('[data-next-task-v447]'),{timeout:20000});
  card=page.locator(`[data-location-card="${id}"]`);
  const restoredStatus=card.locator('select[data-field="status"]');
  await expect(restoredStatus).toHaveValue('Новый объект');
  expect(await page.evaluate(locationId=>idbGet(STORE,`location:${locationId}`).then(data=>data.status),id)).toBe('Кандидат');

  await restoredStatus.selectOption('Выбран');
  await page.waitForFunction(async locationId=>(await idbGet(STORE,`location:${locationId}`))?.status==='Выбран',id);
  expect(await page.evaluate(locationId=>idbGet(STORE,`location:${locationId}`).then(data=>Boolean(data.launchProject?.enabled)),id)).toBe(false);

  await card.locator('input[data-field="decision"][value="Оставить"]').check();
  await page.waitForFunction(async locationId=>Boolean((await idbGet(STORE,`location:${locationId}`))?.launchProject?.enabled),id);
  expect(await page.evaluate(locationId=>idbGet(STORE,`location:${locationId}`).then(data=>data.decision),id)).toBe('Оставить');
});

test('next step automatically shows the most important active task',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  const panel=card.locator('[data-next-task-v447]');

  await page.evaluate(async locationId=>{
    const data=await getLocationData(locationId);
    data.nextAction='Получить старый проект договора';
    data.nextActionDate='2026-07-20';
    data.tasks=[
      {id:'normal-task',title:'Обычная задача',priority:'normal',status:'todo',dueDate:'2026-07-02',createdAt:'2026-07-01T08:00:00Z'},
      {id:'high-task',title:'Задача высокого приоритета',priority:'high',status:'doing',dueDate:'2026-07-10',createdAt:'2026-07-01T09:00:00Z'},
      {id:'critical-task',title:'Критическая задача',priority:'critical',status:'waiting',dueDate:'',createdAt:'2026-07-01T10:00:00Z'},
    ];
    await idbPut(STORE,data,`location:${locationId}`);
  },id);
  await refreshCard(page);

  await expect(panel.locator('[data-next-task-title-v447]')).toHaveText('Критическая задача');
  await expect(panel.locator('[data-next-task-meta-v447]')).toContainText('Критический');
  await expect(panel.locator('[data-next-task-meta-v447]')).toContainText('Ожидает');

  await page.evaluate(async locationId=>window.BogatkaSuite.updateTask(locationId,'critical-task',{status:'done'}),id);
  await expect(panel.locator('[data-next-task-title-v447]')).toHaveText('Задача высокого приоритета');

  await page.evaluate(async locationId=>{
    await window.BogatkaSuite.updateTask(locationId,'high-task',{status:'done'});
    await window.BogatkaSuite.updateTask(locationId,'normal-task',{status:'done'});
  },id);
  await expect(panel.locator('[data-next-task-title-v447]')).toHaveText('Получить старый проект договора');
  await expect(panel.locator('[data-next-task-meta-v447]')).toContainText('Ранее записанный следующий шаг');

  await page.evaluate(async locationId=>{
    const data=await getLocationData(locationId);
    data.nextAction='';
    data.nextActionDate='';
    await idbPut(STORE,data,`location:${locationId}`);
    await updateSummary();
  },id);
  await expect(panel.locator('[data-next-task-title-v447]')).toHaveText('Активных задач нет');
  await expect(card.locator('[data-field="nextAction"]')).toBeHidden();
  await expect(card.locator('[data-field="nextActionDate"]')).toBeHidden();
});

test('HTML and PDF report builder uses the normalized status and active task',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  const state=await page.evaluate(async locationId=>{
    const raw=await idbGet(STORE,`location:${locationId}`)||{};
    raw.status='Кандидат';
    raw.nextAction='Старый шаг не должен быть главным';
    raw.tasks=[{id:'report-task',title:'Получить технический паспорт',priority:'critical',status:'todo',assignee:'Анна',dueDate:'2026-07-15',createdAt:'2026-07-01T09:00:00Z'}];
    await idbPut(STORE,raw,`location:${locationId}`);
    await updateSummary();
    const html=await buildReportHtml();
    const doc=new DOMParser().parseFromString(html,'text/html');
    const section=doc.querySelector(`[data-location-card="${CSS.escape(locationId)}"],.report-location`);
    return {text:section?.textContent||'',builderPatched:Boolean(buildReportHtml.__statusNextTaskV447)};
  },id);
  expect(state.builderPatched).toBe(true);
  expect(state.text).toContain('Новый объект');
  expect(state.text).toContain('Получить технический паспорт');
  expect(state.text).toContain('Критический');
});

test('shared report normalizes status and shows the active next task',async({page})=>{
  await page.route('**/functions/v1/bogatka-public-report*',route=>route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({
      id:'report-1',
      name:'Тестовый отчёт',
      created_at:'2026-07-01T10:00:00Z',
      snapshot:{
        project:{name:'Богатка'},
        global:{inspector:'Дмитрий'},
        photos:[],
        locations:[{
          id:'location-1',
          title:'Тестовая локация',
          address:'Гродно',
          status:'Кандидат',
          form_data:{
            status:'Кандидат',
            tasks:[
              {id:'high',title:'Высокая задача',priority:'high',status:'todo',dueDate:'2026-07-05'},
              {id:'critical',title:'Главная критическая задача',priority:'critical',status:'doing',dueDate:''},
            ],
          },
        }],
      },
    }),
  }));
  await page.goto(REPORT_URL,{waitUntil:'networkidle'});
  const article=page.locator('#reportRoot article.location');
  await expect(article).toHaveCount(1);
  await expect(article).toContainText('Статус: Новый объект');
  await expect(article).toContainText('Следующий шаг: Главная критическая задача');
  await expect(article).toContainText('Критический');
});
