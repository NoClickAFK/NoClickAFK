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
  await page.waitForFunction(()=>{
    const authority=window.BogatkaPanelAuthorityV437;
    if(!authority)return true;
    const diagnostics=authority.diagnostics;
    return diagnostics.cloudBackgroundCompletions+diagnostics.cloudBackgroundErrors>0;
  },{timeout:20000});
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
      id,item,archived,{expectedPreviousState:archived,syncState},
    ).then(value=>{order.push('prepush-write-completed');return value});

    await Promise.resolve();
    const prePushCompletedBeforeRestore=order.includes('prepush-write-completed');
    releaseRestore();
    const [,writeResult]=await Promise.all([queuedRestore,prePushWrite]);
    const stored=await getLocationData(id);

    return{
      prePushCompletedBeforeRestore,order,stored,metaArchivedAt:item.archivedAt,
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
    try{ensureResult=api.ensureArchiveScript()}
    finally{
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

    return{ensureResult,failedNodeRemoved,retryCreated,retrySrc:retryScript?.getAttribute('src')||'',pendingBeforeError,retryMarkedFailed,pendingClearedAfterError,failuresBefore,failuresAfter};
  });

  expect(result).toMatchObject({ensureResult:true,failedNodeRemoved:true,retryCreated:true,retrySrc:'./archive-state-v436.js',pendingBeforeError:true,retryMarkedFailed:true,pendingClearedAfterError:true});
  expect(result.failuresAfter).toBe(result.failuresBefore+1);
  evidence('14-bootstrap-script-retry.json',result);
});

test('base-aware build context keeps unrelated local edits without undoing collaborator archive changes',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async({archivedAt})=>{
    const id='base-aware-archive-merge';
    cloudSession={user:{id:'base-aware-user'}};
    cloudProjectId='project-base-aware';
    const item={id,title:'Base-aware fixture',address:'Гродно',custom:true,archivedAt:null};
    locations=[item];
    await window.BogatkaSyncState.rawPut()(STORE,{contact:'LOCAL-EDIT',archivedAt:null},`location:${id}`);
    await window.BogatkaSyncState.rawPut()(STORE,locations,'meta:locations');
    await window.BogatkaSyncState.writeBase(id,{
      revision:10,updatedAt:'2026-07-11T12:00:00.000Z',
      formData:{contact:'BASE',archivedAt:null},
      meta:{title:item.title,address:item.address,note:'',sortOrder:0,archivedAt:null},
    });
    const remoteArchive={
      id:'remote-base-aware',project_id:cloudProjectId,client_id:id,title:item.title,address:item.address,note:null,
      status:null,object_type:null,form_data:{contact:'BASE',archivedAt},sort_order:0,archived_at:archivedAt,
      revision:11,updated_at:'2026-07-11T12:05:00.000Z',
    };
    const archiveContext=await window.BogatkaSyncCompatibility._test.buildContext(item,0,remoteArchive,{dirtyLocations:[id],metaDirty:false});

    item.archivedAt=archivedAt;
    await window.BogatkaSyncState.rawPut()(STORE,{contact:'LOCAL-EDIT-2',archivedAt},`location:${id}`);
    await window.BogatkaSyncState.writeBase(id,{
      revision:20,updatedAt:'2026-07-11T12:10:00.000Z',
      formData:{contact:'BASE-2',archivedAt},
      meta:{title:item.title,address:item.address,note:'',sortOrder:0,archivedAt},
    });
    const remoteRestore={...remoteArchive,form_data:{contact:'BASE-2',archivedAt:null},archived_at:null,revision:21,updated_at:'2026-07-11T12:15:00.000Z'};
    const restoreContext=await window.BogatkaSyncCompatibility._test.buildContext(item,0,remoteRestore,{dirtyLocations:[id],metaDirty:false});

    return{
      archive:{merged:archiveContext.merged,payload:archiveContext.payload,needsPush:archiveContext.needsPush},
      restore:{merged:restoreContext.merged,payload:restoreContext.payload,needsPush:restoreContext.needsPush},
    };
  },{archivedAt:ARCHIVED_AT});

  expect(result.archive.merged).toMatchObject({contact:'LOCAL-EDIT',archivedAt:ARCHIVED_AT});
  expect(result.archive.payload).toMatchObject({archived_at:ARCHIVED_AT,form_data:{contact:'LOCAL-EDIT',archivedAt:ARCHIVED_AT}});
  expect(result.archive.needsPush).toBe(true);
  expect(result.restore.merged).toMatchObject({contact:'LOCAL-EDIT-2',archivedAt:null});
  expect(result.restore.payload).toMatchObject({archived_at:null,form_data:{contact:'LOCAL-EDIT-2',archivedAt:null}});
  expect(result.restore.needsPush).toBe(true);
  evidence('15-base-aware-build-context.json',result);
});

