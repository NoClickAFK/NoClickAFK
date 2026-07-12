import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=435';
const ARTIFACT_DIR=path.resolve('review-artifacts/sync-v435-review');

function writeEvidence(name,value){
  mkdirSync(ARTIFACT_DIR,{recursive:true});
  writeFileSync(path.join(ARTIFACT_DIR,name),JSON.stringify(value,null,2));
}

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'load'});
  await page.waitForFunction(()=>window.BogatkaSyncMerge?.transportVersion==='4.3.5');
  await page.waitForFunction(()=>window.BogatkaSyncCompatibility?.version==='4.3.5');
  await page.waitForFunction(()=>window.BogatkaFieldIntegrityV416?.ready===true);
  await page.waitForFunction(()=>typeof cloudSyncing==='undefined'||cloudSyncing===false);
}

test('in-flight same-location edit survives and converges in one coalesced follow-up',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async()=>{
    const api=window.BogatkaSyncCompatibility._test;
    const State=window.BogatkaSyncState;
    const item={id:'inflight-location-v435',title:'Fixture location',address:'Fixture address',note:''};
    const initialRemote={
      id:'remote-inflight-v435',project_id:'project-inflight-v435',client_id:item.id,
      title:item.title,address:item.address,note:null,status:null,object_type:null,
      form_data:{contact:'REMOTE-OLD',stable:'UNCHANGED'},sort_order:0,archived_at:null,
      revision:1,updated_at:'2026-07-11T10:00:00.000Z',
    };
    const capturedLocal={
      contact:'A',stable:'UNCHANGED',updatedAt:'2026-07-11T10:00:01.000Z',
      cloudId:initialRemote.id,cloudRevision:1,cloudUpdatedAt:initialRemote.updated_at,
    };
    const editedWhilePending={
      contact:'B',stable:'UNCHANGED',updatedAt:'2026-07-11T10:00:02.000Z',
      cloudId:initialRemote.id,cloudRevision:1,cloudUpdatedAt:initialRemote.updated_at,
    };

    clearTimeout(cloudSyncTimer);
    clearTimeout(cloudRealtimeTimer);
    locations=[item];
    cloudProjectId=initialRemote.project_id;
    cloudSession={user:{id:'fixture-user-v435'}};
    cloudRole='owner';
    cloudSyncing=false;
    cloudWriteState({
      dirtyLocations:[item.id],dirtyPhotos:[],deletedPhotos:{},knownLocationIds:[item.id],knownPhotoIds:[],
      stateDirty:false,metaDirty:false,
    });
    await State.rawPut()(STORE,capturedLocal,`location:${item.id}`);
    await State.rawPut()(STORE,locations,'meta:locations');
    await State.writeBase(item.id,{
      revision:initialRemote.revision,updatedAt:initialRemote.updated_at,
      formData:structuredClone(initialRemote.form_data),
      meta:{title:item.title,address:item.address,note:'',sortOrder:0,archivedAt:null},
    });
    api.resetDiagnostics();

    let currentRemote=structuredClone(initialRemote);
    let releaseFirstWrite;
    let firstWriteStarted;
    const firstWriteGate=new Promise(resolve=>{releaseFirstWrite=resolve});
    const firstWriteStartedGate=new Promise(resolve=>{firstWriteStarted=resolve});
    const patchPayloads=[];
    const passStartDirty=[];
    const afterPushDirty=[];
    let activeRequests=0;
    let maxParallelRequests=0;
    let fetchCalls=0;

    cloudEnsureProject=async()=>{
      passStartDirty.push([...(cloudReadState().dirtyLocations||[])]);
    };
    const fixtureFetch=async()=>{
      fetchCalls++;
      return {remoteLocations:[structuredClone(currentRemote)],remotePhotos:[],remoteState:null};
    };
    fixtureFetch.__archiveInclusiveFetchV400=true;
    fixtureFetch.__archiveFetchSourceKindV436='archive-inclusive';
    window.BogatkaSyncFieldCompatV416.installFetchAuthority(fixtureFetch,{reason:'v435-inflight-test-fixture'});
    cloudApplyRemote=async()=>{};
    cloudDeleteRemovedLocations=async()=>{};
    cloudDeletePhotos=async()=>{};
    cloudPushProjectState=async()=>{};
    cloudPushPhotos=async()=>{
      afterPushDirty.push([...(cloudReadState().dirtyLocations||[])]);
    };
    cloudSubscribeRealtime=async()=>{};

    const makeBuilder=resolver=>{
      const builder={
        eq(){return builder},
        select(){return builder},
        maybeSingle:resolver,
        single:resolver,
      };
      return builder;
    };
    cloudClient={
      from(table){
        if(table!=='locations')throw new Error(`Unexpected table: ${table}`);
        return {
          update(payload){
            return makeBuilder(async()=>{
              patchPayloads.push(structuredClone(payload));
              activeRequests++;
              maxParallelRequests=Math.max(maxParallelRequests,activeRequests);
              try{
                if(patchPayloads.length===1){
                  firstWriteStarted();
                  await firstWriteGate;
                }
                const nextRevision=currentRemote.revision+1;
                currentRemote={
                  ...currentRemote,
                  status:payload.status,object_type:payload.object_type,
                  form_data:structuredClone(payload.form_data),
                  sort_order:payload.sort_order,archived_at:payload.archived_at,
                  revision:nextRevision,
                  updated_at:`2026-07-11T10:00:0${nextRevision}.000Z`,
                };
                return {data:structuredClone(currentRemote),error:null};
              }finally{
                activeRequests--;
              }
            });
          },
          upsert(){throw new Error('Unexpected location upsert')},
          select(){return makeBuilder(async()=>({data:structuredClone(currentRemote),error:null}))},
        };
      },
    };

    const firstSync=cloudSyncAll();
    await firstWriteStartedGate;
    await State.rawPut()(STORE,editedWhilePending,`location:${item.id}`);
    cloudMarkLocationDirty(item.id);
    const coalescedSync=cloudSyncAll();
    const reusedPromise=firstSync===coalescedSync;
    releaseFirstWrite();
    await Promise.all([firstSync,coalescedSync]);

    const stored=await getLocationData(item.id);
    const base=await State.readBase(item.id);
    const finalState=cloudReadState();
    return {
      reusedPromise,
      patchContacts:patchPayloads.map(payload=>payload.form_data.contact),
      patchCount:patchPayloads.length,
      fetchCalls,
      maxParallelRequests,
      passStartDirty,
      afterPushDirty,
      stored:{contact:stored.contact,stable:stored.stable,cloudRevision:stored.cloudRevision},
      remote:{contact:currentRemote.form_data.contact,stable:currentRemote.form_data.stable,revision:currentRemote.revision},
      base:{contact:base.formData.contact,stable:base.formData.stable,revision:base.revision},
      finalDirtyLocations:finalState.dirtyLocations||[],
      diagnostics:window.BogatkaSyncCompatibility.diagnostics,
    };
  });

  expect(result.reusedPromise).toBe(true);
  expect(result.patchContacts).toEqual(['A','B']);
  expect(result.patchCount).toBe(2);
  expect(result.fetchCalls).toBe(4);
  expect(result.maxParallelRequests).toBe(1);
  expect(result.passStartDirty[0]).toContain('inflight-location-v435');
  expect(result.afterPushDirty[0]).toContain('inflight-location-v435');
  expect(result.stored).toEqual({contact:'B',stable:'UNCHANGED',cloudRevision:3});
  expect(result.remote).toEqual({contact:'B',stable:'UNCHANGED',revision:3});
  expect(result.base).toEqual({contact:'B',stable:'UNCHANGED',revision:3});
  expect(result.finalDirtyLocations).toEqual([]);
  expect(result.diagnostics.inFlightLocalMerges).toBe(1);
  expect(result.diagnostics.syncPassesStarted).toBe(2);
  expect(result.diagnostics.realConflicts).toBe(0);

  writeEvidence('11-inflight-local-edit-preserved.json',result);
});

