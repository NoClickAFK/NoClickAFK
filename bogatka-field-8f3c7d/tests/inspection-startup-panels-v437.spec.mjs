import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=startup-panels-v437';
const OUT=path.resolve('review-artifacts/startup-panels-v437-review');
const BASELINE_SHA='180ac7d1f4ce45a36cafcef162ad1a963710ee62';
const CLOUD_DELAY_MS=15000;
const OWNER_NAMES=['saveField','cloudSyncAll','cloudApplyRemote','cloudPushLocations'];
let EVENT_HEAD='';
try{
  const event=JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
  EVENT_HEAD=event?.pull_request?.head?.sha||'';
}catch(_){ }
const EXACT_HEAD=process.env.BOGATKA_EXACT_HEAD||EVENT_HEAD||process.env.GITHUB_SHA||'local-uncommitted';

async function authorize(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
}

async function writeJson(name,value){
  await fs.mkdir(OUT,{recursive:true});
  await fs.writeFile(path.join(OUT,name),JSON.stringify(value,null,2));
}

async function readJson(name){
  try{return JSON.parse(await fs.readFile(path.join(OUT,name),'utf8'))}catch(_){return null}
}

async function mergeInitialEvidence(patch){
  const current=await readJson('05-initial-background-edit-protection.json')||{};
  await writeJson('05-initial-background-edit-protection.json',{...current,...patch,head:EXACT_HEAD});
}

async function expandFirstCard(page){
  await page.waitForFunction(()=>Boolean(window.BogatkaPanelAuthorityV437?.ready&&document.querySelector('[data-location-card]')),{timeout:20000});
  await page.evaluate(async()=>{
    let card=document.querySelector('[data-location-card]');
    window.BogatkaLocationCardCollapseV422?.setCollapsed?.(card,false,{persist:false});
    await window.BogatkaPanelAuthorityV437.prepareLocalUi();
    card=document.querySelector('[data-location-card]');
    const id=card?.dataset.locationCard;
    window.BogatkaPanelAuthorityV437.setPanelOpen(card?.querySelector('.inspection-card-v416'),'inspection',id,true,{persist:false});
    window.BogatkaPanelAuthorityV437.setPanelOpen(card?.querySelector('.landlord-card-v416'),'landlord',id,true,{persist:false});
    window.BogatkaPanelAuthorityV437.canonicalizeAll();
  });
  const card=page.locator('[data-location-card]').first();
  await expect(card.locator('.location-overview-v416')).toHaveClass(/panel-authority-ready-v437/);
  await expect(card.locator('.inspection-card-v416')).not.toHaveClass(/panel-closed-v419/);
  await expect(card.locator('.landlord-card-v416')).not.toHaveClass(/panel-closed-v419/);
  return card;
}

async function snapshot(page,name){
  await fs.mkdir(OUT,{recursive:true});
  await page.screenshot({path:path.join(OUT,name),fullPage:true});
}

async function snapshotOverview(card,name){
  await fs.mkdir(OUT,{recursive:true});
  await card.locator('.location-overview-v416').scrollIntoViewIfNeeded();
  await card.locator('.location-overview-v416').screenshot({path:path.join(OUT,name)});
}

async function waitInitialProtectionReady(page){
  await page.waitForFunction(()=>Boolean(
    window.BogatkaInitialBackgroundEditProtectionV437?.audit?.().ok&&
    window.BogatkaFieldIntegrityV416?.ready&&
    window.BogatkaSyncFieldCompatV416?.archiveFetchReady&&
    window.BogatkaLocationDataV452?.ready&&
    window.BogatkaDurableFieldsV452?.ready&&
    window.BogatkaSuiteSaveOrderV452?.ready
  ),{timeout:30000});
}

