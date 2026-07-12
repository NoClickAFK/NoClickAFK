import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=436';
const ARTIFACT_DIR=path.resolve('review-artifacts/archive-sync-v436-review');
const ACTIVE_ID='startup-active-row';
const ARCHIVED_ID='startup-archived-row';
const ARCHIVED_AT='2026-07-12T08:00:00.000Z';

function evidence(name,value){
  mkdirSync(ARTIFACT_DIR,{recursive:true});
  writeFileSync(path.join(ARTIFACT_DIR,name),JSON.stringify(value,null,2));
}

function installSignedInCloudFixture(){
  const activeRow={
    id:'remote-startup-active',project_id:'startup-project',client_id:'startup-active-row',
    title:'Active startup fixture',address:'Гродно',note:null,status:'active-column',object_type:'Стрит-ритейл',
    form_data:{note:'active'},sort_order:0,archived_at:null,revision:2,
    updated_at:'2026-07-12T08:05:00.000Z',created_at:'2026-07-12T08:00:00.000Z',
  };
  const archivedRow={
    id:'remote-startup-archived',project_id:'startup-project',client_id:'startup-archived-row',
    title:'Archived startup fixture',address:'Гродно',note:null,status:'archived-column',object_type:'Street retail',
    form_data:{note:'archived',archivedAt:'2026-07-12T08:00:00.000Z'},sort_order:1,
    archived_at:'2026-07-12T08:00:00.000Z',revision:3,
    updated_at:'2026-07-12T08:06:00.000Z',created_at:'2026-07-12T08:00:00.000Z',
  };
  const fixture=window.__startupArchiveFetchFixture={
    startedAt:Date.now(),fetches:[],writes:[],rows:[activeRow,archivedRow],
  };
  const clone=value=>value===undefined?undefined:structuredClone(value);

  class Builder{
    constructor(table){this.table=table;this.operation='select';this.filters=[];this.payload=null;}
    select(){return this}
    eq(key,value){this.filters.push({kind:'eq',key,value});return this}
    is(key,value){this.filters.push({kind:'is',key,value});return this}
    in(key,value){this.filters.push({kind:'in',key,value});return this}
    order(){return Promise.resolve(this.execute('many'))}
    maybeSingle(){return Promise.resolve(this.execute('maybeSingle'))}
    single(){return Promise.resolve(this.execute('single'))}
    upsert(payload){this.operation='upsert';this.payload=payload;return this}
    update(payload){this.operation='update';this.payload=payload;return this}
    insert(payload){this.operation='insert';this.payload=payload;return this}
    delete(){this.operation='delete';return this}
    then(resolve,reject){return Promise.resolve(this.execute('many')).then(resolve,reject)}
    matchingRows(){
      let rows=fixture.rows.map(clone);
      for(const filter of this.filters){
        if(filter.kind==='eq')rows=rows.filter(row=>row?.[filter.key]===filter.value);
        if(filter.kind==='is')rows=rows.filter(row=>row?.[filter.key]===filter.value);
        if(filter.kind==='in')rows=rows.filter(row=>(filter.value||[]).includes(row?.[filter.key]));
      }
      return rows;
    }
    execute(mode){
      if(this.table==='project_members')return{data:{role:'owner'},error:null};
      if(this.table==='profiles')return{data:[],error:null};
      if(this.table==='photos')return{data:[],error:null};
      if(this.table==='project_state'){
        if(this.operation==='upsert')return{data:{id:'startup-state',data:clone(this.payload?.data||{}),updated_at:new Date().toISOString()},error:null};
        return{data:null,error:null};
      }
      if(this.table==='locations'){
        if(this.operation==='select'){
          const filteredByArchive=this.filters.some(filter=>filter.kind==='is'&&filter.key==='archived_at'&&filter.value===null);
          const data=this.matchingRows();
          const broadFetch=!this.filters.some(filter=>filter.key==='client_id'||filter.key==='id');
          if(broadFetch){
            fixture.fetches.push({
              at:Date.now(),
              sourceKind:filteredByArchive?'base-filtered':'archive-inclusive',
              archivedAtFilter:filteredByArchive?'IS NULL':'none',
              ids:data.map(row=>row.client_id||row.id),
              archiveReady:Boolean(window.BogatkaSyncFieldCompatV416?.archiveFetchReady),
              terminal:Boolean(window.cloudFetchRemote?.__terminalFetchAuthorityV416),
            });
          }
          if(mode==='single'||mode==='maybeSingle')return{data:data[0]||null,error:null};
          return{data,error:null};
        }
        if(this.operation==='delete')return{data:null,error:null};
        const payloads=Array.isArray(this.payload)?this.payload:[this.payload];
        const written=payloads.filter(Boolean).map((payload,index)=>({
          id:payload.id||`written-${payload.client_id||index}`,
          created_at:payload.created_at||new Date().toISOString(),
          updated_at:new Date().toISOString(),
          revision:Number(payload.revision||0)+1,
          ...clone(payload),
        }));
        fixture.writes.push({operation:this.operation,count:written.length});
        for(const row of written){
          const id=row.client_id||row.id;
          const existing=fixture.rows.findIndex(item=>(item.client_id||item.id)===id);
          if(existing>=0)fixture.rows[existing]=row;else fixture.rows.push(row);
        }
        if(mode==='single'||mode==='maybeSingle')return{data:written[0]||null,error:null};
        return{data:written,error:null};
      }
      return{data:null,error:null};
    }
  }

  const session={user:{id:'startup-user',email:'startup@example.test',user_metadata:{display_name:'Startup test'}}};
  const client={
    auth:{
      getSession:async()=>({data:{session},error:null}),
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
      signOut:async()=>({error:null}),
    },
    rpc:async name=>name==='claim_bogatka_project'?{data:'startup-project',error:null}:{data:null,error:null},
    from:table=>new Builder(table),
    storage:{from:()=>({download:async()=>({data:new Blob(),error:null}),remove:async()=>({data:null,error:null}),upload:async()=>({data:null,error:null})})},
    channel:()=>({on(){return this},subscribe(){return this}}),
    removeChannel:async()=>{},
  };
  window.supabase={createClient:()=>client};
}

