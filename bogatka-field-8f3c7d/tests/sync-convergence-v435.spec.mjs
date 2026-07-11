import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
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
  await page.waitForFunction(()=>typeof cloudSyncing==='undefined'||cloudSyncing===false);
}

async function expandFirstCard(page){
  await page.evaluate(async()=>{
    const card=document.querySelector('[data-location-card]');
    window.BogatkaLocationCardCollapseV422?.setCollapsed?.(card,false,{persist:false});
    await window.BogatkaLocationPanelsV419?.enhanceAll?.({force:true});
    const landlord=card?.querySelector('.landlord-card-v416');
    if(landlord){
      landlord.dataset.panelOpenV419='1';
      landlord.classList.remove('panel-closed-v419');
      landlord.querySelector('.panel-toggle-v419')?.setAttribute('aria-expanded','true');
    }
  });
}

function row({revision=7403,formData={},title='ул. Лидская, 34, ТЦ «Лидский»'}={}){
  return {
    id:'remote-lidskaya-34',project_id:'project-fixture',client_id:'lidskaya-34',title,
    address:'Гродно, ул. Лидская, 34',note:null,status:'Собираем информацию',object_type:'Торговый центр',
    form_data:formData,sort_order:0,archived_at:null,revision,
    updated_at:`2026-07-11T00:00:${String(revision%60).padStart(2,'0')}.000Z`,
  };
}

test('transport normalization matches JSON semantics without losing explicit resets',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(()=>{
    const Merge=window.BogatkaSyncMerge;
    const input={removed:undefined,empty:'',nil:null,flag:false,count:0,reset:[],nested:{keep:'yes',drop:undefined},ids:[{id:'task-1',title:'A'},{id:'task-2',deleted:false}],arrayValues:[undefined,false,0,'',null],deletedTaskIds:['task-3']};
    return {
      normalized:Merge.transportNormalize(input),
      equalsTransport:Merge.same(input,JSON.parse(JSON.stringify(input))),
      timestampOnlyEqual:Merge.same({contact:'Анна',updatedAt:'2026-07-11T10:00:00Z'},{contact:'Анна',updatedAt:'2099-01-01T00:00:00Z'}),
      contentDifference:Merge.same({contact:'Анна',updatedAt:'2026-07-11T10:00:00Z'},{contact:'Ирина',updatedAt:'2026-07-11T10:00:00Z'}),
      canonical:Merge.canonical(input),
    };
  });
  expect(result.equalsTransport).toBe(true);
  expect(result.timestampOnlyEqual).toBe(true);
  expect(result.contentDifference).toBe(false);
  expect(result.normalized).toEqual({empty:'',nil:null,flag:false,count:0,reset:[],nested:{keep:'yes'},ids:[{id:'task-1',title:'A'},{id:'task-2',deleted:false}],arrayValues:[null,false,0,'',null],deletedTaskIds:['task-3']});
  expect(result.canonical).toContain('"deletedTaskIds"');
  writeEvidence('01-transport-normalization.json',result);
});

test('database no-op at revision 7403 is accepted once and saves the remote base',async({page})=>{
  await openApp(page);
  const fixture=row({formData:{contact:'Анна',nested:{stable:true}}});
  const result=await page.evaluate(async({fixture})=>{
    const api=window.BogatkaSyncCompatibility._test;api.resetDiagnostics();
    const payloadForm={contact:'Анна',nested:{stable:true,transportOnly:undefined}};
    const initial={id:'lidskaya-34',item:{id:'lidskaya-34',title:'ул. Лидская, 34, ТЦ «Лидский»'},index:0,row:fixture,base:null,local:payloadForm,merged:payloadForm,payload:{project_id:fixture.project_id,client_id:fixture.client_id,title:fixture.title,address:fixture.address,note:null,status:fixture.status,object_type:fixture.object_type,form_data:payloadForm,sort_order:0,archived_at:null,updated_by:'fixture-user'},dirty:true,needsPush:true};
    const calls={patch:0,get:0,saveLocal:0,saveBase:0,rebuild:0};let savedRevision=null;
    const returned=await api.persistLocation(initial,{dirtyLocations:['lidskaya-34']},{isPending:()=>false,conditionalUpdate:async()=>{calls.patch++;return null},upsert:async()=>{throw new Error('upsert not expected')},fetchRow:async()=>{calls.get++;return fixture},rebuild:async()=>{calls.rebuild++;throw new Error('rebuild not expected')},saveLocal:async()=>{calls.saveLocal++},saveBase:async(_context,current)=>{calls.saveBase++;savedRevision=current.revision}});
    return {calls,savedRevision,returnedRevision:returned.revision,diagnostics:window.BogatkaSyncCompatibility.diagnostics};
  },{fixture});
  expect(result.calls).toEqual({patch:1,get:1,saveLocal:1,saveBase:1,rebuild:0});
  expect(result.savedRevision).toBe(7403);expect(result.returnedRevision).toBe(7403);
  expect(result.diagnostics.noOpUpdatesAccepted).toBe(1);expect(result.diagnostics.realConflicts).toBe(0);
  writeEvidence('02-no-op-convergence.json',result);
});

