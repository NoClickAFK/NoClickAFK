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
    conclusion:{title:'Предварительное решение по локации',selector:'.decision-panel-v412,.decision',kind:'static'},
  };
  const EXPLANATION='Оценки ставятся ниже в разделе «Оценка локации». Качество показывает средний результат по заполненным критериям, а надёжность — сколько из 14 критериев уже оценено. Пустые критерии не снижают качество, но уменьшают надёжность';
  let skippedBootstrapRefresh=false;
  let attempts=0;
  let navigationBound=false;

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

  function normalizeGroups(metrics=[]){
    for(const metric of metrics){
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

  async function settleInitialMetrics(){
    attempts+=1;
    const api=window.BogatkaCardProgressV448;
    const metrics=window.BogatkaDecisionUI?.lastMetrics;
    if(!api?.ready||!Array.isArray(metrics)||!metrics.length){
      if(attempts<160)setTimeout(settleInitialMetrics,80);
      return;
    }
    installRuntimePatches();
    api.transformMetrics(metrics);
    await api.renderAll();
    refineAll();
    api.initialized=true;
    window.dispatchEvent(new CustomEvent('bogatka:card-progress-ready',{detail:{version:VERSION}}));
  }

  function install(){
    if(!installBootstrapGate()){
      setTimeout(install,50);
      return;
    }
    setTimeout(settleInitialMetrics,0);
  }

  install();
  window.BogatkaCardProgressInitV448={
    version:VERSION,
    ready:true,
    TARGETS,
    openTarget,
    refineAll,
    get skippedBootstrapRefresh(){return skippedBootstrapRefresh},
  };
})();
