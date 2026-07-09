import {test,expect,chromium,webkit} from '@playwright/test';

const ORIGIN='http://127.0.0.1:4173/';
const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=comparison-startup-v430';
const DARK='rgb(28, 41, 51)';
const SCORE_KEYS=['housing','occupied','foot','car','parking','stop','anchor','visibility'];
const LOCATIONS={
  'lidskaya-34':['ул. Лидская, 34, ТЦ «Лидский»','Гродно, ул. Лидская, 34'],
  'belusha-41a':['ул. Белуша, 41А','Гродно, ул. Белуша, 41А'],
  'repina-54':['ул. Репина, 54','Гродно, ул. Репина, 54'],
  'rumlevskiy-10':['Румлёвский проспект, 10','Гродно, Румлёвский проспект, 10'],
  'makarovoy-2':['ул. Валентины Макаровой, 2','Гродно, ул. Валентины Макаровой, 2'],
  'molodaya-7a':['ул. Молодая, 7А, ЖК «Погораны»','Гродно, ул. Молодая, 7А'],
  'magistralnaya-10':['ул. Магистральная, 10, ЖК «Мир»','Гродно, ул. Магистральная, 10'],
};

test.setTimeout(600000);

function filled(kind){
  const base={status:'Осмотрена',objectType:'Торговый центр',date:'2026-07-07',time:'12:00',floorLocation:'1 этаж',premiseCondition:'Рабочее состояние',premiseAvailability:'Доступно',landlordReadiness:'Готов обсуждать',ownerName:'Арендодатель',contactRole:'Собственник',contact:'Контакт',contactPhone:'+375290000000',tech:{totalArea:'45',rentPerMonth:'1250',powerKw:'12',openingHours:'10:00-21:00',utilities:'180',repairEstimate:'3000'},pros:'Поток и район подходят',cons:'Есть ограничения',risks:'Проверить договор',questions:'Уточнить каникулы',decision:'Оставить'};
  if(kind==='weak')return {...base,score:Object.fromEntries(SCORE_KEYS.map(key=>[key,'1'])),updatedAt:'2026-07-07T09:00:00.000Z'};
  if(kind==='good')return {...base,score:Object.fromEntries(SCORE_KEYS.map(key=>[key,'5'])),updatedAt:'2026-07-07T09:05:00.000Z'};
  return {};
}
function dataFor(id){return id==='belusha-41a'?filled('weak'):id==='repina-54'?filled('good'):{};}
function remoteRows(){return Object.entries(LOCATIONS).map(([id,[title,address]],index)=>({id:`cloud-${id}`,project_id:'project-1',client_id:id,title,address,note:'',status:dataFor(id).status||null,object_type:dataFor(id).objectType||null,form_data:dataFor(id),sort_order:index,revision:1,created_at:'2026-07-07T08:00:00.000Z',updated_at:'2026-07-07T10:00:00.000Z',archived_at:null}));}

async function seed(page){
  await page.goto(ORIGIN,{waitUntil:'domcontentloaded'});
  await page.evaluate(async({scoreKeys,ids})=>{
    localStorage.setItem('bogatka_access_authorized_v1','1');
    localStorage.setItem('bogatka_cloud_sync_state_v1',JSON.stringify({projectId:'project-1',userId:'user-1',knownLocationIds:ids,knownPhotoIds:['photo-existing'],lastSyncAt:'2026-07-07T10:00:00.000Z'}));
    await new Promise(resolve=>{const request=indexedDB.deleteDatabase('bogatka-location-db-v1');request.onsuccess=request.onerror=request.onblocked=()=>resolve()});
    const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('bogatka-location-db-v1',2);request.onupgradeneeded=()=>{const database=request.result;if(!database.objectStoreNames.contains('records'))database.createObjectStore('records');if(!database.objectStoreNames.contains('photos'))database.createObjectStore('photos',{keyPath:'id'})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
    const put=(store,value,key)=>new Promise((resolve,reject)=>{const request=db.transaction(store,'readwrite').objectStore(store).put(value,key);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error)});
    const weak=Object.fromEntries(scoreKeys.map(key=>[key,'1']));
    const good=Object.fromEntries(scoreKeys.map(key=>[key,'5']));
    const base={status:'Осмотрена',objectType:'Торговый центр',date:'2026-07-07',time:'12:00',floorLocation:'1 этаж',premiseCondition:'Рабочее состояние',premiseAvailability:'Доступно',landlordReadiness:'Готов обсуждать',ownerName:'Арендодатель',contactRole:'Собственник',contact:'Контакт',contactPhone:'+375290000000',tech:{totalArea:'45',rentPerMonth:'1250',powerKw:'12',openingHours:'10:00-21:00',utilities:'180',repairEstimate:'3000'},pros:'Поток и район подходят',cons:'Есть ограничения',risks:'Проверить договор',questions:'Уточнить каникулы',decision:'Оставить'};
    await put('records',{},'location:lidskaya-34');
    await put('records',{...base,score:weak,updatedAt:'2026-07-07T09:00:00.000Z'},'location:belusha-41a');
    await put('records',{...base,score:good,updatedAt:'2026-07-07T09:05:00.000Z'},'location:repina-54');
    await put('photos',{id:'photo-existing',locationId:'belusha-41a',category:'street',caption:'before',storagePath:'photos/belusha/street.jpg',cloudLocationId:'cloud-belusha-41a',cloudSyncedAt:'2026-07-07T10:00:00.000Z',originalName:'street.jpg',width:800,height:600,size:4,createdAt:'2026-07-07T09:30:00.000Z',blob:new Blob(['seed'],{type:'image/jpeg'})});
    db.close();
  },{scoreKeys:SCORE_KEYS,ids:Object.keys(LOCATIONS)});
}

