import {test,expect} from '@playwright/test';
import {openApp,openPane} from './workflow-v414-test-helpers.mjs';

test('task and comments introductions share typography and spacing',async({page})=>{
  const card=await openApp(page);
  const metrics=async(name,selector)=>{
    await openPane(page,name);
    return card.locator(`[data-collab-pane="${name}"]`).evaluate((root,target)=>{
      const intro=root.querySelector(target);
      const style=getComputedStyle(intro);
      const title=getComputedStyle(intro.querySelector('strong'));
      return {
        top:intro.getBoundingClientRect().top-root.getBoundingClientRect().top,
        gap:style.rowGap||style.gap,
        margin:style.marginBottom,
        size:title.fontSize,
        weight:title.fontWeight,
        family:title.fontFamily,
      };
    },selector);
  };
  const tasks=await metrics('tasks','.task-form-help-v414');
  const comments=await metrics('comments','.structured-notes-head-v414');
  expect(comments).toEqual(tasks);
});

test('task examples precede the form and close without text flicker',async({page})=>{
  const card=await openApp(page);
  await openPane(page,'tasks');
  const form=card.locator('.task-form-v400');
  const examples=card.locator('.task-examples-v414');
  const summary=examples.locator(':scope > summary');

  await expect(form.locator('.task-field-v414')).toHaveCount(4);
  const order=await card.evaluate(element=>{
    const form=element.querySelector('.task-form-v400');
    const help=element.querySelector('.task-form-help-v414');
    const examples=element.querySelector('.task-examples-v414');
    const children=[...form.parentElement.children];
    return [children.indexOf(help),children.indexOf(examples),children.indexOf(form)];
  });
  expect(order[1]).toBe(order[0]+1);
  expect(order[2]).toBe(order[1]+1);

  await summary.click();
  await expect(examples).toHaveAttribute('open','');
  await expect(examples.locator('[data-task-example-title]')).toHaveCount(9);
  await examples.locator('[data-task-example-priority="critical"]').first().click();
  await expect(form.locator('textarea[name="title"]')).toHaveValue('Получить документы, подтверждающие законность перепланировки помещения');
  await expect(form.locator('select[name="priority"]')).toHaveValue('critical');

  const close=await page.evaluate(async()=>{
    const details=document.querySelector('[data-location-card] .task-examples-v414');
    const summary=details.querySelector(':scope > summary');
    const states=[];
    const observer=new MutationObserver(()=>states.push(summary.textContent||''));
    observer.observe(summary,{attributes:true,childList:true,subtree:true});
    summary.click();
    await new Promise(resolve=>setTimeout(resolve,360));
    observer.disconnect();
    return {open:details.open,text:summary.textContent||'',states};
  });
  expect(close.open).toBe(false);
  expect(close.text).toContain('нажмите, чтобы открыть');
  expect(close.states.some(text=>text.includes('выберите подходящий вариант'))).toBe(false);
});
