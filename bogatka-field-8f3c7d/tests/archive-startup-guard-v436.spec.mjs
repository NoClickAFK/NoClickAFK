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

test('startup sync is persistently gated on archive compatibility and viewer restore cannot mutate local state',async({page})=>{
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
      installerPersistent:window.BogatkaArchiveStateV436.installerPersistent,
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
    installerPersistent:true,
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

test('archive state write runs after a queued same-location edit and preserves the edited fields',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async({archivedAt})=>{
    const id='archive-queue-race';
    const item={id,title:'Queue race fixture',address:'Гродно',custom:true,archivedAt:null};
    locations=[item];
    await window.BogatkaSyncState.rawPut()(STORE,{contact:'A',note:'stable',archivedAt:null},`location:${id}`);
    await window.BogatkaSyncState.rawPut()(STORE,locations,'meta:locations');

    const order=[];
    let releaseUser;
    let userStarted;
    const userStart=new Promise(resolve=>{userStarted=resolve});
    const userGate=new Promise(resolve=>{releaseUser=resolve});
    const rawPut=window.BogatkaSyncState.rawPut();

    const userSave=window.BogatkaFieldIntegrityV416.enqueueLocation(id,async()=>{
      order.push('user-save-started');
      userStarted();
      await userGate;
      const latest=await getLocationData(id);
      latest.contact='B';
      latest.userEditToken='queued-during-archive-sync';
      await rawPut(STORE,latest,`location:${id}`);
      order.push('user-save-completed');
    });

    await userStart;
    const archiveSave=window.BogatkaArchiveStateV436._test.writeLocalState(
      id,
      item,
      {kind:'archived',known:true,value:archivedAt},
    ).then(()=>order.push('archive-write-completed'));

    await Promise.resolve();
    const archiveCompletedBeforeRelease=order.includes('archive-write-completed');
    const pendingBeforeRelease=window.BogatkaFieldIntegrityV416.pendingLocations.includes(id);
    releaseUser();
    await Promise.all([userSave,archiveSave]);

    const stored=await getLocationData(id);
    return{
      archiveCompletedBeforeRelease,
      pendingBeforeRelease,
      order,
      stored,
      metaArchivedAt:item.archivedAt,
      queuedLocationWrites:window.BogatkaArchiveStateV436.diagnostics.queuedLocationWrites,
    };
  },{archivedAt:ARCHIVED_AT});

  expect(result.archiveCompletedBeforeRelease).toBe(false);
  expect(result.pendingBeforeRelease).toBe(true);
  expect(result.order).toEqual(['user-save-started','user-save-completed','archive-write-completed']);
  expect(result.stored).toMatchObject({
    contact:'B',
    note:'stable',
    userEditToken:'queued-during-archive-sync',
    archivedAt:ARCHIVED_AT,
  });
  expect(result.metaArchivedAt).toBe(ARCHIVED_AT);
  expect(result.queuedLocationWrites).toBeGreaterThanOrEqual(1);
  evidence('10-queued-edit-preserved.json',result);
});

test('a newer local restore intent survives a stale archived cloud confirmation',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async({archivedAt})=>{
    const id='archive-intent-race';
    const expectedArchived={kind:'archived',known:true,value:archivedAt};
    const item={id,title:'Archive intent race fixture',address:'Гродно',custom:true,archivedAt:null};
    locations=[item];
    await window.BogatkaSyncState.rawPut()(STORE,{contact:'B',archivedAt:null},`location:${id}`);
    await window.BogatkaSyncState.rawPut()(STORE,locations,'meta:locations');
    const syncState={dirtyLocations:[]};

    const writeResult=await window.BogatkaArchiveStateV436._test.writeLocalState(
      id,
      item,
      expectedArchived,
      {expectedPreviousState:expectedArchived,syncState},
    );

    const stored=await getLocationData(id);
    return{
      stored,
      metaArchivedAt:item.archivedAt,
      selectedState:writeResult.result.state,
      inFlightArchiveChanged:writeResult.result.inFlightArchiveChanged,
      dirtyLocations:syncState.dirtyLocations,
      inFlightArchiveIntents:window.BogatkaArchiveStateV436.diagnostics.inFlightArchiveIntents,
    };
  },{archivedAt:ARCHIVED_AT});

  expect(result.stored).toMatchObject({contact:'B',archivedAt:null});
  expect(result.metaArchivedAt).toBeNull();
  expect(result.selectedState).toEqual({kind:'active',known:true,value:null});
  expect(result.inFlightArchiveChanged).toBe(true);
  expect(result.dirtyLocations).toEqual(['archive-intent-race']);
  expect(result.inFlightArchiveIntents).toBeGreaterThanOrEqual(1);
  evidence('11-newer-archive-intent-preserved.json',result);
});

test('explicit restore marks the location dirty and wins without a prior sync base',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async({archivedAt})=>{
    const id='restore-dirty-without-base';
    const projectId='project-restore-dirty';
    const item={id,title:'Restore dirty fixture',address:'Гродно',custom:true,archivedAt};
    const data={contact:'B',archivedAt,updatedAt:'2026-07-11T12:10:00.000Z'};
    const remote={
      id:'remote-restore-dirty',project_id:projectId,client_id:id,title:item.title,address:item.address,note:null,
      status:null,object_type:null,form_data:{contact:'B',archivedAt},sort_order:0,archived_at:archivedAt,
      revision:4,updated_at:'2026-07-11T12:08:33.094Z',
    };

    cloudProjectId=projectId;
    cloudRole='editor';
    window.cloudRole='editor';
    locations=[item];
    await window.BogatkaSyncState.rawPut()(STORE,data,`location:${id}`);
    await window.BogatkaSyncState.rawPut()(STORE,locations,'meta:locations');
    await window.BogatkaSyncState.deleteBase(id);
    const initialState=cloudReadState();
    initialState.dirtyLocations=[];
    initialState.metaDirty=false;
    cloudWriteState(initialState);

    const restoreResult=await window.BogatkaSuite.restoreArchivedLocation(id);
    clearTimeout(cloudSyncTimer);
    const trackedState=cloudReadState();
    const restoredData=await getLocationData(id);
    const context=await window.BogatkaSyncCompatibility._test.buildContext(item,0,remote,trackedState);

    return{
      restoreResult,
      dirtyLocations:trackedState.dirtyLocations,
      restoredData,
      metaArchivedAt:item.archivedAt,
      baseExists:Boolean(await window.BogatkaSyncState.readBase(id)),
      payloadArchivedAt:context.payload.archived_at,
      formArchivedAt:context.payload.form_data.archivedAt,
      needsPush:context.needsPush,
    };
  },{archivedAt:ARCHIVED_AT});

  expect(result.restoreResult).toBe(true);
  expect(result.dirtyLocations).toContain('restore-dirty-without-base');
  expect(result.restoredData).toMatchObject({contact:'B',archivedAt:null});
  expect(result.metaArchivedAt).toBeNull();
  expect(result.baseExists).toBe(false);
  expect(result.payloadArchivedAt).toBeNull();
  expect(result.formArchivedAt).toBeNull();
  expect(result.needsPush).toBe(true);
  evidence('12-restore-dirty-without-base.json',result);
});
