import {test,expect} from '@playwright/test';
import fs from 'node:fs';

const ROOT='bogatka-field-8f3c7d';
const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=458';

test('stage 7 persistence rejects viewers before capture and uses the shared queue',()=>{
  const source=fs.readFileSync(`${ROOT}/traffic-competitors-persistence-v453.js`,'utf8');
  expect(source).toContain("if(isViewer())return;");
  expect(source.indexOf("if(isViewer())return;")).toBeLessThan(source.indexOf('event.stopImmediatePropagation()'));
  expect(source).toContain('BogatkaFieldIntegrityV416?.enqueueLocation');
});

test('field integrity exposes one shared per-location queue',()=>{
  const source=fs.readFileSync(`${ROOT}/field-integrity-v416.js`,'utf8');
  expect(source).toContain('function enqueueLocation(locationId,task)');
  expect(source).toContain('installSaveQueue,enqueueLocation');
});

test('stage 8 gate is refreshed after summary updates',()=>{
  const source=fs.readFileSync(`${ROOT}/durable-fields-v452.js`,'utf8');
  expect(source).toContain('BogatkaLaunchGateV454.renderAll()');
});

test('combined stages 7-10 boot and pass runtime audits',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaTrafficCompetitorsV453?.ready&&
    window.BogatkaTrafficCompetitorsPersistenceV453?.ready&&
    window.BogatkaLaunchGateV454?.ready&&
    window.BogatkaOpeningProjectV455?.ready&&
    window.BogatkaOpeningProjectPersistenceV455?.ready&&
    window.BogatkaReleaseIntegrityV456?.ready&&
    window.BogatkaWorkflowIntegrityV457?.audit().ok
  ),{timeout:30000});
  await page.waitForFunction(()=>window.BogatkaReleaseIntegrityV456.audit().ok,{timeout:30000});
  expect(await page.evaluate(()=>window.BogatkaReleaseIntegrityV456.audit())).toMatchObject({ok:true});
});
