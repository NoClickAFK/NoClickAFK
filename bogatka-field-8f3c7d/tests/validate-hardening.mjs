import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('bogatka-field-8f3c7d');
const failures=[];
const read=file=>{
  const full=path.join(root,file);
  if(!fs.existsSync(full)){
    failures.push(`Missing ${file}`);
    return '';
  }
  return fs.readFileSync(full,'utf8');
};
const verify=(file,markers)=>{
  const source=read(file);
  for(const marker of markers)if(source&&!source.includes(marker))failures.push(`${file} missing ${marker}`);
};

verify('sync-runtime-v412.js',['conditionalUpdate','three-way-field-merge-with-revision-checked-location-writes','BogatkaSyncIntegrity']);
verify('sync-state-v412.js',['guardedIdbPut','readBase','writeBase']);
verify('sync-merge-v412.js',['mergeIdArray','deletedTaskIds','preferLocal','transportNormalize','canonical']);
verify('sync-ui-v412.js',['persistLocation','noOpUpdatesAccepted','revisionRebases','coalescedRequests','singleFlightCloudSync','cloudRetrySync']);
verify('sync-field-compat-v416.js',['hydrateRow','transformRemoteRow','installFetchAuthority','terminalFetchAuthorityV416','fetchAuthoritySnapshot','FETCH_AUTHORITY_OWNER','Object.hasOwn','ARCHIVE_FETCH_SCRIPT','archiveFetchReady','archiveFetchSourceRegistered','archiveFetchSourceKind','waitForArchiveFetchReady','waitForStartupSyncReady','archiveFetchBootstrapPersistent','__archiveInclusiveFetchV400']);
verify('archive-state-v436.js',['normalizeArchiveTime','archiveState','inferLegacyRestore','archiveAwareApply','archiveAwarePush','postPassDirtyIds','installDirtyCarry','preserveDirtyAfterPass','confirmDirtyAfterPass','bindRuntimeWrappers','BogatkaArchiveStateV436']);
verify('cloud-archive-v400.js',['delegatedToV436','lateLoadProtected','bogatka:cloud-archive-loaded','__cloudArchiveV400','ensureRuntimeWrappers','fetchDelegated','archiveFetchSource','archiveFetchReady','archiveFetchSourceRegistered','archiveFetchSourceKind','fetchSource','installFetchAuthority','__archiveInclusiveFetchV400']);
verify('cloud-stability-v401.js',['event-driven-sync-with-no-idle-network-loop','hasPendingLocalChanges','eventDrivenPushLocations']);
verify('field-integrity-v416.js',['one-location-one-ordered-save-queue','BogatkaFieldIntegrityV416']);
verify('object-type-normalize-v416.js',['pendingEmptyResets','persistIntentionalEmpty','handleObjectTypeChange']);
verify('location-panels-v419.js',['INSPECTION_HIDE','panel-hidden-v419','reorderChildren','BogatkaLocationPanelsV419']);
verify('location-global-v421.js',['premiseAvailability','landlordReadiness','BogatkaLocationGlobalV421']);
verify('location-card-collapse-v422.js',['STORAGE_PREFIX','setCollapsed','BogatkaLocationCardCollapseV422']);
const collapseCss=read('location-card-collapse-v422.css');
verify('location-card-collapse-v422.css',['repeat(3, 64px) 50px','height: 64px','font-size: 18px !important','background: #edf6f1 !important','border: 1px solid currentColor !important','.location-card-collapsed-v422 > .location-body','border-bottom: 0 !important','.archive-manager-v400']);
if(/^\s*\.comparison-chevron-v332\s*[,{:]/m.test(collapseCss))failures.push('location-card-collapse-v422.css still owns comparison chevron rules');
verify('visual-v411.css',['.comparison-shell-v430','border:2px solid #d8b860!important','.comparison-chevron-v430::before','[data-open="true"]']);
verify('workflow-v414.js',['checklist-guide-v414','structured-notes-v414','history-pagination-v414','BogatkaWorkflowV414']);
verify('members-v32.js',['create_project_invite','update_project_member_role','remove_project_member']);
verify('auth-signup-fix-v31.js',['accept_bogatka_project_invite','bogatkaInviteAcceptancePromise']);
verify('version-authority-v426.js',["functions.invoke('bogatka-version')",'protectLegacyVersionWriters','window.BOGATKA_BUILD','window.BogatkaVersion','registerVersionedWorker','installVersionedBackup',"version:'4.3.6'","versionToken:'436'","sourceCommit:'4f584e01fcf02a99010e36c2a2eaaf97da3db113'"]);
verify('readiness-progress-v434.js',['BogatkaReadinessProgressV434','PHOTO_PLAN','buildProgress','landlordRequirements','conclusionRequirements']);
const versionAuthority=read('version-authority-v426.js');
if(versionAuthority.includes("version:'4.3.5'")||versionAuthority.includes("versionToken:'435'"))failures.push('version-authority-v426.js contains stale v4.3.5 production markers');

const functionPath=path.resolve('supabase/functions/bogatka-version/index.ts');
if(!fs.existsSync(functionPath))failures.push('Missing Supabase version resolver source');
else{
  const source=fs.readFileSync(functionPath,'utf8');
  for(const marker of ['BASE_VERSION = "4.2.5"','d3d86f22ce9d260b07efa8550594038537871e52','compare/${BASE_COMMIT}...main','versionToken','Access-Control-Allow-Origin'])if(!source.includes(marker))failures.push(`Supabase version resolver missing ${marker}`);
}

const sw=read('sw-v340.js');
for(const asset of ['./version-authority-v426.js','./location-card-collapse-v422.js','./location-card-collapse-v422.css','./location-global-v421.js','./report-finalize-v432.js','./report-editorial-core-v433.js','./report-editorial-single-v433.js','./report-editorial-portfolio-v433.js','./report-editorial-style-a-v433.js','./report-editorial-style-b-v433.js','./readiness-progress-v434.js','./archive-state-v436.js'])if(sw&&!sw.includes(`'${asset}'`))failures.push(`Service Worker does not cache ${asset}`);
if(sw&&!sw.includes("searchParams.get('v')"))failures.push('Service Worker does not derive its cache revision from the resolved version token');
if(sw&&!sw.includes("||'436'"))failures.push('Service Worker fallback build token is not v436');

for(const migration of ['supabase/migrations/20260626000200_secure_personal_invites_v408.sql','supabase/migrations/20260626000400_collaboration_controls_and_idempotent_invites_v410.sql','supabase/migrations/20260626000500_sync_integrity_v412.sql','supabase/migrations/20260627000100_remove_location_activity_log_v413.sql'])if(!fs.existsSync(path.resolve(migration)))failures.push(`Missing migration ${migration}`);

if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Bogatka hardening validation passed.');
