import {test,expect,chromium,webkit} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=post-reveal-cloud-startup-v468';
const ORIGIN='http://127.0.0.1:4173/';
const DARK='rgb(28, 41, 51)';
const REMOTE_UPDATED='2026-07-07T12:00:00.000Z';
const EXPECTED={
  'lidskaya-34':{text:'Недостаточно оценок',semantic:'empty'},
  'belusha-41a':{text:'Слабая локация',semantic:'weak'},
  'repina-54':{text:'Перспективно',semantic:'good'},
};
const DEFAULT_META=[
  {id:'lidskaya-34',title:'ул. Лидская, 34, ТЦ «Лидский»',address:'Гродно, ул. Лидская, 34',note:'Основной кандидат для первой точки.'},
  {id:'belusha-41a',title:'ул. Белуша, 41А',address:'Гродно, ул. Белуша, 41А',note:'Альтернатива Лидской, 34 в том же кластере.'},
  {id:'repina-54',title:'ул. Репина, 54',address:'Гродно, ул. Репина, 54',note:'Проверить реальный пешеходный поток и условия помещения.'},
  {id:'rumlevskiy-10',title:'Румлёвский проспект, 10',address:'Гродно, Румлёвский проспект, 10',note:'Перспективный район роста; выяснить причину закрытия прежней точки.'},
  {id:'makarovoy-2',title:'ул. Валентины Макаровой, 2',address:'Гродно, ул. Валентины Макаровой, 2',note:'Растущий район Грандичи; нужен объект на первой линии.'},
  {id:'molodaya-7a',title:'ул. Молодая, 7А, ЖК «Погораны»',address:'Гродно, ул. Молодая, 7А',note:'Только компактный формат с доставкой и проверкой заселённости.'},
  {id:'magistralnaya-10',title:'ул. Магистральная, 10, ЖК «Мир»',address:'Гродно, ул. Магистральная, 10',note:'Резерв: компактный магазин или пункт самовывоза.'},
];
const SCORE_KEYS=['housing','occupied','foot','car','parking','stop','anchor','visibility'];

test.setTimeout(600000);

function fixtureData(){
  const filledBase={
    status:'Осмотрена',objectType:'Торговый центр',date:'2026-07-07',time:'12:00',
    floorLocation:'1 этаж',premiseCondition:'Рабочее состояние',premiseAvailability:'Доступно',landlordReadiness:'Готов обсуждать',
    ownerName:'Арендодатель',contactRole:'Собственник',contact:'Контакт',contactPhone:'+375290000000',
    tech:{totalArea:'45',rentPerMonth:'1250',powerKw:'12',openingHours:'10:00-21:00',utilities:'180',repairEstimate:'3000'},
    pros:'Поток и район подходят',cons:'Есть ограничения',risks:'Проверить договор',questions:'Уточнить каникулы',decision:'Оставить',
  };
  const weakScores=Object.fromEntries(SCORE_KEYS.map(key=>[key,'1']));
  const goodScores=Object.fromEntries(SCORE_KEYS.map(key=>[key,'5']));
  return {
    'lidskaya-34':{},
    'belusha-41a':{...structuredClone(filledBase),score:weakScores,updatedAt:'2026-07-07T09:00:00.000Z'},
    'repina-54':{...structuredClone(filledBase),score:goodScores,updatedAt:'2026-07-07T09:05:00.000Z'},
  };
}

async function seedFixture(page){
  const forms=fixtureData();
  await page.goto(ORIGIN,{waitUntil:'domcontentloaded'});
  await page.evaluate(async({forms,meta,updated})=>{
    localStorage.clear();
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
    await put('records',meta.map(item=>({...item,custom:false,cloudId:`cloud-${item.id}`})),'meta:locations');
    for(const item of meta)await put('records',{...(forms[item.id]||{}),cloudId:`cloud-${item.id}`,cloudRevision:1,cloudUpdatedAt:updated},`location:${item.id}`);
    await put('photos',{id:'photo-lidskaya-1',locationId:'lidskaya-34',category:'street',caption:'Фасад',storagePath:'project/cloud-lidskaya-34/photo-lidskaya-1.jpg',cloudLocationId:'cloud-lidskaya-34',cloudSyncedAt:updated,originalName:'photo.jpg',width:10,height:10,size:4,createdAt:updated,blob:new Blob(['fake'],{type:'image/jpeg'})});
    db.close();
  },{forms,meta:DEFAULT_META,updated:REMOTE_UPDATED});
}

