import { test, expect } from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=400';
const PNG=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,4,0,0,0,181,28,12,2,0,0,0,11,73,68,65,84,120,218,99,252,255,31,0,2,235,1,245,143,89,111,219,0,0,0,0,73,69,78,68,174,66,96,130]);

test('photo is processed, stored and embedded into the report',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaSuite&&window.buildReportHtml));
  const locationId=await page.evaluate(()=>locations[0].id);
  const input=page.locator(`[data-photo-location="${locationId}"][data-photo-category="street"]`);
  await input.setInputFiles({name:'field-photo.png',mimeType:'image/png',buffer:PNG});
  await expect(page.locator(`[data-photos="${locationId}:street"] .photo`)).toHaveCount(1,{timeout:15000});
  const stored=await page.evaluate(async id=>{
    const photos=(await idbAll(PHOTO_STORE)).filter(photo=>photo.locationId===id);
    const html=await window.buildReportHtml();
    return {count:photos.length,type:photos[0]?.blob?.type,width:photos[0]?.width,height:photos[0]?.height,reportHasPhoto:html.includes('data:image/jpeg')};
  },locationId);
  expect(stored.count).toBe(1);
  expect(stored.type).toBe('image/jpeg');
  expect(stored.width).toBe(1);
  expect(stored.height).toBe(1);
  expect(stored.reportHasPhoto).toBe(true);
});
