import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=451';

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaQuickChecklistV451?.ready&&
    window.BogatkaQuickChecklistStabilityV451?.ready&&
    window.BogatkaQuickChecklistReportV451?.ready&&
    window.BogatkaLiveReport?.build?.__quickChecklistReportV451&&
    document.querySelector('[data-location-card] [data-quick-checklist-v451]')&&
    window.BogatkaQuickChecklistV451.audit().ok
  ),{timeout:30000});
  return page.locator('[data-location-card]').first();
}

function checklist(card){
  return card.locator('[data-quick-checklist-v451]');
}

async function chooseState(control,value){
  await control.evaluate((select,next)=>{
    select.value=next;
    select.dispatchEvent(new Event('change',{bubbles:true}));
  },value);
}

async function chooseStateAndWait(page,control,locationId,field,value){
  await chooseState(control,value);
  await page.waitForFunction(async ({locationId,field,value})=>{
    const data=await getLocationData(locationId);
    return getNested(data,field)===value;
  },{locationId,field,value});
}

test('quick checklist uses four explicit states instead of an ambiguous checkbox',async({page})=>{
  const card=await openApp(page);
  const block=checklist(card);
  const expected=await page.evaluate(()=>CHECKLIST.length);

  await expect(block.locator('input[type="checkbox"][data-field^="check."]')).toHaveCount(0);
  await expect(block.locator('select[data-quick-checklist-v451]')).toHaveCount(expected);
  const first=block.locator('select[data-quick-checklist-v451]').first();
  expect(await first.locator('option').allTextContents()).toEqual(['Не проверено','Да','Нет','Не требуется']);
  expect(await first.locator('option').evaluateAll(options=>options.map(option=>option.value))).toEqual(['unchecked','yes','no','not_applicable']);
  await expect(block.locator('.checklist-guide-v414')).toContainText('Для каждого пункта выберите «Да», «Нет» или «Не требуется»');
  await expect(block.locator('[data-check-summary="answered"]')).toHaveText(`0 из ${expected}`);
  await expect(page.locator('#helpModal li').filter({hasText:'Пройдите быстрый чек-лист'})).toHaveCount(1);
});

test('legacy true is shown as yes while legacy false remains not checked without rewriting stored data',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await page.evaluate(async locationId=>{
    const data=await getLocationData(locationId);
    data.check={...(data.check||{}),housing_dense:true,housing_occupied:false};
    await idbPut(STORE,data,`location:${locationId}`);
    renderLocations();
  },id);
  await page.waitForFunction(locationId=>{
    const current=document.querySelector(`[data-location-card="${CSS.escape(locationId)}"]`);
    return Boolean(current&&window.BogatkaQuickChecklistV451.audit().ok&&current.querySelector('[data-field="check.housing_dense"]')?.value==='yes');
  },id);

  const current=page.locator(`[data-location-card="${id}"]`);
  await expect(current.locator('[data-field="check.housing_dense"]')).toHaveValue('yes');
  await expect(current.locator('[data-field="check.housing_occupied"]')).toHaveValue('unchecked');
  const stored=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(stored.check.housing_dense).toBe(true);
  expect(stored.check.housing_occupied).toBe(false);
});

test('no and not-required are saved as real answered states and survive rerender and reload',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  const block=checklist(card);
  await chooseStateAndWait(page,block.locator('[data-field="check.housing_dense"]'),id,'check.housing_dense','yes');
  await chooseStateAndWait(page,block.locator('[data-field="check.housing_occupied"]'),id,'check.housing_occupied','no');
  await chooseStateAndWait(page,block.locator('[data-field="check.foot_traffic"]'),id,'check.foot_traffic','not_applicable');

  await expect(block.locator('[data-check-summary="answered"]')).toHaveText(/3 из /);
  await expect(block.locator('[data-check-summary="yes"]')).toHaveText('1');
  await expect(block.locator('[data-check-summary="no"]')).toHaveText('1');
  await expect(block.locator('[data-check-summary="not_applicable"]')).toHaveText('1');

  await page.evaluate(()=>renderLocations());
  await page.waitForFunction(locationId=>{
    const current=document.querySelector(`[data-location-card="${CSS.escape(locationId)}"]`);
    return Boolean(current&&window.BogatkaQuickChecklistV451.audit().ok&&current.querySelector('[data-field="check.housing_occupied"]')?.value==='no');
  },id);
  const rerendered=page.locator(`[data-location-card="${id}"]`);
  await expect(rerendered.locator('[data-field="check.housing_dense"]')).toHaveValue('yes');
  await expect(rerendered.locator('[data-field="check.housing_occupied"]')).toHaveValue('no');
  await expect(rerendered.locator('[data-field="check.foot_traffic"]')).toHaveValue('not_applicable');
  await expect(rerendered.locator('.quick-checklist-summary-v451')).toHaveCount(1);

  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(locationId=>{
    const current=document.querySelector(`[data-location-card="${CSS.escape(locationId)}"]`);
    return Boolean(window.BogatkaQuickChecklistV451?.audit().ok&&current?.querySelector('[data-field="check.housing_occupied"]')?.value==='no');
  },id);
  const reloaded=page.locator(`[data-location-card="${id}"]`);
  await expect(reloaded.locator('[data-field="check.housing_dense"]')).toHaveValue('yes');
  await expect(reloaded.locator('[data-field="check.housing_occupied"]')).toHaveValue('no');
  await expect(reloaded.locator('[data-field="check.foot_traffic"]')).toHaveValue('not_applicable');
});

