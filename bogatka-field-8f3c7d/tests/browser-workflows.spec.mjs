import { test, expect } from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=428';

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaSuite&&
    window.BogatkaDecisionEngine&&
    window.BogatkaLiveReport?.build?.__reportAuthorityV428&&
    window.buildReportHtml===window.BogatkaLiveReport.build
  ),{timeout:20000});
  await expect(page.locator('#app')).toBeVisible();
}

test('report keeps decision-stage workflow data, removes launch workflow and excludes archive',async({page})=>{
  await openApp(page);
  const ids=await page.evaluate(()=>locations.slice(0,2).map(item=>item.id));
  await page.evaluate(async({first,second})=>{
    const now=new Date().toISOString();
    await idbPut(STORE,{updatedAt:now,status:'Оставить',decision:'Оставить',tech:{totalArea:'100',rentPerMonth:'2000'},economy:{monthlyRevenue:'30000',grossMarginPct:'40',taxRatePct:'5',payroll:'4000'},tasks:[{id:'task-report',title:'Получить проект договора',status:'doing',createdAt:now}],comments:[{id:'comment-report',text:'Проверить арендные каникулы',author:'CI',createdAt:now}],launchProject:{enabled:true,stage:'Подготовка договора',milestones:[{id:'milestone-report',title:'Договор аренды подписан',order:0,status:'doing'}]}},`location:${first}`);
    await idbPut(STORE,{updatedAt:now,archivedAt:now,notes:'ARCHIVED_MARKER'},`location:${second}`);
    const meta=locations.find(item=>item.id===second);if(meta)meta.archivedAt=now;
    await saveLocations();
  },{first:ids[0],second:ids[1]});
  const report=await page.evaluate(async()=>await window.buildReportHtml());
  expect(report).toContain('Получить проект договора');
  expect(report).toContain('Проверить арендные каникулы');
  expect(report).not.toContain('Экономическая модель и окупаемость');
  expect(report).not.toContain('Проект открытия магазина');
  expect(report).not.toContain('Договор аренды подписан');
  expect(report).not.toContain('ARCHIVED_MARKER');
});

test('viewer role disables editing controls',async({page})=>{
  await openApp(page);
  await page.evaluate(()=>{cloudRole='viewer'});
  await expect(page.locator('#addLocationBtn')).toBeDisabled({timeout:5000});
  await expect(page.locator('[data-location-card] input').first()).toBeDisabled();
});

test('app shell reloads offline after service worker activation',async({page,context})=>{
  await openApp(page);
  await page.evaluate(async()=>{if('serviceWorker'in navigator)await navigator.serviceWorker.ready});
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>!('serviceWorker'in navigator)||Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  try{
    await page.reload({waitUntil:'domcontentloaded',timeout:20000});
    await expect(page.locator('#app')).toBeVisible({timeout:10000});
    await expect(page.locator('#versionLabel')).toHaveText(/^4\.2\.\d+$/);
  }finally{await context.setOffline(false)}
});
