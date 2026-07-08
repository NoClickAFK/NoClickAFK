(function(){
  if(window.__bogatkaCompareV430)return;
  window.__bogatkaCompareV430=true;

  const E=window.BogatkaDecisionEngine;
  const state={key:'rank',direction:'asc'};
  const baseUpdateSummary=window.updateSummary||updateSummary;
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const fmt=(value,digits=0)=>value===null||value===undefined||!Number.isFinite(Number(value))?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:digits}).format(Number(value));

  function setVersion(){window.BogatkaVersion?.apply?.()}
  function setText(node,value){const next=String(value);if(node&&node.textContent!==next)node.textContent=next}
  function setAttr(node,name,value){if(node&&node.getAttribute(name)!==value)node.setAttribute(name,value)}

  function arrange(){
    const grid=document.querySelector('.summary-grid');
    if(!grid)return;
    if(!grid.classList.contains('summary-grid-v332'))grid.classList.add('summary-grid-v332');
    for(const id of ['totalLocationsCount','completedCount','bestScore','averageScore','candidateCount','negotiationCount','keepCount','excludedCount','photoCount','storageUsage']){
      const metric=document.getElementById(id)?.closest('.metric');
      if(!metric)continue;
      if(metric.classList.contains('wide'))metric.classList.remove('wide');
      if(metric.parentElement!==grid||metric!==grid.lastElementChild)grid.appendChild(metric);
    }
  }

  function isPanelOpen(panel){return panel?.dataset.open==='true'}
  function syncPanelState(panel,open){
    if(!panel)return;
    const summary=panel.querySelector(':scope > summary');
    const body=panel.querySelector(':scope > .comparison-body-v332');
    const next=Boolean(open);
    panel.dataset.open=String(next);
    setAttr(panel,'aria-expanded',String(next));
    setAttr(summary,'aria-expanded',String(next));
    if(body){
      if(body.hidden===next)body.hidden=!next;
      setAttr(body,'aria-hidden',String(!next));
    }
  }

  function createPanel(){
    const panel=document.createElement('section');
    panel.id='locationComparisonPanel';
    panel.className='comparison-panel-v332 comparison-panel-v340 comparison-shell-v430 comparison-stable-v430';
    panel.dataset.open='false';
    panel.setAttribute('aria-expanded','false');
    panel.innerHTML=`<summary role="button" tabindex="0" class="comparison-toggle-v430" data-comparison-toggle-v430 aria-expanded="false" aria-controls="comparisonBodyV430"><span class="comparison-summary-copy"><strong>Таблица сравнения локаций</strong><small>Рейтинг, проверки перед арендой, экономика, задачи и готовность к запуску</small></span><span class="comparison-count-v332" id="comparisonLocationCount">0 локаций</span><span class="comparison-chevron-v430" aria-hidden="true"></span></summary><div class="comparison-body-v332" id="comparisonBodyV430" hidden aria-hidden="true"><div class="comparison-hint-v332">Нажмите на заголовок для сортировки. Нажмите на адрес, чтобы перейти к карточке.</div><div class="comparison-scroll-v332"><table class="comparison-table-v332 comparison-table-v340"><thead></thead><tbody></tbody><tfoot></tfoot></table></div></div>`;
    syncPanelState(panel,false);
    const summary=panel.querySelector(':scope > summary');
    const enableInteractionMotion=()=>panel.classList.add('comparison-interaction-ready-v430');
    const userToggle=()=>{enableInteractionMotion();const next=!isPanelOpen(panel);syncPanelState(panel,next);if(next)render().catch(console.error)};
    summary.addEventListener('pointerdown',enableInteractionMotion,{once:true});
    summary.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '||event.key==='Spacebar'){event.preventDefault();userToggle()}},{once:false});
    summary.addEventListener('click',userToggle);
    return panel;
  }

  function ensurePanel(){
    const card=document.querySelector('.summary.card');
    const grid=card?.querySelector('.summary-grid');
    if(!card||!grid)return null;
    let panel=document.getElementById('locationComparisonPanel');
    if(panel?.tagName==='DETAILS'){
      const replacement=createPanel();
      panel.replaceWith(replacement);
      panel=replacement;
    }
    if(panel){
      if(!panel.classList.contains('comparison-shell-v430'))panel.classList.add('comparison-shell-v430');
      if(!panel.dataset.open)syncPanelState(panel,false);
      return panel;
    }
    panel=createPanel();
    grid.insertAdjacentElement('afterend',panel);
    return panel;
  }

  function economy(metric){return metric.economy||window.BogatkaSuite?.calculateEconomy(metric.data)||{}}
  function openTasks(metric){return(metric.data.tasks||[]).filter(task=>task.status!=='done').length}
  function launchProgress(metric){const items=metric.data.launchProject?.milestones||[];if(!items.length)return null;return Math.round(items.filter(item=>item.status==='done').length/items.length*100)}
  function value(metric,key){
    if(key==='title')return metric.item.title||metric.item.address||'';
    if(key==='status')return metric.data.status||'';
    if(key==='objectType')return metric.data.objectType||'';
    if(key==='decision')return metric.data.decision||'';
    if(key==='recommendation')return metric.recommendation.label;
    if(key==='dealGate')return metric.dealGate.priority;
    if(key==='revenue')return economy(metric).revenue;
    if(key==='profit')return economy(metric).operatingProfit;
    if(key==='rentBurden')return economy(metric).rentBurdenPct;
    if(key==='payback')return economy(metric).paybackMonths;
    if(key==='tasks')return openTasks(metric);
    if(key==='launch')return launchProgress(metric);
    return metric[key];
  }
  function compare(left,right){
    let a=value(left,state.key),b=value(right,state.key);
    if(a===null||a===undefined||a==='')a=state.direction==='asc'?'\uffff':-Infinity;
    if(b===null||b===undefined||b==='')b=state.direction==='asc'?'\uffff':-Infinity;
    const result=typeof a==='number'&&typeof b==='number'?a-b:String(a).localeCompare(String(b),'ru',{numeric:true,sensitivity:'base'});
    return state.direction==='asc'?result:-result;
  }
  function head(key,label){const active=state.key===key;const arrow=active?(state.direction==='asc'?'▲':'▼'):'';return `<button type="button" data-compare-sort="${key}" class="${active?'active':''}">${esc(label)}<span>${arrow}</span></button>`}
  function recommendation(metric){return `<span class="compare-rec-v340 ${metric.recommendation.className}">${esc(metric.recommendation.label)}</span>`}
  function deal(metric){const tone=metric.dealGate.code==='blocked'?'block':metric.dealGate.code==='needs_formalization'?'risk':metric.dealGate.code==='confirmed'?'clear':'empty';return `<span class="compare-stop-v340 ${tone}" title="${esc(metric.dealGate.text)}">${esc(metric.dealGate.compactText)}</span>`}
  function mini(value){return value?`<span class="compare-mini-score-v332">${value}</span>`:'<span class="compare-empty-v332">—</span>'}
  function row(metric){
    const data=metric.data,calculated=economy(metric),launch=launchProgress(metric),tasks=openTasks(metric);
    return `<tr class="${metric.dealGate.code==='blocked'?'compare-row-stop-v340':''}"><td class="compare-rank-v340"><strong>#${metric.rank}</strong></td><td class="compare-location-v332"><button type="button" data-compare-location="${esc(metric.id)}"><strong>${esc(metric.item.title||metric.item.address)}</strong>${metric.item.address&&metric.item.address!==metric.item.title?`<small>${esc(metric.item.address)}</small>`:''}</button></td><td>${recommendation(metric)}</td><td>${deal(metric)}</td><td class="compare-weight-v340"><strong>${fmt(metric.weighted,1)}</strong><small>/100</small></td><td><span class="compare-complete-v340">${metric.completion}%</span></td><td class="compare-score-total-v332"><strong>${metric.rawScore}</strong><small>/70</small></td><td><span class="compare-status-v332">${esc(data.status||'Не выбран')}</span></td><td>${esc(data.objectType||'—')}</td><td>${fmt(metric.area,1)}</td><td>${fmt(metric.rent,2)}</td><td>${fmt(metric.rentPerSqm,2)}</td><td>${fmt(calculated.revenue,2)}</td><td class="${calculated.operatingProfit<0?'compare-negative-v400':'compare-positive-v400'}">${fmt(calculated.operatingProfit,2)}</td><td>${calculated.rentBurdenPct==null?'—':`${fmt(calculated.rentBurdenPct,1)}%`}</td><td>${calculated.paybackMonths==null?'—':`${fmt(calculated.paybackMonths,1)} мес.`}</td><td>${mini(Number(data?.score?.foot)||0)}</td><td>${mini(Number(data?.score?.parking)||0)}</td><td>${mini(Number(data?.score?.competition)||0)}</td><td>${metric.photoCount}</td><td>${tasks}</td><td>${launch==null?'—':`${launch}%`}</td><td>${esc(data.decision||'—')}</td></tr>`;
  }
  async function metrics(){return await E.computeAll()}
  function renderSignature(rows){return JSON.stringify({key:state.key,direction:state.direction,rows:rows.map(metric=>({id:metric.id,rank:metric.rank,recommendation:metric.recommendation,dealGate:metric.dealGate,weighted:metric.weighted,completion:metric.completion,rawScore:metric.rawScore,area:metric.area,rent:metric.rent,rentPerSqm:metric.rentPerSqm,photoCount:metric.photoCount,data:metric.data,economy:economy(metric)}))})}

  async function render(){
    const panel=ensurePanel();if(!panel)return;
    const table=panel.querySelector('table');
    const rows=(await metrics()).sort(compare);
    const count=panel.querySelector('#comparisonLocationCount');
    setText(count,`${rows.length} ${rows.length===1?'локация':rows.length>1&&rows.length<5?'локации':'локаций'}`);
    const signature=renderSignature(rows);
    if(table.dataset.comparisonRenderSignature===signature)return;
    table.querySelector('thead').innerHTML=`<tr><th>${head('rank','Ранг')}</th><th>${head('title','Локация')}</th><th>${head('recommendation','Рекомендация')}</th><th>${head('dealGate','Перед арендой')}</th><th>${head('weighted','Вес /100')}</th><th>${head('completion','Заполнено')}</th><th>${head('rawScore','Балл /70')}</th><th>${head('status','Статус')}</th><th>${head('objectType','Тип')}</th><th>${head('area','Площадь')}</th><th>${head('rent','Аренда')}</th><th>${head('rentPerSqm','BYN/м²')}</th><th>${head('revenue','Выручка')}</th><th>${head('profit','Прибыль')}</th><th>${head('rentBurden','Аренда/%')}</th><th>${head('payback','Окупаемость')}</th><th>Поток</th><th>Парковка</th><th>Конкуренты</th><th>${head('photoCount','Фото')}</th><th>${head('tasks','Задачи')}</th><th>${head('launch','Запуск')}</th><th>${head('decision','Решение')}</th></tr>`;
    table.querySelector('tbody').innerHTML=rows.length?rows.map(row).join(''):'<tr><td colspan="23" class="comparison-empty-v332">Локаций пока нет.</td></tr>';
    const active=rows.filter(metric=>metric.completion>0);
    const averageWeighted=active.length?active.reduce((sum,metric)=>sum+metric.weighted,0)/active.length:0;
    const averageCompletion=active.length?active.reduce((sum,metric)=>sum+metric.completion,0)/active.length:0;
    table.querySelector('tfoot').innerHTML=`<tr><td colspan="4"><strong>Итого: ${rows.length} локаций</strong></td><td><strong>${fmt(averageWeighted,1)}</strong></td><td><strong>${fmt(averageCompletion,0)}%</strong></td><td colspan="13"></td><td><strong>${rows.reduce((sum,metric)=>sum+metric.photoCount,0)}</strong></td><td><strong>${rows.reduce((sum,metric)=>sum+openTasks(metric),0)}</strong></td><td colspan="2"></td></tr>`;
    table.dataset.comparisonRenderSignature=signature;
    table.querySelectorAll('[data-compare-sort]').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.compareSort;if(state.key===key)state.direction=state.direction==='asc'?'desc':'asc';else{state.key=key;state.direction=['rank','dealGate','rent','rentPerSqm','rentBurden','payback','tasks'].includes(key)?'asc':'desc'}render().catch(console.error)}));
    table.querySelectorAll('[data-compare-location]').forEach(button=>button.addEventListener('click',()=>{const card=document.querySelector(`[data-location-card="${CSS.escape(button.dataset.compareLocation)}"]`);if(!card)return;card.scrollIntoView({behavior:'smooth',block:'start'});card.classList.add('compare-highlight-v332');setTimeout(()=>card.classList.remove('compare-highlight-v332'),1800)}));
  }

  async function updateSummaryV430Compare(){if(baseUpdateSummary)await baseUpdateSummary();setVersion();arrange();ensurePanel();await render()}
  window.updateSummary=updateSummaryV430Compare;
  try{updateSummary=updateSummaryV430Compare}catch(_){ }
  window.BogatkaComparisonV430={version:'4.3.0',ensurePanel,render,syncPanelState,isOpen:isPanelOpen};
  setVersion();arrange();ensurePanel();render().catch(console.error);
})();
