(function(){
  if(window.__bogatkaArchiveLabelV400)return;
  window.__bogatkaArchiveLabelV400=true;
  function canEdit(){return typeof cloudRole==='undefined'||cloudRole!=='viewer'}
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
      S.appendActivityToData(data,{action:'Изменён проект открытия',field:`launchProject.${path}`,label:path,from:previous,to:value});
      data.updatedAt=new Date().toISOString();
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
  function diagnose(){
    const checks=[
      ['workflow',Boolean(window.BogatkaSuite)],['decision',Boolean(window.BogatkaDecisionEngine?.computeAll)],['interface',Boolean(window.BogatkaSuiteUI?.refresh)],['cloud',typeof window.cloudSyncAll==='function'],['report',typeof window.buildReportHtml==='function'],['backup',typeof window.exportBackup==='function']
    ];
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
  function installAll(){apply();stabilizeLaunchEditing();stabilizeArchiveFilter();installAutoRent();installArchiveAwareClear()}
  installAll();
  let timer=null;
  new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(installAll,60)}).observe(document.body,{childList:true,subtree:true});
  setInterval(installAll,1500);
  setTimeout(diagnose,2500);
})();
