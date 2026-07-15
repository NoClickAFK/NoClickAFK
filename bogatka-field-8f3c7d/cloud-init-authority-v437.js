(function(){
  'use strict';
  if(window.BogatkaCloudInitAuthorityV437?.ready)return;

  const VERSION='4.3.7';
  const diagnostics={
    delegateCalls:0,singletonCalls:0,
    createClientCalls:0,appCreateClientCalls:0,auxiliaryCreateClientCalls:0,
    getSessionCalls:0,appGetSessionCalls:0,
    authListenerCalls:0,appAuthListenerCalls:0,
  };
  let installed=false;
  let instrumented=false;

  function instrumentSupabase(){
    if(instrumented||!window.supabase?.createClient)return false;
    const base=window.supabase.createClient.bind(window.supabase);
    window.supabase.createClient=function(...args){
      diagnostics.createClientCalls+=1;
      const isAppClient=args[2]?.auth?.persistSession===true;
      if(isAppClient)diagnostics.appCreateClientCalls+=1;
      else diagnostics.auxiliaryCreateClientCalls+=1;
      const client=base(...args);
      if(client?.auth&&!client.auth.__cloudInitAuthorityV437){
        const getSession=client.auth.getSession?.bind(client.auth);
        const onAuthStateChange=client.auth.onAuthStateChange?.bind(client.auth);
        if(getSession)client.auth.getSession=async function(...sessionArgs){
          diagnostics.getSessionCalls+=1;
          if(isAppClient)diagnostics.appGetSessionCalls+=1;
          return getSession(...sessionArgs);
        };
        if(onAuthStateChange)client.auth.onAuthStateChange=function(...listenerArgs){
          diagnostics.authListenerCalls+=1;
          if(isAppClient)diagnostics.appAuthListenerCalls+=1;
          return onAuthStateChange(...listenerArgs);
        };
        try{Object.defineProperty(client.auth,'__cloudInitAuthorityV437',{value:true})}catch(_){client.auth.__cloudInitAuthorityV437=true}
      }
      return client;
    };
    instrumented=true;
    return true;
  }

  function singleton(options={}){
    diagnostics.singletonCalls+=1;
    const init=window.BogatkaCloud?.init;
    if(typeof init!=='function')return Promise.reject(new Error('Canonical cloud singleton is unavailable.'));
    return Promise.resolve(init(options));
  }

  function installIntegrityDelegate(){
    if(installed)return true;
    const replacement=function installCanonicalCloudInitGate(){
      if(window.__bogatkaSyncIntegrityGateV412)return;
      window.__bogatkaSyncIntegrityGateV412=true;
      const delegate=function canonicalCloudInit(options={}){
        diagnostics.delegateCalls+=1;
        return singleton(options);
      };
      delegate.__bogatkaCloudStartupV468=true;
      delegate.__cloudInitAuthorityV437=true;
      window.cloudInit=delegate;
      try{cloudInit=delegate}catch(_){ }
    };
    window.installSyncIntegrityGate=replacement;
    try{installSyncIntegrityGate=replacement}catch(_){ }
    installed=true;
    return true;
  }

  instrumentSupabase();
  installIntegrityDelegate();
  window.addEventListener('load',()=>{
    instrumentSupabase();
    installIntegrityDelegate();
  },{once:true,capture:true});

  window.BogatkaCloudInitAuthorityV437={
    version:VERSION,ready:true,
    singleton,
    installIntegrityDelegate,
    instrumentSupabase,
    get diagnostics(){return{...diagnostics,installed,instrumented}},
    _test:{reset(){for(const key of Object.keys(diagnostics))diagnostics[key]=0}},
  };
})();
