(function(){
  if(window.__bogatkaArchiveLabelV400)return;
  window.__bogatkaArchiveLabelV400=true;
  function canEdit(){return typeof cloudRole==='undefined'||cloudRole!=='viewer'}
  function deletionState(state){
    state=state&&typeof state==='object'?state:{};
    state.deletedLocations||={};
    state.dirtyLocations||=[];
    state.deletedPhotos||={};
    state.knownLocationIds||=[];
    return state;
  }
  function deletionError(message){
    if(typeof alert==='function')alert(message);
    return false;
  }
  function pendingDeletionIds(state=typeof cloudReadState==='function'?cloudReadState():{}){
    return new Set(Object.keys(deletionState(state).deletedLocations));
  }
  function queueLocationDeletion(item,data,photos=[]){
    if(!item?.id||typeof cloudMutateState!=='function')return null;
    const now=new Date().toISOString();
    let tombstone=null;
    cloudMutateState(state=>{
      deletionState(state);
      const current=state.deletedLocations[item.id]||{};
      tombstone={
        clientId:item.id,
        cloudId:data?.cloudId||item.cloudId||current.cloudId||null,
        deletedAt:current.deletedAt||now,
        attempts:Number(current.attempts||0),
        lastAttemptAt:current.lastAttemptAt||null,
        lastError:current.lastError||'',
        photoIds:[...new Set([...(current.photoIds||[]),...photos.map(photo=>photo.id).filter(Boolean)])],
        storagePaths:[...new Set([...(current.storagePaths||[]),...photos.map(photo=>photo.storagePath).filter(Boolean)])],
      };
      state.deletedLocations[item.id]=tombstone;
      state.dirtyLocations=state.dirtyLocations.filter(id=>id!==item.id);
    });
    if(typeof cloudScheduleSync==='function')cloudScheduleSync(250);
    return tombstone;
  }
  function supabaseDeletionAdapter(){
    return {
      async findLocation(projectId,tombstone){
        let query=cloudClient.from('locations').select('id,client_id').eq('project_id',projectId).eq('client_id',tombstone.clientId);
        const result=await query.maybeSingle();
        if(result.error)throw new Error(result.error.message);
        if(result.data&&tombstone.cloudId&&result.data.id!==tombstone.cloudId)throw new Error('Облачный идентификатор локации изменился. Удаление остановлено для безопасной проверки.');
        return result.data||null;
      },
      async listPhotos(projectId,locationId){
        const result=await cloudClient.from('photos').select('id,storage_path').eq('project_id',projectId).eq('location_id',locationId);
        if(result.error)throw new Error(result.error.message);
        return result.data||[];
      },
      async removeStorage(paths){
        if(!paths.length)return;
        const result=await cloudClient.storage.from(BOGATKA_SUPABASE.photoBucket).remove(paths);
        if(result.error)throw new Error(result.error.message);
      },
      async deleteLocation(projectId,row,tombstone){
        const result=await cloudClient.from('locations').delete().eq('project_id',projectId).eq('client_id',tombstone.clientId).eq('id',row.id).select('id');
        if(result.error)throw new Error(result.error.message);
      },
      async locationExists(projectId,row,tombstone){
        const result=await cloudClient.from('locations').select('id').eq('project_id',projectId).eq('client_id',tombstone.clientId).eq('id',row.id).maybeSingle();
        if(result.error)throw new Error(result.error.message);
        return Boolean(result.data);
      },
    };
  }
  function persistDeletionFailure(syncState,clientId,tombstone,error){
    const next={...tombstone,attempts:Number(tombstone.attempts||0)+1,lastAttemptAt:new Date().toISOString(),lastError:error?.message||String(error)};
    deletionState(syncState).deletedLocations[clientId]=next;
    cloudMutateState(state=>{deletionState(state);state.deletedLocations[clientId]=next});
    return next;
  }
  function clearDeletion(syncState,clientId,tombstone){
    const photoIds=new Set(tombstone.photoIds||[]);
    const clear=state=>{
      deletionState(state);
      delete state.deletedLocations[clientId];
      for(const photoId of photoIds)delete state.deletedPhotos[photoId];
      state.dirtyPhotos=(state.dirtyPhotos||[]).filter(id=>!photoIds.has(id));
      state.dirtyLocations=state.dirtyLocations.filter(id=>id!==clientId);
    };
    clear(syncState);
    cloudMutateState(clear);
  }
  async function processPendingDeletions(syncState,adapter=supabaseDeletionAdapter()){
    deletionState(syncState);
    for(const [clientId,tombstoneValue] of Object.entries({...syncState.deletedLocations})){
      const tombstone={clientId,...tombstoneValue};
      try{
        const row=await adapter.findLocation(cloudProjectId,tombstone);
        const photoRows=row?await adapter.listPhotos(cloudProjectId,row.id):[];
        const paths=[...new Set([...(tombstone.storagePaths||[]),...photoRows.map(photo=>photo.storage_path).filter(Boolean)])];
        await adapter.removeStorage(paths);
        if(row){
          await adapter.deleteLocation(cloudProjectId,row,tombstone);
          if(await adapter.locationExists(cloudProjectId,row,tombstone))throw new Error('Сервер не подтвердил удаление локации. Проверьте права доступа и повторите синхронизацию.');
          tombstone.photoIds=[...new Set([...(tombstone.photoIds||[]),...photoRows.map(photo=>photo.id).filter(Boolean)])];
        }
        clearDeletion(syncState,clientId,tombstone);
      }catch(error){
        persistDeletionFailure(syncState,clientId,tombstone,error);
        throw new Error(`Удаление локации «${clientId}» ожидает повторной синхронизации: ${error?.message||String(error)}`);
      }
    }
  }
  function installLocationDeletionLifecycle(){
    const S=window.BogatkaSuite;
    if(!S||S.__locationDeletionLifecycleV400||typeof cloudDeleteRemovedLocations!=='function')return;
    S.__locationDeletionLifecycleV400=true;
    const baseArchive=S.archiveLocation.bind(S);
    const baseRestore=S.restoreArchivedLocation.bind(S);
    const baseDeleteRemoved=cloudDeleteRemovedLocations;

    S.archiveLocation=async function(id){
      if(!canEdit())return deletionError('Роль наблюдателя не позволяет архивировать локации.');
      return baseArchive(id);
    };
    S.restoreArchivedLocation=async function(id){
      if(!canEdit())return deletionError('Роль наблюдателя не позволяет восстанавливать локации.');
      return baseRestore(id);
    };
    S.permanentlyDeleteArchived=async function(id){
      if(!canEdit())return deletionError('Роль наблюдателя не позволяет удалять локации.');
      const item=locations.find(location=>location.id===id);
      if(!item)return false;
      const data=await getLocationData(id);
      if(!data.archivedAt&&!item.archivedAt)return deletionError('Окончательно удалить можно только локацию из архива.');
      if(!item.custom)return deletionError('Предустановленную локацию нельзя удалить окончательно.');
      if(!confirm(`Удалить «${item.title||item.address}» окончательно вместе со всеми фотографиями? Это действие нельзя отменить.`))return false;
      const photos=(await idbAll(PHOTO_STORE)).filter(photo=>photo.locationId===id);
      queueLocationDeletion(item,data,photos);
      await S.withSuppressedHistory(async()=>{
        for(const photo of photos)await idbDelete(PHOTO_STORE,photo.id);
        await idbDelete(STORE,`location:${id}`);
        await idbDelete(STORE,`undo:${id}`);
        locations=locations.filter(location=>location.id!==id);
        await saveLocations();
      });
      renderLocations();
      await updateSummary();
      if(typeof cloudSession!=='undefined'&&cloudSession){
        const pending='Удаление сохранено на устройстве и будет подтверждено облаком.';
        if(!navigator.onLine)cloudSetStatus('offline',pending);
        else cloudSetStatus('syncing',pending);
      }
      return true;
    };

    const archiveDelete=async function(){
      if(!canEdit())return deletionError('Роль наблюдателя не позволяет архивировать локации.');
      const id=document.querySelector('#editLocationId')?.value||'';
      if(id)await S.archiveLocation(id);
      closeLocationModal();
    };
    window.deleteCustomLocation=archiveDelete;
    try{deleteCustomLocation=archiveDelete}catch(_){}

    cloudDeleteRemovedLocations=async function deleteRemovedLocationsWithTombstones(remoteLocations,syncState){
      deletionState(syncState);
      const tombstonedBefore=pendingDeletionIds(syncState);
      await processPendingDeletions(syncState);
      return baseDeleteRemoved(remoteLocations.filter(row=>!tombstonedBefore.has(row.client_id||row.id)),syncState);
    };
    window.cloudDeleteRemovedLocations=cloudDeleteRemovedLocations;
    window.BogatkaLocationDeletion={
      version:'4.0.1',ready:true,deletionState,pendingDeletionIds,queueLocationDeletion,processPendingDeletions,
      filterRemote(remoteLocations,remotePhotos,state){
        const pending=pendingDeletionIds(state);
        const cloudIds=new Set(Object.values(deletionState(state).deletedLocations).map(item=>item?.cloudId).filter(Boolean));
        return {
          remoteLocations:(remoteLocations||[]).filter(row=>!pending.has(row.client_id||row.id)&&!cloudIds.has(row.id)),
          remotePhotos:(remotePhotos||[]).filter(photo=>!cloudIds.has(photo.location_id)),
        };
      },
    };
  }
  function apply(){
    const button=document.getElementById('deleteLocationBtn');
    if(button){button.textContent='В архив';button.classList.remove('danger');button.classList.add('warning')}
    document.querySelectorAll('[data-archive-delete]').forEach(action=>{
      const item=locations.find(location=>location.id===action.dataset.archiveDelete);
      action.classList.toggle('hidden',!item?.custom);
    });
    const viewer=!canEdit();
    document.querySelectorAll('#addLocationBtn,#importBtn,#clearAllBtn,#saveLocationBtn,#deleteLocationBtn,[data-location-card] input,[data-location-card] textarea,[data-location-card] select,[data-action="edit-location"],[data-action="save-gps"],[data-action="clear-location"],[data-action="restore-location"],[data-action="archive-location"],[data-archive-restore],[data-archive-delete]').forEach(element=>{
      if(viewer){if(!element.disabled)element.dataset.viewerDisabled='1';element.disabled=true;element.setAttribute('aria-disabled','true')}
      else if(element.dataset.viewerDisabled==='1'){element.disabled=false;element.removeAttribute('aria-disabled');delete element.dataset.viewerDisabled}
    });
    document.body.classList.toggle('viewer-mode-v400',viewer);
    const label=document.getElementById('versionLabel');if(label)label.textContent='4.0.0';
  }
  function stabilizeLaunchEditing(){
    const S=window.BogatkaSuite;
    if(!S||S.__stableLaunchV400)return;
    S.__stableLaunchV400=true;
    S.saveLaunchField=async function(locationId,path,value){
      const data=await getLocationData(locationId);
      const project=S.ensureLaunchProject(data);
      const previous=getNested(project,path);
      setNested(project,path,value);
      project.updatedAt=new Date().toISOString();
      S.appendActivityToData(data,{action:'Изменён проект открытия',field:`launchProject.${path}`,label:path,from:previous,to:value});
      data.updatedAt=project.updatedAt;
      await idbPut(STORE,data,`location:${locationId}`);
      showSaved();
    };
    document.addEventListener('focusout',event=>{
      if(event.target.closest('[data-launch-body]'))setTimeout(()=>updateSummary().catch(showError),180);
    });
  }
  function stabilizeArchiveFilter(){
    const engine=window.BogatkaDecisionEngine;
    if(!engine||engine.__metaArchiveV400)return;
    engine.__metaArchiveV400=true;
    const base=engine.computeAll.bind(engine);
    engine.computeAll=async function(){
      const metrics=await base();
      return metrics.filter(metric=>!metric.item?.archivedAt&&!metric.data?.archivedAt);
    };
  }
  function installAutoRent(){
    if(window.__bogatkaAutoRentV400)return;
    window.__bogatkaAutoRentV400=true;
    document.addEventListener('change',event=>{
      const element=event.target.closest?.('[data-location][data-field]');
      if(!element||!['tech.totalArea','tech.rentPerMonth','rent'].includes(element.dataset.field))return;
      const id=element.dataset.location;
      setTimeout(async()=>{
        const data=await getLocationData(id);
        const area=Number(String(data?.tech?.totalArea||'').replace(',','.'));
        const rent=Number(String(data?.tech?.rentPerMonth||data.rent||'').replace(',','.'));
        if(!Number.isFinite(area)||area<=0||!Number.isFinite(rent)||rent<0)return;
        data.tech||={};
        const calculated=Math.round(rent/area*100)/100;
        if(Number(data.tech.rentPerSqm)===calculated)return;
        data.tech.rentPerSqm=String(calculated);
        window.BogatkaSuite?.appendActivityToData(data,{action:'Рассчитана аренда за м²',field:'tech.rentPerSqm',label:'Аренда за м²',to:calculated});
        data.updatedAt=new Date().toISOString();
        await idbPut(STORE,data,`location:${id}`);
        const target=document.querySelector(`[data-location="${CSS.escape(id)}"][data-field="tech.rentPerSqm"]`);
        if(target&&target!==document.activeElement)target.value=String(calculated);
        await updateSummary();
      },500);
    });
  }
  function installArchiveAwareClear(){
    if(window.__bogatkaArchiveAwareClearV400)return;
    window.__bogatkaArchiveAwareClearV400=true;
    const clearActive=async function(){
      if(!confirm('Очистить все заполненные поля и фотографии во всех активных локациях? Архив останется без изменений.'))return;
      showSaving();
      const active=[];
      for(const item of locations){
        const data=await getLocationData(item.id);
        if(!data.archivedAt&&!item.archivedAt)active.push({item,data});
      }
      const activeIds=new Set(active.map(entry=>entry.item.id));
      const photos=(await idbAll(PHOTO_STORE)).filter(photo=>activeIds.has(photo.locationId));
      const now=new Date().toISOString();
      const put=typeof cloudOriginalIdbPut!=='undefined'&&cloudOriginalIdbPut?cloudOriginalIdbPut:idbPut;
      const remove=typeof cloudOriginalIdbDelete!=='undefined'&&cloudOriginalIdbDelete?cloudOriginalIdbDelete:idbDelete;
      for(const {item} of active){
        await put(STORE,{updatedAt:now},`location:${item.id}`);
        await remove(STORE,`undo:${item.id}`);
        if(typeof bogatkaMarkLocationReset==='function')bogatkaMarkLocationReset(item.id,photos.filter(photo=>photo.locationId===item.id));
      }
      await put(STORE,{updatedAt:now},'global');
      for(const photo of photos)await remove(PHOTO_STORE,photo.id);
      if(typeof cloudMutateState==='function')cloudMutateState(state=>{state.stateDirty=true});
      const pending=typeof bogatkaReadPendingClear==='function'?bogatkaReadPendingClear():null;
      const locationsToClear=new Set(pending?.locations||[]);
      active.forEach(({item})=>locationsToClear.add(item.id));
      if(typeof bogatkaWritePendingClear==='function')bogatkaWritePendingClear({all:false,locations:[...locationsToClear]});
      document.querySelectorAll('[data-global]').forEach(element=>{element.value=''});
      renderLocations();
      await updateSummary();
      showSaved();
      if(typeof bogatkaFlushPendingClear==='function')setTimeout(()=>bogatkaFlushPendingClear(),80);
    };
    window.clearAllData=clearActive;
    try{clearAllData=clearActive}catch(_){}
  }
  function mergeById(localItems,remoteItems,deletedIds=[]){
    const deleted=new Set(deletedIds||[]),map=new Map();
    for(const item of [...(remoteItems||[]),...(localItems||[])]){
      if(!item?.id||deleted.has(item.id))continue;
      const previous=map.get(item.id);
      const previousTime=Date.parse(previous?.updatedAt||previous?.createdAt||previous?.completedAt||0)||0;
      const currentTime=Date.parse(item.updatedAt||item.createdAt||item.completedAt||0)||0;
      if(!previous||currentTime>=previousTime)map.set(item.id,item);
    }
    return [...map.values()];
  }
  function installCollaborationMerge(){
    const S=window.BogatkaSuite;
    if(!S||S.__collaborationMergeV400||typeof cloudApplyRemote!=='function')return;
    S.__collaborationMergeV400=true;
    const baseDeleteTask=S.deleteTask.bind(S),baseDeleteComment=S.deleteComment.bind(S);
    S.deleteTask=async function(locationId,taskId){
      await baseDeleteTask(locationId,taskId);
      const data=await getLocationData(locationId);
      data.deletedTaskIds=[...new Set([...(data.deletedTaskIds||[]),taskId])];
      data.updatedAt=new Date().toISOString();
      await idbPut(STORE,data,`location:${locationId}`);
    };
    S.deleteComment=async function(locationId,commentId){
      await baseDeleteComment(locationId,commentId);
      const data=await getLocationData(locationId);
      data.deletedCommentIds=[...new Set([...(data.deletedCommentIds||[]),commentId])];
      data.updatedAt=new Date().toISOString();
      await idbPut(STORE,data,`location:${locationId}`);
    };
    const baseApply=cloudApplyRemote;
    const wrapped=async function(remoteLocations,remotePhotos,remoteState,syncState){
      const needsPush=[];
      const dirtySet=new Set(syncState.dirtyLocations||[]);
      for(const remote of remoteLocations){
        const id=remote.client_id||remote.id;
        const local=await idbGet(STORE,`location:${id}`)||{};
        const form=remote.form_data||{};
        const deletedTaskIds=[...new Set([...(local.deletedTaskIds||[]),...(form.deletedTaskIds||[])])];
        const deletedCommentIds=[...new Set([...(local.deletedCommentIds||[]),...(form.deletedCommentIds||[])])];
        const mergedTasks=mergeById(local.tasks,form.tasks,deletedTaskIds);
        const mergedComments=mergeById(local.comments,form.comments,deletedCommentIds);
        const mergedActivity=mergeById(local.activity,form.activity).sort((a,b)=>(Date.parse(a.at)||0)-(Date.parse(b.at)||0)).slice(-300);
        const newerLocal=(Date.parse(local.updatedAt)||0)>=(Date.parse(form.updatedAt)||0);
        const primary=newerLocal?local:form;
        const secondary=newerLocal?form:local;
        let launchProject=primary.launchProject?structuredClone(primary.launchProject):secondary.launchProject?structuredClone(secondary.launchProject):null;
        if(launchProject)launchProject.milestones=mergeById(local.launchProject?.milestones,form.launchProject?.milestones);
        const merged={...form,tasks:mergedTasks,comments:mergedComments,activity:mergedActivity,deletedTaskIds,deletedCommentIds};
        if(launchProject)merged.launchProject=launchProject;
        const changed=JSON.stringify(form.tasks||[])!==JSON.stringify(mergedTasks)||JSON.stringify(form.comments||[])!==JSON.stringify(mergedComments)||JSON.stringify(form.activity||[])!==JSON.stringify(mergedActivity)||JSON.stringify(form.launchProject||null)!==JSON.stringify(launchProject);
        remote.form_data=merged;
        if(dirtySet.has(id)){
          const localMerged={...local,tasks:mergedTasks,comments:mergedComments,activity:mergedActivity,deletedTaskIds,deletedCommentIds};
          if(launchProject)localMerged.launchProject=launchProject;
          await cloudOriginalIdbPut(STORE,localMerged,`location:${id}`);
        }
        if(changed)needsPush.push(id);
      }
      await baseApply(remoteLocations,remotePhotos,remoteState,syncState);
      syncState.dirtyLocations||=[];
      for(const id of needsPush)if(!syncState.dirtyLocations.includes(id))syncState.dirtyLocations.push(id);
    };
    window.cloudApplyRemote=wrapped;
    try{cloudApplyRemote=wrapped}catch(_){}
  }
  function diagnose(){
    const checks=[['workflow',Boolean(window.BogatkaSuite)],['decision',Boolean(window.BogatkaDecisionEngine?.computeAll)],['interface',Boolean(window.BogatkaSuiteUI?.refresh)],['cloud',typeof window.cloudSyncAll==='function'],['report',typeof window.buildReportHtml==='function'],['backup',typeof window.exportBackup==='function']];
    const economy=window.BogatkaSuite?.calculateEconomy({tech:{totalArea:'100',rentPerMonth:'2000'},economy:{monthlyRevenue:'20000',grossMarginPct:'35',taxRatePct:'5'}});
    checks.push(['economy',Math.abs((economy?.rentPerSqm||0)-20)<0.001&&Math.abs((economy?.rentBurdenPct||0)-10)<0.001]);
    const total=Object.values(window.BogatkaDecisionEngine?.WEIGHTS||{}).reduce((sum,value)=>sum+Number(value||0),0);
    checks.push(['weights',total===100]);
    const failures=checks.filter(([,ok])=>!ok).map(([name])=>name);
    localStorage.setItem('bogatka_diagnostics_v400',JSON.stringify({version:'4.0.0',at:new Date().toISOString(),ok:failures.length===0,checks}));
    const statusbar=document.querySelector('.statusbar');
    if(statusbar){
      let pill=document.getElementById('diagnosticsPillV400');
      if(!pill){pill=document.createElement('span');pill.id='diagnosticsPillV400';pill.className='pill';statusbar.appendChild(pill)}
      pill.textContent=failures.length?`Самопроверка: ${failures.length} ошибок`:'Самопроверка: OK';
      pill.title=failures.length?failures.join(', '):'Базовые программные проверки пройдены';
    }
  }
  function installAll(){apply();stabilizeLaunchEditing();stabilizeArchiveFilter();installAutoRent();installArchiveAwareClear();installCollaborationMerge();installLocationDeletionLifecycle()}
  installAll();
  let timer=null;
  new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(installAll,60)}).observe(document.body,{childList:true,subtree:true});
  setInterval(installAll,1500);
  setTimeout(diagnose,2500);
})();
