import {test,expect,chromium,webkit} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=startup-critical-ui-v467';
const ORIGIN='http://127.0.0.1:4173/';
const DARK='rgb(28, 41, 51)';
const EXPECTED={
  'lidskaya-34':{text:'Недостаточно оценок',semantic:'empty'},
  'belusha-41a':{text:'Слабая локация',semantic:'weak'},
  'repina-54':{text:'Перспективно',semantic:'good'},
};
const SCORE_KEYS=['housing','occupied','foot','car','parking','stop','anchor','visibility'];

test.setTimeout(600000);

async function seedFixture(page){
  await page.goto(ORIGIN,{waitUntil:'domcontentloaded'});
  await page.evaluate(async({scoreKeys})=>{
    localStorage.setItem('bogatka_access_authorized_v1','1');
    await new Promise(resolve=>{
      const request=indexedDB.deleteDatabase('bogatka-location-db-v1');
      request.onsuccess=request.onerror=request.onblocked=()=>resolve();
    });
    const db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('bogatka-location-db-v1',2);
      request.onupgradeneeded=()=>{
        const database=request.result;
        if(!database.objectStoreNames.contains('records'))database.createObjectStore('records');
        if(!database.objectStoreNames.contains('photos'))database.createObjectStore('photos',{keyPath:'id'});
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    const put=(store,value,key)=>new Promise((resolve,reject)=>{
      const request=db.transaction(store,'readwrite').objectStore(store).put(value,key);
      request.onsuccess=()=>resolve();
      request.onerror=()=>reject(request.error);
    });
    const filledBase={
      status:'Осмотрена',objectType:'Торговый центр',date:'2026-07-07',time:'12:00',
      floorLocation:'1 этаж',premiseCondition:'Рабочее состояние',premiseAvailability:'Доступно',landlordReadiness:'Готов обсуждать',
      ownerName:'Арендодатель',contactRole:'Собственник',contact:'Контакт',contactPhone:'+375290000000',
      tech:{totalArea:'45',rentPerMonth:'1250',powerKw:'12',openingHours:'10:00-21:00',utilities:'180',repairEstimate:'3000'},
      pros:'Поток и район подходят',cons:'Есть ограничения',risks:'Проверить договор',questions:'Уточнить каникулы',decision:'Оставить',
    };
    const weakScores=Object.fromEntries(scoreKeys.map(key=>[key,'1']));
    const goodScores=Object.fromEntries(scoreKeys.map(key=>[key,'5']));
    await put('records',{},'location:lidskaya-34');
    await put('records',{...structuredClone(filledBase),score:weakScores,updatedAt:'2026-07-07T09:00:00.000Z'},'location:belusha-41a');
    await put('records',{...structuredClone(filledBase),score:goodScores,updatedAt:'2026-07-07T09:05:00.000Z'},'location:repina-54');
    db.close();
  },{scoreKeys:SCORE_KEYS});
}

async function installStartupProbe(page){
  await page.addInitScript(()=>{
    localStorage.setItem('bogatka_access_authorized_v1','1');
    const ids=new WeakMap();
    let seq=0;
    const nodeId=node=>{
      if(!node)return null;
      if(!ids.has(node))ids.set(node,++seq);
      return ids.get(node);
    };
    const probe={
      navigationStart:performance.timeOrigin,
      domContentLoadedAt:null,
      windowLoadAt:null,
      firstVisibleAt:null,
      done:false,
      events:[],
      functionCalls:[],
      samples:[],
    };
    const now=()=>Math.round(performance.now()*10)/10;
    const mark=(type,detail={})=>probe.events.push({at:now(),type,...detail});
    document.addEventListener('DOMContentLoaded',()=>{probe.domContentLoadedAt=now();mark('domcontentloaded')},{once:true});
    window.addEventListener('load',()=>{probe.windowLoadAt=now();mark('window-load')},{once:true});

    const appVisible=()=>{
      const app=document.getElementById('app');
      if(!app||app.classList.contains('hidden'))return false;
      const style=getComputedStyle(app),rect=app.getBoundingClientRect();
      return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0;
    };
    const snapStyle=node=>{
      if(!node)return null;
      const style=getComputedStyle(node),rect=node.getBoundingClientRect();
      return{
        display:style.display,visibility:style.visibility,backgroundColor:style.backgroundColor,backgroundImage:style.backgroundImage,
        borderColor:style.borderColor,borderWidth:style.borderWidth,borderRadius:style.borderRadius,color:style.color,
        fontFamily:style.fontFamily,fontSize:style.fontSize,fontWeight:style.fontWeight,lineHeight:style.lineHeight,
        width:style.width,height:style.height,rectWidth:Math.round(rect.width*10)/10,rectHeight:Math.round(rect.height*10)/10,
        padding:[style.paddingTop,style.paddingRight,style.paddingBottom,style.paddingLeft].join(' '),
      };
    };
    const pseudo=node=>{
      if(!node)return null;
      const style=getComputedStyle(node,'::before');
      return{transform:style.transform,width:style.width,height:style.height,transition:style.transition};
    };
    const comparison=()=>{
      const panel=document.getElementById('locationComparisonPanel');
      const summary=panel?.querySelector(':scope > summary');
      const body=panel?.querySelector(':scope > .comparison-body-v332');
      const chevron=panel?.querySelector('.comparison-chevron-v332');
      return panel?{
        panelId:nodeId(panel),summaryId:nodeId(summary),bodyId:nodeId(body),className:panel.className,open:Boolean(panel.open),
        ariaExpanded:summary?.getAttribute('aria-expanded')||'',bodyHidden:Boolean(body?.hidden),panelStyle:snapStyle(panel),summaryStyle:snapStyle(summary),
        chevronId:nodeId(chevron),chevronStyle:{...snapStyle(chevron),transform:getComputedStyle(chevron).transform},chevronPseudo:pseudo(chevron),
      }:null;
    };
    const visibleBadges=card=>[...card.querySelectorAll('[data-card-recommendation-v448]')].filter(node=>{
      const style=getComputedStyle(node),rect=node.getBoundingClientRect();
      return !node.hidden&&style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0;
    });
    const badges=()=>[...document.querySelectorAll('[data-location-card]')].map(card=>({
      locationId:card.dataset.locationCard,
      cardId:nodeId(card),
      nodes:visibleBadges(card).map(node=>({
        nodeId:nodeId(node),text:node.textContent.trim(),className:node.className,dataClass:node.dataset.recommendationClass||'',
        title:node.title||'',ariaLabel:node.getAttribute('aria-label')||'',hidden:Boolean(node.hidden),style:snapStyle(node),
      })),
    }));
    const sample=reason=>{
      if(!appVisible())return;
      if(probe.firstVisibleAt===null){probe.firstVisibleAt=now();mark('app-visible');}
      probe.samples.push({at:now(),elapsed:Math.round((now()-probe.firstVisibleAt)*10)/10,reason,comparison:comparison(),badges:badges()});
    };

    const observer=new MutationObserver(records=>{
      for(const record of records){
        if(record.target?.id==='app'&&record.attributeName==='class')mark('app-class-change',{className:record.target.className,visible:appVisible()});
        for(const node of record.addedNodes){
          if(!(node instanceof Element))continue;
          if(node.id==='locationComparisonPanel'||node.querySelector?.('#locationComparisonPanel'))mark('comparison-inserted');
          if(node.matches?.('[data-card-recommendation-v448]')||node.querySelector?.('[data-card-recommendation-v448]'))mark('recommendation-inserted');
        }
      }
      sample('mutation');
    });
    observer.observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','open','aria-expanded','data-recommendation-class']});

    const wrapped=new Set();
    const wrapGlobal=name=>{
      if(wrapped.has(`window.${name}`))return;
      const fn=window[name];
      if(typeof fn!=='function')return;
      const wrappedFn=function(...args){
        const start=now();probe.functionCalls.push({name,start,type:'start'});
        try{
          const result=fn.apply(this,args);
          if(result?.finally)return result.finally(()=>probe.functionCalls.push({name,start,end:now(),type:'end'}));
          probe.functionCalls.push({name,start,end:now(),type:'end'});
          return result;
        }catch(error){probe.functionCalls.push({name,start,end:now(),type:'throw',message:error?.message||String(error)});throw error;}
      };
      Object.assign(wrappedFn,fn);wrappedFn.__startupProbeV467=true;wrappedFn.__base=fn;
      window[name]=wrappedFn;try{eval(`${name}=wrappedFn`)}catch(_){ }
      wrapped.add(`window.${name}`);
    };
    const wrapMethod=(objectName,method)=>{
      const object=window[objectName];
      const key=`${objectName}.${method}`;
      if(wrapped.has(key)||!object||typeof object[method]!=='function')return;
      const fn=object[method];
      object[method]=function(...args){
        const start=now();probe.functionCalls.push({name:key,start,type:'start'});
        try{
          const result=fn.apply(this,args);
          if(result?.finally)return result.finally(()=>probe.functionCalls.push({name:key,start,end:now(),type:'end'}));
          probe.functionCalls.push({name:key,start,end:now(),type:'end'});
          return result;
        }catch(error){probe.functionCalls.push({name:key,start,end:now(),type:'throw',message:error?.message||String(error)});throw error;}
      };
      object[method].__startupProbeV467=true;object[method].__base=fn;wrapped.add(key);
    };
    const installWrappers=()=>{
      ['authorize','renderLocations','updateSummary','applyVersion23Enhancements','ensureWorkflowEnhancements'].forEach(wrapGlobal);
      wrapMethod('BogatkaDecisionUI','refresh');
      wrapMethod('BogatkaCardProgressV448','renderAll');
      wrapMethod('BogatkaStartup','prepareCriticalUi');
      wrapMethod('BogatkaLocationCardCollapseV422','enhanceAll');
    };

    let last=0;
    const loop=()=>{
      installWrappers();
      if(appVisible()){
        const elapsed=probe.firstVisibleAt===null?0:now()-probe.firstVisibleAt;
        if(probe.firstVisibleAt===null||elapsed<2500||now()-last>200){last=now();sample('frame');}
        if(probe.firstVisibleAt!==null&&elapsed>=15000){probe.done=true;observer.disconnect();return;}
      }
      requestAnimationFrame(loop);
    };
    window.__startupProbeV467=probe;
    requestAnimationFrame(loop);
  });
}

async function bootAndCapture(browserType,viewport,label,{interaction=false}={}){
  const browser=await browserType.launch();
  try{
    const context=await browser.newContext({viewport});
    const page=await context.newPage();
    await seedFixture(page);
    await installStartupProbe(page);
    await page.goto(APP,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__startupProbeV467?.done===true,{timeout:30000});
    const history=await page.evaluate(()=>window.__startupProbeV467);
    assertStartupHistory(history,label);
    if(interaction)await assertInteraction(page,label);
    await context.close();
    return history;
  }finally{
    await browser.close();
  }
}

function stableBadgeSignature(node){
  return JSON.stringify({
    text:node.text,className:node.className,dataClass:node.dataClass,title:node.title,ariaLabel:node.ariaLabel,
    backgroundColor:node.style.backgroundColor,borderColor:node.style.borderColor,color:node.style.color,fontFamily:node.style.fontFamily,
    fontSize:node.style.fontSize,fontWeight:node.style.fontWeight,lineHeight:node.style.lineHeight,width:node.style.width,height:node.style.height,
    rectWidth:node.style.rectWidth,rectHeight:node.style.rectHeight,padding:node.style.padding,borderRadius:node.style.borderRadius,
  });
}

function assertStartupHistory(history,label){
  expect(history.firstVisibleAt,`${label}: app became visible`).not.toBeNull();
  expect(history.samples.length,`${label}: sampled startup`).toBeGreaterThan(20);
  const first=history.samples[0];
  expect(first.comparison,`${label}: comparison exists on first visible frame`).not.toBeNull();
  const firstComparison=first.comparison;
  expect(firstComparison.open,`${label}: comparison closed at first visible frame`).toBe(false);
  expect(firstComparison.ariaExpanded,`${label}: comparison aria closed`).toBe('false');
  expect(firstComparison.bodyHidden,`${label}: comparison body hidden`).toBe(true);
  expect(firstComparison.panelStyle.backgroundColor,`${label}: comparison orange background`).toBe('rgb(255, 250, 240)');
  expect(firstComparison.panelStyle.borderColor,`${label}: comparison orange border`).toBe('rgb(216, 184, 96)');
  expect(firstComparison.panelStyle.borderWidth,`${label}: comparison border width`).toBe('2px');
  expect(firstComparison.panelStyle.borderRadius,`${label}: comparison radius`).toBe('18px');
  expect(firstComparison.chevronStyle.transform,`${label}: chevron wrapper never rotated`).toBe('none');
  expect(firstComparison.chevronPseudo.width,`${label}: chevron pseudo width`).toBe('11px');
  expect(firstComparison.chevronPseudo.height,`${label}: chevron pseudo height`).toBe('11px');

  const firstByLocation=new Map();
  for(const entry of first.badges){
    expect(entry.nodes.length,`${label}: one visible badge for ${entry.locationId} on first frame`).toBe(1);
    firstByLocation.set(entry.locationId,entry.nodes[0]);
  }
  expect(firstByLocation.size,`${label}: badges for all locations`).toBeGreaterThanOrEqual(7);
  for(const [locationId,expected] of Object.entries(EXPECTED)){
    const badge=firstByLocation.get(locationId);
    expect(badge,`${label}: expected fixture badge ${locationId}`).toBeTruthy();
    expect(badge.text,`${label}: ${locationId} text`).toBe(expected.text);
    expect(badge.dataClass,`${label}: ${locationId} semantic`).toBe(expected.semantic);
    expect(badge.className,`${label}: ${locationId} canonical class`).toContain(`recommendation-status-v448 ${expected.semantic}`);
  }

  const firstBadgeSignatures=new Map([...firstByLocation].map(([id,node])=>[id,{nodeId:node.nodeId,signature:stableBadgeSignature(node)}]));
  for(const [index,sample] of history.samples.entries()){
    expect(sample.comparison,`${label}: comparison never missing after visible, sample ${index}`).not.toBeNull();
    const current=sample.comparison;
    expect(current.panelId,`${label}: comparison panel identity stable`).toBe(firstComparison.panelId);
    expect(current.summaryId,`${label}: comparison summary identity stable`).toBe(firstComparison.summaryId);
    expect(current.className,`${label}: comparison class stable`).toBe(firstComparison.className);
    expect(current.panelStyle.backgroundColor,`${label}: comparison background stable`).toBe(firstComparison.panelStyle.backgroundColor);
    expect(current.panelStyle.borderColor,`${label}: comparison border stable`).toBe(firstComparison.panelStyle.borderColor);
    expect(current.chevronStyle.transform,`${label}: chevron wrapper transform stable`).toBe('none');
    expect(current.chevronPseudo.transform,`${label}: chevron pseudo transform stable before interaction`).toBe(firstComparison.chevronPseudo.transform);

    const seen=new Set();
    for(const entry of sample.badges){
      seen.add(entry.locationId);
      expect(entry.nodes.length,`${label}: one visible badge for ${entry.locationId}, sample ${index}`).toBe(1);
      const firstBadge=firstBadgeSignatures.get(entry.locationId);
      if(!firstBadge)continue;
      const node=entry.nodes[0];
      expect(node.nodeId,`${label}: badge node identity stable for ${entry.locationId}`).toBe(firstBadge.nodeId);
      expect(stableBadgeSignature(node),`${label}: badge visual/text stable for ${entry.locationId}`).toBe(firstBadge.signature);
      expect(node.hidden,`${label}: badge not hidden for ${entry.locationId}`).toBe(false);
      expect(node.style.color,`${label}: badge dark text for ${entry.locationId}`).toBe(DARK);
      expect(node.style.fontSize,`${label}: badge font size for ${entry.locationId}`).toBe('11px');
      expect(node.style.fontWeight,`${label}: badge font weight for ${entry.locationId}`).toBe('800');
      expect(node.style.borderRadius,`${label}: badge radius for ${entry.locationId}`).toBe('999px');
      if(['lidskaya-34','belusha-41a'].includes(entry.locationId))expect(['good','priority']).not.toContain(node.dataClass);
    }
    for(const id of firstBadgeSignatures.keys())expect(seen.has(id),`${label}: badge still sampled for ${id}`).toBe(true);
  }
}

async function assertInteraction(page,label){
  const beforeBadges=await page.evaluate(()=>[...document.querySelectorAll('[data-location-card]')].map(card=>({
    id:card.dataset.locationCard,
    badge:[...card.querySelectorAll('[data-card-recommendation-v448]')].filter(node=>!node.hidden&&getComputedStyle(node).display!=='none').map(node=>({text:node.textContent.trim(),className:node.className,dataClass:node.dataset.recommendationClass||''})),
  })));
  const panel=page.locator('#locationComparisonPanel');
  const summary=panel.locator(':scope > summary');
  const before=await panel.evaluate(node=>{
    const arrow=node.querySelector('.comparison-chevron-v332');
    return{open:node.open,wrapper:getComputedStyle(arrow).transform,pseudo:getComputedStyle(arrow,'::before').transform};
  });
  await summary.click();
  await expect(summary).toHaveAttribute('aria-expanded','true');
  const opened=await panel.evaluate(node=>{
    const arrow=node.querySelector('.comparison-chevron-v332');
    return{open:node.open,wrapper:getComputedStyle(arrow).transform,pseudo:getComputedStyle(arrow,'::before').transform};
  });
  expect(opened.open,`${label}: comparison opens`).toBe(true);
  expect(opened.wrapper,`${label}: wrapper remains stable on open`).toBe('none');
  expect(opened.pseudo,`${label}: pseudo changes only after click`).not.toBe(before.pseudo);
  await summary.click();
  await expect(summary).toHaveAttribute('aria-expanded','false');
  const closed=await panel.evaluate(node=>{
    const arrow=node.querySelector('.comparison-chevron-v332');
    return{open:node.open,wrapper:getComputedStyle(arrow).transform,pseudo:getComputedStyle(arrow,'::before').transform};
  });
  expect(closed).toEqual(before);
  const firstToggle=page.locator('[data-location-card] .location-collapse-toggle-v422').first();
  await firstToggle.click();
  const afterBadges=await page.evaluate(()=>[...document.querySelectorAll('[data-location-card]')].map(card=>({
    id:card.dataset.locationCard,
    badge:[...card.querySelectorAll('[data-card-recommendation-v448]')].filter(node=>!node.hidden&&getComputedStyle(node).display!=='none').map(node=>({text:node.textContent.trim(),className:node.className,dataClass:node.dataset.recommendationClass||''})),
  })));
  expect(afterBadges,`${label}: opening a location does not mutate badges`).toEqual(beforeBadges);
}

async function repeatedMatrix(browserType,engine){
  for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:900}]){
    for(let i=0;i<5;i++){
      await bootAndCapture(browserType,{width:viewport.width,height:viewport.height},`${engine}-${viewport.name}-reload-${i+1}`,{interaction:i===4});
    }
  }
}

