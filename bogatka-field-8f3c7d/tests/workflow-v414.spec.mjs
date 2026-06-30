import { test, expect } from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=444';

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
  const commentsHeader=comments.locator('.structured-notes-head-v414');
  const structured=comments.locator('.structured-notes-v414');
  await expect(comments.locator('.structured-note-v414')).toHaveCount(5);
  await expect(comments.locator('[data-field="questions"]')).toHaveCount(0);
  await expect(commentsHeader.locator('span')).toHaveText('Здесь можно отдельно зафиксировать основные выводы по локации, чтобы они не потерялись среди обычных комментариев участников.');
  await expect(commentsHeader).toHaveAttribute('data-comments-intro-v444','1');
  await expect(comments.locator('[data-field="pros"]')).toHaveAttribute('placeholder',/усиливает локацию/);
  const commentsStructure=await comments.evaluate(pane=>{
    const header=pane.querySelector('.structured-notes-head-v414');
    const structured=pane.querySelector('.structured-notes-v414');
    return {
      directHeader:header?.parentElement===pane,
      immediatelyBefore:structured?.previousElementSibling===header,
      headerInsideBox:Boolean(structured?.querySelector('.structured-notes-head-v414')),
    };
  });
  expect(commentsStructure.directHeader).toBe(true);
  expect(commentsStructure.immediatelyBefore).toBe(true);
  expect(commentsStructure.headerInsideBox).toBe(false);
  await expect(structured).toHaveCount(1);

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

test('task and comments introductions share the same position and spacing',async({page})=>{
  await authorize(page);
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await waitForWorkflow(page);
  const card=page.locator('[data-location-card]').first();

  await openCollaborationPane(page,'tasks');
  const taskPane=card.locator('[data-collab-pane="tasks"]');
  const taskHelp=taskPane.locator('.task-form-help-v414');
  await expect(taskHelp).toBeVisible();
  const taskMetrics=await taskPane.evaluate(pane=>{
    const intro=pane.querySelector('.task-form-help-v414');
    const paneRect=pane.getBoundingClientRect();
    const style=getComputedStyle(intro);
    const titleStyle=getComputedStyle(intro.querySelector('strong'));
    return {
      top:intro.getBoundingClientRect().top-paneRect.top,
      gap:parseFloat(style.rowGap||style.gap),
      marginBottom:parseFloat(style.marginBottom),
      titleSize:parseFloat(titleStyle.fontSize),
    };
  });

  await openCollaborationPane(page,'comments');
  const commentsPane=card.locator('[data-collab-pane="comments"]');
  const commentsHelp=commentsPane.locator('.structured-notes-head-v414');
  await expect(commentsHelp).toBeVisible();
  const commentsMetrics=await commentsPane.evaluate(pane=>{
    const intro=pane.querySelector('.structured-notes-head-v414');
    const paneRect=pane.getBoundingClientRect();
    const style=getComputedStyle(intro);
    const titleStyle=getComputedStyle(intro.querySelector('strong'));
    return {
      top:intro.getBoundingClientRect().top-paneRect.top,
      gap:parseFloat(style.rowGap||style.gap),
      marginBottom:parseFloat(style.marginBottom),
      titleSize:parseFloat(titleStyle.fontSize),
    };
  });

  expect(Math.abs(taskMetrics.top-commentsMetrics.top)).toBeLessThanOrEqual(1);
  expect(commentsMetrics.gap).toBe(taskMetrics.gap);
  expect(commentsMetrics.marginBottom).toBe(taskMetrics.marginBottom);
  expect(commentsMetrics.titleSize).toBe(taskMetrics.titleSize);
});

test('task editor breathes, examples precede the form, and expansion closes without text flicker',async({page})=>{
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

  const collapsedTop=await form.evaluate(node=>node.getBoundingClientRect().top+window.scrollY);
  await summary.click();
  await expect(examples).toHaveAttribute('open','');
  await expect(summary.locator('[data-task-examples-instruction-v440]')).toHaveText('выберите подходящий вариант и нажмите на него');
  expect(await summary.locator('[data-task-examples-prefix-v443]').evaluate(node=>node.textContent.endsWith('\u00a0'))).toBe(true);
  await page.waitForTimeout(320);
  await expect(examplesBody).toBeVisible();
  const expandedState=await form.evaluate(node=>({
    top:node.getBoundingClientRect().top+window.scrollY,
    examplesHeight:node.previousElementSibling?.getBoundingClientRect().height||0,
  }));
  expect(expandedState.top).toBeGreaterThan(collapsedTop+50);
  expect(expandedState.examplesHeight).toBeGreaterThan(50);

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

  const closeResult=await page.evaluate(async()=>{
    const details=document.querySelector('[data-location-card] .task-examples-v414');
    const summary=details.querySelector(':scope > summary');
    const states=[];
    const observer=new MutationObserver(()=>{
      const text=summary.textContent||'';
      if(text.includes('выберите подходящий вариант'))states.push('open');
      if(text.includes('нажмите, чтобы открыть'))states.push('closed');
    });
    observer.observe(summary,{attributes:true,childList:true,subtree:true});
    summary.click();
    await new Promise(resolve=>setTimeout(resolve,360));
    observer.disconnect();
    return {states,open:details.open,text:summary.textContent||''};
  });
  expect(closeResult.open).toBe(false);
  expect(closeResult.text).toContain('нажмите, чтобы открыть');
  expect(closeResult.states).not.toContain('open');
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
