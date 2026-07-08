(function(){
  'use strict';
  const VERSION='4.6.8';
  if(window.BogatkaCloud?.version===VERSION)return;

  let initPromise=null;
  let firstSyncReady=Promise.resolve({status:'not-started'});
  let authListenerInstalled=false;
  let windowHooksInstalled=false;
  let cloudPrepared=false;
  let firstSyncCompleted=false;
  let lastInitResult=null;
  let lastFirstSyncResult=null;
  let syncModuleLoadError=null;

  const now=()=>Math.round(performance.now()*10)/10;
  const diagnostics={events:[]};
  const mark=(type,detail={})=>diagnostics.events.push({at:now(),type,...detail});

  function setGlobal(name,value){
    window[name]=value;
    try{eval(`${name}=window[${JSON.stringify(name)}]`)}catch(_){ }
  }

  function hasGlobalFunction(name){
    try{return typeof eval(name)==='function'}catch(_){return typeof window[name]==='function'}
  }

  function scriptSrc(src){
    return new URL(src,location.href).href;
  }

  function hasScript(src){
    const target=scriptSrc(src);
    return [...document.scripts].some(script=>script.src===target||script.getAttribute('src')===src);
  }

  function waitFor(predicate,label,timeoutMs=5000){
    const started=performance.now();
    return new Promise((resolve,reject)=>{
      const tick=()=>{
        let ok=false;
        try{ok=Boolean(predicate())}catch(_){ok=false}
        if(ok)return resolve(true);
        if(performance.now()-started>timeoutMs)return reject(new Error(`Не дождались готовности cloud-startup: ${label}`));
        setTimeout(tick,30);
      };
      tick();
    });
  }

  function loadScript(src,predicate,label=src){
    if(predicate?.())return Promise.resolve('ready');
    return new Promise((resolve,reject)=>{
      const finish=()=>waitFor(predicate,`${label} ready`,6000).then(()=>resolve('ready')).catch(reject);
      if(hasScript(src))return finish();
      const script=document.createElement('script');
      script.src=src;
      script.async=false;
      script.dataset.cloudStartupV468='1';
      script.onload=finish;
      script.onerror=()=>reject(new Error(`Не удалось загрузить cloud-startup модуль: ${src}`));
      document.head.appendChild(script);
    });
  }

  async function installSyncModules(){
    if(window.BogatkaSyncIntegrity?.ready&&window.BogatkaSyncCompatibility?.ready&&window.BogatkaSyncFieldCompatV416?.ready)return {status:'already-ready'};
    mark('sync-modules-start');
    await loadScript('./sync-merge-v412.js',()=>window.BogatkaSyncMerge?.merge,'sync merge');
    await loadScript('./sync-state-v412.js',()=>window.BogatkaSyncState?.ready,'sync state');
    await loadScript('./cloud-stability-v401.js',()=>window.BogatkaCloudStability?.version,'cloud stability');
    await loadScript('./sync-field-compat-v416.js',()=>window.BogatkaSyncFieldCompatV416?.ready,'sync field compatibility');
    await loadScript('./sync-runtime-v412.js',()=>window.BogatkaSyncIntegrity?.ready,'sync integrity');
    await loadScript('./sync-ui-v412.js',()=>window.BogatkaSyncCompatibility?.ready,'sync UI compatibility');
    mark('sync-modules-ready');
    return {status:'ready'};
  }

  function ensureTopPill(){
    const statusbar=document.querySelector('.statusbar');
    if(statusbar&&!document.querySelector('#cloudTopPill')){
      const pill=document.createElement('span');
      pill.id='cloudTopPill';
      pill.className='pill cloud-sync-pill signed_out';
      pill.textContent='Облако: вход не выполнен';
      statusbar.appendChild(pill);
    }
  }

  function installWindowHooks(){
    if(windowHooksInstalled)return;
    windowHooksInstalled=true;
    window.addEventListener('online',()=>cloudSyncAll().catch(cloudHandleError));
    window.addEventListener('offline',()=>cloudSetStatus('offline'));
  }

  function installAuthListener(){
    if(authListenerInstalled||!cloudClient?.auth?.onAuthStateChange)return;
    authListenerInstalled=true;
    cloudClient.auth.onAuthStateChange((event,session)=>{
      cloudSession=session;
      if(event==='INITIAL_SESSION')return;
      setTimeout(async()=>{
        if(session){
          try{
            await cloudEnsureProject();
            cloudRenderModal();
            await cloudSyncAll();
          }catch(error){cloudHandleError(error)}
        }else{
          cloudProjectId=null;
          cloudRole=null;
          cloudSetStatus('signed_out');
          cloudRenderModal();
        }
      },0);
    });
  }

  async function runFirstSync({preReveal=false,timeoutMs=14000}={}){
    if(!cloudSession){
      lastFirstSyncResult={status:'no-session',preReveal};
      firstSyncCompleted=true;
      return lastFirstSyncResult;
    }
    if(!navigator.onLine){
      cloudSetStatus('offline','Изменения сохранены на устройстве и будут отправлены после восстановления связи.');
      lastFirstSyncResult={status:'offline',preReveal};
      firstSyncCompleted=true;
      return lastFirstSyncResult;
    }
    const sync=async()=>{
      mark('first-sync-start',{preReveal});
      await cloudEnsureProject();
      cloudRenderModal();
      const result=await cloudSyncAll({manual:false,preReveal,startup:true});
      firstSyncCompleted=true;
      lastFirstSyncResult={status:'synced',preReveal,result};
      mark('first-sync-ready',{preReveal});
      window.dispatchEvent(new CustomEvent('bogatka:cloud-first-sync-ready',{detail:{version:VERSION,preReveal,result:lastFirstSyncResult}}));
      return lastFirstSyncResult;
    };
    const timeout=new Promise(resolve=>setTimeout(()=>resolve({status:'timeout',preReveal}),timeoutMs));
    const result=await Promise.race([sync().catch(error=>({status:'error',preReveal,error})),timeout]);
    if(result.status==='error')cloudHandleError(result.error);
    else if(result.status==='timeout')cloudSetStatus('error','Первичная облачная проверка не завершилась вовремя. Локальные данные показаны, синхронизация продолжится в фоне.');
    lastFirstSyncResult=result;
    return result;
  }

  async function startupCloudInit(options={}){
    const preReveal=Boolean(options?.preReveal);
    if(initPromise){
      const result=await initPromise;
      if(preReveal)await firstSyncReady;
      return result;
    }

    initPromise=(async()=>{
      mark('cloud-init-start',{preReveal});
      cloudReplaceButtons();
      ensureTopPill();
      if(!window.BOGATKA_SUPABASE||!window.supabase?.createClient){
        cloudSetStatus('error','Не удалось загрузить модуль облака.');
        lastInitResult={status:'missing-supabase',session:false};
        return lastInitResult;
      }
      await cloudWaitForDb();
      cloudInstallTracking();
      if(!cloudClient){
        cloudClient=window.supabase.createClient(
          BOGATKA_SUPABASE.url,
          BOGATKA_SUPABASE.publishableKey,
          {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
        );
      }

      try{await installSyncModules()}catch(error){syncModuleLoadError=error;console.error(error)}

      const {data}=await cloudClient.auth.getSession();
      cloudSession=data.session;
      installAuthListener();
      if(cloudSession){
        await cloudEnsureProject();
        cloudRenderModal();
        firstSyncReady=runFirstSync({preReveal,timeoutMs:options?.timeoutMs||14000});
        await firstSyncReady;
      }else{
        cloudSetStatus('signed_out');
        firstSyncReady=Promise.resolve({status:'no-session',preReveal});
        firstSyncCompleted=true;
      }
      window.cloudPublishReport=cloudPublishReport;
      window.cloudSyncAll=cloudSyncAll;
      window.cloudApplyRemote=cloudApplyRemote;
      window.cloudFetchRemote=cloudFetchRemote;
      window.cloudEnsureProject=cloudEnsureProject;
      window.cloudSetStatus=cloudSetStatus;
      window.cloudHandleRealtime=cloudHandleRealtime;
      installWindowHooks();
      cloudPrepared=true;
      lastInitResult={status:'ready',session:Boolean(cloudSession),role:cloudRole||null,preReveal,firstSync:lastFirstSyncResult,syncModuleLoadError:syncModuleLoadError?.message||null};
      mark('cloud-init-ready',lastInitResult);
      return lastInitResult;
    })();
    return initPromise;
  }

  setGlobal('cloudInit',startupCloudInit);

  window.BogatkaCloud={
    version:VERSION,
    init:startupCloudInit,
    installSyncModules,
    get firstSyncReady(){return firstSyncReady},
    get ready(){return cloudPrepared},
    get firstSyncCompleted(){return firstSyncCompleted},
    get lastInitResult(){return structuredClone(lastInitResult)},
    get lastFirstSyncResult(){return structuredClone(lastFirstSyncResult)},
    get diagnostics(){return {events:[...diagnostics.events],syncModuleLoadError:syncModuleLoadError?.message||null,stability:window.BogatkaCloudStability?.diagnostics||null,integrity:window.BogatkaSyncIntegrity?.diagnostics||null,compatibility:window.BogatkaSyncCompatibility?.diagnostics||null}},
  };

  mark('cloud-startup-patch-ready');
})();
