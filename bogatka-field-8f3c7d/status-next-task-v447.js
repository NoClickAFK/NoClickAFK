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
  let reportAttempts=0;

  const normalizeStatus=value=>LEGACY_STATUS_MAP[String(value||'')]||String(value||'');
  const plainObject=value=>value&&typeof value==='object'&&!Array.isArray(value);

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
    const wrapped=async function statusCompatibleGetLocationData(id){
      return normalizeData(await base(id));
    };
    wrapped.__statusDataCompatV447=true;
    wrapped.__base=base;
    window.getLocationData=wrapped;
    try{getLocationData=wrapped}catch(_){ }
  }

  function syncPremium(select){
    if(!select)return;
    if(window.BogatkaSelectSync?.syncVisibleSelect){
      window.BogatkaSelectSync.syncVisibleSelect(select);
      return;
    }
    const trigger=select.nextElementSibling;
    if(trigger?.classList.contains('premium-select-trigger')&&typeof bogatkaSyncPremiumSelect==='function'){
      bogatkaSyncPremiumSelect(select,trigger);
    }
  }

  function relabelStatus(select){
    const label=select?.closest('label.field');
    if(!label)return;
    let caption=label.querySelector(':scope > .profile-caption-v416,:scope > .status-caption-v447');
    if(!caption){
      [...label.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE&&node.textContent.trim()).forEach(node=>node.remove());
      caption=document.createElement('span');
      caption.className='status-caption-v447';
      label.prepend(caption);
    }
    caption.textContent='Статус работы с объектом';
    let help=label.querySelector(':scope > .status-help-v447');
    if(!help){
      help=document.createElement('small');
      help.className='status-help-v447';
      help.textContent='Показывает, на каком этапе сейчас находится работа с этой локацией.';
      label.append(help);
    }
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

  function taskDueValue(task){
    if(!task?.dueDate)return Number.POSITIVE_INFINITY;
    const value=Date.parse(`${task.dueDate}T23:59:59`);
    return Number.isFinite(value)?value:Number.POSITIVE_INFINITY;
  }

  function taskCreatedValue(task){
    const value=Date.parse(task?.createdAt||'');
    return Number.isFinite(value)?value:Number.POSITIVE_INFINITY;
  }

  function pickNextTask(data={}){
    const tasks=Array.isArray(data.tasks)?data.tasks.filter(task=>task&&task.status!=='done'&&String(task.title||'').trim()):[];
    tasks.sort((left,right)=>{
      const priority=(PRIORITY_ORDER[left.priority]??PRIORITY_ORDER.normal)-(PRIORITY_ORDER[right.priority]??PRIORITY_ORDER.normal);
      if(priority)return priority;
      const due=taskDueValue(left)-taskDueValue(right);
      if(Number.isFinite(due)&&due)return due;
      const created=taskCreatedValue(left)-taskCreatedValue(right);
      if(Number.isFinite(created)&&created)return created;
      return String(left.title||'').localeCompare(String(right.title||''),'ru');
    });
    return tasks[0]||null;
  }

  function formatDueDate(value){
    if(!value)return '';
    const date=new Date(`${value}T12:00:00`);
    if(Number.isNaN(date.getTime()))return String(value);
    return date.toLocaleDateString('ru-RU');
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
      const control=grid.querySelector(`[data-field="${field}"]`);
      const wrapper=control?.closest('label.field');
      if(wrapper){
        wrapper.hidden=true;
        wrapper.classList.add('profile-hidden-v447');
        wrapper.setAttribute('aria-hidden','true');
      }
    }
    let panel=grid.querySelector(`[data-next-task-v447="${CSS.escape(id)}"]`);
    if(!panel){
      panel=document.createElement('div');
      panel.className='next-task-v447 profile-wide-v416 inspection-action-v417';
      panel.dataset.nextTaskV447=id;
      panel.innerHTML='<span class="profile-caption-v416">Следующий шаг по локации</span><div class="next-task-card-v447"><div><strong data-next-task-title-v447></strong><small data-next-task-meta-v447></small></div><button type="button" class="btn secondary small" data-open-tasks-v447>Открыть задачи</button></div>';
      const undo=grid.querySelector('.inspection-note-v416');
      grid.insertBefore(panel,undo||null);
      panel.querySelector('[data-open-tasks-v447]')?.addEventListener('click',()=>openTasks(card));
    }
    return panel;
  }

  async function renderNextTask(card){
    const id=card.dataset.locationCard;
    const panel=ensureNextTaskPanel(card);
    if(!id||!panel)return;
    const presentation=taskPresentation(await getLocationData(id));
    panel.dataset.nextTaskKind=presentation.kind;
    panel.dataset.nextTaskPriority=presentation.priority;
    const title=panel.querySelector('[data-next-task-title-v447]');
    const meta=panel.querySelector('[data-next-task-meta-v447]');
    if(title)title.textContent=presentation.title;
    if(meta)meta.textContent=presentation.meta;
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
    for(const [id,value] of Object.entries(values)){
      const target=document.getElementById(id);
      if(target)target.textContent=String(value);
    }
    const labels={candidateCount:'новых объектов',negotiationCount:'переговоры',keepCount:'оставить',excludedCount:'исключить'};
    for(const [id,label] of Object.entries(labels)){
      const caption=document.getElementById(id)?.closest('.metric')?.querySelector('span');
      if(caption)caption.textContent=label;
    }
  }

  async function enhanceCard(card){
    updateStatusSelect(card.querySelector('select[data-field="status"]'));
    const subtitle=card.querySelector('.inspection-card-v416 .profile-section-head-v416 span');
    if(subtitle)subtitle.textContent='Текущий этап работы, формат, состояние помещения и следующий шаг.';
    await renderNextTask(card);
  }

  async function enhanceAll(){
    for(const card of document.querySelectorAll('[data-location-card]'))await enhanceCard(card);
    await refreshSummaryStageMetrics();
  }

  function replaceReportValue(cell,value){
    if(!cell)return;
    const label=cell.querySelector('b,strong');
    if(!label)return;
    cell.replaceChildren(label,document.createTextNode(` ${value||'—'}`));
  }

  function reportCell(section,label){
    return [...section.querySelectorAll('div')].find(cell=>{
      const strong=cell.querySelector(':scope > b,:scope > strong');
      return strong?.textContent.trim().replace(/:$/,'')===label;
    });
  }

  function installReportWrapper(){
    reportAttempts+=1;
    if(typeof window.buildReportHtml!=='function'){
      if(reportAttempts<100)setTimeout(installReportWrapper,200);
      return;
    }
    if(window.buildReportHtml.__statusNextTaskV447)return;
    const base=window.buildReportHtml;
    const wrapped=async function(...args){
      const html=await base(...args);
      const documentReport=new DOMParser().parseFromString(html,'text/html');
      const sections=[...documentReport.querySelectorAll('[data-location-card],.report-location')];
      for(let index=0;index<sections.length;index++){
        const section=sections[index];
        const id=section.dataset.locationCard||section.dataset.locationId||locations[index]?.id;
        if(!id)continue;
        const data=await getLocationData(id);
        replaceReportValue(reportCell(section,'Статус'),data.status);
        const presentation=taskPresentation(data);
        let next=reportCell(section,'Следующий шаг');
        if(!next){
          const grid=section.querySelector('.report-inspection-grid-v417,.report-summary-grid');
          if(grid){
            next=documentReport.createElement('div');
            const strong=documentReport.createElement('b');
            strong.textContent='Следующий шаг:';
            next.append(strong);
            grid.append(next);
          }
        }
        replaceReportValue(next,`${presentation.title}${presentation.kind==='task'&&presentation.meta?` — ${presentation.meta}`:''}`);
      }
      if(!documentReport.querySelector('#statusNextTaskStyleV447')){
        const style=documentReport.createElement('style');
        style.id='statusNextTaskStyleV447';
        style.textContent='.report-next-task-v447{grid-column:1/-1}';
        documentReport.head.append(style);
      }
      return `<!doctype html>\n${documentReport.documentElement.outerHTML}`;
    };
    wrapped.__statusNextTaskV447=true;
    wrapped.__base=base;
    window.buildReportHtml=wrapped;
    try{buildReportHtml=wrapped}catch(_){ }
  }

  function installUpdateSummaryWrapper(){
    if(window.__bogatkaUpdateSummaryStatusV447||typeof updateSummary!=='function')return;
    window.__bogatkaUpdateSummaryStatusV447=true;
    const base=window.updateSummary||updateSummary;
    const wrapped=async function statusNextTaskUpdateSummary(...args){
      const result=await base(...args);
      await enhanceAll();
      return result;
    };
    wrapped.__statusNextTaskV447=true;
    wrapped.__base=base;
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
    installReportWrapper();
    const root=document.getElementById('locations')||document.body;
    new MutationObserver(()=>schedule(80)).observe(root,{childList:true,subtree:true});
    schedule(20);
    [150,500,1200,2500].forEach(delay=>setTimeout(()=>{
      installDataCompatibility();
      installUpdateSummaryWrapper();
      installReportWrapper();
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
