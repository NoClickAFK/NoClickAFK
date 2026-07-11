import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=435';
const ARTIFACT_DIR=path.resolve('test-results/sync-v435-review');

function writeEvidence(name,value){
  mkdirSync(ARTIFACT_DIR,{recursive:true});
  writeFileSync(path.join(ARTIFACT_DIR,name),JSON.stringify(value,null,2));
}

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.BogatkaSyncMerge?.transportVersion==='4.3.5');
  await page.waitForFunction(()=>window.BogatkaSyncCompatibility?.version==='4.3.5');
}

async function expandFirstCard(page){
  await page.evaluate(()=>{
    const card=document.querySelector('[data-location-card]');
    window.BogatkaLocationCardCollapseV422?.setCollapsed?.(card,false,{persist:false});
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
    return {normalized:Merge.transportNormalize(input),equalsTransport:Merge.same(input,JSON.parse(JSON.stringify(input))),canonical:Merge.canonical(input)};
  });
  expect(result.equalsTransport).toBe(true);
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

test('active editor survives remote apply and idle apply refreshes the same field without reload',async({page})=>{
  await openApp(page);await expandFirstCard(page);
  const result=await page.evaluate(async()=>{
    const item=locations[0];locations=[item];const id=item.id;const selector=`[data-location="${id}"][data-field="contact"]`;const input=document.querySelector(selector);const now=new Date().toISOString();
    cloudSession={user:{id:'fixture-user',email:'fixture@example.com'}};cloudProjectId='project-active';cloudRole='owner';
    await cloudOriginalIdbPut(STORE,{contact:'LOCAL',updatedAt:now,cloudRevision:1,cloudUpdatedAt:now},`location:${id}`);
    const remote={id:'remote-active',project_id:'project-active',client_id:id,title:item.title,address:item.address,note:item.note,status:null,object_type:null,form_data:{contact:'REMOTE',updatedAt:now},sort_order:0,revision:2,updated_at:now,archived_at:null};
    input.focus();input.value='ПЕЧАТАЮ — НЕ СБРАСЫВАТЬ';const original=input;
    await cloudApplyRemote([remote],[],null,{dirtyLocations:[],dirtyPhotos:[],deletedPhotos:{}});
    const active={sameNode:document.querySelector(selector)===original,focused:document.activeElement===original,value:original.value,stored:(await getLocationData(id)).contact};
    input.blur();await window.BogatkaUIStability?.settleAfterBlur?.();await window.BogatkaUIStability?.flush?.();const idleNode=document.querySelector(selector);
    return {active,idle:{sameNode:idleNode===original,value:idleNode.value,stored:(await getLocationData(id)).contact}};
  });
  expect(result.active).toEqual({sameNode:true,focused:true,value:'ПЕЧАТАЮ — НЕ СБРАСЫВАТЬ',stored:'REMOTE'});expect(result.idle.sameNode).toBe(true);expect(result.idle.value).toBe('REMOTE');expect(result.idle.stored).toBe('REMOTE');
});

test('cloud modal shows one primary error and clears it after successful retry',async({page})=>{
  await openApp(page);mkdirSync(ARTIFACT_DIR,{recursive:true});const message='Сетевая ошибка синхронизации. Локальные изменения сохранены.';
  await page.evaluate(message=>{
    const modal=document.querySelector('#cloudModal');
    modal.classList.remove('hidden');
    modal.querySelector('.modal-card').innerHTML='<h2>Облачная синхронизация</h2><div class="cloud-panel"><div class="cloud-status-card"><div><strong id="cloudStatusTitle">Облачная синхронизация</strong><small id="cloudStatusDetail">Подготовка…</small></div><span class="cloud-indicator" id="cloudIndicator"></span></div><div class="cloud-message" id="cloudMessage"></div></div>';
    window.BogatkaSyncCompatibility._test.showSyncError(new Error(message));
  },message);
  await expect(page.locator('#cloudStatusTitle')).toHaveText('Облако: ошибка');await expect(page.locator('#cloudMessage')).toContainText(message);await expect(page.locator('[data-cloud-retry-sync]')).toBeVisible();expect(await page.locator('#cloudModal').getByText(message,{exact:true}).count()).toBe(1);
  await page.locator('#cloudModal .modal-card').screenshot({path:path.join(ARTIFACT_DIR,'06-single-cloud-error.png')});
  await page.evaluate(()=>{window.BogatkaSyncCompatibility._test.clearSyncError();cloudSetStatus('ready')});await expect(page.locator('#cloudStatusTitle')).toHaveText('Облако: синхронизировано');await expect(page.locator('#cloudMessage')).not.toHaveClass(/error/);await expect(page.locator('#cloudMessage')).toContainText('Синхронизация завершена');
  await page.locator('#cloudModal .modal-card').screenshot({path:path.join(ARTIFACT_DIR,'07-synchronized-after-retry.png')});
  const diagnostics=await page.evaluate(()=>({mergeVersion:window.BogatkaSyncMerge.version,transportVersion:window.BogatkaSyncMerge.transportVersion,compatibilityVersion:window.BogatkaSyncCompatibility.version,diagnostics:window.BogatkaSyncCompatibility.diagnostics,visibleVersion:window.BOGATKA_BUILD?.version||document.querySelector('#versionLabel')?.textContent||'',token:window.BOGATKA_BUILD?.versionToken||''}));writeEvidence('08-runtime-summary.json',diagnostics);
});
