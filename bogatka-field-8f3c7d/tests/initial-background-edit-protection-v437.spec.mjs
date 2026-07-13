import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=initial-background-edit-protection-v437';
const OUT=path.resolve('review-artifacts/startup-panels-v437-review');
let EVENT_HEAD='';
try{
  const event=JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
  EVENT_HEAD=event?.pull_request?.head?.sha||'';
}catch(_){ }
const EXACT_HEAD=process.env.BOGATKA_EXACT_HEAD||EVENT_HEAD||process.env.GITHUB_SHA||'local-uncommitted';

async function writeEvidence(name,value){
  await fs.mkdir(OUT,{recursive:true});
  await fs.writeFile(path.join(OUT,name),JSON.stringify(value,null,2));
}

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'load'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaInitialBackgroundEditProtectionV437?.ready&&
    window.BogatkaSyncCompatibility?.version==='4.3.5'&&
    window.BogatkaArchiveStateV436?.version==='4.3.6'&&
    window.BogatkaFieldIntegrityV416?.ready&&
    (typeof cloudSyncing==='undefined'||cloudSyncing===false)
  ),{timeout:30000});
  await page.waitForFunction(()=>window.BogatkaInitialBackgroundEditProtectionV437.audit().ok,{timeout:10000});
}

async function configureFixture(page,{
  id='initial-edit-v437',
  local={contact:'LOCAL-STALE',questions:'LOCAL-STALE-UNTOUCHED'},
  remote={contact:'REMOTE-NEWER',questions:'REMOTE-NEWER-UNTOUCHED'},
  dirtyBefore=false,
  viewer=false,
  remoteExists=true,
  failFirstFetch=false,
}={}){
  await page.evaluate(async({id,local,remote,dirtyBefore,viewer,remoteExists,failFirstFetch})=>{
    const Protection=window.BogatkaInitialBackgroundEditProtectionV437;
    const State=window.BogatkaSyncState;
    Protection._test.resetForTest();
    clearTimeout(cloudSyncTimer);
    clearTimeout(cloudRealtimeTimer);
    const item={id,title:'Fixture location',address:'Fixture address',note:'Fixture note',custom:true};
    locations=[item];
    cloudProjectId='project-initial-edit-v437';
    cloudSession={user:{id:'fixture-user-v437'}};
    cloudRole=viewer?'viewer':'owner';
    cloudSyncing=false;
    cloudApplyingRemote=false;
    const localRow={...structuredClone(local),updatedAt:'2026-07-13T10:00:00.000Z'};
    await State.rawPut()(STORE,localRow,`location:${id}`);
    await State.rawPut()(STORE,locations,'meta:locations');
    await State.deleteBase(id);
    cloudWriteState({
      dirtyLocations:dirtyBefore?[id]:[],dirtyPhotos:[],deletedPhotos:{},deletedLocations:{},
      knownLocationIds:remoteExists?[id]:[],knownPhotoIds:[],stateDirty:false,metaDirty:false,
    });
    renderLocations();
    window.BogatkaLocationCardCollapseV422?.setCollapsed?.(document.querySelector(`[data-location-card="${CSS.escape(id)}"]`),false,{persist:false});
    await restoreAllForms({preserveActive:true});
    await Protection.captureStartupSnapshot({force:true});
    await Protection.ensureFieldIntegrity();
    Protection.installSaveWrapper();
    Protection.installSyncWrapper();
    Protection.installApplyPushWrappers();

    const remoteRow=remoteExists?{
      id:`remote-${id}`,project_id:cloudProjectId,client_id:id,title:item.title,address:item.address,note:item.note,
      status:null,object_type:null,form_data:structuredClone(remote),sort_order:0,archived_at:null,
      revision:7,updated_at:'2026-07-13T10:05:00.000Z',created_at:'2026-07-13T09:00:00.000Z',
    }:null;
    window.__initialProtectionFixture={
      id,item,currentRemote:remoteRow,patches:[],upserts:[],fetchCount:0,activeRequests:0,maxParallelRequests:0,
      failFirstFetch:Boolean(failFirstFetch),failedFetch:false,firstFetchReleased:false,
    };
    let releaseFirstFetch,firstFetchStarted;
    window.__initialProtectionFixture.firstFetchGate=new Promise(resolve=>{releaseFirstFetch=resolve});
    window.__initialProtectionFixture.firstFetchStartedGate=new Promise(resolve=>{firstFetchStarted=resolve});
    window.__initialProtectionFixture.releaseFirstFetch=()=>{window.__initialProtectionFixture.firstFetchReleased=true;releaseFirstFetch()};
    window.__initialProtectionFixture.signalFirstFetch=firstFetchStarted;

    cloudEnsureProject=async()=>{};
    cloudDeleteRemovedLocations=async()=>{};
    cloudDeletePhotos=async()=>{};
    cloudPushPhotos=async()=>{};
    cloudPushProjectState=async()=>{};
    cloudSubscribeRealtime=async()=>{};

    const clone=value=>value===undefined?undefined:structuredClone(value);
    const makeLocationBuilder=()=>{
      let mode='read';
      let payload=null;
      const builder={
        select(){return builder},
        eq(){return builder},
        is(){return builder},
        update(value){mode='update';payload=clone(value);return builder},
        upsert(value){mode='upsert';payload=clone(Array.isArray(value)?value[0]:value);return builder},
        async order(){
          const fixture=window.__initialProtectionFixture;
          fixture.fetchCount+=1;
          if(fixture.fetchCount===1){
            fixture.signalFirstFetch();
            if(fixture.failFirstFetch&&!fixture.failedFetch){fixture.failedFetch=true;throw new Error('fixture-initial-fetch-failure')}
            if(!fixture.firstFetchReleased)await fixture.firstFetchGate;
          }
          return{data:fixture.currentRemote?[clone(fixture.currentRemote)]:[],error:null};
        },
        async maybeSingle(){
          const fixture=window.__initialProtectionFixture;
          if(mode==='read')return{data:fixture.currentRemote?clone(fixture.currentRemote):null,error:null};
          fixture.activeRequests+=1;
          fixture.maxParallelRequests=Math.max(fixture.maxParallelRequests,fixture.activeRequests);
          try{
            const prior=fixture.currentRemote;
            const revision=Number(prior?.revision||0)+1;
            const row={
              ...(prior||{}),id:prior?.id||`remote-${id}`,project_id:cloudProjectId,client_id:id,
              title:payload.title||item.title,address:payload.address||item.address,note:payload.note||item.note,
              status:payload.status??null,object_type:payload.object_type??null,
              form_data:clone(payload.form_data||{}),sort_order:Number(payload.sort_order||0),archived_at:payload.archived_at??null,
              revision,updated_at:`2026-07-13T10:05:${String(revision).padStart(2,'0')}.000Z`,
            };
            fixture.currentRemote=row;
            if(mode==='update')fixture.patches.push(clone(payload));else fixture.upserts.push(clone(payload));
            return{data:clone(row),error:null};
          }finally{fixture.activeRequests-=1}
        },
        single(){return builder.maybeSingle()},
        then(resolve,reject){return builder.order().then(resolve,reject)},
      };
      return builder;
    };
    const makeReadBuilder=data=>{
      const builder={select(){return builder},eq(){return builder},is(){return builder},order:async()=>({data:clone(data),error:null}),maybeSingle:async()=>({data:Array.isArray(data)?data[0]||null:data,error:null}),single:async()=>({data:Array.isArray(data)?data[0]||null:data,error:null}),then(resolve,reject){return builder.order().then(resolve,reject)}};
      return builder;
    };
    cloudClient={
      from(table){
        if(table==='locations')return makeLocationBuilder();
        if(table==='photos')return makeReadBuilder([]);
        if(table==='project_state')return makeReadBuilder(null);
        throw new Error(`Unexpected fixture table: ${table}`);
      },
      channel(){return{on(){return this},subscribe(){return this},unsubscribe(){}}},
    };
  },{id,local,remote,dirtyBefore,viewer,remoteExists,failFirstFetch});
}

