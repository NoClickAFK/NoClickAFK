import { test, expect } from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=415';

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.BogatkaWorkflowV414?.ready&&window.BogatkaWorkflowFixesV415?.ready);
  await page.waitForFunction(()=>document.querySelector('[data-location-card] .comment-form-v400'));
}

async function openPane(page,pane){
  await page.evaluate(target=>{
    const card=document.querySelector('[data-location-card]');
    const details=card?.querySelector('.collaboration-v400');
    if(details)details.open=true;
    const tab=card?.querySelector(`[data-collab-tab="${target}"]`);
    if(tab&&!tab.classList.contains('active'))tab.click();
  },pane);
}

test('comment input clears after a successful add and aligns with button',async({page})=>{
  await openApp(page);
  await openPane(page,'comments');
  const card=page.locator('[data-location-card]').first();
  const form=card.locator('.comment-form-v400');
  const textarea=form.locator('textarea[name="text"]');
  const button=form.locator('button[type="submit"]');
  const text=`Проверка очистки ${Date.now()}`;

  const geometry=await form.evaluate(element=>{
    const input=element.querySelector('textarea');
    const submit=element.querySelector('button');
    const a=input.getBoundingClientRect();
    const b=submit.getBoundingClientRect();
    return {inputHeight:a.height,buttonHeight:b.height,bottomDifference:Math.abs(a.bottom-b.bottom)};
  });
  expect(Math.abs(geometry.inputHeight-geometry.buttonHeight)).toBeLessThanOrEqual(1);
  expect(geometry.bottomDifference).toBeLessThanOrEqual(1);
  expect(geometry.inputHeight).toBeLessThanOrEqual(48);

  await textarea.fill(text);
  await button.click();
  await expect(card.locator('.comment-card-v400').first()).toContainText(text);
  await expect(textarea).toHaveValue('');
});

test('priority menu uses equal one-line options and the same compact font',async({page})=>{
  await openApp(page);
  await openPane(page,'tasks');
  const card=page.locator('[data-location-card]').first();
  const trigger=card.locator('.task-priority-trigger-v415');
  await expect(trigger).toBeVisible();
  await trigger.click();
  const menu=page.locator('.premium-select-menu.open');
  await expect(menu).toBeVisible();
  const metrics=await menu.locator('.premium-select-option').evaluateAll(options=>options.map(option=>{
    const rect=option.getBoundingClientRect();
    const style=getComputedStyle(option);
    return {height:rect.height,fontSize:style.fontSize,whiteSpace:style.whiteSpace,scrollWidth:option.scrollWidth,clientWidth:option.clientWidth};
  }));
  expect(metrics).toHaveLength(3);
  expect(new Set(metrics.map(item=>Math.round(item.height))).size).toBe(1);
  expect(new Set(metrics.map(item=>item.fontSize)).size).toBe(1);
  expect(metrics.every(item=>item.whiteSpace==='nowrap')).toBe(true);
  expect(metrics.every(item=>item.scrollWidth<=item.clientWidth+1)).toBe(true);
});
