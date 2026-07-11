import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('bogatka-field-8f3c7d');
const required = [
  'v23.js','decision-core-v340.js','decision-ui-v340.js','decision-v340.css','critical-deal-schema-v430.js','critical-deal-v430.css','compare-v430.js','compare-v340.css',
  'suite-core-v400.js','suite-ui-v400.js','suite-v400.css','archive-label-v400.js','backup-v400.js','cloud-archive-v400.js',
  'address-fix-v400.js','viewer-extra-v400.js','report-v400.js','access-version-v400.js','version-authority-v426.js','selftest-v400.js','auth-signup-fix-v31.js',
  'sync-merge-v412.js','sync-state-v412.js','sync-runtime-v412.js','sync-ui-v412.js','sync-field-compat-v416.js','field-integrity-v416.js','object-type-normalize-v416.js','location-profile-v416.js','location-profile-v416.css',
  'location-panels-v419.js','location-panels-render-v419.js','location-panels-v419.css','location-global-v421.js','location-global-v421.css',
  'location-card-collapse-v422.js','location-card-collapse-v422.css','report-finalize-v431.js','report-finalize-v432.js',
  'report-editorial-core-v433.js','report-editorial-single-v433.js','report-editorial-portfolio-v433.js','report-editorial-style-a-v433.js','report-editorial-style-b-v433.js',
  'readiness-progress-v434.js','docs/report-v433-visual-spec.md','tests/fixtures/report-v433-before-pass.html',
  'reset/index.html','reset/reset.js','sw.js','sw-v340.js','report/index.html','report/app.js','report/style.css','report/fix-v400.js','IMPLEMENTATION-4.0.md',
];
const failures = [];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
for (const file of required) if (!fs.existsSync(path.join(root, file))) failures.push(`Missing required file: ${file}`);
if (!failures.length) {
  const loader = read('v23.js');
  for (const file of ['critical-deal-schema-v430.js','critical-deal-v430.css','decision-core-v340.js','suite-core-v400.js','decision-ui-v340.js','compare-v430.js','suite-ui-v400.js','archive-label-v400.js','backup-v400.js','report-v400.js','access-version-v400.js','sync-field-compat-v416.js','field-integrity-v416.js','object-type-normalize-v416.js','location-profile-v416.js','location-profile-v416.css','location-panels-v419.js','location-panels-render-v419.js','location-panels-v419.css','location-card-collapse-v422.js','location-card-collapse-v422.css','report-finalize-v431.js','report-finalize-v432.js','readiness-progress-v434.js']) {
    if (!loader.includes(file)) failures.push(`v23.js does not load ${file}`);
  }
  if (loader.includes("src:'./compare-v340.js'")) failures.push('v23.js still loads the legacy comparison implementation');
  const backup = read('backup-v400.js');
  for (const file of ['cloud-archive-v400.js','address-fix-v400.js','viewer-extra-v400.js','selftest-v400.js','location-global-v421.js','location-card-collapse-v422.js']) if (!backup.includes(file)) failures.push(`backup-v400.js does not load ${file}`);
  const serviceWorker = read('sw-v340.js');
  for (const file of ['critical-deal-schema-v430.js','critical-deal-v430.css','compare-v430.js','suite-core-v400.js','suite-ui-v400.js','archive-label-v400.js','backup-v400.js','cloud-archive-v400.js','address-fix-v400.js','viewer-extra-v400.js','report-v400.js','selftest-v400.js','sync-merge-v412.js','sync-state-v412.js','sync-runtime-v412.js','sync-ui-v412.js','sync-field-compat-v416.js','field-integrity-v416.js','object-type-normalize-v416.js','location-profile-v416.js','location-profile-v416.css','location-panels-v419.js','location-panels-render-v419.js','location-panels-v419.css','location-global-v421.js','location-global-v421.css','location-card-collapse-v422.js','location-card-collapse-v422.css','version-authority-v426.js','report-finalize-v431.js','report-finalize-v432.js','report-editorial-core-v433.js','report-editorial-single-v433.js','report-editorial-portfolio-v433.js','report-editorial-style-a-v433.js','report-editorial-style-b-v433.js','readiness-progress-v434.js','reset/index.html','reset/reset.js']) if (!serviceWorker.includes(file)) failures.push(`Service Worker does not cache ${file}`);
  if (!serviceWorker.includes("searchParams.get('v')") || !serviceWorker.includes('bogatka-location-v${BUILD_TOKEN}')) failures.push('Service Worker cache name is not derived from the resolved build token');
  if (!serviceWorker.includes("||'435'")) failures.push('Service Worker fallback build token is not v435');
  if (!serviceWorker.includes('updateViaCache') && !read('version-authority-v426.js').includes("updateViaCache:'none'")) failures.push('Service Worker update does not bypass the browser HTTP cache');
  const versionAuthority = read('version-authority-v426.js');
  for (const marker of ["version:'4.3.5'","versionToken:'435'","sourceCommit:'f3b1eb5c1d7d3e8ad78f4632a78a7cca735060a6'","functions.invoke('bogatka-version')",'window.BOGATKA_BUILD','window.BogatkaVersion','upgradeV22Controls','enhancePremiumUi','exportBackup','serviceWorker.register','bogatka_build_meta_v426']) if (!versionAuthority.includes(marker)) failures.push(`version-authority-v426.js is missing ${marker}`);
  if (versionAuthority.includes("version:'4.3.4'") || versionAuthority.includes("versionToken:'434'")) failures.push('version-authority-v426.js still contains stale v4.3.4 production markers');
  const accessVersion = read('access-version-v400.js');
  if (!accessVersion.includes("import('./version-authority-v426.js')") || !accessVersion.includes('installVersionAuthority') || !accessVersion.includes('4.3.5')) failures.push('access-version-v400.js does not activate the centralized 4.3.5 version authority');
  const syncMerge=read('sync-merge-v412.js');
  for(const marker of ['transportNormalize','canonical','transportVersion','NON_SEMANTIC_KEYS'])if(!syncMerge.includes(marker))failures.push(`sync-merge-v412.js is missing ${marker}`);
  const syncUi=read('sync-ui-v412.js');
  for(const marker of ['persistLocation','noOpUpdatesAccepted','revisionRebases','inFlightLocalMerges','coalescedRequests','singleFlightCloudSync','cloudRetrySync'])if(!syncUi.includes(marker))failures.push(`sync-ui-v412.js is missing ${marker}`);
  const readiness = read('readiness-progress-v434.js');
  for (const marker of ['BogatkaReadinessProgressV434','inspectionPurpose','inspectionResult','objectSource','listingUrl','objectSourceOther','Минимальный фотоплан','VALID_DECISIONS','applyMetric']) if (!readiness.includes(marker)) failures.push(`readiness-progress-v434.js is missing ${marker}`);
  if (!readiness.includes('street:2') || !readiness.includes('entrance:2') || !readiness.includes('engineering:2') || !readiness.includes('documents:1')) failures.push('readiness-progress-v434.js does not contain the canonical 13-photo plan');
  const panels = read('location-panels-v419.js');
  for (const marker of ['INSPECTION_HIDE','panel-hidden-v419','bindFallbackField','overviewBoundV417','reorderChildren','aria-expanded','reportChainHas','wrapped.__locationPanelsV419','isEditing']) if (!panels.includes(marker)) failures.push(`location-panels-v419.js is missing ${marker}`);
  if (panels.includes('if(wrapper)wrapper.remove();')) failures.push('location-panels-v419.js removes legacy fields instead of hiding them');
  const panelsCss = read('location-panels-v419.css');
  for (const marker of ['.panel-hidden-v419','grid-auto-rows:max-content','align-self:start!important','border:2px solid #d8b860!important','background:linear-gradient(180deg,#fff8e8,#ffedc0)!important','border-right:2px solid #6a541d!important','.panel-closed-v419 .panel-chevron-v419']) if (!panelsCss.includes(marker)) failures.push(`location-panels-v419.css is missing ${marker}`);
  const globalModule = read('location-global-v421.js');
  for (const marker of ["VERSION='4.2.1'",'premiseAvailability','landlordReadiness','Готовность собственника','panels-both-open-v421','wrapped.__locationGlobalV421','BogatkaLocationGlobalV421','ensureStyle']) if (!globalModule.includes(marker)) failures.push(`location-global-v421.js is missing ${marker}`);
  const globalCss = read('location-global-v421.css');
  for (const marker of ['row-gap:12px!important','gap:6px!important','margin-top:0!important','.panels-both-open-v421','height:100%!important']) if (!globalCss.includes(marker)) failures.push(`location-global-v421.css is missing ${marker}`);
  const collapseModule = read('location-card-collapse-v422.js');
  for (const marker of ["VERSION='4.2.2'",'STORAGE_PREFIX','location-card-collapsed-v422','location-head-side-v422','aria-expanded','BogatkaLocationCardCollapseV422']) if (!collapseModule.includes(marker)) failures.push(`location-card-collapse-v422.js is missing ${marker}`);
  const collapseCss = read('location-card-collapse-v422.css');
  for (const marker of ['grid-template-columns: repeat(3, 64px) 50px','height: 64px','font-size: 18px !important','background: #edf6f1 !important','width: 34px','border: 1px solid currentColor !important','.location-card-collapsed-v422 > .location-body','border-bottom: 0 !important','.archive-manager-v400']) if (!collapseCss.includes(marker)) failures.push(`location-card-collapse-v422.css is missing ${marker}`);
  if (/^\s*\.comparison-chevron-v332\s*[,{:]/m.test(collapseCss)) failures.push('location-card-collapse-v422.css still owns comparison chevron rules');
  const visualCss = read('visual-v411.css');
  for (const marker of ['.comparison-shell-v430','.comparison-chevron-v430::before','[data-open="true"]','.comparison-interaction-ready-v430']) if (!visualCss.includes(marker)) failures.push(`visual-v411.css is missing canonical comparison shell marker: ${marker}`);
  const objectNormalize = read('object-type-normalize-v416.js');
  for (const marker of ['pendingEmptyResets','persistIntentionalEmpty','objectTypeResetPendingV421','handleObjectTypeChange',"version:'4.2.1'"]) if (!objectNormalize.includes(marker)) failures.push(`object-type-normalize-v416.js is missing ${marker}`);
  const renderHook = read('location-panels-render-v419.js');
  for (const marker of ['installRenderHook','scheduleRefresh','refreshAfterRender','__locationPanelsRenderV419','BogatkaLocationPanelsRenderV419']) if (!renderHook.includes(marker)) failures.push(`location-panels-render-v419.js is missing ${marker}`);
  const syncCompat = read('sync-field-compat-v416.js');
  for (const marker of ['hydrateRow','object_type','form.objectType','form.status','wrapFetch','wrapApply']) if (!syncCompat.includes(marker)) failures.push(`sync-field-compat-v416.js is missing ${marker}`);
  const fieldIntegrity = read('field-integrity-v416.js');
  for (const marker of ['queues=new Map','installSaveQueue','stabilizeObjectTypeOptions','one-location-one-ordered-save-queue','BogatkaFieldIntegrityV416']) if (!fieldIntegrity.includes(marker)) failures.push(`field-integrity-v416.js is missing ${marker}`);
  const profile = read('location-profile-v416.js');
  for (const marker of ['FRIENDLY_STREET','objectTypeOther','contactPhone','contactEmail','contactMessenger','rentConditions','contactNotes','enhanceModal','installReportWrapper','audit']) if (!profile.includes(marker)) failures.push(`location-profile-v416.js is missing ${marker}`);
  const schema = read('critical-deal-schema-v430.js');
  for (const marker of ["VERSION='4.3.2'",'criticalDealConditions','leaseAuthority','investmentProtection','thirdPartyRights','documentedLayout','landlordObligations','writtenWorkApproval','petStoreFormatApproval','futureDisruptionPlans','premisesCondition','additionalPayments','in_progress','needs_formalization','oral_agreement','evidenceLabel','evidenceTypes','validateCondition','evaluate','Получите проект договора аренды','Нужно подтвердить письменно']) if (!schema.includes(marker)) failures.push(`critical-deal-schema-v430.js is missing ${marker}`);
  const decisionUi = read('decision-ui-v340.js');
  for (const marker of ['Проверки перед арендой','evidenceLabel','evidenceOptions','Комментарий / что ещё нужно получить','data-collaboration','decision-panel-v412,.decision','data-critical-field','criticalDealConditions','schemaVersion']) if (!decisionUi.includes(marker)) failures.push(`decision-ui-v340.js is missing ${marker}`);
  if (decisionUi.includes('section.open=true')) failures.push('Lease checks are still forced open on page load');
  for (const legacyLabel of ['Критические условия сделки','Основание / что требуется закрепить','Нет проблемы','Есть риск / уточнить','Есть стоп-фактор']) if (decisionUi.includes(legacyLabel)) failures.push(`decision-ui-v340.js contains legacy label: ${legacyLabel}`);
  const criticalCss = read('critical-deal-v430.css');
  for (const marker of ['.critical-deal-v430>summary::-webkit-details-marker','.economy-v400>summary::-webkit-details-marker','.launch-project-v400>summary::-webkit-details-marker','.critical-deal-v430>summary::marker','.economy-v400>summary::marker','.launch-project-v400>summary::marker','.critical-deal-v430>summary::before','.economy-v400>summary::before','.launch-project-v400>summary::before','border-left:8px solid currentColor','justify-self:end!important']) if (!criticalCss.includes(marker)) failures.push(`critical-deal-v430.css is missing ${marker}`);
  if (criticalCss.includes("content:'▶'")||criticalCss.includes('content:"▶"')) failures.push('critical-deal-v430.css still uses a character-based disclosure icon');
  const comparison = read('compare-v430.js');
  for (const marker of ['Перед арендой','dealGate','comparison-shell-v430','dataset.open','comparison-chevron-v430','BogatkaComparisonV430']) if (!comparison.includes(marker)) failures.push(`compare-v430.js is missing ${marker}`);
  if (comparison.includes("document.createElement('details')") || comparison.includes('document.createElement("details")')) failures.push('compare-v430.js still creates native details as the comparison state owner');
  const decision = read('decision-core-v340.js');
  if (!decision.includes("VERSION='4.3.1'")) failures.push('decision-core-v340.js compatibility version is not 4.3.1');
  const weightsMatch = decision.match(/const WEIGHTS=\{([^}]+)\}/);
  if (!weightsMatch) failures.push('Cannot locate weighted score configuration');
  else {const values=[...weightsMatch[1].matchAll(/:\s*(\d+(?:\.\d+)?)/g)].map(match=>Number(match[1]));if(values.reduce((sum,value)=>sum+value,0)!==100)failures.push('Weighted score total is not 100')}
  const suite = read('suite-core-v400.js');
  for (const symbol of ['calculateEconomy','photoPlanFor','findAddressDuplicate','archiveLocation','addComment','addTask','ensureLaunchProject']) if (!suite.includes(symbol)) failures.push(`suite-core-v400.js is missing ${symbol}`);
  const report = read('report-v400.js');
  for (const marker of ['economyHtml','stopHtml','photoPlanHtml','taskHtml','launchHtml','executiveTable']) if (!report.includes(marker)) failures.push(`report-v400.js is missing ${marker}`);
  const reportFix = read('report/fix-v400.js');
  for (const marker of ['BogatkaCriticalDeal','Проверки перед арендой','gate.entries','Перед арендой','evidenceLabel']) if (!reportFix.includes(marker)) failures.push(`Public report fix is missing ${marker}`);
  const reportStability = read('report-stability-v429.js');
  for (const marker of ['Чем подтверждено','Комментарий / что ещё нужно получить']) if (!reportStability.includes(marker)) failures.push(`Local report polish is missing ${marker}`);
  const publicReport = read('report/app.js');
  for (const marker of ['renderComparison','renderEconomy','renderPhotoPlan','renderTasksComments','renderLaunch']) if (!publicReport.includes(marker)) failures.push(`Public report is missing ${marker}`);
  if (!read('report/index.html').includes('../critical-deal-schema-v430.js')) failures.push('Public report does not load the canonical critical-deal schema');
  const signup = read('auth-signup-fix-v31.js');
  const reset = read('reset/reset.js');
  if (!signup.includes('length<12') || !signup.includes('\\p{L}')) failures.push('Signup password policy is weaker than required');
  if (!reset.includes('length<12') || !reset.includes('bogatka_build_meta_v426')) failures.push('Recovery password policy or return URL is outdated');
}
if (failures.length) {console.error('Bogatka validation failed:');failures.forEach(failure=>console.error(`- ${failure}`));process.exit(1)}
console.log('Bogatka file validation passed.');
