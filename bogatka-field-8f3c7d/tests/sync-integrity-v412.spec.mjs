import { test, expect } from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=412';

async function authorize(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
}

async function waitForV412(page){
  await page.waitForFunction(()=>window.BogatkaSyncMerge?.version==='4.1.2');
  await page.waitForFunction(()=>window.BogatkaSyncIntegrity?.ready===true);
  await page.waitForFunction(()=>window.BogatkaDecisionPanel?.ready===true);
  await page.waitForFunction(()=>window.BogatkaLocationDeletion?.ready===true);
}

async function openApp(page){
  await authorize(page);
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await waitForV412(page);
  await page.evaluate(()=>{window.confirm=()=>true;window.alert=()=>{};});
}

async function createCustom(page,{id,archived=false,cloudId=null,withPhoto=false}={}){
  return page.evaluate(async({id,archived,cloudId,withPhoto})=>{
    const clientId=id||`custom-test-${crypto.randomUUID()}`;
    const now=new Date().toISOString();
    const item={id:clientId,title:`Test ${clientId}`,address:'Гродно, тестовый адрес',note:'isolated fixture',custom:true,createdAt:now};
    if(cloudId)item.cloudId=cloudId;
    if(archived)item.archivedAt=now;
    locations.push(item);
    const data={createdAt:now,updatedAt:now};
    if(cloudId)data.cloudId=cloudId;
    if(archived)data.archivedAt=now;
    await idbPut(STORE,data,`location:${clientId}`);
    if(withPhoto){
      await idbPut(PHOTO_STORE,{id:`photo-${clientId}`,locationId:clientId,category:'other',storagePath:`fixture/${clientId}.jpg`,blob:new Blob(['fixture'],{type:'image/jpeg'}),createdAt:now});
    }
    await saveLocations();
    renderLocations();
    await window.BogatkaSuiteUI?.refresh?.();
    return {clientId,cloudId,now};
  },{id,archived,cloudId,withPhoto});
}

test('three-way merge preserves independent edits from different devices',async({page})=>{
  await authorize(page);
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await waitForV412(page);

  const result=await page.evaluate(()=>{
    const merge=window.BogatkaSyncMerge.merge;
    const base={traffic:{morning:'10'},check:{visible:false},contact:'Старый контакт',tasks:[{id:'a',title:'Базовая',status:'todo'}]};
    const local={traffic:{morning:'10'},check:{visible:true},contact:'Старый контакт',tasks:[{id:'a',title:'Базовая',status:'done'},{id:'local',title:'С телефона'}]};
    const remote={traffic:{morning:'25'},check:{visible:false},contact:'Анна',tasks:[{id:'a',title:'Изменённая на ПК',status:'todo'},{id:'remote',title:'С компьютера'}]};
    return merge(base,local,remote,{preferLocal:true});
  });

  expect(result.traffic.morning).toBe('25');
  expect(result.check.visible).toBe(true);
  expect(result.contact).toBe('Анна');
  expect(result.tasks.map(item=>item.id).sort()).toEqual(['a','local','remote']);
  expect(result.tasks.find(item=>item.id==='a')).toMatchObject({title:'Изменённая на ПК',status:'done'});
});

test('first sync unions surviving local fields with populated cloud fields',async({page})=>{
  await authorize(page);
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await waitForV412(page);

  const result=await page.evaluate(()=>{
    const merge=window.BogatkaSyncMerge.merge;
    return {
      union:merge(undefined,{check:{shortStop:true},status:'',date:''},{status:'Кандидат',date:'2026-06-26',traffic:{morning:'26'},check:{housing:true}},{preferLocal:false}),
      deletion:merge({contact:'Анна',notes:'старое'},{notes:'новое'},{contact:'Анна',notes:'старое'},{preferLocal:true,explicitReset:true}),
      conflict:merge({rent:'1000'},{rent:'1200'},{rent:'1100'},{preferLocal:true}),
    };
  });

  expect(result.union).toMatchObject({status:'Кандидат',date:'2026-06-26',traffic:{morning:'26'},check:{shortStop:true,housing:true}});
  expect(result.deletion).toEqual({notes:'новое'});
  expect(result.conflict.rent).toBe('1200');
});