test('cloud result persistence is serialized with a queued same-location user save',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async()=>{
    const api=window.BogatkaSyncCompatibility._test;
    const State=window.BogatkaSyncState;
    const Integrity=window.BogatkaFieldIntegrityV416;
    const id='indexeddb-queue-race-v435';
    const key=`location:${id}`;
    const baseline={
      contact:'A',stable:'UNCHANGED',updatedAt:'2026-07-11T11:00:00.000Z',
      cloudId:'remote-indexeddb-race',cloudRevision:1,cloudUpdatedAt:'2026-07-11T11:00:00.000Z',
    };
    const incoming={contact:'A',stable:'UNCHANGED',updatedAt:'2026-07-11T11:00:00.000Z'};
    const row={
      id:'remote-indexeddb-race',client_id:id,revision:2,
      updated_at:'2026-07-11T11:00:02.000Z',form_data:structuredClone(incoming),
    };

    cloudProjectId='project-indexeddb-race-v435';
    cloudSession=null;
    cloudWriteState({
      dirtyLocations:[],dirtyPhotos:[],deletedPhotos:{},deletedLocations:{},
      knownLocationIds:[id],knownPhotoIds:[],stateDirty:false,metaDirty:false,
    });
    await State.rawPut()(STORE,baseline,key);

    const originalRawPutFactory=State.rawPut;
    const originalRawPut=originalRawPutFactory();
    let releaseCloudWrite;
    let cloudWriteReached;
    const cloudWriteGate=new Promise(resolve=>{releaseCloudWrite=resolve});
    const cloudWriteReachedGate=new Promise(resolve=>{cloudWriteReached=resolve});
    let intercepted=false;
    let userSaveCompleted=false;
    let userSaveCompletedBeforeRelease=false;
    const order=[];

    State.rawPut=()=>async(store,value,recordKey)=>{
      if(!intercepted&&store===STORE&&recordKey===key){
        intercepted=true;
        order.push('cloud-write-reached');
        cloudWriteReached();
        await cloudWriteGate;
        order.push('cloud-write-released');
      }
      return originalRawPut(store,value,recordKey);
    };

    try{
      const cloudSave=api.saveLocal(id,incoming,row,baseline);
      await cloudWriteReachedGate;
      const queuedUserSave=Integrity.enqueueLocation(id,async()=>{
        order.push('user-save-started');
        const current=await getLocationData(id);
        await originalRawPut(STORE,{
          ...current,
          contact:'B',
          updatedAt:'2026-07-11T11:00:03.000Z',
        },key);
        const state=cloudReadState();
        if(!state.dirtyLocations.includes(id))state.dirtyLocations.push(id);
        cloudWriteState(state);
        userSaveCompleted=true;
        order.push('user-save-completed');
      });

      await new Promise(resolve=>setTimeout(resolve,60));
      userSaveCompletedBeforeRelease=userSaveCompleted;
      const pendingWhileBlocked=[...Integrity.pendingLocations];
      releaseCloudWrite();
      const [cloudSaveResult]=await Promise.all([cloudSave,queuedUserSave]);
      const stored=await getLocationData(id);
      const state=cloudReadState();
      return {
        cloudSaveResult,
        userSaveCompletedBeforeRelease,
        userSaveCompleted,
        pendingWhileBlocked,
        order,
        stored:{
          contact:stored.contact,
          stable:stored.stable,
          cloudId:stored.cloudId,
          cloudRevision:stored.cloudRevision,
          cloudUpdatedAt:stored.cloudUpdatedAt,
        },
        dirtyLocations:state.dirtyLocations||[],
      };
    }finally{
      State.rawPut=originalRawPutFactory;
    }
  });

  expect(result.cloudSaveResult).toEqual({saved:true,inFlightChanged:false});
  expect(result.userSaveCompletedBeforeRelease).toBe(false);
  expect(result.userSaveCompleted).toBe(true);
  expect(result.pendingWhileBlocked).toContain('indexeddb-queue-race-v435');
  expect(result.order).toEqual([
    'cloud-write-reached',
    'cloud-write-released',
    'user-save-started',
    'user-save-completed',
  ]);
  expect(result.stored).toEqual({
    contact:'B',
    stable:'UNCHANGED',
    cloudId:'remote-indexeddb-race',
    cloudRevision:2,
    cloudUpdatedAt:'2026-07-11T11:00:02.000Z',
  });
  expect(result.dirtyLocations).toContain('indexeddb-queue-race-v435');

  writeEvidence('12-indexeddb-queue-race-preserved.json',result);
});