test('HTML and PDF source show readable checklist states and preserve the authoritative report chain',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  const block=checklist(card);
  await chooseStateAndWait(page,block.locator('[data-field="check.housing_dense"]'),id,'check.housing_dense','yes');
  await chooseStateAndWait(page,block.locator('[data-field="check.housing_occupied"]'),id,'check.housing_occupied','no');
  await chooseStateAndWait(page,block.locator('[data-field="check.foot_traffic"]'),id,'check.foot_traffic','not_applicable');

  const result=await page.evaluate(async locationId=>{
    const before=await getLocationData(locationId);
    const html=await window.BogatkaLiveReport.build();
    const after=await getLocationData(locationId);
    const documentReport=new DOMParser().parseFromString(html,'text/html');
    const location=documentReport.querySelector(`[data-location-card="${CSS.escape(locationId)}"]`);
    return{
      text:location?.querySelector('[data-quick-checklist-report-v451]')?.textContent||'',
      marker:Boolean(location?.querySelector('[data-quick-checklist-report-v451]')),
      style:Boolean(documentReport.getElementById('quickChecklistReportStyleV451')),
      selects:location?.querySelectorAll('[data-quick-checklist-report-v451] select').length||0,
      values:[before.check.housing_dense,before.check.housing_occupied,before.check.foot_traffic],
      valuesAfter:[after.check.housing_dense,after.check.housing_occupied,after.check.foot_traffic],
      chain:{
        authoritative:window.buildReportHtml===window.BogatkaLiveReport.build,
        core:Boolean(window.BogatkaLiveReport.build.__quickChecklistV451),
        report:Boolean(window.BogatkaLiveReport.build.__quickChecklistReportV451),
        stage4:Boolean(window.BogatkaLiveReport.build.__technicalEconomicsReportV450),
        stability:Boolean(window.BogatkaLiveReport.build.__reportStabilityV429),
        htmlAction:window.exportHtmlReport===window.BogatkaLiveReport.build.__htmlAction,
        pdfAction:window.openPdfReport===window.BogatkaLiveReport.build.__pdfAction,
      },
    };
  },id);

  expect(result.marker).toBe(true);
  expect(result.style).toBe(true);
  expect(result.selects).toBe(0);
  expect(result.text).toContain('Да');
  expect(result.text).toContain('Нет');
  expect(result.text).toContain('Не требуется');
  expect(result.valuesAfter).toEqual(result.values);
  expect(result.chain).toEqual({authoritative:true,core:true,report:true,stage4:true,stability:true,htmlAction:true,pdfAction:true});
});

test('viewer cannot change quick checklist states',async({page})=>{
  const card=await openApp(page);
  const select=checklist(card).locator('select[data-quick-checklist-v451]').first();
  const trigger=select.locator('xpath=following-sibling::button[1]');
  await page.evaluate(()=>{
    cloudRole='viewer';
    window.BogatkaQuickChecklistV451.applyViewerState(document);
  });
  await expect(select).toBeDisabled();
  await expect(trigger).toBeDisabled();
  await page.evaluate(()=>{
    cloudRole='editor';
    window.BogatkaQuickChecklistV451.applyViewerState(document);
  });
  await expect(select).toBeEnabled();
  await expect(trigger).toBeEnabled();
});

test('stage 5 does not change the completed lease-check schema',async({page})=>{
  await openApp(page);
  const state=await page.evaluate(()=>({
    version:window.BogatkaCriticalDeal?.VERSION,
    count:window.BogatkaCriticalDeal?.CONDITIONS?.length,
    keys:window.BogatkaCriticalDeal?.CONDITIONS?.map(item=>item.key),
  }));
  expect(state.version).toBe('4.3.3');
  expect(state.count).toBe(10);
  expect(new Set(state.keys).size).toBe(10);
});
