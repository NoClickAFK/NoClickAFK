(function(){
  'use strict';
  if(window.BogatkaQuickChecklistV451?.ready)return;

  const VERSION='4.5.1';
  const STATES=[
    ['unchecked','Не проверено'],
    ['yes','Да'],
    ['no','Нет'],
    ['not_applicable','Не требуется'],
  ];
  const STATE_LABELS=Object.fromEntries(STATES);
  const ANSWERED_STATES=new Set(['yes','no','not_applicable']);
  const GUIDE_HTML='<strong>Задача чек-листа — зафиксировать результат проверки.</strong> Для каждого пункта выберите «Да», «Нет» или «Не требуется». Значение «Не проверено» оставляйте, пока факт не подтверждён. Ответ «Да» означает, что условие есть, но его качество отдельно оценивается в следующем разделе.';
  let timer=null;
  let viewerTimer=null;

  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function normalizeState(value){
    if(value===true||value===1)return'yes';
    if(value===false||value===0||value===null||value===undefined||value==='')return'unchecked';
    const text=String(value).trim().toLowerCase();
    if(['yes','true','confirmed','да','есть','подтверждено'].includes(text))return'yes';
    if(['no','нет','отсутствует','не подтверждено'].includes(text))return'no';
    if(['not_applicable','not_required','n/a','не требуется','не применимо'].includes(text))return'not_applicable';
    if(['unchecked','false','не проверено','не заполнено'].includes(text))return'unchecked';
    return'unchecked';
  }

  function stateLabel(value){
    return STATE_LABELS[normalizeState(value)]||STATE_LABELS.unchecked;
  }

  function isAnswered(value){
    return ANSWERED_STATES.has(normalizeState(value));
  }

  function isViewer(){
    try{return typeof cloudRole!=='undefined'&&cloudRole==='viewer'}catch(_){return false}
  }

  function checklistDefinitions(){
    return typeof CHECKLIST!=='undefined'&&Array.isArray(CHECKLIST)?CHECKLIST:[];
  }

  function checklistDetails(card){
    return [...card.querySelectorAll(':scope .location-body > details')].find(details=>{
      const title=details.querySelector(':scope > summary')?.textContent||'';
      return title.includes('Быстрый чек-лист');
    })||null;
  }

  function optionsMarkup(selected){
    return STATES.map(([value,label])=>`<option value="${value}"${value===selected?' selected':''}>${escapeHtml(label)}</option>`).join('');
  }

  function syncPremium(select){
    if(!select)return;
    const trigger=select.nextElementSibling?.classList.contains('premium-select-trigger')?select.nextElementSibling:null;
    if(window.BogatkaSelectSync?.syncVisibleSelect)window.BogatkaSelectSync.syncVisibleSelect(select);
    else if(trigger&&typeof bogatkaSyncPremiumSelect==='function')bogatkaSyncPremiumSelect(select,trigger);
    if(trigger){
      trigger.disabled=select.disabled;
      trigger.setAttribute('aria-disabled',String(select.disabled));
    }
  }

  function updateRow(row,state){
    if(!row)return;
    const normalized=normalizeState(state);
    row.dataset.checkState=normalized;
    row.classList.toggle('check-answered-v451',isAnswered(normalized));
    row.classList.toggle('check-unchecked-v451',normalized==='unchecked');
    row.classList.toggle('check-yes-v451',normalized==='yes');
    row.classList.toggle('check-no-v451',normalized==='no');
    row.classList.toggle('check-not-applicable-v451',normalized==='not_applicable');
  }

  function bindSelect(select){
    if(!select||select.dataset.quickChecklistBoundV451==='1')return;
    select.dataset.quickChecklistBoundV451='1';
    select.addEventListener('change',async()=>{
      const card=select.closest('[data-location-card]');
      if(!card)return;
      if(isViewer()){
        await syncCard(card);
        return;
      }
      select.value=normalizeState(select.value);
      updateRow(select.closest('.check-row'),select.value);
      updateSummary(card);
      syncPremium(select);
      if(typeof showSaving==='function')showSaving();
      try{
        if(typeof saveField!=='function')throw new Error('Не найдена функция сохранения поля.');
        await saveField(select);
        patchHistoryValues(card);
      }catch(error){
        if(typeof showError==='function')showError(error);else console.error(error);
        await syncCard(card);
      }
    });
  }

  function ensureSelect(row,state){
    let select=row.querySelector('select[data-quick-checklist-v451]');
    if(select){
      bindSelect(select);
      return select;
    }
    const checkbox=row.querySelector('input[type="checkbox"][data-field^="check."]');
    if(!checkbox)return null;
    select=document.createElement('select');
    select.className='quick-check-select-v451';
    Object.entries(checkbox.dataset).forEach(([key,value])=>select.dataset[key]=value);
    select.dataset.quickChecklistV451='1';
    select.innerHTML=optionsMarkup(normalizeState(state));
    select.value=normalizeState(state);
    select.disabled=Boolean(checkbox.disabled);
    const label=row.querySelector(':scope > span')?.textContent?.trim()||'Пункт чек-листа';
    select.setAttribute('aria-label',`${label}: результат проверки`);
    checkbox.replaceWith(select);
    bindSelect(select);
    if(typeof bogatkaEnhanceSelect==='function')bogatkaEnhanceSelect(select);
    else setTimeout(()=>{
      if(typeof bogatkaEnhanceSelect==='function')bogatkaEnhanceSelect(select);
    },40);
    return select;
  }

  function summaryFromData(data={}){
    const result={total:0,answered:0,unchecked:0,yes:0,no:0,not_applicable:0};
    for(const [key] of checklistDefinitions()){
      const state=normalizeState(data?.check?.[key]);
      result.total+=1;
      result[state]+=1;
      if(isAnswered(state))result.answered+=1;
    }
    result.percent=result.total?Math.round(result.answered/result.total*100):100;
    return result;
  }

  function ensureSummary(details){
    const body=details?.querySelector('.details-body');
    if(!body)return null;
    let summary=body.querySelector(':scope > .quick-checklist-summary-v451');
    if(!summary){
      summary=document.createElement('div');
      summary.className='quick-checklist-summary-v451';
      summary.innerHTML=`
        <div class="quick-check-main-v451"><span>Проверено</span><strong data-check-summary="answered">0 из 0</strong><small data-check-summary="percent">0%</small></div>
        <div><span>Да</span><strong data-check-summary="yes">0</strong></div>
        <div><span>Нет</span><strong data-check-summary="no">0</strong></div>
        <div><span>Не требуется</span><strong data-check-summary="not_applicable">0</strong></div>
        <div><span>Не проверено</span><strong data-check-summary="unchecked">0</strong></div>`;
      const guide=body.querySelector(':scope > .checklist-guide-v414');
      if(guide)guide.insertAdjacentElement('afterend',summary);else body.prepend(summary);
    }
    return summary;
  }

  function updateGroupProgress(details){
    details?.querySelectorAll('.check-group').forEach(group=>{
      const rows=[...group.querySelectorAll('.check-row')];
      const answered=rows.filter(row=>isAnswered(row.dataset.checkState)).length;
      const heading=group.querySelector(':scope > h4');
      if(!heading)return;
      let badge=heading.querySelector('.check-group-progress-v451');
      if(!badge){
        badge=document.createElement('span');
        badge.className='check-group-progress-v451';
        heading.appendChild(badge);
      }
      badge.textContent=`${answered}/${rows.length}`;
      badge.title=`Проверено ${answered} из ${rows.length}`;
      group.dataset.checkGroupComplete=String(rows.length>0&&answered===rows.length);
    });
  }

  function updateSummary(card,data=null){
    const details=checklistDetails(card);
    if(!details)return null;
    const rows=[...details.querySelectorAll('.check-row')];
    const result=data?summaryFromData(data):{
      total:rows.length,
      answered:rows.filter(row=>isAnswered(row.dataset.checkState)).length,
      yes:rows.filter(row=>normalizeState(row.dataset.checkState)==='yes').length,
      no:rows.filter(row=>normalizeState(row.dataset.checkState)==='no').length,
      not_applicable:rows.filter(row=>normalizeState(row.dataset.checkState)==='not_applicable').length,
      unchecked:rows.filter(row=>normalizeState(row.dataset.checkState)==='unchecked').length,
    };
    result.percent=result.total?Math.round(result.answered/result.total*100):100;
    const summary=ensureSummary(details);
    if(summary){
      const values={answered:`${result.answered} из ${result.total}`,percent:`${result.percent}%`,yes:result.yes,no:result.no,not_applicable:result.not_applicable,unchecked:result.unchecked};
      Object.entries(values).forEach(([key,value])=>{
        const node=summary.querySelector(`[data-check-summary="${key}"]`);
        if(node&&node.textContent!==String(value))node.textContent=String(value);
      });
      summary.style.setProperty('--checklist-progress-v451',`${result.percent}%`);
    }
    details.dataset.checklistAnswered=String(result.answered);
    details.dataset.checklistTotal=String(result.total);
    details.dataset.checklistComplete=String(result.total>0&&result.answered===result.total);
    updateGroupProgress(details);
    return result;
  }

  function updateGuide(details){
    const body=details?.querySelector('.details-body');
    if(!body)return;
    let guide=body.querySelector(':scope > .checklist-guide-v414');
    if(!guide){
      guide=document.createElement('div');
      guide.className='checklist-guide-v414';
      body.prepend(guide);
    }
    if(guide.innerHTML!==GUIDE_HTML)guide.innerHTML=GUIDE_HTML;
  }

  function updateHelp(){
    const item=[...document.querySelectorAll('#helpModal li')].find(node=>node.textContent.includes('Пройдите чек-лист'));
    if(item)item.textContent='Пройдите быстрый чек-лист. Для каждого пункта выберите «Да», «Нет», «Не требуется» или оставьте «Не проверено».';
  }

  function patchHistoryValues(root=document){
    const labels={yes:'Да',no:'Нет',not_applicable:'Не требуется',unchecked:'Не проверено'};
    root.querySelectorAll?.('.history-item-v400 ins,.history-item-v400 del').forEach(node=>{
      const value=node.textContent.trim();
      if(labels[value])node.textContent=labels[value];
    });
  }

  function applyViewerState(root=document){
    const viewer=isViewer();
    root.querySelectorAll?.('select[data-quick-checklist-v451]').forEach(select=>{
      if(viewer){
        if(!select.disabled)select.dataset.quickChecklistViewerDisabledV451='1';
        select.disabled=true;
      }else if(select.dataset.quickChecklistViewerDisabledV451==='1'){
        select.disabled=false;
        delete select.dataset.quickChecklistViewerDisabledV451;
      }
      syncPremium(select);
    });
  }

  async function enhanceCard(card){
    const id=card.dataset.locationCard;
    const details=checklistDetails(card);
    if(!id||!details)return false;
    details.classList.add('quick-checklist-v451');
    details.dataset.quickChecklistV451='1';
    updateGuide(details);
    const data=typeof getLocationData==='function'?await getLocationData(id):{};
    const definitions=new Map(checklistDefinitions().map(item=>[item[0],item]));
    for(const row of details.querySelectorAll('.check-row')){
      const existing=row.querySelector('[data-field^="check."]');
      const key=String(existing?.dataset.field||'').slice(6);
      if(!key)continue;
      const definition=definitions.get(key);
      if(definition)row.dataset.checkGroup=definition[2]||'';
      const state=normalizeState(data?.check?.[key]);
      const select=ensureSelect(row,state);
      if(select&&select.value!==state){
        select.value=state;
        syncPremium(select);
      }
      updateRow(row,state);
    }
    updateSummary(card,data);
    patchHistoryValues(card);
    applyViewerState(card);
    return true;
  }

  async function enhanceAll(){
    updateHelp();
    for(const card of document.querySelectorAll('[data-location-card]'))await enhanceCard(card);
    patchHistoryValues(document);
    applyViewerState(document);
    return true;
  }

  async function syncCard(card){
    if(!card)return false;
    const id=card.dataset.locationCard;
    if(!id||typeof getLocationData!=='function')return false;
    const data=await getLocationData(id);
    const details=checklistDetails(card);
    if(!details)return false;
    for(const select of details.querySelectorAll('select[data-quick-checklist-v451]')){
      const key=String(select.dataset.field||'').slice(6);
      const state=normalizeState(data?.check?.[key]);
      if(select.value!==state)select.value=state;
      updateRow(select.closest('.check-row'),state);
      syncPremium(select);
    }
    updateSummary(card,data);
    applyViewerState(card);
    return true;
  }

  function schedule(delay=80){
    clearTimeout(timer);
    timer=setTimeout(()=>enhanceAll().catch(console.error),delay);
  }

  function audit(){
    const failures=[];
    for(const card of document.querySelectorAll('[data-location-card]')){
      const details=checklistDetails(card);
      if(!details){failures.push(`${card.dataset.locationCard}:details:missing`);continue}
      const rows=[...details.querySelectorAll('.check-row')];
      if(rows.length!==checklistDefinitions().length)failures.push(`${card.dataset.locationCard}:rows:${rows.length}`);
      rows.forEach((row,index)=>{
        const checkbox=row.querySelector('input[type="checkbox"][data-field^="check."]');
        const select=row.querySelector('select[data-quick-checklist-v451]');
        if(checkbox)failures.push(`${card.dataset.locationCard}:row:${index}:legacy-checkbox`);
        if(!select)failures.push(`${card.dataset.locationCard}:row:${index}:select-missing`);
        else{
          const values=[...select.options].map(option=>option.value);
          if(values.join('|')!==STATES.map(item=>item[0]).join('|'))failures.push(`${card.dataset.locationCard}:row:${index}:options`);
          if(!STATE_LABELS[select.value])failures.push(`${card.dataset.locationCard}:row:${index}:value:${select.value}`);
        }
      });
      if(!details.querySelector('.quick-checklist-summary-v451'))failures.push(`${card.dataset.locationCard}:summary:missing`);
    }
    return{ok:failures.length===0,failures};
  }

  function install(){
    const root=document.getElementById('locations')||document.body;
    new MutationObserver(()=>schedule(100)).observe(root,{childList:true,subtree:true});
    schedule(20);
    [250,700,1500,3000].forEach(delay=>setTimeout(()=>schedule(0),delay));
    viewerTimer=setInterval(()=>applyViewerState(document),1200);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('load',()=>schedule(20),{once:true});

  window.BogatkaQuickChecklistV451={
    version:VERSION,
    ready:true,
    STATES,
    normalizeState,
    stateLabel,
    isAnswered,
    summaryFromData,
    enhanceAll,
    enhanceCard,
    syncCard,
    updateSummary,
    applyViewerState,
    audit,
    get viewerTimer(){return viewerTimer},
  };
})();
