(function(){
  if(window.BogatkaSyncFieldCompatV416?.ready)return;

  const VERSION='4.1.6';
  let attempts=0;

  function cloneForm(value){
    if(!value||typeof value!=='object'||Array.isArray(value))return {};
    try{return structuredClone(value)}catch(_){return {...value}}
  }

  function isMissing(value){
    return value===undefined||value===null||value==='';
  }

  function hydrateRow(row){
    if(!row||typeof row!=='object')return row;
    const form=cloneForm(row.form_data);
    if(!isMissing(row.status))form.status=row.status;
    if(!isMissing(row.object_type))form.objectType=row.object_type;
    return {...row,form_data:form};
  }

  function hydrateRows(rows){
    return Array.isArray(rows)?rows.map(hydrateRow):[];
  }

  function wrapFetch(){
    if(typeof cloudFetchRemote!=='function')return false;
    if(cloudFetchRemote.__syncFieldCompatV416)return true;
    const base=cloudFetchRemote;
    const wrapped=async function(...args){
      const result=await base(...args);
      if(!result||typeof result!=='object')return result;
      return {...result,remoteLocations:hydrateRows(result.remoteLocations)};
    };
    wrapped.__syncFieldCompatV416=true;
    wrapped.__base=base;
    cloudFetchRemote=wrapped;
    window.cloudFetchRemote=wrapped;
    return true;
  }

  function wrapApply(){
    if(typeof cloudApplyRemote!=='function')return false;
    if(cloudApplyRemote.__syncFieldCompatV416)return true;
    const base=cloudApplyRemote;
    const wrapped=async function(remoteLocations,...rest){
      return base(hydrateRows(remoteLocations),...rest);
    };
    wrapped.__syncFieldCompatV416=true;
    wrapped.__base=base;
    cloudApplyRemote=wrapped;
    window.cloudApplyRemote=wrapped;
    return true;
  }

  function install(){
    attempts+=1;
    wrapFetch();
    wrapApply();
    if(attempts<120)setTimeout(install,250);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  window.addEventListener('load',()=>setTimeout(install,80),{once:true});

  window.BogatkaSyncFieldCompatV416={
    version:VERSION,
    ready:true,
    hydrateRow,
    hydrateRows,
    install,
    audit(row){
      const hydrated=hydrateRow(row)||{};
      return {
        status:hydrated.form_data?.status??null,
        objectType:hydrated.form_data?.objectType??null,
        hasStatusColumn:!isMissing(row?.status),
        hasObjectTypeColumn:!isMissing(row?.object_type),
      };
    },
  };
})();
