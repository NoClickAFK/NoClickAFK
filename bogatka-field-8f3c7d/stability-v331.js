if(typeof cloudApplyRemote==='function'){
  const bogatkaCloudApplyRemoteV33=cloudApplyRemote;
  cloudApplyRemote=async function(remoteLocations,remotePhotos,remoteState,syncState){
    let safeLocations=remoteLocations;
    if(syncState?.metaDirty){
      safeLocations=remoteLocations.map(remote=>{
        const clientId=remote.client_id||remote.id;
        const local=locations.find(item=>item.id===clientId);
        return local?{...remote,title:local.title,address:local.address,note:local.note}:remote;
      });
    }
    return bogatkaCloudApplyRemoteV33(safeLocations,remotePhotos,remoteState,syncState);
  };
}