test('signed-in pre-reveal sync waits for archive-inclusive fetch before its first remote snapshot',async({page})=>{
  test.setTimeout(90000);
  let releaseArchive;
  const archiveHold=new Promise(resolve=>{releaseArchive=resolve});

  await page.route('**/@supabase/supabase-js@2*',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.route('**/backup-v400.js*',async route=>{
    const response=await route.fetch();
    const source=await response.text();
    const delayed=source.replaceAll('loadSupportModules();',"window.__backupArchiveSupportDelayedV436=(window.__backupArchiveSupportDelayedV436||0)+1;");
    await route.fulfill({response,body:delayed});
  });
  await page.route('**/cloud-archive-v400.js*',async route=>{
    await archiveHold;
    await route.continue();
  });
  await page.addInitScript(installSignedInCloudFixture);
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));

  await page.goto(APP_URL,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Boolean(window.__startupArchiveFetchFixture));
  await page.waitForTimeout(6000);

  const beforeArchiveRelease=await page.evaluate(()=>({
    fetches:structuredClone(window.__startupArchiveFetchFixture.fetches),
    backupSupportDelayed:Number(window.__backupArchiveSupportDelayedV436||0),
    archiveScriptPresent:[...document.scripts].some(script=>script.src.includes('cloud-archive-v400.js')),
    fieldCompatReady:Boolean(window.BogatkaSyncFieldCompatV416?.ready),
    archiveStateReady:Boolean(window.BogatkaArchiveStateV436?.ready),
    archiveFetchReady:Boolean(window.BogatkaSyncFieldCompatV416?.archiveFetchReady),
    appRevealed:Boolean(window.BogatkaStartup?.isRevealed?.()),
    authority:window.BogatkaSyncFieldCompatV416?._test?.fetchAuthoritySnapshot?.()||null,
  }));

  releaseArchive();
  await page.evaluate(async()=>{
    if(window.__bogatkaCloudArchiveV400)return;
    const existing=[...document.scripts].find(script=>script.src.includes('cloud-archive-v400.js'));
    if(existing)return;
    const script=document.createElement('script');
    script.src=`./cloud-archive-v400.js?startup-retry=${Date.now()}`;
    script.async=false;
    await new Promise((resolve,reject)=>{
      script.onload=resolve;
      script.onerror=()=>reject(new Error('Startup archive fetch retry failed'));
      document.head.appendChild(script);
    });
  });
  await page.waitForFunction(()=>window.BogatkaCloud?.firstSyncCompleted===true,{timeout:30000});
  await page.waitForFunction(()=>window.BogatkaSyncFieldCompatV416?._test?.fetchAuthoritySnapshot?.().archiveSource===true,{timeout:10000});

  const result=await page.evaluate(({activeId,archivedId})=>{
    const fixture=window.__startupArchiveFetchFixture;
    const authority=window.BogatkaSyncFieldCompatV416?._test?.fetchAuthoritySnapshot?.()||null;
    const firstFetch=fixture.fetches[0]||null;
    return{
      startupSyncRequestedTime:fixture.startedAt,
      archiveSourceRegistrationTime:authority?.archiveSourceRegisteredAt||null,
      firstRemoteFetchTime:firstFetch?.at||null,
      firstFetchSourceKind:firstFetch?.sourceKind||null,
      firstFetchIds:firstFetch?.ids||[],
      activeRowsReceived:(firstFetch?.ids||[]).filter(id=>id===activeId),
      archivedRowsReceived:(firstFetch?.ids||[]).filter(id=>id===archivedId),
      baseFetchCallsBeforeReadiness:fixture.fetches.filter(fetch=>fetch.sourceKind==='base-filtered'&&!fetch.archiveReady).length,
      allFetches:structuredClone(fixture.fetches),
      terminalWrapperDepth:authority?.wrapperDepth??null,
      retryCount:authority?.archiveFetchScriptFailures??null,
      finalSynchronizationState:window.BogatkaCloud?.lastFirstSyncResult?.status||null,
      terminalStable:Boolean(window.cloudFetchRemote?.__terminalFetchAuthorityV416),
      authority,
    };
  },{activeId:ACTIVE_ID,archivedId:ARCHIVED_ID});

  const artifact={beforeArchiveRelease,...result};
  evidence('19-startup-archive-fetch-ready.json',artifact);

  expect(beforeArchiveRelease.backupSupportDelayed).toBeGreaterThanOrEqual(1);
  expect(beforeArchiveRelease.fetches).toEqual([]);
  expect(result.baseFetchCallsBeforeReadiness).toBe(0);
  expect(result.firstFetchSourceKind).toBe('archive-inclusive');
  expect(result.firstFetchIds).toEqual(expect.arrayContaining([ACTIVE_ID,ARCHIVED_ID]));
  expect(result.activeRowsReceived).toEqual([ACTIVE_ID]);
  expect(result.archivedRowsReceived).toEqual([ARCHIVED_ID]);
  expect(result.terminalStable).toBe(true);
  expect(result.terminalWrapperDepth).toBe(1);
  expect(result.finalSynchronizationState).toBe('synced');
});
