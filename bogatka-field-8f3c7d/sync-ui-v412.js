(function(){
  if(window.BogatkaSyncCompatibility?.ready)return;
  if(!window.BogatkaSyncMerge?.merge||!window.BogatkaSyncState?.ready||!window.BogatkaSyncIntegrity?.ready)return;
  const Merge=window.BogatkaSyncMerge,State=window.BogatkaSyncState;
  const baseApply=cloudApplyRemote,baseSyncAll=cloudSyncAll,baseScheduleSync=cloudScheduleSync,baseHandleRealtime=cloudHandleRealtime,baseRenderModal=cloudRenderModal;
  const editorSelector='#app input:not([type="button"]):not([type="submit"]):not([type="file"]),#app textarea,#app select,#app [contenteditable="true"]';
  let refreshTimer=null,inferredBaselines=0,deferredRefreshes=0,compatibilitySuppressed=0;
  let activeSync=null,pendingRerun=false,pendingManual=false,pendingTimer=null,lastSyncError='';
  const diagnostics={syncPassesStarted:0,coalescedRequests:0,noOpUpdatesAccepted:0,revisionRebases:0,realConflicts:0,lastFailingStage:''};
  const stability=window.BogatkaCloudStability;
  const suppressedDescriptor=stability?Object.getOwnPropertyDescriptor(stability,'suppressedUiRefreshes'):null;
  if(stability&&suppressedDescriptor?.get&&suppressedDescriptor.configurable){
    Object.defineProperty(stability,'suppressedUiRefreshes',{configurable:true,get(){return suppressedDescriptor.get.call(stability)+compatibilitySuppressed}});
  }

  const activeEditor=()=>Boolean(document.activeElement?.matches?.(editorSelector));
  function captureEditor(){
    const node=document.activeElement?.matches?.(editorSelector)?document.activeElement:null;
    if(!node)return null;
    return {
      node,
      value:'value' in node?String(node.value??''):'',
      checked:'checked' in node?Boolean(node.checked):null,
      start:typeof node.selectionStart==='number'?node.selectionStart:null,
      end:typeof node.selectionEnd==='number'?node.selectionEnd:null,
      direction:node.selectionDirection||'none',
      scrollX:window.scrollX,scrollY:window.scrollY,
    };
  }
  function restoreEditor(snapshot){
    const node=snapshot?.node;
    if(!node?.isConnected||node.disabled)return false;
    if('value' in node&&node.value!==snapshot.value)node.value=snapshot.value;
    if(snapshot.checked!==null&&'checked' in node)node.checked=snapshot.checked;
    if(document.activeElement!==node)node.focus({preventScroll:true});
    if(snapshot.start!==null&&typeof node.setSelectionRange==='function'){
      try{node.setSelectionRange(snapshot.start,snapshot.end,snapshot.direction)}catch(_){}
    }
    if(window.scrollX!==snapshot.scrollX||window.scrollY!==snapshot.scrollY)window.scrollTo(snapshot.scrollX,snapshot.scrollY);
    return document.activeElement===node;
  }
  const pendingReset=id=>{try{const pending=JSON.parse(localStorage.getItem('bogatka_pending_cloud_clear_v34')||'null');return Boolean(pending?.all||(pending?.locations||[]).includes(id))}catch(_){return false}};
  const deletionMap=state=>state?.deletedLocations&&typeof state.deletedLocations==='object'?state.deletedLocations:{};
  const pendingIds=state=>new Set(Object.keys(deletionMap(state)));
  const isPending=id=>pendingIds(typeof cloudReadState==='function'?cloudReadState():{}).has(id);
  const metaFor=(item,index,row)=>({title:item?.title||row?.title||'',address:item?.address||row?.address||'',note:item?.note||row?.note||'',sortOrder:index,archivedAt:item?.archivedAt||row?.archived_at||null});
  const rowMeta=row=>({title:row?.title||'',address:row?.address||'',note:row?.note||'',sortOrder:Number(row?.sort_order||0),archivedAt:row?.archived_at||null});
  const localMeta=(item,index)=>({title:item?.title||item?.address||'',address:item?.address||'',note:item?.note||'',sortOrder:index,archivedAt:item?.archivedAt||null});
  const remoteData=row=>{const data=Merge.clean(row?.form_data||{});if(row?.archived_at)data.archivedAt=row.archived_at;return data};
  const payload=(item,index,data,meta)=>Merge.transportNormalize({project_id:cloudProjectId,client_id:item.id,title:meta.title||meta.address||'Без названия',address:meta.address||null,note:meta.note||null,status:data.status||null,object_type:data.objectType||null,form_data:Merge.clean(data),sort_order:Number(meta.sortOrder||0),archived_at:data.archivedAt||meta.archivedAt||null,updated_by:cloudSession.user.id});
  const comparable=value=>value?Merge.transportNormalize({project_id:value.project_id,client_id:value.client_id||value.id,title:value.title||'',address:value.address||null,note:value.note||null,status:value.status||null,object_type:value.object_type||null,form_data:Merge.clean(value.form_data||{}),sort_order:Number(value.sort_order||0),archived_at:value.archived_at||null}):null;

  function differencePaths(left,right,path='',result=[]){
    if(result.length>=12||Merge.same(left,right))return result;
    const a=Merge.transportNormalize(left),b=Merge.transportNormalize(right);
    const ao=a&&typeof a==='object'&&!Array.isArray(a),bo=b&&typeof b==='object'&&!Array.isArray(b);
    if(ao&&bo){for(const key of new Set([...Object.keys(a),...Object.keys(b)])){differencePaths(a[key],b[key],path?`${path}.${key}`:key,result);if(result.length>=12)break}return result}
    if(Array.isArray(a)&&Array.isArray(b)){for(let index=0;index<Math.max(a.length,b.length);index++){differencePaths(a[index],b[index],`${path}[${index}]`,result);if(result.length>=12)break}return result}
    result.push(path||'<root>');return result;
  }

  async function inferRecentBaselines(remoteRows,syncState={}){
    const dirty=new Set(syncState.dirtyLocations||[]);
    for(const row of remoteRows||[]){
      const id=row.client_id||row.id;
      if(dirty.has(id)||await State.readBase(id))continue;
      const raw=await getLocationData(id),localRevision=Number(raw.cloudRevision),remoteRevision=Number(row.revision);
      if(!Number.isFinite(localRevision)||!Number.isFinite(remoteRevision)||remoteRevision<localRevision||remoteRevision-localRevision>1)continue;
      const item=locations.find(entry=>entry.id===id);
      await State.writeBase(id,{revision:localRevision,updatedAt:raw.cloudUpdatedAt||'',formData:Merge.clean(raw),meta:metaFor(item,locations.indexOf(item),row)});
      inferredBaselines++;
    }
  }
  async function refreshFields(ids){for(const id of ids)if(typeof bogatkaRefreshLocationFields==='function')await bogatkaRefreshLocationFields(id);if(ids.length&&typeof updateSummary==='function')await updateSummary()}
  function deferRefresh(ids){
    deferredRefreshes++;compatibilitySuppressed++;clearTimeout(refreshTimer);
    const run=async()=>{if(activeEditor()){refreshTimer=setTimeout(run,700);return}try{await refreshFields(ids)}catch(error){console.error(error)}};
    refreshTimer=setTimeout(run,700);
  }

  cloudApplyRemote=async function mergedApplyWithSafeUi(remoteLocations,remotePhotos,remoteState,syncState){
    await inferRecentBaselines(remoteLocations,syncState);
    const before=new Map();for(const row of remoteLocations||[]){const id=row.client_id||row.id;before.set(id,Merge.clean(await getLocationData(id)))}
    const editor=captureEditor();
    const result=await baseApply(remoteLocations,remotePhotos,remoteState,syncState);
    if(editor)restoreEditor(editor);
    const changed=[];for(const [id,value] of before)if(!Merge.same(value,Merge.clean(await getLocationData(id))))changed.push(id);
    if(changed.length){
      if(editor||activeEditor()){window.BogatkaUIStability?.requestRefresh?.(900);deferRefresh(changed)}
      else await refreshFields(changed);
    }
    return result;
  };

  async function saveBase(id,row){if(!row||isPending(id))return false;const next={revision:Number(row.revision||0),updatedAt:row.updated_at||'',formData:remoteData(row),meta:rowMeta(row)},current=await State.readBase(id);if(current&&Merge.same(current,next))return false;await State.writeBase(id,next);return true}
  async function saveLocal(id,data,row,currentValue=null){if(isPending(id))return false;const value={...Merge.clean(data)};if(row){value.cloudId=row.id;value.cloudRevision=row.revision;value.cloudUpdatedAt=row.updated_at}const current=currentValue||await getLocationData(id);if(current&&Merge.same(current,value))return false;await State.rawPut()(STORE,value,`location:${id}`);return true}
  const chooseMeta=(base,item,row,index,preferLocal)=>Merge.merge(base?.meta,localMeta(item,index),row?rowMeta(row):undefined,{preferLocal,explicitReset:false});
  async function buildContext(item,index,row,syncState){
    const local=await getLocationData(item.id),cleanLocal=Merge.clean(local),base=await State.readBase(item.id)||null,dirty=(syncState.dirtyLocations||[]).includes(item.id),options={preferLocal:dirty,explicitReset:pendingReset(item.id)};
    const merged=Merge.merge(base?.formData,cleanLocal,row?remoteData(row):undefined,options),meta=chooseMeta(base,item,row,index,Boolean(syncState.metaDirty)||dirty),nextPayload=payload(item,index,merged,meta);
    return {id:item.id,item,index,row,base,local,merged,meta,payload:nextPayload,dirty,needsPush:!row||!Merge.same(comparable(nextPayload),comparable(row))};
  }
  async function fetchRow(clientId){if(isPending(clientId))return null;const result=await cloudClient.from('locations').select('*').eq('project_id',cloudProjectId).eq('client_id',clientId).maybeSingle();if(result.error)throw new Error(result.error.message);return result.data||null}
  async function conditionalUpdate(row,nextPayload){const builder=cloudClient.from('locations').update(Merge.transportNormalize(nextPayload)).eq('id',row.id).eq('revision',row.revision).select('*');const result=typeof builder.maybeSingle==='function'?await builder.maybeSingle():await builder;if(result.error)throw new Error(result.error.message);return Array.isArray(result.data)?result.data[0]||null:result.data||null}
  async function upsert(nextPayload){const builder=cloudClient.from('locations').upsert(Merge.transportNormalize(nextPayload),{onConflict:'project_id,client_id'}).select('*');const result=typeof builder.maybeSingle==='function'?await builder.maybeSingle():await builder;if(result.error)throw new Error(result.error.message);return Array.isArray(result.data)?result.data[0]||null:result.data||null}
  const runtimeAdapter=()=>({isPending,conditionalUpdate,upsert,fetchRow,rebuild:(context,row,syncState)=>buildContext(context.item,context.index,row,syncState),saveLocal:(context,row,data)=>saveLocal(context.id,data,row,context.local),saveBase:(context,row)=>saveBase(context.id,row)});

  async function persistLocation(initial,syncState,adapter=runtimeAdapter()){
    let context=initial;const seen=new Set();
    for(let attempt=0;attempt<4;attempt++){
      if(adapter.isPending?.(context.id))return null;
      if(!context.needsPush){await adapter.saveLocal(context,context.row,context.merged);await adapter.saveBase(context,context.row);return adapter.isPending?.(context.id)?null:context.row}
      diagnostics.lastFailingStage=context.row?'conditional-update':'location-upsert';const previousRevision=Number(context.row?.revision||0);
      const written=context.row?await adapter.conditionalUpdate(context.row,context.payload):await adapter.upsert(context.payload);
      if(adapter.isPending?.(context.id))return null;
      diagnostics.lastFailingStage=written?'verify-written-row':'fetch-after-empty-update';const row=written||await adapter.fetchRow(context.id);
      if(!row){diagnostics.realConflicts++;diagnostics.lastFailingStage='missing-row-after-write';throw new Error(`Не удалось подтвердить облачную запись локации «${context.item.title||context.id}».`)}
      const desired=comparable(context.payload),remote=comparable(row);
      if(Merge.same(desired,remote)){if(!written)diagnostics.noOpUpdatesAccepted++;await adapter.saveLocal(context,row,remoteData(row));await adapter.saveBase(context,row);diagnostics.lastFailingStage='';return adapter.isPending?.(context.id)?null:row}
      const signature=`${Number(row.revision||0)}|${Merge.canonical(desired)}|${Merge.canonical(remote)}`;
      if(seen.has(signature)){const paths=differencePaths(desired,remote).slice(0,6);diagnostics.realConflicts++;diagnostics.lastFailingStage=`non-converging:${paths.join(',')||'unknown'}`;throw new Error(`Конфликт синхронизации локации «${context.item.title||context.id}». Не удалось согласовать поля: ${paths.join(', ')||'неизвестно'}.`)}
      seen.add(signature);if(Number(row.revision||0)!==previousRevision||!written)diagnostics.revisionRebases++;diagnostics.lastFailingStage='revision-rebase';context=await adapter.rebuild(context,row,syncState);
    }
    const paths=differencePaths(comparable(context.payload),comparable(context.row)).slice(0,6);diagnostics.realConflicts++;diagnostics.lastFailingStage=`retry-limit:${paths.join(',')||'unknown'}`;throw new Error(`Конфликт синхронизации локации «${context.item.title||context.id}». Повторите синхронизацию.`);
  }

  cloudPushLocations=async function convergentPushLocations(remoteLocations,syncState){
    await inferRecentBaselines(remoteLocations,syncState);const blocked=pendingIds(typeof cloudReadState==='function'?cloudReadState():syncState),finalRows=new Map((remoteLocations||[]).filter(row=>!blocked.has(row.client_id||row.id)).map(row=>[row.client_id||row.id,row]));
    for(let index=0;index<locations.length;index++){
      const item=locations[index];if(blocked.has(item.id)||isPending(item.id)){finalRows.delete(item.id);continue}
      const context=await buildContext(item,index,finalRows.get(item.id)||null,syncState),row=await persistLocation(context,syncState);
      if(row){finalRows.set(item.id,row);item.cloudId=row.id;if(row.archived_at)item.archivedAt=row.archived_at;else delete item.archivedAt}else finalRows.delete(item.id);
    }
    await State.rawPut()(STORE,locations.filter(item=>!isPending(item.id)),'meta:locations');return [...finalRows.values()].filter(row=>!isPending(row.client_id||row.id));
  };
  cloudPushLocations.__syncConvergenceV435=true;

  function applyStatusDom(status,detail=''){
    const labels={ready:'Облако: синхронизировано',syncing:'Синхронизация…',offline:'Облако: нет связи',error:'Облако: ошибка'};
    const title=document.querySelector('#cloudStatusTitle'),subtitle=document.querySelector('#cloudStatusDetail'),indicator=document.querySelector('#cloudIndicator'),button=document.querySelector('#cloudSyncBtn'),pill=document.querySelector('#cloudTopPill');
    if(title)title.textContent=labels[status]||'Облачная синхронизация';
    if(subtitle)subtitle.textContent=detail;
    if(indicator)indicator.className=`cloud-indicator ${status==='offline'?'error':status}`;
    if(button){button.textContent=labels[status]||'Облачная синхронизация';button.classList.remove('ready','syncing','error');if(['ready','syncing','error'].includes(status))button.classList.add(status)}
    if(pill){pill.className=`pill cloud-sync-pill ${status}`;pill.textContent=status==='ready'?'Облако синхронизировано':labels[status]||'Облако'}
  }
  function renderSyncError(){
    if(!lastSyncError)return;
    cloudSetStatus('error','Локальные изменения сохранены. Повторите синхронизацию.');
    applyStatusDom('error','Локальные изменения сохранены. Повторите синхронизацию.');
    const target=document.querySelector('#cloudMessage');if(!target)return;
    target.className='cloud-message show error';target.replaceChildren();
    const text=document.createElement('span');text.textContent=lastSyncError;
    const retry=document.createElement('button');retry.type='button';retry.className='btn secondary small';retry.dataset.cloudRetrySync='1';retry.textContent='Повторить синхронизацию';
    retry.addEventListener('click',async()=>{retry.disabled=true;try{await cloudSyncAll({manual:true})}catch(error){cloudHandleError(error)}finally{retry.disabled=false}});
    target.append(text,retry);
  }
  function clearSyncError(){
    if(!lastSyncError)return;lastSyncError='';const target=document.querySelector('#cloudMessage');
    if(target?.classList.contains('error')){cloudSetMessage('Синхронизация завершена.','success');applyStatusDom('ready','Синхронизация завершена.')}
  }
  function showSyncError(error){console.error(error);lastSyncError=error?.message||String(error);renderSyncError()}
  function markPending(manual=false){diagnostics.coalescedRequests++;pendingRerun=true;pendingManual=pendingManual||Boolean(manual)}
  function schedulePending(){clearTimeout(pendingTimer);pendingTimer=setTimeout(()=>cloudSyncAll({manual:pendingManual}).catch(cloudHandleError),250)}
  async function executeSingleFlight(options={}){
    let current={manual:Boolean(options?.manual)},immediateFollowups=0,result;
    while(true){
      pendingRerun=false;pendingManual=false;diagnostics.syncPassesStarted++;diagnostics.lastFailingStage='sync-pass';
      try{result=await baseSyncAll(current);if(!result?.deferred&&!result?.skipped){diagnostics.lastFailingStage='';clearSyncError()}}
      catch(error){if(!diagnostics.lastFailingStage)diagnostics.lastFailingStage='sync-pass';showSyncError(error);throw error}
      if(pendingRerun&&immediateFollowups<1){immediateFollowups++;current={manual:pendingManual};continue}
      if(pendingRerun)schedulePending();return result;
    }
  }
  cloudSyncAll=function singleFlightCloudSync(options={}){if(activeSync){markPending(options?.manual);return activeSync}activeSync=executeSingleFlight(options).finally(()=>{activeSync=null});return activeSync};
  cloudSyncAll.__syncConvergenceV435=true;
  cloudScheduleSync=function coalescedCloudSchedule(delay=1600){if(activeSync||cloudSyncing){markPending(false);return}return baseScheduleSync(delay)};
  cloudScheduleSync.__syncConvergenceV435=true;
  cloudHandleRealtime=function coalescedCloudRealtime(...args){if(activeSync||cloudSyncing){markPending(false);return}return baseHandleRealtime(...args)};
  cloudHandleRealtime.__syncConvergenceV435=true;
  cloudHandleError=function singleCloudError(error){showSyncError(error)};
  cloudHandleError.__syncConvergenceV435=true;
  cloudRenderModal=function convergenceCloudRenderModal(...args){const result=baseRenderModal(...args);if(lastSyncError)queueMicrotask(renderSyncError);return result};
  cloudRenderModal.__syncConvergenceV435=true;

  window.cloudApplyRemote=cloudApplyRemote;window.cloudPushLocations=cloudPushLocations;window.cloudSyncAll=cloudSyncAll;window.cloudScheduleSync=cloudScheduleSync;window.cloudHandleRealtime=cloudHandleRealtime;window.cloudHandleError=cloudHandleError;window.cloudRenderModal=cloudRenderModal;
  function resetDiagnostics(){diagnostics.syncPassesStarted=0;diagnostics.coalescedRequests=0;diagnostics.noOpUpdatesAccepted=0;diagnostics.revisionRebases=0;diagnostics.realConflicts=0;diagnostics.lastFailingStage=''}
  window.BogatkaSyncCompatibility={
    version:'4.3.5',ready:true,
    get diagnostics(){return{inferredBaselines,deferredRefreshes,compatibilitySuppressed,...diagnostics,integrity:window.BogatkaSyncIntegrity?.diagnostics||null}},
    _test:{comparable,differencePaths,persistLocation,buildContext,captureEditor,restoreEditor,showSyncError,clearSyncError,resetDiagnostics,createSingleFlight(run,schedule=()=>{}){
      let active=null,pending=false,followup=false,maxParallel=0,parallel=0,passes=0,coalesced=0;
      const invoke=()=>{if(active){pending=true;coalesced++;return active}active=(async()=>{do{pending=false;parallel++;maxParallel=Math.max(maxParallel,parallel);passes++;try{await run()}finally{parallel--}if(pending&&!followup){followup=true;continue}if(pending)schedule();break}while(true)})().finally(()=>{active=null;followup=false});return active};
      return{invoke,get diagnostics(){return{passes,coalesced,maxParallel}}};
    }},
  };
})();