test('decision radios are presented as one explanatory full-width panel',async({page})=>{
  await authorize(page);
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await waitForV412(page);

  const card=page.locator('[data-location-card]').first();
  const panel=card.locator('.decision-panel-v412');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.decision-copy-v412 strong')).toHaveText('Предварительное решение по локации');
  await expect(panel.locator('.decision-copy-v412 p')).toContainText('Решение можно изменить позже');
  await expect(panel.locator('.decision-actions-v412 label')).toHaveCount(3);

  const question=panel.locator('label[data-decision-value="Под вопросом"]');
  await question.click();
  await expect(question.locator('input')).toBeChecked();
  await expect(question).toHaveClass(/selected/);
  await expect(question).toContainText('нужны дополнительные данные');

  const geometry=await panel.evaluate(element=>({
    panelWidth:element.getBoundingClientRect().width,
    bodyWidth:element.closest('.location-body').getBoundingClientRect().width,
    actionHeight:element.querySelector('.decision-actions-v412 label').getBoundingClientRect().height,
  }));
  expect(geometry.panelWidth).toBeGreaterThanOrEqual(geometry.bodyWidth-34);
  expect(geometry.actionHeight).toBeGreaterThanOrEqual(40);
});

test('archive and restore preserve data and update archive visibility',async({page})=>{
  await openApp(page);
  const fixture=await createCustom(page,{});
  const before=await page.locator('[data-archive-count]').textContent().catch(()=>null);

  await page.evaluate(id=>window.BogatkaSuite.archiveLocation(id),fixture.clientId);
  await page.evaluate(()=>window.BogatkaSuiteUI.refresh());
  const archived=await page.evaluate(async id=>({
    meta:Boolean(locations.find(item=>item.id===id)?.archivedAt),
    data:Boolean((await getLocationData(id)).archivedAt),
  }),fixture.clientId);
  expect(archived).toEqual({meta:true,data:true});
  await expect(page.locator('#archiveManagerV400')).toBeVisible();
  const archivedCount=Number(await page.locator('[data-archive-count]').textContent());
  expect(archivedCount).toBe(Number(before||0)+1);

  await page.evaluate(id=>window.BogatkaSuite.restoreArchivedLocation(id),fixture.clientId);
  await page.evaluate(()=>window.BogatkaSuiteUI.refresh());
  const restored=await page.evaluate(async id=>({
    meta:Boolean(locations.find(item=>item.id===id)?.archivedAt),
    data:Boolean((await getLocationData(id)).archivedAt),
    exists:Boolean(await idbGet(STORE,`location:${id}`)),
  }),fixture.clientId);
  expect(restored).toEqual({meta:false,data:false,exists:true});
  expect(Number(await page.locator('[data-archive-count]').textContent().catch(()=>0))).toBe(Number(before||0));
});

