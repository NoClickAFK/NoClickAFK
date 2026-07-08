import {test,expect,chromium,webkit} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=startup-cloud-post-reveal-v469';
const ORIGIN='http://127.0.0.1:4173/';
const DARK='rgb(28, 41, 51)';
const DEFAULT_IDS=['lidskaya-34','belusha-41a','repina-54','rumlevskiy-10','makarovoy-2','molodaya-7a','magistralnaya-10'];
const SCORE_KEYS=['housing','occupied','foot','car','parking','stop','anchor','visibility'];

const TITLES={
  'lidskaya-34':'ул. Лидская, 34, ТЦ «Лидский»',
  'belusha-41a':'ул. Белуша, 41А',
  'repina-54':'ул. Репина, 54',
  'rumlevskiy-10':'Румлёвский проспект, 10',
  'makarovoy-2':'ул. Валентины Макаровой, 2',
  'molodaya-7a':'ул. Молодая, 7А, ЖК «Погораны»',
  'magistralnaya-10':'ул. Магистральная, 10, ЖК «Мир»',
};
const ADDRESSES={
  'lidskaya-34':'Гродно, ул. Лидская, 34',
  'belusha-41a':'Гродно, ул. Белуша, 41А',
  'repina-54':'Гродно, ул. Репина, 54',
  'rumlevskiy-10':'Гродно, Румлёвский проспект, 10',
  'makarovoy-2':'Гродно, ул. Валентины Макаровой, 2',
  'molodaya-7a':'Гродно, ул. Молодая, 7А',
  'magistralnaya-10':'Гродно, ул. Магистральная, 10',
};

const filledBase={
  status:'Осмотрена',objectType:'Торговый центр',date:'2026-07-07',time:'12:00',
  floorLocation:'1 этаж',premiseCondition:'Рабочее состояние',premiseAvailability:'Доступно',landlordReadiness:'Готов обсуждать',
  ownerName:'Арендодатель',contactRole:'Собственник',contact:'Контакт',contactPhone:'+375290000000',
  tech:{totalArea:'45',rentPerMonth:'1250',powerKw:'12',openingHours:'10:00-21:00',utilities:'180',repairEstimate:'3000'},
  pros:'Поток и район подходят',cons:'Есть ограничения',risks:'Проверить договор',questions:'Уточнить каникулы',decision:'Оставить',
};

test.setTimeout(900000);

function weakScores(){return Object.fromEntries(SCORE_KEYS.map(key=>[key,'1']))}
function goodScores(){return Object.fromEntries(SCORE_KEYS.map(key=>[key,'5']))}
function locationData(id){
  if(id==='belusha-41a')return {...structuredClone(filledBase),score:weakScores(),updatedAt:'2026-07-07T09:00:00.000Z'};
  if(id==='repina-54')return {...structuredClone(filledBase),score:goodScores(),updatedAt:'2026-07-07T09:05:00.000Z'};
  return {};
}
function remoteRows(){
  return DEFAULT_IDS.map((id,index)=>({
    id:`cloud-${id}`,project_id:'project-1',client_id:id,title:TITLES[id],address:ADDRESSES[id],note:'',
    status:locationData(id).status||null,object_type:locationData(id).objectType||null,form_data:locationData(id),
    sort_order:index,revision:1,created_at:'2026-07-07T08:00:00.000Z',updated_at:'2026-07-07T10:00:00.000Z',archived_at:null,
  }));
}

