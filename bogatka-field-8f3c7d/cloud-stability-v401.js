(function(){
  if(window.__bogatkaCloudStabilityV401)return;
  window.__bogatkaCloudStabilityV401=true;
  if(typeof cloudApplyRemote!=='function'||typeof cloudSyncAll!=='function'||typeof cloudScheduleSync!=='function')return;

  const baseApplyRemote=cloudApplyRemote;
  const baseSyncAll=cloudSyncAll;
  const baseSetStatus=cloudSetStatus;
  const baseSetMessage=cloudSetMessage;
  const baseMarkLocationDirty=cloudMarkLocationDirty;
  const baseMarkPhotoDirty=cloudMarkPhotoDirty;
  const baseMarkGlobalDirty=cloudMarkGlobalDirty;
  const baseMarkMetaDirty=cloudMarkMetaDirty;
  const baseIdbDelete=idbDelete;

  let lastInteractionAt=0;
  let pickerUntil=0;
  let deferredSyncTimer=null;
  let automaticRun=false;
  let manualVisual=false;
  let startupPullPending=true;
  let remoteSignalSeq=0;
  let handledRemoteSeq=0;
  let mutationSeq=0;
  const locationMutations=new Map();
  const photoMutations=new Map();
  const deletedPhotoMutations=new Map();
  let globalMutationSeq=0;
  let metaMutationSeq=0;
  let suppressedUiRefreshes=0;
  let executedAutomaticRuns=0;
  let skippedIdleRuns=0;
  let realtimeSignals=0;

  const editorSelector='#app input:not([type="button"]):not([type="submit"]):not([type="file"]),#app textarea,#app select,#app [contenteditable="true"]';
  const pickerSelector='input[type="date"],input[type="time"],input[type="datetime-local"],input[type="month"],input[type="week"],select';

  function interactionTarget(event){
    const target=event.target;
    return target instanceof Element?target.closest('input,textarea,select,[contenteditable="true"]'):null;
  }

  function markInteraction(event){
    lastInteractionAt=Date.now();
    const target=interactionTarget(event);
    if(target?.matches(pickerSelector))pickerUntil=Date.now()+60000;
  }

  for(const name of ['pointerdown','touchstart','keydown','input','focusin'])document.addEventListener(name,markInteraction,true);
  document.addEventListener('change',event=>{
    lastInteractionAt=Date.now();
    const target=interactionTarget(event);
    if(target?.matches(pickerSelector))pickerUntil=Date.now()+1200;
  },true);
  document.addEventListener('focusout',()=>{lastInteractionAt=Date.now()},true);
  window.addEventListener('focus',()=>{if(pickerUntil>Date.now())pickerUntil=Date.now()+1200});

  function isInteracting(){
    if(document.hidden)return false;
    const active=document.activeElement;
    if(active?.matches?.(editorSelector))return true;
    if(Date.now()<pickerUntil)return true;
    return Date.now()-lastInteractionAt<2200;
  }

  function hasPendingLocalChanges(){
    const state=cloudReadState();
    return Boolean(
      state.stateDirty||state.metaDirty||state.localResetAt||
      (state.dirtyLocations||[]).length||
      (state.dirtyPhotos||[]).length||
      Object.keys(state.deletedPhotos||{}).length
    );
  }

  function hasAutomaticWork(){
    return startupPullPending||remoteSignalSeq>handledRemoteSeq||hasPendingLocalChanges();
  }

  function queueAutomaticSync(delay=1800){
    clearTimeout(deferredSyncTimer);
    clearTimeout(cloudSyncTimer);
    if(!hasAutomaticWork())return;
    deferredSyncTimer=setTimeout(async()=>{
      if(!cloudSession||cloudApplyingRemote)return;
      if(!hasAutomaticWork())return;
      if(cloudSyncing||isInteracting()||window.BogatkaUIStability?.isEditing?.()){
        queueAutomaticSync(1200);
        return;
      }
      try{await cloudSyncAll({manual:false})}catch(error){cloudHandleError(error)}
    },Math.max(250,delay));
    cloudSyncTimer=deferredSyncTimer;
  }

  cloudScheduleSync=function stableCloudScheduleSync(delay=1800){
    if(!cloudSession||cloudApplyingRemote)return;
    if(!hasPendingLocalChanges())return;
    queueAutomaticSync(Math.max(delay,1200));
  };

  cloudHandleRealtime=function stableCloudHandleRealtime(){
    realtimeSignals++;
    remoteSignalSeq++;
    clearTimeout(cloudRealtimeTimer);
    cloudRealtimeTimer=setTimeout(()=>queueAutomaticSync(250),350);
  };

  const noop=()=>{suppressedUiRefreshes++};
  const asyncNoop=async()=>{suppressedUiRefreshes++};

  async function applyWithoutTouchingUi(args){
    const saved={
      renderLocations:window.renderLocations,
      restoreAllForms:window.restoreAllForms,
      refreshLocation:window.bogatkaRefreshLocationFields,
      refreshGlobal:window.bogatkaRefreshGlobalFields,
      renderPhoto:window.bogatkaRenderPhotoCategory,
      updateSummary:window.updateSummary,
    };
    if(saved.renderLocations)window.renderLocations=noop;
    if(saved.restoreAllForms)window.restoreAllForms=asyncNoop;
    if(saved.refreshLocation)window.bogatkaRefreshLocationFields=asyncNoop;
    if(saved.refreshGlobal)window.bogatkaRefreshGlobalFields=asyncNoop;
    if(saved.renderPhoto)window.bogatkaRenderPhotoCategory=asyncNoop;
    if(saved.updateSummary)window.updateSummary=asyncNoop;
    try{return await baseApplyRemote(...args)}finally{
      if(saved.renderLocations)window.renderLocations=saved.renderLocations;
      if(saved.restoreAllForms)window.restoreAllForms=saved.restoreAllForms;
      if(saved.refreshLocation)window.bogatkaRefreshLocationFields=saved.refreshLocation;
      if(saved.refreshGlobal)window.bogatkaRefreshGlobalFields=saved.refreshGlobal;
      if(saved.renderPhoto)window.bogatkaRenderPhotoCategory=saved.renderPhoto;
      if(saved.updateSummary)window.updateSummary=saved.updateSummary;
    }
  }

  cloudApplyRemote=async function stableBackgroundApplyRemote(...args){
    const mustProtect=automaticRun&&(isInteracting()||window.BogatkaUIStability?.isEditing?.());
    if(mustProtect){
      const result=await applyWithoutTouchingUi(args);
      window.BogatkaUIStability?.requestRefresh?.(900);
      return result;
    }
    return baseApplyRemote(...args);
  };

  cloudSetStatus=function stableCloudSetStatus(status,detail=''){
    if(status==='syncing'&&!manualVisual){
      const state=cloudReadState();
      if(state.lastSyncAt)return;
      return baseSetStatus('ready','Облако проверяется в фоне.');
    }
    if(automaticRun&&status==='ready')return baseSetStatus('ready');
    return baseSetStatus(status,detail);
  };

  cloudSetMessage=function stableCloudSetMessage(text='',type='info'){
    if(automaticRun&&type==='success')return;
    return baseSetMessage(text,type);
  };

  cloudMarkLocationDirty=function stableMarkLocationDirty(id){
    if(id)locationMutations.set(id,++mutationSeq);
    return baseMarkLocationDirty(id);
  };
  cloudMarkPhotoDirty=function stableMarkPhotoDirty(id){
    if(id)photoMutations.set(id,++mutationSeq);
    return baseMarkPhotoDirty(id);
  };
  cloudMarkGlobalDirty=function stableMarkGlobalDirty(){
    globalMutationSeq=++mutationSeq;
    return baseMarkGlobalDirty();
  };
  cloudMarkMetaDirty=function stableMarkMetaDirty(){
    metaMutationSeq=++mutationSeq;
    return baseMarkMetaDirty();
  };

  idbDelete=async function stableTrackedDelete(store,key){
    if(store===PHOTO_STORE&&!cloudApplyingRemote){
      let existing=null;
      try{existing=await idbGet(PHOTO_STORE,key)}catch(_){}
      deletedPhotoMutations.set(key,{seq:++mutationSeq,path:existing?.storagePath||null});
    }
    return baseIdbDelete(store,key);
  };

  cloudPushLocations=async function eventDrivenPushLocations(remoteLocations,syncState){
    const remoteByClient=new Map(remoteLocations.map(item=>[item.client_id||item.id,item]));
    const dirty=new Set(syncState.dirtyLocations||[]);
    const pushRows=[];
    for(let index=0;index<locations.length;index++){
      const item=locations[index];
      const data=await getLocationData(item.id);
      const remote=remoteByClient.get(item.id);
      const shouldPush=!remote||dirty.has(item.id)||syncState.metaDirty;
      if(!shouldPush)continue;
      pushRows.push({
        project_id:cloudProjectId,client_id:item.id,title:item.title||item.address||'Без названия',
        address:item.address||null,note:item.note||null,status:data.status||null,object_type:data.objectType||null,
        form_data:cloudCleanFormData(data),sort_order:index,archived_at:data.archivedAt||item.archivedAt||null,
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

  cloudPushProjectState=async function eventDrivenPushProjectState(remoteState,syncState){
    const global=await idbGet(STORE,'global')||{};
    if(remoteState&&!syncState.stateDirty)return;
    const {data,error}=await cloudClient.from('project_state')
      .upsert({project_id:cloudProjectId,data:cloudCleanFormData(global),updated_by:cloudSession.user.id})
      .select('*').single();
    if(error)throw new Error(error.message);
    cloudApplyingRemote=true;
    try{await cloudOriginalIdbPut(STORE,{...global,cloudUpdatedAt:data.updated_at},'global')}
    finally{cloudApplyingRemote=false;}
  };

  function restoreMutationsAfterSync(startSeq){
    let needsAnotherSync=false;
    const state=cloudReadState();
    state.dirtyLocations||=[];
    state.dirtyPhotos||=[];
    state.deletedPhotos||={};
    for(const [id,seq] of [...locationMutations]){
      if(seq>startSeq){if(!state.dirtyLocations.includes(id))state.dirtyLocations.push(id);needsAnotherSync=true}
      else locationMutations.delete(id);
    }
    for(const [id,seq] of [...photoMutations]){
      if(seq>startSeq){if(!state.dirtyPhotos.includes(id))state.dirtyPhotos.push(id);needsAnotherSync=true}
      else photoMutations.delete(id);
    }
    for(const [id,entry] of [...deletedPhotoMutations]){
      if(entry.seq>startSeq){state.deletedPhotos[id]=entry.path;state.dirtyPhotos=state.dirtyPhotos.filter(photoId=>photoId!==id);needsAnotherSync=true}
      else deletedPhotoMutations.delete(id);
    }
    if(globalMutationSeq>startSeq){state.stateDirty=true;needsAnotherSync=true}else if(globalMutationSeq)globalMutationSeq=0;
    if(metaMutationSeq>startSeq){state.metaDirty=true;needsAnotherSync=true}else if(metaMutationSeq)metaMutationSeq=0;
    cloudWriteState(state);
    return needsAnotherSync;
  }

  cloudSyncAll=async function stableCloudSyncAll(options={}){
    const manual=Boolean(options?.manual);
    const initialWork=startupPullPending;
    const remoteAtStart=remoteSignalSeq;
    if(!manual&&!hasAutomaticWork()){
      skippedIdleRuns++;
      if(cloudSession)baseSetStatus('ready');
      return {skipped:true,reason:'idle'};
    }
    if(!manual&&(cloudSyncing||isInteracting()||window.BogatkaUIStability?.isEditing?.())){
      queueAutomaticSync(1200);
      return {deferred:true};
    }
    const startSeq=mutationSeq;
    const previousAutomatic=automaticRun;
    const previousManualVisual=manualVisual;
    automaticRun=!manual;
    manualVisual=manual;
    if(!manual)executedAutomaticRuns++;
    let completed=false;
    try{
      const result=await baseSyncAll(options);
      completed=true;
      if(initialWork)startupPullPending=false;
      handledRemoteSeq=Math.max(handledRemoteSeq,remoteAtStart);
      return result;
    }finally{
      automaticRun=previousAutomatic;
      manualVisual=previousManualVisual;
      if(completed&&restoreMutationsAfterSync(startSeq))queueAutomaticSync(1200);
      else if(completed&&hasAutomaticWork())queueAutomaticSync(500);
    }
  };

  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){if(cloudSession&&hasPendingLocalChanges())queueAutomaticSync(50);return;}
    if(cloudSession){remoteSignalSeq++;queueAutomaticSync(500)}
  });
  window.addEventListener('online',()=>{remoteSignalSeq++;queueAutomaticSync(500)});

  window.BogatkaCloudStability={
    version:'4.0.3',isInteracting,hasPendingLocalChanges,hasAutomaticWork,queueAutomaticSync,
    signalRemote(){remoteSignalSeq++;queueAutomaticSync(250)},
    markStartupHandled(){startupPullPending=false},
    get suppressedUiRefreshes(){return suppressedUiRefreshes},
    get diagnostics(){return {executedAutomaticRuns,skippedIdleRuns,realtimeSignals,remoteSignalSeq,handledRemoteSeq,startupPullPending,hasLocalWork:hasPendingLocalChanges()}},
    principle:'event-driven-sync-with-no-idle-network-loop',
  };
})();