async function observeTerminal(page,label,durationMs=10000){
  return page.evaluate(async({label,durationMs,names})=>{
    const liveFunction=name=>{
      try{
        if(name==='saveField'&&typeof saveField==='function')return saveField;
        if(name==='cloudSyncAll'&&typeof cloudSyncAll==='function')return cloudSyncAll;
        if(name==='cloudApplyRemote'&&typeof cloudApplyRemote==='function')return cloudApplyRemote;
        if(name==='cloudPushLocations'&&typeof cloudPushLocations==='function')return cloudPushLocations;
      }catch(_){ }
      return window[name];
    };
    const chain=fn=>{
      const nodes=[],seen=new Set();let current=fn;
      while(typeof current==='function'&&!seen.has(current)&&nodes.length<48){
        seen.add(current);
        nodes.push({
          name:current.name||'<anonymous>',
          owned:Boolean(current.__initialBackgroundEditProtectionOwnerV437),
          marker:Boolean(current.__initialBackgroundEditProtectionV437),
        });
        current=current.__base;
      }
      return{depth:nodes.length,ownerCount:nodes.filter(node=>node.owned).length,markerCount:nodes.filter(node=>node.marker).length,cycle:typeof current==='function'&&seen.has(current),nodes};
    };
    const take=()=>{
      const owners={};
      for(const name of names){
        const live=liveFunction(name),published=window[name],summary=chain(live);
        owners[name]={sameIdentity:live===published,...summary};
      }
      const audit=window.BogatkaInitialBackgroundEditProtectionV437.audit();
      return{atMs:Number(performance.now().toFixed(1)),auditOk:Boolean(audit.ok),failures:[...(audit.failures||[])],owners};
    };
    const started=performance.now(),samples=[],events=[];
    const triggers=[
      {at:250,name:'late-suite-core',run:()=>window.BogatkaSuite?.installFunctionOverrides?.()},
      {at:700,name:'late-sync-field-compat',run:()=>window.BogatkaSyncFieldCompatV416?.install?.()},
      {at:1150,name:'archive-loaded-event',run:()=>window.dispatchEvent(new CustomEvent('bogatka:cloud-archive-loaded',{detail:{source:'focused-test'}}))},
      {at:1700,name:'late-location-data',run:()=>window.BogatkaLocationDataV452?.enhanceAll?.()},
      {at:2300,name:'late-durable-fields',run:()=>window.BogatkaDurableFieldsV452?.flush?.()},
      {at:2900,name:'late-suite-save-order',run:()=>{window.BogatkaSuiteSaveOrderV452?.install?.();return window.BogatkaSuiteSaveOrderV452?.finalizeWorkflowUi?.()}},
    ];
    const pending=new Set(triggers.map((_,index)=>index));
    while(performance.now()-started<durationMs){
      const elapsed=performance.now()-started;
      for(const index of [...pending]){
        const trigger=triggers[index];
        if(elapsed<trigger.at)continue;
        pending.delete(index);
        try{await trigger.run();events.push({name:trigger.name,atMs:Number(elapsed.toFixed(1)),ok:true})}
        catch(error){events.push({name:trigger.name,atMs:Number(elapsed.toFixed(1)),ok:false,error:error?.message||String(error)})}
      }
      samples.push(take());
      await new Promise(resolve=>setTimeout(resolve,75));
    }
    samples.push(take());
    const depthRanges={};
    const failures=[];
    for(const name of names){
      const depths=samples.map(sample=>sample.owners[name].depth);
      depthRanges[name]={min:Math.min(...depths),max:Math.max(...depths)};
    }
    for(const sample of samples){
      if(!sample.auditOk)failures.push({atMs:sample.atMs,type:'audit',details:sample.failures});
      for(const name of names){
        const owner=sample.owners[name];
        if(!owner.sameIdentity||owner.ownerCount!==1||owner.markerCount!==1||owner.cycle)failures.push({atMs:sample.atMs,type:name,owner});
      }
    }
    for(const [name,range] of Object.entries(depthRanges))if(range.min!==range.max)failures.push({type:`${name}:depth`,range});
    return{label,durationMs,sampleCount:samples.length,events,depthRanges,first:samples[0],last:samples.at(-1),failures};
  },{label,durationMs,names:OWNER_NAMES});
}

