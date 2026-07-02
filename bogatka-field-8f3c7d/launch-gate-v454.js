(function(){
  'use strict';
  if(window.BogatkaLaunchGateV454?.ready)return;

  const VERSION='4.5.8';
  const saveQueues=new Map();
  let installAttempts=0;
  let reportAttempts=0;
  let renderTimer=null;
  let lastError=null;

  const isViewer=()=>{try{return window.cloudRole==='viewer'||cloudRole==='viewer'}catch(_){return false}};
  const now=()=>new Date().toISOString();
  const valueOf=element=>element.type==='checkbox'?element.checked:element.type==='radio'?(element.checked?element.value:undefined):element.value;
  const getDeal=()=>window.BogatkaCriticalDeal;
  const getSuite=()=>window.BogatkaSuite;

  function activeLocations(){
    try{if(typeof locations!=='undefined'&&Array.isArray(locations))return locations.filter(item=>!item.archivedAt);}catch(_){ }
    return Array.isArray(window.locations)?window.locations.filter(item=>!item.archivedAt):[];
  }

  function gateState(data={}){
    const gate=getDeal()?.evaluate?.(data)||{code:'incomplete',compactText:'Проверки не завершены',badge:'Проверки не завершены'};
    if(String(data.decision||'').trim()!=='Оставить')return{code:'decision',allowed:false,label:'Не активирован',title:'Сначала примите решение по локации',text:'Проект открытия доступен только после решения «Оставить».',gate};
    if(gate.code!=='confirmed')return{code:'checks',allowed:false,label:gate.compactText||'Проверки не завершены',title:'Сначала завершите проверки перед арендой',text:gate.badge||gate.text||'Есть незавершённые проверки.',gate};
    return{code:'ready',allowed:true,label:'Готов к запуску',title:'Локация готова к созданию проекта открытия',text:'Решение принято, обязательные проверки завершены.',gate};
  }

  function enqueue(locationId,task){
    const shared=window.BogatkaFieldIntegrityV416?.enqueueLocation;
    const current=typeof shared==='function'
      ?shared(locationId,task)
      :(saveQueues.get(locationId)||Promise.resolve()).catch(()=>{}).then(task);
    saveQueues.set(locationId,current);
    return current.finally(()=>{if(saveQueues.get(locationId)===current)saveQueues.delete(locationId);});
  }

  function finishSave(locationId){
    const queue=saveQueues.get(locationId);
    Promise.resolve(queue).finally(()=>{
      if(saveQueues.has(locationId))return;
      window.showSaved?.();
    });
  }

  async function saveWithoutLaunch(element){
    const locationId=element?.dataset?.location;
    const field=element?.dataset?.field;
    const value=valueOf(element);
    if(!locationId||!field||value===undefined||isViewer())return false;
    window.showSaving?.();
    const result=enqueue(locationId,async()=>{
      const data=await getLocationData(locationId);
      const previous=getNested(data,field);
      if(JSON.stringify(previous??'')===JSON.stringify(value??''))return true;
      setNested(data,field,value);
      getSuite()?.appendActivityToData?.(data,{action:'Изменено поле',field,label:field==='decision'?'Предварительное решение':'Статус',from:previous,to:value});
      data.updatedAt=now();
      await idbPut(STORE,data,`location:${locationId}`);
      window.updateLocationTotal?.(locationId,data);
      await window.updateSummary?.();
      const card=document.querySelector(`[data-location-card="${CSS.escape(locationId)}"]`);
      if(card)renderCard(card,data);
      return true;
    });
    result.catch(error=>{lastError=error;window.showError?.(error)||console.error(error);});
    finishSave(locationId);
    return result;
  }

  function installSaveGuard(){
    const current=window.saveField||((typeof saveField==='function')?saveField:null);
    if(typeof current!=='function')return false;
    if(current.__launchGateV454)return true;
    const guarded=async function(element){
      const field=element?.dataset?.field;
      if(field==='decision'||field==='status')return saveWithoutLaunch(element);
      return current(element);
    };
    Object.assign(guarded,current);guarded.__launchGateV454=true;guarded.__base=current;
    window.saveField=guarded;
    try{saveField=guarded}catch(_){ }
    return true;
  }

  function installSuiteGuard(){
    const api=getSuite();
    if(!api)return false;
    const current=api.installFunctionOverrides;
    if(typeof current==='function'&&!current.__launchGateV454){
      const wrapped=function(...args){const result=current.apply(this,args);installSaveGuard();return result;};
      Object.assign(wrapped,current);wrapped.__launchGateV454=true;wrapped.__base=current;
      api.installFunctionOverrides=wrapped;
    }
    installSaveGuard();
    return true;
  }

  function expandCard(card){
    window.BogatkaLocationCardCollapseV422?.setCollapsed?.(card,false,{persist:true});
    const body=card?.querySelector(':scope > .location-body');
    if(body){body.hidden=false;body.setAttribute('aria-hidden','false');}
  }

  function openDealChecks(card){
    expandCard(card);
    const details=[...card.querySelectorAll('details')].find(node=>String(node.querySelector(':scope > summary')?.textContent||'').includes('Проверки перед арендой'));
    if(!details)return;
    for(let current=details;current&&current!==card;current=current.parentElement){
      if(current.tagName==='DETAILS')current.open=true;
      if(current.hidden)current.hidden=false;
      current.classList.remove('hidden','panel-closed-v419','collapsed');
      if(current.dataset?.panelOpenV419!==undefined)current.dataset.panelOpenV419='1';
    }
    details.open=true;
    details.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function ensureOverlay(details){
    let overlay=details.querySelector(':scope > .launch-gate-overlay-v454');
    if(overlay)return overlay;
    overlay=document.createElement('div');
    overlay.className='launch-gate-overlay-v454';
    const summary=details.querySelector(':scope > summary');
    if(summary)summary.insertAdjacentElement('afterend',overlay);else details.prepend(overlay);
    return overlay;
  }

  function removeOverlay(details){
    details.querySelector(':scope > .launch-gate-overlay-v454')?.remove();
    details.dataset.launchGateBodyV454='visible';
  }

  function overlayMarkup(state,id,mode){
    const action=mode==='checks'?'<button type="button" class="btn secondary" data-open-deal-checks-v454>Открыть проверки перед арендой</button>':mode==='activate'?`<button type="button" class="btn" data-launch-activate-v454="${id}"${isViewer()?' disabled':''}>Создать проект открытия</button>`:'';
    return`<div class="launch-gate-message-v454"><strong>${state.title}</strong><p>${state.text}</p>${action}</div>`;
  }

  function showOverlay(details,state,id,mode){
    details.dataset.launchGateBodyV454='hidden';
    const overlay=ensureOverlay(details);
    const key=`${state.code}:${mode}:${state.label}:${isViewer()?'viewer':'edit'}`;
    if(overlay.dataset.renderKeyV454!==key){
      overlay.dataset.renderKeyV454=key;
      overlay.innerHTML=overlayMarkup(state,id,mode);
    }
    return overlay;
  }

  async function activate(card,locationId){
    if(isViewer())return false;
    window.showSaving?.();
    const result=enqueue(locationId,async()=>{
      const data=await getLocationData(locationId);
      const state=gateState(data);
      if(!state.allowed){renderCard(card,data);return false;}
      getSuite().ensureLaunchProject(data);
      data.updatedAt=now();
      await idbPut(STORE,data,`location:${locationId}`);
      await window.updateSummary?.();
      const scrollY=window.scrollY;
      if(typeof window.renderLocations==='function')window.renderLocations();
      requestAnimationFrame(()=>{
        window.scrollTo(0,scrollY);
        schedule(0);
      });
      return true;
    });
    result.catch(error=>{lastError=error;window.showError?.(error)||console.error(error);});
    finishSave(locationId);
    return result;
  }

  function renderCard(card,data={}){
    const id=card?.dataset?.locationCard;
    const details=card?.querySelector(`[data-launch-details="${CSS.escape(id||'')}"]`);
    const body=card?.querySelector(`[data-launch-body="${CSS.escape(id||'')}"]`);
    const label=card?.querySelector(`[data-launch-label="${CSS.escape(id||'')}"]`);
    if(!id||!details||!body)return false;
    const state=gateState(data);
    details.dataset.launchGateV454=state.code;

    if(state.code==='decision'){
      if(label&&label.textContent!==state.label)label.textContent=state.label;
      showOverlay(details,state,id,'decision');
      details.open=false;
      return true;
    }

    if(state.code==='checks'){
      if(label&&label.textContent!==state.label)label.textContent=state.label;
      const overlay=showOverlay(details,state,id,'checks');
      overlay.querySelector('[data-open-deal-checks-v454]')?.addEventListener('click',()=>openDealChecks(card),{once:true});
      return true;
    }

    if(!data.launchProject?.enabled){
      if(label&&label.textContent!==state.label)label.textContent=state.label;
      const overlay=showOverlay(details,state,id,'activate');
      const button=overlay.querySelector('[data-launch-activate-v454]');
      if(button){
        button.disabled=isViewer();
        if(button.dataset.boundV454!=='1'){
          button.dataset.boundV454='1';
          button.addEventListener('click',()=>activate(card,id));
        }
      }
      return true;
    }

    removeOverlay(details);
    details.dataset.launchGateV454='ready';
    if(label&&/^Готов к запуску|Не активирован|Провер/.test(label.textContent||''))label.textContent='Проект активирован';
    return true;
  }

  async function renderAll(){
    try{
      installSuiteGuard();
      for(const card of document.querySelectorAll('[data-location-card]'))renderCard(card,await getLocationData(card.dataset.locationCard));
      lastError=null;return true;
    }catch(error){lastError=error;console.error(error);return false;}
  }

  async function transformReport(html){
    const documentReport=new DOMParser().parseFromString(html,'text/html');
    const cards=[...documentReport.querySelectorAll('.report-location-card,.report-location')];
    const items=activeLocations();
    for(let index=0;index<cards.length;index++){
      const item=items[index];if(!item)continue;
      const data=await getLocationData(item.id);
      if(gateState(data).allowed)continue;
      cards[index].querySelectorAll('.launch-report').forEach(section=>section.remove());
      [...cards[index].querySelectorAll('h3')].filter(heading=>heading.textContent.trim().startsWith('Проект открытия')).forEach(heading=>heading.closest('section')?.remove());
    }
    return`<!doctype html>\n${documentReport.documentElement.outerHTML}`;
  }

  function chainContains(fn,marker){
    const seen=new Set();
    while(typeof fn==='function'&&!seen.has(fn)){if(fn[marker])return true;seen.add(fn);fn=fn.__base;}
    return false;
  }

  function installReportGuard(){
    reportAttempts+=1;
    const api=window.BogatkaLiveReport;
    const current=api?.build;
    if(typeof current!=='function'||!current.__quickChecklistReportV451||!current.__trafficCompetitorsV453){if(reportAttempts<200)setTimeout(installReportGuard,100);return false;}
    if(chainContains(current,'__launchGateV454'))return true;
    const wrapped=async function(...args){return transformReport(await current(...args));};
    Object.assign(wrapped,current);wrapped.__launchGateV454=true;wrapped.__base=current;
    api.build=wrapped;window.buildReportHtml=wrapped;
    try{buildReportHtml=wrapped}catch(_){ }
    return true;
  }

  function schedule(delay=80){clearTimeout(renderTimer);renderTimer=setTimeout(()=>renderAll(),delay);}

  function audit(){
    const failures=[];
    document.querySelectorAll('[data-location-card]').forEach(card=>{
      const id=card.dataset.locationCard;
      const details=card.querySelector(`[data-launch-details="${CSS.escape(id)}"]`);
      if(!details)failures.push(`${id}:launch-details-missing`);
      else if(!details.dataset.launchGateV454)failures.push(`${id}:gate-state-missing`);
      if(details?.dataset.launchGateBodyV454==='hidden'&&!details.querySelector(':scope > .launch-gate-overlay-v454'))failures.push(`${id}:gate-overlay-missing`);
    });
    return{ok:failures.length===0,failures,lastError:lastError?String(lastError):''};
  }

  function install(){
    installAttempts+=1;
    if(!getDeal()||!getSuite()){
      if(installAttempts<200)setTimeout(install,80);
      return;
    }
    installSuiteGuard();
    const root=document.getElementById('locations')||document.body;
    new MutationObserver(records=>{if(records.some(record=>record.target===root))schedule(100);}).observe(root,{childList:true});
    schedule(20);[300,800,1600,3200,6000].forEach(delay=>setTimeout(()=>schedule(0),delay));
    installReportGuard();
  }

  window.BogatkaLaunchGateV454={version:VERSION,ready:true,gateState,renderCard,renderAll,installSaveGuard,installReportGuard,transformReport,activate,openDealChecks,audit,get pendingWrites(){return saveQueues.size},get lastError(){return lastError;}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();