async function seedFixture(page){
  await page.goto(ORIGIN,{waitUntil:'domcontentloaded'});
  await page.evaluate(async({ids,filled,scoreKeys})=>{
    localStorage.setItem('bogatka_access_authorized_v1','1');
    localStorage.setItem('bogatka_cloud_sync_state_v1',JSON.stringify({projectId:'project-1',userId:'user-1',knownLocationIds:ids,knownPhotoIds:['photo-existing'],lastSyncAt:'2026-07-07T10:00:00.000Z'}));
    localStorage.setItem('bogatka_cloud_sync_state_v412:project-1',JSON.stringify({projectId:'project-1',userId:'user-1',knownLocationIds:ids,knownPhotoIds:['photo-existing'],lastSyncAt:'2026-07-07T10:00:00.000Z'}));
    await new Promise(resolve=>{const request=indexedDB.deleteDatabase('bogatka-location-db-v1');request.onsuccess=request.onerror=request.onblocked=()=>resolve()});
    const db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('bogatka-location-db-v1',2);
      request.onupgradeneeded=()=>{const database=request.result;if(!database.objectStoreNames.contains('records'))database.createObjectStore('records');if(!database.objectStoreNames.contains('photos'))database.createObjectStore('photos',{keyPath:'id'})};
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
    const put=(store,value,key)=>new Promise((resolve,reject)=>{const request=db.transaction(store,'readwrite').objectStore(store).put(value,key);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error)});
    const weak=Object.fromEntries(scoreKeys.map(key=>[key,'1']));
    const good=Object.fromEntries(scoreKeys.map(key=>[key,'5']));
    await put('records',{},'location:lidskaya-34');
    await put('records',{...structuredClone(filled),score:weak,updatedAt:'2026-07-07T09:00:00.000Z'},'location:belusha-41a');
    await put('records',{...structuredClone(filled),score:good,updatedAt:'2026-07-07T09:05:00.000Z'},'location:repina-54');
    await put('photos',{id:'photo-existing',locationId:'belusha-41a',category:'street',caption:'before',storagePath:'photos/belusha/street.jpg',cloudLocationId:'cloud-belusha-41a',cloudSyncedAt:'2026-07-07T10:00:00.000Z',originalName:'street.jpg',width:800,height:600,size:4,createdAt:'2026-07-07T09:30:00.000Z',blob:new Blob(['seed'],{type:'image/jpeg'})});
    db.close();
  },{ids:DEFAULT_IDS,filled:filledBase,scoreKeys:SCORE_KEYS});
}

function supabaseStub(){return `
(function(){
  function clone(value){return value==null?value:JSON.parse(JSON.stringify(value))}
  function ok(data){return {data,error:null}}
  function resultFor(table,mode,op,payload){
    const state=window.__bogatkaCloudMockState;
    if(op==='insert'&&table==='reports')return ok({public_token:'mock-report'});
    if(op==='upsert'){
      if(table==='locations')return ok(Array.isArray(payload)?payload.map((row,index)=>({...row,id:row.id||'cloud-'+row.client_id,revision:2,created_at:row.created_at||'2026-07-07T08:00:00.000Z',updated_at:'2026-07-07T10:10:00.000Z',sort_order:row.sort_order??index})):payload);
      if(table==='project_state')return ok({...payload,updated_at:'2026-07-07T10:10:00.000Z'});
      if(table==='photos')return ok({...payload,updated_at:'2026-07-07T10:10:00.000Z'});
    }
    if(table==='locations')return ok(clone(state.remoteLocations));
    if(table==='photos')return ok(clone(state.remotePhotos));
    if(table==='project_state')return ok(mode==='single'||mode==='maybeSingle'?clone(state.remoteState):[clone(state.remoteState)].filter(Boolean));
    if(table==='project_members'){
      if(mode==='single')return ok({role:'owner'});
      return ok([{user_id:'user-1',role:'owner',created_at:'2026-07-07T08:00:00.000Z'}]);
    }
    if(table==='profiles')return ok([{id:'user-1',email:'owner@example.com',display_name:'Owner'}]);
    return ok(mode==='single'||mode==='maybeSingle'?null:[]);
  }
  function query(table){
    const state={op:'select',payload:null};
    const api={
      select(){return api},eq(){return api},is(){return api},order(){return api},in(){return api},
      upsert(payload){state.op='upsert';state.payload=payload;return api},
      update(payload){state.op='update';state.payload=payload;return api},
      delete(){state.op='delete';return api},
      insert(payload){state.op='insert';state.payload=payload;return api},
      single(){return Promise.resolve(resultFor(table,'single',state.op,state.payload))},
      maybeSingle(){return Promise.resolve(resultFor(table,'maybeSingle',state.op,state.payload))},
      then(resolve,reject){return Promise.resolve(resultFor(table,'many',state.op,state.payload)).then(resolve,reject)},
    };
    return api;
  }
  window.supabase={
    createClient(){return {
      auth:{
        getSession:async()=>({data:{session:{user:{id:'user-1',email:'owner@example.com',user_metadata:{display_name:'Owner'}}}},error:null}),
        onAuthStateChange(callback){setTimeout(()=>callback('INITIAL_SESSION',{user:{id:'user-1',email:'owner@example.com',user_metadata:{display_name:'Owner'}}}),0);return {data:{subscription:{unsubscribe(){}}}}},
        signOut:async()=>({error:null}),signInWithPassword:async()=>({error:null}),signUp:async()=>({data:{session:null},error:null}),
      },
      rpc:async(name)=>name==='claim_bogatka_project'?ok('project-1'):ok(null),
      from:query,
      storage:{from(){return {download:async()=>ok(new Blob(['remote'],{type:'image/jpeg'})),remove:async()=>ok([])}}},
      channel(){const channel={on(){return channel},subscribe(){window.__bogatkaCloudMockState.subscribed=true;return channel}};return channel},
      removeChannel:async()=>ok(null),
    }}
  };
})();`}

