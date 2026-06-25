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
  function diagnose(){
    const checks=[
      ['workflow',Boolean(window.BogatkaSuite)],
      ['decision',Boolean(window.BogatkaDecisionEngine?.computeAll)],
      ['interface',Boolean(window.BogatkaSuiteUI?.refresh)],
      ['cloud',typeof window.cloudSyncAll==='function'],
      ['report',typeof window.buildReportHtml==='function'],
      ['backup',typeof window.exportBackup==='function']
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
  apply();
  let timer=null;
  new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(apply,60)}).observe(document.body,{childList:true,subtree:true});
  setInterval(apply,1500);
  setTimeout(diagnose,2500);
})();