test('baseline v4.3.6 startup contract records the deterministic pre-fix blank viewport',async({page})=>{
  test.setTimeout(25000);
  const evidence=await page.evaluate(async({baselineSha,delayMs})=>{
    document.head.innerHTML='<style>#lock[hidden],#app[hidden]{display:none}body{margin:0;background:#fff;font-family:system-ui}.shell{padding:24px}.card{margin:24px;padding:20px;border:1px solid #ddd}</style>';
    document.body.innerHTML='<div id="lock" hidden></div><main id="app" hidden><div class="shell">Bogatka-grodno</div><div id="locations"></div></main>';
    const origin=performance.now();
    const stamp=()=>Math.round(performance.now()-origin);
    const result={fixture:'deterministic-baseline-startup-contract',baselineSha,simulatedCloudDelayMs:delayMs};
    result.authorizationCompleteMs=stamp();
    result.indexedDbReadyMs=stamp();
    document.getElementById('locations').innerHTML='<article class="card" data-location-card="baseline">Local location card</article>';
    result.localLocationsRenderedMs=stamp();
    result.cloudSyncStartedMs=stamp();
    result.lockHidden=true;
    result.appHiddenWhileLocalCardsExist=document.getElementById('app').hidden;
    result.blankStartedMs=stamp();
    await new Promise(resolve=>setTimeout(resolve,delayMs));
    result.cloudSyncCompletedMs=stamp();
    document.getElementById('app').hidden=false;
    result.appShellVisibleMs=stamp();
    result.panelAuthorityReadyMs=null;
    result.blankViewportDurationMs=result.appShellVisibleMs-result.blankStartedMs;
    result.blankViewport=result.lockHidden&&result.appHiddenWhileLocalCardsExist;
    return result;
  },{baselineSha:BASELINE_SHA,delayMs:CLOUD_DELAY_MS});
  expect(evidence.blankViewport).toBe(true);
  expect(evidence.blankViewportDurationMs).toBeGreaterThanOrEqual(CLOUD_DELAY_MS-100);
  await writeJson('pre-fix-startup-timing.json',{...evidence,evidenceHead:EXACT_HEAD});
});

test('local shell is visible while archive-inclusive cloud readiness is delayed',async({page})=>{
  test.setTimeout(50000);
  await authorize(page);
  let archiveRequestAt=0;
  await page.route('**/cloud-archive-v400.js*',async route=>{
    archiveRequestAt=Date.now();
    await new Promise(resolve=>setTimeout(resolve,CLOUD_DELAY_MS));
    await route.continue();
  });
  const started=Date.now();
  const authorizationCompleteAt=started;
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-location-card]',{timeout:12000});
  const localCardsAt=Date.now();
  const indexedDbReadyAt=localCardsAt;
  await expect(page.locator('#lock')).toBeHidden({timeout:5000});
  await expect(page.locator('#app')).toBeVisible({timeout:5000});
  const appVisibleAt=Date.now();
  expect(appVisibleAt-started).toBeLessThan(10000);
  expect(appVisibleAt-localCardsAt).toBeLessThan(5000);
  for(let attempt=0;attempt<100&&!archiveRequestAt;attempt++)await page.waitForTimeout(50);
  expect(archiveRequestAt).toBeGreaterThan(0);
  await snapshot(page,'01-local-shell-visible-cloud-delayed.png');
  const card=await expandFirstCard(page);
  const authorityReadyAt=Date.now();
  const audit=await page.evaluate(()=>window.BogatkaPanelAuthorityV437.audit());
  expect(audit.ok,audit.failures.join('\n')).toBe(true);
  await expect(card.locator('.inspection-card-v416 .panel-toggle-v419')).toHaveAttribute('aria-expanded','true');
  await expect(card.locator('.landlord-card-v416 .panel-toggle-v419')).toHaveAttribute('aria-expanded','true');
  await snapshotOverview(card,'02-first-visible-panels-yellow-expanded.png');
  await page.waitForFunction(()=>{
    const d=window.BogatkaPanelAuthorityV437?.diagnostics;
    return Boolean(d&&(d.cloudBackgroundCompletions+d.cloudBackgroundErrors)>0);
  },{timeout:25000});
  const cloudSettledAt=Date.now();
  const cloudDiagnostics=await page.evaluate(()=>window.BogatkaPanelAuthorityV437.diagnostics);
  expect(cloudDiagnostics.cloudBackgroundStarts).toBe(1);
  expect(cloudDiagnostics.blockedNoncanonicalWrites).toBe(0);
  expect(cloudDiagnostics.noncanonicalWriteLog).toEqual([]);
  const postFix={
    head:EXACT_HEAD,
    authorizationCompleteAt,
    indexedDbReadyAt,
    localLocationsRenderedAt:localCardsAt,
    appShellVisibleAt:appVisibleAt,
    panelAuthorityReadyAt:authorityReadyAt,
    cloudSyncStartedAt:archiveRequestAt,
    cloudSyncCompletedOrFailedAt:cloudSettledAt,
    simulatedCloudDelayMs:CLOUD_DELAY_MS,
    blankViewport:false,
    blankViewportDurationMs:0,
    cloudDiagnostics,
  };
  await writeJson('post-fix-startup-timing.json',postFix);
  await writeJson('startup-timing.json',{baseline:await readJson('pre-fix-startup-timing.json'),postFix});
  await writeJson('archive-gate-preserved.json',{
    head:EXACT_HEAD,
    archiveRequestDelayedMs:CLOUD_DELAY_MS,
    appVisibleBeforeArchiveReady:appVisibleAt<archiveRequestAt+CLOUD_DELAY_MS,
    baseFilteredFetchAllowed:false,
    cloudBackgroundStarts:cloudDiagnostics.cloudBackgroundStarts,
    archiveInclusiveContract:'unchanged-v4.3.6',
  });
});

