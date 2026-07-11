(function(){
  if(window.BogatkaSyncFieldCompatV416)return;

  const VERSION='4.1.6';
  const ARCHIVE_SCRIPT='./archive-state-v436.js';
  const OBJECT_TYPE_ALIASES=new Map([
    ['Стрит-ритейл','Стрит-ритейл'],
    ['Стрит ритейл','Стрит-ритейл'],
    ['Магазин с отдельным входом с улицы','Стрит-ритейл'],
    ['Street retail','Стрит-ритейл'],
    ['street retail','Стрит-ритейл'],
    ['street-retail','Стрит-ритейл'],
  ]);
  let attempts=0;
  let archiveGateInstalled=false;
  let archiveBootstrapAttempts=0;

  function cloneForm(value){
    if(!value||typeof value!=='object'||Array.isArray(value))return {};
    try{return structuredClone(value)}catch(_){return {...value}}
  }

  function isMissing(value){
    return value===undefined||value===null||value==='';
  }

  function normalizeObjectType(value){
    if(isMissing(value))return value;
    const text=String(value).trim();
    return OBJECT_TYPE_ALIASES.get(text)||text;
  }

  function hydrateRow(row){
    if(!row||typeof row!=='object')return row;
    const form=cloneForm(row.form_data);
    if(!isMissing(row.status))form.status=row.status;
    const columnObjectType=normalizeObjectType(row.object_type);
    const formObjectType=normalizeObjectType(form.objectType);
    if(!isMissing(columnObjectType))form.objectType=columnObjectType;
    else if(!isMissing(formObjectType))form.objectType=formObjectType;
    return {...row,object_type:columnObjectType,form_data:form};
  }

  function hydrateRows(rows){
    return Array.isArray(rows)?rows.map(hydrateRow):[];
  }

  function waitForArchiveReady(timeoutMs=10000){
    if(window.BogatkaArchiveStateV436?.ready)return Promise.resolve(window.BogatkaArchiveStateV436);
    const started=Date.now();
    return new Promise((resolve,reject)=>{
      const check=()=>{
        if(window.BogatkaArchiveStateV436?.ready)return resolve(window.BogatkaArchiveStateV436);
        if(Date.now()-started>=timeoutMs)return reject(new Error('Archive synchronization compatibility did not become ready before cloud sync.'));
        setTimeout(check,25);
      };
      check();
    });
  }

  function installArchiveGate(){
    if(archiveGateInstalled)return true;
    const current=typeof cloudSyncAll==='function'?cloudSyncAll:window.cloudSyncAll;
    if(typeof current!=='function')return false;
    if(current.__archiveStateGateV436){archiveGateInstalled=true;return true}
    const gated=async function(...args){
      await waitForArchiveReady();
      return current.apply(this,args);
    };
    gated.__archiveStateGateV436=true;
    gated.__base=current;
    window.cloudSyncAll=gated;
    try{cloudSyncAll=gated}catch(_){ }
    archiveGateInstalled=true;
    return true;
  }

  function ensureArchiveScript(){
    if(window.BogatkaArchiveStateV436?.ready)return true;
    const target=new URL(ARCHIVE_SCRIPT,location.href).href;
    const existing=[...document.scripts].find(script=>script.src===target||script.getAttribute('src')===ARCHIVE_SCRIPT);
    if(existing)return true;
    const script=document.createElement('script');
    script.src=ARCHIVE_SCRIPT;
    script.async=false;
    script.dataset.archiveBootstrapV436='1';
    document.head.appendChild(script);
    return true;
  }

  function bootstrapArchiveState(){
    archiveBootstrapAttempts+=1;
    const gateReady=installArchiveGate();
    const scriptReady=gateReady&&ensureArchiveScript();
    if(gateReady&&scriptReady){api.ready=true;return}
    if(archiveBootstrapAttempts<400)setTimeout(bootstrapArchiveState,25);
  }

  function wrapFetch(){
    if(typeof cloudFetchRemote!=='function')return false;
    if(cloudFetchRemote.__syncFieldCompatV416)return true;
    const base=cloudFetchRemote;
    const wrapped=async function(...args){
      const result=await base(...args);
      if(!result||typeof result!=='object')return result;
      return {...result,remoteLocations:hydrateRows(result.remoteLocations)};
    };
    wrapped.__syncFieldCompatV416=true;
    wrapped.__base=base;
    cloudFetchRemote=wrapped;
    window.cloudFetchRemote=wrapped;
    return true;
  }

  function wrapApply(){
    if(typeof cloudApplyRemote!=='function')return false;
    if(cloudApplyRemote.__syncFieldCompatV416)return true;
    const base=cloudApplyRemote;
    const wrapped=async function(remoteLocations,...rest){
      return base(hydrateRows(remoteLocations),...rest);
    };
    wrapped.__syncFieldCompatV416=true;
    wrapped.__base=base;
    cloudApplyRemote=wrapped;
    window.cloudApplyRemote=wrapped;
    return true;
  }

  function install(){
    attempts+=1;
    wrapFetch();
    wrapApply();
    if(attempts<120)setTimeout(install,250);
  }

  const api=window.BogatkaSyncFieldCompatV416={
    version:VERSION,
    ready:false,
    hydrateRow,
    hydrateRows,
    normalizeObjectType,
    install,
    audit(row){
      const hydrated=hydrateRow(row)||{};
      return {
        status:hydrated.form_data?.status??null,
        objectType:hydrated.form_data?.objectType??null,
        hasStatusColumn:!isMissing(row?.status),
        hasObjectTypeColumn:!isMissing(row?.object_type),
      };
    },
    _test:{
      waitForArchiveReady,
      ensureArchiveScript,
      get archiveGateInstalled(){return archiveGateInstalled},
      get archiveBootstrapAttempts(){return archiveBootstrapAttempts},
    },
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  window.addEventListener('load',()=>setTimeout(install,80),{once:true});
  bootstrapArchiveState();
})();
