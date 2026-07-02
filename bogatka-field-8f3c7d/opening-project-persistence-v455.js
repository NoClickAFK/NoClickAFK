(function(){
  'use strict';
  if(window.BogatkaOpeningProjectPersistenceV455?.ready)return;

  const VERSION='4.5.8';
  const activeWrites=new Set();
  let lastError=null;
  const isViewer=()=>{try{return window.cloudRole==='viewer'||cloudRole==='viewer'}catch(_){return false}};
  const now=()=>new Date().toISOString();

  function enqueue(locationId,task){
    const shared=window.BogatkaFieldIntegrityV416?.enqueueLocation;
    const promise=typeof shared==='function'?shared(locationId,task):Promise.resolve().then(task);
    activeWrites.add(promise);
    return promise.finally(()=>activeWrites.delete(promise));
  }

  function finish(result){
    Promise.resolve(result).finally(()=>{if(activeWrites.size===0)window.showSaved?.();});
  }

  async function updateProject(locationId,mutator){
    if(isViewer())return false;
    window.showSaving?.();
    const result=enqueue(locationId,async()=>{
      const data=await getLocationData(locationId);
      if(!data.launchProject?.enabled)return false;
      const project={...data.launchProject,milestones:Array.isArray(data.launchProject.milestones)?data.launchProject.milestones.map(item=>({...item})):[]};
      const changed=mutator(project,data);
      if(changed===false)return false;
      project.updatedAt=now();
      data.launchProject=project;
      data.updatedAt=now();
      await idbPut(STORE,data,`location:${locationId}`);
      window.updateLocationTotal?.(locationId,data);
      await window.updateSummary?.();
      return true;
    });
    result.catch(error=>{lastError=error;window.showError?.(error)||console.error(error);});
    finish(result);
    return result;
  }

  function updateField(locationId,field,value){
    return updateProject(locationId,project=>{
      if(String(project[field]??'')===String(value??''))return false;
      project[field]=value;
      return true;
    });
  }

  function updateMilestone(locationId,milestoneId,patch){
    return updateProject(locationId,project=>{
      const index=project.milestones.findIndex(item=>item.id===milestoneId);
      if(index<0)return false;
      project.milestones[index]={...project.milestones[index],...patch,updatedAt:now()};
      return true;
    });
  }

  function updateLocalProgress(root){
    const rows=[...root.querySelectorAll('.launch-v455-milestone')];
    const done=rows.filter(row=>row.querySelector('[data-launch-v455-status]')?.value==='done').length;
    const percent=rows.length?Math.round(done/rows.length*100):0;
    const bar=root.querySelector('.launch-v455-progress>span');if(bar)bar.style.width=`${percent}%`;
    const total=root.querySelector('.launch-v455-overview>div:last-child strong');if(total)total.textContent=`${done}/${rows.length} · ${percent}%`;
    rows.forEach(row=>row.classList.toggle('done',row.querySelector('[data-launch-v455-status]')?.value==='done'));
  }

  function handleChange(event){
    const target=event.target;
    const root=target?.closest?.('.launch-v455');
    const card=root?.closest?.('[data-location-card]');
    const locationId=card?.dataset?.locationCard;
    if(!root||!locationId||isViewer())return;

    const field=target.dataset.launchV455Field;
    const statusId=target.dataset.launchV455Status;
    const assigneeId=target.dataset.launchV455Assignee;
    const dateId=target.dataset.launchV455Date;
    if(!field&&!statusId&&!assigneeId&&!dateId)return;

    event.stopImmediatePropagation();
    event.stopPropagation();
    if(field)updateField(locationId,field,target.value);
    else if(statusId){updateLocalProgress(root);updateMilestone(locationId,statusId,{status:target.value});}
    else if(assigneeId)updateMilestone(locationId,assigneeId,{assignee:target.value});
    else if(dateId)updateMilestone(locationId,dateId,{dueDate:target.value});
  }

  document.addEventListener('change',handleChange,true);

  window.BogatkaOpeningProjectPersistenceV455={version:VERSION,ready:true,updateField,updateMilestone,updateProject,enqueue,get pendingWrites(){return activeWrites.size},get lastError(){return lastError;}};
})();