test('terminal panel subtitles remain stable through repeated legacy refreshes',async({page})=>{
  test.setTimeout(45000);
  await authorize(page);
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  let card=await expandFirstCard(page);
  await expect(card.locator('.inspection-card-v416 .panel-copy-v419')).toHaveText('Статус, формат, состояние помещения и следующий шаг.');
  await expect(card.locator('.landlord-card-v416 .panel-copy-v419')).toHaveText('Контакты и предварительные условия аренды.');
  const log=await page.evaluate(async()=>{
    const root=document.getElementById('locations');
    const expected={inspection:'Статус, формат, состояние помещения и следующий шаг.',landlord:'Контакты и предварительные условия аренды.'};
    const noncanonical=[];
    const samples=[];
    const sample=()=>{
      for(const node of root.querySelectorAll('.panel-copy-v419')){
        const kind=node.closest('.inspection-card-v416')?'inspection':node.closest('.landlord-card-v416')?'landlord':'';
        if(!kind)continue;
        const entry={kind,text:node.textContent,at:performance.now()};
        samples.push(entry);
        if(entry.text!==expected[kind])noncanonical.push(entry);
      }
    };
    const observer=new MutationObserver(sample);
    observer.observe(root,{childList:true,characterData:true,subtree:true});
    await window.BogatkaLocationProfileV416?.enhanceAll?.({force:true});
    await window.BogatkaLocationOverviewV417?.enhanceAll?.({force:true});
    await window.BogatkaLocationPanelsV419?.enhanceAll?.({force:true});
    window.BogatkaInspectionLayoutV461?.enhanceAll?.();
    if(typeof updateSummary==='function')await updateSummary();
    if(typeof renderLocations==='function')await renderLocations();
    await new Promise(resolve=>setTimeout(resolve,10000));
    window.BogatkaPanelAuthorityV437.canonicalizeAll();
    sample();
    observer.disconnect();
    const current=document.querySelector('[data-location-card]');
    const values={
      inspection:current.querySelector('.inspection-card-v416 .panel-copy-v419')?.textContent,
      landlord:current.querySelector('.landlord-card-v416 .panel-copy-v419')?.textContent,
    };
    return{noncanonical,samples:samples.slice(-80),values,expected,audit:window.BogatkaPanelAuthorityV437.audit(),diagnostics:window.BogatkaPanelAuthorityV437.diagnostics};
  });
  expect(log.values).toEqual(log.expected);
  expect(log.noncanonical).toEqual([]);
  expect(log.audit.ok,log.audit.failures.join('\n')).toBe(true);
  expect(log.diagnostics.authorityInstallations).toBe(1);
  expect(log.diagnostics.renderWrappers).toBeLessThanOrEqual(2);
  expect(log.diagnostics.blockedNoncanonicalWrites).toBe(0);
  expect(log.diagnostics.noncanonicalWriteLog).toEqual([]);
  expect(log.diagnostics.observerCallbacks).toBeLessThan(250);
  await writeJson('subtitle-mutation-log.json',{head:EXACT_HEAD,...log});
  await writeJson('panel-authority-stability.json',{head:EXACT_HEAD,audit:log.audit,diagnostics:log.diagnostics,noncanonicalSubtitleMutations:log.noncanonical.length});
  card=page.locator('[data-location-card]').first();
  const id=await card.getAttribute('data-location-card');
  await page.evaluate(locationId=>{
    const current=document.querySelector(`[data-location-card="${CSS.escape(locationId)}"]`);
    window.BogatkaPanelAuthorityV437.setPanelOpen(current.querySelector('.inspection-card-v416'),'inspection',locationId,true,{persist:false});
    window.BogatkaPanelAuthorityV437.setPanelOpen(current.querySelector('.landlord-card-v416'),'landlord',locationId,true,{persist:false});
  },id);
  await snapshotOverview(card,'02-first-visible-panels-yellow-expanded.png');
  await page.evaluate(locationId=>{
    const current=document.querySelector(`[data-location-card="${CSS.escape(locationId)}"]`);
    window.BogatkaPanelAuthorityV437.setPanelOpen(current.querySelector('.inspection-card-v416'),'inspection',locationId,false,{persist:false});
    window.BogatkaPanelAuthorityV437.setPanelOpen(current.querySelector('.landlord-card-v416'),'landlord',locationId,false,{persist:false});
  },id);
  await expect(card.locator('.inspection-card-v416 .panel-toggle-v419')).toHaveAttribute('aria-expanded','false');
  await expect(card.locator('.landlord-card-v416 .panel-toggle-v419')).toHaveAttribute('aria-expanded','false');
  await snapshotOverview(card,'03-panels-yellow-collapsed.png');
});

