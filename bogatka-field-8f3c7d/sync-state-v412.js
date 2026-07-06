(function(){
  if(window.BogatkaSyncState?.ready)return;
  if(typeof cloudReadState!=='function'||typeof cloudWriteState!=='function'||typeof idbPut!=='function')return;
  const legacyRead=cloudReadState,legacyWrite=cloudWriteState,currentPut=idbPut;
  let noOpPuts=0;
  const normalize=state=>{
    state=state&&typeof state==='object'?state:{};
    state.dirtyLocations||=[];state.dirtyPhotos||=[];state.deletedPhotos||={};state.deletedLocations||={};state.knownLocationIds||=[];state.knownPhotoIds||=[];
    return state;
  };
  const key=()=>cloudProjectId?`bogatka_cloud_sync_state_v412:${cloudProjectId}`:'';
  cloudReadState=function scopedCloudReadState(){
    const scoped=key();
    if(!scoped)return normalize(legacyRead());
    try{
      const saved=localStorage.getItem(scoped);
      if(saved)return normalize(JSON.parse(saved));
      const old=normalize(legacyRead());
      const migrated=!old.projectId||old.projectId===cloudProjectId?old:{};
      localStorage.setItem(scoped,JSON.stringify(normalize(migrated)));
      return normalize(migrated);
    }catch(_){return normalize({})}
  };
  cloudWriteState=function scopedCloudWriteState(state){
    const scoped=key(),value=normalize(state);
    if(!scoped)return legacyWrite(value);
    localStorage.setItem(scoped,JSON.stringify(value));
  };
  window.cloudReadState=cloudReadState;
  window.cloudWriteState=cloudWriteState;

  const same=(left,right)=>window.BogatkaSyncMerge?.same?window.BogatkaSyncMerge.same(left,right):JSON.stringify(left)===JSON.stringify(right);
  const guarded=async function guardedIdbPut(store,value,recordKey){
    if(store===STORE&&typeof recordKey==='string'&&recordKey.startsWith('location:')&&!cloudApplyingRemote){
      try{
        const existing=await idbGet(store,recordKey);
        if(existing!==undefined&&same(existing,value)){noOpPuts++;return;}
      }catch(_){ }
    }
    return currentPut(store,value,recordKey);
  };
  guarded.__syncStateV412=true;
  window.idbPut=guarded;
  try{idbPut=guarded}catch(_){ }

  const rawPut=()=>typeof cloudOriginalIdbPut!=='undefined'&&cloudOriginalIdbPut?cloudOriginalIdbPut:currentPut;
  const rawDelete=()=>typeof cloudOriginalIdbDelete!=='undefined'&&cloudOriginalIdbDelete?cloudOriginalIdbDelete:idbDelete;
  const baseKey=id=>`syncbase:v412:${cloudProjectId}:${id}`;
  window.BogatkaSyncState={
    version:'4.1.2',ready:true,key,normalize,rawPut,rawDelete,baseKey,
    readBase:id=>idbGet(STORE,baseKey(id)),
    writeBase:(id,value)=>rawPut()(STORE,value,baseKey(id)),
    deleteBase:id=>rawDelete()(STORE,baseKey(id)),
    get noOpPuts(){return noOpPuts;},
  };
})();
