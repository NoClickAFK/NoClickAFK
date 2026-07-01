import { test, expect } from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=421';

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.BogatkaLocationProfileV416?.ready&&window.BogatkaLocationOverviewV417?.ready&&window.BogatkaLocationPanelsV419?.ready&&window.BogatkaLocationGlobalV421?.ready&&window.BogatkaObjectTypeNormalizeV416?.ready&&window.BogatkaStatusNextTaskV447?.ready);
  await page.waitForFunction(()=>document.querySelector('[data-location-card] [data-overview-field="inspectionBy"]')&&document.querySelector('[data-location-card] [data-next-task-v447]'));
  await page.waitForFunction(()=>window.BogatkaLocationPanelsV419.audit().ok&&window.BogatkaLocationGlobalV421.audit().ok);
}

test('object type no longer reverts to Other after choosing another option',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const id=await card.getAttribute('data-location-card');
  const select=card.locator('[data-field="objectType"]');
  const other=card.locator('[data-field="objectTypeOther"]');

  await select.selectOption('Другое');
  await page.waitForTimeout(700);
  await expect(other).toBeVisible();
  await other.fill('Помещение при АЗС');
  await page.waitForTimeout(700);

  await select.selectOption('Торговый центр');
  await page.waitForTimeout(1200);
  await expect(select).toHaveValue('Торговый центр');
  await expect(other).toBeHidden();

  const saved=await page.evaluate(async locationId=>getLocationData(locationId),id);
  expect(saved.objectType).toBe('Торговый центр');
});

test('other object type label is precise and survives reload',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const id=await card.getAttribute('data-location-card');
  await card.locator('[data-field="objectType"]').selectOption('Другое');
  await page.waitForTimeout(700);
  await card.locator('[data-field="objectTypeOther"]').fill('Нестандартный павильон');
  await page.waitForTimeout(700);
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.BogatkaLocationOverviewV417?.ready&&window.BogatkaLocationPanelsV419?.ready&&window.BogatkaLocationGlobalV421?.ready&&window.BogatkaStatusNextTaskV447?.ready&&document.querySelector('[data-location-card] [data-overview-field="inspectionBy"]'));

  const reloaded=page.locator(`[data-location-card="${id}"]`);
  await expect(reloaded.locator('[data-field="objectType"]')).toHaveValue('Другое');
  await expect(reloaded.locator('[data-object-other] .profile-caption-v416')).toHaveText('Уточните другой тип объекта');
  await expect(reloaded.locator('[data-field="objectTypeOther"]')).toBeVisible();
  await expect(reloaded.locator('[data-field="objectTypeOther"]')).toHaveValue('Нестандартный павильон');
});

