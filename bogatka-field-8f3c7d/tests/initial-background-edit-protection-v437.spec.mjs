import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=initial-background-edit-protection-v437';
const OUT=path.resolve('review-artifacts/startup-panels-v437-review');
const OWNER_NAMES=['saveField','cloudSyncAll','cloudApplyRemote','cloudPushLocations'];
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

async function installOwnerTrace(page){
  await page.addInitScript(names=>{
    const ids=new WeakMap();
    let nextId=1;
    const trace={startedAt:performance.now(),scans:0,replacements:[],events:[],last:{}};
    const idFor=value=>{
      if(typeof value!=='function')return null;
      if(!ids.has(value))ids.set(value,nextId++);
      return ids.get(value);
    };
    const liveFunction=name=>{
      try{
        if(name==='saveField'&&typeof saveField==='function')return saveField;
        if(name==='cloudSyncAll'&&typeof cloudSyncAll==='function')return cloudSyncAll;
        if(name==='cloudApplyRemote'&&typeof cloudApplyRemote==='function')return cloudApplyRemote;
        if(name==='cloudPushLocations'&&typeof cloudPushLocations==='function')return cloudPushLocations;
      }catch(_){ }
      return window[name];
    };
    const latestScript=()=>{
      const scripts=performance.getEntriesByType('resource').filter(entry=>/\.js(?:\?|$)/.test(entry.name));
      return scripts.at(-1)?.name||document.currentScript?.src||'';
    };
    const scan=()=>{
      trace.scans+=1;
      for(const name of names){
        const live=liveFunction(name);
        const published=window[name];
        const current={live:idFor(live),window:idFor(published)};
        const previous=trace.last[name];
        if(!previous||previous.live!==current.live||previous.window!==current.window){
          trace.replacements.push({
            atMs:Number(performance.now().toFixed(1)),name,
            previous:previous||null,current,
            liveName:typeof live==='function'?(live.name||'<anonymous>'):typeof live,
            windowName:typeof published==='function'?(published.name||'<anonymous>'):typeof published,
            currentScript:document.currentScript?.src||'',latestScript:latestScript(),
          });
          trace.last[name]=current;
        }
      }
    };
    window.addEventListener('bogatka:cloud-archive-loaded',event=>{
      trace.events.push({atMs:Number(performance.now().toFixed(1)),type:event.type,detail:event.detail||null,latestScript:latestScript()});
      queueMicrotask(scan);
      setTimeout(scan,0);
    });
    window.__v437OwnerTrace=trace;
    window.__v437OwnerTraceScan=scan;
    scan();
    setInterval(scan,25);
  },OWNER_NAMES);
}

async function gotoApp(page){
  await installOwnerTrace(page);
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'load'});
}

async function waitForBaseRuntime(page){
  await page.waitForFunction(()=>Boolean(
    window.BogatkaInitialBackgroundEditProtectionV437?.ready&&
    window.BogatkaSyncCompatibility?.version==='4.3.5'&&
    window.BogatkaArchiveStateV436?.version==='4.3.6'&&
    window.BogatkaFieldIntegrityV416?.ready&&
    window.BogatkaPanelAuthorityV437?.diagnostics&&
    (window.BogatkaPanelAuthorityV437.diagnostics.cloudBackgroundCompletions+
      window.BogatkaPanelAuthorityV437.diagnostics.cloudBackgroundErrors)>0&&
    (typeof cloudSyncing==='undefined'||cloudSyncing===false)
  ),{timeout:30000});
  await page.evaluate(()=>window.BogatkaDurableFieldsV452?.flush?.());
}

