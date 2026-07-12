(function(){
  if(window.__bogatkaCloudArchiveV400)return;
  window.__bogatkaCloudArchiveV400=true;
  if(typeof cloudFetchRemote!=='function'||typeof cloudPushLocations!=='function'||typeof cloudApplyRemote!=='function')return;

  const baseApplyRemote=cloudApplyRemote;
  const v436Ready=()=>Boolean(window.BogatkaArchiveStateV436?.ready);
  const announce=delegated=>{
    window.BogatkaCloudArchive={enabled:true,delegatedToV436:Boolean(delegated),lateLoadProtected:true};
    window.dispatchEvent(new CustomEvent('bogatka:cloud-archive-loaded',{detail:{delegatedToV436:Boolean(delegated)}}));
  };

  cloudFetchRemote=async function cloudFetchRemoteWithArchive(){
    const [locationsResult,photosResult,stateResult]=await Promise.all([
      cloudClient.from('locations').select('*').eq('project_id',cloudProjectId).order('sort_order'),
      cloudClient.from('photos').select('*').eq('project_id',cloudProjectId).is('deleted_at',null).order('sort_order'),
      cloudClient.from('project_state').select('*').eq('project_id',cloudProjectId).maybeSingle(),
    ]);
    if(locationsResult.error)throw new Error(locationsResult.error.message);
    if(photosResult.error)throw new Error(photosResult.error.message);
    if(stateResult.error)throw new Error(stateResult.error.message);
    return {remoteLocations:locationsResult.data||[],remotePhotos:photosResult.data||[],remoteState:stateResult.data||null};
  };
  cloudFetchRemote.__cloudArchiveV400=true;
  window.cloudFetchRemote=cloudFetchRemote;

  if(v436Ready()){
    window.BogatkaArchiveStateV436?._test?.ensureRuntimeWrappers?.({force:true});
    announce(true);
    return;
  }

  cloudApplyRemote=async function cloudApplyRemoteWithArchive(remoteLocations,remotePhotos,remoteState,syncState){
    for(const remote of remoteLocations){
      remote.form_data={...(remote.form_data||{})};
      if(remote.archived_at)remote.form_data.archivedAt=remote.archived_at;
      else delete remote.form_data.archivedAt;
    }
    await baseApplyRemote(remoteLocations,remotePhotos,remoteState,syncState);
    let metaChanged=false;
    for(const remote of remoteLocations){
      const id=remote.client_id||remote.id;
      const item=locations.find(entry=>entry.id===id);
      if(!item)continue;
      if(remote.archived_at&&item.archivedAt!==remote.archived_at){item.archivedAt=remote.archived_at;metaChanged=true;}
      if(!remote.archived_at&&item.archivedAt){delete item.archivedAt;metaChanged=true;}
    }
    if(metaChanged){
      const put=typeof cloudOriginalIdbPut!=='undefined'&&cloudOriginalIdbPut?cloudOriginalIdbPut:idbPut;
      await put(STORE,locations,'meta:locations');
      renderLocations();
    }
  };
  cloudApplyRemote.__cloudArchiveV400=true;

  cloudPushLocations=async function cloudPushLocationsWithArchive(remoteLocations,syncState){
    const remoteByClient=new Map(remoteLocations.map(item=>[item.client_id||item.id,item]));
    const dirty=new Set(syncState.dirtyLocations||[]);
    const pushRows=[];

    for(let index=0;index<locations.length;index++){
      const item=locations[index];
      const data=await getLocationData(item.id);
      const remote=remoteByClient.get(item.id);
      const localNewer=cloudDate(data.updatedAt||item.updatedAt||item.createdAt)>cloudDate(remote?.updated_at);
      const shouldPush=!remote||dirty.has(item.id)||syncState.metaDirty||localNewer;
      if(!shouldPush)continue;
      pushRows.push({
        project_id:cloudProjectId,
        client_id:item.id,
        title:item.title||item.address||'Без названия',
        address:item.address||null,
        note:item.note||null,
        status:data.status||null,
        object_type:data.objectType||null,
        form_data:cloudCleanFormData(data),
        sort_order:index,
        archived_at:data.archivedAt||item.archivedAt||null,
        updated_by:cloudSession.user.id,
      });
    }

    let rows=remoteLocations;
    if(pushRows.length){
      const {data,error}=await cloudClient.from('locations').upsert(pushRows,{onConflict:'project_id,client_id'}).select('*');
      if(error)throw new Error(error.message);
      const updated=new Map(remoteLocations.map(item=>[item.client_id||item.id,item]));
      for(const row of data||[])updated.set(row.client_id||row.id,row);
      rows=[...updated.values()];

      cloudApplyingRemote=true;
      try{
        for(const row of data||[]){
          const clientId=row.client_id||row.id;
          const localData=await getLocationData(clientId);
          await cloudOriginalIdbPut(STORE,{...localData,cloudId:row.id,cloudRevision:row.revision,cloudUpdatedAt:row.updated_at},`location:${clientId}`);
          const meta=locations.find(item=>item.id===clientId);
          if(meta){
            meta.cloudId=row.id;
            if(row.archived_at)meta.archivedAt=row.archived_at;
            else delete meta.archivedAt;
          }
        }
        await cloudOriginalIdbPut(STORE,locations,'meta:locations');
      }finally{cloudApplyingRemote=false;}
    }
    return rows;
  };
  cloudPushLocations.__cloudArchiveV400=true;

  window.cloudApplyRemote=cloudApplyRemote;
  window.cloudPushLocations=cloudPushLocations;
  announce(false);
})();