test('v421 keeps useful inspection fields and automatic next task after rerender',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const id=await card.getAttribute('data-location-card');

  for(const field of ['inspectionBy','availableFrom','nextActionDate','nextAction']){
    const control=card.locator(`[data-field="${field}"]`);
    await expect(control).toBeAttached();
    await expect(control).toBeHidden();
  }
  await expect(card.locator('[data-field="premiseAvailability"]')).toBeVisible();
  await expect(card.locator('[data-field="landlordReadiness"]')).toBeVisible();

  await card.locator('[data-field="floorLocation"]').fill('1-й этаж, вход с улицы');
  await card.locator('[data-field="premiseCondition"]').selectOption('Нужен косметический ремонт');
  await page.evaluate(async locationId=>{
    await window.BogatkaSuite.addTask(locationId,{
      title:'Получить план помещения и проект договора',
      priority:'high',
      assignee:'',
      dueDate:'',
    });
  },id);
  await expect(card.locator('[data-next-task-title-v447]')).toHaveText('Получить план помещения и проект договора');
  await page.waitForTimeout(1200);

  const saved=await page.evaluate(async locationId=>getLocationData(locationId),id);
  expect(saved.floorLocation).toBe('1-й этаж, вход с улицы');
  expect(saved.premiseCondition).toBe('Нужен косметический ремонт');
  expect(saved.tasks?.some(task=>task.title==='Получить план помещения и проект договора')).toBe(true);

  await page.evaluate(()=>renderLocations());
  await page.waitForFunction(locationId=>Boolean(document.querySelector(`[data-location-card="${CSS.escape(locationId)}"] [data-field="floorLocation"]`)&&document.querySelector(`[data-location-card="${CSS.escape(locationId)}"] .panel-toggle-v419`)&&document.querySelector(`[data-location-card="${CSS.escape(locationId)}"] [data-next-task-v447]`)),id);
  await page.waitForFunction(()=>window.BogatkaLocationPanelsV419.audit().ok&&window.BogatkaLocationGlobalV421.audit().ok);
  const audit=await page.evaluate(()=>({panels:window.BogatkaLocationPanelsV419.audit(),global:window.BogatkaLocationGlobalV421.audit()}));
  expect(audit.panels.ok,audit.panels.failures.join('\n')).toBe(true);
  expect(audit.global.ok,audit.global.failures.join('\n')).toBe(true);

  const rerendered=page.locator(`[data-location-card="${id}"]`);
  await expect(rerendered.locator('[data-field="floorLocation"]')).toHaveValue('1-й этаж, вход с улицы');
  await expect(rerendered.locator('[data-field="premiseCondition"]')).toHaveValue('Нужен косметический ремонт');
  await expect(rerendered.locator('[data-next-task-title-v447]')).toHaveText('Получить план помещения и проект договора');
  await expect(rerendered.locator('[data-field="nextAction"]')).toBeHidden();
  await expect(rerendered.locator('[data-field="inspectionBy"]')).toBeHidden();
  await expect(rerendered.locator('[data-field="premiseAvailability"]')).toBeVisible();
});

test('v421 enhancement is idempotent and does not recreate compatibility fields',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const before=await card.evaluate(element=>({
    toggleCount:element.querySelectorAll('.panel-toggle-v419').length,
    fieldCount:element.querySelectorAll('[data-field]').length,
  }));
  expect(before.toggleCount).toBe(2);

  const stable=await card.evaluate(async element=>{
    const inspectionBy=element.querySelector('[data-field="inspectionBy"]');
    const premiseAvailability=element.querySelector('[data-field="premiseAvailability"]');
    const landlordReadiness=element.querySelector('[data-field="landlordReadiness"]');
    const beforeCount=element.querySelectorAll('[data-field]').length;
    await window.BogatkaLocationOverviewV417.enhanceAll();
    await window.BogatkaLocationPanelsV419.enhanceAll({force:true});
    await window.BogatkaLocationGlobalV421.enhanceAll();
    await window.BogatkaStatusNextTaskV447.enhanceAll();
    await window.BogatkaLocationOverviewV417.enhanceAll();
    await window.BogatkaLocationPanelsV419.enhanceAll({force:true});
    await window.BogatkaLocationGlobalV421.enhanceAll();
    await window.BogatkaStatusNextTaskV447.enhanceAll();
    return {
      sameInspectionBy:inspectionBy===element.querySelector('[data-field="inspectionBy"]'),
      sameAvailability:premiseAvailability===element.querySelector('[data-field="premiseAvailability"]'),
      sameReadiness:landlordReadiness===element.querySelector('[data-field="landlordReadiness"]'),
      sameFieldCount:beforeCount===element.querySelectorAll('[data-field]').length,
      toggleCount:element.querySelectorAll('.panel-toggle-v419').length,
      nextTaskCount:element.querySelectorAll('[data-next-task-v447]').length,
      panelsAudit:window.BogatkaLocationPanelsV419.audit(),
      globalAudit:window.BogatkaLocationGlobalV421.audit(),
    };
  });
  expect(stable.sameInspectionBy).toBe(true);
  expect(stable.sameAvailability).toBe(true);
  expect(stable.sameReadiness).toBe(true);
  expect(stable.sameFieldCount).toBe(true);
  expect(stable.toggleCount).toBe(2);
  expect(stable.nextTaskCount).toBe(1);
  expect(stable.panelsAudit.ok).toBe(true);
  expect(stable.globalAudit.ok).toBe(true);
});