test('Chromium first-visible startup is stable across desktop/mobile repeated reloads',async()=>{
  await repeatedMatrix(chromium,'chromium');
});

test('WebKit first-visible startup is stable across desktop/mobile repeated reloads',async()=>{
  await repeatedMatrix(webkit,'webkit');
});

const CLOUD_APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=startup-cloud-post-reveal-v469';
const CLOUD_LOCATIONS={
  'lidskaya-34':['ул. Лидская, 34, ТЦ «Лидский»','Гродно, ул. Лидская, 34'],
  'belusha-41a':['ул. Белуша, 41А','Гродно, ул. Белуша, 41А'],
  'repina-54':['ул. Репина, 54','Гродно, ул. Репина, 54'],
  'rumlevskiy-10':['Румлёвский проспект, 10','Гродно, Румлёвский проспект, 10'],
  'makarovoy-2':['ул. Валентины Макаровой, 2','Гродно, ул. Валентины Макаровой, 2'],
  'molodaya-7a':['ул. Молодая, 7А, ЖК «Погораны»','Гродно, ул. Молодая, 7А'],
  'magistralnaya-10':['ул. Магистральная, 10, ЖК «Мир»','Гродно, ул. Магистральная, 10'],
};
function cloudFilledData(kind){
  const base={status:'Осмотрена',objectType:'Торговый центр',date:'2026-07-07',time:'12:00',floorLocation:'1 этаж',premiseCondition:'Рабочее состояние',premiseAvailability:'Доступно',landlordReadiness:'Готов обсуждать',ownerName:'Арендодатель',contactRole:'Собственник',contact:'Контакт',contactPhone:'+375290000000',tech:{totalArea:'45',rentPerMonth:'1250',powerKw:'12',openingHours:'10:00-21:00',utilities:'180',repairEstimate:'3000'},pros:'Поток и район подходят',cons:'Есть ограничения',risks:'Проверить договор',questions:'Уточнить каникулы',decision:'Оставить'};
  if(kind==='weak')return {...base,score:Object.fromEntries(SCORE_KEYS.map(key=>[key,'1'])),updatedAt:'2026-07-07T09:00:00.000Z'};
  if(kind==='good')return {...base,score:Object.fromEntries(SCORE_KEYS.map(key=>[key,'5'])),updatedAt:'2026-07-07T09:05:00.000Z'};
  return {};
}
function cloudData(id){return id==='belusha-41a'?cloudFilledData('weak'):id==='repina-54'?cloudFilledData('good'):{};}
function cloudRows(){return Object.entries(CLOUD_LOCATIONS).map(([id,[title,address]],index)=>({id:`cloud-${id}`,project_id:'project-1',client_id:id,title,address,note:'',status:cloudData(id).status||null,object_type:cloudData(id).objectType||null,form_data:cloudData(id),sort_order:index,revision:1,created_at:'2026-07-07T08:00:00.000Z',updated_at:'2026-07-07T10:00:00.000Z',archived_at:null}));}
async function seedCloudFixture(page){
  await page.goto(ORIGIN,{waitUntil:'domcontentloaded'});
  await page.evaluate(async({ids})=>{
    localStorage.setItem('bogatka_access_authorized_v1','1');
    const syncState={projectId:'project-1',userId:'user-1',knownLocationIds:ids,knownPhotoIds:['photo-existing'],lastSyncAt:'2026-07-07T10:00:00.000Z'};
    localStorage.setItem('bogatka_cloud_sync_state_v1',JSON.stringify(syncState));
    localStorage.setItem('bogatka_cloud_sync_state_v412:project-1',JSON.stringify(syncState));
    await new Promise(resolve=>{const request=indexedDB.deleteDatabase('bogatka-location-db-v1');request.onsuccess=request.onerror=request.onblocked=()=>resolve()});
    const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('bogatka-location-db-v1',2);request.onupgradeneeded=()=>{const database=request.result;if(!database.objectStoreNames.contains('records'))database.createObjectStore('records');if(!database.objectStoreNames.contains('photos'))database.createObjectStore('photos',{keyPath:'id'})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
    const put=(store,value,key)=>new Promise((resolve,reject)=>{const request=db.transaction(store,'readwrite').objectStore(store).put(value,key);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error)});
    const weak=Object.fromEntries(['housing','occupied','foot','car','parking','stop','anchor','visibility'].map(key=>[key,'1']));
    const good=Object.fromEntries(['housing','occupied','foot','car','parking','stop','anchor','visibility'].map(key=>[key,'5']));
    const base={status:'Осмотрена',objectType:'Торговый центр',date:'2026-07-07',time:'12:00',floorLocation:'1 этаж',premiseCondition:'Рабочее состояние',premiseAvailability:'Доступно',landlordReadiness:'Готов обсуждать',ownerName:'Арендодатель',contactRole:'Собственник',contact:'Контакт',contactPhone:'+375290000000',tech:{totalArea:'45',rentPerMonth:'1250',powerKw:'12',openingHours:'10:00-21:00',utilities:'180',repairEstimate:'3000'},pros:'Поток и район подходят',cons:'Есть ограничения',risks:'Проверить договор',questions:'Уточнить каникулы',decision:'Оставить'};
    await put('records',{},'location:lidskaya-34');
    await put('records',{...base,score:weak,updatedAt:'2026-07-07T09:00:00.000Z'},'location:belusha-41a');
    await put('records',{...base,score:good,updatedAt:'2026-07-07T09:05:00.000Z'},'location:repina-54');
    await put('photos',{id:'photo-existing',locationId:'belusha-41a',category:'street',caption:'before',storagePath:'photos/belusha/street.jpg',cloudLocationId:'cloud-belusha-41a',cloudSyncedAt:'2026-07-07T10:00:00.000Z',originalName:'street.jpg',width:800,height:600,size:4,createdAt:'2026-07-07T09:30:00.000Z',blob:new Blob(['seed'],{type:'image/jpeg'})});
    db.close();
  },{ids:Object.keys(CLOUD_LOCATIONS)});
}
function cloudSupabaseStub(){return `
(function(){
function clone(value){return value==null?value:JSON.parse(JSON.stringify(value))}function ok(data){return {data,error:null}}
function resultFor(table,mode,op,payload){const state=window.__bogatkaCloudMockState;if(op==='insert'&&table==='reports')return ok({public_token:'mock-report'});if(op==='upsert'){if(table==='locations')return ok(Array.isArray(payload)?payload.map((row,index)=>({...row,id:row.id||'cloud-'+row.client_id,revision:2,created_at:row.created_at||'2026-07-07T08:00:00.000Z',updated_at:'2026-07-07T10:10:00.000Z',sort_order:row.sort_order??index})):payload);if(table==='project_state')return ok({...payload,updated_at:'2026-07-07T10:10:00.000Z'});if(table==='photos')return ok({...payload,updated_at:'2026-07-07T10:10:00.000Z'})}if(table==='locations')return ok(clone(state.remoteLocations));if(table==='photos')return ok(clone(state.remotePhotos));if(table==='project_state')return ok(mode==='single'||mode==='maybeSingle'?clone(state.remoteState):[clone(state.remoteState)].filter(Boolean));if(table==='project_members')return ok(mode==='single'?{role:'owner'}:[{user_id:'user-1',role:'owner',created_at:'2026-07-07T08:00:00.000Z'}]);if(table==='profiles')return ok([{id:'user-1',email:'owner@example.com',display_name:'Owner'}]);return ok(mode==='single'||mode==='maybeSingle'?null:[])}
function query(table){const state={op:'select',payload:null};const api={select(){return api},eq(){return api},is(){return api},order(){return api},in(){return api},upsert(payload){state.op='upsert';state.payload=payload;return api},update(payload){state.op='update';state.payload=payload;return api},delete(){state.op='delete';return api},insert(payload){state.op='insert';state.payload=payload;return api},single(){return Promise.resolve(resultFor(table,'single',state.op,state.payload))},maybeSingle(){return Promise.resolve(resultFor(table,'maybeSingle',state.op,state.payload))},then(resolve,reject){return Promise.resolve(resultFor(table,'many',state.op,state.payload)).then(resolve,reject)}};return api}
window.supabase={createClient(){return {auth:{getSession:async()=>({data:{session:{user:{id:'user-1',email:'owner@example.com',user_metadata:{display_name:'Owner'}}}},error:null}),onAuthStateChange(callback){setTimeout(()=>callback('INITIAL_SESSION',{user:{id:'user-1',email:'owner@example.com',user_metadata:{display_name:'Owner'}}}),0);return {data:{subscription:{unsubscribe(){}}}}},signOut:async()=>({error:null}),signInWithPassword:async()=>({error:null}),signUp:async()=>({data:{session:null},error:null})},rpc:async name=>name==='claim_bogatka_project'?ok('project-1'):ok(null),from:query,storage:{from(){return {download:async()=>ok(new Blob(['remote'],{type:'image/jpeg'})),remove:async()=>ok([])}}},channel(){const channel={on(){return channel},subscribe(){window.__bogatkaCloudMockState.subscribed=true;return channel}};return channel},removeChannel:async()=>ok(null)}}}
})();`}
async function installCloudMock(page){
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',route=>route.fulfill({status:200,contentType:'application/javascript',body:cloudSupabaseStub()}));
  await page.addInitScript(({rows})=>{window.__bogatkaCloudMockState={remoteLocations:rows,remotePhotos:[{id:'photo-existing',project_id:'project-1',location_id:'cloud-belusha-41a',category:'street',caption:'before',storage_path:'photos/belusha/street.jpg',original_name:'street.jpg',mime_type:'image/jpeg',width:800,height:600,file_size:4,sort_order:0,created_at:'2026-07-07T09:30:00.000Z',updated_at:'2026-07-07T10:00:00.000Z',deleted_at:null}],remoteState:{project_id:'project-1',data:{},updated_at:'2026-07-07T10:00:00.000Z'},bumpPhoto(){const photo=this.remotePhotos[0];photo.caption='after-realtime';photo.updated_at='2026-07-07T10:15:00.000Z'}}}, {rows:cloudRows()});
}
async function installCloudTrace(page){
  await page.addInitScript(()=>{
    localStorage.setItem('bogatka_access_authorized_v1','1');
    const ids=new WeakMap();let seq=0;const nodeId=node=>{if(!node)return null;if(!ids.has(node))ids.set(node,++seq);return ids.get(node)};
    const trace={firstVisibleAt:null,done:false,samples:[],events:[],functions:[]};const now=()=>Math.round(performance.now()*10)/10;const mark=(type,detail={})=>trace.events.push({at:now(),type,...detail});
    const appVisible=()=>{const app=document.getElementById('app');if(!app||app.classList.contains('hidden'))return false;const style=getComputedStyle(app),rect=app.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0};
    const styleOf=node=>{if(!node)return null;const style=getComputedStyle(node),rect=node.getBoundingClientRect();return {className:node.className||'',display:style.display,visibility:style.visibility,backgroundColor:style.backgroundColor,backgroundImage:style.backgroundImage,borderColor:style.borderColor,borderWidth:style.borderWidth,borderRadius:style.borderRadius,color:style.color,fontSize:style.fontSize,fontWeight:style.fontWeight,lineHeight:style.lineHeight,width:style.width,height:style.height,rectWidth:Math.round(rect.width*10)/10,rectHeight:Math.round(rect.height*10)/10}};
    const pseudo=node=>{if(!node)return null;const style=getComputedStyle(node,'::before');return {transform:style.transform,width:style.width,height:style.height,transition:style.transition}};
    const comparison=()=>{const panel=document.getElementById('locationComparisonPanel');const summary=panel?.querySelector(':scope > summary');const body=panel?.querySelector(':scope > .comparison-body-v332');const count=panel?.querySelector('#comparisonLocationCount');const chevron=panel?.querySelector('.comparison-chevron-v332');return panel?{panelId:nodeId(panel),summaryId:nodeId(summary),bodyId:nodeId(body),countId:nodeId(count),chevronId:nodeId(chevron),className:panel.className,open:Boolean(panel.open),ariaExpanded:summary?.getAttribute('aria-expanded')||'',bodyHidden:Boolean(body?.hidden),panelStyle:styleOf(panel),summaryStyle:styleOf(summary),countStyle:styleOf(count),chevronStyle:{...styleOf(chevron),transform:chevron?getComputedStyle(chevron).transform:null},chevronPseudo:pseudo(chevron)}:null};
    const visibleBadges=card=>[...card.querySelectorAll('[data-card-recommendation-v448]')].filter(node=>{const style=getComputedStyle(node),rect=node.getBoundingClientRect();return !node.hidden&&style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0});
    const badges=()=>[...document.querySelectorAll('[data-location-card]')].map(card=>({locationId:card.dataset.locationCard,nodes:visibleBadges(card).map(node=>({nodeId:nodeId(node),text:node.textContent.trim(),className:node.className,dataClass:node.dataset.recommendationClass||'',hidden:Boolean(node.hidden),style:styleOf(node)}))}));
    function sample(reason){if(!appVisible())return;if(trace.firstVisibleAt===null){trace.firstVisibleAt=now();mark('app-visible')}trace.samples.push({at:now(),reason,comparison:comparison(),badges:badges(),recentFunctions:trace.functions.slice(-10),recentEvents:trace.events.slice(-10)})}
    const wrapped=new Set();const wrapFunction=(name,fn,setter)=>{if(wrapped.has(name)||typeof fn!=='function'||fn.__cloudTraceV469)return;const wrappedFn=function(...args){const start=now();trace.functions.push({name,start,type:'start'});try{const result=fn.apply(this,args);if(result?.finally)return result.finally(()=>trace.functions.push({name,start,end:now(),type:'end'}));trace.functions.push({name,start,end:now(),type:'end'});return result}catch(error){trace.functions.push({name,start,end:now(),type:'throw',message:error?.message||String(error)});throw error}};Object.assign(wrappedFn,fn);wrappedFn.__cloudTraceV469=true;wrappedFn.__base=fn;setter(wrappedFn);wrapped.add(name)};
    const wrapGlobal=name=>wrapFunction(`window.${name}`,window[name],fn=>{window[name]=fn});const wrapMethod=(objectName,method)=>{const object=window[objectName];if(object)wrapFunction(`${objectName}.${method}`,object[method],fn=>{object[method]=fn})};
    function installWrappers(){['cloudInit','cloudSyncAll','cloudApplyRemote','cloudFetchRemote','cloudHandleRealtime','renderLocations','updateSummary','applyVersion23Enhancements','ensureWorkflowEnhancements'].forEach(wrapGlobal);[['BogatkaDecisionUI','refresh'],['BogatkaCardProgressV448','renderAll'],['BogatkaCardProgressV448','transformMetrics'],['BogatkaWorkflowV414','enhanceAll'],['BogatkaUIRefineV462','completeRuntime'],['BogatkaLocationCardCollapseV422','enhanceAll']].forEach(([objectName,method])=>wrapMethod(objectName,method))}
    const observer=new MutationObserver(records=>{for(const record of records){const target=record.target instanceof Element?record.target:null;if(target&&(target.id==='locationComparisonPanel'||target.closest?.('#locationComparisonPanel')))mark('comparison-mutation',{attribute:record.attributeName||null,targetId:target.id||'',targetClass:target.className||'',panelClass:document.getElementById('locationComparisonPanel')?.className||'',panelOpen:Boolean(document.getElementById('locationComparisonPanel')?.open)});for(const node of record.addedNodes){if(!(node instanceof Element))continue;if(node.id==='locationComparisonPanel'||node.querySelector?.('#locationComparisonPanel'))mark('comparison-inserted');if(node.matches?.('[data-card-recommendation-v448]')||node.querySelector?.('[data-card-recommendation-v448]'))mark('recommendation-inserted')}}sample('mutation')});
    observer.observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','open','aria-expanded','data-recommendation-class','style','data-comparison-render-signature']});
    let last=0;function loop(){installWrappers();if(appVisible()){const elapsed=trace.firstVisibleAt===null?0:now()-trace.firstVisibleAt;if(trace.firstVisibleAt===null||elapsed<3000||now()-last>200){last=now();sample('frame')}if(trace.firstVisibleAt!==null&&elapsed>=20000){trace.done=true;observer.disconnect();return}}requestAnimationFrame(loop)}
    window.__cloudTraceV469=trace;requestAnimationFrame(loop);
  });
}
function cloudBadgeSignature(node){return JSON.stringify({text:node.text,className:node.className,dataClass:node.dataClass,backgroundColor:node.style.backgroundColor,borderColor:node.style.borderColor,color:node.style.color,fontSize:node.style.fontSize,fontWeight:node.style.fontWeight,lineHeight:node.style.lineHeight,width:node.style.width,height:node.style.height,rectWidth:node.style.rectWidth,rectHeight:node.style.rectHeight,borderRadius:node.style.borderRadius})}
function cloudComparisonSignature(node){return JSON.stringify({panelId:node.panelId,summaryId:node.summaryId,bodyId:node.bodyId,countId:node.countId,chevronId:node.chevronId,className:node.className,open:node.open,ariaExpanded:node.ariaExpanded,bodyHidden:node.bodyHidden,panelBackground:node.panelStyle.backgroundColor,panelBorder:node.panelStyle.borderColor,panelBorderWidth:node.panelStyle.borderWidth,panelRadius:node.panelStyle.borderRadius,summaryBackground:node.summaryStyle.backgroundImage,countBackground:node.countStyle.backgroundColor,chevronTransform:node.chevronStyle.transform,chevronPseudoTransform:node.chevronPseudo.transform})}
function assertCloudTrace(history,label){
  expect(history.firstVisibleAt,`${label}: cloud app visible`).not.toBeNull();expect(history.samples.length,`${label}: 20-second cloud trace samples`).toBeGreaterThan(40);
  const first=history.samples[0];expect(first.comparison,`${label}: comparison exists`).not.toBeNull();expect(first.comparison.open,`${label}: comparison closed`).toBe(false);expect(first.comparison.ariaExpanded,`${label}: comparison aria closed`).toBe('false');expect(first.comparison.bodyHidden,`${label}: comparison body hidden`).toBe(true);expect(first.comparison.panelStyle.backgroundColor,`${label}: comparison orange background`).toBe('rgb(255, 250, 240)');expect(first.comparison.panelStyle.borderColor,`${label}: comparison orange border`).toBe('rgb(216, 184, 96)');expect(first.comparison.chevronStyle.transform,`${label}: chevron wrapper not rotated`).toBe('none');
  const firstComparison=cloudComparisonSignature(first.comparison);const firstBadges=new Map();for(const entry of first.badges){expect(entry.nodes.length,`${label}: one badge for ${entry.locationId}`).toBe(1);firstBadges.set(entry.locationId,{nodeId:entry.nodes[0].nodeId,signature:cloudBadgeSignature(entry.nodes[0])})}
  expect(firstBadges.get('lidskaya-34')?.signature,`${label}: empty location present`).toContain('Недостаточно оценок');expect(firstBadges.get('belusha-41a')?.signature,`${label}: weak location present`).toContain('Слабая локация');
  for(const [index,sample] of history.samples.entries()){expect(sample.comparison,`${label}: comparison never missing sample ${index}`).not.toBeNull();expect(cloudComparisonSignature(sample.comparison),`${label}: comparison stable sample ${index}`).toBe(firstComparison);for(const entry of sample.badges){expect(entry.nodes.length,`${label}: one visible badge ${entry.locationId} sample ${index}`).toBe(1);const firstBadge=firstBadges.get(entry.locationId);if(!firstBadge)continue;const node=entry.nodes[0];expect(node.nodeId,`${label}: badge node stable ${entry.locationId} sample ${index}`).toBe(firstBadge.nodeId);expect(cloudBadgeSignature(node),`${label}: badge semantic/visual stable ${entry.locationId} sample ${index}`).toBe(firstBadge.signature);expect(node.style.color,`${label}: dark badge text ${entry.locationId}`).toBe(DARK);expect(node.style.fontSize,`${label}: badge font size ${entry.locationId}`).toBe('11px');expect(node.style.fontWeight,`${label}: badge font weight ${entry.locationId}`).toBe('800')}}
  const postRevealRender=history.functions.filter(call=>call.name==='window.renderLocations'&&call.start>history.firstVisibleAt+1);expect(postRevealRender,`${label}: no renderLocations after visible during cloud/photo sync`).toEqual([]);
}
async function bootCloudAndCapture(browserType,viewport,label){
  const browser=await browserType.launch();
  try{const context=await browser.newContext({viewport});const page=await context.newPage();await installCloudMock(page);await seedCloudFixture(page);await installCloudTrace(page);await page.goto(CLOUD_APP,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__cloudTraceV469?.firstVisibleAt!==null,{timeout:60000});await page.waitForFunction(()=>window.BogatkaCloud?.firstSyncCompleted===true,{timeout:60000});await page.evaluate(async()=>{await window.updateSummary?.();await window.BogatkaDecisionUI?.refresh?.();await window.BogatkaCardProgressV448?.renderAll?.();await window.BogatkaWorkflowV414?.enhanceAll?.();window.__bogatkaCloudMockState.bumpPhoto();window.cloudHandleRealtime?.();window.cloudHandleRealtime?.()});await page.waitForFunction(()=>window.__cloudTraceV469?.done===true,{timeout:70000});const history=await page.evaluate(()=>window.__cloudTraceV469);assertCloudTrace(history,label);await context.close();return history}finally{await browser.close()}
}
async function cloudMatrix(browserType,engine){for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:900}])for(let i=0;i<2;i++)await bootCloudAndCapture(browserType,{width:viewport.width,height:viewport.height},`${engine}-cloud-${viewport.name}-reload-${i+1}`)}

test('Chromium cloud startup remains stable for 20 seconds after reveal',async()=>{await cloudMatrix(chromium,'chromium')});
test('WebKit cloud startup remains stable for 20 seconds after reveal',async()=>{await cloudMatrix(webkit,'webkit')});
