import {test,expect} from '@playwright/test';
import {openApp,openPane} from './workflow-v414-test-helpers.mjs';

test('task and comments introductions share typography and spacing',async({page})=>{
  const card=await openApp(page);
  const read=async(name,selector)=>{
    await openPane(page,name);
    return card.locator(`[data-collab-pane="${name}"]`).evaluate((root,target)=>{
      const intro=root.querySelector(target);
      const style=getComputedStyle(intro);
      const title=getComputedStyle(intro.querySelector('strong'));
      return [intro.getBoundingClientRect().top-root.getBoundingClientRect().top,style.rowGap||style.gap,style.marginBottom,title.fontSize,title.fontWeight,title.fontFamily];
    },selector);
  };
  expect(await read('comments','.structured-notes-head-v414')).toEqual(await read('tasks','.task-form-help-v414'));
});

test('task examples precede the form and remain functional',async({page})=>{
  const card=await openApp(page);
  await openPane(page,'tasks');
  const form=card.locator('.task-form-v400');
  const examples=card.locator('.task-examples-v414');
  const summary=examples.locator(':scope > summary');
  const order=await card.evaluate(element=>{
    const form=element.querySelector('.task-form-v400');
    const help=element.querySelector('.task-form-help-v414');
    const examples=element.querySelector('.task-examples-v414');
    const children=[...form.parentElement.children];
    return [children.indexOf(help),children.indexOf(examples),children.indexOf(form)];
  });
  expect(order).toEqual([order[0],order[0]+1,order[0]+2]);
  await summary.click();
  await expect(examples).toHaveAttribute('open','');
  await page.waitForTimeout(320);
  await examples.locator('[data-task-example-priority="critical"]').first().click();
  await expect(form.locator('textarea[name="title"]')).toHaveValue('Получить документы, подтверждающие законность перепланировки помещения');
  await expect(form.locator('select[name="priority"]')).toHaveValue('critical');
  await summary.click();
  await page.waitForTimeout(360);
  await expect(examples).not.toHaveAttribute('open','');
  await expect(summary).toContainText('нажмите, чтобы открыть');
});