test('collapsible panels expose accessible state and remember it per location',async({page})=>{
  await openApp(page);
  const first=page.locator('[data-location-card]').first();
  const second=page.locator('[data-location-card]').nth(1);
  const firstToggle=first.locator('.inspection-card-v416 > .panel-toggle-v419');
  const secondToggle=second.locator('.inspection-card-v416 > .panel-toggle-v419');

  await expect(firstToggle).toHaveAttribute('aria-expanded','true');
  await firstToggle.click();
  await expect(firstToggle).toHaveAttribute('aria-expanded','false');
  await expect(secondToggle).toHaveAttribute('aria-expanded','true');

  const firstId=await first.getAttribute('data-location-card');
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.BogatkaLocationPanelsV419?.ready&&window.BogatkaLocationGlobalV421?.ready&&window.BogatkaStatusNextTaskV447?.ready);
  await page.evaluate(async()=>{
    await window.BogatkaLocationPanelsV419.enhanceAll({force:true});
    await window.BogatkaLocationGlobalV421.enhanceAll({force:true});
    await window.BogatkaStatusNextTaskV447.enhanceAll();
  });
  await page.waitForFunction(()=>window.BogatkaLocationPanelsV419.audit().ok&&window.BogatkaLocationGlobalV421.audit().ok);
  await expect(page.locator(`[data-location-card="${firstId}"] .inspection-card-v416 > .panel-toggle-v419`)).toHaveAttribute('aria-expanded','false');
});

test('phone and email fields have consistent inner spacing',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const spacing=await card.locator('[data-field="contactPhone"]').evaluate(element=>({
    phoneLeft:getComputedStyle(element).paddingLeft,
    phoneRight:getComputedStyle(element).paddingRight,
  }));
  const emailSpacing=await card.locator('[data-field="contactEmail"]').evaluate(element=>({
    emailLeft:getComputedStyle(element).paddingLeft,
    emailRight:getComputedStyle(element).paddingRight,
  }));
  expect(spacing).toEqual({phoneLeft:'12px',phoneRight:'12px'});
  expect(emailSpacing).toEqual({emailLeft:'12px',emailRight:'12px'});
});

test('report contains useful inspection details and automatic next task',async({page})=>{
  await openApp(page);
  const card=page.locator('[data-location-card]').first();
  const id=await card.getAttribute('data-location-card');
  await card.locator('[data-field="floorLocation"]').fill('Первый этаж');
  await card.locator('[data-field="premiseCondition"]').selectOption('Готово к работе');
  await card.locator('[data-field="premiseAvailability"]').selectOption('Свободно');
  await page.evaluate(async locationId=>{
    await window.BogatkaSuite.addTask(locationId,{
      title:'Запросить технический план',
      priority:'critical',
      assignee:'',
      dueDate:'',
    });
    await window.BogatkaStatusNextTaskV447.enhanceAll();
  },id);
  await expect(card.locator('[data-next-task-title-v447]')).toHaveText('Запросить технический план');
  const html=await page.evaluate(async()=>{
    await window.BogatkaStatusNextTaskV447.enhanceAll();
    return buildReportHtml();
  });
  expect(html).toContain('Параметры осмотра и следующий шаг');
  expect(html).toContain('Первый этаж');
  expect(html).toContain('Готово к работе');
  expect(html).toContain('Доступность помещения:');
  expect(html).toContain('Свободно');
  expect(html).toContain('Запросить технический план');
  expect(html).not.toContain('Осмотр проводил:');
  expect(html).not.toContain('Доступно с:');
  expect(html).not.toContain('Дата следующего действия:');
});
