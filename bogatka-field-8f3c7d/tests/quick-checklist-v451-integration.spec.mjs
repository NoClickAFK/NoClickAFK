import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=451';

test('v451 quick checklist loads after stage 4 and is cached for offline use',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaTechnicalEconomicsV450?.ready&&
    window.BogatkaTechnicalEconomicsReportV450?.ready&&
    window.BogatkaQuickChecklistV451?.ready&&
    window.BogatkaQuickChecklistStabilityV451?.ready&&
    window.saveField?.__quickChecklistHistoryV451&&
    window.BogatkaQuickChecklistReportV451?.ready&&
    window.BogatkaLiveReport?.build?.__quickChecklistReportV451
  ),{timeout:30000});

  const integration=await page.evaluate(async()=>{
    const scripts=[...document.scripts].map(script=>script.getAttribute('src')||'');
    const styles=[...document.querySelectorAll('link[rel="stylesheet"]')].map(link=>link.getAttribute('href')||'');
    const stage4=scripts.findIndex(src=>src.includes('technical-economics-report-v450.js'));
    const stage5=scripts.findIndex(src=>src.includes('quick-checklist-v451.js'));
    const stability=scripts.findIndex(src=>src.includes('quick-checklist-stability-v451.js'));
    const stage5Report=scripts.findIndex(src=>src.includes('quick-checklist-report-v451.js'));
    const worker=await fetch('./sw-v340.js').then(response=>response.text());
    return{
      stage4,stage5,stability,stage5Report,
      css:styles.some(href=>href.includes('quick-checklist-v451.css')),
      cachedCss:worker.includes('./quick-checklist-v451.css'),
      cachedCore:worker.includes('./quick-checklist-v451.js'),
      cachedStability:worker.includes('./quick-checklist-stability-v451.js'),
      cachedReport:worker.includes('./quick-checklist-report-v451.js'),
      renderVersion:window.BogatkaLocationPanelsRenderV419?.version,
      idempotentSelectSync:Boolean(window.bogatkaSyncPremiumSelect?.__quickChecklistIdempotentV451),
      readableHistory:Boolean(window.saveField?.__quickChecklistHistoryV451),
    };
  });

  expect(integration.stage4).toBeGreaterThanOrEqual(0);
  expect(integration.stage5).toBeGreaterThan(integration.stage4);
  expect(integration.stability).toBeGreaterThan(integration.stage5);
  expect(integration.stage5Report).toBeGreaterThan(integration.stability);
  expect(integration.css).toBe(true);
  expect(integration.cachedCss).toBe(true);
  expect(integration.cachedCore).toBe(true);
  expect(integration.cachedStability).toBe(true);
  expect(integration.cachedReport).toBe(true);
  expect(integration.renderVersion).toBe('4.5.1');
  expect(integration.idempotentSelectSync).toBe(true);
  expect(integration.readableHistory).toBe(true);
});
