(function(){
  if(window.BogatkaArchiveStateV436?.ready)return;
  if(window.__bogatkaArchiveStateInstallingV436)return;
  window.__bogatkaArchiveStateInstallingV436=true;
  let installAttempts=0;
  let installTimer=null;

  function scheduleInstall(){
    clearTimeout(installTimer);
    const delay=Math.min(250,25+Math.floor(installAttempts/40)*25);
    installTimer=setTimeout(install,delay);
  }

  function install(){
    if(window.BogatkaArchiveStateV436?.ready){
      clearTimeout(installTimer);
      window.__bogatkaArchiveStateInstallingV436=false;
      return;
    }
    const Merge=window.BogatkaSyncMerge;
    const State=window.BogatkaSyncState;
    if(!Merge?.merge||!State?.ready||!window.BogatkaSyncCompatibility?.ready||typeof cloudApplyRemote!=='function'||typeof cloudPushLocations!=='function'){
      installAttempts+=1;
      scheduleInstall();
      return;
    }
    clearTimeout(installTimer);

    const ARCHIVE_KEYS=new Set(['archivedAt','archived_at']);
    const original={
      transportNormalize:Merge.transportNormalize.bind(Merge),
      canonical:Merge.canonical.bind(Merge),
      same:Merge.same.bind(Merge),
      clean:Merge.clean.bind(Merge),
      merge:Merge.merge.bind(Merge),
    };
    const diagnostics={normalized:0,invalid:0,legacyRestores:0,explicitIntentsPreserved:0,remoteStatesApplied:0,ambiguousStates:0,queuedLocationWrites:0,inFlightArchiveIntents:0};
    const has=(value,key)=>Boolean(value&&typeof value==='object'&&Object.hasOwn(value,key));
    const clone=value=>value===undefined?undefined:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
    const enqueueLocation=(id,task)=>{
      const enqueue=window.BogatkaFieldIntegrityV416?.enqueueLocation;
      if(typeof enqueue==='function'){
        diagnostics.queuedLocationWrites+=1;
        return enqueue(id,task);
      }
      return task();
    };

    function currentRole(){
      let lexicalRole=null;
      try{lexicalRole=typeof cloudRole==='undefined'?null:cloudRole}catch(_){ }
      const windowRole=window.cloudRole??null;
      if(lexicalRole==='viewer'||windowRole==='viewer')return 'viewer';
      return windowRole??lexicalRole;
    }
    function canEdit(){return currentRole()!=='viewer'}
    function denyViewerRestore(){
      if(typeof alert==='function')alert('Роль наблюдателя не позволяет восстанавливать локации.');
      return false;
    }

    function normalizeArchiveTime(value){
      if(value===undefined||value===null||value==='')return value;
      if(value instanceof Date){diagnostics.normalized++;return value.toISOString()}
      if(typeof value!=='string')return value;
      const time=Date.parse(value);
      if(!Number.isFinite(time)){diagnostics.invalid++;return value}
      const canonical=new Date(time).toISOString();
      if(canonical!==value)diagnostics.normalized++;
      return canonical;
    }

    function normalizeArchiveFields(value,key=''){
      if(value===Merge.ABSENT)return value;
      if(ARCHIVE_KEYS.has(key))return normalizeArchiveTime(value);
      if(value===null||typeof value!=='object'||value instanceof Blob||value instanceof Date)return value;
      if(Array.isArray(value))return value.map(item=>normalizeArchiveFields(item));
      const result={};
      for(const [childKey,childValue] of Object.entries(value))result[childKey]=normalizeArchiveFields(childValue,childKey);
      return result;
    }

    function archiveState(source,key){
      if(!has(source,key))return{kind:'unknown',known:false,value:undefined};
      const raw=source[key];
      if(raw===null)return{kind:'active',known:true,value:null};
      if(raw==='')return{kind:'empty',known:true,value:''};
      const value=normalizeArchiveTime(raw);
      if(typeof value==='string'&&Number.isFinite(Date.parse(value)))return{kind:'archived',known:true,value};
      return{kind:'invalid',known:true,value:raw};
    }

    const sameState=(left,right)=>left?.kind===right?.kind&&original.same(left?.value,right?.value);
    function applyState(target,key,state){
      if(!target||typeof target!=='object')return target;
      if(!state?.known){delete target[key];return target}
      target[key]=state.value;
      return target;
    }
    function stateFromRow(row){
      if(has(row,'archived_at'))return archiveState(row,'archived_at');
      return archiveState(row?.form_data,'archivedAt');
    }
    function cohereRow(row){
      if(!row||typeof row!=='object')return row;
      const next={...row,form_data:normalizeArchiveFields(row.form_data||{})};
      if(has(next,'archived_at')){
        next.archived_at=normalizeArchiveTime(next.archived_at);
        if(next.archived_at!==null||has(next.form_data,'archivedAt'))next.form_data.archivedAt=next.archived_at;
      }else if(has(next.form_data,'archivedAt'))next.form_data.archivedAt=normalizeArchiveTime(next.form_data.archivedAt);
      return next;
    }
    function stripArchive(value){
      const result=normalizeArchiveFields(clone(value)||{});
      if(result&&typeof result==='object')delete result.archivedAt;
      return result;
    }

    Merge.transportNormalize=value=>normalizeArchiveFields(original.transportNormalize(normalizeArchiveFields(value)));
    Merge.clean=value=>normalizeArchiveFields(original.clean(normalizeArchiveFields(value)));
    Merge.canonical=value=>original.canonical(normalizeArchiveFields(value));
    Merge.same=(left,right)=>original.same(normalizeArchiveFields(left),normalizeArchiveFields(right));
    Merge.merge=(base,local,remote,options={})=>{
      const result=normalizeArchiveFields(original.merge(normalizeArchiveFields(base),normalizeArchiveFields(local),normalizeArchiveFields(remote),options));
      if(options.preferLocal&&has(local,'archivedAt')&&result&&typeof result==='object')result.archivedAt=normalizeArchiveTime(local.archivedAt);
      return result;
    };
    Merge.normalizeArchiveTime=normalizeArchiveTime;
    Merge.normalizeArchiveFields=normalizeArchiveFields;
    Merge.archiveState=archiveState;
    Merge.archiveTransportVersion='4.3.6';

    function latestArchiveActivity(data){
      const entries=(Array.isArray(data?.activity)?data.activity:[])
        .filter(entry=>/архив/i.test(`${entry?.action||''} ${entry?.field||''} ${entry?.label||''} ${entry?.to||''}`))
        .map(entry=>({...entry,time:Date.parse(entry?.at||'')||0}))
        .sort((a,b)=>a.time-b.time);
      const entry=entries.at(-1)||null;
      if(!entry)return null;
      const text=`${entry.action||''} ${entry.to||''}`;
      const kind=/восстанов|актив/i.test(text)?'active':/архивирован|в архив/i.test(text)?'archived':'unknown';
      return{kind,time:entry.time,at:entry.at||''};
    }

    function resolveLocalState(data,item){
      const dataState=archiveState(data,'archivedAt');
      const itemState=archiveState(item,'archivedAt');
      if(dataState.known&&itemState.known){
        if(sameState(dataState,itemState))return{state:dataState,ambiguous:false};
        const activity=latestArchiveActivity(data);
        if(activity?.kind==='active')return{state:{kind:'active',known:true,value:null},ambiguous:false,activity};
        if(activity?.kind==='archived'){
          const archived=[dataState,itemState].find(state=>state.kind==='archived');
          if(archived)return{state:archived,ambiguous:false,activity};
        }
        diagnostics.ambiguousStates++;
        return{state:null,ambiguous:true};
      }
      return{state:dataState.known?dataState:itemState,ambiguous:false};
    }

    function inferLegacyRestore(data,item,row){
      if(has(data,'archivedAt')||has(item,'archivedAt'))return false;
      const remote=stateFromRow(row);
      if(remote.kind!=='archived')return false;
      const activity=latestArchiveActivity(data);
      if(activity?.kind!=='active'||!activity.time)return false;
      return activity.time>(Date.parse(remote.value)||0);
    }

    function markDirty(id,syncState){
      syncState=syncState&&typeof syncState==='object'?syncState:{};
      syncState.dirtyLocations||=[];
      if(!syncState.dirtyLocations.includes(id))syncState.dirtyLocations.push(id);
      if(typeof cloudReadState==='function'&&typeof cloudWriteState==='function'){
        const stored=cloudReadState();stored.dirtyLocations||=[];
        if(!stored.dirtyLocations.includes(id))stored.dirtyLocations.push(id);
        cloudWriteState(stored);
      }
      return syncState;
    }

    function relevantRow(row,data,item){
      return Boolean(row?.archived_at!==null&&row?.archived_at!==undefined)||has(row?.form_data,'archivedAt')||has(data,'archivedAt')||has(item,'archivedAt')||Boolean(latestArchiveActivity(data));
    }

    async function canonicalizeBase(id){
      const base=await State.readBase(id);
      if(!base)return null;
      const next=normalizeArchiveFields(clone(base));
      const metaState=archiveState(next.meta,'archivedAt');
      const formState=archiveState(next.formData,'archivedAt');
      const state=metaState.known?metaState:formState;
      if(state.known){next.meta||={};next.formData||={};applyState(next.meta,'archivedAt',state);applyState(next.formData,'archivedAt',state)}
      if(!Merge.same(base,next))await State.writeBase(id,next);
      return next;
    }

    async function mutateLocationData(id,item,mutator,{writeBaseRow=null}={}){
      return enqueueLocation(id,async()=>{
        const data=normalizeArchiveFields(await getLocationData(id)||{});
        const result=await mutator(data,item);
        await State.rawPut()(STORE,data,`location:${id}`);
        if(writeBaseRow){
          const row=cohereRow(writeBaseRow);
          const base={revision:Number(row.revision||0),updatedAt:row.updated_at||'',formData:Merge.clean(row.form_data||{}),meta:{title:row.title||'',address:row.address||'',note:row.note||'',sortOrder:Number(row.sort_order||0)}};
          const remoteState=stateFromRow(row);applyState(base.formData,'archivedAt',remoteState);applyState(base.meta,'archivedAt',remoteState);
          await State.writeBase(id,base);
        }
        return{data,result};
      });
    }

    async function writeLocalState(id,item,state,{writeBaseRow=null,expectedPreviousState=null,syncState=null}={}){
      return mutateLocationData(id,item,(data,currentItem)=>{
        let selected=state;
        const current=resolveLocalState(data,currentItem);
        const inFlightArchiveChanged=Boolean(
          expectedPreviousState?.known&&
          current.state?.known&&
          !sameState(current.state,expectedPreviousState)
        );
        if(inFlightArchiveChanged){
          selected=current.state;
          diagnostics.inFlightArchiveIntents+=1;
          if(syncState)markDirty(id,syncState);
        }
        applyState(data,'archivedAt',selected);applyState(currentItem,'archivedAt',selected);
        if(selected?.kind==='active')delete data.archivedBy;
        return{state:selected,inFlightArchiveChanged};
      },{writeBaseRow});
    }

    function assertValidState(id,state){
      if(!state?.known)return;
      if(state.kind==='invalid'||state.kind==='empty')throw new Error(`Некорректное состояние архива локации «${id}». Повторно выберите «В архив» или «Восстановить».`);
    }

    const baseApply=cloudApplyRemote;
    cloudApplyRemote=async function archiveAwareApply(remoteLocations,remotePhotos,remoteState,syncState){
      syncState=syncState&&typeof syncState==='object'?syncState:{};syncState.dirtyLocations||=[];
      const sourceRows=remoteLocations||[];
      const relevant=[];
      const intents=new Map();
      for(const row of sourceRows){
        const id=row.client_id||row.id,item=locations.find(entry=>entry.id===id),data=item?await getLocationData(id):{};
        if(relevantRow(row,data,item))relevant.push({id,item,data,row:cohereRow(row)});
      }
      if(!relevant.length)return baseApply(sourceRows,remotePhotos,remoteState,syncState);
      const replacement=new Map(relevant.map(entry=>[entry.id,entry.row]));
      const rows=sourceRows.map(row=>replacement.get(row.client_id||row.id)||row);
      let metaChanged=false;
      for(const entry of relevant){
        const {id,item,data,row}=entry;if(!item)continue;
        await canonicalizeBase(id);
        if(inferLegacyRestore(data,item,row)){
          const active={kind:'active',known:true,value:null};
          await writeLocalState(id,item,active);markDirty(id,syncState);intents.set(id,{state:active});metaChanged=true;diagnostics.legacyRestores++;
        }else if(syncState.dirtyLocations.includes(id)){
          const resolved=resolveLocalState(data,item);
          if(resolved.ambiguous)throw new Error(`Не удалось определить состояние архива локации «${item.title||id}». Выберите «Восстановить» или «В архив» и повторите синхронизацию.`);
          assertValidState(item.title||id,resolved.state);
          if(resolved.state?.known){intents.set(id,{state:resolved.state});diagnostics.explicitIntentsPreserved++}
        }
      }
      if(metaChanged)await State.rawPut()(STORE,locations,'meta:locations');
      const result=await baseApply(rows,remotePhotos,remoteState,syncState);
      for(const [id,intent] of intents){
        const item=locations.find(entry=>entry.id===id);
        if(item)await writeLocalState(id,item,intent.state,{expectedPreviousState:intent.state,syncState});
      }
      if(intents.size)await State.rawPut()(STORE,locations,'meta:locations');
      return result;
    };
    cloudApplyRemote.__archiveStateV436=true;

    const basePush=cloudPushLocations;
    cloudPushLocations=async function archiveAwarePush(remoteLocations,syncState){
      syncState=syncState&&typeof syncState==='object'?syncState:{};syncState.dirtyLocations||=[];
      const sourceRows=remoteLocations||[];
      const relevantIds=new Set();
      const pushedStates=new Map();
      const rows=[];
      for(const row of sourceRows){
        const id=row.client_id||row.id,item=locations.find(entry=>entry.id===id),data=item?await getLocationData(id):{};
        if(relevantRow(row,data,item)){relevantIds.add(id);rows.push(cohereRow(row));await canonicalizeBase(id)}else rows.push(row);
      }
      for(const item of locations){
        if(!syncState.dirtyLocations.includes(item.id))continue;
        const data=await getLocationData(item.id),resolved=resolveLocalState(data,item);
        if(!resolved.state?.known&&!resolved.ambiguous)continue;
        relevantIds.add(item.id);
        if(resolved.ambiguous)throw new Error(`Не удалось определить состояние архива локации «${item.title||item.id}». Выберите «Восстановить» или «В архив» и повторите синхронизацию.`);
        assertValidState(item.title||item.id,resolved.state);
        await writeLocalState(item.id,item,resolved.state);pushedStates.set(item.id,resolved.state);diagnostics.explicitIntentsPreserved++;
      }
      if(!relevantIds.size)return basePush(sourceRows,syncState);
      await State.rawPut()(STORE,locations,'meta:locations');
      const result=await basePush(rows,syncState);
      for(const row of result||[]){
        const id=row.client_id||row.id;if(!relevantIds.has(id))continue;
        const item=locations.find(entry=>entry.id===id),state=stateFromRow(cohereRow(row));if(!item||!state.known)continue;
        assertValidState(item.title||id,state);
        await writeLocalState(id,item,state,{writeBaseRow:row,expectedPreviousState:pushedStates.get(id)||null,syncState});
        diagnostics.remoteStatesApplied++;
      }
      await State.rawPut()(STORE,locations,'meta:locations');
      return result;
    };
    cloudPushLocations.__archiveStateV436=true;

    function installSuiteActions(){
      const Suite=window.BogatkaSuite;if(!Suite)return false;
      const baseArchive=Suite.archiveLocation;
      if(typeof baseArchive==='function'&&!baseArchive.__archiveStateV436){
        const wrapped=async function(id){
          const result=await baseArchive.call(this,id),item=locations.find(entry=>entry.id===id);if(!item)return result;
          const data=await getLocationData(id),state=resolveLocalState(data,item).state;
          if(state?.kind==='archived'){
            const canonical={kind:'archived',known:true,value:normalizeArchiveTime(state.value)};
            await writeLocalState(id,item,canonical);await saveLocations();
          }
          return result;
        };
        wrapped.__archiveStateV436=true;wrapped.__base=baseArchive;Suite.archiveLocation=wrapped;
      }
      const restore=Suite.restoreArchivedLocation;
      if(typeof restore==='function'&&!restore.__archiveStateV436){
        const wrapped=async function(id){
          if(!canEdit())return denyViewerRestore();
          const item=locations.find(entry=>entry.id===id);if(!item)return false;
          const result=await mutateLocationData(id,item,(data,currentItem)=>{
            const previous=has(data,'archivedAt')?data.archivedAt:currentItem.archivedAt;
            data.archivedAt=null;currentItem.archivedAt=null;delete data.archivedBy;
            Suite.appendActivityToData?.(data,{action:'Локация восстановлена из архива',field:'archivedAt',label:'Архив',from:previous,to:'Активна'});
            data.updatedAt=new Date().toISOString();
            return true;
          });
          if(typeof cloudMarkLocationDirty==='function')cloudMarkLocationDirty(id);
          else markDirty(id);
          await saveLocations();renderLocations();
          return result.result;
        };
        wrapped.__archiveStateV436=true;wrapped.__base=restore;Suite.restoreArchivedLocation=wrapped;
      }
      return true;
    }

    function installSyncErrorTargetRecovery(){
      const api=window.BogatkaSyncCompatibility?._test;
      const baseClear=api?.clearSyncError;
      if(typeof baseClear!=='function'||baseClear.__archiveStateV436)return Boolean(api);
      const wrapped=function(){
        const targets=[...document.querySelectorAll('#cloudMessage.error')];
        const result=baseClear.apply(this,arguments);
        for(const target of targets){
          if(!target.isConnected)continue;
          target.className='cloud-message show success';
          target.replaceChildren();
          target.textContent='Синхронизация завершена.';
        }
        return result;
      };
      wrapped.__archiveStateV436=true;wrapped.__base=baseClear;api.clearSyncError=wrapped;
      return true;
    }

    window.cloudApplyRemote=cloudApplyRemote;window.cloudPushLocations=cloudPushLocations;
    try{cloudApplyRemote=window.cloudApplyRemote;cloudPushLocations=window.cloudPushLocations}catch(_){ }
    installSuiteActions();installSyncErrorTargetRecovery();
    const timer=setInterval(()=>{
      const suiteReady=installSuiteActions();
      const syncReady=installSyncErrorTargetRecovery();
      if(suiteReady&&syncReady)clearInterval(timer);
    },100);
    setTimeout(()=>clearInterval(timer),10000);

    window.BogatkaArchiveStateV436={version:'4.3.6',ready:true,installAttempts,installerPersistent:true,normalizeArchiveTime,normalizeArchiveFields,archiveState,stateFromRow,cohereRow,stripArchive,latestArchiveActivity,resolveLocalState,inferLegacyRestore,get diagnostics(){return{...diagnostics}},_test:{sameState,applyState,canonicalizeBase,writeLocalState,mutateLocationData,markDirty,currentRole,canEdit,enqueueLocation}};
    window.__bogatkaArchiveStateInstallingV436=false;
  }

  install();
})();
