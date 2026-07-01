(function(){
  'use strict';
  if(window.BogatkaStatusNextTaskV447?.ready)return;

  const VERSION='4.4.7';
  const STATUS_OPTIONS=[
    ['','Не выбран'],
    ['Новый объект','Новый объект'],
    ['Связались с арендодателем','Связались с арендодателем'],
    ['Осмотр запланирован','Осмотр запланирован'],
    ['Осмотрен','Осмотрен'],
    ['Собираем информацию','Собираем информацию'],
    ['Проверяем документы','Проверяем документы'],
    ['Ведём переговоры','Ведём переговоры'],
    ['Выбран','Выбран'],
  ];
  const LEGACY_STATUS_MAP={
    'Кандидат':'Новый объект',
    'Осмотрена':'Осмотрен',
    'Переговоры':'Ведём переговоры',
    'Оставить':'Выбран',
    'Исключить':'Осмотрен',
  };
  const PRIORITY_ORDER={critical:0,high:1,normal:2};
  const PRIORITY_LABELS={critical:'Критический',high:'Высокий',normal:'Обычный'};
  const TASK_STATUS_LABELS={todo:'К выполнению',doing:'В работе',waiting:'Ожидает',done:'Готово'};
  let timer=null;

  const plainObject=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const normalizeStatus=value=>LEGACY_STATUS_MAP[String(value||'')]||String(value||'');
  const setText=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};

  function normalizeData(source){
    if(!plainObject(source))return source||{};
    const previous=String(source.status||'');
    const status=normalizeStatus(previous);
    if(!previous||previous===status)return source;
    const migrations=plainObject(source.migrations)?{...source.migrations}:{};
    const next={...source,status,migrations};
    migrations.statusStageV447={from:previous,to:status};
    if(previous==='Оставить'&&!next.decision)next.decision='Оставить';
    if(previous==='Исключить'&&!next.decision)next.decision='Исключить';
    return next;
  }

  function installDataCompatibility(){
    if(window.__bogatkaStatusDataCompatV447||typeof getLocationData!=='function')return;
    window.__bogatkaStatusDataCompatV447=true;
    const base=window.getLocationData||getLocationData;
    const wrapped=async id=>normalizeData(await base(id));
    wrapped.__statusDataCompatV447=true;
    wrapped.__base=base;
    window.getLocationData=wrapped;
    try{getLocationData=wrapped}catch(_){ }
  }

  function syncPremium(select){
    if(!select)return;
    const trigger=select.nextElementSibling;
    if(!trigger?.classList.contains('premium-select-trigger'))return;
    const selectedText=select.selectedOptions?.[0]?.textContent||'';
    const valueNode=trigger.querySelector('.premium-select-value');
    if(trigger.dataset.syncedValue===select.value&&valueNode?.textContent===selectedText)return;
    if(window.BogatkaSelectSync?.syncVisibleSelect){
      window.BogatkaSelectSync.syncVisibleSelect(select);
      return;
    }
    if(typeof bogatkaSyncPremiumSelect==='function')bogatkaSyncPremiumSelect(select,trigger);
  }

  function relabelStatus(select){
    const label=select?.closest('label.field');
    if(!label)return;
    const profileCaption=label.querySelector(':scope > .profile-caption-v416');
    const statusCaption=label.querySelector(':scope > .status-caption-v447');
    let caption=profileCaption||statusCaption;
    if(profileCaption&&statusCaption&&profileCaption!==statusCaption)statusCaption.remove();
    if(!caption){
      [...label.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE&&node.textContent.trim()).forEach(node=>node.remove());
      caption=document.createElement('span');
      caption.className='status-caption-v447';
      label.prepend(caption);
    }
    setText(caption,'Статус работы с объектом');
    label.querySelector(':scope > .status-help-v447')?.remove();
  }

  function updateStatusSelect(select){
    if(!select)return;
    const current=normalizeStatus(select.value);
    const signature=STATUS_OPTIONS.map(([value,label])=>`${value}:${label}`).join('|');
    if(select.dataset.statusOptionsV447!==signature){
      const fragment=document.createDocumentFragment();
      for(const [value,label] of STATUS_OPTIONS){
        const option=document.createElement('option');
        option.value=value;
        option.textContent=label;
        fragment.append(option);
      }
      if(current&&!STATUS_OPTIONS.some(([value])=>value===current)){
        const option=document.createElement('option');
        option.value=current;
        option.textContent=`Старый статус: ${current}`;
        fragment.append(option);
      }
      select.replaceChildren(fragment);
      select.dataset.statusOptionsV447=signature;
    }
    if(select.value!==current)select.value=current;
    select.setAttribute('aria-label','Статус работы с объектом');
    relabelStatus(select);
    syncPremium(select);
  }

  function numericDate(value,suffix=''){
    if(!value)return Number.POSITIVE_INFINITY;
    const parsed=Date.parse(`${value}${suffix}`);
    return Number.isFinite(parsed)?parsed:Number.POSITIVE_INFINITY;
  }

  function pickNextTask(data={}){
    const tasks=Array.isArray(data.tasks)?data.tasks.filter(task=>task&&task.status!=='done'&&String(task.title||'').trim()):[];
    tasks.sort((left,right)=>{
      const priority=(PRIORITY_ORDER[left.priority]??PRIORITY_ORDER.normal)-(PRIORITY_ORDER[right.priority]??PRIORITY_ORDER.normal);
      if(priority)return priority;
      const due=numericDate(left.dueDate,'T23:59:59')-numericDate(right.dueDate,'T23:59:59');
      if(Number.isFinite(due)&&due)return due;
      const created=numericDate(left.createdAt)-numericDate(right.createdAt);
      if(Number.isFinite(created)&&created)return created;
      return String(left.title||'').localeCompare(String(right.title||''),'ru');
    });
    return tasks[0]||null;
  }

  function formatDueDate(value){
    if(!value)return '';
    const date=new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime())?String(value):date.toLocaleDateString('ru-RU');
  }

  function taskPresentation(data={}){
    const task=pickNextTask(data);
    if(task){
      const meta=[
        PRIORITY_LABELS[task.priority]||PRIORITY_LABELS.normal,
        TASK_STATUS_LABELS[task.status]||task.status,
        task.assignee?`Ответственный: ${task.assignee}`:'Ответственный не назначен',
        task.dueDate?`Срок: ${formatDueDate(task.dueDate)}`:'Без срока',
      ];
      return {kind:'task',title:String(task.title).trim(),meta:meta.filter(Boolean).join(' · '),priority:task.priority||'normal',task};
    }
    const legacy=String(data.nextAction||'').trim();
    if(legacy){
      const date=data.nextActionDate?` · Дата: ${formatDueDate(data.nextActionDate)}`:'';
      return {kind:'legacy',title:legacy,meta:`Ранее записанный следующий шаг${date}. Новые шаги создавайте в разделе «Задачи».`,priority:'normal',task:null};
    }
    return {kind:'empty',title:'Активных задач нет',meta:'Добавьте задачу в разделе «Совместная работа».',priority:'normal',task:null};
  }

  function openTasks(card){
    const details=card.querySelector('[data-collaboration]');
    if(!details)return;
    details.open=true;
    const tab=details.querySelector('[data-collab-tab="tasks"]');
    if(tab&&!tab.classList.contains('active'))tab.click();
    setTimeout(()=>details.scrollIntoView({behavior:'smooth',block:'start'}),40);
  }

  function ensureNextTaskPanel(card){
    const id=card.dataset.locationCard;
    const grid=card.querySelector('.inspection-grid-v416');
    if(!id||!grid)return null;
    for(const field of ['nextActionDate','nextAction']){
      const wrapper=grid.querySelector(`[data-field="${field}"]`)?.closest('label.field');
      if(wrapper){
        wrapper.hidden=true;
        wrapper.classList.add('profile-hidden-v447');
        wrapper.setAttribute('aria-hidden','true');
      }
    }
    let panel=grid.querySelector(`[data-next-task-v447="${CSS.escape(id)}"]`);
    if(panel)return panel;
    panel=document.createElement('div');
    panel.className='next-task-v447 profile-wide-v416 inspection-action-v417';
    panel.dataset.nextTaskV447=id;
    panel.innerHTML='<span class="profile-caption-v416">Следующий шаг по локации</span><div class="next-task-card-v447"><div><strong data-next-task-title-v447></strong><small data-next-task-meta-v447></small></div><button type="button" class="btn secondary small" data-open-tasks-v447>Открыть задачи</button></div>';
    const undo=grid.querySelector('.inspection-note-v416');
    grid.insertBefore(panel,undo||null);
    panel.querySelector('[data-open-tasks-v447]')?.addEventListener('click',()=>openTasks(card));
    return panel;
  }

  async function renderNextTask(card){
    const id=card.dataset.locationCard;
    const panel=ensureNextTaskPanel(card);
    if(!id||!panel)return;
    const presentation=taskPresentation(await getLocationData(id));
    panel.dataset.nextTaskKind=presentation.kind;
    panel.dataset.nextTaskPriority=presentation.priority;
    setText(panel.querySelector('[data-next-task-title-v447]'),presentation.title);
    setText(panel.querySelector('[data-next-task-meta-v447]'),presentation.meta);
  }

  async function refreshSummaryStageMetrics(){
    let newObjects=0,negotiations=0,selected=0,excluded=0;
    for(const item of locations||[]){
      if(item.archivedAt)continue;
      const data=await getLocationData(item.id);
      if(data.archivedAt)continue;
      if(data.status==='Новый объект')newObjects+=1;
      if(data.status==='Ведём переговоры')negotiations+=1;
      if(data.decision==='Оставить')selected+=1;
      if(data.decision==='Исключить')excluded+=1;
    }
    const values={candidateCount:newObjects,negotiationCount:negotiations,keepCount:selected,excludedCount:excluded};
    for(const [id,value] of Object.entries(values))setText(document.getElementById(id),String(value));
    const labels={candidateCount:'новых объектов',negotiationCount:'переговоры',keepCount:'оставить',excludedCount:'исключить'};
    for(const [id,label] of Object.entries(labels))setText(document.getElementById(id)?.closest('.metric')?.querySelector('span'),label);
  }

  function markReportBuilder(){
    const builder=window.BogatkaLiveReport?.build;
    if(typeof builder!=='function')return;
    builder.__statusNextTaskV447=true;
  }

  async function enhanceCard(card){
    updateStatusSelect(card.querySelector('select[data-field="status"]'));
    setText(card.querySelector('.inspection-card-v416 .profile-section-head-v416 span'),'Текущий этап работы, формат, состояние помещения и следующий шаг.');
    await renderNextTask(card);
  }

  async function enhanceAll(){
    markReportBuilder();
    installUpdateSummaryWrapper();
    for(const card of document.querySelectorAll('[data-location-card]'))await enhanceCard(card);
    await refreshSummaryStageMetrics();
  }

  function installUpdateSummaryWrapper(){
    if(typeof window.updateSummary!=='function'&&typeof updateSummary!=='function')return;
    const current=window.updateSummary||updateSummary;
    if(current.__statusNextTaskV447)return;
    const wrapped=async function(...args){
      const result=await current(...args);
      await enhanceAll();
      return result;
    };
    wrapped.__statusNextTaskV447=true;
    wrapped.__base=current;
    window.updateSummary=wrapped;
    try{updateSummary=wrapped}catch(_){ }
  }

  function schedule(delay=50){
    clearTimeout(timer);
    timer=setTimeout(()=>enhanceAll().catch(console.error),delay);
  }

  function install(){
    installDataCompatibility();
    installUpdateSummaryWrapper();
    markReportBuilder();
    const root=document.getElementById('locations')||document.body;
    new MutationObserver(()=>schedule(80)).observe(root,{childList:true,subtree:true});
    schedule(20);
    [150,500,1200,2500,4000,7000].forEach(delay=>setTimeout(()=>{
      installDataCompatibility();
      installUpdateSummaryWrapper();
      markReportBuilder();
      schedule(20);
    },delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('load',()=>schedule(40),{once:true});

  window.BogatkaStatusNextTaskV447={
    version:VERSION,
    ready:true,
    STATUS_OPTIONS,
    LEGACY_STATUS_MAP,
    normalizeStatus,
    normalizeData,
    pickNextTask,
    taskPresentation,
    enhanceAll,
  };
})();