async function installFakeSupabase(page){
  const forms=fixtureData();
  const remoteLocations=DEFAULT_META.map((item,index)=>({
    id:`cloud-${item.id}`,project_id:'project-1',client_id:item.id,title:item.title,address:item.address,note:item.note,
    status:forms[item.id]?.status||null,object_type:forms[item.id]?.objectType||null,form_data:forms[item.id]||{},sort_order:index,
    revision:1,created_at:REMOTE_UPDATED,updated_at:REMOTE_UPDATED,archived_at:null,
  }));
  const remotePhotos=[{id:'photo-lidskaya-1',project_id:'project-1',location_id:'cloud-lidskaya-34',category:'street',caption:'Фасад',storage_path:'project/cloud-lidskaya-34/photo-lidskaya-1.jpg',original_name:'photo.jpg',mime_type:'image/jpeg',width:10,height:10,file_size:4,created_at:REMOTE_UPDATED,updated_at:REMOTE_UPDATED,deleted_at:null}];
  await page.route('**/@supabase/supabase-js@2**',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.supabase={createClient:function(){return window.__bogatkaFakeSupabaseClient();}};'}));
  await page.addInitScript(({remoteLocations,remotePhotos})=>{
    const session={user:{id:'owner-user',email:'owner@example.com',user_metadata:{display_name:'Owner'}}};
    const state={remoteLocations:structuredClone(remoteLocations),remotePhotos:structuredClone(remotePhotos),reports:[],subscriptions:[],calls:[]};
    const clone=value=>structuredClone(value);
    const filtersApply=(rows,filters)=>rows.filter(row=>filters.every(([type,key,value])=>type==='eq'?row[key]===value:type==='is'?row[key]===value||row[key]===null:true));
    function result(data,error=null){return Promise.resolve({data,error})}
    function builder(table){
      const query={table,action:'select',payload:null,filters:[],singleMode:null,fields:'*'};
      const api={
        select(fields='*'){query.fields=fields;return api},
        eq(key,value){query.filters.push(['eq',key,value]);return api},
        is(key,value){query.filters.push(['is',key,value]);return api},
        in(key,values){query.filters.push(['in',key,values]);return api},
        order(){return api},
        upsert(payload){query.action='upsert';query.payload=Array.isArray(payload)?payload:[payload];return api},
        update(payload){query.action='update';query.payload=payload;return api},
        delete(){query.action='delete';return api},
        insert(payload){query.action='insert';query.payload=Array.isArray(payload)?payload:[payload];return api},
        single(){query.singleMode='single';return execute()},
        maybeSingle(){query.singleMode='maybe';return execute()},
        then(resolve,reject){return execute().then(resolve,reject)},
      };
      async function execute(){
        state.calls.push({table:query.table,action:query.action,at:performance.now()});
        if(table==='locations'){
          if(query.action==='upsert'||query.action==='update'){
            const rows=query.action==='update'?[{...(query.payload||{}),id:query.filters.find(item=>item[1]==='id')?.[2]}]:query.payload;
            for(const row of rows){
              const id=row.id||`cloud-${row.client_id}`;
              const existing=state.remoteLocations.find(item=>item.id===id||item.client_id===row.client_id);
              const next={...(existing||{}),...row,id,revision:(existing?.revision||1),updated_at:REMOTE_UPDATED,created_at:existing?.created_at||REMOTE_UPDATED};
              if(existing)Object.assign(existing,next);else state.remoteLocations.push(next);
            }
            const data=rows.map(row=>clone(state.remoteLocations.find(item=>item.id===(row.id||`cloud-${row.client_id}`)||item.client_id===row.client_id)));
            return result(query.singleMode?data[0]||null:data);
          }
          if(query.action==='delete'){state.remoteLocations=state.remoteLocations.filter(row=>!filtersApply([row],query.filters).length);return result(null)}
          const rows=filtersApply(state.remoteLocations,query.filters).filter(row=>row.archived_at===null||row.archived_at===undefined);
          return result(query.singleMode?(rows[0]||null):clone(rows));
        }
        if(table==='photos'){
          if(query.action==='delete'){state.remotePhotos=state.remotePhotos.filter(row=>!filtersApply([row],query.filters).length);return result(null)}
          if(query.action==='upsert'){
            for(const row of query.payload){const existing=state.remotePhotos.find(item=>item.id===row.id);if(existing)Object.assign(existing,row,{updated_at:REMOTE_UPDATED});else state.remotePhotos.push({...row,created_at:REMOTE_UPDATED,updated_at:REMOTE_UPDATED,deleted_at:null});}
            return result(query.singleMode?clone(query.payload[0]):clone(query.payload));
          }
          const rows=filtersApply(state.remotePhotos,query.filters).filter(row=>row.deleted_at===null||row.deleted_at===undefined);
          return result(query.singleMode?(rows[0]||null):clone(rows));
        }
        if(table==='project_state'){
          if(query.action==='upsert')return result({project_id:'project-1',data:{},updated_at:REMOTE_UPDATED});
          return result(query.singleMode?null:null);
        }
        if(table==='project_members')return result(query.singleMode?{role:'owner'}:[{user_id:'owner-user',role:'owner',created_at:REMOTE_UPDATED}]);
        if(table==='profiles')return result([{id:'owner-user',email:'owner@example.com',display_name:'Owner'}]);
        if(table==='projects')return result({id:'project-1',name:'Bogatka',slug:'bogatka-grodno',description:'',updated_at:REMOTE_UPDATED});
        if(table==='reports'){
          if(query.action==='insert'){const report={public_token:'token-v468'};state.reports.push(report);return result(report)}
        }
        return result(query.singleMode?null:[]);
      }
      return api;
    }
    window.__bogatkaFakeSupabaseState=state;
    window.__bogatkaFakeSupabaseClient=()=>({
      auth:{
        getSession:()=>result({session}),
        onAuthStateChange:callback=>{setTimeout(()=>callback('INITIAL_SESSION',session),20);return{data:{subscription:{unsubscribe(){}}}}},
        signOut:()=>result(null),
        signInWithPassword:()=>result({session}),
        signUp:()=>result({session}),
        resetPasswordForEmail:()=>result({}),
      },
      rpc:(name,args)=>{
        state.calls.push({rpc:name,args,at:performance.now()});
        if(name==='claim_bogatka_project')return result('project-1');
        if(name==='add_project_member_by_email'||name==='update_project_member_role'||name==='remove_project_member')return result(true);
        return result(null);
      },
      from:builder,
      storage:{from:()=>({download:()=>result(new Blob(['fake'],{type:'image/jpeg'})),upload:()=>result({}),remove:()=>result([])})},
      channel:name=>({name,on(){return this},subscribe(){state.subscriptions.push(name);return this}}),
      removeChannel:channel=>{state.subscriptions=state.subscriptions.filter(name=>name!==channel?.name);return result(null)},
    });
  },{remoteLocations,remotePhotos});
}

async function installStartupProbe(page){
  await page.addInitScript(()=>{
    localStorage.setItem('bogatka_access_authorized_v1','1');
    const ids=new WeakMap();let seq=0;const nodeId=node=>{if(!node)return null;if(!ids.has(node))ids.set(node,++seq);return ids.get(node)};
    const probe={domContentLoadedAt:null,windowLoadAt:null,criticalReadyAt:null,appVisibleAt:null,cloudFirstReadyAt:null,done:false,events:[],functionCalls:[],samples:[]};
    const now=()=>Math.round(performance.now()*10)/10;const mark=(type,detail={})=>probe.events.push({at:now(),type,...detail});
    document.addEventListener('DOMContentLoaded',()=>{probe.domContentLoadedAt=now();mark('domcontentloaded')},{once:true});
    window.addEventListener('load',()=>{probe.windowLoadAt=now();mark('window-load')},{once:true});
    window.addEventListener('bogatka:critical-ui-ready',event=>{probe.criticalReadyAt=now();mark('critical-ui-ready',event.detail||{})});
    window.addEventListener('bogatka:app-visible',event=>{probe.appVisibleAt=now();mark('app-visible-event',event.detail||{})});
    window.addEventListener('bogatka:cloud-first-sync-ready',event=>{probe.cloudFirstReadyAt=now();mark('cloud-first-sync-ready',event.detail||{})});
    const appVisible=()=>{const app=document.getElementById('app');if(!app||app.classList.contains('hidden'))return false;const cs=getComputedStyle(app),r=app.getBoundingClientRect();return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0};
    const style=node=>{if(!node)return null;const cs=getComputedStyle(node),r=node.getBoundingClientRect();return{display:cs.display,visibility:cs.visibility,backgroundColor:cs.backgroundColor,borderColor:cs.borderColor,borderWidth:cs.borderWidth,borderRadius:cs.borderRadius,color:cs.color,fontFamily:cs.fontFamily,fontSize:cs.fontSize,fontWeight:cs.fontWeight,lineHeight:cs.lineHeight,width:cs.width,height:cs.height,rectWidth:Math.round(r.width*10)/10,rectHeight:Math.round(r.height*10)/10,padding:[cs.paddingTop,cs.paddingRight,cs.paddingBottom,cs.paddingLeft].join(' '),transform:cs.transform}};
    const pseudo=node=>{if(!node)return null;const cs=getComputedStyle(node,'::before');return{transform:cs.transform,width:cs.width,height:cs.height,transition:cs.transition}};
    const comparison=()=>{const panel=document.getElementById('locationComparisonPanel'),summary=panel?.querySelector(':scope > summary'),body=panel?.querySelector(':scope > .comparison-body-v332'),chevron=panel?.querySelector('.comparison-chevron-v332');return panel?{panelId:nodeId(panel),summaryId:nodeId(summary),bodyId:nodeId(body),chevronId:nodeId(chevron),className:panel.className,open:Boolean(panel.open),ariaExpanded:summary?.getAttribute('aria-expanded')||'',bodyHidden:Boolean(body?.hidden),panelStyle:style(panel),summaryStyle:style(summary),chevronStyle:style(chevron),chevronPseudo:pseudo(chevron)}:null};
    const visibleBadges=card=>[...card.querySelectorAll('[data-card-recommendation-v448]')].filter(node=>{const cs=getComputedStyle(node),r=node.getBoundingClientRect();return !node.hidden&&cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0});
    const badges=()=>[...document.querySelectorAll('[data-location-card]')].map(card=>({locationId:card.dataset.locationCard,cardId:nodeId(card),nodes:visibleBadges(card).map(node=>({nodeId:nodeId(node),text:node.textContent.trim(),className:node.className,dataClass:node.dataset.recommendationClass||'',title:node.title||'',ariaLabel:node.getAttribute('aria-label')||'',hidden:Boolean(node.hidden),style:style(node)}))}));
    const sample=reason=>{if(!appVisible())return;if(probe.appVisibleAt===null){probe.appVisibleAt=now();mark('app-visible-sampled')}probe.samples.push({at:now(),elapsed:Math.round((now()-probe.appVisibleAt)*10)/10,reason,cloudReady:window.BogatkaCloud?.firstSyncCompleted||false,cloudPill:document.querySelector('#cloudTopPill')?.textContent.trim()||'',comparison:comparison(),badges:badges()})};
    const mutationWriter=()=>{const active=probe.functionCalls.filter(call=>call.type==='start'&&call.end===undefined).at(-1);return active?.name||'unknown'};
    const observer=new MutationObserver(records=>{for(const record of records){if(record.target?.id==='app'&&record.attributeName==='class')mark('app-class-change',{className:record.target.className,visible:appVisible(),writer:mutationWriter()});for(const node of record.addedNodes){if(!(node instanceof Element))continue;if(node.id==='locationComparisonPanel'||node.querySelector?.('#locationComparisonPanel'))mark('comparison-inserted',{writer:mutationWriter()});if(node.matches?.('[data-card-recommendation-v448]')||node.querySelector?.('[data-card-recommendation-v448]'))mark('recommendation-inserted',{writer:mutationWriter()})}}sample(`mutation:${mutationWriter()}`)});
    observer.observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','open','aria-expanded','data-recommendation-class','style']});
    const wrapped=new Set();
    function wrapGlobal(name){if(wrapped.has(`g:${name}`))return;let fn;try{fn=eval(name)}catch(_){fn=window[name]}if(typeof fn!=='function')return;const wrappedFn=function(...args){const entry={name,start:now(),type:'start'};probe.functionCalls.push(entry);try{const result=fn.apply(this,args);if(result?.finally)return result.finally(()=>{entry.end=now();entry.type='end'});entry.end=now();entry.type='end';return result}catch(error){entry.end=now();entry.type='throw';entry.message=error?.message||String(error);throw error}};Object.assign(wrappedFn,fn);wrappedFn.__probeV468=true;wrappedFn.__base=fn;window[name]=wrappedFn;try{eval(`${name}=window[${JSON.stringify(name)}]`)}catch(_){ }wrapped.add(`g:${name}`)}
    function wrapMethod(objectName,method){const object=window[objectName],key=`${objectName}.${method}`;if(wrapped.has(key)||!object||typeof object[method]!=='function')return;const fn=object[method];object[method]=function(...args){const entry={name:key,start:now(),type:'start'};probe.functionCalls.push(entry);try{const result=fn.apply(this,args);if(result?.finally)return result.finally(()=>{entry.end=now();entry.type='end'});entry.end=now();entry.type='end';return result}catch(error){entry.end=now();entry.type='throw';entry.message=error?.message||String(error);throw error}};object[method].__probeV468=true;object[method].__base=fn;wrapped.add(key)}
    const installWrappers=()=>{['authorize','renderLocations','restoreAllForms','updateSummary','cloudInit','cloudEnsureProject','cloudSetStatus','cloudSyncAll','cloudFetchRemote','cloudApplyRemote','cloudPushLocations','cloudPushProjectState','cloudSubscribeRealtime','cloudHandleRealtime','applyVersion23Enhancements','ensureWorkflowEnhancements'].forEach(wrapGlobal);wrapMethod('BogatkaStartup','prepareCriticalUi');wrapMethod('BogatkaStartup','prepareCloudBeforeReveal');wrapMethod('BogatkaCloud','init');wrapMethod('BogatkaDecisionUI','refresh');wrapMethod('BogatkaCardProgressV448','renderAll');wrapMethod('BogatkaLocationCardCollapseV422','enhanceAll');wrapMethod('BogatkaWorkflowV414','enhanceAll');wrapMethod('BogatkaSelftest','run')};
    let last=0;
    const loop=()=>{installWrappers();if(appVisible()){const elapsed=now()-probe.appVisibleAt;if(elapsed<3000||now()-last>200){last=now();sample('frame')}if(elapsed>=20000&&window.BogatkaCloud?.firstSyncCompleted){probe.done=true;observer.disconnect();return}}requestAnimationFrame(loop)};
    window.__startupProbeV468=probe;requestAnimationFrame(loop);
  });
}

async function bootAndCapture(browserType,viewport,label,{interaction=false,triggerRealtime=false}={}){
  const browser=await browserType.launch();
  try{
    const context=await browser.newContext({viewport});
    const page=await context.newPage();
    await installFakeSupabase(page);
    await seedFixture(page);
    await installStartupProbe(page);
    await page.goto(APP,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__startupProbeV468?.appVisibleAt!==null&&window.BogatkaCloud?.firstSyncCompleted===true,{timeout:30000});
    if(triggerRealtime)await page.evaluate(()=>{window.cloudHandleRealtime?.();window.BogatkaCloudStability?.signalRemote?.()});
    await page.waitForFunction(()=>window.__startupProbeV468?.done===true,{timeout:35000});
    const history=await page.evaluate(()=>window.__startupProbeV468);
    assertStartupHistory(history,label,{triggerRealtime});
    if(interaction)await assertInteraction(page,label);
    await context.close();
    return history;
  }finally{await browser.close()}
}

function stableBadgeSignature(node){return JSON.stringify({text:node.text,className:node.className,dataClass:node.dataClass,title:node.title,ariaLabel:node.ariaLabel,backgroundColor:node.style.backgroundColor,borderColor:node.style.borderColor,color:node.style.color,fontFamily:node.style.fontFamily,fontSize:node.style.fontSize,fontWeight:node.style.fontWeight,lineHeight:node.style.lineHeight,width:node.style.width,height:node.style.height,rectWidth:node.style.rectWidth,rectHeight:node.style.rectHeight,padding:node.style.padding,borderRadius:node.style.borderRadius})}

function assertStartupHistory(history,label,{triggerRealtime=false}={}){
  expect(history.appVisibleAt,`${label}: app became visible`).not.toBeNull();
  expect(history.criticalReadyAt,`${label}: critical ready before reveal`).not.toBeNull();
  expect(history.criticalReadyAt,`${label}: critical ready before app visible`).toBeLessThanOrEqual(history.appVisibleAt);
  expect(history.cloudFirstReadyAt,`${label}: cloud first sync completed before reveal`).not.toBeNull();
  expect(history.cloudFirstReadyAt,`${label}: cloud first sync before app visible`).toBeLessThanOrEqual(history.appVisibleAt);
  expect(history.samples.length,`${label}: sampled post-reveal phase`).toBeGreaterThan(40);
  const first=history.samples[0],firstComparison=first.comparison;
  expect(firstComparison,`${label}: comparison exists on first visible frame`).not.toBeNull();
  expect(firstComparison.open,`${label}: comparison closed on first frame`).toBe(false);
  expect(firstComparison.ariaExpanded,`${label}: comparison aria closed`).toBe('false');
  expect(firstComparison.bodyHidden,`${label}: comparison body hidden`).toBe(true);
  expect(firstComparison.panelStyle.backgroundColor,`${label}: orange background`).toBe('rgb(255, 250, 240)');
  expect(firstComparison.panelStyle.borderColor,`${label}: orange border`).toBe('rgb(216, 184, 96)');
  expect(firstComparison.panelStyle.borderWidth,`${label}: border width`).toBe('2px');
  expect(firstComparison.panelStyle.borderRadius,`${label}: panel radius`).toBe('18px');
  expect(firstComparison.chevronStyle.transform,`${label}: chevron wrapper not rotated`).toBe('none');
  expect(firstComparison.chevronPseudo.width,`${label}: chevron pseudo width`).toBe('11px');
  expect(firstComparison.chevronPseudo.height,`${label}: chevron pseudo height`).toBe('11px');

  const firstByLocation=new Map();
  for(const entry of first.badges){expect(entry.nodes.length,`${label}: one visible badge for ${entry.locationId} on first frame`).toBe(1);firstByLocation.set(entry.locationId,entry.nodes[0])}
  expect(firstByLocation.size,`${label}: badges for all locations`).toBeGreaterThanOrEqual(7);
  for(const [locationId,expected] of Object.entries(EXPECTED)){
    const badge=firstByLocation.get(locationId);
    expect(badge,`${label}: expected badge ${locationId}`).toBeTruthy();
    expect(badge.text,`${label}: ${locationId} text`).toBe(expected.text);
    expect(badge.dataClass,`${label}: ${locationId} semantic`).toBe(expected.semantic);
    expect(badge.className,`${label}: ${locationId} canonical class`).toContain(`recommendation-status-v448 ${expected.semantic}`);
  }
  const firstBadgeSignatures=new Map([...firstByLocation].map(([id,node])=>[id,{nodeId:node.nodeId,signature:stableBadgeSignature(node),dataClass:node.dataClass}]));
  for(const [index,sample] of history.samples.entries()){
    expect(sample.comparison,`${label}: comparison never missing after reveal, sample ${index}`).not.toBeNull();
    const current=sample.comparison;
    expect(current.panelId,`${label}: comparison panel identity stable`).toBe(firstComparison.panelId);
    expect(current.summaryId,`${label}: comparison summary identity stable`).toBe(firstComparison.summaryId);
    expect(current.className,`${label}: comparison class stable`).toBe(firstComparison.className);
    expect(current.panelStyle.backgroundColor,`${label}: comparison background stable`).toBe(firstComparison.panelStyle.backgroundColor);
    expect(current.panelStyle.borderColor,`${label}: comparison border stable`).toBe(firstComparison.panelStyle.borderColor);
    expect(current.chevronStyle.transform,`${label}: chevron wrapper transform stable`).toBe('none');
    expect(current.chevronPseudo.transform,`${label}: chevron pseudo stable before click`).toBe(firstComparison.chevronPseudo.transform);
    const seen=new Set();
    for(const entry of sample.badges){
      seen.add(entry.locationId);
      expect(entry.nodes.length,`${label}: one badge for ${entry.locationId}, sample ${index}`).toBe(1);
      const firstBadge=firstBadgeSignatures.get(entry.locationId);if(!firstBadge)continue;
      const node=entry.nodes[0];
      expect(node.nodeId,`${label}: badge node identity stable for ${entry.locationId}`).toBe(firstBadge.nodeId);
      expect(stableBadgeSignature(node),`${label}: badge visual/text stable for ${entry.locationId}`).toBe(firstBadge.signature);
      expect(node.style.color,`${label}: badge dark text for ${entry.locationId}`).toBe(DARK);
      expect(node.style.fontSize,`${label}: badge font size for ${entry.locationId}`).toBe('11px');
      expect(node.style.fontWeight,`${label}: badge font weight for ${entry.locationId}`).toBe('800');
      expect(node.style.borderRadius,`${label}: badge radius for ${entry.locationId}`).toBe('999px');
      if(['lidskaya-34','belusha-41a'].includes(entry.locationId))expect(['good','priority','medium']).not.toContain(node.dataClass);
    }
    for(const id of firstBadgeSignatures.keys())expect(seen.has(id),`${label}: badge still present for ${id}`).toBe(true);
  }
  const postRevealCalls=history.functionCalls.filter(call=>call.start>=history.appVisibleAt);
  expect(postRevealCalls.filter(call=>call.name==='renderLocations').length,`${label}: no all-card renderLocations after reveal`).toBe(0);
  if(triggerRealtime){
    expect(postRevealCalls.some(call=>call.name==='cloudHandleRealtime'),`${label}: realtime path observed`).toBe(true);
    expect(postRevealCalls.filter(call=>call.name==='cloudApplyRemote').length,`${label}: no-op realtime may run but must not render all cards`).toBeGreaterThanOrEqual(0);
  }
}

async function assertInteraction(page,label){
  const beforeBadges=await page.evaluate(()=>[...document.querySelectorAll('[data-location-card]')].map(card=>({id:card.dataset.locationCard,badge:[...card.querySelectorAll('[data-card-recommendation-v448]')].filter(node=>!node.hidden&&getComputedStyle(node).display!=='none').map(node=>({text:node.textContent.trim(),className:node.className,dataClass:node.dataset.recommendationClass||''}))})));
  const panel=page.locator('#locationComparisonPanel'),summary=panel.locator(':scope > summary');
  const before=await panel.evaluate(node=>{const arrow=node.querySelector('.comparison-chevron-v332');return{open:node.open,wrapper:getComputedStyle(arrow).transform,pseudo:getComputedStyle(arrow,'::before').transform}});
  await summary.click();await expect(summary).toHaveAttribute('aria-expanded','true');
  const opened=await panel.evaluate(node=>{const arrow=node.querySelector('.comparison-chevron-v332');return{open:node.open,wrapper:getComputedStyle(arrow).transform,pseudo:getComputedStyle(arrow,'::before').transform}});
  expect(opened.open,`${label}: comparison opens`).toBe(true);expect(opened.wrapper,`${label}: wrapper remains stable on open`).toBe('none');expect(opened.pseudo,`${label}: pseudo changes only after click`).not.toBe(before.pseudo);
  await summary.click();await expect(summary).toHaveAttribute('aria-expanded','false');
  const closed=await panel.evaluate(node=>{const arrow=node.querySelector('.comparison-chevron-v332');return{open:node.open,wrapper:getComputedStyle(arrow).transform,pseudo:getComputedStyle(arrow,'::before').transform}});
  expect(closed).toEqual(before);
  const firstToggle=page.locator('[data-location-card] .location-collapse-toggle-v422').first();await firstToggle.click();
  const afterBadges=await page.evaluate(()=>[...document.querySelectorAll('[data-location-card]')].map(card=>({id:card.dataset.locationCard,badge:[...card.querySelectorAll('[data-card-recommendation-v448]')].filter(node=>!node.hidden&&getComputedStyle(node).display!=='none').map(node=>({text:node.textContent.trim(),className:node.className,dataClass:node.dataset.recommendationClass||''}))})));
  expect(afterBadges,`${label}: opening a location does not mutate badges`).toEqual(beforeBadges);
}

async function repeatedMatrix(browserType,engine){
  for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:900}]){
    for(let i=0;i<5;i++){
      await bootAndCapture(browserType,{width:viewport.width,height:viewport.height},`${engine}-${viewport.name}-reload-${i+1}`,{interaction:i===4,triggerRealtime:i===4});
    }
  }
}

test('Chromium post-reveal cloud startup is stable across desktop/mobile repeated reloads',async()=>{
  await repeatedMatrix(chromium,'chromium');
});

test('WebKit post-reveal cloud startup is stable across desktop/mobile repeated reloads',async()=>{
  await repeatedMatrix(webkit,'webkit');
});
