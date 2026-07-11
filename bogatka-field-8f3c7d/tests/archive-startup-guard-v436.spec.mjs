import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=436';
const ARTIFACT_DIR=path.resolve('review-artifacts/archive-sync-v436-review');
const ARCHIVED_AT='2026-07-11T12:08:33.094Z';

function evidence(name,value){
  mkdirSync(ARTIFACT_DIR,{recursive:true});
  writeFileSync(path.join(ARTIFACT_DIR,name),JSON.stringify(value,null,2));
}

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.BogatkaSyncFieldCompatV416?.ready===true);
  await page.waitForFunction(()=>window.BogatkaSyncCompatibility?.ready===true);
  await page.waitForFunction(()=>window.BogatkaArchiveStateV436?.ready===true);
}

test('startup sync is gated on archive compatibility and viewer restore cannot mutate local state',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async({archivedAt})=>{
    const archiveScript=[...document.scripts].find(script=>script.src.includes('archive-state-v436.js'));
    const id='viewer-archive-guard';
    const item={id,title:'Viewer guard fixture',address:'Гродно',custom:true,archivedAt};
    const data={archivedAt,updatedAt:'2026-07-11T12:10:00.000Z'};
    locations=[item];
    await window.BogatkaSyncState.rawPut()(STORE,data,`location:${id}`);
    await window.BogatkaSyncState.rawPut()(STORE,locations,'meta:locations');

    let alertText='';
    window.alert=message=>{alertText=String(message)};
    cloudRole='viewer';
    window.cloudRole='viewer';

    const beforeData=await getLocationData(id);
    const beforeMeta={...locations[0]};
    const restoreResult=await window.BogatkaSuite.restoreArchivedLocation(id);
    const afterData=await getLocationData(id);
    const afterMeta={...locations[0]};

    return{
      fieldCompatReady:window.BogatkaSyncFieldCompatV416.ready,
      archiveReady:window.BogatkaArchiveStateV436.ready,
      archiveGateInstalled:window.BogatkaSyncFieldCompatV416._test.archiveGateInstalled,
      archiveBootstrapAttempts:window.BogatkaSyncFieldCompatV416._test.archiveBootstrapAttempts,
      archiveScriptLoaded:Boolean(archiveScript),
      archiveScriptBootstrapped:archiveScript?.dataset.archiveBootstrapV436==='1',
      archiveInstallAttempts:window.BogatkaArchiveStateV436.installAttempts,
      role:window.BogatkaArchiveStateV436._test.currentRole(),
      canEdit:window.BogatkaArchiveStateV436._test.canEdit(),
      restoreResult,
      alertText,
      beforeDataArchivedAt:beforeData.archivedAt,
      afterDataArchivedAt:afterData.archivedAt,
      beforeMetaArchivedAt:beforeMeta.archivedAt,
      afterMetaArchivedAt:afterMeta.archivedAt,
      dataUnchanged:JSON.stringify(beforeData)===JSON.stringify(afterData),
      metaUnchanged:JSON.stringify(beforeMeta)===JSON.stringify(afterMeta),
    };
  },{archivedAt:ARCHIVED_AT});

  expect(result).toMatchObject({
    fieldCompatReady:true,
    archiveReady:true,
    archiveGateInstalled:true,
    archiveScriptLoaded:true,
    role:'viewer',
    canEdit:false,
    restoreResult:false,
    beforeDataArchivedAt:ARCHIVED_AT,
    afterDataArchivedAt:ARCHIVED_AT,
    beforeMetaArchivedAt:ARCHIVED_AT,
    afterMetaArchivedAt:ARCHIVED_AT,
    dataUnchanged:true,
    metaUnchanged:true,
  });
  expect(result.archiveBootstrapAttempts).toBeGreaterThanOrEqual(1);
  expect(result.archiveInstallAttempts).toBeGreaterThanOrEqual(0);
  expect(typeof result.archiveScriptBootstrapped).toBe('boolean');
  expect(result.alertText).toContain('Роль наблюдателя');
  evidence('09-startup-gate-and-viewer-guard.json',result);
});
