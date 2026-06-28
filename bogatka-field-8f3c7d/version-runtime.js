(function(scope){
  'use strict';

  const build=scope.BOGATKA_BUILD;
  if(!build||!/^\d+\.\d+\.\d+$/.test(String(build.version||''))){
    throw new Error('Не загружены корректные метаданные версии приложения.');
  }

  const version=String(build.version);
  const token=String(build.versionToken||version.replace(/\D/g,''));
  let observer=null;

  function apply(){
    if(typeof document==='undefined')return version;
    const label=document.getElementById('versionLabel');
    if(!label)return version;
    if(label.textContent!==version)label.textContent=version;
    label.dataset.buildVersion=version;
    label.dataset.buildCommit=String(build.sourceCommit||'');
    label.title=build.sourceCommit
      ? `Сборка ${version} · ${String(build.sourceCommit).slice(0,7)} · ${build.builtAt||''}`
      : `Сборка ${version}`;
    if(!observer){
      observer=new MutationObserver(()=>{
        if(label.textContent!==version)label.textContent=version;
      });
      observer.observe(label,{childList:true,characterData:true,subtree:true});
    }
    return version;
  }

  function makeAppUrl(accessToken=null,baseHref=scope.location?.href||'http://localhost/'){
    const url=new URL(baseHref,scope.location?.href||'http://localhost/');
    url.hash='';
    url.search='';
    url.searchParams.set('v',token);
    if(accessToken)url.hash=`access=${encodeURIComponent(accessToken)}`;
    return url.href;
  }

  function getAccessLinkData(accessToken=null){
    return {url:makeAppUrl(accessToken),hasFullKey:Boolean(accessToken)};
  }

  scope.BogatkaVersion=Object.freeze({build,version,token,apply,makeAppUrl,getAccessLinkData});
  scope.addEventListener?.('DOMContentLoaded',apply,{once:true});
  scope.addEventListener?.('load',apply);
})(typeof window!=='undefined'?window:globalThis);
