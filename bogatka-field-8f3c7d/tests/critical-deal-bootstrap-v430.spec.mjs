import {test,expect} from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=430';

test('critical deal modules reach the rendered location cards',async({page})=>{
  const pageErrors=[];
  const consoleErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.stack||error.message||String(error)));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForTimeout(6000);
  const state=await page.evaluate(()=>({
    schemaVersion:window.BogatkaCriticalDeal?.VERSION||null,
    engineVersion:window.BogatkaDecisionEngine?.VERSION||null,
    decisionUiReady:Boolean(window.BogatkaDecisionUI),
    decisionUiMarker:Boolean(window.__bogatkaDecisionUIV340),
    suiteReady:Boolean(window.BogatkaSuite),
    locationCount:Array.isArray(window.locations)?window.locations.length:null,
    cardCount:document.querySelectorAll('[data-location-card]').length,
    quickGridCount:document.querySelectorAll('.quick-grid').length,
    criticalSectionCount:document.querySelectorAll('[data-critical-deal]').length,
    legacySectionCount:document.querySelectorAll('.stop-factors-v340').length,
    appHidden:document.querySelector('#app')?.classList.contains('hidden')??null,
    lockHidden:document.querySelector('#lock')?.classList.contains('hidden')??null,
    relevantScripts:[...document.scripts].map(script=>script.getAttribute('src')||'').filter(src=>/critical-deal|decision-core|decision-ui|v23\.js/.test(src)),
  }));
  console.log('CRITICAL_DEAL_BOOTSTRAP',JSON.stringify({state,pageErrors,consoleErrors}));
  const details=JSON.stringify({state,pageErrors,consoleErrors});
  expect(pageErrors,details).toEqual([]);
  expect(state.schemaVersion,details).toBe('4.3.0');
  expect(state.engineVersion,details).toBe('4.3.0');
  expect(state.decisionUiReady,details).toBe(true);
  expect(state.cardCount,details).toBeGreaterThan(0);
  expect(state.quickGridCount,details).toBeGreaterThan(0);
  expect(state.criticalSectionCount,details).toBe(state.cardCount);
  expect(state.legacySectionCount,details).toBe(0);
});