async function installMockCloud(page){
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',route=>route.fulfill({status:200,contentType:'application/javascript',body:supabaseStub()}));
  await page.addInitScript(({rows})=>{
    window.__bogatkaCloudMockState={
      remoteLocations:rows,
      remotePhotos:[{id:'photo-existing',project_id:'project-1',location_id:'cloud-belusha-41a',category:'street',caption:'before',storage_path:'photos/belusha/street.jpg',original_name:'street.jpg',mime_type:'image/jpeg',width:800,height:600,file_size:4,sort_order:0,created_at:'2026-07-07T09:30:00.000Z',updated_at:'2026-07-07T10:00:00.000Z',deleted_at:null}],
      remoteState:{project_id:'project-1',data:{},updated_at:'2026-07-07T10:00:00.000Z'},
      subscribed:false,
      bumpPhoto(){const photo=this.remotePhotos[0];photo.caption='after-realtime';photo.updated_at='2026-07-07T10:15:00.000Z'},
    };
  },{rows:remoteRows()});
}

async function installTrace(page){
  await page.addInitScript(()=>{
    localStorage.setItem('bogatka_access_authorized_v1','1');
    const ids=new WeakMap();let seq=0;
    const nodeId=node=>{if(!node)return null;if(!ids.has(node))ids.set(node,++seq);return ids.get(node)};
    const trace={firstVisibleAt:null,done:false,samples:[],events:[],functions:[]};
    const now=()=>Math.round(performance.now()*10)/10;
    const appVisible=()=>{const app=document.getElementById('app');if(!app||app.classList.contains('hidden'))return false;const style=getComputedStyle(app),rect=app.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0};
    const styleOf=node=>{if(!node)return null;const style=getComputedStyle(node),rect=node.getBoundingClientRect();return {className:node.className||'',display:style.display,visibility:style.visibility,backgroundColor:style.backgroundColor,backgroundImage:style.backgroundImage,borderColor:style.borderColor,borderWidth:style.borderWidth,borderRadius:style.borderRadius,color:style.color,fontSize:style.fontSize,fontWeight:style.fontWeight,lineHeight:style.lineHeight,width:style.width,height:style.height,rectWidth:Math.round(rect.width*10)/10,rectHeight:Math.round(rect.height*10)/10}};
    const pseudo=node=>{if(!node)return null;const style=getComputedStyle(node,'::before');return {transform:style.transform,width:style.width,height:style.height}};
    const comparison=()=>{const panel=document.getElementById('locationComparisonPanel');const summary=panel?.querySelector(':scope > summary');const count=panel?.querySelector('#comparisonLocationCount');const chevron=panel?.querySelector('.comparison-chevron-v332');return panel?{panelId:nodeId(panel),summaryId:nodeId(summary),countId:nodeId(count),chevronId:nodeId(chevron),className:panel.className,open:Boolean(panel.open),ariaExpanded:summary?.getAttribute('aria-expanded')||'',panelStyle:styleOf(panel),summaryStyle:styleOf(summary),countStyle:styleOf(count),chevronStyle:{...styleOf(chevron),transform:chevron?getComputedStyle(chevron).transform:null},chevronPseudo:pseudo(chevron)}:null};
    const visibleBadges=card=>[...card.querySelectorAll('[data-card-recommendation-v448]')].filter(node=>{const style=getComputedStyle(node),rect=node.getBoundingClientRect();return !node.hidden&&style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0});
    const badges=()=>[...document.querySelectorAll('[data-location-card]')].map(card=>({locationId:card.dataset.locationCard,cardId:nodeId(card),nodes:visibleBadges(card).map(node=>({nodeId:nodeId(node),text:node.textContent.trim(),className:node.className,dataClass:node.dataset.recommendationClass||'',hidden:Boolean(node.hidden),style:styleOf(node)}))}));
    function sample(reason){if(!appVisible())return;if(trace.firstVisibleAt===null){trace.firstVisibleAt=now();trace.events.push({at:now(),type:'app-visible'})}trace.samples.push({at:now(),elapsed:Math.round((now()-trace.firstVisibleAt)*10)/10,reason,comparison:comparison(),badges:badges()})}
    const wrapName=(name,resolve,assign)=>{let target;try{target=resolve()}catch(_){return}if(typeof target!=='function'||target.__startupCloudTraceV469)return;const wrapped=function(...args){const start=now();trace.functions.push({name,start,type:'start'});try{const result=target.apply(this,args);if(result?.finally)return result.finally(()=>trace.functions.push({name,start,end:now(),type:'end'}));trace.functions.push({name,start,end:now(),type:'end'});return result}catch(error){trace.functions.push({name,start,end:now(),type:'throw',message:error?.message||String(error)});throw error}};Object.assign(wrapped,target);wrapped.__startupCloudTraceV469=true;wrapped.__base=target;try{assign(wrapped)}catch(_){}};
    function installWrappers(){
      for(const name of ['authorize','setAuthorizedShell','revealAuthorizedApp','applyVersion23Enhancements','ensureWorkflowEnhancements','cloudInit','cloudSyncAll','cloudApplyRemote','cloudFetchRemote','cloudSetStatus','cloudRenderModal','cloudSubscribeRealtime','cloudHandleRealtime','restoreAllForms','renderLocations','updateSummary'])wrapName(name,()=>window[name]||eval(name),fn=>{window[name]=fn;try{eval(`${name}=fn`)}catch(_){}});
      [['BogatkaStartup','prepareCriticalUi'],['BogatkaStartup','revealApp'],['BogatkaDecisionUI','refresh'],['BogatkaCardProgressV448','renderAll'],['BogatkaCardEnhancer','enhanceAll'],['BogatkaLocationCardCollapseV422','enhanceAll'],['BogatkaSelftest','run']].forEach(([objectName,method])=>wrapName(`${objectName}.${method}`,()=>window[objectName]?.[method],fn=>{window[objectName][method]=fn}));
    }
    const observer=new MutationObserver(records=>{for(const record of records){if(record.target?.id==='app'&&record.attributeName==='class')trace.events.push({at:now(),type:'app-class',className:record.target.className,visible:appVisible()})}sample('mutation')});
    observer.observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','open','aria-expanded','data-recommendation-class']});
    let last=0;
    function loop(){installWrappers();if(appVisible()){const elapsed=trace.firstVisibleAt===null?0:now()-trace.firstVisibleAt;if(trace.firstVisibleAt===null||elapsed<3000||now()-last>200){last=now();sample('frame')}if(trace.firstVisibleAt!==null&&elapsed>=20000){trace.done=true;observer.disconnect();return}}requestAnimationFrame(loop)}
    window.__startupCloudTraceV469=trace;requestAnimationFrame(loop);
  });
}

