import { test, expect } from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=400';

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaCloudStability&&window.BogatkaUIStability&&window.BogatkaSuite));
  await page.waitForFunction(()=>{
    const authority=window.BogatkaPanelAuthorityV437;
    if(!authority)return true;
    const diagnostics=authority.diagnostics;
    return diagnostics.cloudBackgroundCompletions+diagnostics.cloudBackgroundErrors>0;
  },{timeout:20000});
}

async function openCollaborationPane(page,pane){
  await page.evaluate(targetPane=>{
    const card=document.querySelector('[data-location-card]');
    const details=card?.querySelector('.collaboration-v400');
    if(details)details.open=true;
    const button=card?.querySelector(`[data-collab-tab="${targetPane}"]`);
    if(button&&!button.classList.contains('active'))button.click();
  },pane);
}

async function settleDeferredRefresh(page){
  await page.waitForFunction(async()=>{
    const stability=window.BogatkaUIStability;
    if(!stability)return false;
    if(!stability.pending)return true;
    if(stability.hasActiveEditor?.())return false;
    await (stability.settleAfterBlur?.()||stability.flush?.());
    return !stability.pending;
  },{timeout:15000});
}

test('background sync cannot replace or overwrite an active form control',async({page})=>{
  await openApp(page);
  const locationId=await page.evaluate(async()=>{
    const item=locations[0];
    locations=[item];
    const remoteTime='2026-06-26T12:00:00.000Z';
    await cloudOriginalIdbPut(STORE,{contact:'LOCAL',updatedAt:'2026-06-26T11:00:00.000Z',cloudRevision:1,cloudUpdatedAt:'2026-06-26T11:00:00.000Z'},`location:${item.id}`);
    const remote={
      id:'00000000-0000-0000-0000-000000000101',project_id:'00000000-0000-0000-0000-000000000201',client_id:item.id,
      title:item.title,address:item.address,note:item.note,status:null,object_type:null,
      form_data:{contact:'REMOTE',updatedAt:remoteTime},sort_order:0,revision:2,
      created_at:'2026-06-01T00:00:00.000Z',updated_at:remoteTime,archived_at:null,
    };
    const remoteState={project_id:remote.project_id,data:{},updated_at:remoteTime};
    const delayed=()=>new Promise(resolve=>setTimeout(resolve,350));
    cloudSession={user:{id:'00000000-0000-0000-0000-000000000301',email:'test@example.com'}};
    cloudProjectId=remote.project_id;cloudRole='owner';cloudChannel={test:true};
    cloudClient={
      from(table){
        const builder={
          select(){return builder},eq(){return builder},is(){return builder},
          async order(){await delayed();return {data:table==='locations'?[structuredClone(remote)]:[],error:null}},
          async maybeSingle(){return {data:table==='project_state'?structuredClone(remoteState):null,error:null}},
          async upsert(){return {data:table==='locations'?[structuredClone(remote)]:structuredClone(remoteState),error:null}},
          async delete(){return {data:null,error:null}},
        };
        return builder;
      },
      storage:{from(){return {async remove(){return {error:null}},async upload(){return {error:null}},async download(){return {data:new Blob(),error:null}}}}},
      removeChannel:async()=>{},
    };
    cloudWriteState({dirtyLocations:[],dirtyPhotos:[],deletedPhotos:{},knownLocationIds:[item.id],knownPhotoIds:[],lastSyncAt:'2026-06-26T11:30:00.000Z',projectId:remote.project_id,userId:cloudSession.user.id});
    window.__syncStabilityLocationId=item.id;
    window.__syncStabilityPromise=cloudSyncAll({manual:false});
    return item.id;
  });

  await page.waitForTimeout(60);
  const selector=`[data-location="${locationId}"][data-field="contact"]`;
  await page.evaluate(selector=>{
    const input=document.querySelector(selector);
    window.__syncStabilityInput=input;
    input.focus();
    input.value='ПЕЧАТАЮ — НЕ СБРАСЫВАТЬ';
  },selector);

  const result=await page.evaluate(async selector=>{
    await window.__syncStabilityPromise;
    const input=document.querySelector(selector);
    const stored=await getLocationData(window.__syncStabilityLocationId);
    return {
      sameNode:input===window.__syncStabilityInput,
      active:document.activeElement===input,
      visibleValue:input.value,
      storedValue:stored.contact,
      suppressed:window.BogatkaCloudStability.suppressedUiRefreshes,
      cloudPrinciple:window.BogatkaCloudStability.principle,
      uiPrinciple:window.BogatkaUIStability.principle,
    };
  },selector);

  expect(result.sameNode).toBe(true);
  expect(result.active).toBe(true);
  expect(result.visibleValue).toBe('ПЕЧАТАЮ — НЕ СБРАСЫВАТЬ');
  expect(result.storedValue).toBe('REMOTE');
  expect(result.suppressed).toBeGreaterThan(0);
  expect(result.cloudPrinciple).toBe('event-driven-sync-with-no-idle-network-loop');
  expect(result.uiPrinciple).toBe('never-reorder-or-rebuild-cards-while-editing');
});

