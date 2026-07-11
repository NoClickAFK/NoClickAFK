(function(){
  if(window.BogatkaArchiveStateV436?.ready)return;
  const Merge=window.BogatkaSyncMerge;
  const State=window.BogatkaSyncState;
  if(!Merge?.merge||!State?.ready||typeof cloudApplyRemote!=='function'||typeof cloudPushLocations!=='function')return;

  const ARCHIVE_KEYS=new Set(['archivedAt','archived_at']);
  const original={
    transportNormalize:Merge.transportNormalize.bind(Merge),
    canonical:Merge.canonical.bind(Merge),
    same:Merge.same.bind(Merge),
    clean:Merge.clean.bind(Merge),
    merge:Merge.merge.bind(Merge),
  };
  const diagnostics={normalized:0,invalid:0,legacyRestores:0,explicitIntentsPreserved:0,remoteStatesApplied:0,ambiguousStates:0};
  const has=(value,key)=>Boolean(value&&typeof value==='object'&&Object.hasOwn(value,key));
  const clone=value=>value===undefined?undefined:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));

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
    row.form_data=normalizeArchiveFields(row.form_data||{});
    const state=stateFromRow(row);
    if(state.known){applyState(row,'archived_at',state);applyState(row.form_data,'archivedAt',state)}
    return row;
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
  Merge.merge=(base,local,remote,options={})=>normalizeArchiveFields(original.merge(normalizeArchiveFields(base),normalizeArchiveFields(local),normalizeArchiveFields(remote),options));
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
    const remoteTime=Date.parse(remote.value)||0;
    return activity.time>remoteTime;
  }

  function markDirty(id,syncState){
    syncState.dirtyLocations||=[];
    if(!syncState.dirtyLocations.includes(id))syncState.dirtyLocations.push(id);
    if(typeof cloudReadState==='function'&&typeof cloudWriteState==='function'){
      const stored=cloudReadState();stored.dirtyLocations||=[];
      if(!stored.dirtyLocations.includes(id))stored.dirtyLocations.push(id);
      cloudWriteState(stored);
    }
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

  async function writeLocalState(id,item,state,{writeBaseRow=null}={}){
    const data=normalizeArchiveFields(await getLocationData(id)||{});
    applyState(data,'archivedAt',state);
    applyState(item,'archivedAt',state);
    await State.rawPut()(STORE,data,`location:${id}`);
    if(writeBaseRow){
      const row=cohereRow(writeBaseRow);
      const base={revision:Number(row.revision||0),updatedAt:row.updated_at||'',formData:Merge.clean(row.form_data||{}),meta:{title:row.title||'',address:row.address||'',note:row.note||'',sortOrder:Number(row.sort_order||0)}};
      applyState(base.formData,'archivedAt',stateFromRow(row));
      applyState(base.meta,'archivedAt',stateFromRow(row));
      await State.writeBase(id,base);
    }
  }

  function assertValidState(id,state){
    if(!state?.known)return;
    if(state.kind==='invalid'||state.kind==='empty')throw new Error(`Некорректное состояние архива локации «${id}». Повторно выберите «В архив» или «Восстановить».`);
  }

  const baseApply=cloudApplyRemote;
  cloudApplyRemote=async function archiveAwareApply(remoteLocations,remotePhotos,remoteState,syncState){
    remoteLocations=(remoteLocations||[]).map(row=>cohereRow(row));
    syncState=syncState&&typeof syncState==='object'?syncState:{};
    syncState.dirtyLocations||=[];
    const intents=new Map();
    let metaChanged=false;
    for(const row of remoteLocations){
      const id=row.client_id||row.id;
      let item=locations.find(entry=>entry.id===id);
      const data=item?await getLocationData(id):{};
      await canonicalizeBase(id);
      if(item&&inferLegacyRestore(data,item,row)){
        const active={kind:'active',known:true,value:null};
        applyState(data,'archivedAt',active);applyState(item,'archivedAt',active);
        await State.rawPut()(STORE,data,`location:${id}`);
        markDirty(id,syncState);intents.set(id,active);metaChanged=true;diagnostics.legacyRestores++;
      }else if(item&&syncState.dirtyLocations.includes(id)){
        const resolved=resolveLocalState(data,item);
        if(resolved.ambiguous)throw new Error(`Не удалось определить состояние архива локации «${item.title||id}». Выберите «Восстановить» или «В архив» и повторите синхронизацию.`);
        assertValidState(item.title||id,resolved.state);
        if(resolved.state?.known){intents.set(id,resolved.state);diagnostics.explicitIntentsPreserved++}
      }
    }
    if(metaChanged)await State.rawPut()(STORE,locations,'meta:locations');
    await baseApply(remoteLocations,remotePhotos,remoteState,syncState);
    for(const row of remoteLocations){
      const id=row.client_id||row.id,item=locations.find(entry=>entry.id===id);
      if(!item)continue;
      const intent=intents.get(id);
      if(intent){await writeLocalState(id,item,intent);continue}
      const remoteArchive=stateFromRow(row);assertValidState(item.title||id,remoteArchive);
      if(remoteArchive.known){await writeLocalState(id,item,remoteArchive,{writeBaseRow:row});diagnostics.remoteStatesApplied++}
    }
    if(remoteLocations.length)await State.rawPut()(STORE,locations,'meta:locations');
  };
  cloudApplyRemote.__archiveStateV436=true;

  const basePush=cloudPushLocations;
  cloudPushLocations=async function archiveAwarePush(remoteLocations,syncState){
    remoteLocations=(remoteLocations||[]).map(row=>cohereRow(row));
    syncState=syncState&&typeof syncState==='object'?syncState:{};
    syncState.dirtyLocations||=[];
    for(const item of locations){
      await canonicalizeBase(item.id);
      const data=await getLocationData(item.id);
      const resolved=resolveLocalState(data,item);
      if(resolved.ambiguous&&syncState.dirtyLocations.includes(item.id))throw new Error(`Не удалось определить состояние архива локации «${item.title||item.id}». Выберите «Восстановить» или «В архив» и повторите синхронизацию.`);
      if(resolved.state?.known){
        assertValidState(item.title||item.id,resolved.state);
        if(syncState.dirtyLocations.includes(item.id)){
          applyState(data,'archivedAt',resolved.state);applyState(item,'archivedAt',resolved.state);
          await State.rawPut()(STORE,data,`location:${item.id}`);
        }
      }
    }
    await State.rawPut()(STORE,locations,'meta:locations');
    const rows=(await basePush(remoteLocations,syncState)||[]).map(row=>cohereRow(row));
    for(const row of rows){
      const id=row.client_id||row.id,item=locations.find(entry=>entry.id===id);if(!item)continue;
      const state=stateFromRow(row);assertValidState(item.title||id,state);
      if(state.known)await writeLocalState(id,item,state,{writeBaseRow:row});
    }
    await State.rawPut()(STORE,locations,'meta:locations');
    return rows;
  };
  cloudPushLocations.__archiveStateV436=true;

  function installSuiteActions(){
    const Suite=window.BogatkaSuite;if(!Suite)return false;
    const baseArchive=Suite.archiveLocation;
    if(typeof baseArchive==='function'&&!baseArchive.__archiveStateV436){
      const wrapped=async function(id){
        const result=await baseArchive.call(this,id);
        const item=locations.find(entry=>entry.id===id);if(!item)return result;
        const data=await getLocationData(id);const state=resolveLocalState(data,item).state;
        if(state?.kind==='archived'){
          const canonical={kind:'archived',known:true,value:normalizeArchiveTime(state.value)};
          applyState(data,'archivedAt',canonical);applyState(item,'archivedAt',canonical);
          await idbPut(STORE,data,`location:${id}`);await saveLocations();
        }
        return result;
      };
      wrapped.__archiveStateV436=true;wrapped.__base=baseArchive;Suite.archiveLocation=wrapped;
    }
    const restore=Suite.restoreArchivedLocation;
    if(typeof restore==='function'&&!restore.__archiveStateV436){
      const wrapped=async function(id){
        const item=locations.find(entry=>entry.id===id);if(!item)return;
        const data=await getLocationData(id);const previous=has(data,'archivedAt')?data.archivedAt:item.archivedAt;
        data.archivedAt=null;item.archivedAt=null;delete data.archivedBy;
        Suite.appendActivityToData?.(data,{action:'Локация восстановлена из архива',field:'archivedAt',label:'Архив',from:previous,to:'Активна'});
        data.updatedAt=new Date().toISOString();
        await idbPut(STORE,data,`location:${id}`);await saveLocations();renderLocations();
      };
      wrapped.__archiveStateV436=true;wrapped.__base=restore;Suite.restoreArchivedLocation=wrapped;
    }
    return true;
  }

  window.cloudApplyRemote=cloudApplyRemote;window.cloudPushLocations=cloudPushLocations;
  try{cloudApplyRemote=window.cloudApplyRemote;cloudPushLocations=window.cloudPushLocations}catch(_){ }
  installSuiteActions();
  const timer=setInterval(()=>{if(installSuiteActions())clearInterval(timer)},100);
  setTimeout(()=>clearInterval(timer),10000);

  window.BogatkaArchiveStateV436={
    version:'4.3.6',ready:true,normalizeArchiveTime,normalizeArchiveFields,archiveState,stateFromRow,cohereRow,stripArchive,latestArchiveActivity,resolveLocalState,inferLegacyRestore,
    get diagnostics(){return{...diagnostics}},
    _test:{sameState,applyState,canonicalizeBase,writeLocalState,markDirty},
  };
})();
