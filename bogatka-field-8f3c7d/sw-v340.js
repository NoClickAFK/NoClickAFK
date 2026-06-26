const CACHE_NAME='bogatka-location-v403';
const CORE_ASSETS=[
  './','./index.html','./style.css','./v21.css','./v22.css','./v23.css','./cloud.css','./premium-v30.css','./auth-v31.css','./members-v32.css','./stability-v33.css','./polish-v34.css','./insights-v331.css','./compare-v332.css','./decision-v340.css','./compare-v340.css','./suite-v400.css',
  './supabase-config.js','./config.js','./core.js','./ui-v2.js','./location-v2.js','./report-v2.js','./report-v22.js','./report-v400.js','./v21.js','./v22.js','./v23.js','./cloud.js','./premium-v30.js','./auth-v31.js','./auth-signup-fix-v31.js','./members-v32.js','./stability-v33.js','./stability-v331.js','./polish-v34.js','./account-v34.js','./insights-v331.js','./version-guard-v340.js','./decision-core-v340.js','./suite-core-v400.js','./decision-ui-v340.js','./compare-v340.js','./suite-ui-v400.js','./archive-label-v400.js','./backup-v400.js','./cloud-archive-v400.js','./address-fix-v400.js','./backup-import-v400.js','./access-version-v400.js','./viewer-extra-v400.js','./selftest-v400.js','./report/index.html','./report/style.css','./report/app.js','./report/fix-v400.js','./reset/index.html','./reset/reset.css','./reset/reset.js','./manifest.webmanifest','./icon.svg'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(CORE_ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(fetch(event.request).then(response=>{
    const copy=response.clone();
    caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy)).catch(()=>{});
    return response;
  }).catch(()=>caches.match(event.request).then(response=>response||caches.match('./index.html'))));
});