test('genuine revision advance rebases non-overlapping and same-field edits with bounded retries',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async()=>{
    const api=window.BogatkaSyncCompatibility._test,Merge=window.BogatkaSyncMerge;api.resetDiagnostics();
    async function runCase(sameField){
      const baseForm=sameField?{rent:'1000'}:{localField:'base',remoteField:'base'};
      const localForm=sameField?{rent:'1200'}:{localField:'phone',remoteField:'base'};
      const remoteForm=sameField?{rent:'1100'}:{localField:'base',remoteField:'desktop'};
      const first={id:'lidskaya-34',project_id:'project-fixture',client_id:'lidskaya-34',title:'Лидская',address:'Гродно',note:null,status:null,object_type:null,form_data:baseForm,sort_order:0,archived_at:null,revision:10,updated_at:'2026-07-11T00:00:10.000Z'};
      const advanced={...first,form_data:remoteForm,revision:11,updated_at:'2026-07-11T00:00:11.000Z'};const item={id:'lidskaya-34',title:'Лидская'};
      const makeContext=(remote,form)=>({id:item.id,item,index:0,row:remote,local:localForm,merged:form,payload:{project_id:first.project_id,client_id:first.client_id,title:first.title,address:first.address,note:null,status:null,object_type:null,form_data:form,sort_order:0,archived_at:null,updated_by:'fixture-user'},dirty:true,needsPush:true});
      const revisions=[];let fetches=0;
      const returned=await api.persistLocation(makeContext(first,localForm),{dirtyLocations:[item.id]},{isPending:()=>false,conditionalUpdate:async(contextRow,payload)=>{revisions.push(contextRow.revision);if(contextRow.revision===10)return null;return {...advanced,form_data:payload.form_data,revision:12,updated_at:'2026-07-11T00:00:12.000Z'}},upsert:async()=>{throw new Error('upsert not expected')},fetchRow:async()=>{fetches++;return advanced},rebuild:async(_context,current)=>makeContext(current,Merge.merge(baseForm,localForm,current.form_data,{preferLocal:true})),saveLocal:async()=>{},saveBase:async()=>{}});
      return {revisions,fetches,returned:returned.form_data};
    }
    return {nonOverlap:await runCase(false),sameField:await runCase(true),diagnostics:window.BogatkaSyncCompatibility.diagnostics};
  });
  expect(result.nonOverlap.revisions).toEqual([10,11]);expect(result.nonOverlap.fetches).toBe(1);
  expect(result.nonOverlap.returned).toEqual({localField:'phone',remoteField:'desktop'});expect(result.sameField.returned).toEqual({rent:'1200'});
  expect(result.diagnostics.revisionRebases).toBe(2);expect(result.diagnostics.realConflicts).toBe(0);
  writeEvidence('03-two-client-rebase.json',result);
});

test('repeated identical divergent state fails with field-path diagnostics, not four blind patches',async({page})=>{
  await openApp(page);const fixture=row({revision:20,formData:{rent:'1100'}});
  const result=await page.evaluate(async({fixture})=>{
    const api=window.BogatkaSyncCompatibility._test;api.resetDiagnostics();const local={rent:'1200'};
    const makeContext=()=>({id:'lidskaya-34',item:{id:'lidskaya-34',title:'Лидская'},index:0,row:fixture,local,merged:local,payload:{project_id:fixture.project_id,client_id:fixture.client_id,title:fixture.title,address:fixture.address,note:null,status:fixture.status,object_type:fixture.object_type,form_data:local,sort_order:0,archived_at:null,updated_by:'fixture-user'},dirty:true,needsPush:true});
    let patches=0,error='';
    try{await api.persistLocation(makeContext(),{dirtyLocations:['lidskaya-34']},{isPending:()=>false,conditionalUpdate:async()=>{patches++;return null},upsert:async()=>null,fetchRow:async()=>fixture,rebuild:async()=>makeContext(),saveLocal:async()=>{},saveBase:async()=>{}})}catch(caught){error=caught.message}
    return {patches,error,diagnostics:window.BogatkaSyncCompatibility.diagnostics};
  },{fixture});
  expect(result.patches).toBe(2);expect(result.error).toContain('form_data.rent');expect(result.error).not.toContain('1200');expect(result.error).not.toContain('1100');expect(result.diagnostics.realConflicts).toBe(1);expect(result.diagnostics.lastFailingStage).toContain('non-converging');
  writeEvidence('04-bounded-conflict.json',result);
});

