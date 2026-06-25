(function(){
  if(window.__bogatkaDiagnosticsV400)return;
  window.__bogatkaDiagnosticsV400=true;
  const STORAGE_KEY='bogatka_diagnostics_v400';
  const results=[];
  function check(name,condition,details=''){
    results.push({name,ok:Boolean(condition),details:String(details||''),at:new Date().toISOString()});
  }
  async function run(){
    results.length=0;
    try{
      check('BogatkaSuite',Boolean(window.BogatkaSuite));
      check('DecisionEngine',Boolean(window.BogatkaDecisionEngine?.computeAll));
      check('SuiteUI',Boolean(window.BogatkaSuiteUI?.refresh));
      check('Cloud sync',typeof window.cloudSyncAll==='function');
      check('HTML report',typeof window.buildReportHtml==='function');
      check('Backup',typeof window.exportBackup==='function');
      check('Archive',typeof window.BogatkaSuite?.archiveLocation==='function');
      check('Tasks and comments',typeof window.BogatkaSuite?.addTask==='function'&&typeof window.BogatkaSuite?.addComment==='function');
      check('Launch project',typeof window.BogatkaSuite?.ensureLaunchProject==='function');
      check('Duplicate detection',typeof window.BogatkaSuite?.findAddressDuplicate==='function');

      const economy=window.BogatkaSuite?.calculateEconomy({tech:{totalArea:'100',rentPerMonth:'2000',utilities:'300'},economy:{monthlyRevenue:'20000',grossMarginPct:'35',taxRatePct:'5',payroll:'2000',marketing:'300',logistics:'200',otherOpex:'200',initialStock:'10000'}});
      check('Rent per sqm calculation',Math.abs((economy?.rentPerSqm||0)-20)<0.001,JSON.stringify(economy||{}));
      check('Rent burden calculation',Math.abs((economy?.rentBurdenPct||0)-10)<0.001,JSON.stringify(economy||{}));
      check('Operating profit calculation',Number.isFinite(economy?.operatingProfit),JSON.stringify(economy||{}));

      const weights=window.BogatkaDecisionEngine?.WEIGHTS||{};
      const weightTotal=Object.values(weights).reduce((sum,value)=>sum+Number(value||0),0);
      check('Weighted score total',weightTotal===100,`total=${weightTotal}`);

      const plan=window.BogatkaSuite?.photoPlanFor('diagnostic',[{locationId:'diagnostic',category:'street'},{locationId:'diagnostic',category:'street'},{locationId:'diagnostic',category:'entrance'}]);
      check('Photo plan calculation',plan?.total===3&&plan?.requiredTotal>3,JSON.stringify(plan||{}));

      const duplicate=window.BogatkaSuite?.normalizeAddress('Гродно, ул. Лидская, 34');
      check('Address normalization',duplicate==='лидская 34',duplicate);

      const ids=[...document.querySelectorAll('[id]')].map(element=>element.id);
      const duplicates=ids.filter((id,index)=>ids.indexOf(id)!==index);
      check('Unique DOM ids',duplicates.length===0,duplicates.join(','));

      if(typeof idbPut==='function'&&typeof idbGet==='function'&&typeof idbDelete==='function'&&typeof STORE!=='undefined'){
        const key='diagnostic:v400';
        await idbPut(STORE,{value:'ok',at:new Date().toISOString()},key);
        const saved=await idbGet(STORE,key);
        check('IndexedDB roundtrip',saved?.value==='ok',JSON.stringify(saved||{}));
        await idbDelete(STORE,key);
      }else check('IndexedDB roundtrip',false,'database functions unavailable');

      const failures=results.filter(item=>!item.ok);
      localStorage.setItem(STORAGE_KEY,JSON.stringify({version:'4.0.0',at:new Date().toISOString(),ok:failures.length===0,results}));
      render(failures);
      return {ok:failures.length===0,results};
    }catch(error){
      check('Diagnostics runtime',false,error?.stack||error?.message||String(error));
      localStorage.setItem(STORAGE_KEY,JSON.stringify({version:'4.0.0',at:new Date().toISOString(),ok:false,results}));
      render(results.filter(item=>!item.ok));
      return {ok:false,results};
    }
  }
  function render(failures){
    const statusbar=document.querySelector('.statusbar');
    if(!statusbar)return;
    let pill=document.getElementById('diagnosticsPillV400');
    if(!pill){pill=document.createElement('span');pill.id='diagnosticsPillV400';pill.className='pill diagnostics-pill-v400';statusbar.appendChild(pill)}
    pill.classList.toggle('error',failures.length>0);
    pill.textContent=failures.length?`Самопроверка: ${failures.length} ошибок`:'Самопроверка: OK';
    pill.title=failures.length?failures.map(item=>`${item.name}: ${item.details}`).join('\n'):'Базовые программные проверки пройдены';
  }
  window.BogatkaDiagnostics={run,getLast(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch(_){return null}}};
  setTimeout(()=>run().catch(console.error),2200);
})();
