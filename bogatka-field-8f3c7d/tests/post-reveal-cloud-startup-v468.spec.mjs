import {test,expect,chromium,webkit} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=post-reveal-cloud-startup-v468';
const ORIGIN='http://127.0.0.1:4173/';
const UPDATED='2026-07-07T12:00:00.000Z';
const DARK='rgb(28, 41, 51)';
const META=[
  ['lidskaya-34','ул. Лидская, 34, ТЦ «Лидский»','Гродно, ул. Лидская, 34'],
  ['belusha-41a','ул. Белуша, 41А','Гродно, ул. Белуша, 41А'],
  ['repina-54','ул. Репина, 54','Гродно, ул. Репина, 54'],
  ['rumlevskiy-10','Румлёвский проспект, 10','Гродно, Румлёвский проспект, 10'],
  ['makarovoy-2','ул. Валентины Макаровой, 2','Гродно, ул. Валентины Макаровой, 2'],
  ['molodaya-7a','ул. Молодая, 7А, ЖК «Погораны»','Гродно, ул. Молодая, 7А'],
  ['magistralnaya-10','ул. Магистральная, 10, ЖК «Мир»','Гродно, ул. Магистральная, 10'],
];
const SCORE_KEYS=['housing','occupied','foot','car','parking','stop','anchor','visibility'];
const EXPECTED={
  'lidskaya-34':{text:'Недостаточно оценок',semantic:'empty'},
  'belusha-41a':{text:'Слабая локация',semantic:'weak'},
  'repina-54':{text:'Перспективно',semantic:'good'},
};

test.setTimeout(600000);

function forms(){
  const base={status:'Осмотрена',objectType:'Торговый центр',date:'2026-07-07',time:'12:00',floorLocation:'1 этаж',premiseCondition:'Рабочее состояние',premiseAvailability:'Доступно',landlordReadiness:'Готов обсуждать',ownerName:'Арендодатель',contactRole:'Собственник',contact:'Контакт',contactPhone:'+375290000000',tech:{totalArea:'45',rentPerMonth:'1250',powerKw:'12',openingHours:'10:00-21:00',utilities:'180',repairEstimate:'3000'},pros:'Поток подходит',cons:'Есть ограничения',risks:'Проверить договор',questions:'Уточнить каникулы',decision:'Оставить'};
  return {
    'lidskaya-34':{},
    'belusha-41a':{...structuredClone(base),score:Object.fromEntries(SCORE_KEYS.map(key=>[key,'1'])),updatedAt:'2026-07-07T09:00:00.000Z'},
    'repina-54':{...structuredClone(base),score:Object.fromEntries(SCORE_KEYS.map(key=>[key,'5'])),updatedAt:'2026-07-07T09:05:00.000Z'},
  };
}

async function seed(page){
  await page.goto(ORIGIN,{waitUntil:'domcontentloaded'});
  await page.evaluate(async({meta,forms,updated})=>{
    localStorage.clear();localStorage.setItem('bogatka_access_authorized_v1','1');
    await new Promise(resolve=>{const request=indexedDB.deleteDatabase('bogatka-location-db-v1');request.onsuccess=request.onerror=request.onblocked=()=>resolve()});
    const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('bogatka-location-db-v1',2);request.onupgradeneeded=()=>{const database=request.result;if(!database.objectStoreNames.contains('records'))database.createObjectStore('records');if(!database.objectStoreNames.contains('photos'))database.createObjectStore('photos',{keyPath:'id'})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
    const put=(store,value,key)=>new Promise((resolve,reject)=>{const request=db.transaction(store,'readwrite').objectStore(store).put(value,key);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error)});
    await put('records',meta.map(([id,title,address])=>({id,title,address,note:'',custom:false,cloudId:`cloud-${id}`})),'meta:locations');
    for(const [id] of meta)await put('records',{...(forms[id]||{}),cloudId:`cloud-${id}`,cloudRevision:1,cloudUpdatedAt:updated},`location:${id}`);
    await put('photos',{id:'photo-lidskaya-1',locationId:'lidskaya-34',category:'street',caption:'Фасад',storagePath:'project/cloud-lidskaya-34/photo-lidskaya-1.jpg',cloudLocationId:'cloud-lidskaya-34',cloudSyncedAt:updated,originalName:'photo.jpg',width:10,height:10,size:4,createdAt:updated,blob:new Blob(['fake'],{type:'image/jpeg'})});
    db.close();
  },{meta:META,forms:forms(),updated:UPDATED});
}