test('single-flight coalesces local and realtime requests into one follow-up without parallel calls',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async()=>{const releases=[];const flight=window.BogatkaSyncCompatibility._test.createSingleFlight(async()=>{await new Promise(resolve=>releases.push(resolve))});const first=flight.invoke();await new Promise(resolve=>setTimeout(resolve,0));const second=flight.invoke(),third=flight.invoke();releases.shift()();while(!releases.length)await new Promise(resolve=>setTimeout(resolve,0));releases.shift()();await Promise.all([first,second,third]);return flight.diagnostics});
  expect(result).toEqual({passes:2,coalesced:2,maxParallel:1});
  writeEvidence('05-single-flight.json',result);
});

test('timestamp-only local changes do not trigger a cloud location write',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async()=>{
    const item=locations[0];locations=[item];
    window.BogatkaCloudStability?.markStartupHandled?.();
    clearTimeout(cloudSyncTimer);clearTimeout(cloudRealtimeTimer);
    const remoteTime='2026-07-11T09:00:00.000Z';
    const remote={id:'remote-timestamp',project_id:'project-timestamp',client_id:item.id,title:item.title,address:item.address,note:item.note||null,status:null,object_type:null,form_data:{contact:'UNCHANGED',updatedAt:remoteTime},sort_order:0,revision:9,updated_at:remoteTime,archived_at:null};
    const localTime='2099-01-01T00:00:00.000Z';
    await window.BogatkaSyncState.rawPut()(STORE,{contact:'UNCHANGED',updatedAt:localTime,cloudId:remote.id,cloudRevision:remote.revision,cloudUpdatedAt:remote.updated_at},`location:${item.id}`);
    await window.BogatkaSyncState.writeBase(item.id,{revision:remote.revision,updatedAt:remote.updated_at,formData:structuredClone(remote.form_data),meta:{title:item.title||item.address||'',address:item.address||'',note:item.note||'',sortOrder:0,archivedAt:null}});
    cloudSession={user:{id:'timestamp-user'}};cloudProjectId=remote.project_id;
    const syncState={dirtyLocations:[],dirtyPhotos:[],deletedPhotos:{},metaDirty:false,stateDirty:false,knownLocationIds:[item.id],knownPhotoIds:[]};
    const context=await window.BogatkaSyncCompatibility._test.buildContext(item,0,remote,syncState);
    const desired=window.BogatkaSyncCompatibility._test.comparable(context.payload);
    const current=window.BogatkaSyncCompatibility._test.comparable(remote);
    let databaseCalls=0;
    cloudClient={from(){databaseCalls++;throw new Error('Unexpected cloud write for timestamp-only difference')}};
    const rows=await cloudPushLocations([remote],syncState);
    return {needsPush:context.needsPush,differences:window.BogatkaSyncCompatibility._test.differencePaths(desired,current),databaseCalls,rowCount:rows.length,localUpdatedAt:(await getLocationData(item.id)).updatedAt};
  });
  expect(result.needsPush).toBe(false);
  expect(result.differences).toEqual([]);
  expect(result.databaseCalls).toBe(0);
  expect(result.rowCount).toBe(1);
  expect(result.localUpdatedAt).toBe('2099-01-01T00:00:00.000Z');
  writeEvidence('06-timestamp-only-noop.json',result);
});