function badgeSignature(node){return JSON.stringify({text:node.text,className:node.className,dataClass:node.dataClass,backgroundColor:node.style.backgroundColor,borderColor:node.style.borderColor,color:node.style.color,fontSize:node.style.fontSize,fontWeight:node.style.fontWeight,lineHeight:node.style.lineHeight,width:node.style.width,height:node.style.height,rectWidth:node.style.rectWidth,rectHeight:node.style.rectHeight,borderRadius:node.style.borderRadius})}
function comparisonSignature(node){return JSON.stringify({panelId:node.panelId,summaryId:node.summaryId,countId:node.countId,chevronId:node.chevronId,className:node.className,open:node.open,ariaExpanded:node.ariaExpanded,panelBackground:node.panelStyle.backgroundColor,panelBorder:node.panelStyle.borderColor,panelBorderWidth:node.panelStyle.borderWidth,panelRadius:node.panelStyle.borderRadius,summaryBackground:node.summaryStyle.backgroundImage,countBackground:node.countStyle.backgroundColor,chevronTransform:node.chevronStyle.transform,chevronPseudoTransform:node.chevronPseudo.transform})}

function assertTrace(history,label){
  expect(history.firstVisibleAt,`${label}: app visible`).not.toBeNull();
  expect(history.samples.length,`${label}: 20-second trace samples`).toBeGreaterThan(40);
  const first=history.samples[0];
  expect(first.comparison,`${label}: comparison exists`).not.toBeNull();
  expect(first.comparison.open,`${label}: comparison closed`).toBe(false);
  expect(first.comparison.ariaExpanded,`${label}: comparison aria closed`).toBe('false');
  expect(first.comparison.panelStyle.backgroundColor,`${label}: comparison orange background`).toBe('rgb(255, 250, 240)');
  expect(first.comparison.panelStyle.borderColor,`${label}: comparison orange border`).toBe('rgb(216, 184, 96)');
  expect(first.comparison.chevronStyle.transform,`${label}: chevron wrapper not rotated`).toBe('none');
  const firstComparison=comparisonSignature(first.comparison);
  const firstBadges=new Map();
  for(const entry of first.badges){
    expect(entry.nodes.length,`${label}: one badge for ${entry.locationId}`).toBe(1);
    firstBadges.set(entry.locationId,{nodeId:entry.nodes[0].nodeId,signature:badgeSignature(entry.nodes[0])});
  }
  expect(firstBadges.get('lidskaya-34')?.signature,`${label}: empty location present`).toContain('Недостаточно оценок');
  expect(firstBadges.get('belusha-41a')?.signature,`${label}: weak location present`).toContain('Слабая локация');
  for(const [index,sample] of history.samples.entries()){
    expect(sample.comparison,`${label}: comparison never missing sample ${index}`).not.toBeNull();
    expect(comparisonSignature(sample.comparison),`${label}: comparison stable sample ${index}`).toBe(firstComparison);
    for(const entry of sample.badges){
      expect(entry.nodes.length,`${label}: one visible badge ${entry.locationId} sample ${index}`).toBe(1);
      const firstBadge=firstBadges.get(entry.locationId);
      if(!firstBadge)continue;
      const node=entry.nodes[0];
      expect(node.nodeId,`${label}: badge node stable ${entry.locationId} sample ${index}`).toBe(firstBadge.nodeId);
      expect(badgeSignature(node),`${label}: badge semantic/visual stable ${entry.locationId} sample ${index}`).toBe(firstBadge.signature);
      expect(node.style.color,`${label}: dark badge text ${entry.locationId}`).toBe(DARK);
      expect(node.style.fontSize,`${label}: badge font size ${entry.locationId}`).toBe('11px');
      expect(node.style.fontWeight,`${label}: badge font weight ${entry.locationId}`).toBe('800');
    }
  }
  const postRevealRender=history.functions.filter(call=>call.name==='renderLocations'&&call.start>history.firstVisibleAt+1);
  expect(postRevealRender,`${label}: no renderLocations after visible during cloud/realtime no-op`).toEqual([]);
}

