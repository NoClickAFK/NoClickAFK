import { test, expect } from '@playwright/test';
const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=400';
test('photo is processed stored and included in report',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaSuite&&window.buildReportHtml));
  const id=await page.evaluate(()=>locations[0].id);
  const image=await page.screenshot({type:'png'});
  await page.locator(`[data-photo-location="${id}"][data-photo-category="street"]`).setInputFiles({name:'test.png',mimeType:'image/png',buffer:image});
  await expect(page.locator(`[data-photos="${id}:street"] .photo`)).toHaveCount(1,{timeout:20000});
  const result=await page.evaluate(async locationId=>{
    const list=(await idbAll(PHOTO_STORE)).filter(item=>item.locationId===locationId);
    const html=await buildReportHtml();
    return {count:list.length,type:list[0]?.blob?.type,width:list[0]?.width,height:list[0]?.height,embedded:html.includes('data:image/jpeg')};
  },id);
  expect(result.count).toBe(1);
  expect(result.type).toBe('image/jpeg');
  expect(result.width).toBeGreaterThan(100);
  expect(result.height).toBeGreaterThan(100);
  expect(result.embedded).toBe(true);
});
