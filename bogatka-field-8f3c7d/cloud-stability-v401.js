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
  let suppressUiForRun=false;
  let mutationSeq=0;
  const locationMutations=new Map();
  const photoMutations=new Map();
  const deletedPhotoMutations=new Map();
  let globalMutationSeq=0;
  let metaMutationSeq=0;
  let suppressedUiRefreshes=0;

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

  function queueAutomaticSync(delay=2600){
    clearTimeout(deferredSyncTimer);
    clearTimeout(cloudSyncTimer);
    deferredSyncTimer=setTimeout(async()=>{
      if(!cloudSession||cloudApplyingRemote)return;
      if(cloudSyncing||isInteracting()){
        queueAutomaticSync(1800);
        return;
      }
      try{await cloudSyncAll({manual:false})}catch(error){cloudHandleError(error)}
    },Math.max(250,delay));
    cloudSyncTimer=deferredSyncTimer;
  }

  cloudScheduleSync=function stableCloudScheduleSync(delay=2600){
    if(!cloudSession||cloudApplyingRemote)return;
    queueAutomaticSync(Math.max(delay,2600));
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
    const mustProtect=automaticRun&&(suppressUiForRun||isInteracting()||window.BogatkaUIStability?.isEditing?.());
    if(mustProtect){
      const result=await applyWithoutTouchingUi(args);
      window.BogatkaUIStability?.requestRefresh?.(900);
      return result;
    }
    return baseApplyRemote(...args);
  };

  cloudSetStatus=function stableCloudSetStatus(status,detail=''){
    if(automaticRun&&(suppressUiForRun||isInteracting())&&(status==='syncing'||status==='ready'))return;
    return baseSetStatus(status,detail);
  };

  cloudSetMessage=function stableCloudSetMessage(text='',type='info'){
    if(automaticRun&&(suppressUiForRun||isInteracting())&&type==='success')return;
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

  function restoreMutationsAfterSync(startSeq){
    let needsAnotherSync=false;
    const state=cloudReadState();
    state.dirtyLocations||=[];
    state.dirtyPhotos||=[];
    state.deletedPhotos||={};

    for(const [id,seq] of [...locationMutations]){
      if(seq>startSeq){
        if(!state.dirtyLocations.includes(id))state.dirtyLocations.push(id);
        needsAnotherSync=true;
      }else locationMutations.delete(id);
    }
    for(const [id,seq] of [...photoMutations]){
      if(seq>startSeq){
        if(!state.dirtyPhotos.includes(id))state.dirtyPhotos.push(id);
        needsAnotherSync=true;
      }else photoMutations.delete(id);
    }
    for(const [id,entry] of [...deletedPhotoMutations]){
      if(entry.seq>startSeq){
        state.deletedPhotos[id]=entry.path;
        state.dirtyPhotos=state.dirtyPhotos.filter(photoId=>photoId!==id);
        needsAnotherSync=true;
      }else deletedPhotoMutations.delete(id);
    }
    if(globalMutationSeq>startSeq){state.stateDirty=true;needsAnotherSync=true}
    else if(globalMutationSeq)globalMutationSeq=0;
    if(metaMutationSeq>startSeq){state.metaDirty=true;needsAnotherSync=true}
    else if(metaMutationSeq)metaMutationSeq=0;
    cloudWriteState(state);
    return needsAnotherSync;
  }

  cloudSyncAll=async function stableCloudSyncAll(options={}){
    const manual=Boolean(options?.manual);
    if(!manual&&(cloudSyncing||isInteracting()||window.BogatkaUIStability?.isEditing?.())){
      queueAutomaticSync(1800);
      return;
    }
    const startSeq=mutationSeq;
    const previousAutomatic=automaticRun;
    const previousSuppress=suppressUiForRun;
    automaticRun=!manual;
    suppressUiForRun=!manual&&(isInteracting()||window.BogatkaUIStability?.isEditing?.());
    let completed=false;
    try{
      const result=await baseSyncAll(options);
      completed=true;
      return result;
    }finally{
      automaticRun=previousAutomatic;
      suppressUiForRun=previousSuppress;
      if(completed&&restoreMutationsAfterSync(startSeq))queueAutomaticSync(1800);
    }
  };

  window.addEventListener('visibilitychange',()=>{
    if(document.hidden&&cloudSession)queueAutomaticSync(50);
  });
  window.addEventListener('online',()=>queueAutomaticSync(500));

  window.BogatkaCloudStability={
    version:'4.0.2',
    isInteracting,
    queueAutomaticSync,
    get suppressedUiRefreshes(){return suppressedUiRefreshes},
    principle:'background-sync-updates-idle-ui-and-never-rebuilds-active-form',
  };
})();
