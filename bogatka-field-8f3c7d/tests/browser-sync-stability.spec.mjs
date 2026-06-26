import { test, expect } from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=400';

test('background sync cannot replace or overwrite an active form control',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaCloudStability&&window.BogatkaSuite));

  const locationId=await page.evaluate(async()=>{
    const item=locations[0];
    locations=[item];
    const remoteTime='2026-06-26T12:00:00.000Z';
    await cloudOriginalIdbPut(STORE,{contact:'LOCAL',updatedAt:'2026-06-26T11:00:00.000Z',cloudRevision:1,cloudUpdatedAt:'2026-06-26T11:00:00.000Z'},`location:${item.id}`);
    const remote={
      id:'00000000-0000-0000-0000-000000000101',
      project_id:'00000000-0000-0000-0000-000000000201',
      client_id:item.id,
      title:item.title,
      address:item.address,
      note:item.note,
      status:null,
      object_type:null,
      form_data:{contact:'REMOTE',updatedAt:remoteTime},
      sort_order:0,
      revision:2,
      created_at:'2026-06-01T00:00:00.000Z',
      updated_at:remoteTime,
      archived_at:null,
    };
    const remoteState={project_id:remote.project_id,data:{},updated_at:remoteTime};
    const delayed=()=>new Promise(resolve=>setTimeout(resolve,350));
    cloudSession={user:{id:'00000000-0000-0000-0000-000000000301',email:'test@example.com'}};
    cloudProjectId=remote.project_id;
    cloudRole='owner';
    cloudChannel={test:true};
    cloudClient={
      from(table){
        const builder={
          select(){return builder},
          eq(){return builder},
          is(){return builder},
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
      principle:window.BogatkaCloudStability.principle,
    };
  },selector);

  expect(result.sameNode).toBe(true);
  expect(result.active).toBe(true);
  expect(result.visibleValue).toBe('ПЕЧАТАЮ — НЕ СБРАСЫВАТЬ');
  expect(result.storedValue).toBe('REMOTE');
  expect(result.suppressed).toBeGreaterThan(0);
  expect(result.principle).toBe('background-sync-never-rebuilds-active-form');
});

test('automatic sync waits while a field or native picker is active',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaCloudStability));
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
    const callsWhileFocused=calls;
    cloudSyncAll=original;
    return {interacting,callsWhileFocused,active:document.activeElement===input};
  });
  expect(result.interacting).toBe(true);
  expect(result.callsWhileFocused).toBe(0);
  expect(result.active).toBe(true);
});
