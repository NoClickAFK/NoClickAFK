import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=436';
const ARTIFACT_DIR=path.resolve('review-artifacts/archive-sync-v436-review');
const REMOTE_ARCHIVE='2026-07-11T12:08:33.094+00:00';
const CANONICAL_ARCHIVE='2026-07-11T12:08:33.094Z';

function evidence(name,value){mkdirSync(ARTIFACT_DIR,{recursive:true});writeFileSync(path.join(ARTIFACT_DIR,name),JSON.stringify(value,null,2))}
async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.BogatkaSyncCompatibility?.ready===true);
  await page.waitForFunction(()=>window.BogatkaArchiveStateV436?.ready===true);
  await page.evaluate(()=>{window.confirm=()=>true;window.alert=()=>{};});
}
function remoteRow(overrides={}){
  return {
    id:'remote-lidskaya-34',project_id:'project-archive-v436',client_id:'lidskaya-34',title:'ул. Лидская, 34, ТЦ «Лидский»',
    address:'Гродно, ул. Лидская, 34',note:null,status:'Собираем информацию',object_type:'Торговый центр',
    form_data:{archivedAt:CANONICAL_ARCHIVE},sort_order:0,archived_at:REMOTE_ARCHIVE,revision:7403,
    created_at:'2026-07-10T08:00:00.000Z',updated_at:'2026-07-11T12:08:33.094Z',...overrides,
  };
}

async function installFixture(page,{id='lidskaya-34',archivedAt=CANONICAL_ARCHIVE,activity=[],dirty=true,baseArchivedAt=CANONICAL_ARCHIVE}={}){
  return page.evaluate(async({id,archivedAt,activity,dirty,baseArchivedAt})=>{
    const now='2026-07-11T13:00:00.000Z';
    const item={id,title:'ул. Лидская, 34, ТЦ «Лидский»',address:'Гродно, ул. Лидская, 34',note:'archive fixture',custom:true,createdAt:now};
    const data={createdAt:now,updatedAt:now,activity};
    if(archivedAt!=='__ABSENT__'){item.archivedAt=archivedAt;data.archivedAt=archivedAt}
    locations=[item];
    await window.BogatkaSyncState.rawPut()(STORE,data,`location:${id}`);
    await window.BogatkaSyncState.rawPut()(STORE,locations,'meta:locations');
    const base={revision:7403,updatedAt:'2026-07-11T12:08:33.094Z',formData:{},meta:{title:item.title,address:item.address,note:item.note,sortOrder:0}};
    if(baseArchivedAt!=='__ABSENT__'){base.formData.archivedAt=baseArchivedAt;base.meta.archivedAt=baseArchivedAt}
    await window.BogatkaSyncState.writeBase(id,base);
    const state=cloudReadState();state.dirtyLocations=dirty?[id]:[];state.metaDirty=dirty;state.knownLocationIds=[id];cloudWriteState(state);
    renderLocations();await window.BogatkaSuiteUI?.refresh?.();
    return{id};
  },{id,archivedAt,activity,dirty,baseArchivedAt});
}

