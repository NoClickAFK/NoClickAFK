import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=archive-success-evidence-v437';
const OUT=path.resolve('review-artifacts/archive-sync-v436-review');
const ID='archive-success-v437';

function evidence(value){mkdirSync(OUT,{recursive:true});writeFileSync(path.join(OUT,'06-synchronized-cloud-modal.json'),JSON.stringify(value,null,2))}

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'load'});
  await page.waitForFunction(()=>Boolean(window.BogatkaSyncCompatibility?.ready&&window.BogatkaArchiveStateV436?.ready&&window.BogatkaInitialBackgroundEditProtectionV437?.audit?.().ok),{timeout:30000});
}

test('successful no-op retry clears authoritative cloud error state and writes matching evidence',async({page})=>{
  test.setTimeout(60000);
  await openApp(page);
  await page.evaluate(async id=>{
    window.BogatkaMutationAuthorityV437?._test?.setState?.('owner','archive-evidence');
    const now='2026-07-14T15:00:00.000Z';
    const item={id,title:'Archive success fixture',address:'Fixture address',note:'',custom:true,cloudId:`remote-${id}`,archivedAt:null};
    const local={archivedAt:null,updatedAt:now,cloudId:`remote-${id}`,cloudRevision:11,cloudUpdatedAt:now};
    const remote={
      id:`remote-${id}`,project_id:'project-archive-success-v437',client_id:id,title:item.title,address:item.address,note:null,
      status:null,object_type:null,form_data:{archivedAt:null,updatedAt:now},sort_order:0,archived_at:null,
      revision:11,created_at:now,updated_at:now,
    };
    locations=[item];
    await window.BogatkaSyncState.rawPut()(STORE,local,`location:${id}`);
    await window.BogatkaSyncState.rawPut()(STORE,locations,'meta:locations');
    await window.BogatkaSyncState.rawPut()(STORE,{},'global');
    await window.BogatkaSyncState.writeBase(id,{revision:11,updatedAt:now,formData:{archivedAt:null,updatedAt:now},meta:{title:item.title,address:item.address,note:'',sortOrder:0,archivedAt:null}});
    cloudSession={user:{id:'fixture-owner-v437',email:'fixture@example.test',user_metadata:{display_name:'Fixture'}}};
    cloudProjectId=remote.project_id;cloudRole='owner';window.cloudRole='owner';
    cloudWriteState({projectId:cloudProjectId,userId:cloudSession.user.id,dirtyLocations:[],dirtyPhotos:[],deletedPhotos:{},deletedLocations:{},knownLocationIds:[id],knownPhotoIds:[],stateDirty:false,metaDirty:false});
    const calls=window.__archiveSuccessCalls={locationReads:0,patch:0,upsert:0,projectWrites:0,photoWrites:0};
    const clone=value=>value===undefined?undefined:structuredClone(value);
    const readBuilder=data=>{
      const builder={
        select(){return builder},eq(){return builder},is(){return builder},
        order:async()=>({data:clone(data),error:null}),
        maybeSingle:async()=>({data:Array.isArray(data)?clone(data[0]||null):clone(data),error:null}),
        single:async()=>({data:Array.isArray(data)?clone(data[0]||null):clone(data),error:null}),
        then(resolve,reject){return builder.order().then(resolve,reject)},
      };
      return builder;
    };
    cloudClient={
      from(table){
        if(table==='locations'){
          const builder=readBuilder([remote]);
          const select=builder.select.bind(builder);
          builder.select=(...args)=>{calls.locationReads+=1;return select(...args)};
          builder.update=()=>{calls.patch+=1;throw new Error('No-op retry must not PATCH')};
          builder.upsert=()=>{calls.upsert+=1;throw new Error('No-op retry must not UPSERT')};
          return builder;
        }
        if(table==='photos')return readBuilder([]);
        if(table==='project_state'){
          const builder=readBuilder({project_id:remote.project_id,data:{},revision:1,updated_at:now});
          builder.upsert=()=>{calls.projectWrites+=1;throw new Error('No-op retry must not write project state')};
          return builder;
        }
        throw new Error(`Unexpected table ${table}`);
      },
      channel(){return{on(){return this},subscribe(){return this},unsubscribe(){}}},
      storage:{from(){return{upload:async()=>{calls.photoWrites+=1;return{error:null}},remove:async()=>({error:null}),download:async()=>({data:null,error:null})}}},
      removeChannel:async()=>{},
    };
    cloudDeleteRemovedLocations=async()=>{};
    cloudDeletePhotos=async()=>{};
    cloudPushPhotos=async()=>{};
    cloudPushProjectState=async()=>{};
    cloudSubscribeRealtime=async()=>{};
    renderLocations();
    cloudRenderModal();
    window.BogatkaSyncCompatibility._test.showSyncError(new Error('fixture archive conflict'));
    document.querySelector('#cloudModal')?.classList.remove('hidden');
  },ID);

  await expect(page.locator('#cloudStatusTitle')).toHaveText('Облако: ошибка');
  const result=await page.evaluate(async()=>{
    const syncResult=await cloudSyncAll({manual:true});
    const state=cloudReadState();
    return{
      syncResult,
      calls:{...window.__archiveSuccessCalls},
      message:document.querySelector('#cloudMessage')?.textContent||'',
      statusTitle:document.querySelector('#cloudStatusTitle')?.textContent||'',
      topPill:document.querySelector('#cloudTopPill')?.textContent||'',
      indicatorClass:document.querySelector('#cloudIndicator')?.className||'',
      dirtyLocations:state.dirtyLocations||[],
      metaDirty:Boolean(state.metaDirty),
      stateDirty:Boolean(state.stateDirty),
    };
  });
  await expect(page.locator('#cloudMessage')).toHaveText('Синхронизация завершена.');
  await expect(page.locator('#cloudStatusTitle')).toHaveText('Облако: синхронизировано');
  await expect(page.locator('#cloudTopPill')).toHaveText('Облако синхронизировано');
  await expect(page.locator('#cloudIndicator')).toHaveClass(/ready/);
  expect(result.calls).toMatchObject({patch:0,upsert:0,projectWrites:0,photoWrites:0});
  expect(result.dirtyLocations).toEqual([]);
  expect(result.metaDirty).toBe(false);
  expect(result.stateDirty).toBe(false);
  await page.locator('#cloudModal .modal-card').screenshot({path:path.join(OUT,'06-synchronized-cloud-modal.png')});
  evidence({
    message:result.message,statusTitle:result.statusTitle,topPill:result.topPill,indicatorClass:result.indicatorClass,
    errorCleared:true,dirtyLocations:result.dirtyLocations,metaDirty:result.metaDirty,stateDirty:result.stateDirty,
    noOpSynchronization:true,...result.calls,
  });
});