test('permanent deletion writes tombstone first, removes only related photos and rejects delayed remote resurrection',async({page})=>{
  await openApp(page);
  const fixture=await createCustom(page,{archived:true,cloudId:'cloud-delete-1',withPhoto:true});
  const unrelated=await createCustom(page,{withPhoto:true});

  const result=await page.evaluate(async({deletedId,unrelatedId,archivedAt})=>{
    cloudMutateState(state=>{
      state.knownLocationIds=[...new Set([...(state.knownLocationIds||[]),deletedId])];
      state.knownPhotoIds=[...new Set([...(state.knownPhotoIds||[]),`photo-${deletedId}`])];
    });
    const removed=await window.BogatkaSuite.permanentlyDeleteArchived(deletedId);
    const queued=structuredClone(cloudReadState().deletedLocations?.[deletedId]||null);
    const staleRow={id:'cloud-delete-1',client_id:deletedId,title:'stale',address:'stale',note:'',revision:1,created_at:archivedAt,updated_at:archivedAt,archived_at:archivedAt,form_data:{archivedAt}};
    const stalePhoto={id:`photo-${deletedId}`,project_id:'fixture',location_id:'cloud-delete-1',category:'other',storage_path:`fixture/${deletedId}.jpg`,created_at:archivedAt,updated_at:archivedAt};
    const state=cloudReadState();
    await cloudApplyRemote([staleRow],[stalePhoto],null,state);
    return {
      removed,
      queued,
      localMeta:locations.some(item=>item.id===deletedId),
      localData:Boolean(await idbGet(STORE,`location:${deletedId}`)),
      relatedPhoto:Boolean(await idbGet(PHOTO_STORE,`photo-${deletedId}`)),
      unrelatedPhoto:Boolean(await idbGet(PHOTO_STORE,`photo-${unrelatedId}`)),
      dirtyIncludes:(cloudReadState().dirtyLocations||[]).includes(deletedId),
    };
  },{deletedId:fixture.clientId,unrelatedId:unrelated.clientId,archivedAt:fixture.now});

  expect(result.removed).toBe(true);
  expect(result.queued).toMatchObject({clientId:fixture.clientId,cloudId:'cloud-delete-1'});
  expect(result.queued.photoIds).toContain(`photo-${fixture.clientId}`);
  expect(result.localMeta).toBe(false);
  expect(result.localData).toBe(false);
  expect(result.relatedPhoto).toBe(false);
  expect(result.unrelatedPhoto).toBe(true);
  expect(result.dirtyIncludes).toBe(false);
});

test('successful cloud deletion clears tombstone while failure retains retry metadata',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async()=>{
    const successState={deletedLocations:{'custom-success':{clientId:'custom-success',cloudId:'cloud-success',deletedAt:new Date().toISOString(),photoIds:['photo-success'],storagePaths:['stored/success.jpg']}},deletedPhotos:{'photo-success':'stored/success.jpg'},dirtyLocations:[]};
    cloudWriteState(structuredClone(successState));
    let exists=true;
    const calls=[];
    const successAdapter={
      async findLocation(){calls.push('find');return{id:'cloud-success',client_id:'custom-success'}},
      async listPhotos(){calls.push('photos');return[{id:'photo-success',storage_path:'stored/success.jpg'}]},
      async removeStorage(paths){calls.push(`storage:${paths.join(',')}`)},
      async deleteLocation(){calls.push('delete');exists=false},
      async locationExists(){calls.push('verify');return exists},
    };
    await window.BogatkaLocationDeletion.processPendingDeletions(successState,successAdapter);
    const success={state:structuredClone(successState),stored:structuredClone(cloudReadState()),calls};

    const failureState={deletedLocations:{'custom-failure':{clientId:'custom-failure',cloudId:'cloud-failure',deletedAt:new Date().toISOString()}},deletedPhotos:{},dirtyLocations:[]};
    cloudWriteState(structuredClone(failureState));
    let error='';
    try{
      await window.BogatkaLocationDeletion.processPendingDeletions(failureState,{
        async findLocation(){return{id:'cloud-failure',client_id:'custom-failure'}},
        async listPhotos(){return[]},
        async removeStorage(){},
        async deleteLocation(){throw new Error('permission denied')},
        async locationExists(){return true},
      });
    }catch(caught){error=caught.message}
    return {success,failure:{state:failureState,stored:cloudReadState(),error}};
  });

  expect(result.success.calls).toEqual(['find','photos','storage:stored/success.jpg','delete','verify']);
  expect(result.success.state.deletedLocations).toEqual({});
  expect(result.success.state.deletedPhotos).toEqual({});
  expect(result.success.stored.deletedLocations).toEqual({});
  expect(result.failure.error).toContain('ожидает повторной синхронизации');
  expect(result.failure.state.deletedLocations['custom-failure']).toMatchObject({attempts:1,lastError:'permission denied'});
  expect(result.failure.stored.deletedLocations['custom-failure']).toMatchObject({attempts:1,lastError:'permission denied'});
});

