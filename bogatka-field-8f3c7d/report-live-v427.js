(function(){
  'use strict';
  if(window.BogatkaLiveReport?.ready)return;

  const VERSION='4.2.7';
  const wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":'&#39;'}[char]));
  const emptyValue=value=>value===undefined||value===null||String(value).trim()==='';
  const dash=value=>emptyValue(value)?'—':String(value);
  const formatNumber=(value,digits=0)=>value===undefined||value===null||value===''||!Number.isFinite(Number(value))?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:digits}).format(Number(value));
  const formatDate=value=>{if(!value)return'—';try{return new Date(value).toLocaleString('ru-RU')}catch(_){return String(value)}};

  async function callOptional(target,name,...args){
    try{
      const fn=target?.[name];
      if(typeof fn!=='function')return null;
      return await fn.apply(target,args);
    }catch(error){
      console.warn(`Live report preparation skipped ${name}.`,error);
      return null;
    }
  }

  async function prepareSource(){
    const active=document.activeElement;
    if(active&&/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))active.blur();
    await wait(420);
    await callOptional(window.BogatkaLocationProfileV416,'enhanceAll');
    await callOptional(window.BogatkaWorkflowV414,'enhanceAll');
    await callOptional(window.BogatkaDecisionUI,'refresh');
    await callOptional(window.BogatkaSuiteUI,'refresh');
    if(typeof updateSummary==='function'){
      try{await updateSummary()}catch(error){console.warn('Live report summary refresh failed.',error)}
    }
    const comparison=document.getElementById('locationComparisonPanel');
    if(comparison)comparison.open=true;
    await wait(260);
  }

  function copyLiveControlState(source,clone){
    const sourceControls=[...source.querySelectorAll('input,select,textarea')];
    const cloneControls=[...clone.querySelectorAll('input,select,textarea')];
    sourceControls.forEach((control,index)=>{
      const target=cloneControls[index];
      if(!target)return;
      target.value=control.value;
      if(control.tagName==='TEXTAREA')target.textContent=control.value;
      if(control.type==='checkbox'||control.type==='radio')target.checked=control.checked;
      if(control.tagName==='SELECT'){
        [...target.options].forEach((option,optionIndex)=>option.selected=Boolean(control.options[optionIndex]?.selected));
      }
    });
  }

  function removeHiddenAndEditingUi(source,clone){
    const sourceNodes=[source,...source.querySelectorAll('*')];
    const cloneNodes=[clone,...clone.querySelectorAll('*')];
    const hiddenSelector='.hidden,.profile-hidden-v425,.panel-hidden-v419,[hidden]';
    sourceNodes.forEach((node,index)=>{
      const target=cloneNodes[index];
      if(!target||target===clone)return;
      if(node.matches?.(hiddenSelector))target.remove();
    });
    clone.classList.remove('location-card-collapsed-v422','compare-highlight-v332','has-stop-factor-v340','has-risk-factor-v340');
    clone.querySelectorAll('.location-actions,.photo-mode-bar,.photo-edit-switch,.comparison-hint-v332,.collaboration-tabs-v400,.task-form-v400,.comment-form-v400,.archive-manager-v400,.launch-empty-v400 button,.photo-delete,.task-delete-v400,[data-action],input[type="file"],.premium-select-menu,.premium-select-trigger').forEach(node=>node.remove());
    clone.querySelectorAll('[contenteditable]').forEach(node=>node.removeAttribute('contenteditable'));
    clone.querySelectorAll('.collab-pane-v400').forEach(pane=>{
      pane.classList.add('active');
      const title={tasks:'Задачи',comments:'Комментарии',history:'История изменений'}[pane.dataset.collabPane];
      if(title&&!pane.querySelector(':scope > .report-pane-title')){
        const heading=document.createElement('h4');
        heading.className='report-pane-title';
        heading.textContent=title;
        pane.prepend(heading);
      }
    });
  }

  function selectedText(select){
    const option=select.options?.[select.selectedIndex];
    const value=option?.textContent?.trim()||select.value;
    if(!value||value==='Не выбран'||value==='Не выбрано')return'—';
    return value;
  }

  function replaceControl(control){
    if(!control.isConnected)return;
    const output=document.createElement('span');
    output.className='report-control-value';
    const type=String(control.type||'').toLowerCase();
    if(type==='checkbox'){
      output.classList.add('report-binary',control.checked?'yes':'empty');
      output.textContent=control.checked?'Да':'—';
      control.closest('.check-row')?.classList.add(control.checked?'report-confirmed':'report-unconfirmed');
    }else if(type==='radio'){
      output.classList.add('report-radio',control.checked?'selected':'empty');
      output.textContent=control.checked?'●':'○';
      control.closest('label')?.classList.add(control.checked?'report-selected-option':'report-unselected-option');
    }else if(control.tagName==='SELECT'){
      output.classList.add('report-select-value');
      output.textContent=selectedText(control);
    }else{
      const value=control.value??control.textContent??'';
      output.classList.add('report-text-value');
      output.textContent=dash(value);
      if(control.tagName==='TEXTAREA')output.classList.add('report-multiline-value');
    }
    control.replaceWith(output);
  }

  function normalizeClone(clone){
    clone.querySelectorAll('details').forEach(details=>{
      details.open=true;
      details.setAttribute('open','');
    });
    [...clone.querySelectorAll('input,select,textarea')].forEach(replaceControl);
    clone.querySelectorAll('button').forEach(button=>button.remove());
    clone.querySelectorAll('a').forEach(link=>{
      link.setAttribute('target','_blank');
      link.setAttribute('rel','noopener');
    });
    clone.querySelectorAll('.empty-state-v400').forEach(node=>{
      if(emptyValue(node.textContent))node.textContent='—';
    });
    clone.querySelectorAll('[style]').forEach(node=>{
      if(node.style.display==='none')node.remove();
    });
    return clone;
  }

  async function hydratePhotoCategories(clone,locationId,photos){
    const roots=[...clone.querySelectorAll('[data-photos]')];
    for(const root of roots){
      const marker=String(root.dataset.photos||'');
      const separator=marker.indexOf(':');
      const category=separator>=0?marker.slice(separator+1):'other';
      const matches=photos.filter(photo=>photo.locationId===locationId&&(photo.category||'other')===category);
      if(!matches.length){
        root.innerHTML='<div class="report-photo-empty">—</div>';
        continue;
      }
      const figures=[];
      for(const photo of matches){
        const source=await blobToDataURL(photo.blob);
        const caption=photo.caption||photo.originalName||'Фотография локации';
        const size=Number(photo.size||photo.blob?.size||0)/1024/1024;
        figures.push(`<figure class="report-photo-card"><button type="button" class="report-photo-open" data-report-photo="${escapeHtml(source)}" aria-label="Открыть фотографию"><img src="${escapeHtml(source)}" alt="${escapeHtml(caption)}" loading="eager"></button><figcaption><strong>${escapeHtml(caption)}</strong><small>${photo.width||'—'}×${photo.height||'—'} · ${size?size.toFixed(1):'—'} МБ</small></figcaption></figure>`);
      }
      root.innerHTML=figures.join('');
      root.classList.add('report-photo-grid');
    }
  }

  async function cloneLocation(source,allPhotos){
    const locationId=source.dataset.locationCard;
    const clone=source.cloneNode(true);
    copyLiveControlState(source,clone);
    removeHiddenAndEditingUi(source,clone);
    normalizeClone(clone);
    await hydratePhotoCategories(clone,locationId,allPhotos);
    clone.classList.add('report-location-card');
    clone.querySelector('.location-body')?.classList.add('report-location-body');
    clone.querySelectorAll('.location-body > *').forEach((node,index)=>node.style.setProperty('--report-order',String(index)));
    return clone;
  }

  function summaryCards(){
    const cards=[];
    document.querySelectorAll('.summary-grid .metric').forEach(metric=>{
      const value=metric.querySelector('strong')?.textContent?.trim()||'—';
      const label=metric.querySelector('span')?.textContent?.trim()||'';
      if(!label)return;
      cards.push(`<div class="report-kpi"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`);
    });
    return cards.join('');
  }

  function compactComparison(metrics,order){
    const byId=new Map(metrics.map(metric=>[metric.id,metric]));
    const rows=order.map(id=>byId.get(id)).filter(Boolean);
    if(!rows.length)return'<p class="report-empty">—</p>';
    return `<div class="report-table-wrap"><table class="report-comparison-table"><thead><tr><th>#</th><th>Локация</th><th>Рекомендация</th><th>Вес</th><th>Заполнено</th><th>Балл</th><th>Статус</th><th>Тип</th><th>Площадь</th><th>Аренда</th><th>Решение</th></tr></thead><tbody>${rows.map(metric=>`<tr><td><b>#${metric.rank}</b></td><td><strong>${escapeHtml(metric.item.title||metric.item.address||'—')}</strong>${metric.item.address&&metric.item.address!==metric.item.title?`<small>${escapeHtml(metric.item.address)}</small>`:''}</td><td><span class="report-tag ${escapeHtml(metric.recommendation.className||'')}">${escapeHtml(metric.recommendation.label||'—')}</span></td><td>${formatNumber(metric.weighted,1)}/100</td><td>${formatNumber(metric.completion,0)}%</td><td>${formatNumber(metric.rawScore,0)}/70</td><td>${escapeHtml(metric.data.status||'—')}</td><td>${escapeHtml(metric.data.objectType||'—')}</td><td>${formatNumber(metric.area,1)}</td><td>${formatNumber(metric.rent,2)}</td><td>${escapeHtml(metric.data.decision||'—')}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function detailedComparisonClone(){
    const table=document.querySelector('#locationComparisonPanel table');
    if(!table)return'';
    const clone=table.cloneNode(true);
    clone.querySelectorAll('button').forEach(button=>{
      const span=document.createElement('span');
      span.textContent=button.textContent.trim();
      button.replaceWith(span);
    });
    clone.className='report-detailed-table';
    return `<details class="report-detailed-comparison"><summary>Полная таблица сравнения</summary><div class="report-wide-scroll">${clone.outerHTML}</div></details>`;
  }

  function reportStyles(){
    return `
      :root{--green:#15583f;--green-2:#1f7354;--mint:#edf6f1;--paper:#fff;--line:#d6e3dc;--gold:#d6a63d;--gold-soft:#fff7e5;--ink:#173329;--muted:#65756d;--danger:#a63a3a;--shadow:0 14px 42px rgba(20,72,52,.09)}
      *{box-sizing:border-box}html{background:#edf4f0;color:var(--ink);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}body{margin:0;line-height:1.45}.report-shell{max-width:1280px;margin:0 auto;padding:24px}.report-cover{position:relative;overflow:hidden;background:linear-gradient(135deg,#124c37,#267657);color:#fff;border-radius:28px;padding:34px 38px;box-shadow:var(--shadow);margin-bottom:20px}.report-cover:after{content:"";position:absolute;width:320px;height:320px;border:1px solid rgba(255,255,255,.18);border-radius:50%;right:-90px;top:-170px}.report-cover h1{font-size:34px;line-height:1.12;margin:0 0 8px;letter-spacing:-.02em}.report-cover .report-subtitle{font-size:16px;opacity:.86;margin:0 0 24px}.report-cover-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;position:relative;z-index:1}.report-cover-grid>div{padding:12px 14px;border:1px solid rgba(255,255,255,.23);border-radius:14px;background:rgba(255,255,255,.09)}.report-cover-grid span{display:block;font-size:11px;opacity:.76;text-transform:uppercase;letter-spacing:.06em}.report-cover-grid strong{display:block;margin-top:4px;font-size:14px;white-space:pre-wrap}.report-section{background:var(--paper);border:1px solid var(--line);border-radius:22px;padding:22px;margin:18px 0;box-shadow:0 8px 28px rgba(20,72,52,.05)}.report-section-title{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:16px}.report-section-title h2{font-size:23px;margin:0;color:var(--green)}.report-section-title p{margin:3px 0 0;color:var(--muted);font-size:13px}.report-kpi-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.report-kpi{min-height:84px;border:1px solid var(--line);border-radius:15px;padding:13px;background:linear-gradient(180deg,#fff,#f6faf8)}.report-kpi strong{display:block;font-size:22px;color:var(--green)}.report-kpi span{font-size:12px;color:var(--muted)}.report-table-wrap,.report-wide-scroll{overflow:auto;border:1px solid var(--line);border-radius:14px}.report-comparison-table,.report-detailed-table,table{width:100%;border-collapse:collapse}.report-comparison-table{min-width:1080px}.report-comparison-table th,.report-comparison-table td,.report-detailed-table th,.report-detailed-table td,table th,table td{border-bottom:1px solid var(--line);padding:9px 10px;text-align:left;vertical-align:top;font-size:12px}.report-comparison-table th,.report-detailed-table th,table th{background:var(--mint);color:var(--green);font-weight:800}.report-comparison-table small{display:block;color:var(--muted);margin-top:2px}.report-tag{display:inline-block;border-radius:999px;padding:4px 8px;background:#e7f3ec;color:var(--green);font-weight:800;font-size:10px}.report-tag.stop{background:#fde7e7;color:#8d2f2f}.report-tag.risk{background:#fff0d5;color:#865814}.report-detailed-comparison{margin-top:12px}.report-detailed-comparison>summary{cursor:pointer;color:var(--green);font-weight:800}.report-location-card{background:#fff;border:1px solid var(--line);border-radius:24px;box-shadow:var(--shadow);margin:22px 0;padding:0;overflow:hidden;break-before:page}.report-location-card .location-head{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:16px;align-items:start;padding:24px 26px;background:linear-gradient(180deg,#fbfdfc,#f0f7f3);border-bottom:1px solid var(--line)}.report-location-card .location-title-wrap h2{margin:6px 0;color:var(--green);font-size:26px}.report-location-card .location-title-wrap p,.report-location-card .gps{color:var(--muted);margin:4px 0}.report-location-card .rank,.report-location-card .auto-rank-v340{display:inline-flex;border-radius:999px;padding:5px 9px;background:var(--green);color:#fff;font-size:11px;font-weight:800;margin-right:6px}.report-location-card .auto-rank-v340{background:#e8f3ed;color:var(--green)}.report-location-card .scorebox,.decision-head-v340{display:flex;gap:8px;align-items:stretch}.report-location-card .scorebox,.decision-score-v340,.decision-complete-v340{min-width:82px;text-align:center;border:1px solid var(--line);border-radius:14px;padding:10px;background:#fff}.report-location-card .scorebox strong,.decision-score-v340 strong,.decision-complete-v340 strong{display:block;color:var(--green);font-size:22px}.decision-recommendation-v340{display:block;margin-top:7px;padding:6px 10px;border-radius:999px;background:#edf3ef;font-size:11px;font-weight:800;text-align:center}.decision-recommendation-v340.stop{background:#fde8e8;color:#8e3030}.decision-recommendation-v340.risk{background:#fff1d8;color:#855b16}.report-location-body{display:block!important;padding:18px 20px 26px}.location-overview-v416{display:grid;grid-template-columns:1fr 1fr;gap:14px}.inspection-card-v416,.landlord-card-v416{border:2px solid var(--gold);border-radius:18px;overflow:hidden;background:#fffdf8}.profile-section-head-v416{padding:15px 17px;background:linear-gradient(180deg,#fff9ea,#ffefc6);border-bottom:1px solid #ead08e}.profile-section-head-v416 strong{display:block;color:var(--green);font-size:18px}.profile-section-head-v416 span{color:#80682f;font-size:12px}.inspection-grid-v416,.landlord-grid-v416,.grid-2,.grid-3,.grid-4,.quick-grid,.notes-grid,.report-suite-grid,.launch-overview-v400,.economy-results-v400{display:grid;gap:10px}.inspection-grid-v416,.landlord-grid-v416,.grid-2,.notes-grid,.report-suite-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.grid-3,.economy-results-v400{grid-template-columns:repeat(3,minmax(0,1fr))}.grid-4,.launch-overview-v400{grid-template-columns:repeat(4,minmax(0,1fr))}.inspection-grid-v416,.landlord-grid-v416{padding:14px}.field{display:flex;flex-direction:column;gap:5px;min-width:0;font-size:12px;font-weight:750;color:var(--green)}.profile-caption-v416{display:block}.report-control-value{display:block;min-height:42px;border:1px solid var(--line);border-radius:12px;background:#fff;padding:10px 12px;color:var(--ink);font-weight:650;white-space:pre-wrap;overflow-wrap:anywhere}.report-multiline-value{min-height:68px}.report-binary,.report-radio{display:inline-flex;min-height:28px;min-width:32px;width:auto;padding:4px 8px;align-items:center;justify-content:center}.report-binary.yes{background:#e7f5ec;color:#145e3e}.report-selected-option{border-color:#7fb29a!important;background:#eef8f2!important}.report-unselected-option{opacity:.62}.decision{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.decision label{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:14px;padding:12px;background:#fff}.decision-overview-v340{border:1px solid var(--line);border-radius:17px;padding:14px;background:linear-gradient(180deg,#f7fbf9,#edf6f1);margin:14px 0}.decision-overview-top-v340{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.decision-overview-top-v340>div,.economy-results-v400>div,.launch-overview-v400>div{border:1px solid var(--line);background:#fff;border-radius:11px;padding:10px}.decision-overview-top-v340 span,.economy-results-v400 span,.launch-overview-v400 span{display:block;color:var(--muted);font-size:10px}.decision-overview-top-v340 strong,.economy-results-v400 strong,.launch-overview-v400 strong{display:block;color:var(--green);margin-top:3px}.completion-track-v340,.photo-plan-track-v400,.launch-progress-v400{height:8px;background:#dfeae4;border-radius:999px;overflow:hidden;margin:10px 0}.completion-track-v340 span,.photo-plan-track-v400 span,.launch-progress-v400 span{display:block;height:100%;background:linear-gradient(90deg,#1b865d,#4ebd84)}details{border:1px solid var(--line);border-radius:16px;margin:12px 0;background:#fff;overflow:hidden}details>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;background:#fbfdfc;color:var(--green);font-size:16px;font-weight:850}details>summary::-webkit-details-marker{display:none}details>summary:before{content:"";width:8px;height:8px;border-left:2px solid var(--green);border-bottom:2px solid var(--green);transform:rotate(-45deg);margin-right:4px}.details-body{display:block!important;padding:14px 16px}.section-note{color:var(--muted);font-size:12px;margin:0 0 12px}.check-group h4,.report-pane-title,.details-body h4{color:var(--green);margin:14px 0 7px}.check-grid,.stop-grid-v340{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.check-row,.stop-row-v340{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:#fbfdfc}.check-row span:not(.report-control-value){flex:1}.stop-row-v340 strong{font-size:12px}.score-table td:first-child{width:72%}.score-guide-v415,.score-scale-v415,.photo-plan-v400{background:linear-gradient(180deg,#f7fbf9,#edf6f1);border:1px solid var(--line);border-radius:15px;padding:13px;margin-bottom:12px}.photo-plan-grid-v400{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.photo-plan-grid-v400>div{border:1px solid var(--line);border-radius:10px;background:#fff;padding:8px;display:flex;justify-content:space-between}.photo-category{border:1px solid var(--line);border-radius:15px;padding:13px;margin:10px 0;background:#fbfdfc}.photo-category-head{display:flex;justify-content:space-between;gap:10px}.photo-category-head h4{margin:0;color:var(--green);font-size:16px}.photo-category-head p{margin:4px 0;color:var(--muted);font-size:11px}.report-photo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:10px}.report-photo-card{margin:0;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#fff;break-inside:avoid}.report-photo-open{display:block;width:100%;border:0;padding:0;background:#10251d;line-height:0;cursor:zoom-in}.report-photo-card img{display:block;width:100%;height:auto;max-height:520px;object-fit:contain;background:#10251d}.report-photo-card figcaption{display:flex;justify-content:space-between;gap:8px;padding:9px 11px}.report-photo-card figcaption strong{font-size:11px}.report-photo-card figcaption small{color:var(--muted);white-space:nowrap}.report-photo-empty{padding:16px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:12px}.task-card-v400,.comment-card-v400,.history-item-v400,.milestone-v400{border:1px solid var(--line);border-radius:12px;padding:11px;margin:8px 0;background:#fff;break-inside:avoid}.task-card-v400,.milestone-v400{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px}.task-priority-v400{border-radius:999px;padding:4px 8px;background:#edf3ef;font-size:10px}.report-pane-title{border-top:1px solid var(--line);padding-top:12px}.report-meta-footer{margin:26px 0 8px;text-align:center;color:var(--muted);font-size:11px}.report-actions{position:fixed;z-index:1000;right:18px;bottom:18px;display:flex;gap:8px}.report-actions button{border:0;border-radius:999px;padding:11px 16px;background:var(--green);color:#fff;font-weight:800;box-shadow:0 8px 25px rgba(17,73,52,.25);cursor:pointer}.report-lightbox{position:fixed;inset:0;background:rgba(0,0,0,.94);display:none;align-items:center;justify-content:center;padding:18px;z-index:2000}.report-lightbox.open{display:flex}.report-lightbox img{max-width:96vw;max-height:92vh;object-fit:contain}.report-lightbox button{position:absolute;right:16px;top:16px;width:44px;height:44px;border:0;border-radius:50%;background:rgba(255,255,255,.18);color:#fff;font-size:28px}.report-empty{color:var(--muted)}
      @media(max-width:900px){.report-cover-grid,.report-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.location-overview-v416{grid-template-columns:1fr}.decision-overview-top-v340,.grid-4,.launch-overview-v400{grid-template-columns:repeat(2,minmax(0,1fr))}.grid-3,.economy-results-v400,.photo-plan-grid-v400{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:620px){.report-shell{padding:10px}.report-cover{border-radius:18px;padding:24px 20px}.report-cover h1{font-size:27px}.report-cover-grid,.report-kpi-grid,.inspection-grid-v416,.landlord-grid-v416,.grid-2,.grid-3,.grid-4,.quick-grid,.notes-grid,.report-suite-grid,.decision-overview-top-v340,.check-grid,.stop-grid-v340,.photo-plan-grid-v400,.decision,.report-photo-grid,.economy-results-v400,.launch-overview-v400{grid-template-columns:1fr}.report-location-card .location-head{grid-template-columns:1fr}.report-actions{right:10px;bottom:10px}}
      @page{size:A4 portrait;margin:10mm}@media print{html,body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.report-shell{max-width:none;padding:0}.report-actions,.report-lightbox,.report-detailed-comparison{display:none!important}.report-cover,.report-section,.report-location-card{box-shadow:none}.report-cover{break-after:page;margin:0}.report-section{break-inside:auto;margin:0 0 8mm}.report-location-card{margin:0;border-radius:0;border-left:0;border-right:0;break-before:page;box-shadow:none}.report-location-card .location-head{padding:9mm 7mm}.report-location-body{padding:5mm 6mm}.location-overview-v416{grid-template-columns:1fr 1fr}.report-comparison-table{min-width:0;font-size:7.5px}.report-comparison-table th,.report-comparison-table td{padding:4px;font-size:7.5px}.report-kpi-grid{grid-template-columns:repeat(5,1fr)}.report-kpi{min-height:0;padding:8px}.report-kpi strong{font-size:16px}details,.photo-category,.inspection-card-v416,.landlord-card-v416,.decision-overview-v340{break-inside:auto}.field,.check-row,.stop-row-v340,.report-photo-card,.task-card-v400,.comment-card-v400,.history-item-v400,.milestone-v400{break-inside:avoid}.report-photo-grid{grid-template-columns:repeat(2,1fr)}.report-photo-card img{max-height:92mm}.report-control-value{min-height:0;padding:6px 8px}.report-meta-footer{margin-top:5mm}}
    `;
  }

  function reportScript(){
    return `<script>(function(){var box=document.getElementById('reportLightbox'),image=document.getElementById('reportLightboxImage');function close(){box.classList.remove('open');image.removeAttribute('src')}document.addEventListener('click',function(event){var photo=event.target.closest('[data-report-photo]');if(photo){image.src=photo.getAttribute('data-report-photo');box.classList.add('open');return}if(event.target===box||event.target.closest('[data-report-close]'))close()});document.addEventListener('keydown',function(event){if(event.key==='Escape')close()});document.querySelector('[data-report-print]')?.addEventListener('click',function(){window.print()})})();<\/script>`;
  }

  async function buildLiveReportHtml(){
    await prepareSource();
    const global=await idbGet(STORE,'global')||{};
    const allPhotos=await idbAll(PHOTO_STORE);
    const cards=[...document.querySelectorAll('#locations > [data-location-card]')];
    const order=cards.map(card=>card.dataset.locationCard);
    const metrics=window.BogatkaDecisionEngine?.computeAll?await window.BogatkaDecisionEngine.computeAll():[];
    const locationHtml=[];
    for(const card of cards)locationHtml.push((await cloneLocation(card,allPhotos)).outerHTML);
    const build=window.BOGATKA_BUILD||{version:VERSION,sourceCommit:''};
    const generatedAt=new Date();
    const html=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Отчёт по локациям «Богатка»</title><style>${reportStyles()}</style></head><body><main class="report-shell">
      <section class="report-cover"><h1>Отчёт по осмотру локаций «Богатка»</h1><p class="report-subtitle">Сводный документ по оценке, условиям аренды, рискам, трафику, экономике и готовности объектов.</p><div class="report-cover-grid"><div><span>Кто проводил осмотр</span><strong>${escapeHtml(dash(global.inspector))}</strong></div><div><span>Общие заметки поездки</span><strong>${escapeHtml(dash(global.tripNotes))}</strong></div><div><span>Сформирован</span><strong>${escapeHtml(generatedAt.toLocaleString('ru-RU'))}</strong></div><div><span>Версия данных</span><strong>${escapeHtml(build.version||VERSION)}${build.sourceCommit?` · ${escapeHtml(String(build.sourceCommit).slice(0,7))}`:''}</strong></div></div></section>
      <section class="report-section"><div class="report-section-title"><div><h2>Общая сводка</h2><p>Текущее состояние активных локаций на момент формирования отчёта.</p></div></div><div class="report-kpi-grid">${summaryCards()}</div></section>
      <section class="report-section report-comparison"><div class="report-section-title"><div><h2>Сравнение локаций</h2><p>Основные показатели для быстрого управленческого решения.</p></div></div>${compactComparison(metrics,order)}${detailedComparisonClone()}</section>
      ${locationHtml.join('\n')}
      <footer class="report-meta-footer">Отчёт сформирован приложением «Богатка» · ${escapeHtml(formatDate(generatedAt.toISOString()))} · ${escapeHtml(build.version||VERSION)}</footer>
    </main><div class="report-actions"><button type="button" data-report-print>Печать / PDF</button></div><div class="report-lightbox" id="reportLightbox"><button type="button" data-report-close aria-label="Закрыть">×</button><img id="reportLightboxImage" alt="Фотография локации"></div>${reportScript()}</body></html>`;
    return html;
  }

  async function exportHtmlReportLive(){
    showSaving();
    const html=await buildLiveReportHtml();
    downloadBlob(new Blob([html],{type:'text/html;charset=utf-8'}),`bogatka-premium-report-${new Date().toISOString().slice(0,10)}.html`);
    showSaved();
  }

  async function openPdfReportLive(){
    const reportWindow=window.open('','_blank');
    if(!reportWindow)return alert('Браузер заблокировал новое окно. Разрешите всплывающие окна для создания PDF.');
    reportWindow.document.write('<p style="font-family:Arial;padding:30px">Формируется полный отчёт…</p>');
    try{
      const html=await buildLiveReportHtml();
      reportWindow.document.open();
      reportWindow.document.write(html);
      reportWindow.document.close();
      const images=[...reportWindow.document.images];
      await Promise.all(images.map(image=>image.complete?Promise.resolve():new Promise(resolve=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true})})));
      await reportWindow.document.fonts?.ready;
      await wait(220);
      reportWindow.focus();
      reportWindow.print();
    }catch(error){
      reportWindow.close();
      throw error;
    }
  }

  window.buildReportHtml=buildLiveReportHtml;
  window.exportHtmlReport=exportHtmlReportLive;
  window.openPdfReport=openPdfReportLive;
  try{buildReportHtml=buildLiveReportHtml;exportHtmlReport=exportHtmlReportLive;openPdfReport=openPdfReportLive}catch(_){}
  window.BogatkaLiveReport={version:VERSION,ready:true,build:buildLiveReportHtml,prepareSource,cloneLocation};
})();