async function editField(page,id,field,value,{focus=true,selection=null}={}){
  const locator=page.locator(`[data-location="${id}"][data-field="${field}"]`);
  await expect(locator).toHaveCount(1);
  if(focus)await locator.focus();
  await locator.evaluate((control,{value,selection})=>{
    window.__fixtureActiveControl=control;
    control.value=value;
    if(selection!==null&&typeof control.setSelectionRange==='function')control.setSelectionRange(selection,selection);
    control.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));
    window.__fixtureSelection={start:control.selectionStart,end:control.selectionEnd};
  },{value,selection});
  return locator;
}

async function runProtectedScenario(page,{editTiming='after-fetch-start',duringApplyEdit=false}={}){
  const id='initial-edit-v437';
  await configureFixture(page,{id});
  const before=await page.evaluate(()=>{
    const Merge=window.BogatkaSyncMerge;
    const local={contact:'LOCAL-USER-EDIT',questions:'LOCAL-STALE-UNTOUCHED'};
    const remote={contact:'REMOTE-NEWER',questions:'REMOTE-NEWER-UNTOUCHED'};
    return Merge.merge(undefined,local,remote,{preferLocal:true,explicitReset:false});
  });
  expect(before).toEqual({contact:'LOCAL-USER-EDIT',questions:'LOCAL-STALE-UNTOUCHED'});

  if(editTiming==='before-sync')await editField(page,id,'contact','LOCAL-USER-EDIT',{selection:7});
  await page.evaluate(()=>{window.__fixtureSyncPromise=cloudSyncAll({manual:false})});
  await page.evaluate(()=>window.__initialProtectionFixture.firstFetchStartedGate);
  if(editTiming==='after-fetch-start')await editField(page,id,'contact','LOCAL-USER-EDIT',{selection:7});

  if(duringApplyEdit){
    await page.evaluate(()=>{
      const State=window.BogatkaSyncState;
      const fixture=window.__initialProtectionFixture;
      const originalFactory=State.rawPut;
      const originalPut=originalFactory();
      let release,signal;
      fixture.cloudWriteGate=new Promise(resolve=>{release=resolve});
      fixture.cloudWriteReached=new Promise(resolve=>{signal=resolve});
      fixture.releaseCloudWrite=release;
      fixture.originalRawPutFactory=originalFactory;
      let intercepted=false;
      State.rawPut=()=>async(store,value,key)=>{
        if(!intercepted&&store===STORE&&key===`location:${fixture.id}`&&window.BogatkaInitialBackgroundEditProtectionV437.lifecycle==='reconciling-early-edits'){
          intercepted=true;signal();await fixture.cloudWriteGate;
        }
        return originalPut(store,value,key);
      };
    });
  }
  await page.evaluate(()=>window.__initialProtectionFixture.releaseFirstFetch());
  if(duringApplyEdit){
    await page.evaluate(()=>window.__initialProtectionFixture.cloudWriteReached);
    await editField(page,id,'rent','LOCAL-DURING-APPLY',{focus:false});
    await page.evaluate(()=>window.__initialProtectionFixture.releaseCloudWrite());
  }
  await page.evaluate(async()=>{
    try{await window.__fixtureSyncPromise}finally{
      const fixture=window.__initialProtectionFixture;
      if(fixture.originalRawPutFactory)window.BogatkaSyncState.rawPut=fixture.originalRawPutFactory;
    }
  });

  const during=await page.evaluate(()=>({
    dirty:[...(cloudReadState().dirtyLocations||[])],
    nodeIdentity:window.__fixtureActiveControl===document.querySelector(`[data-location="${CSS.escape(window.__initialProtectionFixture.id)}"][data-field="contact"]`),
    value:window.__fixtureActiveControl?.value,
    focused:document.activeElement===window.__fixtureActiveControl,
    selection:{start:window.__fixtureActiveControl?.selectionStart,end:window.__fixtureActiveControl?.selectionEnd},
    diagnostics:window.BogatkaInitialBackgroundEditProtectionV437.diagnostics,
  }));
  expect(during.nodeIdentity).toBe(true);
  expect(during.value).toBe('LOCAL-USER-EDIT');
  expect(during.selection).toEqual({start:7,end:7});
  expect(during.dirty).toContain(id);

  await page.evaluate(()=>window.__fixtureActiveControl?.blur());
  await page.evaluate(()=>cloudSyncAll({manual:true}));
  await page.waitForFunction(()=>window.BogatkaInitialBackgroundEditProtectionV437.lifecycle==='initial-cloud-ready',{timeout:15000});
  return await page.evaluate(async({before})=>{
    const fixture=window.__initialProtectionFixture;
    const local=await getLocationData(fixture.id);
    const base=await window.BogatkaSyncState.readBase(fixture.id);
    const state=cloudReadState();
    return{
      head:'',
      preFix:{legacyMerged:before,staleUntouchedFieldWouldPush:before.questions==='LOCAL-STALE-UNTOUCHED'},
      finalLocalRow:{contact:local.contact,questions:local.questions,rent:local.rent||null,cloudRevision:local.cloudRevision},
      finalRemoteRow:{contact:fixture.currentRemote.form_data.contact,questions:fixture.currentRemote.form_data.questions,rent:fixture.currentRemote.form_data.rent||null,revision:fixture.currentRemote.revision},
      finalPersistedBase:{contact:base.formData.contact,questions:base.formData.questions,rent:base.formData.rent||null,revision:base.revision},
      pushCount:fixture.patches.length+fixture.upserts.length,
      patchCount:fixture.patches.length,
      upsertCount:fixture.upserts.length,
      patchPayloads:fixture.patches.map(payload=>({contact:payload.form_data.contact,questions:payload.form_data.questions,rent:payload.form_data.rent||null})),
      fetchCount:fixture.fetchCount,
      maxParallelRequests:fixture.maxParallelRequests,
      dirtyStateAfter:state.dirtyLocations||[],
      lifecycle:window.BogatkaInitialBackgroundEditProtectionV437.lifecycle,
      diagnostics:window.BogatkaInitialBackgroundEditProtectionV437.diagnostics,
      audit:window.BogatkaInitialBackgroundEditProtectionV437.audit(),
    };
  },{before});
}