async function fakeSupabase(page){
  const formData=forms();
  const remoteLocations=META.map(([id,title,address],sort_order)=>({id:`cloud-${id}`,project_id:'project-1',client_id:id,title,address,note:'',status:formData[id]?.status||null,object_type:formData[id]?.objectType||null,form_data:formData[id]||{},sort_order,revision:1,created_at:UPDATED,updated_at:UPDATED,archived_at:null}));
  const remotePhotos=[{id:'photo-lidskaya-1',project_id:'project-1',location_id:'cloud-lidskaya-34',category:'street',caption:'Фасад',storage_path:'project/cloud-lidskaya-34/photo-lidskaya-1.jpg',original_name:'photo.jpg',mime_type:'image/jpeg',width:10,height:10,file_size:4,created_at:UPDATED,updated_at:UPDATED,deleted_at:null}];
  await page.route('**/@supabase/supabase-js@2**',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.supabase={createClient:function(){return window.__bogatkaFakeSupabaseClient();}};'}));
  await page.addInitScript(({remoteLocations,remotePhotos,updated})=>{
    const session={user:{id:'owner-user',email:'owner@example.com',user_metadata:{display_name:'Owner'}}};
    const state={remoteLocations:structuredClone(remoteLocations),remotePhotos:structuredClone(remotePhotos),subscriptions:[],calls:[]};
    const result=(data,error=null)=>Promise.resolve({data,error});
    const applyFilters=(rows,filters)=>rows.filter(row=>filters.every(([type,key,value])=>type==='eq'?row[key]===value:type==='is'?row[key]===value||row[key]===null:true));
    function builder(table){
      const query={table,action:'select',payload:null,filters:[],single:false,maybe:false};
      const api={select(){return api},eq(k,v){query.filters.push(['eq',k,v]);return api},is(k,v){query.filters.push(['is',k,v]);return api},in(){return api},order(){return api},single(){query.single=true;return exec()},maybeSingle(){query.maybe=true;return exec()},upsert(payload){query.action='upsert';query.payload=Array.isArray(payload)?payload:[payload];return api},insert(payload){query.action='insert';query.payload=Array.isArray(payload)?payload:[payload];return api},delete(){query.action='delete';return api},then(r,j){return exec().then(r,j)}};
      async function exec(){
        state.calls.push({table:query.table,action:query.action,at:performance.now()});
        if(table==='locations'){
          if(query.action==='upsert')return result(query.single?query.payload[0]:query.payload);
          const rows=applyFilters(state.remoteLocations,query.filters).filter(row=>!row.archived_at);
          return result(query.single||query.maybe?(rows[0]||null):structuredClone(rows));
        }
        if(table==='photos'){
          if(query.action==='upsert')return result(query.single?query.payload[0]:query.payload);
          const rows=applyFilters(state.remotePhotos,query.filters).filter(row=>!row.deleted_at);
          return result(query.single||query.maybe?(rows[0]||null):structuredClone(rows));
        }
        if(table==='project_state')return result(query.single||query.maybe?null:null);
        if(table==='project_members')return result(query.single||query.maybe?{role:'owner'}:[{user_id:'owner-user',role:'owner',created_at:updated}]);
        if(table==='profiles')return result([{id:'owner-user',email:'owner@example.com',display_name:'Owner'}]);
        if(table==='projects')return result({id:'project-1',name:'Bogatka',slug:'bogatka-grodno',description:'',updated_at:updated});
        if(table==='reports')return result({public_token:'token-v468'});
        return result(query.single||query.maybe?null:[]);
      }
      return api;
    }
    window.__bogatkaFakeSupabaseState=state;
    window.__bogatkaFakeSupabaseClient=()=>({auth:{getSession:()=>result({session}),onAuthStateChange:callback=>{setTimeout(()=>callback('INITIAL_SESSION',session),20);return{data:{subscription:{unsubscribe(){}}}}},signOut:()=>result(null),signInWithPassword:()=>result({session}),signUp:()=>result({session}),resetPasswordForEmail:()=>result({})},rpc:name=>result(name==='claim_bogatka_project'?'project-1':true),from:builder,storage:{from:()=>({download:()=>result(new Blob(['fake'],{type:'image/jpeg'})),upload:()=>result({}),remove:()=>result([])})},channel:name=>({name,on(){return this},subscribe(){state.subscriptions.push(name);return this}}),removeChannel:channel=>{state.subscriptions=state.subscriptions.filter(name=>name!==channel?.name);return result(null)}});
  },{remoteLocations,remotePhotos,updated:UPDATED});
}

async function probe(page){
  await page.addInitScript(()=>{
    localStorage.setItem('bogatka_access_authorized_v1','1');
    const ids=new WeakMap();let seq=0;const id=node=>{if(!node)return null;if(!ids.has(node))ids.set(node,++seq);return ids.get(node)};
    const p={visibleAt:null,criticalAt:null,cloudAt:null,done:false,events:[],calls:[],samples:[]};
    const now=()=>Math.round(performance.now()*10)/10;const mark=(type,detail={})=>p.events.push({at:now(),type,...detail});
    window.addEventListener('bogatka:critical-ui-ready',()=>{p.criticalAt=now();mark('critical-ui-ready')});
    window.addEventListener('bogatka:cloud-first-sync-ready',()=>{p.cloudAt=now();mark('cloud-first-sync-ready')});
    window.addEventListener('bogatka:app-visible',()=>{p.visibleAt=now();mark('app-visible')});
    window.addEventListener('load',()=>mark('window-load'));
    const visible=()=>{const app=document.getElementById('app');if(!app||app.classList.contains('hidden'))return false;const cs=getComputedStyle(app),r=app.getBoundingClientRect();return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0};
    const style=node=>{if(!node)return null;const cs=getComputedStyle(node),r=node.getBoundingClientRect();return{display:cs.display,visibility:cs.visibility,backgroundColor:cs.backgroundColor,borderColor:cs.borderColor,borderWidth:cs.borderWidth,borderRadius:cs.borderRadius,color:cs.color,fontSize:cs.fontSize,fontWeight:cs.fontWeight,lineHeight:cs.lineHeight,width:cs.width,height:cs.height,rectWidth:Math.round(r.width*10)/10,rectHeight:Math.round(r.height*10)/10,transform:cs.transform}};
    const pseudo=node=>{if(!node)return null;const cs=getComputedStyle(node,'::before');return{transform:cs.transform,width:cs.width,height:cs.height}};
    const comparison=()=>{const panel=document.getElementById('locationComparisonPanel'),summary=panel?.querySelector(':scope > summary'),body=panel?.querySelector(':scope > .comparison-body-v332'),chevron=panel?.querySelector('.comparison-chevron-v332');return panel?{panelId:id(panel),summaryId:id(summary),className:panel.className,open:panel.open,ariaExpanded:summary?.getAttribute('aria-expanded')||'',bodyHidden:Boolean(body?.hidden),panelStyle:style(panel),chevronStyle:style(chevron),chevronPseudo:pseudo(chevron)}:null};
    const badgeNodes=card=>[...card.querySelectorAll('[data-card-recommendation-v448]')].filter(node=>{const cs=getComputedStyle(node),r=node.getBoundingClientRect();return !node.hidden&&cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0});
    const badges=()=>[...document.querySelectorAll('[data-location-card]')].map(card=>({locationId:card.dataset.locationCard,cardId:id(card),nodes:badgeNodes(card).map(node=>({nodeId:id(node),text:node.textContent.trim(),className:node.className,dataClass:node.dataset.recommendationClass||'',style:style(node)}))}));
    const sample=reason=>{if(!visible())return;if(p.visibleAt===null)p.visibleAt=now();p.samples.push({at:now(),elapsed:Math.round((now()-p.visibleAt)*10)/10,reason,comparison:comparison(),badges:badges()})};
    const wrapGlobal=name=>{const fn=window[name];if(typeof fn!=='function'||fn.__probeV468)return;const wrapped=function(...args){const call={name,start:now(),type:'start'};p.calls.push(call);try{const result=fn.apply(this,args);if(result?.finally)return result.finally(()=>{call.end=now();call.type='end'});call.end=now();call.type='end';return result}catch(error){call.end=now();call.type='throw';call.message=error?.message||String(error);throw error}};Object.assign(wrapped,fn);wrapped.__probeV468=true;wrapped.__base=fn;window[name]=wrapped;try{eval(`${name}=wrapped`)}catch(_){}};
    const wrapMethod=(objectName,method)=>{const object=window[objectName];if(!object||typeof object[method]!=='function'||object[method].__probeV468)return;const fn=object[method];object[method]=function(...args){const call={name:`${objectName}.${method}`,start:now(),type:'start'};p.calls.push(call);try{const result=fn.apply(this,args);if(result?.finally)return result.finally(()=>{call.end=now();call.type='end'});call.end=now();call.type='end';return result}catch(error){call.end=now();call.type='throw';call.message=error?.message||String(error);throw error}};object[method].__probeV468=true;object[method].__base=fn};
    const install=()=>{['renderLocations','restoreAllForms','updateSummary','cloudInit','cloudEnsureProject','cloudSetStatus','cloudSyncAll','cloudFetchRemote','cloudApplyRemote','cloudPushLocations','cloudPushProjectState','cloudSubscribeRealtime','cloudHandleRealtime'].forEach(wrapGlobal);wrapMethod('BogatkaStartup','prepareCriticalUi');wrapMethod('BogatkaCloud','init');wrapMethod('BogatkaDecisionUI','refresh');wrapMethod('BogatkaCardProgressV448','renderAll')};
    new MutationObserver(()=>sample('mutation')).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','open','aria-expanded','data-recommendation-class','style']});
    let last=0;const loop=()=>{install();if(visible()){const elapsed=now()-p.visibleAt;if(elapsed<3000||now()-last>200){last=now();sample('frame')}if(elapsed>=20000&&window.BogatkaCloud?.firstSyncCompleted){p.done=true;return}}requestAnimationFrame(loop)};window.__postRevealProbeV468=p;requestAnimationFrame(loop);
  });
}

function badgeSig(node){return JSON.stringify({text:node.text,className:node.className,dataClass:node.dataClass,color:node.style.color,fontSize:node.style.fontSize,fontWeight:node.style.fontWeight,lineHeight:node.style.lineHeight,width:node.style.width,height:node.style.height,rectWidth:node.style.rectWidth,rectHeight:node.style.rectHeight,borderColor:node.style.borderColor,backgroundColor:node.style.backgroundColor,borderRadius:node.style.borderRadius})}

function assertHistory(history,label,{realtime=false}={}){
  expect(history.criticalAt,`${label}: critical ready before reveal`).not.toBeNull();
  expect(history.cloudAt,`${label}: cloud first sync before reveal`).not.toBeNull();
  expect(history.visibleAt,`${label}: visible`).not.toBeNull();
  expect(history.criticalAt).toBeLessThanOrEqual(history.visibleAt);
  expect(history.cloudAt).toBeLessThanOrEqual(history.visibleAt);
  expect(history.samples.length,`${label}: 20s samples`).toBeGreaterThan(40);
  const first=history.samples[0],cmp=first.comparison;
  expect(cmp.panelStyle.backgroundColor).toBe('rgb(255, 250, 240)');
  expect(cmp.panelStyle.borderColor).toBe('rgb(216, 184, 96)');
  expect(cmp.chevronStyle.transform).toBe('none');
  expect(cmp.chevronPseudo.width).toBe('11px');
  expect(cmp.chevronPseudo.height).toBe('11px');
  const firstBadges=new Map(first.badges.map(entry=>[entry.locationId,entry.nodes[0]]));
  for(const [locationId,expected] of Object.entries(EXPECTED)){
    expect(firstBadges.get(locationId)?.text).toBe(expected.text);
    expect(firstBadges.get(locationId)?.dataClass).toBe(expected.semantic);
  }
  const stable=new Map([...firstBadges].map(([key,node])=>[key,{nodeId:node.nodeId,sig:badgeSig(node)}]));
  for(const sample of history.samples){
    expect(sample.comparison.panelId).toBe(cmp.panelId);
    expect(sample.comparison.className).toBe(cmp.className);
    expect(sample.comparison.panelStyle.backgroundColor).toBe(cmp.panelStyle.backgroundColor);
    expect(sample.comparison.panelStyle.borderColor).toBe(cmp.panelStyle.borderColor);
    expect(sample.comparison.chevronStyle.transform).toBe('none');
    expect(sample.comparison.chevronPseudo.transform).toBe(cmp.chevronPseudo.transform);
    for(const entry of sample.badges){
      expect(entry.nodes.length,`${label}: one badge ${entry.locationId}`).toBe(1);
      const expected=stable.get(entry.locationId);if(!expected)continue;
      expect(entry.nodes[0].nodeId).toBe(expected.nodeId);
      expect(badgeSig(entry.nodes[0])).toBe(expected.sig);
      expect(entry.nodes[0].style.color).toBe(DARK);
      if(['lidskaya-34','belusha-41a'].includes(entry.locationId))expect(['good','priority','medium']).not.toContain(entry.nodes[0].dataClass);
    }
  }
  expect(history.calls.filter(call=>call.start>=history.visibleAt&&call.name==='renderLocations').length,`${label}: no all-card render after reveal`).toBe(0);
  if(realtime)expect(history.calls.some(call=>call.name==='cloudHandleRealtime')).toBe(true);
}

async function boot(browserType,viewport,label,{interaction=false,realtime=false}={}){
  const browser=await browserType.launch();
  try{
    const context=await browser.newContext({viewport});
    const page=await context.newPage();
    await fakeSupabase(page);await seed(page);await probe(page);
    await page.goto(APP,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__postRevealProbeV468?.visibleAt!==null&&window.BogatkaCloud?.firstSyncCompleted===true,{timeout:30000});
    if(realtime)await page.evaluate(()=>window.cloudHandleRealtime?.());
    await page.waitForFunction(()=>window.__postRevealProbeV468?.done===true,{timeout:35000});
    const history=await page.evaluate(()=>window.__postRevealProbeV468);
    assertHistory(history,label,{realtime});
    if(interaction){
      const panel=page.locator('#locationComparisonPanel'),summary=panel.locator(':scope > summary');
      const before=await panel.evaluate(node=>{const arrow=node.querySelector('.comparison-chevron-v332');return{open:node.open,wrapper:getComputedStyle(arrow).transform,pseudo:getComputedStyle(arrow,'::before').transform}});
      await summary.click();await expect(summary).toHaveAttribute('aria-expanded','true');
      const opened=await panel.evaluate(node=>{const arrow=node.querySelector('.comparison-chevron-v332');return{open:node.open,wrapper:getComputedStyle(arrow).transform,pseudo:getComputedStyle(arrow,'::before').transform}});
      expect(opened.wrapper).toBe('none');expect(opened.pseudo).not.toBe(before.pseudo);
      await summary.click();await expect(summary).toHaveAttribute('aria-expanded','false');
    }
    await context.close();return history;
  }finally{await browser.close()}
}

async function matrix(browserType,name){
  for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:900}]){
    for(let i=0;i<5;i++)await boot(browserType,{width:viewport.width,height:viewport.height},`${name}-${viewport.name}-${i+1}`,{interaction:i===4,realtime:i===4});
  }
}

test('Chromium post-reveal cloud/session phase keeps comparison and badges stable',async()=>{
  await matrix(chromium,'chromium');
});

test('WebKit post-reveal cloud/session phase keeps comparison and badges stable',async()=>{
  await matrix(webkit,'webkit');
});
