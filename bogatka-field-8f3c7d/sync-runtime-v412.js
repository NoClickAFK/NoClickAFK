(function(){
  if(window.BogatkaSyncIntegrity?.ready)return;
  if(!window.BogatkaSyncMerge?.merge||!window.BogatkaSyncState?.ready||typeof cloudApplyRemote!=='function')return;
  const Merge=window.BogatkaSyncMerge,State=window.BogatkaSyncState;
  const baseApplyRemote=cloudApplyRemote;
  const contexts=new Map();
  let revisionRetries=0,noOpCloudWrites=0,mergedRows=0;

  function pendingReset(id){
    try{
      const pending=JSON.parse(localStorage.getItem('bogatka_pending_cloud_clear_v34')||'null');
      return Boolean(pending?.all||(pending?.locations||[]).includes(id));
    }catch(_){return false}
  }
  const deletionMap=state=>state?.deletedLocations&&typeof state.deletedLocations==='object'?state.deletedLocations:{};
  const pendingIds=state=>new Set(Object.keys(deletionMap(state)));
  const isPending=id=>pendingIds(typeof cloudReadState==='function'?cloudReadState():{}).has(id);
  function filterDeletedRemote(remoteLocations,remotePhotos,syncState){
    const pending=pendingIds(syncState),blockedCloudIds=new Set();
    for(const tombstone of Object.values(deletionMap(syncState)))if(tombstone?.cloudId)blockedCloudIds.add(tombstone.cloudId);
    const locationsSafe=[];
    for(const row of remoteLocations||[]){
      const id=row.client_id||row.id;
      if(pending.has(id)||blockedCloudIds.has(row.id)){blockedCloudIds.add(row.id);continue}
      locationsSafe.push(row);
    }
    return {
      remoteLocations:locationsSafe,
      remotePhotos:(remotePhotos||[]).filter(photo=>!blockedCloudIds.has(photo.location_id)),
      pending,
    };
  }
  const remoteData=row=>{
    const data=Merge.clean(row?.form_data||{});
    if(row?.archived_at)data.archivedAt=row.archived_at;
    return data;
  };
  const rowMeta=row=>({title:row?.title||'',address:row?.address||'',note:row?.note||'',sortOrder:Number(row?.sort_order||0),archivedAt:row?.archived_at||null});
  const localMeta=(item,index)=>({title:item?.title||item?.address||'',address:item?.address||'',note:item?.note||'',sortOrder:index,archivedAt:item?.archivedAt||null});
  function payload(item,index,data,meta){
    return {
      project_id:cloudProjectId,client_id:item.id,title:meta.title||meta.address||'Без названия',address:meta.address||null,note:meta.note||null,
      status:data.status||null,object_type:data.objectType||null,form_data:Merge.clean(data),sort_order:Number(meta.sortOrder||0),
      archived_at:data.archivedAt||meta.archivedAt||null,updated_by:cloudSession.user.id,
    };
  }
  function comparable(value){
    if(!value)return null;
    return {
      project_id:value.project_id,client_id:value.client_id||value.id,title:value.title||'',address:value.address||null,note:value.note||null,
      status:value.status||null,object_type:value.object_type||null,form_data:Merge.clean(value.form_data||{}),
      sort_order:Number(value.sort_order||0),archived_at:value.archived_at||null,
    };
  }
  async function saveBase(id,row){
    if(!row||isPending(id))return;
    await State.writeBase(id,{revision:Number(row.revision||0),updatedAt:row.updated_at||'',formData:remoteData(row),meta:rowMeta(row)});
  }
  async function saveLocal(id,data,row){
    if(isPending(id))return;
    const value={...Merge.clean(data)};
    if(row){value.cloudId=row.id;value.cloudRevision=row.revision;value.cloudUpdatedAt=row.updated_at;}
    await State.rawPut()(STORE,value,`location:${id}`);
  }
  async function removeLocalLocation(id){
    const photos=(await idbAll(PHOTO_STORE)).filter(photo=>photo.locationId===id);
    for(const photo of photos)await State.rawDelete()(PHOTO_STORE,photo.id);
    await State.rawDelete()(STORE,`location:${id}`);
    await State.deleteBase(id);
    locations=locations.filter(item=>item.id!==id);
  }
  function chooseMeta(base,item,row,index,preferLocal){
    return Merge.merge(base?.meta,localMeta(item,index),row?rowMeta(row):undefined,{preferLocal,explicitReset:false});
  }
  async function buildContext(item,index,row,syncState){
    const local=Merge.clean(await getLocationData(item.id));
    const base=await State.readBase(item.id)||null;
    const dirty=(syncState.dirtyLocations||[]).includes(item.id);
    const options={preferLocal:dirty,explicitReset:pendingReset(item.id)};
    const merged=Merge.merge(base?.formData,local,row?remoteData(row):undefined,options);
    const meta=chooseMeta(base,item,row,index,Boolean(syncState.metaDirty)||dirty);
    const nextPayload=payload(item,index,merged,meta);
    return {id:item.id,item,index,row,base,merged,meta,payload:nextPayload,dirty,needsPush:!row||!Merge.same(comparable(nextPayload),comparable(row))};
  }
  async function fetchRow(clientId){
    if(isPending(clientId))return null;
    const result=await cloudClient.from('locations').select('*').eq('project_id',cloudProjectId).eq('client_id',clientId).maybeSingle();
    if(result.error)throw new Error(result.error.message);
    return result.data||null;
  }
  async function conditionalUpdate(row,nextPayload){
    const builder=cloudClient.from('locations').update(nextPayload).eq('id',row.id).eq('revision',row.revision).select('*');
    const result=typeof builder.maybeSingle==='function'?await builder.maybeSingle():await builder;
    if(result.error)throw new Error(result.error.message);
    return Array.isArray(result.data)?result.data[0]||null:result.data||null;
  }
  async function upsert(nextPayload){
    const builder=cloudClient.from('locations').upsert(nextPayload,{onConflict:'project_id,client_id'}).select('*');
    const result=typeof builder.maybeSingle==='function'?await builder.maybeSingle():await builder;
    if(result.error)throw new Error(result.error.message);
    return Array.isArray(result.data)?result.data[0]||null:result.data||null;
  }
  async function persist(initial,syncState){
    let context=initial;
    for(let attempt=0;attempt<4;attempt++){
      if(isPending(context.id))return null;
      if(!context.needsPush){
        noOpCloudWrites++;
        await saveLocal(context.id,context.merged,context.row);
        await saveBase(context.id,context.row);
        return isPending(context.id)?null:context.row;
      }
      let row=context.row?await conditionalUpdate(context.row,context.payload):await upsert(context.payload);
      if(isPending(context.id))return null;
      if(!row)row=await fetchRow(context.id);
      if(row&&Merge.same(comparable(context.payload),comparable(row))){
        await saveLocal(context.id,remoteData(row),row);
        await saveBase(context.id,row);
        return isPending(context.id)?null:row;
      }
      revisionRetries++;
      context=await buildContext(context.item,context.index,row||await fetchRow(context.id),syncState);
    }
    throw new Error(`Конфликт синхронизации локации «${context.item.title||context.id}». Повторите синхронизацию.`);
  }

  cloudApplyRemote=async function integrityApplyRemote(remoteLocations,remotePhotos,remoteState,syncState){
    contexts.clear();
    const filtered=filterDeletedRemote(remoteLocations,remotePhotos,syncState);
    remoteLocations=filtered.remoteLocations;
    remotePhotos=filtered.remotePhotos;
    const remoteById=new Map(remoteLocations.map(row=>[row.client_id||row.id,row]));
    let metaChanged=false;

    for(const item of [...locations]){
      if(filtered.pending.has(item.id)){
        await removeLocalLocation(item.id);
        metaChanged=true;
        continue;
      }
      const row=remoteById.get(item.id)||null;
      if(!row&&item.cloudId){
        await removeLocalLocation(item.id);
        metaChanged=true;
        continue;
      }
      const index=locations.indexOf(item);
      const context=await buildContext(item,index,row,syncState);
      contexts.set(item.id,context);
      await saveLocal(item.id,context.merged,row);
      if(row){
        item.cloudId=row.id;item.title=context.meta.title||item.title;item.address=context.meta.address||'';item.note=context.meta.note||'';
        if(context.meta.archivedAt)item.archivedAt=context.meta.archivedAt;else delete item.archivedAt;
      }
      if(context.needsPush)mergedRows++;
    }
    for(const row of remoteLocations){
      const id=row.client_id||row.id;
      if(contexts.has(id)||filtered.pending.has(id))continue;
      const item={id,title:row.title,address:row.address||'',note:row.note||'',custom:!DEFAULT_LOCATIONS.some(entry=>entry.id===id),cloudId:row.id,createdAt:row.created_at,updatedAt:row.updated_at};
      if(row.archived_at)item.archivedAt=row.archived_at;
      locations.push(item);
      const context=await buildContext(item,locations.length-1,row,syncState);
      contexts.set(id,context);
      await saveLocal(id,context.merged,row);
      metaChanged=true;
    }
    if(metaChanged||remoteLocations.length)await State.rawPut()(STORE,locations,'meta:locations');
    const safeState={
      ...syncState,
      dirtyLocations:[...new Set([...contexts.keys(),...remoteLocations.map(row=>row.client_id||row.id)])].filter(id=>!filtered.pending.has(id)),
      knownLocationIds:[],
    };
    await baseApplyRemote(remoteLocations,remotePhotos,remoteState,safeState);
    for(const context of contexts.values())if(!context.needsPush&&context.row&&!isPending(context.id))await saveBase(context.id,context.row);
  };

  cloudPushLocations=async function integrityPushLocations(remoteLocations,syncState){
    const livePending=pendingIds(typeof cloudReadState==='function'?cloudReadState():syncState);
    const finalRows=new Map(remoteLocations.filter(row=>!livePending.has(row.client_id||row.id)).map(row=>[row.client_id||row.id,row]));
    for(let index=0;index<locations.length;index++){
      const item=locations[index];
      if(livePending.has(item.id)||isPending(item.id)){finalRows.delete(item.id);continue}
      let context=contexts.get(item.id)||await buildContext(item,index,finalRows.get(item.id)||null,syncState);
      if(context.index!==index)context=await buildContext(item,index,finalRows.get(item.id)||context.row||null,{...syncState,metaDirty:true});
      const row=await persist(context,syncState);
      if(row)finalRows.set(item.id,row);else finalRows.delete(item.id);
    }
    await State.rawPut()(STORE,locations.filter(item=>!isPending(item.id)),'meta:locations');
    return [...finalRows.values()].filter(row=>!isPending(row.client_id||row.id));
  };

  window.cloudApplyRemote=cloudApplyRemote;
  window.cloudPushLocations=cloudPushLocations;
  window.BogatkaSyncIntegrity={
    version:'4.1.2',ready:true,
    filterDeletedRemote,
    get diagnostics(){return {revisionRetries,noOpCloudWrites,mergedRows,localNoOpPuts:State.noOpPuts,contexts:contexts.size,stateKey:State.key()};},
    principle:'three-way-field-merge-with-revision-checked-location-writes-and-deletion-tombstones',
  };
})();
