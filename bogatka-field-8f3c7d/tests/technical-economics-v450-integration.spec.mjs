import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=450';

test('v450 loads after stage 3 and is available to the service worker',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaTechnicalEconomicsV450?.ready),{timeout:25000});

  const integration=await page.evaluate(async()=>{
    const scripts=[...document.scripts].map(script=>script.getAttribute('src')||'');
    const stage3=scripts.findIndex(src=>src.includes('landlord-conditions-v449.js'));
    const stage4=scripts.findIndex(src=>src.includes('technical-economics-v450.js'));
    const worker=await fetch('./sw-v340.js').then(response=>response.text());
    return{stage3,stage4,cached:worker.includes('./technical-economics-v450.js')};
  });

  expect(integration.stage3).toBeGreaterThanOrEqual(0);
  expect(integration.stage4).toBeGreaterThan(integration.stage3);
  expect(integration.cached).toBe(true);
});
