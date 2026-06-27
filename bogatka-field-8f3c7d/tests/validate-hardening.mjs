import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('bogatka-field-8f3c7d');
const checks={
  'backup-import-v400.js':['mergeIds','mergeRecord','deletedTaskIds','deletedCommentIds','BogatkaBackupImport'],
  'cloud-archive-v400.js':['archived_at','cloudFetchRemoteWithArchive','cloudPushLocationsWithArchive','BogatkaCloudArchive'],
  'ui-stability-v402.js':['never-reorder-or-rebuild-cards-while-editing','stableUpdateSummary','requestRefresh','BogatkaUIStability'],
  'cloud-stability-v401.js':['event-driven-sync-with-no-idle-network-loop','hasPendingLocalChanges','hasAutomaticWork','eventDrivenPushLocations','eventDrivenPushProjectState','skippedIdleRuns','BogatkaCloudStability'],
  'sync-merge-v412.js':['mergeIdArray','deletedTaskIds','preferLocal',"version:'4.1.2'",'BogatkaSyncMerge'],
  'sync-state-v412.js':['bogatka_cloud_sync_state_v412','guardedIdbPut','readBase','writeBase',"version:'4.1.2'"],
  'sync-runtime-v412.js':['conditionalUpdate',"eq('revision',row.revision)",'three-way-field-merge-with-revision-checked-location-writes','BogatkaSyncIntegrity'],
  'select-sync-v407.js':['hidden-select-and-visible-trigger-always-share-one-value','syncVisibleSelect','syncLocationSelects','BogatkaSelectSync'],
  'address-fix-v400.js':['STOP_WORDS','normalizeAddress','saveLocationFromModalFixed','BogatkaAddressFix'],
  'collaboration-v410.js':['cloud-account-pill-v410','renderAccountPill','BogatkaCollaboration',"version:'4.1.0'"],
  'decision-ui-v340.js':['root.contains(active)','current.every((id,index)=>id===desired[index])','desiredSet'],
};
const errors=[];
for(const [file,markers] of Object.entries(checks)){
  const full=path.join(root,file);
  if(!fs.existsSync(full)){errors.push(`Missing ${file}`);continue;}
  const text=fs.readFileSync(full,'utf8');
  for(const marker of markers)if(!text.includes(marker))errors.push(`${file} missing ${marker}`);
}
const backup=fs.readFileSync(path.join(root,'backup-v400.js'),'utf8');
for(const file of Object.keys(checks).filter(file=>file!=='decision-ui-v340.js'))if(!backup.includes(file))errors.push(`backup-v400.js does not load ${file}`);
if(!backup.includes("'./location-global-v421.js'"))errors.push('backup-v400.js does not load location-global-v421.js');

const sw=fs.readFileSync(path.join(root,'sw-v340.js'),'utf8');
for(const file of Object.keys(checks))if(!sw.includes(file))errors.push(`Service Worker does not cache ${file}`);
if(!sw.includes("CACHE_NAME='bogatka-location-v421'"))errors.push('Service Worker cache version is not v421');
for(const file of ['./invites-v408.js','./collaboration-v410.js','./visual-v411.js','./visual-v411.css','./decision-panel-v412.js','./decision-panel-v412.css','./workflow-v414.js','./workflow-v414.css','./location-panels-v419.js','./location-panels-v419.css','./location-global-v421.js','./location-global-v421.css'])if(!sw.includes(`'${file}'`))errors.push(`Service Worker does not cache ${file}`);

const auth=fs.readFileSync(path.join(root,'auth-signup-fix-v31.js'),'utf8');
for(const marker of ['bogatkaPendingInvite','emailRedirectTo:bogatkaInviteRedirectUrl()','bogatkaClearPendingInvite','invite.email','accept_bogatka_project_invite','p_token:invite.token',"url.searchParams.set('v','410')",'bogatkaInviteAcceptancePromise','bogatkaOpenInviteAuth','bogatkaScheduleInviteAuth',"?'login':'signup'"])if(!auth.includes(marker))errors.push(`auth-signup-fix-v31.js missing ${marker}`);
if(auth.includes('note.innerHTML=`'))errors.push('Invite email must not be inserted into auth HTML');
if(auth.includes('observe(document.documentElement'))errors.push('Auth observer must not watch the whole document');

