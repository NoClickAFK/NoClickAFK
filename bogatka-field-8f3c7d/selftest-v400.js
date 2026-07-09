(function(){
  if(window.__bogatkaSelftestV400)return;
  window.__bogatkaSelftestV400=true;
  const FILES=[
    './decision-core-v340.js','./suite-core-v400.js','./decision-ui-v340.js','./compare-v340.js',
    './suite-ui-v400.js','./archive-label-v400.js','./backup-v400.js','./report-v400.js','./access-version-v400.js',
    './report/app.js','./report/fix-v400.js'
  ];
  async function run(){
    const checks=[];
    const add=(name,ok,details='')=>checks.push({name,ok:Boolean(ok),details:String(details||'')});
    add('workflow',Boolean(window.BogatkaSuite));
    add('decision',Boolean(window.BogatkaDecisionEngine?.computeAll));
    add('interface',Boolean(window.BogatkaSuiteUI?.refresh));
    add('cloud',typeof window.cloudSyncAll==='function');
    add('report',typeof window.buildReportHtml==='function');
    add('backup',typeof window.exportBackup==='function');
    const economy=window.BogatkaSuite?.calculateEconomy({tech:{totalArea:'100',rentPerMonth:'2000'},economy:{monthlyRevenue:'20000',grossMarginPct:'35',taxRatePct:'5',payroll:'2000'}});
    add('rent per sqm',Math.abs((economy?.rentPerSqm||0)-20)<0.001,JSON.stringify(economy||{}));
    add('rent burden',Math.abs((economy?.rentBurdenPct||0)-10)<0.001,JSON.stringify(economy||{}));
    const weights=Object.values(window.BogatkaDecisionEngine?.WEIGHTS||{}).reduce((sum,value)=>sum+Number(value||0),0);
    add('weights total',weights===100,weights);
    const plan=window.BogatkaSuite?.photoPlanFor('test',[{locationId:'test',category:'street'},{locationId:'test',category:'entrance'}]);
    add('photo plan',plan?.total===2&&plan?.requiredTotal===24,JSON.stringify(plan||{}));
    add('address normalization',window.BogatkaSuite?.normalizeAddress('Гродно, ул. Лидская, 34')==='лидская 34',window.BogatkaSuite?.normalizeAddress('Гродно, ул. Лидская, 34'));
    try{
      const metrics=await window.BogatkaDecisionEngine.computeAll();
      add('metrics calculation',Array.isArray(metrics),`count=${metrics?.length}`);
    }catch(error){add('metrics calculation',false,error?.stack||error)}
    try{
      const html=await window.buildReportHtml();
      add('HTML report build',typeof html==='string'&&html.includes('<html')&&html.includes('Отчёт'),`length=${html?.length||0}`);
    }catch(error){add('HTML report build',false,error?.stack||error)}
    for(const file of FILES){
      try{
        const response=await fetch(file,{cache:'no-store'});
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        const source=await response.text();
        new Function(source);
        add(`syntax ${file}`,true);
      }catch(error){add(`syntax ${file}`,false,error?.message||error)}
    }
    const failures=checks.filter(check=>!check.ok);
    const result={version:'4.3.0',at:new Date().toISOString(),ok:failures.length===0,checks};
    localStorage.setItem('bogatka_selftest_v400',JSON.stringify(result));
    const statusbar=document.querySelector('.statusbar');
    if(statusbar){
      let pill=document.getElementById('diagnosticsPillV400');
      if(!pill){pill=document.createElement('span');pill.id='diagnosticsPillV400';pill.className='pill';statusbar.appendChild(pill)}
      pill.textContent=failures.length?`Самопроверка: ${failures.length} ошибок`:'Самопроверка: OK';
      pill.title=failures.length?failures.map(item=>`${item.name}: ${item.details}`).join('\n'):'Код, расчёты и формирование отчёта проверены';
    }
    return result;
  }
  window.BogatkaSelftest={run,getLast(){try{return JSON.parse(localStorage.getItem('bogatka_selftest_v400')||'null')}catch(_){return null}}};
  setTimeout(()=>run().catch(console.error),3200);
})();