async function collectTerminalDiagnostics(page){
  return page.evaluate(names=>{
    const liveFunction=name=>{
      try{
        if(name==='saveField'&&typeof saveField==='function')return saveField;
        if(name==='cloudSyncAll'&&typeof cloudSyncAll==='function')return cloudSyncAll;
        if(name==='cloudApplyRemote'&&typeof cloudApplyRemote==='function')return cloudApplyRemote;
        if(name==='cloudPushLocations'&&typeof cloudPushLocations==='function')return cloudPushLocations;
      }catch(_){ }
      return window[name];
    };
    const chain=fn=>{
      const nodes=[];
      const seen=new Set();
      let current=fn;
      while(typeof current==='function'&&!seen.has(current)&&nodes.length<40){
        seen.add(current);
        const markers=Object.keys(current).filter(key=>key.startsWith('__')&&current[key]===true).sort();
        nodes.push({name:current.name||'<anonymous>',markers,v437:Boolean(current.__initialBackgroundEditProtectionV437)});
        current=current.__base;
      }
      return{depth:nodes.length,v437MarkerCount:nodes.filter(node=>node.v437).length,cycle:typeof current==='function'&&seen.has(current),nodes};
    };
    const owners={};
    for(const name of names){
      const live=liveFunction(name);
      const published=window[name];
      owners[name]={
        sameIdentity:live===published,
        live:{name:typeof live==='function'?(live.name||'<anonymous>'):typeof live,chain:chain(live)},
        window:{name:typeof published==='function'?(published.name||'<anonymous>'):typeof published,chain:chain(published)},
      };
    }
    const Protection=window.BogatkaInitialBackgroundEditProtectionV437;
    let audit=null;
    try{audit=Protection?.audit?.()||null}catch(error){audit={ok:false,failures:[error?.message||String(error)]}}
    return{
      audit,
      legacy:audit?.legacy||null,
      lifecycle:Protection?.lifecycle||null,
      generation:Protection?.generation??Protection?.snapshot?.generation??null,
      snapshotLocationsCount:Protection?.snapshot?.locations?.length??null,
      runtimeChecks:audit?.runtimeChecks??Protection?.diagnostics?.runtimeChecks??null,
      terminalPasses:audit?.terminalPasses??Protection?.diagnostics?.terminalPasses??null,
      terminalReconcileAttempts:window.__bogatkaInitialBackgroundEditTerminalDiagnosticsV437?.attempts??null,
      terminalStablePasses:window.__bogatkaInitialBackgroundEditTerminalDiagnosticsV437?.stablePasses??null,
      readiness:{
        fieldIntegrity:Boolean(window.BogatkaFieldIntegrityV416?.ready),
        syncCompatibility:Boolean(window.BogatkaSyncCompatibility?.ready),
        archiveState:Boolean(window.BogatkaArchiveStateV436?.ready),
        locationData:Boolean(window.BogatkaLocationDataV452?.ready),
        locationDataStability:Boolean(window.BogatkaLocationDataStabilityV452?.ready),
        durableFields:Boolean(window.BogatkaDurableFieldsV452?.ready),
        suiteSaveOrder:Boolean(window.BogatkaSuiteSaveOrderV452?.ready),
      },
      owners,
      replacementTimeline:window.__v437OwnerTrace?{
        scans:window.__v437OwnerTrace.scans,
        replacements:[...window.__v437OwnerTrace.replacements],
        events:[...window.__v437OwnerTrace.events],
        last:{...window.__v437OwnerTrace.last},
      }:null,
      terminalDataset:document.documentElement.dataset.initialBackgroundEditTerminalV437||null,
      terminalReadyFlag:Boolean(window.__bogatkaInitialBackgroundEditTerminalReadyV437),
    };
  },OWNER_NAMES);
}

async function assertTerminalReady(page){
  const deadline=Date.now()+10000;
  let diagnostics=null;
  while(Date.now()<deadline){
    diagnostics=await collectTerminalDiagnostics(page);
    if(diagnostics.audit?.ok)return diagnostics;
    await page.waitForTimeout(50);
  }
  diagnostics=await collectTerminalDiagnostics(page);
  expect(diagnostics.audit?.ok,`Terminal V437 ownership did not converge:\n${JSON.stringify(diagnostics,null,2)}`).toBe(true);
  return diagnostics;
}