function supabaseStub(){return `
(function(){
function clone(value){return value==null?value:JSON.parse(JSON.stringify(value))}function ok(data){return {data,error:null}}
function resultFor(table,mode,op,payload){const state=window.__bogatkaCloudMockState;if(op==='insert'&&table==='reports')return ok({public_token:'mock-report'});if(op==='upsert'){if(table==='locations')return ok(Array.isArray(payload)?payload.map((row,index)=>({...row,id:row.id||'cloud-'+row.client_id,revision:2,created_at:row.created_at||'2026-07-07T08:00:00.000Z',updated_at:'2026-07-07T10:10:00.000Z',sort_order:row.sort_order??index})):payload);if(table==='project_state')return ok({...payload,updated_at:'2026-07-07T10:10:00.000Z'});if(table==='photos')return ok({...payload,updated_at:'2026-07-07T10:10:00.000Z'})}if(table==='locations')return ok(clone(state.remoteLocations));if(table==='photos')return ok(clone(state.remotePhotos));if(table==='project_state')return ok(mode==='single'||mode==='maybeSingle'?clone(state.remoteState):[clone(state.remoteState)].filter(Boolean));if(table==='project_members')return ok(mode==='single'?{role:'owner'}:[{user_id:'user-1',role:'owner',created_at:'2026-07-07T08:00:00.000Z'}]);if(table==='profiles')return ok([{id:'user-1',email:'owner@example.com',display_name:'Owner'}]);if(table==='project_invites')return ok([]);return ok(mode==='single'||mode==='maybeSingle'?null:[])}
function query(table){const state={op:'select',payload:null};const api={select(){return api},eq(){return api},is(){return api},order(){return api},in(){return api},limit(){return api},upsert(payload){state.op='upsert';state.payload=payload;return api},update(payload){state.op='update';state.payload=payload;return api},delete(){state.op='delete';return api},insert(payload){state.op='insert';state.payload=payload;return api},single(){return Promise.resolve(resultFor(table,'single',state.op,state.payload))},maybeSingle(){return Promise.resolve(resultFor(table,'maybeSingle',state.op,state.payload))},then(resolve,reject){return Promise.resolve(resultFor(table,'many',state.op,state.payload)).then(resolve,reject)}};return api}
window.supabase={createClient(){return {auth:{getSession:async()=>({data:{session:{user:{id:'user-1',email:'owner@example.com',user_metadata:{display_name:'Owner'}}}},error:null}),onAuthStateChange(callback){setTimeout(()=>callback('INITIAL_SESSION',{user:{id:'user-1',email:'owner@example.com',user_metadata:{display_name:'Owner'}}}),0);return {data:{subscription:{unsubscribe(){}}}}},signOut:async()=>({error:null}),signInWithPassword:async()=>({error:null}),signUp:async()=>({data:{session:null},error:null})},rpc:async name=>name==='claim_bogatka_project'?ok('project-1'):ok(null),from:query,storage:{from(){return {download:async()=>ok(new Blob(['remote'],{type:'image/jpeg'})),remove:async()=>ok([])}}},channel(){const channel={on(){return channel},subscribe(){window.__bogatkaCloudMockState.subscribed=true;return channel}};return channel},removeChannel:async()=>ok(null)}}}
})();`}
async function installMock(page){
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',route=>route.fulfill({status:200,contentType:'application/javascript',body:supabaseStub()}));
  await page.addInitScript(({rows})=>{window.__bogatkaCloudMockState={remoteLocations:rows,remotePhotos:[{id:'photo-existing',project_id:'project-1',location_id:'cloud-belusha-41a',category:'street',caption:'before',storage_path:'photos/belusha/street.jpg',original_name:'street.jpg',mime_type:'image/jpeg',width:800,height:600,file_size:4,sort_order:0,created_at:'2026-07-07T09:30:00.000Z',updated_at:'2026-07-07T10:00:00.000Z',deleted_at:null}],remoteState:{project_id:'project-1',data:{},updated_at:'2026-07-07T10:00:00.000Z'}}}, {rows:remoteRows()});
}