async function bootAndCapture(browserType,viewport,label){
  const browser=await browserType.launch();
  try{
    const context=await browser.newContext({viewport});
    const page=await context.newPage();
    await installMockCloud(page);
    await seedFixture(page);
    await installTrace(page);
    await page.goto(APP,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__startupCloudTraceV469?.firstVisibleAt!==null,{timeout:60000});
    await page.waitForFunction(()=>window.BogatkaCloud?.firstSyncCompleted===true,{timeout:60000});
    await page.evaluate(()=>{window.__bogatkaCloudMockState.bumpPhoto();window.cloudHandleRealtime?.();window.cloudHandleRealtime?.()});
    await page.waitForFunction(()=>window.__startupCloudTraceV469?.done===true,{timeout:70000});
    const history=await page.evaluate(()=>window.__startupCloudTraceV469);
    assertTrace(history,label);
    await context.close();
    return history;
  }finally{await browser.close()}
}

async function repeatedMatrix(browserType,engine){
  for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:900}]){
    for(let i=0;i<5;i++)await bootAndCapture(browserType,{width:viewport.width,height:viewport.height},`${engine}-${viewport.name}-reload-${i+1}`);
  }
}

test('Chromium cloud startup remains stable for 20 seconds after reveal',async()=>{
  await repeatedMatrix(chromium,'chromium');
});

test('WebKit cloud startup remains stable for 20 seconds after reveal',async()=>{
  await repeatedMatrix(webkit,'webkit');
});
