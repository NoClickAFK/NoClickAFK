(function(){
  if(window.BogatkaSyncMerge?.merge)return;
  const ABSENT=Symbol('absent');
  const isObject=value=>value&&typeof value==='object'&&!Array.isArray(value)&&!(value instanceof Blob);
  const clone=value=>value===ABSENT?ABSENT:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));

  function transportNormalize(value,inArray=false){
    if(value===ABSENT)return ABSENT;
    if(value===undefined||typeof value==='function'||typeof value==='symbol')return inArray?null:ABSENT;
    if(value===null||typeof value!=='object')return value;
    if(value instanceof Blob)return value;
    if(value instanceof Date)return value.toJSON();
    if(Array.isArray(value))return value.map(item=>{
      const normalized=transportNormalize(item,true);
      return normalized===ABSENT?null:normalized;
    });
    const result={};
    for(const key of Object.keys(value)){
      const normalized=transportNormalize(value[key],false);
      if(normalized!==ABSENT)result[key]=normalized;
    }
    return result;
  }

  function canonicalNormalized(value){
    if(value===ABSENT)return '__ABSENT__';
    if(Array.isArray(value))return `[${value.map(canonicalNormalized).join(',')}]`;
    if(isObject(value))return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonicalNormalized(value[key])}`).join(',')}}`;
    return JSON.stringify(value);
  }
  function canonical(value){return canonicalNormalized(transportNormalize(value));}
  const same=(left,right)=>canonical(left)===canonical(right);

  function emptyLike(value){
    if(value===ABSENT||value===null||value===undefined||value==='')return true;
    if(Array.isArray(value))return value.length===0;
    if(isObject(value))return Object.keys(value).length===0;
    return false;
  }
  function arraysHaveIds(...values){
    const items=values.filter(value=>value!==ABSENT&&Array.isArray(value)).flat();
    return items.length>0&&items.every(item=>isObject(item)&&item.id);
  }
  function mergeIdArray(base,local,remote,options,path){
    const b=base===ABSENT?[]:base,l=local===ABSENT?[]:local,r=remote===ABSENT?[]:remote;
    const bm=new Map(b.map(item=>[item.id,item])),lm=new Map(l.map(item=>[item.id,item])),rm=new Map(r.map(item=>[item.id,item]));
    const order=[...r,...l,...b].map(item=>item.id).filter((id,index,array)=>array.indexOf(id)===index);
    const result=[];
    for(const id of order){
      const value=mergeValue(bm.has(id)?bm.get(id):ABSENT,lm.has(id)?lm.get(id):ABSENT,rm.has(id)?rm.get(id):ABSENT,options,`${path}.${id}`);
      if(value!==ABSENT)result.push(value);
    }
    return result;
  }
  function mergeValue(base,local,remote,options={},path=''){
    if(same(local,remote))return clone(local);
    const localChanged=!same(local,base),remoteChanged=!same(remote,base);
    if(localChanged&&!remoteChanged)return clone(local);
    if(remoteChanged&&!localChanged)return clone(remote);
    if(!localChanged&&!remoteChanged)return clone(remote!==ABSENT?remote:local);
    if((path.endsWith('deletedTaskIds')||path.endsWith('deletedCommentIds'))&&Array.isArray(local)&&Array.isArray(remote))return [...new Set([...remote,...local])];
    if((Array.isArray(local)||local===ABSENT)&&(Array.isArray(remote)||remote===ABSENT)&&(Array.isArray(base)||base===ABSENT)){
      if(arraysHaveIds(base,local,remote))return mergeIdArray(base,local,remote,options,path);
      return clone(options.preferLocal&&!(!options.explicitReset&&base===ABSENT&&emptyLike(local)&&!emptyLike(remote))?local:remote);
    }
    if((isObject(local)||local===ABSENT)&&(isObject(remote)||remote===ABSENT)&&(isObject(base)||base===ABSENT)){
      const result={};
      const keys=new Set([...Object.keys(base===ABSENT?{}:base),...Object.keys(local===ABSENT?{}:local),...Object.keys(remote===ABSENT?{}:remote)]);
      for(const key of keys){
        const value=mergeValue(
          base!==ABSENT&&Object.hasOwn(base,key)?base[key]:ABSENT,
          local!==ABSENT&&Object.hasOwn(local,key)?local[key]:ABSENT,
          remote!==ABSENT&&Object.hasOwn(remote,key)?remote[key]:ABSENT,
          options,path?`${path}.${key}`:key,
        );
        if(value!==ABSENT)result[key]=value;
      }
      return result;
    }
    if(!options.explicitReset&&base===ABSENT&&emptyLike(local)&&!emptyLike(remote))return clone(remote);
    return clone(options.preferLocal?local:remote);
  }
  function clean(value){
    const copy=clone(value&&value!==ABSENT?value:{});
    delete copy.cloudId;delete copy.cloudRevision;delete copy.cloudUpdatedAt;delete copy.cloudBaseRevision;
    const normalized=transportNormalize(copy);
    return normalized===ABSENT?{}:normalized;
  }
  window.BogatkaSyncMerge={
    version:'4.3.5',ABSENT,same,clean,canonical,transportNormalize,
    merge(base,local,remote,options={}){
      return mergeValue(base===undefined?ABSENT:base,local===undefined?ABSENT:local,remote===undefined?ABSENT:remote,options,'form');
    },
  };
})();
