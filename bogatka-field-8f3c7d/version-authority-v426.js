const VERSION_CACHE_KEY='bogatka_build_meta_v426';
const CURRENT_BUILD=Object.freeze({
  version:'4.3.6',
  versionToken:'436',
  sourceCommit:'8cd455b56cee150dbe3c72e327d91e41a2f3d2b8',
  source:'repository',
});
const FALLBACK_BUILD=CURRENT_BUILD;
let versionObserver=null;
let versionClient=null;
function cachedBuild(){try{const value=JSON.parse(localStorage.getItem(VERSION_CACHE_KEY)||'null');return value?.version?value:null}catch(_){return null}}
function versionRank(version){return String(version||'0.0.0').split('.').map(part=>Number(part)||0).reduce((sum,value,index)=>sum+value*Math.pow(1000,2-index),0)}
function chooseBuild(candidate){if(!candidate?.version)return CURRENT_BUILD;return versionRank(candidate.version)>=versionRank(CURRENT_BUILD.version)?candidate:{...CURRENT_BUILD,remoteIgnored:candidate.version}}
function appUrl(accessToken=null){const build=window.BOGATKA_BUILD||FALLBACK_BUILD,url=new URL(location.href);url.hash='';url.search='';url.searchParams.set('v',build.versionToken||String(build.version).replace(/\D/g,''));if(accessToken)url.hash=`access=${encodeURIComponent(accessToken)}`;return url.href}
function protectLegacyVersionWriters(){
  const legacyUpgrade=window.upgradeV22Controls;
  if(typeof legacyUpgrade==='function'&&!legacyUpgrade.__versionProtectedV426){
    const wrapped=function(...args){const label=document.getElementById('versionLabel');if(label)label.id='versionLabelProtectedV426';try{return legacyUpgrade.apply(this,args)}finally{if(label)label.id='versionLabel';applyBuild(window.BOGATKA_BUILD||FALLBACK_BUILD)}};
    wrapped.__versionProtectedV426=true;window.upgradeV22Controls=wrapped;try{upgradeV22Controls=wrapped}catch(_){}
  }
  const premium=function(){if(typeof window.enhancePasswordField==='function')window.enhancePasswordField();applyBuild(window.BOGATKA_BUILD||FALLBACK_BUILD)};
  window.enhancePremiumUi=premium;try{enhancePremiumUi=premium}catch(_){}
}
function applyBuild(build){
  const selected=chooseBuild(build);if(!selected?.version)return;
  window.BOGATKA_BUILD=Object.freeze({...selected});
  window.BogatkaVersion=Object.freeze({build:window.BOGATKA_BUILD,version:selected.version,token:selected.versionToken,apply:()=>applyBuild(window.BOGATKA_BUILD),makeAppUrl:appUrl,getAccessLinkData:token=>({url:appUrl(token),hasFullKey:Boolean(token)})});
  window.enforceCurrentVersion=()=>applyBuild(window.BOGATKA_BUILD);try{enforceCurrentVersion=window.enforceCurrentVersion}catch(_){}
  window.getAccessLinkData=()=>window.BogatkaVersion.getAccessLinkData(localStorage.getItem('bogatka_access_token_v1'));try{getAccessLinkData=window.getAccessLinkData}catch(_){}
  const label=document.getElementById('versionLabel');
  if(label){
    if(label.textContent!==selected.version)label.textContent=selected.version;
    label.dataset.buildVersion=selected.version;label.dataset.buildCommit=selected.sourceCommit||'';label.title=`Сборка ${selected.version} · ${String(selected.sourceCommit||'').slice(0,7)}`;
    if(!versionObserver){versionObserver=new MutationObserver(()=>{const current=window.BOGATKA_BUILD?.version;if(current&&label.textContent!==current)label.textContent=current});versionObserver.observe(label,{childList:true,characterData:true,subtree:true})}
  }
  protectLegacyVersionWriters();
}
async function registerVersionedWorker(build){if(!('serviceWorker' in navigator))return;const token=chooseBuild(build)?.versionToken||CURRENT_BUILD.versionToken;try{await navigator.serviceWorker.register(`./sw.js?v=${encodeURIComponent(token)}`,{updateViaCache:'none'})}catch(error){console.warn('Versioned Service Worker registration failed.',error)}}
function installVersionedBackup(){
  if(typeof window.exportBackup!=='function'||window.exportBackup.__versionedV426)return;
  const replacement=async function(){
    const records={};records['meta:locations']=locations;records.global=await idbGet(STORE,'global')||{};
    for(const item of locations)records[`location:${item.id}`]=await getLocationData(item.id);
    const photos=[];for(const photo of await idbAll(PHOTO_STORE)){const copy={...photo};delete copy.previewBlob;copy.blob=await blobToDataURL(photo.blob);photos.push(copy)}
    const payload={format:'bogatka-location-backup',version:4,appVersion:window.BOGATKA_BUILD?.version||CURRENT_BUILD.version,createdAt:new Date().toISOString(),records,photos};
    downloadBlob(new Blob([JSON.stringify(payload)],{type:'application/json'}),`bogatka-backup-${new Date().toISOString().slice(0,10)}.json`);records.global.lastBackupAt=new Date().toISOString();await idbPut(STORE,records.global,'global');
  };
  replacement.__versionedV426=true;window.exportBackup=replacement;try{exportBackup=replacement}catch(_){}
}
async function resolveRemoteBuild(){
  if(!window.supabase?.createClient||!window.BOGATKA_SUPABASE)throw new Error('Supabase client is unavailable.');
  versionClient||=window.supabase.createClient(window.BOGATKA_SUPABASE.url,window.BOGATKA_SUPABASE.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {data,error}=await versionClient.functions.invoke('bogatka-version');if(error)throw error;if(!data?.version||!/\d+\.\d+\.\d+/.test(data.version))throw new Error('Invalid version response.');
  const build=chooseBuild({...data,cachedAt:Date.now()});localStorage.setItem(VERSION_CACHE_KEY,JSON.stringify(build));return build;
}
export async function installVersionAuthority(){
  const initial=chooseBuild(cachedBuild()||FALLBACK_BUILD);applyBuild(initial);await registerVersionedWorker(initial);setTimeout(installVersionedBackup,500);
  try{const build=await resolveRemoteBuild();applyBuild(build);await registerVersionedWorker(build);setTimeout(installVersionedBackup,100);return build}catch(error){console.warn('Automatic version resolution is unavailable; cached version is used.',error);return initial}
}
