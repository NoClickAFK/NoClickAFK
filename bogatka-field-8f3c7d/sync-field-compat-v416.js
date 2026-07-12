(function(){
  if(window.BogatkaSyncFieldCompatV416)return;

  const VERSION='4.1.6';
  const ARCHIVE_SCRIPT='./archive-state-v436.js';
  const ARCHIVE_READY_TIMEOUT_MS=30000;
  const FETCH_AUTHORITY_OWNER='sync-field-compat-v416';
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
  let archiveBootstrapTimer=null;
  let archiveScriptFailures=0;
  let fetchSource=null;
  let fetchAuthorityInstallCalls=0;
  let fetchAuthorityRebinds=0;
  let fetchAuthoritySourceChanges=0;
  let fetchAuthorityCalls=0;
  let fetchAuthorityLastReason='';

  const has=(value,key)=>Boolean(value&&typeof value==='object'&&Object.hasOwn(value,key));

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
    if(!has(form,'status')&&has(row,'status'))form.status=row.status;
    const columnObjectType=has(row,'object_type')?normalizeObjectType(row.object_type):undefined;
    if(!has(form,'objectType')&&has(row,'object_type'))form.objectType=columnObjectType;
    const next={...row,form_data:form};
    if(has(row,'object_type'))next.object_type=columnObjectType;
    return next;
  }

  function hydrateRows(rows){
    return Array.isArray(rows)?rows.map(hydrateRow):[];
  }

  function transformRemoteRow(row){
    const hydrated=hydrateRow(row);
    const cohereArchive=window.BogatkaArchiveStateV436?.cohereRow;
    return typeof cohereArchive==='function'?cohereArchive(hydrated):hydrated;
  }

  function transformRemoteRows(rows){
    return Array.isArray(rows)?rows.map(transformRemoteRow):[];
  }

  function waitForArchiveReady(timeoutMs=ARCHIVE_READY_TIMEOUT_MS){
    if(window.BogatkaArchiveStateV436?.ready)return Promise.resolve(window.BogatkaArchiveStateV436);
    const started=Date.now();
    return new Promise((resolve,reject)=>{
      const check=()=>{
        if(window.BogatkaArchiveStateV436?.ready)return resolve(window.BogatkaArchiveStateV436);
        ensureArchiveScript();
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
    if(existing&&existing.dataset.archiveLoadFailedV436!=='1')return true;
    if(existing)existing.remove();
    const script=document.createElement('script');
    script.src=ARCHIVE_SCRIPT;
    script.async=false;
    script.dataset.archiveBootstrapV436='1';
    script.dataset.archiveLoadPendingV436='1';
    script.onload=()=>{
      delete script.dataset.archiveLoadPendingV436;
      script.dataset.archiveLoadSucceededV436='1';
    };
    script.onerror=()=>{
      archiveScriptFailures+=1;
      delete script.dataset.archiveLoadPendingV436;
      script.dataset.archiveLoadFailedV436='1';
      script.remove();
      clearTimeout(archiveBootstrapTimer);
      const retryDelay=Math.min(1000,100*archiveScriptFailures);
      archiveBootstrapTimer=setTimeout(bootstrapArchiveState,retryDelay);
    };
    document.head.appendChild(script);
    return true;
  }

  function bootstrapArchiveState(){
    archiveBootstrapAttempts+=1;
    const gateReady=installArchiveGate();
    const scriptReady=gateReady&&ensureArchiveScript();
    if(gateReady&&scriptReady){
      clearTimeout(archiveBootstrapTimer);
      api.ready=true;
      return;
    }
    const delay=Math.min(250,25+Math.floor(archiveBootstrapAttempts/40)*25);
    archiveBootstrapTimer=setTimeout(bootstrapArchiveState,delay);
  }

  function unwrapFetchSource(candidate){
    let source=candidate;
    const seen=new Set();
    while(typeof source==='function'&&!seen.has(source)){
      seen.add(source);
      if(source===terminalFetch)return fetchSource;
      if(source.__terminalFetchAuthorityV416&&typeof source.__source==='function'){source=source.__source;continue}
      if(source.__syncFieldCompatV416&&typeof source.__base==='function'){source=source.__base;continue}
      break;
    }
    return source;
  }

  async function terminalFetch(...args){
    const source=fetchSource;
    if(typeof source!=='function'||source===terminalFetch)throw new Error('Canonical cloud fetch source is unavailable.');
    fetchAuthorityCalls+=1;
    const result=await source.apply(this,args);
    if(!result||typeof result!=='object')return result;
    return {...result,remoteLocations:transformRemoteRows(result.remoteLocations)};
  }
  terminalFetch.__syncFieldCompatV416=true;
  terminalFetch.__terminalFetchAuthorityV416=true;
  terminalFetch.__terminalFetchOwnerV416=FETCH_AUTHORITY_OWNER;
  terminalFetch.__source=null;
  terminalFetch.__base=null;

  function setFetchSource(candidate){
    const source=unwrapFetchSource(candidate);
    if(typeof source!=='function'||source===terminalFetch)return false;
    if(fetchSource!==source){
      fetchSource=source;
      terminalFetch.__source=source;
      terminalFetch.__base=source;
      fetchAuthoritySourceChanges+=1;
    }
    return true;
  }

  function liveFetch(){
    let lexical=null;
    try{lexical=typeof cloudFetchRemote==='function'?cloudFetchRemote:null}catch(_){ }
    return lexical||window.cloudFetchRemote||null;
  }

  function installFetchAuthority(source=null,{reason='install'}={}){
    fetchAuthorityInstallCalls+=1;
    fetchAuthorityLastReason=reason;
    const current=liveFetch();
    const candidate=source||(current&&current!==terminalFetch?current:null)||fetchSource;
    if(candidate)setFetchSource(candidate);
    if(typeof fetchSource!=='function')return false;
    if(current!==terminalFetch||window.cloudFetchRemote!==terminalFetch){
      fetchAuthorityRebinds+=1;
      try{cloudFetchRemote=terminalFetch}catch(_){ }
      window.cloudFetchRemote=terminalFetch;
    }
    return true;
  }

  function fetchAuthoritySnapshot(){
    const current=liveFetch();
    return{
      owner:FETCH_AUTHORITY_OWNER,
      terminalInstalled:current===terminalFetch&&window.cloudFetchRemote===terminalFetch,
      hydration:true,
      archiveTransformReady:typeof window.BogatkaArchiveStateV436?.cohereRow==='function',
      archiveSource:Boolean(fetchSource?.__cloudArchiveV400),
      sourceName:fetchSource?.name||'',
      wrapperDepth:current===terminalFetch?1:0,
      installCalls:fetchAuthorityInstallCalls,
      rebinds:fetchAuthorityRebinds,
      sourceChanges:fetchAuthoritySourceChanges,
      fetchCalls:fetchAuthorityCalls,
      lastReason:fetchAuthorityLastReason,
    };
  }

  function wrapFetch(){
    return installFetchAuthority(null,{reason:'compat-install'});
  }

  function wrapApply(){
    if(typeof cloudApplyRemote!=='function')return false;
    if(cloudApplyRemote.__syncFieldCompatV416)return true;
    const base=cloudApplyRemote;
    const wrapped=async function(remoteLocations,...rest){
      return base(transformRemoteRows(remoteLocations),...rest);
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
    archiveBootstrapPersistent:true,
    archiveReadyTimeoutMs:ARCHIVE_READY_TIMEOUT_MS,
    fetchAuthorityOwner:FETCH_AUTHORITY_OWNER,
    hydrateRow,
    hydrateRows,
    transformRemoteRow,
    transformRemoteRows,
    normalizeObjectType,
    install,
    installFetchAuthority,
    audit(row){
      const hydrated=hydrateRow(row)||{};
      return {
        status:has(hydrated.form_data,'status')?hydrated.form_data.status:null,
        objectType:has(hydrated.form_data,'objectType')?hydrated.form_data.objectType:null,
        hasStatusColumn:has(row,'status'),
        hasObjectTypeColumn:has(row,'object_type'),
      };
    },
    _test:{
      waitForArchiveReady,
      ensureArchiveScript,
      installFetchAuthority,
      fetchAuthoritySnapshot,
      get archiveGateInstalled(){return archiveGateInstalled},
      get archiveBootstrapAttempts(){return archiveBootstrapAttempts},
      get archiveReadyTimeoutMs(){return ARCHIVE_READY_TIMEOUT_MS},
      get archiveScriptFailures(){return archiveScriptFailures},
      get installAttempts(){return attempts},
    },
  };

  window.addEventListener('bogatka:cloud-archive-loaded',()=>installFetchAuthority(null,{reason:'cloud-archive-event'}));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  window.addEventListener('load',()=>setTimeout(install,80),{once:true});
  bootstrapArchiveState();
})();