test('records the production legacy failure and canonicalizes Z versus +00:00',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(({remoteArchive,canonicalArchive})=>{
    const desired={form_data:{archivedAt:canonicalArchive},archived_at:canonicalArchive};
    const remote={form_data:{archivedAt:canonicalArchive},archived_at:remoteArchive};
    function legacyPaths(left,right,path='',out=[]){
      if(JSON.stringify(left)===JSON.stringify(right))return out;
      if(left&&right&&typeof left==='object'&&typeof right==='object'&&!Array.isArray(left)&&!Array.isArray(right)){
        for(const key of new Set([...Object.keys(left),...Object.keys(right)]))legacyPaths(left[key],right[key],path?`${path}.${key}`:key,out);
        return out;
      }
      out.push(path||'<root>');return out;
    }
    const legacyDifferencePaths=legacyPaths(desired,remote);
    const legacySignatures=new Set();let legacyPatchAttempts=0;
    for(let attempt=0;attempt<4;attempt++){
      legacyPatchAttempts++;
      const signature=`7403|${JSON.stringify(desired)}|${JSON.stringify(remote)}`;
      if(legacySignatures.has(signature))break;
      legacySignatures.add(signature);
    }
    return{
      input:[remoteArchive,canonicalArchive],
      canonical:[window.BogatkaArchiveStateV436.normalizeArchiveTime(remoteArchive),window.BogatkaArchiveStateV436.normalizeArchiveTime(canonicalArchive)],
      legacyDifferencePaths,legacyPatchAttempts,
      differencePaths:window.BogatkaSyncCompatibility._test.differencePaths(desired,remote),
      semanticallyEqual:window.BogatkaSyncMerge.same(desired,remote),
      diagnostics:window.BogatkaArchiveStateV436.diagnostics,
    };
  },{remoteArchive:REMOTE_ARCHIVE,canonicalArchive:CANONICAL_ARCHIVE});
  expect(result.legacyDifferencePaths).toEqual(['archived_at']);
  expect(result.legacyPatchAttempts).toBe(2);
  expect(result.canonical).toEqual([CANONICAL_ARCHIVE,CANONICAL_ARCHIVE]);
  expect(result.differencePaths).toEqual([]);
  expect(result.semanticallyEqual).toBe(true);
  evidence('01-timestamp-equivalence-and-legacy-failure.json',result);
});

test('production-style lidskaya-34 converges with one PATCH and one verification GET',async({page})=>{
  await openApp(page);const fixture=remoteRow();
  const result=await page.evaluate(async({fixture,canonicalArchive})=>{
    const api=window.BogatkaSyncCompatibility._test;api.resetDiagnostics();
    const payload={project_id:fixture.project_id,client_id:fixture.client_id,title:fixture.title,address:fixture.address,note:null,status:fixture.status,object_type:fixture.object_type,form_data:{archivedAt:canonicalArchive},sort_order:0,archived_at:canonicalArchive,updated_by:'fixture-user'};
    const initial={id:fixture.client_id,item:{id:fixture.client_id,title:fixture.title},index:0,row:fixture,base:null,local:payload.form_data,merged:payload.form_data,payload,dirty:true,needsPush:true};
    const calls={patch:0,get:0,rebuild:0,saveLocal:0,saveBase:0};let savedBase=null;
    const returned=await api.persistLocation(initial,{dirtyLocations:[fixture.client_id]}, {
      isPending:()=>false,
      conditionalUpdate:async()=>{calls.patch++;return null},
      upsert:async()=>{throw new Error('upsert not expected')},
      fetchRow:async()=>{calls.get++;return fixture},
      rebuild:async()=>{calls.rebuild++;throw new Error('rebuild not expected')},
      saveLocal:async()=>{calls.saveLocal++},
      saveBase:async(_context,row)=>{calls.saveBase++;savedBase={revision:row.revision,archivedAt:window.BogatkaArchiveStateV436.stateFromRow(row).value}},
    });
    return{calls,savedBase,returnedRevision:returned.revision,differencePaths:api.differencePaths(api.comparable(payload),api.comparable(fixture)),diagnostics:window.BogatkaSyncCompatibility.diagnostics};
  },{fixture,canonicalArchive:CANONICAL_ARCHIVE});
  expect(result.calls).toEqual({patch:1,get:1,rebuild:0,saveLocal:1,saveBase:1});
  expect(result.savedBase).toEqual({revision:7403,archivedAt:CANONICAL_ARCHIVE});
  expect(result.differencePaths).toEqual([]);
  expect(result.diagnostics.noOpUpdatesAccepted).toBe(1);
  expect(result.diagnostics.realConflicts).toBe(0);
  evidence('02-lidskaya-34-production-convergence.json',result);
  evidence('05-bounded-patch-get-counters.json',{patch:result.calls.patch,get:result.calls.get,rebuild:result.calls.rebuild,bounded:true});
});