const members=fs.readFileSync(path.join(root,'members-v32.js'),'utf8');
for(const marker of ['create_project_invite','revoke_project_invite','bogatkaInviteLifetime','editor','viewer','Срок действия ссылки','После регистрации доступ сохраняется','Ссылка на вход и регистрацию','сама по себе не выдаёт доступ к проекту','update_project_member_role','remove_project_member','Доступ отключён','invite-status-badge-v410','bogatkaInstallCollaborationRealtime',"?v=410"])if(!members.includes(marker))errors.push(`members-v32.js missing ${marker}`);
if(members.includes('<option value="owner">'))errors.push('Personal invite UI must not offer owner role');
if(members.includes('<option value="720">'))errors.push('Personal invite UI must not offer a 30-day link lifetime');
if(members.includes('observe(document.body'))errors.push('Members observer must not watch the whole document');

const membersCss=fs.readFileSync(path.join(root,'members-v32.css'),'utf8');
for(const marker of ['.application-link-v408','.application-link-button-v409','.invite-lifetime-help-v409','.invite-result-v408','gap:14px','.invite-actions-v408','.invite-result-note-v410','.invite-row-v408','.invite-status-badge-v410','.member-controls-v410','.member-remove-v410','.cloud-account-pill-v410'])if(!membersCss.includes(marker))errors.push(`members-v32.css missing ${marker}`);

const visualJsPath=path.join(root,'visual-v411.js');
if(!fs.existsSync(visualJsPath))errors.push('Missing visual-v411.js');
else{
  const visualJs=fs.readFileSync(visualJsPath,'utf8');
  for(const marker of ['collaboration-accordion-v411','inviteHistoryToggleV411','MutationObserver','BogatkaVisualPolish',"version:'4.1.1'"])if(!visualJs.includes(marker))errors.push(`visual-v411.js missing ${marker}`);
  if(visualJs.includes('observe(document.body'))errors.push('Visual observer must be scoped to the cloud modal');
}

const visualCssPath=path.join(root,'visual-v411.css');
if(!fs.existsSync(visualCssPath))errors.push('Missing visual-v411.css');
else{
  const visualCss=fs.readFileSync(visualCssPath,'utf8');
  for(const marker of ['.collaboration-accordion-panel-v411','grid-template-rows:0fr','grid-template-rows:1fr','.member-role-field-v410 .premium-select-trigger','height:44px!important','.summary-grid-v332 .metric','min-height:66px!important','.comparison-panel-v332','border:2px solid #d8b860!important','overflow:clip!important'])if(!visualCss.includes(marker))errors.push(`visual-v411.css missing ${marker}`);
}

const decisionPanelJs=fs.readFileSync(path.join(root,'decision-panel-v412.js'),'utf8');
for(const marker of ['Предварительное решение по локации','decision-actions-v412','Под вопросом','BogatkaDecisionPanel',"version:'4.1.2'"])if(!decisionPanelJs.includes(marker))errors.push(`decision-panel-v412.js missing ${marker}`);
const decisionPanelCss=fs.readFileSync(path.join(root,'decision-panel-v412.css'),'utf8');
for(const marker of ['.decision.decision-panel-v412','.decision-actions-v412','grid-template-columns:minmax(280px,1fr) auto'])if(!decisionPanelCss.includes(marker))errors.push(`decision-panel-v412.css missing ${marker}`);

const workflowJsPath=path.join(root,'workflow-v414.js');
if(!fs.existsSync(workflowJsPath))errors.push('Missing workflow-v414.js');
else{
  const workflowJs=fs.readFileSync(workflowJsPath,'utf8');
  for(const marker of ["VERSION='4.1.4'",'Сравнительная оценка локации — 70 баллов','checklist-guide-v414','structured-notes-v414','task-examples-v414','HISTORY_PAGE_SIZE=10','history-pagination-v414','moveEconomyAndLaunch','project_members','BogatkaWorkflowV414'])if(!workflowJs.includes(marker))errors.push(`workflow-v414.js missing ${marker}`);
  if(workflowJs.includes('observer.observe(document.body'))errors.push('Workflow observer must be scoped to locations');
}
const workflowCssPath=path.join(root,'workflow-v414.css');
if(!fs.existsSync(workflowCssPath))errors.push('Missing workflow-v414.css');
else{
  const workflowCss=fs.readFileSync(workflowCssPath,'utf8');
  for(const marker of ['.score-label-v414','.structured-notes-v414','.task-field-v414','.history-pagination-v414','.premium-select-option.selected'])if(!workflowCss.includes(marker))errors.push(`workflow-v414.css missing ${marker}`);
}