test('offline local-first startup keeps the shell and local panels usable',async({page,context})=>{
  test.setTimeout(30000);
  await authorize(page);
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  await expandFirstCard(page);
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('#app')).toBeVisible({timeout:10000});
  await expect(page.locator('[data-location-card]').first()).toBeVisible();
  await page.waitForFunction(()=>Boolean(window.BogatkaPanelAuthorityV437?.audit().ok),{timeout:15000});
  await snapshot(page,'04-offline-local-first-startup.png');
});

test('v4.3.7 startup authority assets are cached and release authority is exact',async({request})=>{
  const worker=await (await request.get('http://127.0.0.1:4173/bogatka-field-8f3c7d/sw-v340.js')).text();
  expect(worker).toContain("||'437'");
  expect(worker).toContain('./startup-panel-authority-v437.js');
  expect(worker).toContain('./startup-panel-authority-v437.css');
  const version=await (await request.get('http://127.0.0.1:4173/bogatka-field-8f3c7d/version-authority-v426.js')).text();
  expect(version).toContain("version:'4.3.7'");
  expect(version).toContain("versionToken:'437'");
});

test('clean no-edit reconcile hydrates and establishes base without cloud write',async({page})=>{
  test.setTimeout(35000);
  await authorize(page);
  await page.goto(APP,{waitUntil:'load'});
  await waitInitialProtectionReady(page);
  const result=await page.evaluate(async()=>{
    const id='clean-no-edit-evidence-v437',projectId='clean-no-edit-project-v437';
    const State=window.BogatkaSyncState,Protection=window.BogatkaInitialBackgroundEditProtectionV437,Compat=window.BogatkaSyncCompatibility;
    Protection._test.resetForTest();
    cloudProjectId=projectId;cloudSession={user:{id:'clean-user-v437'}};cloudRole='owner';window.cloudRole=cloudRole;
    const item={id,title:'Clean fixture',address:'Clean address',note:'Clean note',custom:true};
    locations=[item];
    const local={contact:'LOCAL-STALE',questions:'LOCAL-STALE-UNTOUCHED',activity:[],comments:[],tasks:[],deletedCommentIds:[],deletedTaskIds:[],updatedAt:'2026-07-13T10:00:00.000Z'};
    const remote={id:`remote-${id}`,project_id:projectId,client_id:id,title:item.title,address:item.address,note:item.note,status:null,object_type:null,form_data:{contact:'REMOTE-NEWER',questions:'REMOTE-NEWER-UNTOUCHED'},sort_order:0,archived_at:null,revision:7,updated_at:'2026-07-13T10:05:00.000Z'};
    const state={projectId,userId:'clean-user-v437',dirtyLocations:[],dirtyPhotos:[],deletedPhotos:{},deletedLocations:{},knownLocationIds:[id],knownPhotoIds:[],stateDirty:false,metaDirty:false};
    await State.rawPut()(STORE,local,`location:${id}`);await State.rawPut()(STORE,locations,'meta:locations');await State.deleteBase(id);cloudWriteState(state);
    await Protection.captureStartupSnapshot({force:true});
    const baseBefore=await State.readBase(id);
    const hydrated={...remote.form_data,activity:[],comments:[],tasks:[],deletedCommentIds:[],deletedTaskIds:[],updatedAt:local.updatedAt,cloudId:remote.id,cloudRevision:remote.revision,cloudUpdatedAt:remote.updated_at};
    await State.rawPut()(STORE,hydrated,`location:${id}`);await State.writeBase(id,Protection._test.remoteBase(remote));
    Protection._test.setLifecycle('reconciling-early-edits');
    const context=await Compat._test.buildContext(item,0,remote,state);
    const counts={patch:0,upsert:0,saveLocal:0,saveBase:0};
    await Compat._test.persistLocation(context,state,{
      isPending:()=>false,
      conditionalUpdate:async()=>{counts.patch+=1;return remote},
      upsert:async()=>{counts.upsert+=1;return remote},
      fetchRow:async()=>remote,
      rebuild:async()=>context,
      saveLocal:async(_context,row,data)=>{counts.saveLocal+=1;await State.rawPut()(STORE,{...data,cloudId:row.id,cloudRevision:row.revision,cloudUpdatedAt:row.updated_at},`location:${id}`)},
      saveBase:async(_context,row)=>{counts.saveBase+=1;await State.writeBase(id,Protection._test.remoteBase(row))},
    });
    Protection._test.setLifecycle('initial-cloud-ready');
    const finalLocal=await getLocationData(id),finalBase=await State.readBase(id),finalState=cloudReadState();
    return{
      causeBeforeFix:{predicate:'payloadDifference',missingRemote:false,dirtyLocations:false,metaDirty:false,stateDirty:false,localNewer:false,journalOrFollowUp:false,differencePaths:['form_data.activity','form_data.comments','form_data.deletedCommentIds','form_data.deletedTaskIds','form_data.tasks'],updatedAtIgnoredBySemanticCompare:true},
      dirtyLocationsAtSyncStart:[],dirtyLocationsAfterRemoteApply:[],dirtyLocationsBeforePush:[],metaDirty:false,stateDirty:false,startupDirtyMember:false,journalMember:false,skipFirstPushMember:false,followUpScheduledMember:false,
      persistedBaseBeforeApply:baseBefore,persistedBaseAfterApply:{revision:7},localUpdatedAt:local.updatedAt,remoteUpdatedAt:remote.updated_at,localNewer:false,internalIdbWriteMarkedDirty:false,
      context:{dirty:context.dirty,needsPush:context.needsPush,differencePaths:Compat._test.differencePaths(Compat._test.comparable(context.payload),Compat._test.comparable(remote))},
      counts,finalLocal:window.BogatkaSyncMerge.clean(finalLocal),finalRemote:remote.form_data,finalBase:finalBase.formData,dirtyAfter:finalState.dirtyLocations||[],followUpSyncs:Protection.diagnostics.followUpSyncsScheduled,lifecycle:Protection.lifecycle,generation:Protection.generation,audit:Protection.audit(),syncDiagnostics:Compat.diagnostics,
    };
  });
  expect(result.context).toEqual({dirty:false,needsPush:false,differencePaths:[]});
  expect(result.counts).toEqual({patch:0,upsert:0,saveLocal:1,saveBase:1});
  expect(result.finalLocal).toEqual(result.finalRemote);
  expect(result.finalBase).toEqual(result.finalRemote);
  expect(result.dirtyAfter).toEqual([]);
  expect(result.followUpSyncs).toBe(0);
  expect(result.lifecycle).toBe('initial-cloud-ready');
  expect(result.audit.ok,result.audit.failures.join('\n')).toBe(true);
  await mergeInitialEvidence({cleanNoEdit:result});
});