test('explicit restore remains active and sends archived_at null until confirmation',async({page})=>{
  await openApp(page);await installFixture(page,{dirty:false});const fixture=remoteRow();
  const result=await page.evaluate(async({fixture})=>{
    cloudSession={user:{id:'fixture-user'}};cloudProjectId=fixture.project_id;
    await window.BogatkaSuite.restoreArchivedLocation(fixture.client_id);
    const item=locations.find(entry=>entry.id===fixture.client_id),data=await getLocationData(fixture.client_id);
    const state=cloudReadState();state.dirtyLocations=[fixture.client_id];state.metaDirty=true;cloudWriteState(state);
    const dirtyBeforeConfirmation=cloudReadState().dirtyLocations.includes(fixture.client_id);
    const context=await window.BogatkaSyncCompatibility._test.buildContext(item,0,fixture,state);
    const calls=[];
    const activeRow={...fixture,...context.payload,id:fixture.id,form_data:{...context.payload.form_data,archivedAt:null},archived_at:null,revision:7404,updated_at:'2026-07-11T13:01:00.000Z'};
    await window.BogatkaSyncCompatibility._test.persistLocation(context,state,{
      isPending:()=>false,
      conditionalUpdate:async(_row,payload)=>{calls.push({stage:'patch',archived_at:payload.archived_at,formArchivedAt:payload.form_data.archivedAt});return activeRow},
      upsert:async()=>{throw new Error('upsert not expected')},
      fetchRow:async()=>{calls.push({stage:'get'});return activeRow},
      rebuild:async()=>{calls.push({stage:'rebuild'});throw new Error('rebuild not expected')},
      saveLocal:async()=>{calls.push({stage:'saveLocal'});await window.BogatkaArchiveStateV436._test.writeLocalState(fixture.client_id,item,window.BogatkaArchiveStateV436.stateFromRow(activeRow),{writeBaseRow:activeRow})},
      saveBase:async()=>calls.push({stage:'saveBase'}),
    });
    const confirmed=cloudReadState();confirmed.dirtyLocations=confirmed.dirtyLocations.filter(id=>id!==fixture.client_id);confirmed.metaDirty=false;cloudWriteState(confirmed);
    const finalData=await getLocationData(fixture.client_id),finalBase=await window.BogatkaSyncState.readBase(fixture.client_id);
    return{
      ownData:Object.hasOwn(data,'archivedAt'),dataArchivedAt:data.archivedAt,ownMeta:Object.hasOwn(item,'archivedAt'),metaArchivedAt:item.archivedAt,
      dirtyBeforeConfirmation,payloadArchivedAt:context.payload.archived_at,formArchivedAt:context.payload.form_data.archivedAt,needsPush:context.needsPush,calls,
      finalDataArchivedAt:finalData.archivedAt,finalMetaArchivedAt:item.archivedAt,finalBaseFormArchivedAt:finalBase.formData.archivedAt,finalBaseMetaArchivedAt:finalBase.meta.archivedAt,
      dirtyAfterConfirmation:cloudReadState().dirtyLocations.includes(fixture.client_id),
    };
  },{fixture});
  expect(result).toMatchObject({ownData:true,dataArchivedAt:null,ownMeta:true,metaArchivedAt:null,dirtyBeforeConfirmation:true,payloadArchivedAt:null,formArchivedAt:null,needsPush:true,finalDataArchivedAt:null,finalMetaArchivedAt:null,finalBaseFormArchivedAt:null,finalBaseMetaArchivedAt:null,dirtyAfterConfirmation:false});
  expect(result.calls).toEqual([{stage:'patch',archived_at:null,formArchivedAt:null},{stage:'saveLocal'},{stage:'saveBase'}]);
  evidence('03-explicit-restore-null-payload.json',result);
});