test('offline tombstone survives reload and completes when remote is already absent',async({page})=>{
  await openApp(page);
  const fixture=await createCustom(page,{archived:true});
  await page.evaluate(id=>window.BogatkaSuite.permanentlyDeleteArchived(id),fixture.clientId);
  expect(await page.evaluate(id=>Boolean(cloudReadState().deletedLocations?.[id]),fixture.clientId)).toBe(true);

  await page.reload({waitUntil:'networkidle'});
  await waitForV412(page);
  const afterReload=await page.evaluate(async id=>({
    tombstone:Boolean(cloudReadState().deletedLocations?.[id]),
    meta:locations.some(item=>item.id===id),
    data:Boolean(await idbGet(STORE,`location:${id}`)),
  }),fixture.clientId);
  expect(afterReload).toEqual({tombstone:true,meta:false,data:false});

  const completed=await page.evaluate(async id=>{
    const state=cloudReadState();
    await window.BogatkaLocationDeletion.processPendingDeletions(state,{
      async findLocation(){return null},async listPhotos(){return[]},async removeStorage(){},async deleteLocation(){},async locationExists(){return false},
    });
    return Boolean(cloudReadState().deletedLocations?.[id]);
  },fixture.clientId);
  expect(completed).toBe(false);
});

test('remote deletion wins over dirty stale client and prevents a second-device upsert',async({page})=>{
  await openApp(page);
  const fixture=await createCustom(page,{cloudId:'cloud-device-b',withPhoto:true});
  const result=await page.evaluate(async id=>{
    locations=locations.filter(item=>item.id===id);
    await window.BogatkaSyncState.rawPut()(STORE,locations,'meta:locations');
    const state=cloudReadState();
    state.knownLocationIds=[...new Set([...(state.knownLocationIds||[]),id])];
    state.knownPhotoIds=[...new Set([...(state.knownPhotoIds||[]),`photo-${id}`])];
    state.dirtyLocations=[...new Set([...(state.dirtyLocations||[]),id])];
    await cloudApplyRemote([],[],null,state);
    const pushed=await cloudPushLocations([],state);
    return {
      meta:locations.some(item=>item.id===id),
      data:Boolean(await idbGet(STORE,`location:${id}`)),
      photo:Boolean(await idbGet(PHOTO_STORE,`photo-${id}`)),
      pushed,
    };
  },fixture.clientId);
  expect(result).toEqual({meta:false,data:false,photo:false,pushed:[]});
});

test('viewer cannot invoke archive APIs and predefined locations cannot be permanently deleted',async({page})=>{
  await openApp(page);
  const fixture=await createCustom(page,{});
  const result=await page.evaluate(async id=>{
    cloudRole='viewer';
    await window.BogatkaSuite.archiveLocation(id);
    document.querySelector('#editLocationId').value=id;
    await window.deleteCustomLocation();
    const viewerArchived=Boolean((await getLocationData(id)).archivedAt||locations.find(item=>item.id===id)?.archivedAt);

    cloudRole='editor';
    const predefined=locations.find(item=>!item.custom);
    const now=new Date().toISOString();
    const predefinedData=await getLocationData(predefined.id);
    predefinedData.archivedAt=now;
    predefined.archivedAt=now;
    await idbPut(STORE,predefinedData,`location:${predefined.id}`);
    const deleted=await window.BogatkaSuite.permanentlyDeleteArchived(predefined.id);
    return {viewerArchived,deleted,predefinedExists:locations.some(item=>item.id===predefined.id),predefinedData:Boolean(await idbGet(STORE,`location:${predefined.id}`))};
  },fixture.clientId);
  expect(result).toEqual({viewerArchived:false,deleted:false,predefinedExists:true,predefinedData:true});
});
