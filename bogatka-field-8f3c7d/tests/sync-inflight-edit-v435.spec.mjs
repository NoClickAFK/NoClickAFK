import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=435';
const ARTIFACT_DIR=path.resolve('review-artifacts/sync-v435-review');

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'load'});
  await page.waitForFunction(()=>window.BogatkaSyncMerge?.transportVersion==='4.3.5');
  await page.waitForFunction(()=>window.BogatkaSyncCompatibility?.version==='4.3.5');
  await page.waitForFunction(()=>typeof cloudSyncing==='undefined'||cloudSyncing===false);
}

test('cloud result preserves edits made after the write snapshot was captured',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async()=>{
    const item=locations[0];
    const id=item.id;
    const baseline={
      contact:'BASE',
      remoteOnly:'BASE',
      removedDuringWrite:'BASE',
      stable:'UNCHANGED',
      updatedAt:'2026-07-11T10:00:00.000Z',
    };
    const editedWhileRequestWasInFlight={
      contact:'USER-TYPED',
      remoteOnly:'BASE',
      stable:'UNCHANGED',
      updatedAt:'2026-07-11T10:00:01.000Z',
      cloudId:'remote-inflight',
      cloudRevision:1,
      cloudUpdatedAt:'2026-07-11T10:00:00.000Z',
    };
    const confirmedCloudData={
      contact:'BASE',
      remoteOnly:'REMOTE-UPDATED',
      removedDuringWrite:'BASE',
      stable:'UNCHANGED',
      updatedAt:'2026-07-11T10:00:00.000Z',
    };
    const row={
      id:'remote-inflight',
      client_id:id,
      revision:2,
      updated_at:'2026-07-11T10:00:02.000Z',
      form_data:confirmedCloudData,
    };

    cloudProjectId='project-inflight-v435';
    cloudSession=null;
    cloudWriteState({dirtyLocations:[],dirtyPhotos:[],deletedPhotos:{},knownLocationIds:[id],knownPhotoIds:[]});
    await window.BogatkaSyncState.rawPut()(STORE,editedWhileRequestWasInFlight,`location:${id}`);
    window.BogatkaSyncCompatibility._test.resetDiagnostics();

    const saveResult=await window.BogatkaSyncCompatibility._test.saveLocal(id,confirmedCloudData,row,baseline);
    const stored=await getLocationData(id);
    const state=cloudReadState();
    return {
      id,
      saveResult,
      stored,
      dirtyLocations:state.dirtyLocations||[],
      diagnostics:window.BogatkaSyncCompatibility.diagnostics,
    };
  });

  expect(result.saveResult).toEqual({saved:true,inFlightChanged:true});
  expect(result.stored.contact).toBe('USER-TYPED');
  expect(result.stored.remoteOnly).toBe('REMOTE-UPDATED');
  expect(result.stored.stable).toBe('UNCHANGED');
  expect(result.stored).not.toHaveProperty('removedDuringWrite');
  expect(result.stored).toMatchObject({
    cloudId:'remote-inflight',
    cloudRevision:2,
    cloudUpdatedAt:'2026-07-11T10:00:02.000Z',
  });
  expect(result.dirtyLocations).toContain(result.id);
  expect(result.diagnostics.inFlightLocalMerges).toBe(1);

  mkdirSync(ARTIFACT_DIR,{recursive:true});
  writeFileSync(path.join(ARTIFACT_DIR,'11-inflight-local-edit.json'),JSON.stringify(result,null,2));
});