test('automatic sync waits while a field or native picker is active',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async()=>{
    cloudSession={user:{id:'test-user'}};
    const input=document.querySelector('[data-location][data-field="time"]');
    input.focus();
    input.dispatchEvent(new Event('focusin',{bubbles:true}));
    const interacting=window.BogatkaCloudStability.isInteracting();
    let calls=0;
    const original=cloudSyncAll;
    cloudSyncAll=async()=>{calls++};
    cloudScheduleSync(20);
    await new Promise(resolve=>setTimeout(resolve,700));
    const callsWhileProtected=calls;
    const stillProtected=window.BogatkaCloudStability.isInteracting();
    cloudSyncAll=original;
    return {interacting,callsWhileProtected,stillProtected};
  });
  expect(result.interacting).toBe(true);
  expect(result.callsWhileProtected).toBe(0);
  expect(result.stillProtected).toBe(true);
});

test('textarea accepts a complete word without losing focus after each autosave',async({page})=>{
  await openApp(page);
  await openCollaborationPane(page,'comments');
  const result=await page.evaluate(async()=>{
    const input=document.querySelector('[data-location][data-field="pros"]');
    const id=input.dataset.location;
    input.value='';
    input.focus();
    input.setSelectionRange(0,0);
    window.__prosNode=input;
    for(const char of 'Стоимость'){
      input.value+=char;
      input.setSelectionRange(input.value.length,input.value.length);
      input.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,380));
    }
    const during={
      id,
      sameNode:document.querySelector(`[data-location="${id}"][data-field="pros"]`)===window.__prosNode,
      active:document.activeElement===input,
      value:input.value,
      selectionStart:input.selectionStart,
      selectionEnd:input.selectionEnd,
      pending:window.BogatkaUIStability.pending,
    };
    input.blur();
    return during;
  });
  await settleDeferredRefresh(page);
  const stored=await page.evaluate(async id=>(await getLocationData(id)).pros,result.id);
  expect(result.sameNode).toBe(true);
  expect(result.active).toBe(true);
  expect(result.value).toBe('Стоимость');
  expect(result.selectionStart).toBe('Стоимость'.length);
  expect(result.selectionEnd).toBe('Стоимость'.length);
  expect(result.pending).toBe(true);
  expect(stored).toBe('Стоимость');
});

test('idle background sync updates visible fields without page reload',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async()=>{
    const item=locations[0];
    locations=[item];
    const input=document.querySelector(`[data-location="${item.id}"][data-field="contact"]`);
    input.value='LOCAL';
    const originalNode=input;
    const remoteTime='2026-06-26T13:00:00.000Z';
    await cloudOriginalIdbPut(STORE,{contact:'LOCAL',updatedAt:'2026-06-26T12:00:00.000Z',cloudRevision:1,cloudUpdatedAt:'2026-06-26T12:00:00.000Z'},`location:${item.id}`);
    const remote={
      id:'00000000-0000-0000-0000-000000000111',project_id:'00000000-0000-0000-0000-000000000211',client_id:item.id,
      title:item.title,address:item.address,note:item.note,status:'Кандидат',object_type:null,
      form_data:{contact:'НОВОЕ С ТЕЛЕФОНА',status:'Кандидат',updatedAt:remoteTime},sort_order:0,revision:2,
      created_at:'2026-06-01T00:00:00.000Z',updated_at:remoteTime,archived_at:null,
    };
    const remoteState={project_id:remote.project_id,data:{},updated_at:remoteTime};
    cloudSession={user:{id:'00000000-0000-0000-0000-000000000311',email:'test@example.com'}};
    cloudProjectId=remote.project_id;cloudRole='owner';cloudChannel={test:true};
    cloudClient={
      from(table){
        const builder={
          select(){return builder},eq(){return builder},is(){return builder},
          async order(){return {data:table==='locations'?[structuredClone(remote)]:[],error:null}},
          async maybeSingle(){return {data:table==='project_state'?structuredClone(remoteState):null,error:null}},
          async upsert(){return {data:table==='locations'?[structuredClone(remote)]:structuredClone(remoteState),error:null}},
          async delete(){return {data:null,error:null}},
        };
        return builder;
      },
      storage:{from(){return {async remove(){return {error:null}},async upload(){return {error:null}},async download(){return {data:new Blob(),error:null}}}}},
      removeChannel:async()=>{},
    };
    cloudWriteState({dirtyLocations:[],dirtyPhotos:[],deletedPhotos:{},knownLocationIds:[item.id],knownPhotoIds:[],lastSyncAt:'2026-06-26T12:30:00.000Z',projectId:remote.project_id,userId:cloudSession.user.id});
    await cloudSyncAll({manual:false});
    await window.BogatkaUIStability.flush();
    const after=document.querySelector(`[data-location="${item.id}"][data-field="contact"]`);
    const stored=await getLocationData(item.id);
    return {sameNode:after===originalNode,value:after.value,stored:stored.contact};
  });
  expect(result.sameNode).toBe(true);
  expect(result.value).toBe('НОВОЕ С ТЕЛЕФОНА');
  expect(result.stored).toBe('НОВОЕ С ТЕЛЕФОНА');
});