test('legacy no-base preferLocal reproduces the stale whole-location overwrite',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(()=>window.BogatkaSyncMerge.merge(
    undefined,
    {edited:'LOCAL-USER',untouched:'LOCAL-STALE'},
    {edited:'REMOTE-NEWER',untouched:'REMOTE-NEWER'},
    {preferLocal:true,explicitReset:false},
  ));
  expect(result).toEqual({edited:'LOCAL-USER',untouched:'LOCAL-STALE'});
});

for(const editTiming of ['before-sync','after-fetch-start']){
  test(`no-base early edit is field-safe when editing ${editTiming}`,async({page})=>{
    test.setTimeout(60000);
    await openApp(page);
    const evidence=await runProtectedScenario(page,{editTiming});
    expect(evidence.finalLocalRow.contact).toBe('LOCAL-USER-EDIT');
    expect(evidence.finalLocalRow.questions).toBe('REMOTE-NEWER-UNTOUCHED');
    expect(evidence.finalRemoteRow.contact).toBe('LOCAL-USER-EDIT');
    expect(evidence.finalRemoteRow.questions).toBe('REMOTE-NEWER-UNTOUCHED');
    expect(evidence.finalPersistedBase.contact).toBe('LOCAL-USER-EDIT');
    expect(evidence.finalPersistedBase.questions).toBe('REMOTE-NEWER-UNTOUCHED');
    expect(evidence.patchCount).toBe(1);
    expect(evidence.upsertCount).toBe(0);
    expect(evidence.maxParallelRequests).toBe(1);
    expect(evidence.dirtyStateAfter).toEqual([]);
    expect(evidence.diagnostics.followUpSyncsScheduled).toBe(1);
    expect(evidence.diagnostics.staleWholeLocationPushesPrevented).toBe(1);
    expect(evidence.audit.ok,evidence.audit.failures.join('\n')).toBe(true);
    if(editTiming==='after-fetch-start')await writeEvidence('05-initial-background-edit-protection.json',{...evidence,head:EXACT_HEAD,fixture:'no-base-delayed-initial-fetch',editedPath:'contact',unrelatedRemotePath:'questions',activeControlIdentityPreserved:true,noStaleWholeLocationPush:true});
  });
}