async function installTrace(page){
  await page.addInitScript(()=>{
    localStorage.setItem('bogatka_access_authorized_v1','1');
    const ids=new WeakMap();let seq=0;const nodeId=node=>{if(!node)return null;if(!ids.has(node))ids.set(node,++seq);return ids.get(node)};
    const trace={firstVisibleAt:null,cloudReadyAt:null,selftestOkAt:null,done:false,samples:[],events:[],functions:[]};const now=()=>Math.round(performance.now()*10)/10;const mark=(type,detail={})=>trace.events.push({at:now(),type,...detail});
    const appVisible=()=>{const app=document.getElementById('app');if(!app||app.classList.contains('hidden'))return false;const style=getComputedStyle(app),rect=app.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0};
    const styleOf=node=>{if(!node)return null;const style=getComputedStyle(node),rect=node.getBoundingClientRect();return {display:style.display,visibility:style.visibility,backgroundColor:style.backgroundColor,backgroundImage:style.backgroundImage,borderColor:style.borderColor,borderWidth:style.borderWidth,borderRadius:style.borderRadius,color:style.color,fontSize:style.fontSize,fontWeight:style.fontWeight,lineHeight:style.lineHeight,width:style.width,height:style.height,rectWidth:Math.round(rect.width*10)/10,rectHeight:Math.round(rect.height*10)/10,transition:style.transition,transform:style.transform}};
    const pseudo=node=>{if(!node)return null;const style=getComputedStyle(node,'::before');return {transform:style.transform,width:style.width,height:style.height,transition:style.transition}};
    const comparison=()=>{const panel=document.getElementById('locationComparisonPanel');const toggle=panel?.querySelector('[data-comparison-toggle-v430],:scope > summary');const body=panel?.querySelector(':scope > .comparison-body-v332');const count=panel?.querySelector('#comparisonLocationCount');const chevron=panel?.querySelector('.comparison-chevron-v430,.comparison-chevron-v332');return panel?{panelId:nodeId(panel),toggleId:nodeId(toggle),bodyId:nodeId(body),countId:nodeId(count),chevronId:nodeId(chevron),tagName:panel.tagName,className:panel.className,open:panel.dataset.open==='true'||Boolean(panel.open),dataOpen:panel.dataset.open||'',ariaExpanded:toggle?.getAttribute('aria-expanded')||'',bodyHidden:Boolean(body?.hidden),panelStyle:styleOf(panel),toggleStyle:styleOf(toggle),countStyle:styleOf(count),chevronStyle:styleOf(chevron),chevronPseudo:pseudo(chevron)}:null};
    const visibleBadges=card=>[...card.querySelectorAll('[data-card-recommendation-v448]')].filter(node=>{const style=getComputedStyle(node),rect=node.getBoundingClientRect();return !node.hidden&&style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0});
    const badges=()=>[...document.querySelectorAll('[data-location-card]')].map(card=>({locationId:card.dataset.locationCard,nodes:visibleBadges(card).map(node=>({nodeId:nodeId(node),text:node.textContent.trim(),className:node.className,dataClass:node.dataset.recommendationClass||'',style:styleOf(node)}))}));
    const markers=()=>{const cloud=document.getElementById('cloudTopPill')?.textContent||'';const self=document.getElementById('diagnosticsPillV400')?.textContent||'';if(!trace.cloudReadyAt&&/синхрониз/i.test(cloud)){trace.cloudReadyAt=now();mark('cloud-ready-pill',{text:cloud})}if(!trace.selftestOkAt&&/Самопроверка:\s*OK/i.test(self)){trace.selftestOkAt=now();mark('selftest-ok-pill',{text:self})}};
    function sample(reason){markers();if(!appVisible())return;if(trace.firstVisibleAt===null){trace.firstVisibleAt=now();mark('app-visible')}trace.samples.push({at:now(),reason,comparison:comparison(),badges:badges(),cloudText:document.getElementById('cloudTopPill')?.textContent||'',selftestText:document.getElementById('diagnosticsPillV400')?.textContent||'',recentFunctions:trace.functions.slice(-12),recentEvents:trace.events.slice(-12)})}
    const wrapped=new Set();const wrapFunction=(name,fn,setter)=>{if(wrapped.has(name)||typeof fn!=='function'||fn.__comparisonTraceV430)return;const wrappedFn=function(...args){const start=now();trace.functions.push({name,start,type:'start'});try{const result=fn.apply(this,args);if(result?.finally)return result.finally(()=>trace.functions.push({name,start,end:now(),type:'end'}));trace.functions.push({name,start,end:now(),type:'end'});return result}catch(error){trace.functions.push({name,start,end:now(),type:'throw',message:error?.message||String(error)});throw error}};Object.assign(wrappedFn,fn);wrappedFn.__comparisonTraceV430=true;wrappedFn.__base=fn;setter(wrappedFn);wrapped.add(name)};
    const wrapGlobal=name=>wrapFunction(`window.${name}`,window[name],fn=>{window[name]=fn});const wrapMethod=(objectName,method)=>{const object=window[objectName];if(object)wrapFunction(`${objectName}.${method}`,object[method],fn=>{object[method]=fn})};
    function installWrappers(){['applyVersion23Enhancements','ensureWorkflowEnhancements','cloudRenderModal','cloudSetStatus','cloudSyncAll','cloudApplyRemote','renderLocations','updateSummary'].forEach(wrapGlobal);[['BogatkaWorkflowV414','enhanceAll'],['BogatkaVisualPolish','enhanceInvitationHistory'],['BogatkaSelftest','run'],['BogatkaDecisionUI','refresh'],['BogatkaCardProgressV448','renderAll'],['BogatkaComparisonV430','ensurePanel'],['BogatkaComparisonV430','render'],['BogatkaComparisonV430','syncPanelState']].forEach(([objectName,method])=>wrapMethod(objectName,method))}
    const observer=new MutationObserver(records=>{for(const record of records){const target=record.target instanceof Element?record.target:null;if(target&&(target.id==='locationComparisonPanel'||target.closest?.('#locationComparisonPanel')))mark('comparison-mutation',{attribute:record.attributeName||null,targetId:target.id||'',targetClass:target.className||'',panelClass:document.getElementById('locationComparisonPanel')?.className||'',dataOpen:document.getElementById('locationComparisonPanel')?.dataset.open||'',open:Boolean(document.getElementById('locationComparisonPanel')?.open)});for(const node of record.addedNodes){if(!(node instanceof Element))continue;if(node.id==='locationComparisonPanel'||node.querySelector?.('#locationComparisonPanel'))mark('comparison-inserted');if(node.id==='diagnosticsPillV400')mark('selftest-pill-inserted');if(node.id==='cloudTopPill')mark('cloud-pill-inserted')}}sample('mutation')});
    observer.observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','open','aria-expanded','data-open','style','data-comparison-render-signature']});
    let last=0;function loop(){installWrappers();markers();if(appVisible()){const t=now();if(trace.firstVisibleAt===null||t-last>100){last=t;sample('frame')}const gate=Math.max(trace.firstVisibleAt||0,trace.cloudReadyAt||0,trace.selftestOkAt||0);if(trace.firstVisibleAt&&trace.cloudReadyAt&&trace.selftestOkAt&&t-gate>=8000){trace.done=true;observer.disconnect();return}}requestAnimationFrame(loop)}
    window.__comparisonTraceV430=trace;requestAnimationFrame(loop);
  });
}