test('clean idle state does not start network sync or flash the status',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async()=>{
    const card=document.querySelector('[data-location-card]');
    const badge=card?.querySelector('[data-card-recommendation-v448]');
    window.__cleanIdleCard=card;
    window.__cleanIdleBadge=badge;
    cloudSession={user:{id:'idle-user'}};
    window.BogatkaCloudStability.markStartupHandled();
    cloudWriteState({dirtyLocations:[],dirtyPhotos:[],deletedPhotos:{},knownLocationIds:[],knownPhotoIds:[],lastSyncAt:new Date().toISOString(),userId:'idle-user'});
    cloudSetStatus('ready');
    const before=window.BogatkaCloudStability.diagnostics;
    const first=await cloudSyncAll({manual:false});
    const second=await cloudSyncAll({manual:false});
    cloudScheduleSync(20);
    await new Promise(resolve=>setTimeout(resolve,1600));
    const after=window.BogatkaCloudStability.diagnostics;
    const currentCard=document.querySelector('[data-location-card]');
    const currentBadge=currentCard?.querySelector('[data-card-recommendation-v448]');
    return {
      first,second,before,after,
      button:document.querySelector('#cloudSyncBtn')?.textContent||'',
      pill:document.querySelector('#cloudTopPill')?.textContent||'',
      sameCard:currentCard===window.__cleanIdleCard,
      sameBadge:currentBadge===window.__cleanIdleBadge,
      badgeText:currentBadge?.textContent||'',
      badgeHidden:Boolean(currentBadge?.hidden),
    };
  });
  expect(result.first.skipped).toBe(true);
  expect(result.second.skipped).toBe(true);
  expect(result.after.executedAutomaticRuns).toBe(result.before.executedAutomaticRuns);
  expect(result.after.skippedIdleRuns).toBeGreaterThanOrEqual(result.before.skippedIdleRuns+2);
  expect(result.button).toContain('синхронизировано');
  expect(result.pill).toContain('синхронизировано');
  expect(result.sameCard).toBe(true);
  expect(result.sameBadge).toBe(true);
  expect(result.badgeText.trim()).not.toBe('');
  expect(result.badgeHidden).toBe(false);
});

test('a clean location is not pushed again only because its local timestamp is newer',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async()=>{
    const item=locations[0];
    locations=[item];
    const remote={id:'remote-1',project_id:'project-1',client_id:item.id,title:item.title,address:item.address,note:item.note,updated_at:'2026-01-01T00:00:00.000Z',revision:1,archived_at:null};
    await cloudOriginalIdbPut(STORE,{contact:'UNCHANGED',updatedAt:'2099-01-01T00:00:00.000Z',cloudId:remote.id,cloudRevision:1,cloudUpdatedAt:remote.updated_at},`location:${item.id}`);
    cloudSession={user:{id:'user-1'}};
    cloudProjectId='project-1';
    let databaseCalls=0;
    cloudClient={from(){databaseCalls++;throw new Error('Unexpected upsert for a clean location')}};
    const rows=await cloudPushLocations([remote],{dirtyLocations:[],dirtyPhotos:[],deletedPhotos:{},metaDirty:false,stateDirty:false});
    return {databaseCalls,rowCount:rows.length};
  });
  expect(result.databaseCalls).toBe(0);
  expect(result.rowCount).toBe(1);
});

test('multiple realtime notifications are coalesced into one background request',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async()=>{
    cloudSession={user:{id:'realtime-user'}};
    window.BogatkaCloudStability.markStartupHandled();
    cloudWriteState({dirtyLocations:[],dirtyPhotos:[],deletedPhotos:{},knownLocationIds:[],knownPhotoIds:[],lastSyncAt:new Date().toISOString(),userId:'realtime-user'});
    const card=document.querySelector('[data-location-card]');
    const badge=card?.querySelector('[data-card-recommendation-v448]');
    let calls=0;
    const original=cloudSyncAll;
    cloudSyncAll=async()=>{calls++};
    for(let index=0;index<8;index++)cloudHandleRealtime({});
    await new Promise(resolve=>setTimeout(resolve,1300));
    cloudSyncAll=original;
    const currentCard=document.querySelector('[data-location-card]');
    const currentBadge=currentCard?.querySelector('[data-card-recommendation-v448]');
    return {
      calls,
      diagnostics:window.BogatkaCloudStability.diagnostics,
      sameCard:currentCard===card,
      sameBadge:currentBadge===badge,
      badgeText:currentBadge?.textContent||'',
      badgeHidden:Boolean(currentBadge?.hidden),
    };
  });
  expect(result.calls).toBe(1);
  expect(result.diagnostics.realtimeSignals).toBeGreaterThanOrEqual(8);
  expect(result.sameCard).toBe(true);
  expect(result.sameBadge).toBe(true);
  expect(result.badgeText.trim()).not.toBe('');
  expect(result.badgeHidden).toBe(false);
});