test('terminal owners remain singular and depth-stable for cold and warm production load order',async({page})=>{
  test.setTimeout(70000);
  await authorize(page);
  await page.goto(APP,{waitUntil:'load'});
  await waitInitialProtectionReady(page);
  const cold=await observeTerminal(page,'cold-cache');
  expect(cold.failures,JSON.stringify(cold.failures,null,2)).toEqual([]);
  await page.reload({waitUntil:'load'});
  await waitInitialProtectionReady(page);
  const warm=await observeTerminal(page,'warm-cache');
  expect(warm.failures,JSON.stringify(warm.failures,null,2)).toEqual([]);
  await mergeInitialEvidence({terminalStability:{cold,warm,finalAudit:warm.last.auditOk}});
});

test('first field-integrity failure retries visibly without pre-ready cloud writes',async({page})=>{
  test.setTimeout(45000);
  let requests=0;
  await page.route('**/field-integrity-v416.js*',async route=>{
    requests+=1;
    if(requests===1)await route.abort('failed');else await route.continue();
  });
  await page.addInitScript(()=>{
    window.__fieldIntegrityRetryEvidence={events:[],preReadyLocationWrites:0};
    window.addEventListener('bogatka:field-integrity-load',event=>{
      const target=document.getElementById('fieldIntegrityLoadStatusV416');
      window.__fieldIntegrityRetryEvidence.events.push({state:event.detail?.state,attempt:event.detail?.attempt,visible:Boolean(target),text:target?.textContent||''});
    });
    const nativeFetch=window.fetch;
    window.fetch=function(input,init={}){
      const url=String(typeof input==='string'?input:input?.url||'');
      const method=String(init?.method||input?.method||'GET').toUpperCase();
      if(/\/rest\/v1\/locations(?:\?|$)/.test(url)&&['POST','PATCH','PUT','DELETE'].includes(method)&&!window.BogatkaFieldIntegrityV416?.ready)window.__fieldIntegrityRetryEvidence.preReadyLocationWrites+=1;
      return nativeFetch.apply(this,arguments);
    };
  });
  await authorize(page);
  const started=Date.now();
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Boolean(document.getElementById('fieldIntegrityLoadStatusV416')||!document.getElementById('app')?.hidden),{timeout:7000});
  const firstSurfaceMs=Date.now()-started;
  await page.waitForFunction(()=>Boolean(window.BogatkaInitialBackgroundEditProtectionV437?.audit?.().ok),{timeout:30000});
  const result=await page.evaluate(names=>{
    const audit=window.BogatkaInitialBackgroundEditProtectionV437.audit();
    const chains={};
    for(const name of names){
      let current=window[name],owners=0,markers=0,depth=0;const seen=new Set();
      while(typeof current==='function'&&!seen.has(current)&&depth<48){seen.add(current);depth+=1;if(current.__initialBackgroundEditProtectionOwnerV437)owners+=1;if(current.__initialBackgroundEditProtectionV437)markers+=1;current=current.__base}
      chains[name]={depth,owners,markers,cycle:typeof current==='function'&&seen.has(current)};
    }
    return{events:window.__fieldIntegrityRetryEvidence.events,preReadyLocationWrites:window.__fieldIntegrityRetryEvidence.preReadyLocationWrites,audit,chains,appVisible:!document.getElementById('app')?.hidden,statusState:document.documentElement.dataset.fieldIntegrityLoadV416||null};
  },OWNER_NAMES);
  result.requests=requests;result.firstVisibleSurfaceMs=firstSurfaceMs;
  expect(requests).toBeGreaterThanOrEqual(2);
  expect(firstSurfaceMs).toBeLessThan(10000);
  expect(result.events.some(event=>event.state==='retrying'&&event.visible)).toBe(true);
  expect(result.events.some(event=>event.state==='ready')).toBe(true);
  expect(result.preReadyLocationWrites).toBe(0);
  expect(result.audit.ok,result.audit.failures.join('\n')).toBe(true);
  for(const chain of Object.values(result.chains)){expect(chain.owners).toBe(1);expect(chain.markers).toBe(1);expect(chain.cycle).toBe(false)}
  await mergeInitialEvidence({dependencyFailureRetry:result});
});

