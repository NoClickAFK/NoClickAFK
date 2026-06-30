import { test, expect } from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=443';

async function authorize(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
}

async function waitForWorkflow(page){
  await page.waitForFunction(()=>window.BogatkaWorkflowV414?.ready===true);
  await page.waitForFunction(()=>window.BogatkaWorkflowRefineV440?.ready===true);
  await page.waitForFunction(()=>document.querySelector('[data-location-card] .structured-notes-v414'));
}

async function openCollaborationPane(page,pane){
  await page.evaluate(targetPane=>{
    const card=document.querySelector('[data-location-card]');
    const details=card?.querySelector('.collaboration-v400');
    if(details)details.open=true;
    const button=card?.querySelector(`[data-collab-tab="${targetPane}"]`);
    if(button&&!button.classList.contains('active'))button.click();
  },pane);
}

test('checklist and score explain different decisions',async({page})=>{
  await authorize(page);
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await waitForWorkflow(page);
  const card=page.locator('[data-location-card]').first();
  await expect(card.locator('.checklist-guide-v414')).toContainText('подтвердить факты');
  const score=card.locator('details').filter({hasText:'Сравнительная оценка локации'});
  await expect(score.locator('.score-guide-v414')).toContainText('насколько это условие сильное');
  await expect(score.locator('.score-label-v414')).toHaveCount(14);
  await expect(score.locator('.score-label-v414').first()).toContainText('Плотность и близость жилой застройки');
});

test('lease checks precede collaboration and structured notes avoid duplicated landlord questions',async({page})=>{
  await authorize(page);
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await waitForWorkflow(page);
  const card=page.locator('[data-location-card]').first();
  await expect(card.locator(':scope > .location-body > .notes-grid')).toHaveCount(0);
  const comments=card.locator('[data-collab-pane="comments"]');
  await expect(comments.locator('.structured-note-v414')).toHaveCount(5);
  await expect(comments.locator('[data-field="questions"]')).toHaveCount(0);
  await expect(comments.locator('.structured-notes-head-v414 span')).toHaveText('Здесь можно отдельно зафиксировать основные выводы по локации, чтобы они не потерялись среди обычных комментариев участников.');
  await expect(comments.locator('[data-field="pros"]')).toHaveAttribute('placeholder',/усиливает локацию/);
  const order=await card.evaluate(element=>{
    const body=element.querySelector('.location-body');
    const children=[...body.children];
    const lease=children.findIndex(item=>item.matches('[data-critical-deal]'));
    const collaboration=children.findIndex(item=>item.matches('[data-collaboration]'));
    const decision=children.findIndex(item=>item.matches('.decision,.decision-panel-v412'));
    const economy=children.findIndex(item=>item.matches('.economy-v400'));
    const launch=children.findIndex(item=>item.matches('.launch-project-v400'));
    return {lease,collaboration,decision,economy,launch};
  });
  expect(order.collaboration).toBe(order.lease+1);
  expect(order.decision).toBe(order.collaboration+1);
  expect(order.economy).toBe(order.decision+1);
  expect(order.launch).toBe(order.economy+1);
});

