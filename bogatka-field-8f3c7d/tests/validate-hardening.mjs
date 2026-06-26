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
if(!sw.includes("CACHE_NAME='bogatka-location-v408'"))errors.push('Service Worker cache version is not v408');
const auth=fs.readFileSync(path.join(root,'auth-signup-fix-v31.js'),'utf8');
for(const marker of ['bogatkaPendingInvite','emailRedirectTo:bogatkaInviteRedirectUrl()','bogatkaClearPendingInvite','invite.email'])if(!auth.includes(marker))errors.push(`auth-signup-fix-v31.js missing ${marker}`);
const members=fs.readFileSync(path.join(root,'members-v32.js'),'utf8');
for(const marker of ['create_project_invite','revoke_project_invite','bogatkaInviteLifetime','editor','viewer'])if(!members.includes(marker))errors.push(`members-v32.js missing ${marker}`);
if(members.includes('<option value="owner">'))errors.push('Personal invite UI must not offer owner role');
const inviteModule=fs.readFileSync(path.join(root,'invites-v408.js'),'utf8');
for(const marker of ['Пригласить участника','one-email-one-personal-link'])if(!inviteModule.includes(marker))errors.push(`invites-v408.js missing ${marker}`);
const loader=fs.readFileSync(path.join(root,'v23.js'),'utf8');
if(!loader.includes("src:'./invites-v408.js'"))errors.push('v23.js does not load invites-v408.js');
const config=fs.readFileSync(path.join(root,'config.js'),'utf8');
if(!config.includes('APP_VERSION = "4.0.0"'))errors.push('config.js APP_VERSION is not 4.0.0');
for(const legacy of ['workflow-v350.js','workflow-v350.css','workflow-report-v350.js']){
  if(fs.existsSync(path.join(root,legacy)))errors.push(`Legacy duplicate still exists: ${legacy}`);
}
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('Bogatka hardening validation passed.');
