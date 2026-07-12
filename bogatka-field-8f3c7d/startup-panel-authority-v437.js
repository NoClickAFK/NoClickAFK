(function(){
  'use strict';
  if(window.BogatkaPanelAuthorityV437?.ready)return;

  const VERSION='4.3.7';
  const COPY={
    inspection:{title:'Параметры осмотра',subtitle:'Статус, формат, состояние помещения и следующий шаг.'},
    landlord:{title:'Арендодатель и условия',subtitle:'Контакты и предварительные условия аренды.'},
  };
  const LAYOUT_FIELDS={
    inspection:['inspectionPurpose','inspectionResult'],
    landlord:['objectSource','listingUrl','objectSourceOther','inspectionParticipants'],
  };
  const REQUIRED_SCRIPTS=[
    ['./location-profile-v416.js',()=>window.BogatkaLocationProfileV416?.ready===true],
    ['./location-overview-v417.js',()=>window.BogatkaLocationOverviewV417?.ready===true],
    ['./location-overview-init-v417.js',()=>window.BogatkaLocationOverviewInitV417?.ready===true||window.BogatkaLocationOverviewV417?.ready===true],
    ['./location-panels-v419.js',()=>window.BogatkaLocationPanelsV419?.ready===true],
    ['./location-panels-render-v419.js',()=>window.BogatkaLocationPanelsRenderV419?.ready===true||window.BogatkaLocationPanelsV419?.ready===true],
    ['./inspection-layout-v461.js',()=>window.BogatkaInspectionLayoutV461?.ready===true],
  ];
  const diagnostics={
    authorityInstallations:1,panelConversions:0,subtitleWrites:0,blockedNoncanonicalWrites:0,
    observerCallbacks:0,ignoredSelfMutations:0,duplicateConversionAttempts:0,localPrepareCalls:0,
    renderWrappers:0,cloudBackgroundStarts:0,cloudBackgroundCompletions:0,cloudBackgroundErrors:0,
    noncanonicalWriteLog:[],
  };
  const panelStates=new Map();
  const nodeText=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');
  let preparing=null;
  let observer=null;
  let scheduled=false;
  let selfMutationUntil=0;
  let cloudStarted=false;
  let basePrepare=null;

  const wait=(predicate,timeoutMs=9000,label='startup dependency')=>new Promise((resolve,reject)=>{
    const started=performance.now();
    const tick=()=>{
      let value=false;
      try{value=predicate()}catch(_){value=false}
      if(value)return resolve(value);
      if(performance.now()-started>=timeoutMs)return reject(new Error(`Не дождались готовности: ${label}`));
      setTimeout(tick,25);
    };
    tick();
  });

  function markSelfMutation(){
    selfMutationUntil=Math.max(selfMutationUntil,performance.now()+32);
  }

  function scriptMatches(script,src){
    try{return new URL(script.src||script.getAttribute('src')||'',location.href).pathname===new URL(src,location.href).pathname}
    catch(_){return script.getAttribute('src')===src}
  }

  function matchingScripts(src){
    return [...document.scripts].filter(script=>scriptMatches(script,src));
  }

  function loadScriptOnce(src,attempt=0){
    const ready=REQUIRED_SCRIPTS.find(([candidate])=>candidate===src)?.[1];
    if(ready?.())return Promise.resolve();
    const existing=matchingScripts(src).find(script=>script.dataset.panelAuthorityLoadFailedV437!=='1');
    if(existing&&attempt===0)return wait(()=>ready?.(),5000,src);
    if(attempt>0)matchingScripts(src).forEach(script=>script.remove());
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=attempt?`${src}?panel-authority-retry-v437=${attempt}`:src;
      script.async=false;
      script.dataset.panelAuthorityV437='1';
      script.onload=()=>wait(()=>ready?.(),5000,src).then(resolve,reject);
      script.onerror=()=>{
        script.dataset.panelAuthorityLoadFailedV437='1';
        script.remove();
        reject(new Error(`Не удалось загрузить ${src}`));
      };
      document.head.appendChild(script);
    });
  }

  async function ensureScript(src){
    let lastError=null;
    for(let attempt=0;attempt<2;attempt++){
      try{await loadScriptOnce(src,attempt);return}
      catch(error){lastError=error}
    }
    throw lastError||new Error(`Не удалось подготовить ${src}`);
  }

  function isVisible(node){
    if(!node||node.hidden)return false;
    const style=getComputedStyle(node);
    return style.display!=='none'&&style.visibility!=='hidden';
  }

  const panelKey=(id,kind)=>`${id}:${kind}`;
  const storageKey=(id,kind)=>`bogatka.panel.${kind}.open.${id}`;

  function writeNodeText(node,value){
    if(!node||nodeText?.get?.call(node)===value)return;
    markSelfMutation();
    nodeText?.set?.call(node,value);
    diagnostics.subtitleWrites+=1;
  }

  function lockAuthorityText(node,expected,kind,part){
    if(!node)return;
    const existing=node.__panelAuthorityTextLockV437;
    if(existing){existing.expected=expected;return}
    const lock={expected,kind,part};
    try{
      Object.defineProperty(node,'textContent',{
        configurable:true,
        get(){return nodeText?.get?.call(this)||''},
        set(value){
          const next=String(value??'');
          if(next!==lock.expected){
            diagnostics.blockedNoncanonicalWrites+=1;
            if(diagnostics.noncanonicalWriteLog.length<40){
              diagnostics.noncanonicalWriteLog.push({kind:lock.kind,part:lock.part,text:next,at:Math.round(performance.now())});
            }
            return;
          }
          if(nodeText?.get?.call(this)!==lock.expected){
            markSelfMutation();
            nodeText?.set?.call(this,lock.expected);
          }
        },
      });
      node.__panelAuthorityTextLockV437=lock;
    }catch(error){console.warn('Не удалось закрепить текст заголовка панели.',error)}
  }

  function resolvePanelOpen(section,kind,id){
    const key=panelKey(id,kind);
    const explicit=section.dataset.panelOpenV419;
    const alreadyOwned=section.dataset.panelAuthorityV437===kind;
    if(alreadyOwned&&explicit!==undefined){
      const current=explicit!=='0';
      panelStates.set(key,current);
      return current;
    }
    if(panelStates.has(key))return panelStates.get(key);
    if(explicit!==undefined){
      const current=explicit!=='0';
      panelStates.set(key,current);
      return current;
    }
    let saved='1';
    try{saved=localStorage.getItem(storageKey(id,kind))||'1'}catch(_){ }
    const current=saved!=='0';
    panelStates.set(key,current);
    return current;
  }

  function setPanelOpen(section,kind,id,open,options={}){
    if(!section||!id||!COPY[kind])return false;
    const next=Boolean(open);
    const value=next?'1':'0';
    panelStates.set(panelKey(id,kind),next);
    const head=section.querySelector(':scope > .panel-toggle-v419');
    const chevron=head?.querySelector('.panel-chevron-v419');
    const chevronText=next?'⌃':'⌄';
    const changed=section.dataset.panelOpenV419!==value||
      section.classList.contains('panel-closed-v419')===next||
      head?.getAttribute('aria-expanded')!==String(next)||
      Boolean(chevron&&nodeText?.get?.call(chevron)!==chevronText);
    if(changed)markSelfMutation();
    if(section.dataset.panelOpenV419!==value)section.dataset.panelOpenV419=value;
    if(section.classList.contains('panel-closed-v419')===next)section.classList.toggle('panel-closed-v419',!next);
    if(head?.getAttribute('aria-expanded')!==String(next))head?.setAttribute('aria-expanded',String(next));
    if(chevron&&nodeText?.get?.call(chevron)!==chevronText)nodeText?.set?.call(chevron,chevronText);
    if(options.persist){
      try{localStorage.setItem(storageKey(id,kind),value)}catch(_){ }
    }
    return true;
  }

  function rememberCurrentPanelStates(){
    for(const card of document.querySelectorAll('[data-location-card]')){
      const id=card.dataset.locationCard;
      if(!id)continue;
      for(const [kind,selector] of [['inspection','.inspection-card-v416'],['landlord','.landlord-card-v416']]){
        const section=card.querySelector(selector);
        if(section?.dataset.panelOpenV419!==undefined){
          panelStates.set(panelKey(id,kind),section.dataset.panelOpenV419!=='0');
        }
      }
    }
  }

  function fieldInGrid(card,field,gridSelector){
    const control=[...card.querySelectorAll(`[data-field="${field}"]`)]
      .find(item=>!item.hasAttribute('data-stage6-marker-v461'));
    const wrapper=control?.closest('label.field');
    const grid=card.querySelector(gridSelector);
    return Boolean(control&&wrapper&&grid?.contains(wrapper));
  }

  function layoutReadyForCard(card){
    if(window.BogatkaInspectionLayoutV461?.ready!==true)return false;
    if(card.dataset.inspectionLayoutV462!=='1')return false;
    return LAYOUT_FIELDS.inspection.every(field=>fieldInGrid(card,field,'.inspection-grid-v416'))&&
      LAYOUT_FIELDS.landlord.every(field=>fieldInGrid(card,field,'.landlord-grid-v416'));
  }

  function layoutReadyAll(){
    const cards=[...document.querySelectorAll('[data-location-card]')];
    return cards.length>0&&cards.every(layoutReadyForCard);
  }

  function canonicalizePanel(section,kind,id){
    if(!section||!id)return false;
    const expected=COPY[kind];
    const grid=section.querySelector(kind==='inspection'?'.inspection-grid-v416':'.landlord-grid-v416');
    const head=section.querySelector(':scope > .panel-toggle-v419');
    if(!grid||!head){diagnostics.duplicateConversionAttempts+=1;return false}
    const firstClaim=section.dataset.panelAuthorityV437!==kind;
    const open=resolvePanelOpen(section,kind,id);
    const old=section.querySelector(':scope > .profile-section-head-v416');
    markSelfMutation();
    old?.remove();
    section.dataset.panelAuthorityV437=kind;
    section.classList.add('panel-authority-v437');
    section.closest('.location-overview-v416')?.classList.add('location-panels-v419');
    const title=head.querySelector('.panel-title-v419');
    const subtitle=head.querySelector('.panel-copy-v419');
    writeNodeText(title,expected.title);
    writeNodeText(subtitle,expected.subtitle);
    lockAuthorityText(title,expected.title,kind,'title');
    lockAuthorityText(subtitle,expected.subtitle,kind,'subtitle');
    setPanelOpen(section,kind,id,open);
    if(firstClaim)diagnostics.panelConversions+=1;
    return true;
  }

  function canonicalizeAll(){
    let complete=true;
    for(const card of document.querySelectorAll('[data-location-card]')){
      const id=card.dataset.locationCard;
      const overview=card.querySelector('.location-overview-v416');
      if(!id||!overview){complete=false;continue}
      const inspection=canonicalizePanel(overview.querySelector('.inspection-card-v416'),'inspection',id);
      const landlord=canonicalizePanel(overview.querySelector('.landlord-card-v416'),'landlord',id);
      const layout=layoutReadyForCard(card);
      overview.classList.toggle('panel-authority-ready-v437',inspection&&landlord&&layout);
      complete=complete&&inspection&&landlord&&layout;
    }
    return complete;
  }

  function stabilizePanels(){
    try{window.BogatkaInspectionLayoutV461?.enhanceAll?.()}catch(error){console.error(error)}
    canonicalizeAll();
  }

  function scheduleCanonicalize(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;stabilizePanels()});
  }

  function installObserver(){
    if(observer)return;
    const root=document.getElementById('locations')||document.body;
    observer=new MutationObserver(records=>{
      diagnostics.observerCallbacks+=1;
      for(const record of records){
        if(record.type==='attributes'&&record.attributeName==='data-panel-open-v419'){
          const section=record.target;
          const card=section.closest?.('[data-location-card]');
          const kind=section.dataset.panelAuthorityV437;
          if(card?.dataset.locationCard&&COPY[kind]&&section.dataset.panelOpenV419!==undefined){
            panelStates.set(panelKey(card.dataset.locationCard,kind),section.dataset.panelOpenV419!=='0');
          }
        }
      }
      const structural=records.some(record=>record.type==='childList'&&(record.addedNodes.length||record.removedNodes.length));
      if(!structural&&performance.now()<=selfMutationUntil){diagnostics.ignoredSelfMutations+=1;return}
      scheduleCanonicalize();
    });
    observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-panel-open-v419','aria-expanded','hidden']});
  }

  function chainHas(fn,marker){
    const seen=new Set();
    let current=fn;
    while(typeof current==='function'&&!seen.has(current)){
      if(current[marker])return true;
      seen.add(current);
      current=current.__base;
    }
    return false;
  }

  function wrapPanelEnhancer(){
    const api=window.BogatkaLocationPanelsV419;
    const current=api?.enhanceAll;
    if(typeof current!=='function'||current.__panelAuthorityV437)return;
    const wrapped=async function(...args){
      const result=await current.apply(this,args);
      stabilizePanels();
      return result;
    };
    wrapped.__panelAuthorityV437=true;
    wrapped.__base=current;
    api.enhanceAll=wrapped;
  }

  function wrapRenderLocations(){
    const current=window.renderLocations||((typeof renderLocations==='function')?renderLocations:null);
    if(typeof current!=='function')return false;
    if(chainHas(current,'__panelAuthorityRenderV437'))return true;
    const wrapped=function(...args){
      rememberCurrentPanelStates();
      const result=current.apply(this,args);
      const finish=()=>stabilizePanels();
      if(result?.then)return Promise.resolve(result).finally(finish);
      finish();
      return result;
    };
    Object.assign(wrapped,current);
    wrapped.__panelAuthorityRenderV437=true;
    wrapped.__base=current;
    window.renderLocations=wrapped;
    try{renderLocations=wrapped}catch(_){ }
    diagnostics.renderWrappers+=1;
    return true;
  }

  async function prepareLocalUi(){
    diagnostics.localPrepareCalls+=1;
    if(preparing)return preparing;
    preparing=(async()=>{
      await wait(()=>document.querySelector('[data-location-card]'),9000,'local location cards');
      for(const [src] of REQUIRED_SCRIPTS)await ensureScript(src);
      await window.BogatkaLocationProfileV416?.enhanceAll?.({force:true});
      await window.BogatkaLocationOverviewV417?.enhanceAll?.({force:true});
      await window.BogatkaLocationPanelsV419?.enhanceAll?.({force:true});
      window.BogatkaInspectionLayoutV461?.enhanceAll?.();
      wrapPanelEnhancer();
      wrapRenderLocations();
      installObserver();
      await wait(()=>{stabilizePanels();return layoutReadyAll()&&canonicalizeAll()},9000,'inspection layout and terminal panel authority');
      document.documentElement.classList.remove('panel-authority-failed-v437');
      document.documentElement.classList.add('panel-authority-ready-v437');
      window.dispatchEvent(new CustomEvent('bogatka:panel-authority-ready',{detail:{version:VERSION,diagnostics:{...diagnostics}}}));
      return{status:'ready',version:VERSION};
    })().catch(error=>{
      document.documentElement.classList.add('panel-authority-failed-v437');
      console.error('Terminal panel authority did not become ready.',error);
      return{status:'fallback',error};
    });
    return preparing;
  }

  function startCloudBackground(){
    if(cloudStarted||typeof basePrepare!=='function')return;
    cloudStarted=true;
    diagnostics.cloudBackgroundStarts+=1;
    setTimeout(()=>{
      Promise.resolve(basePrepare()).then(result=>{
        diagnostics.cloudBackgroundCompletions+=1;
        window.dispatchEvent(new CustomEvent('bogatka:cloud-background-ready',{detail:{version:VERSION,result}}));
      }).catch(error=>{
        diagnostics.cloudBackgroundErrors+=1;
        console.error('Background cloud startup failed.',error);
      });
    },0);
  }

  function installStartupSplit(){
    const startup=window.BogatkaStartup;
    if(!startup||startup.prepareCriticalUi?.__localFirstV437)return false;
    basePrepare=startup.prepareCriticalUi?.bind(startup);
    const localFirst=async function(){
      const local=await prepareLocalUi();
      startCloudBackground();
      window.dispatchEvent(new CustomEvent('bogatka:local-ui-ready',{detail:{version:VERSION,local}}));
      return{status:'local-ready',local,cloud:'background'};
    };
    localFirst.__localFirstV437=true;
    localFirst.__base=basePrepare;
    startup.prepareCriticalUi=localFirst;
    startup.prepareLocalUi=prepareLocalUi;
    startup.startCloudBackground=startCloudBackground;
    startup.version=VERSION;
    return true;
  }

  window.BogatkaPanelAuthorityV437={
    version:VERSION,ready:true,ownsPanelHeaders:true,copy:COPY,
    prepareLocalUi,canonicalizeAll,canonicalizePanel,layoutReadyForCard,layoutReadyAll,setPanelOpen,installStartupSplit,
    get diagnostics(){return{...diagnostics,noncanonicalWriteLog:[...diagnostics.noncanonicalWriteLog]}},
    audit(){
      const failures=[];
      for(const card of document.querySelectorAll('[data-location-card]')){
        const id=card.dataset.locationCard;
        if(!layoutReadyForCard(card))failures.push(`${id}:inspection-layout-not-ready`);
        for(const [kind,selector] of [['inspection','.inspection-card-v416'],['landlord','.landlord-card-v416']]){
          const section=card.querySelector(selector);
          const expected=COPY[kind];
          const heads=[...section?.querySelectorAll(':scope > .panel-toggle-v419')||[]].filter(isVisible);
          if(heads.length!==1)failures.push(`${id}:${kind}:visible-heads:${heads.length}`);
          if(section?.querySelector('.panel-title-v419')?.textContent!==expected.title)failures.push(`${id}:${kind}:title`);
          if(section?.querySelector('.panel-copy-v419')?.textContent!==expected.subtitle)failures.push(`${id}:${kind}:subtitle`);
          if(!section?.classList.contains('panel-authority-v437'))failures.push(`${id}:${kind}:authority-class`);
          if(section?.querySelector(':scope > .profile-section-head-v416')&&isVisible(section.querySelector(':scope > .profile-section-head-v416'))){
            failures.push(`${id}:${kind}:legacy-head-visible`);
          }
        }
      }
      return{ok:failures.length===0,failures,diagnostics:{...diagnostics,noncanonicalWriteLog:[...diagnostics.noncanonicalWriteLog]}};
    },
  };

  if(!installStartupSplit()){
    let attempts=0;
    const retry=()=>{attempts+=1;if(installStartupSplit())return;if(attempts<200)setTimeout(retry,25)};
    retry();
  }
  const rewrap=()=>{wrapRenderLocations();wrapPanelEnhancer()};
  [100,400,1000,2500,5000].forEach(delay=>setTimeout(rewrap,delay));
})();