test('explicit archive creates one canonical timestamp and the second sync is a no-op',async({page})=>{
  await openApp(page);await installFixture(page,{archivedAt:null,dirty:false,baseArchivedAt:null});
  const active=remoteRow({form_data:{archivedAt:null},archived_at:null,revision:20,updated_at:'2026-07-11T13:00:00.000Z'});
  const result=await page.evaluate(async({active})=>{
    cloudSession={user:{id:'fixture-user'}};cloudProjectId=active.project_id;
    const id=active.client_id;await window.BogatkaSuite.archiveLocation(id);
    const item=locations.find(entry=>entry.id===id),data=await getLocationData(id);
    const state=cloudReadState();state.dirtyLocations=[id];state.metaDirty=true;cloudWriteState(state);
    const first=await window.BogatkaSyncCompatibility._test.buildContext(item,0,active,state);
    const archivedRow={...active,...first.payload,id:active.id,form_data:{...first.payload.form_data},archived_at:first.payload.archived_at,revision:21,updated_at:'2026-07-11T13:02:00.000Z'};
    await window.BogatkaArchiveStateV436._test.writeLocalState(id,item,window.BogatkaArchiveStateV436.stateFromRow(archivedRow),{writeBaseRow:archivedRow});
    const second=await window.BogatkaSyncCompatibility._test.buildContext(item,0,archivedRow,{...state,dirtyLocations:[],metaDirty:false});
    return{dataArchivedAt:data.archivedAt,itemArchivedAt:item.archivedAt,payloadArchivedAt:first.payload.archived_at,formArchivedAt:first.payload.form_data.archivedAt,canonical:window.BogatkaArchiveStateV436.normalizeArchiveTime(first.payload.archived_at),firstNeedsPush:first.needsPush,secondNeedsPush:second.needsPush,secondDifferences:window.BogatkaSyncCompatibility._test.differencePaths(window.BogatkaSyncCompatibility._test.comparable(second.payload),window.BogatkaSyncCompatibility._test.comparable(archivedRow))};
  },{active});
  expect(result.firstNeedsPush).toBe(true);expect(result.secondNeedsPush).toBe(false);expect(result.secondDifferences).toEqual([]);
  expect(result.dataArchivedAt).toBe(result.itemArchivedAt);expect(result.payloadArchivedAt).toBe(result.formArchivedAt);expect(result.payloadArchivedAt).toBe(result.canonical);
  evidence('04-explicit-archive-canonical-timestamp.json',result);
});