test('edit during cloudApplyRemote and before debounce remains serialized',async({page})=>{
  test.setTimeout(60000);
  await openApp(page);
  const evidence=await runProtectedScenario(page,{editTiming:'after-fetch-start',duringApplyEdit:true});
  expect(evidence.finalLocalRow).toMatchObject({contact:'LOCAL-USER-EDIT',questions:'REMOTE-NEWER-UNTOUCHED',rent:'LOCAL-DURING-APPLY'});
  expect(evidence.finalRemoteRow).toMatchObject({contact:'LOCAL-USER-EDIT',questions:'REMOTE-NEWER-UNTOUCHED',rent:'LOCAL-DURING-APPLY'});
  expect(evidence.finalPersistedBase).toMatchObject({contact:'LOCAL-USER-EDIT',questions:'REMOTE-NEWER-UNTOUCHED',rent:'LOCAL-DURING-APPLY'});
  expect(evidence.patchCount).toBe(1);
  expect(evidence.maxParallelRequests).toBe(1);
  expect(evidence.diagnostics.pendingSaveFlushes).toBeGreaterThan(0);
});

test('no edits hydrate without push; pre-existing dirty and local-only creation keep existing semantics',async({page})=>{
  test.setTimeout(60000);
  await openApp(page);

  await configureFixture(page,{id:'no-edit-v437'});
  await page.evaluate(()=>{window.__fixtureSyncPromise=cloudSyncAll({manual:true});window.__initialProtectionFixture.releaseFirstFetch()});
  await page.evaluate(()=>window.__fixtureSyncPromise);
  let state=await page.evaluate(async()=>({fixture:window.__initialProtectionFixture,local:await getLocationData('no-edit-v437'),base:await window.BogatkaSyncState.readBase('no-edit-v437')}));
  expect(state.fixture.patches).toHaveLength(0);
  expect(state.local.questions).toBe('REMOTE-NEWER-UNTOUCHED');
  expect(state.base.formData.questions).toBe('REMOTE-NEWER-UNTOUCHED');

  await configureFixture(page,{id:'dirty-before-v437',dirtyBefore:true,local:{contact:'OFFLINE-LOCAL',questions:'OFFLINE-LOCAL-INTENT'},remote:{contact:'REMOTE',questions:'REMOTE'}});
  await page.evaluate(()=>{window.__fixtureSyncPromise=cloudSyncAll({manual:true});window.__initialProtectionFixture.releaseFirstFetch()});
  await page.evaluate(()=>window.__fixtureSyncPromise);
  state=await page.evaluate(()=>window.__initialProtectionFixture);
  expect(state.patches).toHaveLength(1);
  expect(state.currentRemote.form_data).toMatchObject({contact:'OFFLINE-LOCAL',questions:'OFFLINE-LOCAL-INTENT'});

  await configureFixture(page,{id:'local-only-v437',remoteExists:false,local:{contact:'LOCAL-ONLY',questions:'CREATE'}});
  await page.evaluate(()=>{window.__fixtureSyncPromise=cloudSyncAll({manual:true});window.__initialProtectionFixture.releaseFirstFetch()});
  await page.evaluate(()=>window.__fixtureSyncPromise);
  state=await page.evaluate(()=>window.__initialProtectionFixture);
  expect(state.upserts).toHaveLength(1);
  expect(state.currentRemote.form_data).toMatchObject({contact:'LOCAL-ONLY',questions:'CREATE'});
});

