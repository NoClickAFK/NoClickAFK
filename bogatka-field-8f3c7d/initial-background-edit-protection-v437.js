(function(){
  'use strict';
  if(window.BogatkaInitialBackgroundEditProtectionV437?.ready)return;

  const VERSION='4.3.7';
  const FIELD_INTEGRITY_SCRIPT='./field-integrity-v416.js';
  const EDITOR_SELECTOR='[data-location][data-field]';
  const ACTIVE_LIFECYCLES=new Set(['initial-cloud-pending','reconciling-early-edits','initial-cloud-error','offline']);
  const TERMINAL_NAMES=['saveField','cloudSyncAll','cloudApplyRemote','cloudPushLocations'];
  const OWNER_TOKEN={version:VERSION,domain:'initial-background-edit-protection'};
  const REQUIRED_APIS=[
    'BogatkaFieldIntegrityV416','BogatkaSyncCompatibility','BogatkaArchiveStateV436',
    'BogatkaLocationDataV452','BogatkaLocationDataStabilityV452','BogatkaDurableFieldsV452','BogatkaSuiteSaveOrderV452',
  ];
  const COMPAT_MARKERS={
    saveField:['__fieldIntegrityV416','__launchGateV454'],
    cloudSyncAll:['__syncConvergenceV435','__archiveStateGateV436','__archiveFetchGateV436'],
    cloudApplyRemote:['__syncFieldCompatV416','__archiveStateV436'],
    cloudPushLocations:['__archiveStateV436'],
  };

  const snapshots=new Map();
  const startupDirty=new Set();
  const journal=new Map();
  const barriers=new Map();
  const transientBases=new Map();
  const skipFirstPushIds=new Set();
  const followUpScheduled=new Set();
  const protectedControls=new Map();
  const observedEarlyLocations=new Set();
  const observedEarlyPaths=new Set();
  const functionIds=new WeakMap();
  const ownerTimeline=[];
  let functionSequence=0;
  let lifecycle='local-ready';
  let generation=0;
  let sequence=0;
  let snapshotCaptured=false;
  let startupDirtyProjectId=null;
  let firstApplyCompleted=false;
  let saveBaseFunction=null;
  let startupWrapped=false;
  let inputInstalled=false;
  let fieldIntegrityPromise=null;
  let terminalPromise=null;
  let terminalTimer=null;
  let terminalAttempts=0;
  let terminalStablePasses=0;
  let terminalCycle=0;
  let terminalReason='';
  let terminalReadyAt=null;
  let lateEventsInstalled=false;
  let lastOwnerSignature='';
  const diagnostics={
    initialSyncGeneration:0,
    startupSnapshotsCaptured:0,
    earlyEditLocations:0,
    earlyEditPathCount:0,
    pendingSaveFlushes:0,
    transientBasesUsed:0,
    remoteFieldsAccepted:0,
    localEditedFieldsPreserved:0,
    followUpSyncsScheduled:0,
    staleWholeLocationPushesPrevented:0,
    activeControlsSkipped:0,
    initialSyncErrors:0,
    terminalAttempts:0,
    terminalStablePasses:0,
    terminalCycles:0,
    terminalRebuilds:0,
    terminalLateEvents:0,
  };

  const clone=value=>value===undefined?undefined:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
  const same=(left,right)=>window.BogatkaSyncMerge?.same?window.BogatkaSyncMerge.same(left,right):JSON.stringify(left)===JSON.stringify(right);
  const clean=value=>window.BogatkaSyncMerge?.clean?window.BogatkaSyncMerge.clean(value||{}):clone(value||{});
  const functionId=fn=>{
    if(typeof fn!=='function')return null;
    if(!functionIds.has(fn))functionIds.set(fn,++functionSequence);
    return functionIds.get(fn);
  };
  const currentRole=()=>{
    try{return typeof cloudRole==='undefined'?(window.cloudRole??null):(cloudRole??window.cloudRole??null)}catch(_){return window.cloudRole??null}
  };
  const isViewer=()=>currentRole()==='viewer';
  const active=()=>ACTIVE_LIFECYCLES.has(lifecycle)&&snapshotCaptured;
  const entryKey=(id,path)=>`${id}:${path}`;
  const entriesFor=id=>[...journal.values()].filter(entry=>entry.locationId===id&&entry.generation===generation);
  const journalIds=()=>new Set([...journal.values()].filter(entry=>entry.generation===generation).map(entry=>entry.locationId));
  const getPath=(object,path)=>String(path||'').split('.').reduce((value,key)=>value?.[key],object);

  function setPath(object,path,value){
    const keys=String(path||'').split('.');
    let target=object;
    for(const key of keys.slice(0,-1))target=target[key]||(target[key]={});
    target[keys.at(-1)]=clone(value);
    return object;
  }
  function readControl(control){
    if(control.type==='checkbox')return Boolean(control.checked);
    if(control.type==='radio')return control.checked?control.value:undefined;
    return control.value;
  }
  function writeControl(control,value){
    if(control.type==='checkbox')control.checked=Boolean(value);
    else if(control.type==='radio')control.checked=control.value===value;
    else control.value=value===undefined||value===null?'':String(value);
    if(control.tagName==='SELECT')window.BogatkaSelectSync?.syncVisibleSelect?.(control);
  }
  function setLifecycle(next,detail={}){
    if(lifecycle===next)return lifecycle;
    lifecycle=next;
    document.documentElement.dataset.initialCloudLifecycleV437=next;
    window.dispatchEvent(new CustomEvent('bogatka:initial-cloud-lifecycle',{detail:{version:VERSION,generation,lifecycle:next,...detail}}));
    return lifecycle;
  }
  function refreshDiagnosticCounts(){
    diagnostics.initialSyncGeneration=generation;
    diagnostics.earlyEditLocations=observedEarlyLocations.size;
    diagnostics.earlyEditPathCount=observedEarlyPaths.size;
    diagnostics.terminalAttempts=terminalAttempts;
    diagnostics.terminalStablePasses=terminalStablePasses;
    diagnostics.terminalCycles=terminalCycle;
  }

  function readActiveStartupState(){
    try{
      if(typeof cloudReadState!=='function')return{};
      const state=cloudReadState();
      return state&&typeof state==='object'?clone(state):{};
    }catch(_){return{}}
  }
  function collectStartupDirty(){
    startupDirty.clear();
    const state=readActiveStartupState();
    let projectId=null;
    try{projectId=typeof cloudProjectId==='undefined'?null:cloudProjectId}catch(_){projectId=null}
    startupDirtyProjectId=state.projectId||projectId||null;
    for(const id of state.dirtyLocations||[])startupDirty.add(id);
  }
  function validateStartupDirtyScope(){
    let projectId=null;
    try{projectId=typeof cloudProjectId==='undefined'?null:cloudProjectId}catch(_){projectId=null}
    if(startupDirtyProjectId&&projectId&&startupDirtyProjectId!==projectId)startupDirty.clear();
    return startupDirty;
  }
  async function captureStartupSnapshot({force=false}={}){
    if(snapshotCaptured&&!force)return api.snapshot;
    generation+=1;
    sequence=0;
    snapshots.clear();
    journal.clear();
    barriers.clear();
    transientBases.clear();
    skipFirstPushIds.clear();
    followUpScheduled.clear();
    protectedControls.clear();
    observedEarlyLocations.clear();
    observedEarlyPaths.clear();
    firstApplyCompleted=false;
    collectStartupDirty();
    for(let index=0;index<(locations||[]).length;index++){
      const item=locations[index];
      const data=await getLocationData(item.id);
      snapshots.set(item.id,{
        generation,
        data:clean(data),
        meta:{title:item.title||item.address||'',address:item.address||'',note:item.note||'',sortOrder:index,archivedAt:item.archivedAt||null},
      });
    }
    snapshotCaptured=true;
    diagnostics.initialSyncGeneration=generation;
    diagnostics.startupSnapshotsCaptured=snapshots.size;
    diagnostics.earlyEditLocations=0;
    diagnostics.earlyEditPathCount=0;
    setLifecycle(navigator.onLine?'initial-cloud-pending':'offline');
    return api.snapshot;
  }

  function scriptMatches(script){
    try{return new URL(script.src||'',location.href).pathname===new URL(FIELD_INTEGRITY_SCRIPT,location.href).pathname}catch(_){return false}
  }
  function ensureFieldIntegrity(timeoutMs=4000){
    if(window.BogatkaFieldIntegrityV416?.ready)return Promise.resolve(true);
    if(fieldIntegrityPromise)return fieldIntegrityPromise;
    fieldIntegrityPromise=new Promise((resolve,reject)=>{
      let script=[...document.scripts].find(scriptMatches);
      if(!script){
        script=document.createElement('script');
        script.src=FIELD_INTEGRITY_SCRIPT;
        script.async=false;
        document.head.appendChild(script);
      }
      const started=performance.now();
      const check=()=>{
        if(window.BogatkaFieldIntegrityV416?.ready)return resolve(true);
        if(performance.now()-started>=timeoutMs)return reject(new Error('Same-location field save queue did not become ready before initial background synchronization.'));
        requestAnimationFrame(check);
      };
      check();
    }).finally(()=>{fieldIntegrityPromise=null});
    return fieldIntegrityPromise;
  }

  function controlState(control){
    return{
      node:control,
      value:readControl(control),
      focused:document.activeElement===control,
      start:typeof control.selectionStart==='number'?control.selectionStart:null,
      end:typeof control.selectionEnd==='number'?control.selectionEnd:null,
      direction:control.selectionDirection||'none',
    };
  }
  function rememberControl(entry,control){
    const state=controlState(control);
    protectedControls.set(entry.key,state);
    control.dataset.initialSyncDirtyV437='1';
    control.dataset.locationDataDirtyV452='1';
  }
  function recordEdit(control){
    if(!active()||!control?.matches?.(EDITOR_SELECTOR)||control.disabled||isViewer())return false;
    if(control.type==='radio'&&!control.checked)return false;
    const locationId=control.dataset.location;
    const path=control.dataset.field;
    if(!locationId||!path)return false;
    const key=entryKey(locationId,path);
    const revision=Number(control.dataset.initialSyncRevisionV437||0)+1;
    control.dataset.initialSyncRevisionV437=String(revision);
    const entry={
      key,locationId,path,value:clone(readControl(control)),revision,sequence:++sequence,
      generation,control,flushedRevision:Number(journal.get(key)?.flushedRevision||0),savedRevision:Number(journal.get(key)?.savedRevision||0),
    };
    journal.set(key,entry);
    observedEarlyLocations.add(locationId);
    observedEarlyPaths.add(key);
    rememberControl(entry,control);
    refreshDiagnosticCounts();
    return true;
  }
  function installInputJournal(){
    if(inputInstalled)return;
    inputInstalled=true;
    const listener=event=>recordEdit(event.target);
    document.addEventListener('input',listener,true);
    document.addEventListener('change',listener,true);
  }

  function liveFunction(name){
    try{
      if(name==='saveField'&&typeof saveField==='function')return saveField;
      if(name==='cloudSyncAll'&&typeof cloudSyncAll==='function')return cloudSyncAll;
      if(name==='cloudApplyRemote'&&typeof cloudApplyRemote==='function')return cloudApplyRemote;
      if(name==='cloudPushLocations'&&typeof cloudPushLocations==='function')return cloudPushLocations;
    }catch(_){ }
    return window[name];
  }
  function publishFunction(name,fn,reason='publish'){
    const beforeLive=liveFunction(name);
    const beforeWindow=window[name];
    window[name]=fn;
    try{
      if(name==='saveField')saveField=fn;
      else if(name==='cloudSyncAll')cloudSyncAll=fn;
      else if(name==='cloudApplyRemote')cloudApplyRemote=fn;
      else if(name==='cloudPushLocations')cloudPushLocations=fn;
    }catch(_){ }
    if(beforeLive!==fn||beforeWindow!==fn){
      ownerTimeline.push({atMs:Number(performance.now().toFixed(1)),name,reason,fromLive:functionId(beforeLive),fromWindow:functionId(beforeWindow),to:functionId(fn),toName:fn?.name||''});
      if(ownerTimeline.length>160)ownerTimeline.splice(0,ownerTimeline.length-160);
    }
    return fn;
  }
  function defineMarker(fn,key,value=true){
    try{Object.defineProperty(fn,key,{value,configurable:true,writable:false,enumerable:false})}catch(_){try{fn[key]=value}catch(__){ }}
  }
  function markOwned(fn,name,base){
    defineMarker(fn,'__initialBackgroundEditProtectionV437',true);
    defineMarker(fn,'__initialBackgroundEditProtectionOwnerV437',OWNER_TOKEN);
    defineMarker(fn,'__base',base);
    defineMarker(fn,'__baseV437',base);
    for(const marker of COMPAT_MARKERS[name]||[]){
      let current=base;
      const seen=new Set();
      while(typeof current==='function'&&!seen.has(current)){
        if(current[marker]){defineMarker(fn,marker,true);break}
        seen.add(current);current=current.__base;
      }
    }
    return fn;
  }
  function ownedByUs(fn){return Boolean(typeof fn==='function'&&fn.__initialBackgroundEditProtectionOwnerV437===OWNER_TOKEN)}
  function chainInfo(fn){
    const nodes=[];
    const seen=new Set();
    let current=fn;
    while(typeof current==='function'&&!seen.has(current)&&nodes.length<48){
      seen.add(current);
      const ownMarkers=Object.getOwnPropertyNames(current).filter(key=>key.startsWith('__')&&current[key]===true).sort();
      nodes.push({id:functionId(current),name:current.name||'<anonymous>',owned:ownedByUs(current),v437:Boolean(current.__initialBackgroundEditProtectionV437),markers:ownMarkers});
      current=current.__base;
    }
    return{depth:nodes.length,ownedCount:nodes.filter(node=>node.owned).length,v437MarkerCount:nodes.filter(node=>node.v437).length,cycle:typeof current==='function'&&seen.has(current),nodes};
  }
  function stripKnownSaveWrappers(fn){
    const seen=new Set();
    let current=fn;
    while(typeof current==='function'&&!seen.has(current)){
      seen.add(current);
      if(ownedByUs(current)||current.__fieldIntegrityV416||current.__launchGateV454){current=current.__base;continue}
      break;
    }
    return typeof current==='function'?current:fn;
  }

  function createSaveWrapper(base){
    saveBaseFunction=base;
    const wrapped=async function protectedInitialSave(control){
      const id=control?.dataset?.location;
      const path=control?.dataset?.field;
      const entry=id&&path?journal.get(entryKey(id,path)):null;
      const barrier=id?barriers.get(id):null;
      if(barrier)await barrier.promise;
      if(active()&&isViewer()){
        clearControlTimers(control);
        return false;
      }
      if(entry&&entry.generation===generation&&entry.savedRevision>=entry.revision)return true;
      const result=await base.call(this,control);
      const latest=id&&path?journal.get(entryKey(id,path)):null;
      if(latest&&latest.generation===generation)latest.savedRevision=Math.max(latest.savedRevision,latest.revision);
      return result;
    };
    return markOwned(wrapped,'saveField',base);
  }
  function normalizeAndInstallSaveWrapper(){
    const current=liveFunction('saveField');
    if(typeof current!=='function')return false;
    if(ownedByUs(current)&&window.saveField===current){saveBaseFunction=current.__baseV437||current.__base;return true}
    const base=stripKnownSaveWrappers(current);
    publishFunction('saveField',base,'save-canonical-base');
    window.BogatkaLaunchGateV454?.installSaveGuard?.();
    window.BogatkaFieldIntegrityV416?.installSaveQueue?.();
    const terminalBase=liveFunction('saveField');
    if(typeof terminalBase!=='function')return false;
    const wrapped=createSaveWrapper(terminalBase);
    publishFunction('saveField',wrapped,'save-v437-terminal');
    diagnostics.terminalRebuilds+=1;
    return true;
  }
  function installSaveWrapper(){
    const current=liveFunction('saveField');
    if(ownedByUs(current)){saveBaseFunction=current.__baseV437||current.__base;publishFunction('saveField',current,'save-align');return true}
    return normalizeAndInstallSaveWrapper();
  }

  function beginBarriers(ids){
    for(const id of ids){
      if(barriers.has(id))continue;
      let resolve;
      const promise=new Promise(done=>{resolve=done});
      barriers.set(id,{promise,resolve,generation});
    }
  }
  function endBarriers(ids){
    for(const id of ids){const barrier=barriers.get(id);if(barrier){barrier.resolve();barriers.delete(id)}}
  }
  function clearControlTimers(control){
    for(const key of ['_saveTimer','_overviewSaveTimerV417','_locationDataSaveTimerV452']){
      if(control?.[key])clearTimeout(control[key]);
      if(control)control[key]=null;
    }
  }
  async function persistEntryDirect(entry){
    const task=async()=>{
      const data=await getLocationData(entry.locationId);
      setPath(data,entry.path,entry.value);
      data.updatedAt=new Date().toISOString();
      const put=window.BogatkaSyncState?.rawPut?.()||idbPut;
      await put(STORE,data,`location:${entry.locationId}`);
      if(typeof cloudMarkLocationDirty==='function')cloudMarkLocationDirty(entry.locationId);
    };
    const enqueue=window.BogatkaFieldIntegrityV416?.enqueueLocation;
    return typeof enqueue==='function'?enqueue(entry.locationId,task):task();
  }
  async function flushJournal(ids,{bypassBarrier=true}={}){
    const allowed=new Set(ids);
    for(let pass=0;pass<6;pass++){
      let wrote=false;
      const pending=[...journal.values()].filter(entry=>entry.generation===generation&&allowed.has(entry.locationId)&&entry.flushedRevision<entry.revision);
      if(!pending.length)break;
      for(const entry of pending){
        const latest=journal.get(entry.key);
        if(!latest||latest.generation!==generation||latest.flushedRevision>=latest.revision)continue;
        const revision=latest.revision;
        const control=latest.control?.isConnected?latest.control:null;
        if(control)clearControlTimers(control);
        if(control&&typeof saveBaseFunction==='function'&&bypassBarrier)await saveBaseFunction(control);
        else if(control&&typeof liveFunction('saveField')==='function'&&!bypassBarrier)await liveFunction('saveField')(control);
        else await persistEntryDirect(latest);
        const after=journal.get(entry.key);
        if(after&&after.generation===generation){after.flushedRevision=Math.max(after.flushedRevision,revision);after.savedRevision=Math.max(after.savedRevision,revision)}
        diagnostics.pendingSaveFlushes+=1;
        wrote=true;
      }
      if(!wrote)break;
    }
    await window.BogatkaDurableFieldsV452?.flush?.();
    return true;
  }

  function startupBaseFor(id){
    const snapshot=snapshots.get(id);
    return snapshot?{revision:0,updatedAt:'',formData:clone(snapshot.data),meta:clone(snapshot.meta),transientGeneration:generation}:null;
  }
  function remoteBase(row){
    const formData=clean(row?.form_data||{});
    if(row?.archived_at)formData.archivedAt=row.archived_at;
    return{
      revision:Number(row?.revision||0),updatedAt:row?.updated_at||'',formData,
      meta:{title:row?.title||'',address:row?.address||'',note:row?.note||'',sortOrder:Number(row?.sort_order||0),archivedAt:row?.archived_at||null},
    };
  }
  function pathLeaves(value,prefix='',result=[]){
    if(value&&typeof value==='object'&&!Array.isArray(value)&&!(value instanceof Blob)){
      for(const [key,child] of Object.entries(value))pathLeaves(child,prefix?`${prefix}.${key}`:key,result);
    }else result.push(prefix);
    return result;
  }
  function countMergeEvidence(id,row,finalData){
    const snapshot=snapshots.get(id)?.data||{};
    const remote=clean(row?.form_data||{});
    const edited=new Set(entriesFor(id).map(entry=>entry.path));
    for(const path of pathLeaves(remote)){
      if(!path||edited.has(path))continue;
      if(!same(getPath(snapshot,path),getPath(remote,path))&&same(getPath(finalData,path),getPath(remote,path)))diagnostics.remoteFieldsAccepted+=1;
    }
    for(const entry of entriesFor(id))if(same(getPath(finalData,entry.path),entry.value))diagnostics.localEditedFieldsPreserved+=1;
  }

  function blockUiWrites(){
    const noop=()=>{};
    const asyncNoop=async()=>{};
    const saved={renderLocations:window.renderLocations,restoreAllForms:window.restoreAllForms,refreshLocation:window.bogatkaRefreshLocationFields,updateSummary:window.updateSummary};
    window.renderLocations=noop;
    window.restoreAllForms=asyncNoop;
    window.bogatkaRefreshLocationFields=asyncNoop;
    window.updateSummary=asyncNoop;
    try{renderLocations=noop;restoreAllForms=asyncNoop;bogatkaRefreshLocationFields=asyncNoop;updateSummary=asyncNoop}catch(_){ }
    return()=>{
      if(saved.renderLocations)window.renderLocations=saved.renderLocations;
      if(saved.restoreAllForms)window.restoreAllForms=saved.restoreAllForms;
      if(saved.refreshLocation)window.bogatkaRefreshLocationFields=saved.refreshLocation;
      if(saved.updateSummary)window.updateSummary=saved.updateSummary;
      try{
        if(saved.renderLocations)renderLocations=saved.renderLocations;
        if(saved.restoreAllForms)restoreAllForms=saved.restoreAllForms;
        if(saved.refreshLocation)bogatkaRefreshLocationFields=saved.refreshLocation;
        if(saved.updateSummary)updateSummary=saved.updateSummary;
      }catch(_){ }
    };
  }
  function restoreJournalControls(ids){
    const allowed=new Set(ids);
    for(const entry of journal.values()){
      if(entry.generation!==generation||!allowed.has(entry.locationId))continue;
      const control=entry.control?.isConnected?entry.control:document.querySelector(`[data-location="${CSS.escape(entry.locationId)}"][data-field="${CSS.escape(entry.path)}"]`);
      if(!control)continue;
      const state=protectedControls.get(entry.key)||controlState(control);
      writeControl(control,entry.value);
      control.dataset.initialSyncDirtyV437='1';
      control.dataset.locationDataDirtyV452='1';
      if(state.focused){
        if(document.activeElement!==control)control.focus({preventScroll:true});
        if(state.start!==null&&typeof control.setSelectionRange==='function')try{control.setSelectionRange(state.start,state.end,state.direction)}catch(_){ }
      }
    }
  }
  async function hydrateUnrelated(ids){
    for(const id of ids){
      const card=document.querySelector(`[data-location-card="${CSS.escape(id)}"]`);
      if(!card)continue;
      const data=await getLocationData(id);
      const edited=new Set(entriesFor(id).map(entry=>entry.path));
      for(const control of card.querySelectorAll(`[data-location="${CSS.escape(id)}"][data-field]`)){
        const path=control.dataset.field;
        if(edited.has(path))continue;
        if(!isViewer()&&(document.activeElement===control||control.dataset.initialSyncDirtyV437==='1'||control.dataset.locationDataDirtyV452==='1')){
          diagnostics.activeControlsSkipped+=1;
          continue;
        }
        writeControl(control,getPath(data,path));
        if(isViewer()){
          control.disabled=true;
          delete control.dataset.initialSyncDirtyV437;
          delete control.dataset.locationDataDirtyV452;
        }
      }
      if(isViewer())window.BogatkaLocationDataV452?.applyViewerState?.(card);
      if(typeof updateLocationTotal==='function')updateLocationTotal(id,data);
      if(typeof updateGpsLabel==='function')updateGpsLabel(id,data);
    }
  }
  function clearJournalIfConverged(){
    const state=typeof cloudReadState==='function'?cloudReadState():{};
    const dirty=new Set(state?.dirtyLocations||[]);
    let pending=false;
    for(const entry of [...journal.values()]){
      if(entry.generation!==generation)continue;
      if(dirty.has(entry.locationId)||barriers.has(entry.locationId)){pending=true;continue}
      const control=entry.control;
      if(control?.isConnected){
        delete control.dataset.initialSyncDirtyV437;
        if(!control._locationDataSaveTimerV452&&!control._saveTimer)delete control.dataset.locationDataDirtyV452;
      }
      journal.delete(entry.key);
    }
    refreshDiagnosticCounts();
    return !pending&&journalIds().size===0;
  }
  function makeSafeState(syncState,remoteRows){
    validateStartupDirtyScope();
    const safe=clone(syncState&&typeof syncState==='object'?syncState:{});
    safe.dirtyLocations||=[];
    const dirty=new Set(safe.dirtyLocations);
    const remoteIds=new Set((remoteRows||[]).map(row=>row.client_id||row.id));
    const earlyIds=journalIds();
    for(const id of earlyIds){
      if(isViewer()&&!startupDirty.has(id)){dirty.delete(id);continue}
      if(remoteIds.has(id))dirty.add(id);
    }
    safe.dirtyLocations=[...dirty];
    return safe;
  }

  function createApplyWrapper(baseApply){
    const wrapped=async function protectedInitialApply(remoteLocations,remotePhotos,remoteState,syncState){
      if(!active())return baseApply.apply(this,arguments);
      setLifecycle('reconciling-early-edits');
      await ensureFieldIntegrity();
      const rows=remoteLocations||[];
      const remoteById=new Map(rows.map(row=>[row.client_id||row.id,row]));
      const allRemoteIds=[...remoteById.keys()];
      const safeState=makeSafeState(syncState,rows);
      const State=window.BogatkaSyncState;
      const prepared=[];
      for(const id of journalIds()){
        const row=remoteById.get(id);
        if(!row||!snapshots.has(id)||startupDirty.has(id)||isViewer())continue;
        const persisted=await State.readBase(id);
        if(persisted)continue;
        const base=startupBaseFor(id);
        if(base){transientBases.set(id,base);prepared.push({id,row});skipFirstPushIds.add(id)}
      }
      if(isViewer()){
        for(const entry of [...journal.values()])if(entry.generation===generation&&!startupDirty.has(entry.locationId))journal.delete(entry.key);
        refreshDiagnosticCounts();
      }
      beginBarriers(allRemoteIds);
      const originalReadBase=State.readBase;
      State.readBase=async id=>transientBases.has(id)?clone(transientBases.get(id)):originalReadBase(id);
      const restoreUi=blockUiWrites();
      try{
        await flushJournal(allRemoteIds,{bypassBarrier:true});
        const result=await baseApply(rows,remotePhotos,remoteState,safeState);
        firstApplyCompleted=true;
        for(const {id,row} of prepared){
          await State.writeBase(id,remoteBase(row));
          diagnostics.transientBasesUsed+=1;
        }
        for(const id of allRemoteIds){
          const data=await getLocationData(id);
          const row=remoteById.get(id);
          if(row)countMergeEvidence(id,row,data);
        }
        return result;
      }catch(error){
        diagnostics.initialSyncErrors+=1;
        setLifecycle(navigator.onLine?'initial-cloud-error':'offline',{reason:'apply'});
        throw error;
      }finally{
        State.readBase=originalReadBase;
        transientBases.clear();
        restoreUi();
        restoreJournalControls(allRemoteIds);
        endBarriers(allRemoteIds);
        await flushJournal(allRemoteIds,{bypassBarrier:true});
        restoreJournalControls(allRemoteIds);
        await hydrateUnrelated(allRemoteIds);
      }
    };
    return markOwned(wrapped,'cloudApplyRemote',baseApply);
  }
  function createPushWrapper(basePush){
    const wrapped=async function protectedInitialPush(remoteLocations,syncState){
      if(active()&&isViewer())return remoteLocations||[];
      const skip=[...skipFirstPushIds].filter(id=>(remoteLocations||[]).some(row=>(row.client_id||row.id)===id));
      if(!skip.length)return basePush.apply(this,arguments);
      const blocked=new Set(skip);
      const originalLocations=locations;
      locations=originalLocations.filter(item=>!blocked.has(item.id));
      let result;
      try{result=await basePush(remoteLocations,syncState)}finally{
        locations=originalLocations;
        await window.BogatkaSyncState.rawPut()(STORE,locations,'meta:locations');
      }
      for(const id of skip){
        skipFirstPushIds.delete(id);
        diagnostics.staleWholeLocationPushesPrevented+=1;
        if(!followUpScheduled.has(id)){
          followUpScheduled.add(id);
          diagnostics.followUpSyncsScheduled+=1;
          if(typeof cloudMarkLocationDirty==='function')cloudMarkLocationDirty(id);
          else{
            const state=cloudReadState();state.dirtyLocations||=[];
            if(!state.dirtyLocations.includes(id))state.dirtyLocations.push(id);
            cloudWriteState(state);
            cloudScheduleSync?.(0);
          }
        }
      }
      return result;
    };
    return markOwned(wrapped,'cloudPushLocations',basePush);
  }
  function normalizeAndInstallApplyPushWrappers(){
    if(!window.BogatkaArchiveStateV436?.ready||!window.BogatkaSyncCompatibility?.ready)return false;
    window.BogatkaArchiveStateV436?._test?.ensureRuntimeWrappers?.({force:true});
    window.BogatkaSyncFieldCompatV416?.install?.();
    const baseApply=liveFunction('cloudApplyRemote');
    const basePush=liveFunction('cloudPushLocations');
    if(typeof baseApply!=='function'||typeof basePush!=='function')return false;
    publishFunction('cloudApplyRemote',createApplyWrapper(baseApply),'apply-v437-terminal');
    publishFunction('cloudPushLocations',createPushWrapper(basePush),'push-v437-terminal');
    diagnostics.terminalRebuilds+=1;
    return true;
  }
  function installApplyPushWrappers(){
    const apply=liveFunction('cloudApplyRemote');
    const push=liveFunction('cloudPushLocations');
    if(ownedByUs(apply)&&ownedByUs(push)){
      publishFunction('cloudApplyRemote',apply,'apply-align');
      publishFunction('cloudPushLocations',push,'push-align');
      return true;
    }
    return normalizeAndInstallApplyPushWrappers();
  }

  function createSyncWrapper(baseSync){
    const wrapped=async function protectedInitialSync(options={}){
      if(!snapshotCaptured)await captureStartupSnapshot();
      if(!navigator.onLine)setLifecycle('offline');
      else if(active()&&lifecycle!=='reconciling-early-edits')setLifecycle('initial-cloud-pending');
      try{
        const result=await baseSync.call(this,options);
        if(active()&&!result?.deferred&&!result?.skipped){
          const state=typeof cloudReadState==='function'?cloudReadState():{};
          const dirty=new Set(state?.dirtyLocations||[]);
          const remaining=[...journalIds()].filter(id=>dirty.has(id)||skipFirstPushIds.has(id));
          if(firstApplyCompleted&&!remaining.length&&clearJournalIfConverged())setLifecycle('initial-cloud-ready');
          else if(navigator.onLine)setLifecycle('initial-cloud-pending');
        }
        return result;
      }catch(error){
        diagnostics.initialSyncErrors+=1;
        try{await flushJournal([...journalIds()],{bypassBarrier:true})}catch(_){ }
        setLifecycle(navigator.onLine?'initial-cloud-error':'offline',{reason:'sync'});
        throw error;
      }
    };
    return markOwned(wrapped,'cloudSyncAll',baseSync);
  }
  function installSyncWrapper(){
    if(!window.BogatkaSyncCompatibility?.ready)return false;
    const current=liveFunction('cloudSyncAll');
    if(typeof current!=='function')return false;
    if(ownedByUs(current)){publishFunction('cloudSyncAll',current,'sync-align');return true}
    publishFunction('cloudSyncAll',createSyncWrapper(current),'sync-v437-terminal');
    diagnostics.terminalRebuilds+=1;
    return true;
  }

  function terminalDependencies(){
    const missing=REQUIRED_APIS.filter(name=>!window[name]?.ready);
    const compat=window.BogatkaSyncFieldCompatV416;
    if(!compat?.ready)missing.push('BogatkaSyncFieldCompatV416');
    if(compat?.ready&&!compat.archiveFetchReady)missing.push('archiveFetchReady');
    if(compat?.ready&&compat.archiveFetchSourceKind!=='archive-inclusive')missing.push('archiveFetchSourceKind');
    if(!window.BogatkaLaunchGateV454?.ready)missing.push('BogatkaLaunchGateV454');
    return[...new Set(missing)];
  }
  function inspectTerminalOwnership(){
    const failures=[];
    const dependencies=terminalDependencies();
    failures.push(...dependencies.map(name=>`dependency:${name}`));
    if(!snapshotCaptured||generation<1)failures.push('startup-snapshot-missing');
    const owners={};
    for(const name of TERMINAL_NAMES){
      const live=liveFunction(name);
      const published=window[name];
      const chain=chainInfo(live);
      owners[name]={sameIdentity:live===published,liveId:functionId(live),windowId:functionId(published),name:typeof live==='function'?(live.name||'<anonymous>'):typeof live,chain};
      if(typeof live!=='function')failures.push(`${name}:missing`);
      if(live!==published)failures.push(`${name}:lexical-window-mismatch`);
      if(chain.ownedCount!==1)failures.push(`${name}:v437-owner-count:${chain.ownedCount}`);
      if(chain.v437MarkerCount!==1)failures.push(`${name}:v437-marker-count:${chain.v437MarkerCount}`);
      if(chain.cycle)failures.push(`${name}:wrapper-cycle`);
    }
    return{
      ok:failures.length===0,
      failures,
      lifecycle,
      generation,
      snapshotLocationsCount:snapshots.size,
      runtimeChecks:terminalAttempts,
      terminalPasses:terminalStablePasses,
      terminalReconcileAttempts:terminalAttempts,
      terminalStablePasses,
      terminalCycle,
      terminalReason,
      terminalReadyAt,
      dependencies:{missing:dependencies},
      readiness:Object.fromEntries([...REQUIRED_APIS,'BogatkaSyncFieldCompatV416','BogatkaLaunchGateV454'].map(name=>[name,Boolean(window[name]?.ready)])),
      owners,
      ownerTimeline:clone(ownerTimeline),
    };
  }
  function audit(){return inspectTerminalOwnership()}

  function installLateOwnerEvents(){
    if(lateEventsInstalled)return;
    lateEventsInstalled=true;
    window.addEventListener('bogatka:cloud-archive-loaded',()=>{
      diagnostics.terminalLateEvents+=1;
      setTimeout(()=>ensureTerminalOwnership({reason:'cloud-archive-loaded'}).catch(error=>console.error(error)),0);
    });
  }
  function currentOwnerSignature(){
    return TERMINAL_NAMES.map(name=>`${name}:${functionId(liveFunction(name))}:${functionId(window[name])}`).join('|');
  }
  function installTerminalOwners(){
    normalizeAndInstallSaveWrapper();
    installSyncWrapper();
    normalizeAndInstallApplyPushWrappers();
  }
  function scheduleTerminalStep(run,delay=50){
    clearTimeout(terminalTimer);
    terminalTimer=setTimeout(run,delay);
  }
  function ensureTerminalOwnership({reason='requested',timeoutMs=15000}={}){
    const current=inspectTerminalOwnership();
    if(current.ok){installLateOwnerEvents();return Promise.resolve(current)}
    if(terminalPromise)return terminalPromise;
    terminalCycle+=1;
    terminalReason=reason;
    terminalAttempts=0;
    terminalStablePasses=0;
    lastOwnerSignature='';
    terminalReadyAt=null;
    diagnostics.terminalCycles=terminalCycle;
    const started=performance.now();
    terminalPromise=new Promise((resolve,reject)=>{
      const step=()=>{
        terminalAttempts+=1;
        refreshDiagnosticCounts();
        const missing=terminalDependencies();
        if(!missing.length&&snapshotCaptured){
          installLateOwnerEvents();
          let state=inspectTerminalOwnership();
          if(!state.ok){
            installTerminalOwners();
            state=inspectTerminalOwnership();
          }
          const signature=currentOwnerSignature();
          if(state.ok&&signature===lastOwnerSignature)terminalStablePasses+=1;
          else terminalStablePasses=state.ok?1:0;
          lastOwnerSignature=signature;
          diagnostics.terminalStablePasses=terminalStablePasses;
          document.documentElement.dataset.initialBackgroundEditTerminalV437=state.ok?'1':'0';
          if(state.ok&&terminalStablePasses>=4){
            terminalReadyAt=Date.now();
            window.__bogatkaInitialBackgroundEditTerminalReadyV437=true;
            clearTimeout(terminalTimer);
            terminalPromise=null;
            return resolve(inspectTerminalOwnership());
          }
        }
        if(performance.now()-started>=timeoutMs){
          const state=inspectTerminalOwnership();
          terminalPromise=null;
          return reject(new Error(`Terminal V437 ownership did not converge: ${state.failures.join(', ')}`));
        }
        scheduleTerminalStep(step,50);
      };
      step();
    });
    return terminalPromise;
  }

  function wrapStartup(){
    const startup=window.BogatkaStartup;
    const current=startup?.prepareCriticalUi;
    if(!startup||typeof current!=='function')return false;
    if(current.__initialBackgroundEditStartupV437){startupWrapped=true;return true}
    const wrapped=async function protectedLocalFirstStartup(){
      await captureStartupSnapshot();
      await ensureFieldIntegrity();
      return current.apply(this,arguments);
    };
    defineMarker(wrapped,'__initialBackgroundEditStartupV437',true);
    defineMarker(wrapped,'__initialBackgroundEditProtectionV437',true);
    defineMarker(wrapped,'__base',current);
    startup.prepareCriticalUi=wrapped;
    startupWrapped=true;
    return true;
  }
  function interceptReadyApi(name,onReady){
    const existing=window[name];
    if(existing){onReady(existing);return}
    const descriptor=Object.getOwnPropertyDescriptor(window,name);
    if(descriptor&&!descriptor.configurable)return;
    let value;
    Object.defineProperty(window,name,{
      configurable:true,enumerable:true,
      get(){return value},
      set(next){
        value=next;
        Object.defineProperty(window,name,{configurable:true,enumerable:true,writable:true,value:next});
        onReady(next);
      },
    });
  }

  function resetForTest(){
    snapshotCaptured=false;
    firstApplyCompleted=false;
    lifecycle='local-ready';
    generation=0;
    sequence=0;
    startupDirtyProjectId=null;
    snapshots.clear();startupDirty.clear();journal.clear();barriers.clear();transientBases.clear();skipFirstPushIds.clear();followUpScheduled.clear();protectedControls.clear();observedEarlyLocations.clear();observedEarlyPaths.clear();
    for(const key of ['initialSyncGeneration','startupSnapshotsCaptured','earlyEditLocations','earlyEditPathCount','pendingSaveFlushes','transientBasesUsed','remoteFieldsAccepted','localEditedFieldsPreserved','followUpSyncsScheduled','staleWholeLocationPushesPrevented','activeControlsSkipped','initialSyncErrors'])diagnostics[key]=0;
    document.documentElement.dataset.initialCloudLifecycleV437='local-ready';
  }

  const api=window.BogatkaInitialBackgroundEditProtectionV437={
    version:VERSION,
    ready:true,
    captureStartupSnapshot,
    ensureFieldIntegrity,
    ensureTerminalOwnership,
    inspectTerminalOwnership,
    audit,
    installSaveWrapper,
    installSyncWrapper,
    installApplyPushWrappers,
    recordEdit,
    get lifecycle(){return lifecycle},
    get generation(){return generation},
    get snapshot(){return{generation,locations:[...snapshots.keys()],preExistingDirty:[...startupDirty],startupDirtyProjectId}},
    get diagnostics(){refreshDiagnosticCounts();return clone({...diagnostics,ownerTimeline})},
    _test:{
      resetForTest,flushJournal,entriesFor,journalIds,remoteBase,startupBaseFor,setLifecycle,collectStartupDirty,validateStartupDirtyScope,
      get skipFirstPushIds(){return[...skipFirstPushIds]},
      get startupDirty(){return[...startupDirty]},
      get ownerToken(){return OWNER_TOKEN},
    },
  };

  installInputJournal();
  interceptReadyApi('BogatkaStartup',()=>wrapStartup());
  window.addEventListener('offline',()=>{if(snapshotCaptured)setLifecycle('offline')});
  window.addEventListener('online',()=>{if(snapshotCaptured&&lifecycle!=='initial-cloud-ready')setLifecycle('initial-cloud-pending')});
  wrapStartup();
})();
