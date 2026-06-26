import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('bogatka-field-8f3c7d');
const checks={
  'backup-import-v400.js':['mergeIds','mergeRecord','deletedTaskIds','deletedCommentIds','BogatkaBackupImport'],
  'cloud-archive-v400.js':['archived_at','cloudFetchRemoteWithArchive','cloudPushLocationsWithArchive','BogatkaCloudArchive'],
  'ui-stability-v402.js':['never-reorder-or-rebuild-cards-while-editing','stableUpdateSummary','requestRefresh','BogatkaUIStability'],
  'cloud-stability-v401.js':['event-driven-sync-with-no-idle-network-loop','hasPendingLocalChanges','hasAutomaticWork','eventDrivenPushLocations','eventDrivenPushProjectState','skippedIdleRuns','BogatkaCloudStability'],
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
const sw=fs.readFileSync(path.join(root,'sw-v340.js'),'utf8');
for(const file of Object.keys(checks))if(!sw.includes(file))errors.push(`Service Worker does not cache ${file}`);
if(!sw.includes("CACHE_NAME='bogatka-location-v411'"))errors.push('Service Worker cache version is not v411');
for(const file of ['./invites-v408.js','./collaboration-v410.js','./visual-v411.js','./visual-v411.css'])if(!sw.includes(`'${file}'`))errors.push(`Service Worker does not cache ${file}`);

const auth=fs.readFileSync(path.join(root,'auth-signup-fix-v31.js'),'utf8');
for(const marker of [
  'bogatkaPendingInvite','emailRedirectTo:bogatkaInviteRedirectUrl()','bogatkaClearPendingInvite',
  'invite.email','accept_bogatka_project_invite','p_token:invite.token',"url.searchParams.set('v','410')",
  'bogatkaInviteAcceptancePromise','bogatkaOpenInviteAuth','bogatkaScheduleInviteAuth',"?'login':'signup'",
])if(!auth.includes(marker))errors.push(`auth-signup-fix-v31.js missing ${marker}`);
if(auth.includes('note.innerHTML=`'))errors.push('Invite email must not be inserted into auth HTML');
if(auth.includes('observe(document.documentElement'))errors.push('Auth observer must not watch the whole document');

const members=fs.readFileSync(path.join(root,'members-v32.js'),'utf8');
for(const marker of [
  'create_project_invite','revoke_project_invite','bogatkaInviteLifetime','editor','viewer',
  'Срок действия ссылки','После регистрации доступ сохраняется','Ссылка на вход и регистрацию',
  'сама по себе не выдаёт доступ к проекту','update_project_member_role','remove_project_member',
  'Доступ отключён','invite-status-badge-v410','bogatkaInstallCollaborationRealtime',"?v=410",
])if(!members.includes(marker))errors.push(`members-v32.js missing ${marker}`);
if(members.includes('<option value="owner">'))errors.push('Personal invite UI must not offer owner role');
if(members.includes('<option value="720">'))errors.push('Personal invite UI must not offer a 30-day link lifetime');
if(members.includes('observe(document.body'))errors.push('Members observer must not watch the whole document');

const membersCss=fs.readFileSync(path.join(root,'members-v32.css'),'utf8');
for(const marker of [
  '.application-link-v408','.application-link-button-v409','.invite-lifetime-help-v409',
  '.invite-result-v408','gap:14px','.invite-actions-v408','.invite-result-note-v410',
  '.invite-row-v408','.invite-status-badge-v410','.member-controls-v410','.member-remove-v410',
  '.cloud-account-pill-v410',
])if(!membersCss.includes(marker))errors.push(`members-v32.css missing ${marker}`);

const visualJsPath=path.join(root,'visual-v411.js');
if(!fs.existsSync(visualJsPath))errors.push('Missing visual-v411.js');
else{
  const visualJs=fs.readFileSync(visualJsPath,'utf8');
  for(const marker of ['collaboration-accordion-v411','inviteHistoryToggleV411','grid','MutationObserver','BogatkaVisualPolish',"version:'4.1.1'"])if(!visualJs.includes(marker))errors.push(`visual-v411.js missing ${marker}`);
  if(visualJs.includes('observe(document.body'))errors.push('Visual observer must be scoped to the cloud modal');
}

const visualCssPath=path.join(root,'visual-v411.css');
if(!fs.existsSync(visualCssPath))errors.push('Missing visual-v411.css');
else{
  const visualCss=fs.readFileSync(visualCssPath,'utf8');
  for(const marker of [
    '.collaboration-accordion-panel-v411','grid-template-rows:0fr','grid-template-rows:1fr',
    '.member-role-field-v410 .premium-select-trigger','height:44px!important',
    '.summary-grid-v332 .metric','min-height:66px!important',
    '.comparison-panel-v332','border:2px solid #d8b860!important','overflow:clip!important',
  ])if(!visualCss.includes(marker))errors.push(`visual-v411.css missing ${marker}`);
}

const inviteModule=fs.readFileSync(path.join(root,'invites-v408.js'),'utf8');
for(const marker of ['Пригласить участника','one-email-one-personal-link','bogatka:invite-accepted',"version:'4.1.0'"])if(!inviteModule.includes(marker))errors.push(`invites-v408.js missing ${marker}`);
if(inviteModule.includes('new MutationObserver'))errors.push('Invite toolbar module must not install a global DOM observer');

const loader=fs.readFileSync(path.join(root,'v23.js'),'utf8');
for(const marker of ["src:'./invites-v408.js'","href:'./visual-v411.css'","src:'./visual-v411.js'"])if(!loader.includes(marker))errors.push(`v23.js missing ${marker}`);

const secureMigrationPath=path.resolve('supabase/migrations/20260626000200_secure_personal_invites_v408.sql');
if(!fs.existsSync(secureMigrationPath))errors.push('Missing secure personal invitations migration');
else{
  const migration=fs.readFileSync(secureMigrationPath,'utf8');
  for(const marker of ['accept_bogatka_project_invite','digest(lower(p_token)','drop policy if exists "invited account can join project"','Используйте действующее персональное приглашение'])if(!migration.includes(marker))errors.push(`Invite migration missing ${marker}`);
}

const collaborationMigrationPath=path.resolve('supabase/migrations/20260626000400_collaboration_controls_and_idempotent_invites_v410.sql');
if(!fs.existsSync(collaborationMigrationPath))errors.push('Missing v410 collaboration migration');
else{
  const migration=fs.readFileSync(collaborationMigrationPath,'utf8');
  for(const marker of [
    'v_invite.accepted_by = v_user','return v_invite.project_id','update_project_member_role',
    'remove_project_member','alter publication supabase_realtime add table public.project_members',
    'alter publication supabase_realtime add table public.project_invites',
  ])if(!migration.includes(marker))errors.push(`Collaboration migration missing ${marker}`);
}

const config=fs.readFileSync(path.join(root,'config.js'),'utf8');
if(!config.includes('APP_VERSION = "4.0.0"'))errors.push('config.js APP_VERSION is not 4.0.0');
for(const legacy of ['workflow-v350.js','workflow-v350.css','workflow-report-v350.js']){
  if(fs.existsSync(path.join(root,legacy)))errors.push(`Legacy duplicate still exists: ${legacy}`);
}
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('Bogatka hardening validation passed.');
