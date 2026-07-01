import {test,expect} from '@playwright/test';
import {openApp} from './workflow-v414-test-helpers.mjs';

test('checklist and score explain different decisions',async({page})=>{
  const card=await openApp(page);
  await expect(card.locator('.checklist-guide-v414')).toContainText('зафиксировать результат проверки');
  await expect(card.locator('.checklist-guide-v414')).toContainText('«Да», «Нет» или «Не требуется»');
  const score=card.locator('details').filter({hasText:'Сравнительная оценка потенциала локации'});
  await expect(score.locator('.score-guide-v414')).toContainText('сравнить локации по спросу, потоку, доступности, заметности и пригодности помещения');
  await expect(score.locator('.score-label-v414')).toHaveCount(14);
  await expect(score.locator('.score-label-v414').first()).toContainText('Плотность жилой застройки');
});

test('lease checks precede collaboration and comments keep five structured notes',async({page})=>{
  const card=await openApp(page);
  await expect(card.locator(':scope > .location-body > .notes-grid')).toHaveCount(0);
  const comments=card.locator('[data-collab-pane="comments"]');
  await expect(comments.locator('.structured-note-v414')).toHaveCount(5);
  await expect(comments.locator('[data-field="questions"]')).toHaveCount(0);
  await expect(comments.locator('.structured-notes-head-v414 span')).toHaveText('Здесь можно отдельно зафиксировать основные выводы по локации, чтобы они не потерялись среди обычных комментариев участников.');

  const state=await card.evaluate(element=>{
    const body=element.querySelector('.location-body');
    const children=[...body.children];
    const index=selector=>children.findIndex(item=>item.matches(selector));
    const comments=element.querySelector('[data-collab-pane="comments"]');
    const header=comments.querySelector('.structured-notes-head-v414');
    const notes=comments.querySelector('.structured-notes-v414');
    return {
      lease:index('[data-critical-deal]'),
      collaboration:index('[data-collaboration]'),
      decision:index('.decision,.decision-panel-v412'),
      economy:index('.economy-v400'),
      launch:index('.launch-project-v400'),
      headerOutside:header?.parentElement===comments&&notes?.previousElementSibling===header&&!notes?.querySelector('.structured-notes-head-v414'),
    };
  });
  expect(state.headerOutside).toBe(true);
  expect(state.collaboration).toBe(state.lease+1);
  expect(state.decision).toBe(state.collaboration+1);
  expect(state.economy).toBe(state.decision+1);
  expect(state.launch).toBe(state.economy+1);
});
