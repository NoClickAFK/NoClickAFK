(function(){
  'use strict';
  if(window.BogatkaMutationAuthorityV437?.ready)return;

  const VERSION='4.3.7';
  const CACHE_PREFIX='bogatka.mutation.authority.v437';
  const ACTIVE_INITIAL_LIFECYCLES=new Set(['initial-cloud-pending','reconciling-early-edits','initial-cloud-error','offline']);
  const MUTATING_CLICK_SELECTOR=[
    '#addLocationBtn','#saveLocationBtn','#deleteLocationBtn','#clearAllBtn','#importBtn','#importFile',
    '[data-action="edit-location"]','[data-action="clear-location"]','[data-action="restore-location"]',
    '[data-action="archive-location"]','[data-action="delete-location"]','[data-photo-location]',
    '.photo-add','.photo-delete','[data-archive-restore]','[data-archive-delete]'
  ].join(',');
  const MUTATING_CONTROL_SELECTOR='[data-location][data-field],[data-global],#addLocationBtn,#saveLocationBtn,#deleteLocationBtn,#clearAllBtn,#importBtn,[data-action="edit-location"],[data-action="clear-location"],[data-action="restore-location"],[data-action="archive-location"],[data-action="delete-location"],[data-photo-location],.photo-add,.photo-delete,[data-archive-restore],[data-archive-delete]';

  let state='session-pending';
  let reason='startup';
  let lastUserId=null;
  let lastProjectId=null;
  let observer=null;
  let refreshTimer=null;
  const controlBeforeEdit=new WeakMap();
  const durableRevisions=new WeakMap();
  const diagnostics={stateChanges:0,blockedEvents:0,blockedWrites:0,durableEarlyWrites:0,durableEarlyWriteErrors:0,remoteBackedDurabilitySkips:0};

  const clone=value=>value===undefined?undefined:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
  const currentSession=()=>{try{return typeof cloudSession==='undefined'?(window.cloudSession??null):(cloudSession??window.cloudSession??null)}catch(_){return window.cloudSession??null}};
  const currentRole=()=>{try{return typeof cloudRole==='undefined'?(window.cloudRole??null):(cloudRole??window.cloudRole??null)}catch(_){return window.cloudRole??null}};
  const currentProjectId=()=>{try{return typeof cloudProjectId==='undefined'?(window.cloudProjectId??null):(cloudProjectId??window.cloudProjectId??null)}catch(_){return window.cloudProjectId??null}};
  const cacheKey=(userId,projectId)=>`${CACHE_PREFIX}:${userId||'unknown'}:${projectId||'unknown'}`;
  const readCachedRole=(userId,projectId)=>{try{return localStorage.getItem(cacheKey(userId,projectId))||null}catch(_){return null}};
  const writeCachedRole=(userId,projectId,role)=>{if(!userId||!projectId||!['owner','editor','viewer'].includes(role))return;try{localStorage.setItem(cacheKey(userId,projectId),role)}catch(_){ }};
  const mayMutate=()=>state==='owner'||state==='editor'||state==='signed-out-local';
  const hasCachedCloudSession=()=>{
    try{
      for(let index=0;index<localStorage.length;index++){
        const key=localStorage.key(index)||'';
        if(!/^sb-.*-auth-token$/.test(key))continue;
        const raw=localStorage.getItem(key);
        if(!raw)continue;
        try{
          const parsed=JSON.parse(raw);
          if(parsed?.access_token||parsed?.currentSession?.access_token||parsed?.user?.id)return true;
        }catch(_){return true}
      }
    }catch(_){ }
    return false;
  };

  function readControl(control){
    if(control.type==='checkbox'||control.type==='radio')return Boolean(control.checked);
    return control.value;
  }
  function rememberControl(control){if(control&&!controlBeforeEdit.has(control))controlBeforeEdit.set(control,readControl(control))}
  function restoreControl(control){
    if(!control)return;
    const before=controlBeforeEdit.get(control);
    if(before===undefined)return;
    if(control.type==='checkbox'||control.type==='radio')control.checked=Boolean(before);
    else control.value=before??'';
    if(control.tagName==='SELECT')window.BogatkaSelectSync?.syncVisibleSelect?.(control);
  }
  function clearControlRemembered(control){if(control)controlBeforeEdit.delete(control)}

  function applyDomAuthority(){
    const readonly=!mayMutate();
    // Before session lookup completes, capture guards deny mutation without adding
    // disabled/aria-disabled attributes. Legacy one-shot enhancers inspect those
    // attributes while constructing custom selects and panel grids. Once a signed-in
    // session is known but its role is unresolved, native hard read-only is applied.
    const hardReadonly=readonly&&state!=='session-pending';
    for(const element of document.querySelectorAll(MUTATING_CONTROL_SELECTOR)){
      if(readonly)rememberControl(element);
      if(hardReadonly){
        if(!element.disabled)element.dataset.mutationAuthorityDisabledV437='1';
        element.disabled=true;
        element.setAttribute('aria-disabled','true');
      }else{
        if(element.dataset.mutationAuthorityDisabledV437==='1'){
          element.disabled=false;
          delete element.dataset.mutationAuthorityDisabledV437;
        }
        element.removeAttribute('aria-disabled');
        if(!readonly)clearControlRemembered(element);
      }
    }
  }

  function setState(next,nextReason='runtime'){
    if(state===next&&reason===nextReason){applyDomAuthority();return state}
    state=next;reason=nextReason;diagnostics.stateChanges+=1;
    document.documentElement.dataset.mutationAuthorityV437=next;
    document.documentElement.classList.toggle('mutation-readonly-v437',!mayMutate());
    applyDomAuthority();
    window.dispatchEvent(new CustomEvent('bogatka:mutation-authority',{detail:{version:VERSION,state,reason,mayMutate:mayMutate()}}));
    return state;
  }

  function resolveRuntimeState(){
    const session=currentSession();
    const role=currentRole();
    const projectId=currentProjectId();
    const cloud=window.BogatkaCloud;
    const last=cloud?.lastInitResult||null;
    if(session?.user?.id){
      lastUserId=session.user.id;
      if(projectId)lastProjectId=projectId;
      if(['owner','editor','viewer'].includes(role)){
        writeCachedRole(lastUserId,lastProjectId||projectId,role);
        return setState(role,'resolved-role');
      }
      const cached=readCachedRole(lastUserId,lastProjectId||projectId);
      if(!navigator.onLine&&cached==='viewer')return setState('offline-cached-viewer','cached-viewer');
      return setState('role-pending',navigator.onLine?'role-unresolved':'offline-role-unresolved');
    }
    if(!hasCachedCloudSession())return setState('signed-out-local','no-cached-cloud-session');
    if(last?.status==='no-session'||last?.status==='missing-supabase'||(cloud?.ready&&last?.session===false))return setState('signed-out-local','no-cloud-session');
    if(!navigator.onLine){
      const cached=readCachedRole(lastUserId,lastProjectId);
      if(cached==='viewer')return setState('offline-cached-viewer','cached-viewer');
      if(last?.status==='no-session')return setState('signed-out-local','offline-no-session');
      return setState('error-readonly','offline-authority-unknown');
    }
    return setState('session-pending','session-unresolved');
  }
  function mutationAllowedNow(){
    const role=currentRole();
    if(['owner','editor','viewer'].includes(role)||!hasCachedCloudSession())resolveRuntimeState();
    return mayMutate();
  }

  function setPath(object,path,value){
    const keys=String(path||'').split('.').filter(Boolean);
    let target=object;
    for(const key of keys.slice(0,-1))target=target[key]||(target[key]={});
    if(keys.length)target[keys.at(-1)]=clone(value);
    return object;
  }
  function controlValue(control){
    if(control.type==='checkbox')return Boolean(control.checked);
    if(control.type==='radio')return control.checked?control.value:undefined;
    return control.value;
  }
  function clearSaveTimers(control){
    for(const key of ['_saveTimer','_overviewSaveTimerV417','_locationDataSaveTimerV452']){
      if(control?.[key])clearTimeout(control[key]);
      if(control)control[key]=null;
    }
  }
  function isLocalOnlyLocation(id){
    try{
      const item=(locations||[]).find(entry=>entry.id===id);
      if(item?.cloudId)return false;
      const syncState=typeof cloudReadState==='function'?cloudReadState():{};
      if((syncState?.knownLocationIds||[]).includes(id))return false;
      return true;
    }catch(_){return false}
  }

  async function persistEarlyControl(control){
    const Protection=window.BogatkaInitialBackgroundEditProtectionV437;
    if(!mutationAllowedNow()||!Protection?.ready||!ACTIVE_INITIAL_LIFECYCLES.has(Protection.lifecycle))return false;
    const id=control?.dataset?.location;
    const path=control?.dataset?.field;
    if(!id||!path||(control.type==='radio'&&!control.checked))return false;
    if(!isLocalOnlyLocation(id)){diagnostics.remoteBackedDurabilitySkips+=1;return false}
    const revision=Number(control.dataset.initialSyncRevisionV437||0);
    if(!revision)return false;
    if((durableRevisions.get(control)||0)>=revision)return true;
    clearSaveTimers(control);
    const task=async()=>{
      const latestRevision=Number(control.dataset.initialSyncRevisionV437||0);
      if((durableRevisions.get(control)||0)>=latestRevision)return true;
      const value=controlValue(control);
      const data=await getLocationData(id);
      setPath(data,path,value);
      data.updatedAt=new Date().toISOString();
      const put=window.BogatkaSyncState?.rawPut?.()||idbPut;
      await put(STORE,data,`location:${id}`);
      if(typeof cloudMarkLocationDirty==='function')cloudMarkLocationDirty(id);
      const entry=Protection._test?.entriesFor?.(id)?.find(candidate=>candidate.path===path&&candidate.generation===Protection.generation);
      if(entry){
        entry.flushedRevision=Math.max(Number(entry.flushedRevision||0),latestRevision);
        entry.savedRevision=Math.max(Number(entry.savedRevision||0),latestRevision);
      }
      durableRevisions.set(control,latestRevision);
      diagnostics.durableEarlyWrites+=1;
      return true;
    };
    try{
      const enqueue=window.BogatkaFieldIntegrityV416?.enqueueLocation;
      return await (typeof enqueue==='function'?enqueue(id,task):task());
    }catch(error){
      diagnostics.durableEarlyWriteErrors+=1;
      console.error('Early edit durability write failed.',error);
      return false;
    }
  }

  function blockEvent(event){
    diagnostics.blockedEvents+=1;
    restoreControl(event.target);
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  function onFocusIn(event){
    const control=event.target?.closest?.('[data-location][data-field],[data-global]');
    if(control)rememberControl(control);
  }
  function onMutationEvent(event){
    const control=event.target?.closest?.('[data-location][data-field],[data-global]');
    if(!mutationAllowedNow())return blockEvent(event);
    if(control?.matches?.('[data-location][data-field]'))queueMicrotask(()=>persistEarlyControl(control));
    queueMicrotask(()=>clearControlRemembered(control));
  }
  function onClick(event){const target=event.target?.closest?.(MUTATING_CLICK_SELECTOR);if(target&&!mutationAllowedNow())blockEvent(event)}
  function onSubmit(event){if(!mutationAllowedNow()&&event.target?.closest?.('#locationModal,#cloudInviteForm'))blockEvent(event)}

  function install(){
    document.addEventListener('focusin',onFocusIn,true);
    document.addEventListener('beforeinput',event=>{if(!mutationAllowedNow())blockEvent(event)},true);
    document.addEventListener('input',onMutationEvent,true);
    document.addEventListener('change',onMutationEvent,true);
    document.addEventListener('click',onClick,true);
    document.addEventListener('submit',onSubmit,true);
    observer=new MutationObserver(()=>applyDomAuthority());
    observer.observe(document.documentElement,{childList:true,subtree:true});
    const refresh=()=>{resolveRuntimeState();applyDomAuthority();refreshTimer=setTimeout(refresh,state==='session-pending'||state==='role-pending'?50:500)};
    refresh();
    window.addEventListener('online',resolveRuntimeState);
    window.addEventListener('offline',resolveRuntimeState);
    window.addEventListener('bogatka:cloud-background-ready',resolveRuntimeState);
    window.addEventListener('bogatka:cloud-first-sync-ready',resolveRuntimeState);
  }

  window.BogatkaMutationAuthorityV437={
    version:VERSION,ready:true,
    canMutate:mutationAllowedNow,
    refresh:resolveRuntimeState,
    assertMutationAllowed(){if(mutationAllowedNow())return true;diagnostics.blockedWrites+=1;throw new Error('Изменение недоступно до подтверждения прав доступа.');},
    persistEarlyControl,
    get state(){return state},
    get reason(){return reason},
    get diagnostics(){return{...diagnostics}},
    _test:{setState,resolveRuntimeState,readCachedRole,writeCachedRole,restoreControl,hasCachedCloudSession,isLocalOnlyLocation,get durableRevisionCount(){return diagnostics.durableEarlyWrites}},
  };
  install();
})();