test('background sync cannot replace or overwrite an active form control',async({page})=>{
  await openApp(page);
  await expandFirstCard(page);
  const locationId=await page.evaluate(async()=>{
    const item=locations[0];locations=[item];
    const localTime='2026-07-11T10:00:00.000Z';
    const remoteTime='2026-07-11T10:01:00.000Z';
    await window.BogatkaSyncState.rawPut()(STORE,{contact:'LOCAL',updatedAt:localTime,cloudId:'remote-active',cloudRevision:1,cloudUpdatedAt:localTime},`location:${item.id}`);
    await window.BogatkaSyncState.writeBase(item.id,{revision:1,updatedAt:localTime,formData:{contact:'LOCAL',updatedAt:localTime},meta:{title:item.title||item.address||'',address:item.address||'',note:item.note||'',sortOrder:0,archivedAt:null}});
    cloudSession={user:{id:'active-user'}};cloudProjectId='project-active';cloudRole='owner';
    window.__syncActiveRemote={id:'remote-active',project_id:'project-active',client_id:item.id,title:item.title,address:item.address,note:item.note||null,status:null,object_type:null,form_data:{contact:'REMOTE',updatedAt:remoteTime},sort_order:0,revision:2,updated_at:remoteTime,archived_at:null};
    return item.id;
  });
  const input=page.locator(`[data-location="${locationId}"][data-field="contact"]`);
  await expect(input).toBeVisible();
  await input.focus();
  await expect(input).toBeFocused();
  await input.evaluate(element=>{
    window.__syncActiveInput=element;
    window.__syncActiveFocusedBefore=document.activeElement===element;
    element.value='ПЕЧАТАЮ — НЕ СБРАСЫВАТЬ';
  });
  const result=await page.evaluate(async locationId=>{
    await cloudApplyRemote([window.__syncActiveRemote],[],null,{dirtyLocations:[],dirtyPhotos:[],deletedPhotos:{},knownLocationIds:[locationId],knownPhotoIds:[]});
    const current=document.querySelector(`[data-location="${locationId}"][data-field="contact"]`);
    const stored=await getLocationData(locationId);
    return {focusedBefore:window.__syncActiveFocusedBefore,sameNode:current===window.__syncActiveInput,active:document.activeElement===window.__syncActiveInput,visibleValue:window.__syncActiveInput.value,storedValue:stored.contact,suppressed:window.BogatkaCloudStability?.suppressedUiRefreshes||0};
  },locationId);
  expect(result.focusedBefore).toBe(true);
  expect(result.sameNode).toBe(true);
  expect(result.active).toBe(true);
  expect(result.visibleValue).toBe('ПЕЧАТАЮ — НЕ СБРАСЫВАТЬ');
  expect(result.storedValue).toBe('REMOTE');
  expect(result.suppressed).toBeGreaterThan(0);
  writeEvidence('07-active-editor-protection.json',result);
});

test('cloud error UI has one explanation and clears after recovery',async({page})=>{
  await openApp(page);mkdirSync(ARTIFACT_DIR,{recursive:true});const message='Сетевая ошибка синхронизации. Локальные изменения сохранены.';
  await page.evaluate(message=>{
    document.querySelector('#syncTestShell')?.remove();
    document.querySelectorAll('#cloudStatusTitle,#cloudStatusDetail,#cloudIndicator,#cloudMessage').forEach(node=>node.remove());
    const shell=document.createElement('section');shell.id='syncTestShell';
    shell.innerHTML='<h2>Облачная синхронизация</h2><div class="cloud-panel"><div class="cloud-status-card"><div><strong id="cloudStatusTitle">Облачная синхронизация</strong><small id="cloudStatusDetail">Подготовка…</small></div><span class="cloud-indicator" id="cloudIndicator"></span></div><div class="cloud-message" id="cloudMessage"></div></div>';
    document.body.appendChild(shell);
    window.BogatkaSyncCompatibility._test.showSyncError(new Error(message));
  },message);
  const shell=page.locator('#syncTestShell');
  await expect(shell.locator('#cloudStatusTitle')).toHaveText('Облако: ошибка');
  await expect(shell.locator('#cloudMessage')).toContainText(message);
  await expect(shell.locator('[data-cloud-retry-sync]')).toBeVisible();
  expect(await shell.getByText(message,{exact:true}).count()).toBe(1);
  await shell.screenshot({path:path.join(ARTIFACT_DIR,'08-single-cloud-error.png')});
  await page.evaluate(()=>{window.BogatkaSyncCompatibility._test.clearSyncError();cloudSetStatus('ready')});
  await expect(shell.locator('#cloudStatusTitle')).toHaveText('Облако: синхронизировано');
  await expect(shell.locator('#cloudMessage')).not.toHaveClass(/error/);
  await expect(shell.locator('#cloudMessage')).toContainText('Синхронизация завершена');
  await shell.screenshot({path:path.join(ARTIFACT_DIR,'09-synchronized-after-retry.png')});
  const diagnostics=await page.evaluate(()=>({mergeVersion:window.BogatkaSyncMerge.version,transportVersion:window.BogatkaSyncMerge.transportVersion,compatibilityVersion:window.BogatkaSyncCompatibility.version,diagnostics:window.BogatkaSyncCompatibility.diagnostics,visibleVersion:window.BOGATKA_BUILD?.version||document.querySelector('#versionLabel')?.textContent||'',token:window.BOGATKA_BUILD?.versionToken||''}));
  writeEvidence('10-runtime-summary.json',diagnostics);
});
