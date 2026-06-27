const CACHE_NAME='bogatka-location-v419';
const CORE_ASSETS=[
  './','./index.html','./style.css','./v21.css','./v22.css','./v23.css','./cloud.css','./premium-v30.css','./auth-v31.css','./members-v32.css','./stability-v33.css','./polish-v34.css','./insights-v331.css','./compare-v332.css','./decision-v340.css','./compare-v340.css','./suite-v400.css','./visual-v411.css','./decision-panel-v412.css','./workflow-v414.css','./workflow-fixes-v415.css','./location-profile-v416.css','./location-overview-v417.css','./location-panels-v419.css',
  './supabase-config.js','./config.js','./core.js','./ui-v2.js','./location-v2.js','./report-v2.js','./report-v22.js','./report-v400.js','./v21.js','./v22.js','./v23.js','./cloud.js','./premium-v30.js','./auth-v31.js','./auth-signup-fix-v31.js','./members-v32.js','./invites-v408.js','./stability-v33.js','./stability-v331.js','./polish-v34.js','./account-v34.js','./insights-v331.js','./version-guard-v340.js','./decision-core-v340.js','./suite-core-v400.js','./decision-ui-v340.js','./compare-v340.js','./suite-ui-v400.js','./archive-label-v400.js','./backup-v400.js','./access-version-v400.js','./visual-v411.js','./decision-panel-v412.js','./workflow-v414.js','./workflow-fixes-v415.js','./score-guide-fix-v415.js','./sync-field-compat-v416.js','./field-integrity-v416.js','./object-type-normalize-v416.js','./location-profile-v416.js','./location-overview-v417.js','./location-overview-init-v417.js','./location-panels-v419.js','./location-panels-render-v419.js','./cloud-archive-v400.js','./ui-stability-v402.js','./cloud-stability-v401.js','./sync-merge-v412.js','./sync-state-v412.js','./sync-runtime-v412.js','./sync-ui-v412.js','./select-sync-v407.js','./address-fix-v400.js','./backup-import-v400.js','./viewer-extra-v400.js','./selftest-v400.js','./collaboration-v410.js','./report/index.html','./report/style.css','./report/app.js','./report/fix-v400.js','./reset/index.html','./reset/reset.css','./reset/reset.js','./manifest.webmanifest','./icon.svg'
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