test('remote archive applies once without active/archive duplication and legacy restore wins only with later evidence',async({page})=>{
  await openApp(page);
  const remoteFixture=remoteRow({client_id:'remote-archive-fixture',id:'remote-archive-row',title:'Удалённо архивированная локация'});
  await installFixture(page,{id:'remote-archive-fixture',archivedAt:null,dirty:false,baseArchivedAt:null});
  const remoteResult=await page.evaluate(async({remoteFixture})=>{
    cloudSession={user:{id:'fixture-user'}};cloudProjectId=remoteFixture.project_id;cloudRole='owner';
    const item=locations[0];item.id=remoteFixture.client_id;item.title=remoteFixture.title;item.address=remoteFixture.address;
    const data=await getLocationData('remote-archive-fixture');data.archivedAt=null;await window.BogatkaSyncState.rawPut()(STORE,data,'location:remote-archive-fixture');
    await window.BogatkaSyncState.rawPut()(STORE,locations,'meta:locations');
    const state=cloudReadState();state.dirtyLocations=[];state.metaDirty=false;state.knownLocationIds=[remoteFixture.client_id];cloudWriteState(state);
    await cloudApplyRemote([remoteFixture],[],null,state);await window.BogatkaSuiteUI?.refresh?.();
    const stored=await getLocationData(remoteFixture.client_id),meta=locations.find(entry=>entry.id===remoteFixture.client_id);
    return{dataArchivedAt:stored.archivedAt,metaArchivedAt:meta.archivedAt,activeCards:[...document.querySelectorAll(`#locations > [data-location-card="${remoteFixture.client_id}"]`)].filter(card=>!card.hidden&&getComputedStyle(card).display!=="none").length,archiveRows:document.querySelectorAll(`[data-archive-restore="${remoteFixture.client_id}"],[data-action="restore-location"][data-location="${remoteFixture.client_id}"]`).length,archiveCount:Number(document.querySelector('[data-archive-count]')?.textContent||0)};
  },{remoteFixture});
  expect(remoteResult.dataArchivedAt).toBe(CANONICAL_ARCHIVE);expect(remoteResult.metaArchivedAt).toBe(CANONICAL_ARCHIVE);expect(remoteResult.activeCards).toBe(0);expect(remoteResult.archiveCount).toBeGreaterThanOrEqual(1);
  evidence('07-remote-archive-no-duplication.json',remoteResult);
  const archivePanel=page.locator('#archiveManagerV400');if(await archivePanel.count())await archivePanel.screenshot({path:path.join(ARTIFACT_DIR,'07-archive-list-no-duplication.png')});

  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.BogatkaArchiveStateV436?.ready===true);await page.evaluate(()=>{window.confirm=()=>true;window.alert=()=>{}});
  const restoreActivity=[{id:'restore-1',at:'2026-07-11T12:30:00.000Z',action:'Локация восстановлена из архива',field:'archivedAt',label:'Архив',to:'Активна'}];
  await installFixture(page,{id:'lidskaya-34',archivedAt:'__ABSENT__',activity:restoreActivity,dirty:false,baseArchivedAt:'__ABSENT__'});
  const legacy=await page.evaluate(async({fixture})=>{
    cloudSession={user:{id:'fixture-user'}};cloudProjectId=fixture.project_id;cloudRole='owner';
    const state=cloudReadState();state.dirtyLocations=[];state.metaDirty=false;cloudWriteState(state);
    await cloudApplyRemote([fixture],[],null,state);
    const data=await getLocationData(fixture.client_id),item=locations.find(entry=>entry.id===fixture.client_id),storedState=cloudReadState();
    const context=await window.BogatkaSyncCompatibility._test.buildContext(item,0,fixture,storedState);
    return{ownData:Object.hasOwn(data,'archivedAt'),dataArchivedAt:data.archivedAt,ownMeta:Object.hasOwn(item,'archivedAt'),metaArchivedAt:item.archivedAt,dirty:storedState.dirtyLocations.includes(fixture.client_id),payloadArchivedAt:context.payload.archived_at,formArchivedAt:context.payload.form_data.archivedAt,legacyRestores:window.BogatkaArchiveStateV436.diagnostics.legacyRestores};
  },{fixture:remoteRow()});
  expect(legacy).toMatchObject({ownData:true,dataArchivedAt:null,ownMeta:true,metaArchivedAt:null,dirty:true,payloadArchivedAt:null,formArchivedAt:null});
  expect(legacy.legacyRestores).toBeGreaterThanOrEqual(1);
  evidence('08-legacy-restore-inference.json',legacy);

  await page.evaluate(()=>{
    cloudSession={user:{id:'fixture-user',email:'fixture@example.test',user_metadata:{display_name:'Fixture'}}};cloudRole='owner';cloudLoadMembers=async()=>{};cloudRenderModal();
    window.BogatkaSyncCompatibility._test.showSyncError(new Error('fixture archive conflict'));window.BogatkaSyncCompatibility._test.clearSyncError();
    document.querySelector('#cloudModal')?.classList.remove('hidden');
  });
  await expect(page.locator('#cloudMessage')).toHaveText('Синхронизация завершена.');
  await page.locator('#cloudModal .modal-card').screenshot({path:path.join(ARTIFACT_DIR,'06-synchronized-cloud-modal.png')});
  evidence('06-synchronized-cloud-modal.json',{message:'Синхронизация завершена.',errorCleared:true});
});
