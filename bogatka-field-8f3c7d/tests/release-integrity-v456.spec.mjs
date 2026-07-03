import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=456';

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaReleaseIntegrityV456?.ready&&window.BogatkaOpeningProjectV455?.ready&&window.BogatkaLaunchGateV454?.ready&&window.BogatkaTrafficCompetitorsV453?.ready),{timeout:30000});
  return page.locator('[data-location-card]').first();
}

async function writeCompleteSample(page,id){
  await page.evaluate(async locationId=>{
    const data=await getLocationData(locationId);
    data.traffic={weekdayMorning:'71',dogWalkers:'5'};
    data.trafficMeasurements=[{id:'traffic-local',date:'2026-07-02',startTime:'10:00',durationMinutes:'30',peopleCount:'44',weather:'Сухо'}];
    data.competitor={name:'Старый конкурент',distance:'300 м'};
    data.competitors=[{id:'competitor-local',name:'Новый конкурент',type:'Сетевой зоомагазин',distance:'5 минут'}];
    data.decision='Оставить';
    data.decisionReason='Проверено для релиза';
    data.criticalDealConditions=Object.fromEntries(window.BogatkaCriticalDeal.CONDITIONS.map(definition=>{
      const evidence=definition.evidenceTypes.find(option=>!['not_confirmed','oral_agreement'].includes(option.value))?.value||'other';
      return[definition.key,{status:'confirmed',evidenceType:evidence,note:evidence==='other'?'Документ':'',updatedAt:new Date().toISOString(),updatedBy:'test'}];
    }));
    delete data.launchProject;
    window.BogatkaSuite.ensureLaunchProject(data);
    data.updatedAt=new Date().toISOString();
    await idbPut(STORE,data,`location:${locationId}`);
  },id);
}

test('read-only audit accepts mixed legacy and new data without modifying it',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await writeCompleteSample(page,id);
  const result=await page.evaluate(async locationId=>{
    const before=JSON.stringify(await getLocationData(locationId));
    const audit=await window.BogatkaReleaseIntegrityV456.auditAll();
    const after=JSON.stringify(await getLocationData(locationId));
    return{audit,before,after};
  },id);
  expect(result.audit.ok,result.audit.failures.join('\n')).toBe(true);
  expect(result.after).toBe(result.before);
});

test('backup contains traffic, competitors and seven-phase opening project',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await writeCompleteSample(page,id);
  const backup=await page.evaluate(async()=>{
    const original=window.downloadBlob;
    let text='';
    window.downloadBlob=async blob=>{text=await blob.text();};
    try{await window.exportBackup();}finally{window.downloadBlob=original;}
    return JSON.parse(text);
  });
  const data=backup.records[`location:${id}`];
  expect(data.traffic.weekdayMorning).toBe('71');
  expect(data.trafficMeasurements[0].id).toBe('traffic-local');
  expect(data.competitor.name).toBe('Старый конкурент');
  expect(data.competitors[0].id).toBe('competitor-local');
  expect(data.launchProject.schemaVersion).toBe('4.5.5');
  expect(new Set(data.launchProject.milestones.map(item=>item.phase)).size).toBe(7);
});

test('field-wise sync merge preserves independent traffic, competitor and milestone changes',async({page})=>{
  await openApp(page);
  const merged=await page.evaluate(()=>{
    const base={trafficMeasurements:[{id:'t1',peopleCount:'10'}],competitors:[{id:'c1',name:'A'}],launchProject:{enabled:true,milestones:[{id:'m1',title:'Этап 1',status:'todo'}]}};
    const local={trafficMeasurements:[{id:'t1',peopleCount:'20'},{id:'t2',peopleCount:'30'}],competitors:[{id:'c1',name:'A'}],launchProject:{enabled:true,milestones:[{id:'m1',title:'Этап 1',status:'doing'}]}};
    const remote={trafficMeasurements:[{id:'t1',peopleCount:'10'}],competitors:[{id:'c1',name:'A'},{id:'c2',name:'B'}],launchProject:{enabled:true,milestones:[{id:'m1',title:'Этап 1',status:'todo'},{id:'m2',title:'Этап 2',status:'todo'}]}};
    return window.BogatkaSyncMerge.merge(base,local,remote,{preferLocal:true});
  });
  expect(merged.trafficMeasurements.map(item=>item.id).sort()).toEqual(['t1','t2']);
  expect(merged.trafficMeasurements.find(item=>item.id==='t1').peopleCount).toBe('20');
  expect(merged.competitors.map(item=>item.id).sort()).toEqual(['c1','c2']);
  expect(merged.launchProject.milestones.map(item=>item.id).sort()).toEqual(['m1','m2']);
  expect(merged.launchProject.milestones.find(item=>item.id==='m1').status).toBe('doing');
});

test('mobile layout has no horizontal overflow with stage 7-9 sections',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await writeCompleteSample(page,id);
  await page.evaluate(async()=>{
    renderLocations();
    await new Promise(resolve=>setTimeout(resolve,1200));
    await window.BogatkaTrafficCompetitorsV453.enhanceAll();
    await window.BogatkaLaunchGateV454.renderAll();
    await window.BogatkaOpeningProjectV455.renderAll();
    await window.BogatkaUIRefineV462?.completeRuntime?.();
  });
  await expect.poll(async()=>page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth),{timeout:5000}).toBeLessThanOrEqual(1);
});

test('all release assets are present in the Service Worker cache manifest',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async()=>{
    const worker=await fetch('./sw-v340.js').then(response=>response.text());
    const assets=['traffic-competitors-v453.js','launch-gate-v454.js','opening-project-v455.js','release-integrity-v456.js','report/traffic-competitors-v453.js','report/launch-gate-v454.js','report/opening-project-v455.js'];
    return assets.map(asset=>[asset,worker.includes(`./${asset}`)]);
  });
  expect(Object.fromEntries(result)).toEqual({
    'traffic-competitors-v453.js':true,
    'launch-gate-v454.js':true,
    'opening-project-v455.js':true,
    'release-integrity-v456.js':true,
    'report/traffic-competitors-v453.js':true,
    'report/launch-gate-v454.js':true,
    'report/opening-project-v455.js':true,
  });
});