async function openApp(page){
  await gotoApp(page);
  await waitForBaseRuntime(page);
  await assertTerminalReady(page);
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
    window.cloudRole=cloudRole;
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
      const write=async()=>{
        const fixture=window.__initialProtectionFixture;
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
          return row;
        }finally{fixture.activeRequests-=1}
      };
      const read=async()=>{
        const fixture=window.__initialProtectionFixture;
        fixture.fetchCount+=1;
        if(fixture.fetchCount===1){
          fixture.signalFirstFetch();
          if(fixture.failFirstFetch&&!fixture.failedFetch){fixture.failedFetch=true;throw new Error('fixture-initial-fetch-failure')}
          if(!fixture.firstFetchReleased)await fixture.firstFetchGate;
        }
        return fixture.currentRemote?[clone(fixture.currentRemote)]:[];
      };
      const builder={
        select(){return builder},eq(){return builder},is(){return builder},
        update(value){mode='update';payload=clone(value);return builder},
        upsert(value){mode='upsert';payload=clone(Array.isArray(value)?value[0]:value);return builder},
        async order(){if(mode==='read')return{data:await read(),error:null};return{data:[clone(await write())],error:null}},
        async maybeSingle(){if(mode==='read'){const rows=await read();return{data:rows[0]||null,error:null}}return{data:clone(await write()),error:null}},
        single(){return builder.maybeSingle()},then(resolve,reject){return builder.order().then(resolve,reject)},
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
  await locator.evaluate((control,{value,selection,focus})=>{
    if(focus)window.__fixtureActiveControl=control;
    control.value=value;
    if(selection!==null&&typeof control.setSelectionRange==='function')control.setSelectionRange(selection,selection);
    control.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));
    if(focus)window.__fixtureSelection={start:control.selectionStart,end:control.selectionEnd};
  },{value,selection,focus});
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
  await page.evaluate(()=>{window.__fixtureSyncPromise=cloudSyncAll({manual:true})});
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
    await editField(page,id,'tech.rentPerMonth','LOCAL-DURING-APPLY',{focus:false});
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
  return page.evaluate(async({before})=>{
    const fixture=window.__initialProtectionFixture;
    const local=await getLocationData(fixture.id);
    const base=await window.BogatkaSyncState.readBase(fixture.id);
    const state=cloudReadState();
    return{
      head:'',
      preFix:{legacyMerged:before,staleUntouchedFieldWouldPush:before.questions==='LOCAL-STALE-UNTOUCHED'},
      finalLocalRow:{contact:local.contact,questions:local.questions,rentPerMonth:local.tech?.rentPerMonth||null,cloudRevision:local.cloudRevision},
      finalRemoteRow:{contact:fixture.currentRemote.form_data.contact,questions:fixture.currentRemote.form_data.questions,rentPerMonth:fixture.currentRemote.form_data.tech?.rentPerMonth||null,revision:fixture.currentRemote.revision},
      finalPersistedBase:{contact:base.formData.contact,questions:base.formData.questions,rentPerMonth:base.formData.tech?.rentPerMonth||null,revision:base.revision},
      pushCount:fixture.patches.length+fixture.upserts.length,
      patchCount:fixture.patches.length,
      upsertCount:fixture.upserts.length,
      patchPayloads:fixture.patches.map(payload=>({contact:payload.form_data.contact,questions:payload.form_data.questions,rentPerMonth:payload.form_data.tech?.rentPerMonth||null})),
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
  await gotoApp(page);
  await page.waitForFunction(()=>Boolean(window.BogatkaSyncMerge?.merge),{timeout:10000});
  const result=await page.evaluate(()=>window.BogatkaSyncMerge.merge(
    undefined,
    {edited:'LOCAL-USER',untouched:'LOCAL-STALE'},
    {edited:'REMOTE-NEWER',untouched:'REMOTE-NEWER'},
    {preferLocal:true,explicitReset:false},
  ));
  expect(result).toEqual({edited:'LOCAL-USER',untouched:'LOCAL-STALE'});
});

test('clean no-base merge does not publish local-only empty defaults',async({page})=>{
  await gotoApp(page);
  await page.waitForFunction(()=>Boolean(window.BogatkaSyncMerge?.merge),{timeout:10000});
  const result=await page.evaluate(()=>window.BogatkaSyncMerge.merge(
    undefined,
    {contact:'LOCAL-STALE',questions:'LOCAL-STALE',tasks:[],comments:[],status:null,objectType:null},
    {contact:'REMOTE-NEWER',questions:'REMOTE-NEWER'},
    {preferLocal:false,explicitReset:false},
  ));
  expect(result).toEqual({contact:'REMOTE-NEWER',questions:'REMOTE-NEWER'});
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
  expect(evidence.finalLocalRow).toMatchObject({contact:'LOCAL-USER-EDIT',questions:'REMOTE-NEWER-UNTOUCHED',rentPerMonth:'LOCAL-DURING-APPLY'});
  expect(evidence.finalRemoteRow).toMatchObject({contact:'LOCAL-USER-EDIT',questions:'REMOTE-NEWER-UNTOUCHED',rentPerMonth:'LOCAL-DURING-APPLY'});
  expect(evidence.finalPersistedBase).toMatchObject({contact:'LOCAL-USER-EDIT',questions:'REMOTE-NEWER-UNTOUCHED',rentPerMonth:'LOCAL-DURING-APPLY'});
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
  expect(result.fixture.upserts).toHaveLength(0);
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
  await page.waitForFunction(()=>window.BogatkaInitialBackgroundEditProtectionV437.lifecycle==='initial-cloud-ready',{timeout:15000});
  result=await page.evaluate(async()=>({fixture:window.__initialProtectionFixture,local:await getLocationData('retry-v437'),base:await window.BogatkaSyncState.readBase('retry-v437'),lifecycle:window.BogatkaInitialBackgroundEditProtectionV437.lifecycle}));
  expect(result.fixture.patches).toHaveLength(1);
  expect(result.local).toMatchObject({contact:'LOCAL-RETRY',questions:'REMOTE-NEWER-UNTOUCHED'});
  expect(result.base.formData).toMatchObject({contact:'LOCAL-RETRY',questions:'REMOTE-NEWER-UNTOUCHED'});
  expect(result.lifecycle).toBe('initial-cloud-ready');

  const archive=await page.evaluate(()=>({version:window.BogatkaArchiveStateV436.version,ready:window.BogatkaArchiveStateV436.ready,fetchReady:window.BogatkaSyncFieldCompatV416.archiveFetchReady}));
  expect(archive).toEqual({version:'4.3.6',ready:true,fetchReady:true});
});
