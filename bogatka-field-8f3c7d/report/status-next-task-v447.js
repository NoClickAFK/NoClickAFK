(function(){
  'use strict';
  if(window.__bogatkaReportStatusNextTaskV447)return;
  window.__bogatkaReportStatusNextTaskV447=true;

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

  const normalizeStatus=value=>LEGACY_STATUS_MAP[String(value||'')]||String(value||'');
  const dueValue=task=>{
    if(!task?.dueDate)return Number.POSITIVE_INFINITY;
    const value=Date.parse(`${task.dueDate}T23:59:59`);
    return Number.isFinite(value)?value:Number.POSITIVE_INFINITY;
  };
  const createdValue=task=>{
    const value=Date.parse(task?.createdAt||'');
    return Number.isFinite(value)?value:Number.POSITIVE_INFINITY;
  };

  function pickNextTask(data={}){
    const tasks=Array.isArray(data.tasks)?data.tasks.filter(task=>task&&task.status!=='done'&&String(task.title||'').trim()):[];
    tasks.sort((left,right)=>{
      const priority=(PRIORITY_ORDER[left.priority]??PRIORITY_ORDER.normal)-(PRIORITY_ORDER[right.priority]??PRIORITY_ORDER.normal);
      if(priority)return priority;
      const due=dueValue(left)-dueValue(right);
      if(Number.isFinite(due)&&due)return due;
      const created=createdValue(left)-createdValue(right);
      if(Number.isFinite(created)&&created)return created;
      return String(left.title||'').localeCompare(String(right.title||''),'ru');
    });
    return tasks[0]||null;
  }

  function formatDate(value){
    if(!value)return '';
    const date=new Date(`${value}T12:00:00`);
    if(Number.isNaN(date.getTime()))return String(value);
    return date.toLocaleDateString('ru-RU');
  }

  function nextStep(data={}){
    const task=pickNextTask(data);
    if(task){
      const meta=[
        PRIORITY_LABELS[task.priority]||PRIORITY_LABELS.normal,
        TASK_STATUS_LABELS[task.status]||task.status,
        task.assignee?`Ответственный: ${task.assignee}`:'Ответственный не назначен',
        task.dueDate?`Срок: ${formatDate(task.dueDate)}`:'Без срока',
      ].filter(Boolean).join(' · ');
      return `${String(task.title).trim()} — ${meta}`;
    }
    const legacy=String(data.nextAction||'').trim();
    if(legacy)return `${legacy}${data.nextActionDate?` — дата: ${formatDate(data.nextActionDate)}`:''}`;
    return 'Активных задач нет';
  }

  function replaceSummaryValue(article,label,value){
    const cells=[...article.querySelectorAll('.summary-grid > div')];
    const cell=cells.find(item=>item.querySelector(':scope > b')?.textContent.trim().replace(/:$/,'')===label);
    if(!cell)return null;
    const strong=cell.querySelector(':scope > b');
    cell.replaceChildren(strong,document.createTextNode(` ${value||'—'}`));
    return cell;
  }

  function addNextStep(article,data){
    const summary=article.querySelector('.location-body > .summary-grid');
    if(!summary)return;
    let cell=summary.querySelector('[data-report-next-task-v447]');
    if(!cell){
      cell=document.createElement('div');
      cell.dataset.reportNextTaskV447='1';
      const strong=document.createElement('b');
      strong.textContent='Следующий шаг:';
      cell.append(strong);
      const statusCell=[...summary.children].find(item=>item.querySelector(':scope > b')?.textContent.trim()==='Статус:');
      if(statusCell)statusCell.insertAdjacentElement('afterend',cell);else summary.append(cell);
    }
    const strong=cell.querySelector(':scope > b');
    cell.replaceChildren(strong,document.createTextNode(` ${nextStep(data)}`));
  }

  function enhance(payload){
    const snapshot=payload?.snapshot||{};
    const locations=(Array.isArray(snapshot.locations)?snapshot.locations:[]).filter(location=>!location.form_data?.archivedAt);
    const articles=[...document.querySelectorAll('#reportRoot article.location')];
    articles.forEach((article,index)=>{
      const location=locations[index];
      if(!location)return;
      const data=location.form_data||{};
      replaceSummaryValue(article,'Статус',normalizeStatus(data.status||location.status));
      addNextStep(article,data);
    });

    document.querySelectorAll('#reportRoot .comparison tbody tr').forEach(row=>{
      const cell=row.children[6];
      if(cell)cell.textContent=normalizeStatus(cell.textContent.trim())||'—';
    });
  }

  const base=window.renderReport;
  if(typeof base!=='function')return;
  const wrapped=function(payload){
    const result=base(payload);
    enhance(payload);
    return result;
  };
  window.renderReport=wrapped;
  try{renderReport=wrapped}catch(_){ }
})();
