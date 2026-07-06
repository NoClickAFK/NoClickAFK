(function(){
  'use strict';
  if(window.BogatkaCardProgressInitV448?.ready)return;

  const VERSION='4.4.8';
  const TARGETS={
    inspection:{title:'Параметры осмотра',selector:'.inspection-card-v416',kind:'panel'},
    landlord:{title:'Арендодатель и условия',selector:'.landlord-card-v416',kind:'panel'},
    scores:{title:'Оценка локации',selector:'select[data-field^="score."]',closest:'details',kind:'details'},
    technical:{title:'Технические и финансовые параметры',selector:'[data-field^="tech."]',closest:'details',kind:'details'},
    photos:{title:'Фотографии по категориям',selector:'.photo-input,[data-photos]',closest:'details',kind:'details'},
    checks:{title:'Проверки перед арендой',selector:'[data-critical-deal]',closest:'details',kind:'details'},
    conclusion:{title:'Предварительное решение по локации',selector:'.decision-reason-section-v412,.decision-panel-v412,.decision',kind:'details'},
  };
  const EXPLANATION='Оценки ставятся ниже в разделе «Оценка локации». Качество показывает средний результат по заполненным критериям, а надёжность — сколько из 14 критериев уже оценено. Пустые критерии не снижают качество, но уменьшают надёжность';
  let skippedBootstrapRefresh=false;
  let attempts=0;
  let navigationBound=false;
  let enhancementRunning=false;
  let enhancementPending=false;
  let enhancementNeedsRender=false;
  let enhancementPromise=Promise.resolve();
  let enhancementPasses=0;
  let saveWrapperAttempts=0;
  let summaryWrapperAttempts=0;

  const filled=value=>String(value??'').trim()!=='';
  const chainHas=(fn,marker)=>{
    const seen=new Set();
    for(let current=fn;typeof current==='function'&&!seen.has(current);current=current.__base){
      seen.add(current);
      if(current[marker])return true;
    }
    return false;
  };

  function installBootstrapGate(){
    if(window.__bogatkaCardProgressBootstrapGateV448)return true;
    if(typeof window.updateSummary!=='function'&&typeof updateSummary!=='function')return false;
    const base=window.updateSummary||updateSummary;
    const gated=async function(...args){
      if(!skippedBootstrapRefresh){
        skippedBootstrapRefresh=true;
        return null;
      }
      return base(...args);
    };
    gated.__cardProgressBootstrapGateV448=true;
    gated.__base=base;
    window.__bogatkaCardProgressBootstrapGateV448=true;
    window.updateSummary=gated;
    try{updateSummary=gated}catch(_){ }
    return true;
  }

  function normalizeDecisionReasonProgress(metric){
    const groups=metric?.progressGroups;
    const data=metric?.data||{};
    const conclusion=Array.isArray(groups)?groups.find(group=>group.key==='conclusion'):null;
    if(!conclusion)return;
    const items=[
      ['главные плюсы',data.pros],
      ['главные минусы',data.cons],
      ['риски',data.risks],
      ['вопросы арендодателю',data.questions],
      ['предварительное решение',data.decision],
    ];
    if(filled(data.decision))items.push(['причина решения',data.decisionReason]);
    conclusion.total=items.length;
    conclusion.done=items.filter(([,value])=>filled(value)).length;
    conclusion.missingLabels=items.filter(([,value])=>!filled(value)).map(([label])=>label);
    conclusion.missingCount=conclusion.total-conclusion.done;
    conclusion.ratio=conclusion.total?conclusion.done/conclusion.total:1;
    conclusion.percent=Math.round(conclusion.ratio*100);
    conclusion.detail=conclusion.missingCount?`Не хватает: ${conclusion.missingLabels.slice(0,3).join(', ')}${conclusion.missingLabels.length>3?` и ещё ${conclusion.missingLabels.length-3}`:''}.`:'Выводы и решение заполнены.';
    const percent=Math.round(groups.reduce((sum,group)=>sum+Number(group.weight||0)*Number(group.ratio||0),0));
    metric.completion=percent;
    metric.completedProgressGroups=groups.filter(group=>group.missingCount===0).length;
    metric.totalProgressGroups=groups.length;
    metric.sections={...(metric.sections||{}),conclusion:conclusion.ratio};
    metric.missing=groups.filter(group=>group.missingCount>0).map(group=>{
      if(group.key==='scores')return `${group.missingCount} оценок из ${group.total}`;
      if(group.key==='photos')return `${group.missingCount} обязательных фото`;
      if(group.key==='checks')return `${group.missingCount} проверок перед арендой`;
      return `${String(group.title||'раздел').toLowerCase()}: ${group.missingLabels.slice(0,3).join(', ')}${group.missingLabels.length>3?` и ещё ${group.missingLabels.length-3}`:''}`;
    });
    const api=window.BogatkaCardProgressV448;
    if(typeof api?.recommendation==='function'&&typeof api?.scoreAnalysis==='function'){
      const analysis=api.scoreAnalysis(data,window.BogatkaDecisionEngine?.WEIGHTS||{});
      metric.recommendation=api.recommendation(metric,analysis,{percent,groups});
    }
  }

  function normalizeGroups(metrics=[]){
    for(const metric of metrics){
      normalizeDecisionReasonProgress(metric);
      for(const group of metric?.progressGroups||[]){
        const target=TARGETS[group.key];
        if(!target)continue;
        group.title=target.title;
        group.target=group.key;
      }
    }
    return metrics;
  }

  function resolveTarget(card,key){
    const definition=TARGETS[key];
    if(!card||!definition)return null;
    let node=card.querySelector(definition.selector);
    if(node&&definition.closest)node=node.closest(definition.closest)||node;
    if(node)node.dataset.progressTargetSectionV448=key;
    return node;
  }

  function ensureOpen(node,definition){
    if(!node||!definition)return;
    if(definition.kind==='panel'){
      const toggle=node.querySelector(':scope > .panel-toggle-v419');
      const closed=node.dataset.panelOpenV419==='0'||toggle?.getAttribute('aria-expanded')==='false';
      if(closed)toggle?.click();
    }else if(definition.kind==='details'&&node.tagName==='DETAILS'&&!node.open){
      node.open=true;
      node.setAttribute('open','');
    }
  }

  function openTarget(card,key){
    const definition=TARGETS[key];
    const node=resolveTarget(card,key);
    if(!definition||!node)return false;
    if(key==='conclusion')window.BogatkaDecisionPanel?.openReason?.(card);
    ensureOpen(node,definition);
    node.style.scrollMarginTop='72px';
    node.scrollIntoView({behavior:'auto',block:'start'});
    node.classList.add('progress-target-flash-v448');
    setTimeout(()=>node.classList.remove('progress-target-flash-v448'),1300);
    return true;
  }

  function refineCard(card){
    const score=resolveTarget(card,'scores');
    const scoreSummary=score?.querySelector(':scope > summary');
    if(scoreSummary&&scoreSummary.textContent!=='Оценка локации')scoreSummary.textContent='Оценка локации';
    resolveTarget(card,'conclusion');

    const explanation=card.querySelector('.score-explanation-v448 span');
    if(explanation&&explanation.textContent!==EXPLANATION)explanation.textContent=EXPLANATION;

    for(const button of card.querySelectorAll('[data-progress-target-v448]')){
      const key=button.dataset.progressTargetV448;
      const definition=TARGETS[key];
      const item=button.closest('.fill-plan-item-v448');
      const copy=item?.querySelector('.fill-plan-copy-v448');
      copy?.querySelector(':scope > span')?.remove();
      const title=copy?.querySelector(':scope > strong');
      if(title&&definition&&title.textContent!==definition.title)title.textContent=definition.title;
    }
  }

  function refineAll(){
    for(const card of document.querySelectorAll('[data-location-card]'))refineCard(card);
  }

  function bindNavigation(){
    if(navigationBound)return;
    const root=document.getElementById('locations');
    if(!root)return;
    root.addEventListener('click',event=>{
      const button=event.target.closest('[data-progress-target-v448]');
      if(!button||!root.contains(button))return;
      const card=button.closest('[data-location-card]');
      if(!card)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openTarget(card,button.dataset.progressTargetV448);
    },true);
    navigationBound=true;
  }

  function installRuntimePatches(){
    const api=window.BogatkaCardProgressV448;
    if(!api?.ready)return false;
    if(typeof api.transformMetrics==='function'&&!api.transformMetrics.__navigationHotfixV448){
      const base=api.transformMetrics.bind(api);
      const wrapped=function(metrics){return normalizeGroups(base(metrics))};
      wrapped.__navigationHotfixV448=true;
      wrapped.__base=base;
      api.transformMetrics=wrapped;
    }
    if(typeof api.renderAll==='function'&&!api.renderAll.__navigationHotfixV448){
      const base=api.renderAll.bind(api);
      const wrapped=async function(...args){
        normalizeGroups(window.BogatkaDecisionUI?.lastMetrics||[]);
        const result=await base(...args);
        refineAll();
        return result;
      };
      wrapped.__navigationHotfixV448=true;
      wrapped.__base=base;
      api.renderAll=wrapped;
    }
    api.TARGETS=TARGETS;
    api.openCanonicalTarget=openTarget;
    bindNavigation();
    return true;
  }

  async function enhanceCard(card){
    if(!card?.dataset?.locationCard)return false;
    await window.BogatkaLocationDataV452?.enhanceCard?.(card);
    window.BogatkaInspectionLayoutV461?.placeCard?.(card);
    await window.BogatkaDecisionPanel?.enhanceCard?.(card);
    window.BogatkaUIRefineV462?.ensureProgressAccordion?.(card);
    window.BogatkaLocationCardCollapseV422?.enhanceCard?.(card);
    refineCard(card);
    return true;
  }

  async function runEnhancementPass({renderProgress=false}={}){
    enhancementPasses+=1;
    installRuntimePatches();
    installCanonicalSummaryWrapper();
    installSaveLocationWrapper();
    await window.BogatkaLocationDataV452?.enhanceAll?.();
    window.BogatkaInspectionLayoutV461?.enhanceAll?.();
    await window.BogatkaDecisionPanel?.enhanceAll?.();
    await window.BogatkaStatusNextTaskV447?.enhanceAll?.();
    const cards=[...document.querySelectorAll('[data-location-card]')];
    const missingProgress=cards.some(card=>!card.querySelector('.decision-progress-v448'));
    if(renderProgress||missingProgress){
      normalizeGroups(window.BogatkaDecisionUI?.lastMetrics||[]);
      await window.BogatkaCardProgressV448?.renderAll?.();
    }
    for(const card of cards)await enhanceCard(card);
    return cards.length;
  }

  function requestEnhancement({renderProgress=false}={}){
    enhancementPending=true;
    enhancementNeedsRender=enhancementNeedsRender||renderProgress;
    if(enhancementRunning)return enhancementPromise;
    enhancementPromise=(async()=>{
      enhancementRunning=true;
      try{
        const firstRender=enhancementNeedsRender;
        enhancementPending=false;
        enhancementNeedsRender=false;
        await runEnhancementPass({renderProgress:firstRender});
        if(enhancementPending){
          const followRender=enhancementNeedsRender;
          enhancementPending=false;
          enhancementNeedsRender=false;
          await runEnhancementPass({renderProgress:followRender});
        }
      }finally{
        enhancementRunning=false;
        if(enhancementPending)queueMicrotask(()=>requestEnhancement({renderProgress:enhancementNeedsRender}));
      }
    })();
    return enhancementPromise;
  }

  async function enhanceLocation(id,{renderProgress=false}={}){
    await requestEnhancement({renderProgress});
    const card=document.querySelector(`[data-location-card="${CSS.escape(id)}"]`);
    if(card)await enhanceCard(card);
    return card;
  }

  function installCanonicalSummaryWrapper(){
    summaryWrapperAttempts+=1;
    if(typeof window.updateSummary!=='function'&&typeof updateSummary!=='function')return false;
    const current=window.updateSummary||updateSummary;
    if(chainHas(current,'__canonicalCardEnhancerV448'))return true;
    const wrapped=async function(...args){
      const result=await current(...args);
      await requestEnhancement({renderProgress:false});
      return result;
    };
    wrapped.__canonicalCardEnhancerV448=true;
    wrapped.__base=current;
    window.updateSummary=wrapped;
    try{updateSummary=wrapped}catch(_){ }
    return true;
  }

  function installSaveLocationWrapper(){
    saveWrapperAttempts+=1;
    if(typeof window.saveLocationFromModal!=='function'&&typeof saveLocationFromModal!=='function')return false;
    const current=window.saveLocationFromModal||saveLocationFromModal;
    if(chainHas(current,'__canonicalCardSaveV448'))return true;
    const wrapped=async function(...args){
      const before=new Set((window.locations||[]).map(item=>item.id));
      const originalScroll=Element.prototype.scrollIntoView;
      let deferredScroll=null;
      Element.prototype.scrollIntoView=function(...scrollArgs){
        if(this.matches?.('[data-location-card]')&&!before.has(this.dataset.locationCard)){
          deferredScroll={node:this,args:scrollArgs};
          return;
        }
        return originalScroll.apply(this,scrollArgs);
      };
      let result;
      try{result=await current(...args)}finally{Element.prototype.scrollIntoView=originalScroll}
      const created=(window.locations||[]).find(item=>!before.has(item.id));
      if(created){
        if(typeof restoreAllForms==='function')await restoreAllForms();
        else if(typeof updateSummary==='function')await updateSummary();
        const card=await enhanceLocation(created.id,{renderProgress:true});
        const target=card||deferredScroll?.node;
        if(target?.isConnected)originalScroll.apply(target,deferredScroll?.args||[{behavior:'smooth'}]);
      }
      return result;
    };
    wrapped.__canonicalCardSaveV448=true;
    wrapped.__base=current;
    window.saveLocationFromModal=wrapped;
    try{saveLocationFromModal=wrapped}catch(_){ }
    return true;
  }

  async function settleInitialMetrics(){
    attempts+=1;
    const api=window.BogatkaCardProgressV448;
    const metrics=window.BogatkaDecisionUI?.lastMetrics;
    if(!api?.ready||!Array.isArray(metrics)||!metrics.length){
      if(attempts<160)setTimeout(settleInitialMetrics,80);
      return;
    }
    installRuntimePatches();
    installCanonicalSummaryWrapper();
    installSaveLocationWrapper();
    api.transformMetrics(metrics);
    await api.renderAll();
    await requestEnhancement({renderProgress:false});
    api.initialized=true;
    window.dispatchEvent(new CustomEvent('bogatka:card-progress-ready',{detail:{version:VERSION}}));
  }

  function install(){
    if(!installBootstrapGate()){
      setTimeout(install,50);
      return;
    }
    installCanonicalSummaryWrapper();
    installSaveLocationWrapper();
    setTimeout(settleInitialMetrics,0);
    [100,300,800,1800,3500].forEach(delay=>setTimeout(()=>{
      installRuntimePatches();
      installCanonicalSummaryWrapper();
      installSaveLocationWrapper();
    },delay));
  }

  install();
  window.BogatkaCardEnhancer={version:VERSION,ready:true,enhanceCard,enhanceAll:requestEnhancement,enhanceLocation,get diagnostics(){return{running:enhancementRunning,pending:enhancementPending,passes:enhancementPasses}}};
  window.BogatkaCardProgressInitV448={
    version:VERSION,
    ready:true,
    TARGETS,
    openTarget,
    refineAll,
    enhanceLocation,
    get skippedBootstrapRefresh(){return skippedBootstrapRefresh},
  };
})();
