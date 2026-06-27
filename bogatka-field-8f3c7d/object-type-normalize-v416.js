(function(){
  if(window.BogatkaObjectTypeNormalizeV416?.ready)return;
  const running=new Set();
  let timer=null;

  function normalize(value){
    const shared=window.BogatkaSyncFieldCompatV416?.normalizeObjectType;
    if(typeof shared==='function')return shared(value);
    const text=String(value??'').trim();
    return ['Магазин с отдельным входом с улицы','Стрит ритейл','Street retail','street retail','street-retail'].includes(text)?'Стрит-ритейл':text;
  }

  async function repair(){
    if(typeof getLocationData!=='function'||typeof idbPut!=='function'||typeof STORE==='undefined')return;
    for(const select of document.querySelectorAll('select[data-location][data-field="objectType"]')){
      const id=select.dataset.location;
      if(!id||running.has(id)||document.activeElement===select)continue;
      running.add(id);
      try{
        const data=await getLocationData(id);
        const canonical=normalize(data.objectType);
        if(data.objectType&&canonical&&data.objectType!==canonical){
          data.objectType=canonical;
          data.updatedAt=new Date().toISOString();
          await idbPut(STORE,data,'location:'+id);
        }
        if(canonical&&select.value!==canonical){
          select.value=canonical;
          window.BogatkaSelectSync?.syncVisibleSelect?.(select);
        }
      }catch(error){console.warn('Не удалось нормализовать тип объекта',error)}
      finally{running.delete(id)}
    }
  }

  function schedule(){
    clearTimeout(timer);
    timer=setTimeout(()=>repair().catch(console.error),20);
  }

  function install(){
    schedule();
    const root=document.getElementById('locations')||document.body;
    new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  window.BogatkaObjectTypeNormalizeV416={version:'4.1.6',ready:true,normalize,repair};
})();