test('newer archive intent survives the current pass dirty clear and clears only after confirmed follow-up',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async({archivedAt})=>{
    const id='post-pass-dirty-carry';
    const archived={kind:'archived',known:true,value:archivedAt};
    const active={kind:'active',known:true,value:null};
    const item={id,title:'Post-pass carry fixture',address:'Гродно',custom:true,archivedAt:null};
    locations=[item];
    await window.BogatkaSyncState.rawPut()(STORE,{contact:'UNCHANGED',archivedAt:null},`location:${id}`);
    await window.BogatkaSyncState.rawPut()(STORE,locations,'meta:locations');
    cloudWriteState({...cloudReadState(),dirtyLocations:[]});
    const syncState={dirtyLocations:[]};

    const staleWrite=await window.BogatkaArchiveStateV436._test.writeLocalState(
      id,item,archived,{expectedPreviousState:archived,syncState},
    );
    const beforeClear=cloudReadState().dirtyLocations||[];
    cloudWriteState({...cloudReadState(),dirtyLocations:[]});
    const afterCurrentPassClear=cloudReadState().dirtyLocations||[];

    const confirmedWrite=await window.BogatkaArchiveStateV436._test.writeLocalState(
      id,item,active,{expectedPreviousState:active,syncState},
    );
    const confirmed=window.BogatkaArchiveStateV436._test.confirmDirtyAfterPass(id,active,confirmedWrite);
    cloudWriteState({...cloudReadState(),dirtyLocations:[]});
    const afterConfirmedClear=cloudReadState().dirtyLocations||[];
    const stored=await getLocationData(id);

    return{
      staleSelected:staleWrite.result.state,
      staleInFlight:staleWrite.result.inFlightArchiveChanged,
      beforeClear,afterCurrentPassClear,confirmed,afterConfirmedClear,stored,
      carry:window.BogatkaArchiveStateV436._test.postPassDirtyIds,
      diagnostics:window.BogatkaArchiveStateV436.diagnostics,
    };
  },{archivedAt:ARCHIVED_AT});

  expect(result.staleSelected).toEqual({kind:'active',known:true,value:null});
  expect(result.staleInFlight).toBe(true);
  expect(result.beforeClear).toContain('post-pass-dirty-carry');
  expect(result.afterCurrentPassClear).toContain('post-pass-dirty-carry');
  expect(result.confirmed).toBe(true);
  expect(result.afterConfirmedClear).not.toContain('post-pass-dirty-carry');
  expect(result.stored).toMatchObject({contact:'UNCHANGED',archivedAt:null});
  expect(result.carry).toEqual([]);
  expect(result.diagnostics.postPassDirtyPreserved).toBeGreaterThanOrEqual(1);
  expect(result.diagnostics.postPassDirtyConfirmed).toBeGreaterThanOrEqual(1);
  evidence('16-post-pass-dirty-carry.json',result);
});

test('late cloud-archive load delegates to v4.3.6 and legacy replacement is rebound',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async()=>{
    const diagnosticsBefore=window.BogatkaArchiveStateV436.diagnostics.runtimeWrapperRebinds;
    window.__bogatkaCloudArchiveV400=false;
    const script=document.createElement('script');
    script.src=`./cloud-archive-v400.js?late-v436=${Date.now()}`;
    script.async=false;
    await new Promise((resolve,reject)=>{
      script.onload=resolve;
      script.onerror=()=>reject(new Error('Late cloud archive fixture failed to load'));
      document.head.appendChild(script);
    });
    await new Promise(resolve=>setTimeout(resolve,20));
    const afterActualLoad={
      delegated:window.BogatkaCloudArchive?.delegatedToV436,
      lateLoadProtected:window.BogatkaCloudArchive?.lateLoadProtected,
      applyV436:Boolean(cloudApplyRemote?.__archiveStateV436),
      pushV436:Boolean(cloudPushLocations?.__archiveStateV436),
    };

    const fakeApply=async function cloudApplyRemoteWithArchive(){};
    const fakePush=async function cloudPushLocationsWithArchive(){return[]};
    fakeApply.__cloudArchiveV400=true;
    fakePush.__cloudArchiveV400=true;
    cloudApplyRemote=fakeApply;window.cloudApplyRemote=fakeApply;
    cloudPushLocations=fakePush;window.cloudPushLocations=fakePush;
    window.dispatchEvent(new CustomEvent('bogatka:cloud-archive-loaded',{detail:{delegatedToV436:false}}));
    await new Promise(resolve=>setTimeout(resolve,20));

    return{
      afterActualLoad,
      applyRecovered:Boolean(cloudApplyRemote?.__archiveStateV436),
      pushRecovered:Boolean(cloudPushLocations?.__archiveStateV436),
      fakeApplyStillInstalled:cloudApplyRemote===fakeApply,
      fakePushStillInstalled:cloudPushLocations===fakePush,
      rebindsBefore:diagnosticsBefore,
      rebindsAfter:window.BogatkaArchiveStateV436.diagnostics.runtimeWrapperRebinds,
    };
  });

  expect(result.afterActualLoad).toMatchObject({delegated:true,lateLoadProtected:true,applyV436:true,pushV436:true});
  expect(result.applyRecovered).toBe(true);
  expect(result.pushRecovered).toBe(true);
  expect(result.fakeApplyStillInstalled).toBe(false);
  expect(result.fakePushStillInstalled).toBe(false);
  expect(result.rebindsAfter).toBeGreaterThan(result.rebindsBefore);
  evidence('17-late-cloud-archive-wrapper-protection.json',result);
});
