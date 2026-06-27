(function(){
  if(window.__bogatkaBackupV400)return;
  window.__bogatkaBackupV400=true;

  function deviceLabel(){
    const ua=navigator.userAgent||'';
    let device='Устройство';
    if(/iPhone|iPad|iPod/i.test(ua))device='iPhone/iPad';
    else if(/Android/i.test(ua))device='Android';
    else if(/Windows/i.test(ua))device='Windows';
    else if(/Macintosh|Mac OS X/i.test(ua))device='macOS';
    else if(/Linux/i.test(ua))device='Linux';
    const standalone=Boolean(window.matchMedia?.('(display-mode: standalone)')?.matches||navigator.standalone);
    return `${device} · ${standalone?'приложение':'браузер'}`;
  }

  function installDeviceHistory(){
    if(window.__bogatkaDeviceHistoryV400||typeof idbPut!=='function')return;
    window.__bogatkaDeviceHistoryV400=true;
    const basePut=idbPut;
    const wrapped=async function(store,value,key){
      if(store===STORE&&typeof key==='string'&&key.startsWith('location:')&&Array.isArray(value?.activity)){
        const device=deviceLabel();
        value.activity=value.activity.map(entry=>{
          if(entry?.device)return entry;
          const actor=entry?.actor?`${entry.actor} · ${device}`:device;
          return {...entry,actor,device};
        });
      }
      return basePut(store,value,key);
    };
    window.idbPut=wrapped;
    try{idbPut=wrapped}catch(_){}
  }

  async function migrateCalculatedRent(){
    if(localStorage.getItem('bogatka_rent_migration_v400')==='done')return;
    let changed=false;
    for(const item of locations){
      const data=await getLocationData(item.id);
      const area=Number(String(data?.tech?.totalArea||'').replace(',','.'));
      const rent=Number(String(data?.tech?.rentPerMonth||data.rent||'').replace(',','.'));
      if(!Number.isFinite(area)||area<=0||!Number.isFinite(rent)||rent<0||data?.tech?.rentPerSqm)continue;
      data.tech||={};
      data.tech.rentPerSqm=String(Math.round(rent/area*100)/100);
      data.updatedAt=new Date().toISOString();
      await idbPut(STORE,data,`location:${item.id}`);
      changed=true;
    }
    localStorage.setItem('bogatka_rent_migration_v400','done');
    if(changed)await updateSummary();
  }

  function loadSupportModules(){
    const modules=['./cloud-archive-v400.js','./ui-stability-v402.js','./cloud-stability-v401.js','./sync-merge-v412.js','./sync-state-v412.js','./sync-runtime-v412.js','./sync-ui-v412.js','./select-sync-v407.js','./address-fix-v400.js','./backup-import-v400.js','./viewer-extra-v400.js','./selftest-v400.js','./collaboration-v410.js','./location-global-v421.js','./location-card-collapse-v422.js'];
    for(const src of modules){
      if(document.querySelector(`script[src="${src}"]`))continue;
      const script=document.createElement('script');
      script.src=src;
      script.async=false;
      document.head.appendChild(script);
    }
  }

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

  installDeviceHistory();
  loadSupportModules();
  setTimeout(()=>{
    installDeviceHistory();
    loadSupportModules();
    migrateCalculatedRent().catch(console.error);
  },1800);
})();
