(function(){
  if(window.BogatkaPanelAuthorityV437?.ready)return;

  const VERSION='4.3.7';
  const REQUIRED_SCRIPTS=[
    ['./location-profile-v416.js',()=>window.BogatkaLocationProfileV416?.ready],
    ['./location-overview-v417.js',()=>window.BogatkaLocationOverviewV417?.ready],
    ['./location-overview-init-v417.js',()=>window.BogatkaLocationOverviewInitV417?.ready||window.BogatkaLocationOverviewV417?.ready],
    ['./location-panels-v419.js',()=>window.BogatkaLocationPanelsV419?.ready],
    ['./location-panels-render-v419.js',()=>window.BogatkaLocationPanelsRenderV419?.ready||window.BogatkaLocationPanelsV419?.ready],
    ['./inspection-layout-v461.js',()=>window.BogatkaInspectionLayoutV461?.ready||document.querySelector('.inspection-layout-v461')||true],
  ];
  const COPY={
    inspection:{title:'Параметры осмотра',subtitle:'Статус, формат, состояние помещения и следующий шаг.'},
    landlord:{title:'Арендодатель и условия',subtitle:'Контакты и предварительные условия аренды.'},
  };
  const diagnostics={authorityInstallations:1,panelConversions:0,subtitleWrites:0,observerCallbacks:0,ignoredSelfMutations:0,duplicateConversionAttempts:0,localPrepareCalls:0,cloudBackgroundStarts:0,cloudBackgroundCompletions:0,cloudBackgroundErrors:0};
  let preparing=null;
  let observer=null;
  let scheduled=false;
  let selfMutation=false;
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

  function scriptMatches(script,src){
    try{return new URL(script.src||script.getAttribute('src')||'',location.href).pathname===new URL(src,location.href).pathname}catch(_){return script.getAttribute('src')===src}
  }

  function loadScript(src){
    const ready=REQUIRED_SCRIPTS.find(([candidate])=>candidate===src)?.[1];
    if(ready?.())return Promise.resolve();
    const existing=[...document.scripts].find(script=>scriptMatches(script,src));
    if(existing&&!existing.dataset.panelAuthorityLoadFailedV437)return wait(()=>ready?.(),9000,src);
    if(existing)existing.remove();
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=src;
      script.async=false;
      script.dataset.panelAuthorityV437='1';
      script.onload=()=>wait(()=>ready?.(),9000,src).then(resolve,reject);
      script.onerror=()=>{script.dataset.panelAuthorityLoadFailedV437='1';script.remove();reject(new Error(`Не удалось загрузить ${src}`))};
      document.head.appendChild(script);
    });
  }

  function isVisible(node){
    if(!node||node.hidden)return false;
    const style=getComputedStyle(node);
    return style.display!=='none'&&style.visibility!=='hidden';
  }

  function canonicalizePanel(section,kind,id){
    if(!section)return false;
    const expected=COPY[kind];
    const grid=section.querySelector(kind==='inspection'?'.inspection-grid-v416':'.landlord-grid-v416');
    if(!grid)return false;
    const key=`bogatka.panel.${kind}.open.${id}`;
    let head=section.querySelector(':scope > .panel-toggle-v419');
    if(!head){diagnostics.duplicateConversionAttempts+=1;return false}
    const old=section.querySelector(':scope > .profile-section-head-v416');
    selfMutation=true;
    try{
      if(old)old.remove();
      section.dataset.panelAuthorityV437=kind;
      section.classList.add('panel-authority-v437');
      section.closest('.location-overview-v416')?.classList.add('panel-authority-ready-v437','location-panels-v419');
      const title=head.querySelector('.panel-title-v419');
      const subtitle=head.querySelector('.panel-copy-v419');
      if(title&&title.textContent!==expected.title){title.textContent=expected.title;diagnostics.subtitleWrites+=1}
      if(subtitle&&subtitle.textContent!==expected.subtitle){subtitle.textContent=expected.subtitle;diagnostics.subtitleWrites+=1}
      if(section.dataset.panelOpenV419===undefined){
        let saved='1';try{saved=localStorage.getItem(key)||'1'}catch(_){ }
        section.dataset.panelOpenV419=saved==='0'?'0':'1';
      }
      const open=section.dataset.panelOpenV419!=='0';
      section.classList.toggle('panel-closed-v419',!open);
      head.setAttribute('aria-expanded',String(open));
      const chevron=head.querySelector('.panel-chevron-v419');
      if(chevron&&chevron.textContent!==(open?'⌃':'⌄'))chevron.textContent=open?'⌃':'⌄';
      diagnostics.panelConversions+=1;
    }finally{queueMicrotask(()=>{selfMutation=false})}
    return true;
  }

  function canonicalizeAll(){
    let complete=true;
    for(const card of document.querySelectorAll('[data-location-card]')){
      const id=card.dataset.locationCard;
      const overview=card.querySelector('.location-overview-v416');
      if(!overview){complete=false;continue}
      const inspection=overview.querySelector('.inspection-card-v416');
      const landlord=overview.querySelector('.landlord-card-v416');
      const okInspection=canonicalizePanel(inspection,'inspection',id);
      const okLandlord=canonicalizePanel(landlord,'landlord',id);
      complete=complete&&okInspection&&okLandlord;
    }
    return complete;
  }

  function scheduleCanonicalize(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;canonicalizeAll()});
  }

  function installObserver(){
    if(observer)return;
    const root=document.getElementById('locations')||document.body;
    observer=new MutationObserver(()=>{
      diagnostics.observerCallbacks+=1;
      if(selfMutation){diagnostics.ignoredSelfMutations+=1;return}
      scheduleCanonicalize();
    });
    observer.observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','data-panel-open-v419','aria-expanded']});
  }

  function wrapPanelEnhancer(){
    const api=window.BogatkaLocationPanelsV419;
    const current=api?.enhanceAll;
    if(typeof current!=='function'||current.__panelAuthorityV437)return;
    const wrapped=async function(...args){
      const result=await current.apply(this,args);
      canonicalizeAll();
      return result;
    };
    wrapped.__panelAuthorityV437=true;
    wrapped.__base=current;
    api.enhanceAll=wrapped;
  }

  async function prepareLocalUi(){
    diagnostics.localPrepareCalls+=1;
    if(preparing)return preparing;
    preparing=(async()=>{
      await wait(()=>document.querySelector('[data-location-card]'),9000,'local location cards');
      for(const [src] of REQUIRED_SCRIPTS){
        try{await loadScript(src)}catch(error){console.warn(error)}
      }
      await window.BogatkaLocationProfileV416?.enhanceAll?.({force:true});
      await window.BogatkaLocationOverviewV417?.enhanceAll?.({force:true});
      await window.BogatkaLocationPanelsV419?.enhanceAll?.({force:true});
      wrapPanelEnhancer();
      installObserver();
      await wait(()=>canonicalizeAll(),9000,'terminal panel authority');
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

  const api=window.BogatkaPanelAuthorityV437={
    version:VERSION,
    ready:true,
    prepareLocalUi,
    canonicalizeAll,
    installStartupSplit,
    get diagnostics(){return{...diagnostics}},
    audit(){
      const failures=[];
      for(const card of document.querySelectorAll('[data-location-card]')){
        const id=card.dataset.locationCard;
        for(const [kind,selector] of [['inspection','.inspection-card-v416'],['landlord','.landlord-card-v416']]){
          const section=card.querySelector(selector);
          const expected=COPY[kind];
          const heads=[...section?.querySelectorAll(':scope > .panel-toggle-v419')||[]].filter(isVisible);
          if(heads.length!==1)failures.push(`${id}:${kind}:visible-heads:${heads.length}`);
          if(section?.querySelector('.panel-title-v419')?.textContent!==expected.title)failures.push(`${id}:${kind}:title`);
          if(section?.querySelector('.panel-copy-v419')?.textContent!==expected.subtitle)failures.push(`${id}:${kind}:subtitle`);
          if(section?.querySelector(':scope > .profile-section-head-v416')&&isVisible(section.querySelector(':scope > .profile-section-head-v416')))failures.push(`${id}:${kind}:legacy-head-visible`);
        }
      }
      return{ok:failures.length===0,failures,diagnostics:{...diagnostics}};
    },
  };

  if(!installStartupSplit()){
    let attempts=0;
    const retry=()=>{attempts+=1;if(installStartupSplit())return;if(attempts<200)setTimeout(retry,25)};
    retry();
  }
})();