const panelsJsPath=path.join(root,'location-panels-v419.js');
if(!fs.existsSync(panelsJsPath))errors.push('Missing location-panels-v419.js');
else{
  const panelsJs=fs.readFileSync(panelsJsPath,'utf8');
  for(const marker of ["VERSION='4.2.1'",'INSPECTION_HIDE','premiseAvailability','landlordReadiness','panel-hidden-v419','bindFallbackField','overviewBoundV417','reorderChildren','aria-expanded','BogatkaLocationPanelsV419'])if(!panelsJs.includes(marker))errors.push(`location-panels-v419.js missing ${marker}`);
  if(panelsJs.includes('if(wrapper)wrapper.remove();'))errors.push('Location panel must hide compatibility fields instead of removing them');
}
const panelsCssPath=path.join(root,'location-panels-v419.css');
if(!fs.existsSync(panelsCssPath))errors.push('Missing location-panels-v419.css');
else{
  const panelsCss=fs.readFileSync(panelsCssPath,'utf8');
  for(const marker of ['.panel-hidden-v419','grid-auto-rows:max-content','align-self:start!important','border:2px solid #d8b860!important','background:linear-gradient(180deg,#fff8e8,#ffedc0)!important','.panel-closed-v419 .panel-chevron-v419'])if(!panelsCss.includes(marker))errors.push(`location-panels-v419.css missing ${marker}`);
}

const globalJsPath=path.join(root,'location-global-v421.js');
if(!fs.existsSync(globalJsPath))errors.push('Missing location-global-v421.js');
else{
  const globalJs=fs.readFileSync(globalJsPath,'utf8');
  for(const marker of ["VERSION='4.2.1'",'premiseAvailability','landlordReadiness','Готовность собственника','panels-both-open-v421','BogatkaLocationGlobalV421','wrapped.__locationGlobalV421'])if(!globalJs.includes(marker))errors.push(`location-global-v421.js missing ${marker}`);
}
const globalCssPath=path.join(root,'location-global-v421.css');
if(!fs.existsSync(globalCssPath))errors.push('Missing location-global-v421.css');
else{
  const globalCss=fs.readFileSync(globalCssPath,'utf8');
  for(const marker of ['gap:6px!important','margin-top:0!important','.panels-both-open-v421','align-self:stretch!important','height:100%!important'])if(!globalCss.includes(marker))errors.push(`location-global-v421.css missing ${marker}`);
}

const objectNormalizePath=path.join(root,'object-type-normalize-v416.js');
if(!fs.existsSync(objectNormalizePath))errors.push('Missing object-type-normalize-v416.js');
else{
  const objectNormalize=fs.readFileSync(objectNormalizePath,'utf8');
  for(const marker of ['pendingEmptyResets','persistIntentionalEmpty','objectTypeResetPendingV421','handleObjectTypeChange',"version:'4.2.1'"])if(!objectNormalize.includes(marker))errors.push(`object-type-normalize-v416.js missing ${marker}`);
}

const inviteModule=fs.readFileSync(path.join(root,'invites-v408.js'),'utf8');
for(const marker of ['Пригласить участника','one-email-one-personal-link','bogatka:invite-accepted',"version:'4.1.0'"])if(!inviteModule.includes(marker))errors.push(`invites-v408.js missing ${marker}`);
if(inviteModule.includes('new MutationObserver'))errors.push('Invite toolbar module must not install a global DOM observer');

const loader=fs.readFileSync(path.join(root,'v23.js'),'utf8');
for(const marker of ["src:'./invites-v408.js'","href:'./visual-v411.css'","src:'./visual-v411.js'","href:'./decision-panel-v412.css'","src:'./decision-panel-v412.js'","href:'./workflow-v414.css'","src:'./workflow-v414.js'","href:'./location-panels-v419.css'","src:'./location-panels-v419.js'"])if(!loader.includes(marker))errors.push(`v23.js missing ${marker}`);
for(const marker of ["'./sync-merge-v412.js'","'./sync-state-v412.js'","'./sync-runtime-v412.js'","'./location-global-v421.js'"])if(!backup.includes(marker))errors.push(`backup-v400.js missing ${marker}`);

for(const migrationPath of [
  'supabase/migrations/20260626000200_secure_personal_invites_v408.sql',
  'supabase/migrations/20260626000400_collaboration_controls_and_idempotent_invites_v410.sql',
  'supabase/migrations/20260626000500_sync_integrity_v412.sql',
  'supabase/migrations/20260627000100_remove_location_activity_log_v413.sql',
])if(!fs.existsSync(path.resolve(migrationPath)))errors.push(`Missing migration ${migrationPath}`);

const config=fs.readFileSync(path.join(root,'config.js'),'utf8');
if(!config.includes('APP_VERSION = "4.0.0"'))errors.push('config.js APP_VERSION is not 4.0.0');
for(const legacy of ['workflow-v350.js','workflow-v350.css','workflow-report-v350.js'])if(fs.existsSync(path.join(root,legacy)))errors.push(`Legacy duplicate still exists: ${legacy}`);

if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('Bogatka hardening validation passed.');