function comparisonSignature(node){return JSON.stringify({panelId:node.panelId,toggleId:node.toggleId,bodyId:node.bodyId,countId:node.countId,chevronId:node.chevronId,tagName:node.tagName,className:node.className,open:node.open,dataOpen:node.dataOpen,ariaExpanded:node.ariaExpanded,bodyHidden:node.bodyHidden,panelBackground:node.panelStyle.backgroundColor,panelBackgroundImage:node.panelStyle.backgroundImage,panelBorder:node.panelStyle.borderColor,panelBorderWidth:node.panelStyle.borderWidth,toggleBackground:node.toggleStyle.backgroundColor,toggleBackgroundImage:node.toggleStyle.backgroundImage,chevronTransform:node.chevronStyle.transform,chevronTransition:node.chevronStyle.transition,chevronPseudoTransform:node.chevronPseudo.transform,chevronPseudoTransition:node.chevronPseudo.transition,chevronPseudoWidth:node.chevronPseudo.width,chevronPseudoHeight:node.chevronPseudo.height})}
function badgeSignature(node){return JSON.stringify({text:node.text,className:node.className,dataClass:node.dataClass,backgroundColor:node.style.backgroundColor,borderColor:node.style.borderColor,color:node.style.color,fontSize:node.style.fontSize,fontWeight:node.style.fontWeight,lineHeight:node.style.lineHeight,width:node.style.width,height:node.style.height,rectWidth:node.style.rectWidth,rectHeight:node.style.rectHeight,borderRadius:node.style.borderRadius})}
function assertTrace(history,label){
  expect(history.firstVisibleAt,`${label}: app visible`).not.toBeNull();
  expect(history.cloudReadyAt,`${label}: cloud synchronized/ready pill visible`).not.toBeNull();
  expect(history.selftestOkAt,`${label}: selftest OK visible`).not.toBeNull();
  expect(history.samples.length,`${label}: sampled startup through owner/selftest moment`).toBeGreaterThan(80);
  const first=history.samples.find(sample=>sample.comparison)?.comparison;
  expect(first,`${label}: comparison panel exists`).toBeTruthy();
  expect(first.open,`${label}: comparison closed from first visible`).toBe(false);
  expect(first.ariaExpanded,`${label}: comparison aria closed`).toBe('false');
  expect(first.bodyHidden,`${label}: comparison body hidden`).toBe(true);
  expect(first.panelStyle.backgroundColor,`${label}: comparison orange background`).toBe('rgb(255, 250, 240)');
  expect(first.panelStyle.borderColor,`${label}: comparison orange border`).toBe('rgb(216, 184, 96)');
  expect(first.panelStyle.borderWidth,`${label}: comparison border width`).toBe('2px');
  expect(first.chevronStyle.transform,`${label}: chevron wrapper stable`).toBe('none');
  const baseComparison=comparisonSignature(first);
  const firstBadges=new Map();
  for(const entry of history.samples.find(sample=>sample.badges.length)?.badges||[]){expect(entry.nodes.length,`${label}: one visible badge for ${entry.locationId}`).toBe(1);firstBadges.set(entry.locationId,{nodeId:entry.nodes[0].nodeId,signature:badgeSignature(entry.nodes[0])})}
  expect(firstBadges.get('lidskaya-34')?.signature,`${label}: empty status preserved`).toContain('Недостаточно оценок');
  expect(firstBadges.get('belusha-41a')?.signature,`${label}: weak status preserved`).toContain('Слабая локация');
  for(const [index,sample] of history.samples.entries()){
    if(!sample.comparison)continue;
    expect(comparisonSignature(sample.comparison),`${label}: comparison shell did not mutate after reveal sample ${index}`).toBe(baseComparison);
    for(const entry of sample.badges){const firstBadge=firstBadges.get(entry.locationId);if(!firstBadge)continue;expect(entry.nodes.length,`${label}: one badge ${entry.locationId} sample ${index}`).toBe(1);expect(entry.nodes[0].nodeId,`${label}: badge node stable ${entry.locationId}`).toBe(firstBadge.nodeId);expect(badgeSignature(entry.nodes[0]),`${label}: badge visual/semantic stable ${entry.locationId}`).toBe(firstBadge.signature);expect(entry.nodes[0].style.color,`${label}: dark badge text ${entry.locationId}`).toBe(DARK)}
  }
  const postVisibleRender=history.functions.filter(call=>call.name==='window.renderLocations'&&call.start>history.firstVisibleAt+1);
  expect(postVisibleRender,`${label}: no post-reveal renderLocations during startup owner/selftest`).toEqual([]);
}
async function runOnce(browserType,label){
  const browser=await browserType.launch();
  try{const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();await installMock(page);await seed(page);await installTrace(page);await page.goto(APP,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__comparisonTraceV430?.done===true,{timeout:45000});const history=await page.evaluate(()=>window.__comparisonTraceV430);assertTrace(history,label);await context.close();return history}finally{await browser.close()}
}
async function repeated(browserType,engine){for(let i=0;i<5;i++)await runOnce(browserType,`${engine}-desktop-reload-${i+1}`)}

test('Chromium desktop comparison shell is stable through cloud owner and selftest startup',async()=>{await repeated(chromium,'chromium')});
test('WebKit desktop comparison shell is stable through cloud owner and selftest startup',async()=>{await repeated(webkit,'webkit')});
