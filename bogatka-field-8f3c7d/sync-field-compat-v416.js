(function(){
  if(window.BogatkaSyncFieldCompatV416)return;

  const VERSION='4.1.6';
  const ARCHIVE_SCRIPT='./archive-state-v436.js';
  const ARCHIVE_FETCH_SCRIPT='./cloud-archive-v400.js';
  const ARCHIVE_READY_TIMEOUT_MS=30000;
  const FETCH_AUTHORITY_OWNER='sync-field-compat-v416';
  const ARCHIVE_FETCH_SOURCE_KIND='archive-inclusive';
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
  let archiveFetchScriptAttempts=0;
  let archiveFetchScriptFailures=0;
  let archiveFetchScriptRetries=0;
  let archiveFetchRetryTimer=null;
  let archiveFetchWaitRequests=0;
  let archiveFetchWaitTimeouts=0;
  let startupGateWaits=0;
  let fetchSource=null;
  let archiveFetchSourceRegistered=false;
  let archiveFetchSourceRegisteredAt=null;
  let archiveFetchReadyAt=null;
  let fetchAuthorityInstallCalls=0;
  let fetchAuthorityRebinds=0;
  let fetchAuthoritySourceChanges=0;
  let fetchAuthorityCalls=0;
  let fetchAuthorityLastReason='';
  let fetchAuthorityRejectedSources=0;
  let terminalEverInstalled=false;
  let lastRejectedSource=null;
  let archiveFetchLastError='';

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

  function scriptMatches(script,src){
    if(!script)return false;
    try{
      const expected=new URL(src,location.href);
      const actual=new URL(script.src||script.getAttribute('src')||'',location.href);
      return actual.origin===expected.origin&&actual.pathname===expected.pathname;
    }catch(_){return script.getAttribute('src')===src}
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

  function archiveFetchReady(){
    return Boolean(archiveFetchSourceRegistered&&typeof fetchSource==='function'&&fetchSource.__archiveInclusiveFetchV400===true);
  }

  function waitForArchiveFetchReady(timeoutMs=ARCHIVE_READY_TIMEOUT_MS){
    archiveFetchWaitRequests+=1;
    if(archiveFetchReady())return Promise.resolve(fetchSource);
    const started=Date.now();
    return new Promise((resolve,reject)=>{
      const check=()=>{
        const exposed=window.BogatkaCloudArchive?.fetchSource;
        if(typeof exposed==='function')installFetchAuthority(exposed,{reason:'archive-fetch-wait-exposed-source'});
        else installFetchAuthority(null,{reason:'archive-fetch-wait'});
        if(archiveFetchReady())return resolve(fetchSource);
        ensureArchiveFetchScript();
        if(Date.now()-started>=timeoutMs){
          archiveFetchWaitTimeouts+=1;
          archiveFetchLastError='Archive-inclusive cloud fetch did not become ready before cloud sync.';
          return reject(new Error(archiveFetchLastError));
        }
        setTimeout(check,25);
      };
      check();
    });
  }

  async function waitForStartupSyncReady(timeoutMs=ARCHIVE_READY_TIMEOUT_MS){
    startupGateWaits+=1;
    const [archiveState,archiveSource]=await Promise.all([
      waitForArchiveReady(timeoutMs),
      waitForArchiveFetchReady(timeoutMs),
    ]);
    return{archiveState,archiveSource};
  }

  function installArchiveGate(){
    if(archiveGateInstalled)return true;
    const current=typeof cloudSyncAll==='function'?cloudSyncAll:window.cloudSyncAll;
    if(typeof current!=='function')return false;
    if(current.__archiveStateGateV436){archiveGateInstalled=true;return true}
    const gated=async function(...args){
      await waitForStartupSyncReady();
      return current.apply(this,args);
    };
    gated.__archiveStateGateV436=true;
    gated.__archiveFetchGateV436=true;
    gated.__base=current;
    window.cloudSyncAll=gated;
    try{cloudSyncAll=gated}catch(_){ }
    archiveGateInstalled=true;
    return true;
  }

  function scheduleArchiveBootstrap(delay=25){
    clearTimeout(archiveBootstrapTimer);
    archiveBootstrapTimer=setTimeout(bootstrapArchiveState,delay);
  }

  function ensureArchiveScript(){
    if(window.BogatkaArchiveStateV436?.ready)return true;
    const existing=[...document.scripts].find(script=>scriptMatches(script,ARCHIVE_SCRIPT));
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
      const retryDelay=Math.min(1000,100*archiveScriptFailures);
      scheduleArchiveBootstrap(retryDelay);
    };
    document.head.appendChild(script);
    return true;
  }

  function scheduleArchiveFetchRetry(delay=null){
    clearTimeout(archiveFetchRetryTimer);
    const retryDelay=delay??Math.min(1000,100*Math.max(1,archiveFetchScriptFailures));
    archiveFetchRetryTimer=setTimeout(()=>{
      archiveFetchScriptRetries+=1;
      ensureArchiveFetchScript();
    },retryDelay);
  }

  function ensureArchiveFetchScript(){
    if(archiveFetchReady())return true;
    const exposed=window.BogatkaCloudArchive?.fetchSource;
    if(typeof exposed==='function'&&installFetchAuthority(exposed,{reason:'archive-fetch-exposed-source'}))return true;
    const current=liveFetch();
    if(current&&current!==terminalFetch&&installFetchAuthority(current,{reason:'archive-fetch-live-source'}))return true;

    const existing=[...document.scripts].find(script=>scriptMatches(script,ARCHIVE_FETCH_SCRIPT));
    if(existing&&existing.dataset.archiveFetchLoadFailedV436==='1')existing.remove();
    else if(existing){
      if(existing.dataset.archiveFetchLoadPendingV436==='1')return true;
      const observedAt=Number(existing.dataset.archiveFetchObservedAtV436||0);
      if(!observedAt){existing.dataset.archiveFetchObservedAtV436=String(Date.now());return true}
      if(Date.now()-observedAt<1000)return true;
      existing.dataset.archiveFetchLoadFailedV436='1';
      existing.remove();
      window.__bogatkaCloudArchiveV400=false;
    }

    archiveFetchScriptAttempts+=1;
    const script=document.createElement('script');
    script.src=ARCHIVE_FETCH_SCRIPT;
    script.async=false;
    script.dataset.archiveFetchBootstrapV436='1';
    script.dataset.archiveFetchLoadPendingV436='1';
    script.onload=()=>{
      delete script.dataset.archiveFetchLoadPendingV436;
      script.dataset.archiveFetchLoadSucceededV436='1';
      const source=window.BogatkaCloudArchive?.fetchSource;
      if(typeof source==='function')installFetchAuthority(source,{reason:'archive-fetch-script-load'});
      else installFetchAuthority(null,{reason:'archive-fetch-script-load'});
      if(!archiveFetchReady()){
        archiveFetchLastError='Archive fetch script loaded without registering an archive-inclusive source.';
        script.dataset.archiveFetchLoadFailedV436='1';
        script.remove();
        window.__bogatkaCloudArchiveV400=false;
        scheduleArchiveFetchRetry();
      }
    };
    script.onerror=()=>{
      archiveFetchScriptFailures+=1;
      archiveFetchLastError='Archive fetch script failed to load.';
      delete script.dataset.archiveFetchLoadPendingV436;
      script.dataset.archiveFetchLoadFailedV436='1';
      script.remove();
      window.__bogatkaCloudArchiveV400=false;
      scheduleArchiveFetchRetry();
    };
    document.head.appendChild(script);
    return true;
  }

  function bootstrapArchiveState(){
    archiveBootstrapAttempts+=1;
    const gateReady=installArchiveGate();
    const archiveStateRequested=gateReady&&ensureArchiveScript();
    const archiveFetchRequested=gateReady&&ensureArchiveFetchScript();
    if(gateReady&&archiveStateRequested&&archiveFetchRequested){
      api.ready=true;
      clearTimeout(archiveBootstrapTimer);
      return;
    }
    const delay=Math.min(250,25+Math.floor(archiveBootstrapAttempts/40)*25);
    scheduleArchiveBootstrap(delay);
  }

  function isArchiveInclusiveSource(candidate){
    return Boolean(typeof candidate==='function'&&candidate.__archiveInclusiveFetchV400===true);
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
    if(!archiveFetchReady())await waitForArchiveFetchReady();
    const source=fetchSource;
    if(!isArchiveInclusiveSource(source)||source===terminalFetch)throw new Error('Archive-inclusive canonical cloud fetch source is unavailable.');
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
    if(!isArchiveInclusiveSource(source)){
      if(lastRejectedSource!==source){lastRejectedSource=source;fetchAuthorityRejectedSources+=1}
      return false;
    }
    if(fetchSource!==source){
      fetchSource=source;
      terminalFetch.__source=source;
      terminalFetch.__base=source;
      fetchAuthoritySourceChanges+=1;
    }
    archiveFetchSourceRegistered=true;
    archiveFetchSourceRegisteredAt??=Date.now();
    archiveFetchReadyAt??=Date.now();
    archiveFetchLastError='';
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
    const exposed=window.BogatkaCloudArchive?.fetchSource;
    const candidates=[source,exposed,current&&current!==terminalFetch?current:null,fetchSource];
    let accepted=false;
    for(const candidate of candidates){
      if(candidate&&setFetchSource(candidate)){accepted=true;break}
    }
    const shouldRebind=!terminalEverInstalled||accepted||reason!=='compat-install';
    if(shouldRebind&&(current!==terminalFetch||window.cloudFetchRemote!==terminalFetch)){
      fetchAuthorityRebinds+=1;
      try{cloudFetchRemote=terminalFetch}catch(_){ }
      window.cloudFetchRemote=terminalFetch;
      terminalEverInstalled=true;
    }else if(current===terminalFetch&&window.cloudFetchRemote===terminalFetch){
      terminalEverInstalled=true;
    }
    return archiveFetchReady();
  }

  function fetchAuthoritySnapshot(){
    const current=liveFetch();
    return{
      owner:FETCH_AUTHORITY_OWNER,
      terminalInstalled:current===terminalFetch&&window.cloudFetchRemote===terminalFetch,
      hydration:true,
      archiveTransformReady:typeof window.BogatkaArchiveStateV436?.cohereRow==='function',
      archiveSource:archiveFetchReady(),
      archiveFetchReady:archiveFetchReady(),
      archiveFetchSourceRegistered,
      archiveFetchSourceKind:archiveFetchReady()?ARCHIVE_FETCH_SOURCE_KIND:'unavailable',
      archiveSourceRegisteredAt:archiveFetchSourceRegisteredAt,
      archiveFetchReadyAt,
      sourceName:fetchSource?.name||'',
      wrapperDepth:current===terminalFetch?1:0,
      installCalls:fetchAuthorityInstallCalls,
      rebinds:fetchAuthorityRebinds,
      sourceChanges:fetchAuthoritySourceChanges,
      rejectedBaseSources:fetchAuthorityRejectedSources,
      fetchCalls:fetchAuthorityCalls,
      lastReason:fetchAuthorityLastReason,
      archiveFetchScriptAttempts,
      archiveFetchScriptFailures,
      archiveFetchScriptRetries,
      archiveFetchWaitRequests,
      archiveFetchWaitTimeouts,
      startupGateWaits,
      archiveFetchLastError,
    };
  }

  function wrapFetch(){
    installFetchAuthority(null,{reason:'compat-install'});
    return true;
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
    ensureArchiveFetchScript();
    if(attempts<120)setTimeout(install,250);
  }

  const api=window.BogatkaSyncFieldCompatV416={
    version:VERSION,
    ready:false,
    archiveBootstrapPersistent:true,
    archiveFetchBootstrapPersistent:true,
    archiveReadyTimeoutMs:ARCHIVE_READY_TIMEOUT_MS,
    fetchAuthorityOwner:FETCH_AUTHORITY_OWNER,
    get archiveFetchReady(){return archiveFetchReady()},
    get archiveFetchSourceRegistered(){return archiveFetchSourceRegistered},
    get archiveFetchSourceKind(){return archiveFetchReady()?ARCHIVE_FETCH_SOURCE_KIND:'unavailable'},
    hydrateRow,
    hydrateRows,
    transformRemoteRow,
    transformRemoteRows,
    normalizeObjectType,
    install,
    installFetchAuthority,
    waitForArchiveFetchReady,
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
      waitForArchiveFetchReady,
      waitForStartupSyncReady,
      ensureArchiveScript,
      ensureArchiveFetchScript,
      installFetchAuthority,
      fetchAuthoritySnapshot,
      get archiveGateInstalled(){return archiveGateInstalled},
      get archiveBootstrapAttempts(){return archiveBootstrapAttempts},
      get archiveReadyTimeoutMs(){return ARCHIVE_READY_TIMEOUT_MS},
      get archiveScriptFailures(){return archiveScriptFailures},
      get archiveFetchScriptAttempts(){return archiveFetchScriptAttempts},
      get archiveFetchScriptFailures(){return archiveFetchScriptFailures},
      get archiveFetchScriptRetries(){return archiveFetchScriptRetries},
      get installAttempts(){return attempts},
    },
  };

  window.addEventListener('bogatka:cloud-archive-loaded',event=>{
    const source=event?.detail?.fetchSource||window.BogatkaCloudArchive?.fetchSource||null;
    installFetchAuthority(source,{reason:'cloud-archive-event'});
    if(!archiveFetchReady())ensureArchiveFetchScript();
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  window.addEventListener('load',()=>setTimeout(install,80),{once:true});
  bootstrapArchiveState();
})();