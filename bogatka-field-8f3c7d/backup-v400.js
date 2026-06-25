(function(){
  if(window.__bogatkaBackupV400)return;
  window.__bogatkaBackupV400=true;
  window.exportBackup=async function exportBackupV400(){
    const records={};
    records['meta:locations']=locations;
    records.global=await idbGet(STORE,'global')||{};
    for(const item of locations)records[`location:${item.id}`]=await getLocationData(item.id);
    const photos=[];
    for(const photo of await idbAll(PHOTO_STORE)){
      const copy={...photo};
      delete copy.previewBlob;
      copy.blob=await blobToDataURL(photo.blob);
      photos.push(copy);
    }
    const payload={format:'bogatka-location-backup',version:4,appVersion:'4.0.0',createdAt:new Date().toISOString(),records,photos};
    const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});
    downloadBlob(blob,`bogatka-backup-${new Date().toISOString().slice(0,10)}.json`);
    const global=records.global||{};
    global.lastBackupAt=new Date().toISOString();
    await idbPut(STORE,global,'global');
  };
  try{exportBackup=window.exportBackup}catch(_){}
})();
