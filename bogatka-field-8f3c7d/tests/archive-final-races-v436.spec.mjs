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
  await page.waitForFunction(()=>window.BogatkaArchiveStateV436?.ready===true);
}

test('pre-push queued restore intent wins over the earlier archived snapshot',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async({archivedAt})=>{
    const id='prepush-queued-intent';
    const archived={kind:'archived',known:true,value:archivedAt};
    const item={id,title:'Pre-push race fixture',address:'Гродно',custom:true,archivedAt};
    locations=[item];
    await window.BogatkaSyncState.rawPut()(STORE,{contact:'B',archivedAt},`location:${id}`);
    await window.BogatkaSyncState.rawPut()(STORE,locations,'meta:locations');
    const syncState={dirtyLocations:[id]};
    const order=[];
    let releaseRestore;
    let restoreStarted;
    const restoreStart=new Promise(resolve=>{restoreStarted=resolve});
    const restoreGate=new Promise(resolve=>{releaseRestore=resolve});
    const rawPut=window.BogatkaSyncState.rawPut();

    const queuedRestore=window.BogatkaFieldIntegrityV416.enqueueLocation(id,async()=>{
      order.push('restore-started');
      restoreStarted();
      await restoreGate;
      const latest=await getLocationData(id);
      latest.archivedAt=null;
      item.archivedAt=null;
      await rawPut(STORE,latest,`location:${id}`);
      order.push('restore-completed');
    });

    await restoreStart;
    const prePushWrite=window.BogatkaArchiveStateV436._test.writeLocalState(
      id,
      item,
      archived,
      {expectedPreviousState:archived,syncState},
    ).then(value=>{order.push('prepush-write-completed');return value});

    await Promise.resolve();
    const prePushCompletedBeforeRestore=order.includes('prepush-write-completed');
    releaseRestore();
    const [,writeResult]=await Promise.all([queuedRestore,prePushWrite]);
    const stored=await getLocationData(id);

    return{
      prePushCompletedBeforeRestore,
      order,
      stored,
      metaArchivedAt:item.archivedAt,
      selectedState:writeResult.result.state,
      inFlightArchiveChanged:writeResult.result.inFlightArchiveChanged,
      dirtyLocations:syncState.dirtyLocations,
      inFlightArchiveIntents:window.BogatkaArchiveStateV436.diagnostics.inFlightArchiveIntents,
    };
  },{archivedAt:ARCHIVED_AT});

  expect(result.prePushCompletedBeforeRestore).toBe(false);
  expect(result.order).toEqual(['restore-started','restore-completed','prepush-write-completed']);
  expect(result.stored).toMatchObject({contact:'B',archivedAt:null});
  expect(result.metaArchivedAt).toBeNull();
  expect(result.selectedState).toEqual({kind:'active',known:true,value:null});
  expect(result.inFlightArchiveChanged).toBe(true);
  expect(result.dirtyLocations).toContain('prepush-queued-intent');
  expect(result.inFlightArchiveIntents).toBeGreaterThanOrEqual(1);
  evidence('13-prepush-queued-intent-preserved.json',result);
});

test('failed archive bootstrap node is removed and a retry script is created',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(()=>{
    const api=window.BogatkaSyncFieldCompatV416._test;
    const originalArchive=window.BogatkaArchiveStateV436;
    const existing=[...document.scripts].find(script=>script.src.includes('archive-state-v436.js'));
    if(!existing)throw new Error('Archive script fixture is missing');
    const originalAppend=document.head.appendChild;
    let retryScript=null;
    const failuresBefore=api.archiveScriptFailures;

    window.BogatkaArchiveStateV436=null;
    existing.dataset.archiveLoadFailedV436='1';
    document.head.appendChild=function(node){retryScript=node;return node};
    let ensureResult=false;
    try{
      ensureResult=api.ensureArchiveScript();
    }finally{
      document.head.appendChild=originalAppend;
      window.BogatkaArchiveStateV436=originalArchive;
    }

    const failedNodeRemoved=!existing.isConnected;
    const retryCreated=Boolean(retryScript);
    const pendingBeforeError=retryScript?.dataset.archiveLoadPendingV436==='1';
    retryScript?.onerror?.(new Event('error'));
    const retryMarkedFailed=retryScript?.dataset.archiveLoadFailedV436==='1';
    const pendingClearedAfterError=!retryScript?.dataset.archiveLoadPendingV436;
    const failuresAfter=api.archiveScriptFailures;

    delete existing.dataset.archiveLoadFailedV436;
    if(!existing.isConnected)originalAppend.call(document.head,existing);

    return{
      ensureResult,
      failedNodeRemoved,
      retryCreated,
      retrySrc:retryScript?.getAttribute('src')||'',
      pendingBeforeError,
      retryMarkedFailed,
      pendingClearedAfterError,
      failuresBefore,
      failuresAfter,
    };
  });

  expect(result).toMatchObject({
    ensureResult:true,
    failedNodeRemoved:true,
    retryCreated:true,
    retrySrc:'./archive-state-v436.js',
    pendingBeforeError:true,
    retryMarkedFailed:true,
    pendingClearedAfterError:true,
  });
  expect(result.failuresAfter).toBe(result.failuresBefore+1);
  evidence('14-bootstrap-script-retry.json',result);
});

test('unrelated local edits do not override a remote archive state that differs from the sync base',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(({archivedAt})=>{
    const Merge=window.BogatkaSyncMerge;
    const remoteArchive=Merge.merge(
      {contact:'A',archivedAt:null},
      {contact:'B',archivedAt:null},
      {contact:'A',archivedAt},
      {preferLocal:true},
    );
    const remoteRestore=Merge.merge(
      {contact:'A',archivedAt},
      {contact:'B',archivedAt},
      {contact:'A',archivedAt:null},
      {preferLocal:true},
    );
    const explicitLocalRestore=Merge.merge(
      {contact:'A',archivedAt},
      {contact:'B',archivedAt:null},
      {contact:'A',archivedAt},
      {preferLocal:true},
    );
    return{remoteArchive,remoteRestore,explicitLocalRestore};
  },{archivedAt:ARCHIVED_AT});

  expect(result.remoteArchive).toMatchObject({contact:'B',archivedAt:ARCHIVED_AT});
  expect(result.remoteRestore).toMatchObject({contact:'B',archivedAt:null});
  expect(result.explicitLocalRestore).toMatchObject({contact:'B',archivedAt:null});
  evidence('15-archive-merge-respects-sync-base.json',result);
});
