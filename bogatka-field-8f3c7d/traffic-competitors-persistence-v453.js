(function(){
  'use strict';
  if(window.BogatkaTrafficCompetitorsPersistenceV453?.ready)return;

  const VERSION='4.5.8';
  const EMPTY_WEEKDAY_GUIDANCE='День недели определится автоматически после выбора даты. Показатели целевой аудитории, конкурента и парковки заполняйте только при наличии наблюдаемых данных';
  const NUMERIC_FIELDS=new Set(['peopleCount','targetCustomers','dogWalkers','competitorVisitors','parkingOccupiedPct']);
  const timers=new Map();
  const activeWrites=new Set();
  const isViewer=()=>{try{return window.cloudRole==='viewer'||cloudRole==='viewer'}catch(_){return false}};

  function weekday(value){
    if(!value)return EMPTY_WEEKDAY_GUIDANCE;
    const date=new Date(`${value}T12:00:00`);
    if(Number.isNaN(date.getTime()))return'Проверьте дату';
    const label=date.toLocaleDateString('ru-RU',{weekday:'long'});
    return label.charAt(0).toUpperCase()+label.slice(1);
  }

  function validNumber(field,value){
    if(value==='')return true;
    const number=Number(value);
    if(!Number.isFinite(number)||number<0||!Number.isInteger(number))return false;
    return field!=='parkingOccupiedPct'||number<=100;
  }

  function validate(target,eventType){
    const field=target?.dataset?.stage7Field;
    if(!NUMERIC_FIELDS.has(field))return true;
    const valid=validNumber(field,target.value);
    target.setCustomValidity(valid?'':field==='parkingOccupiedPct'?'Введите значение от 0 до 100':'Введите целое число не меньше нуля');
    if(valid){
      target.dataset.lastValidValue=target.value;
      return true;
    }
    if(eventType==='change'){
      target.value=target.dataset.lastValidValue??'';
      target.setCustomValidity('');
    }
    return false;
  }

  function summaryNumber(control){
    const field=control?.dataset?.stage7Field;
    const value=String(control?.value??'');
    if(NUMERIC_FIELDS.has(field)&&!validNumber(field,value))return 0;
    const number=Number(value);
    return Number.isFinite(number)&&number>0?number:0;
  }

  function updateSummary(card){
    const rows=[...card.querySelectorAll('.traffic-measurement-v453')];
    const values={
      count:rows.length,
      minutes:rows.reduce((sum,row)=>sum+summaryNumber(row.querySelector('[data-stage7-field="durationMinutes"]')),0),
      people:rows.reduce((sum,row)=>sum+summaryNumber(row.querySelector('[data-stage7-field="peopleCount"]')),0),
    };
    Object.entries(values).forEach(([key,value])=>{const node=card.querySelector(`[data-traffic-summary-v453="${key}"]`);if(node)node.textContent=String(value);});
  }

  function enqueueShared(locationId,task){
    const shared=window.BogatkaFieldIntegrityV416?.enqueueLocation;
    const promise=typeof shared==='function'?shared(locationId,task):Promise.resolve().then(task);
    activeWrites.add(promise);
    return promise.finally(()=>activeWrites.delete(promise));
  }

  function schedule(target,collection,rowId,field,value){
    const card=target.closest('[data-location-card]');
    const locationId=card?.dataset.locationCard;
    if(!locationId||!rowId||!field||isViewer())return;
    const key=`${locationId}:${collection}:${rowId}:${field}`;
    clearTimeout(timers.get(key));
    window.showSaving?.();
    timers.set(key,setTimeout(()=>{
      timers.delete(key);
      if(isViewer())return;
      enqueueShared(locationId,async()=>{
        const data=await getLocationData(locationId);
        const rows=Array.isArray(data[collection])?data[collection].map(item=>({...item})):[];
        const index=rows.findIndex(item=>item?.id===rowId);
        if(index<0)return false;
        rows[index][field]=value;
        rows[index].updatedAt=new Date().toISOString();
        data[collection]=rows;
        data.updatedAt=new Date().toISOString();
        await idbPut(STORE,data,`location:${locationId}`);
        window.updateLocationTotal?.(locationId,data);
        await window.updateSummary?.();
        return true;
      }).then(()=>window.showSaved?.()).catch(error=>window.showError?.(error)||console.error(error));
    },180));
  }

  function handle(event){
    const target=event.target;
    if(!target?.matches?.('[data-stage7-field]'))return;
    const traffic=target.closest('.traffic-measurement-v453');
    const competitor=target.closest('.competitor-card-v453[data-competitor-legacy="0"]');
    if(!traffic&&!competitor)return;
    if(isViewer())return;
    event.stopImmediatePropagation();
    event.stopPropagation();
    const field=target.dataset.stage7Field;
    if(traffic&&!validate(target,event.type)){
      updateSummary(traffic.closest('[data-location-card]'));
      return;
    }
    const value=target.type==='checkbox'?target.checked:target.value;
    if(traffic){
      if(field==='date')traffic.querySelector('[data-weekday-v453]')?.replaceChildren(weekday(value));
      updateSummary(traffic.closest('[data-location-card]'));
      schedule(target,'trafficMeasurements',traffic.dataset.trafficId,field,value);
    }else{
      schedule(target,'competitors',competitor.dataset.competitorId,field,value);
    }
  }

  document.addEventListener('input',handle,true);
  document.addEventListener('change',handle,true);

  window.BogatkaTrafficCompetitorsPersistenceV453={version:VERSION,ready:true,updateSummary,enqueueShared,validate,get pendingWrites(){return timers.size+activeWrites.size;}};
})();