test('viewer creates no journal or push, and initial fetch failure retries with intent intact',async({page})=>{
  test.setTimeout(60000);
  await openApp(page);

  await configureFixture(page,{id:'viewer-v437',viewer:true});
  await page.evaluate(()=>{
    const control=document.querySelector('[data-location="viewer-v437"][data-field="contact"]');
    control.disabled=false;
    control.value='VIEWER-ATTEMPT';
    control.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:'VIEWER-ATTEMPT'}));
    window.__fixtureSyncPromise=cloudSyncAll({manual:true});
    window.__initialProtectionFixture.releaseFirstFetch();
  });
  await page.evaluate(()=>window.__fixtureSyncPromise);
  let result=await page.evaluate(async()=>({fixture:window.__initialProtectionFixture,local:await getLocationData('viewer-v437'),diagnostics:window.BogatkaInitialBackgroundEditProtectionV437.diagnostics,disabled:document.querySelector('[data-location="viewer-v437"][data-field="contact"]').disabled}));
  expect(result.fixture.patches).toHaveLength(0);
  expect(result.diagnostics.earlyEditPathCount).toBe(0);
  expect(result.local.contact).toBe('REMOTE-NEWER');
  expect(result.disabled).toBe(true);

  await configureFixture(page,{id:'retry-v437',failFirstFetch:true});
  await editField(page,'retry-v437','contact','LOCAL-RETRY',{selection:5});
  await page.evaluate(()=>{window.__fixtureSyncPromise=cloudSyncAll({manual:true})});
  await page.evaluate(()=>window.__initialProtectionFixture.firstFetchStartedGate);
  const error=await page.evaluate(async()=>{try{await window.__fixtureSyncPromise;return''}catch(caught){return caught.message}});
  expect(error).toContain('fixture-initial-fetch-failure');
  let pending=await page.evaluate(async()=>({local:await getLocationData('retry-v437'),lifecycle:window.BogatkaInitialBackgroundEditProtectionV437.lifecycle,diagnostics:window.BogatkaInitialBackgroundEditProtectionV437.diagnostics}));
  expect(pending.local.contact).toBe('LOCAL-RETRY');
  expect(pending.lifecycle).toBe('initial-cloud-error');
  expect(pending.diagnostics.earlyEditPathCount).toBe(1);
  await page.evaluate(()=>{window.__initialProtectionFixture.releaseFirstFetch()});
  await page.evaluate(()=>cloudSyncAll({manual:true}));
  result=await page.evaluate(async()=>({fixture:window.__initialProtectionFixture,local:await getLocationData('retry-v437'),base:await window.BogatkaSyncState.readBase('retry-v437'),lifecycle:window.BogatkaInitialBackgroundEditProtectionV437.lifecycle}));
  expect(result.fixture.patches).toHaveLength(1);
  expect(result.local).toMatchObject({contact:'LOCAL-RETRY',questions:'REMOTE-NEWER-UNTOUCHED'});
  expect(result.base.formData).toMatchObject({contact:'LOCAL-RETRY',questions:'REMOTE-NEWER-UNTOUCHED'});
  expect(result.lifecycle).toBe('initial-cloud-ready');

  const archive=await page.evaluate(()=>({version:window.BogatkaArchiveStateV436.version,ready:window.BogatkaArchiveStateV436.ready,fetchReady:window.BogatkaSyncFieldCompatV416.archiveFetchReady}));
  expect(archive).toEqual({version:'4.3.6',ready:true,fetchReady:true});
});