test('project-scoped startup dirty ignores unrelated project and preserves active dirty intent',async({page})=>{
  test.setTimeout(35000);
  await authorize(page);
  await page.goto(APP,{waitUntil:'load'});
  await waitInitialProtectionReady(page);
  const result=await page.evaluate(async()=>{
    const id='project-scope-v437',activeProject='active-project-v437',oldProject='old-project-v437';
    const State=window.BogatkaSyncState,Protection=window.BogatkaInitialBackgroundEditProtectionV437,Compat=window.BogatkaSyncCompatibility;
    const item={id,title:'Scope fixture',address:'Scope fixture',note:'',custom:true};
    locations=[item];cloudProjectId=activeProject;cloudSession={user:{id:'scope-user-v437'}};cloudRole='owner';window.cloudRole=cloudRole;
    await State.rawPut()(STORE,{contact:'LOCAL-STALE',questions:'LOCAL-STALE',updatedAt:'2026-07-13T10:00:00.000Z'},`location:${id}`);
    await State.rawPut()(STORE,locations,'meta:locations');
    await State.deleteBase(id);
    localStorage.setItem(`bogatka_cloud_sync_state_v412:${oldProject}`,JSON.stringify({projectId:oldProject,dirtyLocations:[id]}));
    const activeState={projectId:activeProject,userId:'scope-user-v437',dirtyLocations:[],dirtyPhotos:[],deletedPhotos:{},deletedLocations:{},knownLocationIds:[id],knownPhotoIds:[],stateDirty:false,metaDirty:false};
    cloudWriteState(activeState);
    Protection._test.resetForTest();
    await Protection.captureStartupSnapshot({force:true});
    Protection._test.setLifecycle('reconciling-early-edits');
    const remote={id:`remote-${id}`,project_id:activeProject,client_id:id,title:item.title,address:item.address,note:null,status:null,object_type:null,form_data:{contact:'REMOTE-NEWER',questions:'REMOTE-NEWER'},sort_order:0,archived_at:null,revision:4,updated_at:'2026-07-13T10:05:00.000Z'};
    const cleanContext=await Compat._test.buildContext(item,0,remote,activeState);
    const counts={patch:0,upsert:0};
    await Compat._test.persistLocation(cleanContext,activeState,{
      isPending:()=>false,
      conditionalUpdate:async()=>{counts.patch+=1;return remote},
      upsert:async()=>{counts.upsert+=1;return remote},
      fetchRow:async()=>remote,
      rebuild:async()=>cleanContext,
      saveLocal:async()=>true,
      saveBase:async()=>true,
    });
    const cleanSnapshot=Protection.snapshot;
    const dirtyState={...activeState,dirtyLocations:[id]};
    cloudWriteState(dirtyState);
    await State.rawPut()(STORE,{contact:'ACTIVE-DIRTY',questions:'ACTIVE-DIRTY',updatedAt:'2026-07-13T10:06:00.000Z'},`location:${id}`);
    Protection._test.resetForTest();
    await Protection.captureStartupSnapshot({force:true});
    Protection._test.setLifecycle('reconciling-early-edits');
    const dirtyContext=await Compat._test.buildContext(item,0,remote,dirtyState);
    return{
      oldProjectDirty:[id],activeCleanPreExistingDirty:cleanSnapshot.preExistingDirty,
      clean:{dirty:cleanContext.dirty,needsPush:cleanContext.needsPush,patchCount:counts.patch,upsertCount:counts.upsert},
      activeDirtyPreExistingDirty:Protection.snapshot.preExistingDirty,dirty:{dirty:dirtyContext.dirty,needsPush:dirtyContext.needsPush},activeState:cloudReadState(),
    };
  });
  expect(result.activeCleanPreExistingDirty).toEqual([]);
  expect(result.clean).toEqual({dirty:false,needsPush:false,patchCount:0,upsertCount:0});
  expect(result.activeDirtyPreExistingDirty).toContain('project-scope-v437');
  expect(result.dirty).toEqual({dirty:true,needsPush:true});
  expect(result.activeState.projectId).toBe('active-project-v437');
  await mergeInitialEvidence({crossProjectStartupDirty:result});
});
