(function(){
  if(window.BogatkaSyncCompatibility?.ready)return;
  if(!window.BogatkaSyncMerge?.merge||!window.BogatkaSyncState?.ready||!window.BogatkaSyncIntegrity?.ready)return;
  const Merge=window.BogatkaSyncMerge,State=window.BogatkaSyncState;
  const baseApply=cloudApplyRemote,basePush=cloudPushLocations;
  const editorSelector='#app input:not([type="button"]):not([type="submit"]):not([type="file"]),#app textarea,#app select,#app [contenteditable="true"]';
  let refreshTimer=null,inferredBaselines=0,deferredRefreshes=0;
  const activeEditor=()=>Boolean(document.activeElement?.matches?.(editorSelector));
  const metaFor=(item,index,row)=>({title:item?.title||row?.title||'',address:item?.address||row?.address||'',note:item?.note||row?.note||'',sortOrder:index,archivedAt:item?.archivedAt||row?.archived_at||null});

  async function inferRecentBaselines(remoteRows,syncState={}){
    const dirty=new Set(syncState.dirtyLocations||[]);
    for(const row of remoteRows||[]){
      const id=row.client_id||row.id;
      if(dirty.has(id)||await State.readBase(id))continue;
      const raw=await getLocationData(id);
      const localRevision=Number(raw.cloudRevision),remoteRevision=Number(row.revision);
      if(!Number.isFinite(localRevision)||!Number.isFinite(remoteRevision)||remoteRevision<localRevision||remoteRevision-localRevision>1)continue;
      const item=locations.find(entry=>entry.id===id);
      await State.writeBase(id,{revision:localRevision,updatedAt:raw.cloudUpdatedAt||'',formData:Merge.clean(raw),meta:metaFor(item,locations.indexOf(item),row)});
      inferredBaselines++;
    }
  }

  async function refreshFields(ids){
    for(const id of ids)if(typeof bogatkaRefreshLocationFields==='function')await bogatkaRefreshLocationFields(id);
    if(ids.length&&typeof updateSummary==='function')await updateSummary();
  }
  function deferRefresh(ids){
    deferredRefreshes++;
    clearTimeout(refreshTimer);
    const run=async()=>{
      if(activeEditor()){refreshTimer=setTimeout(run,700);return;}
      try{await refreshFields(ids)}catch(error){console.error(error)}
    };
    refreshTimer=setTimeout(run,700);
  }

  cloudApplyRemote=async function mergedApplyWithSafeUi(remoteLocations,remotePhotos,remoteState,syncState){
    await inferRecentBaselines(remoteLocations,syncState);
    const before=new Map();
    for(const row of remoteLocations||[]){const id=row.client_id||row.id;before.set(id,Merge.clean(await getLocationData(id)))}
    const protectedEditor=activeEditor();
    const result=await baseApply(remoteLocations,remotePhotos,remoteState,syncState);
    const changed=[];
    for(const [id,value] of before){if(!Merge.same(value,Merge.clean(await getLocationData(id))))changed.push(id)}
    if(changed.length){
      if(protectedEditor||activeEditor()){window.BogatkaUIStability?.requestRefresh?.(900);deferRefresh(changed)}
      else await refreshFields(changed);
    }
    return result;
  };
  cloudPushLocations=async function mergedPushWithBaseline(remoteLocations,syncState){
    await inferRecentBaselines(remoteLocations,syncState);
    return basePush(remoteLocations,syncState);
  };
  window.cloudApplyRemote=cloudApplyRemote;
  window.cloudPushLocations=cloudPushLocations;
  window.BogatkaSyncCompatibility={version:'4.1.2',ready:true,get diagnostics(){return {inferredBaselines,deferredRefreshes}}};
})();