test('task editor breathes, examples precede the form, and expansion moves the form smoothly',async({page})=>{
  await authorize(page);
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await waitForWorkflow(page);
  await openCollaborationPane(page,'tasks');
  const card=page.locator('[data-location-card]').first();
  const form=card.locator('.task-form-v400');
  const help=card.locator('.task-form-help-v414');
  const examples=card.locator('.task-examples-v414');
  const summary=examples.locator(':scope > summary');
  const examplesBody=examples.locator(':scope > div');

  await expect(form.locator('.task-field-v414')).toHaveCount(4);
  await expect(form.locator('textarea[name="title"]')).toBeVisible();
  await expect(form.locator('textarea[name="title"]')).toHaveAttribute('placeholder','Например: собрать недостающие документы и ответы по локации');
  await expect(form.locator('select[name="assignee"]')).toHaveCount(1);
  await expect(form.locator('.task-submit-v414')).toHaveText('Добавить');
  await expect(help.locator('span')).toHaveText('Опишите конкретный результат, назначьте ответственного, срок и приоритет. После создания можно изменить статус задачи: перевести её в работу, поставить на ожидание или завершить.');

  const layout=await card.evaluate(element=>{
    const form=element.querySelector('.task-form-v400');
    const help=element.querySelector('.task-form-help-v414');
    const examples=element.querySelector('.task-examples-v414');
    const children=[...form.parentElement.children];
    return {
      help:children.indexOf(help),
      examples:children.indexOf(examples),
      form:children.indexOf(form),
      titleSize:parseFloat(getComputedStyle(help.querySelector('strong')).fontSize),
      helpMarginBottom:parseFloat(getComputedStyle(help).marginBottom),
      examplesMarginBottom:parseFloat(getComputedStyle(examples).marginBottom),
    };
  });
  expect(layout.examples).toBe(layout.help+1);
  expect(layout.form).toBe(layout.examples+1);
  expect(layout.titleSize).toBeGreaterThan(14);
  expect(layout.helpMarginBottom).toBeGreaterThanOrEqual(12);
  expect(layout.examplesMarginBottom).toBeGreaterThanOrEqual(15);

  await expect(summary.locator('[data-task-examples-instruction-v440] strong')).toHaveText('нажмите, чтобы открыть');
  expect(await summary.locator('[data-task-examples-prefix-v443]').evaluate(node=>node.textContent.endsWith('\u00a0'))).toBe(true);
  const transition=await examplesBody.evaluate(node=>getComputedStyle(node).transitionProperty);
  expect(transition).toContain('height');

  const collapsedTop=(await form.boundingBox()).y;
  await summary.click();
  await expect(examples).toHaveAttribute('open','');
  await expect(summary.locator('[data-task-examples-instruction-v440]')).toHaveText('выберите подходящий вариант и нажмите на него');
  expect(await summary.locator('[data-task-examples-prefix-v443]').evaluate(node=>node.textContent.endsWith('\u00a0'))).toBe(true);
  await page.waitForTimeout(320);
  const expandedTop=(await form.boundingBox()).y;
  expect(expandedTop).toBeGreaterThan(collapsedTop+50);

  await expect(examples.locator('.task-examples-note-v440')).toHaveText('Текст задачи и приоритет подставятся автоматически — при необходимости их можно изменить.');
  await expect(examples.locator('[data-task-example-title]')).toHaveCount(9);
  await expect(examples.locator('[data-task-example-title]')).toHaveText([
    'Собрать недостающие документы и ответы по локации',
    'Подготовить список открытых вопросов к следующему обсуждению',
    'Сверить полученные документы с результатами осмотра помещения',
    'Получить письменный ответ по спорному условию аренды',
    'Зафиксировать, кто и за чей счёт устраняет недостатки помещения',
    'Подтвердить срок устранения выявленного недостатка помещения',
    'Получить документы, подтверждающие законность перепланировки помещения',
    'Получить письменное разрешение на обязательные работы',
    'Устранить ограничение, которое блокирует аренду помещения (если это возможно)',
  ]);
  await examples.locator('[data-task-example-priority="critical"]').first().click();
  await expect(form.locator('textarea[name="title"]')).toHaveValue('Получить документы, подтверждающие законность перепланировки помещения');
  await expect(form.locator('select[name="priority"]')).toHaveValue('critical');
  const heights=await form.evaluate(element=>({
    title:element.querySelector('textarea[name="title"]').getBoundingClientRect().height,
    date:element.querySelector('input[name="dueDate"]').getBoundingClientRect().height,
    button:element.querySelector('button[type="submit"]').getBoundingClientRect().height,
  }));
  expect(Math.abs(heights.title-heights.date)).toBeLessThanOrEqual(1);
  expect(Math.abs(heights.title-heights.button)).toBeLessThanOrEqual(1);
});

test('history uses readable labels and ten entries per page',async({page})=>{
  await authorize(page);
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await waitForWorkflow(page);
  await page.evaluate(async()=>{
    const id=locations[0].id;
    const data=await getLocationData(id);
    data.activity=Array.from({length:23},(_,index)=>({
      id:`entry-${index}`,at:new Date(Date.now()-index*1000).toISOString(),actor:'Дмитрий',action:'Изменено поле',field:index%2?'score.storage':'score.overall',from:'1',to:'2',
    }));
    await idbPut(STORE,data,`location:${id}`);
    await updateSummary();
    await window.BogatkaWorkflowV414.refreshCard(document.querySelector(`[data-location-card="${id}"]`));
  });
  await openCollaborationPane(page,'history');
  const card=page.locator('[data-location-card]').first();
  const history=card.locator('[data-history-list]');
  await expect(history.locator('.history-item-v400')).toHaveCount(10);
  await expect(history.locator('.history-item-v400').first()).toContainText(/Общая коммерческая привлекательность|Качество складской зоны/);
  await expect(history.locator('.history-pagination-v414')).toContainText('Страница 1 из 3');
  await history.locator('[data-history-next]').click();
  await expect(history.locator('.history-pagination-v414')).toContainText('Страница 2 из 3');
});
