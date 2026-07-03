import {test} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=456';

test('diagnose stage 7-9 mobile overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaReleaseIntegrityV456?.ready&&window.BogatkaOpeningProjectV455?.ready&&window.BogatkaLaunchGateV454?.ready&&window.BogatkaTrafficCompetitorsV453?.ready),{timeout:30000});
  const id=await page.locator('[data-location-card]').first().getAttribute('data-location-card');
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
    renderLocations();
    await new Promise(resolve=>setTimeout(resolve,1200));
    await window.BogatkaTrafficCompetitorsV453.enhanceAll();
    await window.BogatkaLaunchGateV454.renderAll();
    await window.BogatkaOpeningProjectV455.renderAll();
  },id);
  const report=await page.evaluate(()=>{
    const viewport=document.documentElement.clientWidth;
    const path=node=>{
      const parts=[];
      for(let current=node;current&&current.nodeType===1&&parts.length<8;current=current.parentElement){
        let part=current.tagName.toLowerCase();
        if(current.id)part+=`#${current.id}`;
        else if(current.classList.length)part+=`.${[...current.classList].slice(0,4).join('.')}`;
        parts.unshift(part);
      }
      return parts.join(' > ');
    };
    const nodes=[...document.querySelectorAll('body *')].map(node=>{
      const rect=node.getBoundingClientRect();
      const style=getComputedStyle(node);
      return{path:path(node),left:Math.round(rect.left*10)/10,right:Math.round(rect.right*10)/10,width:Math.round(rect.width*10)/10,clientWidth:node.clientWidth,scrollWidth:node.scrollWidth,display:style.display,position:style.position,minWidth:style.minWidth,maxWidth:style.maxWidth,overflowX:style.overflowX,whiteSpace:style.whiteSpace,grid:style.gridTemplateColumns,text:String(node.textContent||'').replace(/\s+/g,' ').trim().slice(0,120)};
    }).filter(item=>item.right>viewport+1||item.left<-1||item.scrollWidth>item.clientWidth+1)
      .sort((a,b)=>Math.max(b.right-viewport,b.scrollWidth-b.clientWidth)-Math.max(a.right-viewport,a.scrollWidth-a.clientWidth))
      .slice(0,60);
    return{innerWidth,clientWidth:viewport,scrollWidth:document.documentElement.scrollWidth,delta:document.documentElement.scrollWidth-viewport,nodes};
  });
  console.log(`RELEASE_OVERFLOW_DIAGNOSTIC ${JSON.stringify(report)}`);
});
