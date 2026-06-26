(function(){
  if(window.BogatkaWorkflowV414?.ready)return;

  const VERSION='4.1.4';
  const HISTORY_PAGE_SIZE=10;
  const historyPages=new Map();
  let memberOptions=[];
  let memberLoadPromise=null;
  let enhanceTimer=null;

  const SCORE_GUIDANCE={
    housing:{label:'Плотность и близость жилой застройки',low:'1 — жилья рядом мало или оно далеко',high:'5 — плотный жилой массив непосредственно вокруг точки'},
    occupied:{label:'Фактическая заселённость района',low:'1 — много пустующих или строящихся домов',high:'5 — дома давно и плотно заселены'},
    foot:{label:'Сила целевого пешеходного потока',low:'1 — редкий или случайный поток',high:'5 — стабильный поток потенциальных покупателей'},
    car:{label:'Сила автомобильного потока и доступность',low:'1 — поток слабый или неудобный заезд',high:'5 — высокий поток и простой подъезд'},
    parking:{label:'Удобство и доступность парковки',low:'1 — парковки фактически нет',high:'5 — места есть и обычно доступны рядом со входом'},
    stop:{label:'Доступность общественного транспорта',low:'1 — остановка далеко или неудобна',high:'5 — остановка рядом и обслуживает нужный поток'},
    anchor:{label:'Сила соседнего покупательского якоря',low:'1 — якоря нет или он не создаёт поток',high:'5 — сильный ежедневный якорь рядом'},
    visibility:{label:'Заметность входа и фасада',low:'1 — вход трудно найти',high:'5 — вход и фасад хорошо видны с основных направлений'},
    sign:{label:'Потенциал заметной вывески',low:'1 — вывеска невозможна или почти незаметна',high:'5 — есть крупное и хорошо видимое место'},
    loading:{label:'Удобство приёмки и разгрузки товара',low:'1 — тяжёлый товар переносить далеко и неудобно',high:'5 — короткая и безопасная разгрузка'},
    condition:{label:'Готовность помещения к запуску',low:'1 — требуется капитальная подготовка',high:'5 — помещение почти готово к работе'},
    storage:{label:'Качество складской и подсобной зоны',low:'1 — склад отсутствует или непригоден',high:'5 — склад достаточный, сухой и удобный'},
    competition:{label:'Конкурентное преимущество локации',low:'1 — сильные конкуренты и нет явного преимущества',high:'5 — конкуренты слабее или есть незакрытая потребность'},
    overall:{label:'Общая коммерческая привлекательность',low:'1 — точка в целом неубедительна',high:'5 — сильная точка с понятным потенциалом'},
  };

  const FIELD_LABELS={
    status:'Статус',objectType:'Тип объекта',date:'Дата осмотра',time:'Время осмотра',rent:'Аренда и условия',contact:'Контакт',decision:'Предварительное решение',
    pros:'Главные плюсы',cons:'Главные минусы',risks:'Риски и подводные камни',questions:'Что уточнить у арендодателя',formatIdea:'Идея формата магазина',notes:'Дополнительные заметки',
    'score.housing':'Плотность и близость жилой застройки','score.occupied':'Фактическая заселённость района','score.foot':'Сила целевого пешеходного потока','score.car':'Сила автомобильного потока и доступность','score.parking':'Удобство и доступность парковки','score.stop':'Доступность общественного транспорта','score.anchor':'Сила соседнего покупательского якоря','score.visibility':'Заметность входа и фасада','score.sign':'Потенциал заметной вывески','score.loading':'Удобство разгрузки товара','score.condition':'Готовность помещения к запуску','score.storage':'Качество складской зоны','score.competition':'Конкурентное преимущество локации','score.overall':'Общая коммерческая привлекательность',
  };

  const NOTE_FIELDS=[
    ['pros','Главные плюсы','Что реально усиливает локацию: поток, район, помещение, условия.'],
    ['cons','Главные минусы','Что снижает привлекательность и потребует компромисса.'],
    ['risks','Риски / подводные камни','Что может сорвать запуск, увеличить бюджет или сроки.'],
    ['questions','Что уточнить у арендодателя','Вопросы по договору, платежам, ремонту, режиму и ограничениям.'],
    ['formatIdea','Идея формата магазина','Какой формат и ассортимент лучше подходят именно этой точке.'],
    ['notes','Дополнительные заметки','Любая важная информация, которая не вошла в остальные поля.'],
  ];

  const TASK_EXAMPLES={
    normal:['Уточнить размер коммунальных платежей','Запросить план помещения с размерами'],
    high:['Согласовать арендные каникулы','Проверить выделенную электрическую мощность'],
    critical:['Получить письменное подтверждение назначения помещения','Устранить критический стоп-фактор до решения'],
  };

  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function locationId(card){return card?.dataset.locationCard||''}

  function detailsByTitle(card,text){
    return [...card.querySelectorAll(':scope .location-body > details')].find(details=>details.querySelector(':scope > summary')?.textContent.includes(text));
  }

  function scoreKeyFromSelect(select){return String(select?.dataset.field||'').replace(/^score\./,'')}

  function enhanceScore(card){
    const details=detailsByTitle(card,'70-балльной');
    const body=details?.querySelector('.details-body');
    const table=body?.querySelector('.score-table');
    if(!body||!table)return;

    const oldGuide=body.querySelector('.score-guide-v331');
    if(oldGuide&&!oldGuide.classList.contains('score-guide-v414')){
      oldGuide.classList.add('score-guide-v414');
      oldGuide.innerHTML=`<div class="score-guide-title">Зачем нужна оценка после чек-листа</div><p><b>Чек-лист</b> фиксирует, что условие проверено и присутствует. <b>Оценка</b> показывает, насколько это условие сильное по сравнению с другими локациями. Пример: парковка есть — галочка в чек-листе; парковка маленькая и занята — оценка 2.</p><div class="score-scale-v331"><span><b>1</b> критически слабо</span><span><b>2</b> ниже нормы</span><span><b>3</b> приемлемо</span><span><b>4</b> сильный показатель</span><span><b>5</b> явное преимущество</span></div><div class="score-guide-note-v331"><b>Правило:</b> ставьте балл только после проверки факта. Пустое значение означает «ещё не оценено», а не ноль.</div>`;
    }

    table.querySelectorAll('tbody tr').forEach(row=>{
      const select=row.querySelector('select[data-field^="score."]');
      const key=scoreKeyFromSelect(select);
      const guide=SCORE_GUIDANCE[key];
      const cell=row.querySelector('td:first-child');
      if(!guide||!cell)return;
      cell.innerHTML=`<div class="score-label-v414"><strong>${esc(guide.label)}</strong><small><span>${esc(guide.low)}</span><span>${esc(guide.high)}</span></small></div>`;
    });
  }

  function moveEconomyAndLaunch(card){
    const decision=card.querySelector('.decision-panel-v412,.decision');
    const economy=card.querySelector('.economy-v400');
    const launch=card.querySelector('.launch-project-v400');
    if(!decision)return;
    if(economy&&decision.nextElementSibling!==economy)decision.insertAdjacentElement('afterend',economy);
    if(launch){
      const anchor=economy||decision;
      if(anchor.nextElementSibling!==launch)anchor.insertAdjacentElement('afterend',launch);
    }
  }

  async function loadMembers(){
    if(memberLoadPromise)return memberLoadPromise;
    memberLoadPromise=(async()=>{
      const fallback=[];
      try{
        if(typeof bogatkaFetchMembers==='function'&&typeof cloudProjectId!=='undefined'&&cloudProjectId){
          const rows=await bogatkaFetchMembers();
          return (rows||[]).map(row=>({value:row.profile?.display_name||row.profile?.email||'',label:row.profile?.display_name?`${row.profile.display_name}${row.profile.email?` · ${row.profile.email}`:''}`:(row.profile?.email||'Участник')})).filter(item=>item.value);
        }
      }catch(error){console.warn('Не удалось загрузить участников для задач',error)}
      const current=typeof cloudSession!=='undefined'?cloudSession?.user:null;
      if(current?.email)fallback.push({value:current.user_metadata?.display_name||current.email,label:current.user_metadata?.display_name?`${current.user_metadata.display_name} · ${current.email}`:current.email});
      return fallback;
    })().then(rows=>{memberOptions=rows;return rows}).finally(()=>{memberLoadPromise=null});
    return memberLoadPromise;
  }

  function memberOptionsMarkup(selected=''){
    const options=['<option value="">Не назначен</option>'];
    for(const item of memberOptions){
      options.push(`<option value="${esc(item.value)}"${item.value===selected?' selected':''}>${esc(item.label)}</option>`);
    }
    return options.join('');
  }

  function taskExamplesMarkup(){
    return `<details class="task-examples-v414"><summary>Примеры задач</summary><div>${Object.entries(TASK_EXAMPLES).map(([priority,items])=>`<section><strong>${priority==='normal'?'Обычные':priority==='high'?'Высокий приоритет':'Критические'}</strong>${items.map(title=>`<button type="button" data-task-example-title="${esc(title)}" data-task-example-priority="${priority}">${esc(title)}</button>`).join('')}</section>`).join('')}</div></details>`;
  }

  async function enhanceTaskForm(card){
    const id=locationId(card);
    const form=card.querySelector(`[data-task-form="${CSS.escape(id)}"]`);
    if(!form||form.dataset.workflowV414==='1')return;
    form.dataset.workflowV414='1';
    await loadMembers();

    const title=form.querySelector('[name="title"]');
    const assignee=form.querySelector('[name="assignee"]');
    const dueDate=form.querySelector('[name="dueDate"]');
    const priority=form.querySelector('[name="priority"]');
    const submit=form.querySelector('button[type="submit"]');
    if(!title||!assignee||!dueDate||!priority||!submit)return;

    title.placeholder='Например: запросить проект договора аренды';
    title.classList.add('task-title-v414');
    const assigneeSelect=document.createElement('select');
    assigneeSelect.name='assignee';
    assigneeSelect.className='task-assignee-v414';
    assigneeSelect.innerHTML=memberOptionsMarkup(assignee.value||'');
    assignee.replaceWith(assigneeSelect);
    dueDate.setAttribute('aria-label','Срок выполнения');
    submit.textContent='Добавить';
    submit.classList.add('task-submit-v414');

    if(!form.previousElementSibling?.classList.contains('task-form-help-v414')){
      const help=document.createElement('div');
      help.className='task-form-help-v414';
      help.innerHTML='<strong>Новая задача</strong><span>Опишите конкретный результат, назначьте участника, срок и приоритет. После создания задачу можно перевести в работу, ожидание или завершить.</span>';
      form.insertAdjacentElement('beforebegin',help);
    }
    form.insertAdjacentHTML('afterend',taskExamplesMarkup());
    form.nextElementSibling?.querySelectorAll('[data-task-example-title]').forEach(button=>button.addEventListener('click',()=>{
      title.value=button.dataset.taskExampleTitle||'';
      priority.value=button.dataset.taskExamplePriority||'normal';
      priority.dispatchEvent(new Event('change',{bubbles:true}));
      title.focus();
    }));
  }

  function structuredNotesMarkup(id){
    return `<div class="structured-notes-v414"><div class="structured-notes-head-v414"><strong>Выводы и рабочие заметки</strong><span>Структурированные поля сохраняются в карточке локации и попадают в сравнение и отчёт.</span></div>${NOTE_FIELDS.map(([field,label,placeholder])=>`<label class="structured-note-v414"><span>${esc(label)}</span><textarea data-location="${esc(id)}" data-field="${field}" placeholder="${esc(placeholder)}"></textarea></label>`).join('')}</div>`;
  }

  function moveNotesToComments(card){
    const id=locationId(card);
    const pane=card.querySelector('[data-collab-pane="comments"]');
    const notes=card.querySelector('.notes-grid');
    if(!pane||!notes)return;
    if(!pane.querySelector('.structured-notes-v414'))pane.insertAdjacentHTML('afterbegin',structuredNotesMarkup(id));
    const structured=pane.querySelector('.structured-notes-v414');
    NOTE_FIELDS.forEach(([field])=>{
      const original=notes.querySelector(`[data-field="${field}"]`);
      const target=structured.querySelector(`[data-field="${field}"]`);
      if(original&&target){
        target.value=original.value;
        original.replaceWith(target);
      }
    });
    notes.remove();

    structured.querySelectorAll('textarea[data-location][data-field]').forEach(textarea=>{
      if(textarea.dataset.boundV414==='1')return;
      textarea.dataset.boundV414='1';
      textarea.addEventListener('input',()=>{
        showSaving();
        clearTimeout(textarea._saveTimer);
        textarea._saveTimer=setTimeout(()=>saveField(textarea).catch(showError),250);
      });
    });

    const commentForm=pane.querySelector(`[data-comment-form="${CSS.escape(id)}"]`);
    if(commentForm&&!commentForm.previousElementSibling?.classList.contains('project-comments-title-v414')){
      const title=document.createElement('div');
      title.className='project-comments-title-v414';
      title.innerHTML='<strong>Комментарии участников</strong><span>Для обсуждения, уточнений и сообщений, которые должны видеть остальные участники проекта.</span>';
      commentForm.insertAdjacentElement('beforebegin',title);
    }
    const commentText=commentForm?.querySelector('textarea[name="text"]');
    const commentButton=commentForm?.querySelector('button');
    if(commentText)commentText.placeholder='Напишите комментарий участникам проекта';
    if(commentButton)commentButton.textContent='Добавить';
  }

  function readableHistoryLabel(entry){
    const field=String(entry.field||'');
    if(FIELD_LABELS[field])return FIELD_LABELS[field];
    if(field.startsWith('score.'))return SCORE_GUIDANCE[field.slice(6)]?.label||'Оценка локации';
    if(field.startsWith('check.')){
      const key=field.slice(6);
      const checklist=(window.CHECKLIST||[]).find(item=>item[0]===key);
      return checklist?.[1]||'Пункт быстрого чек-листа';
    }
    if(field.startsWith('traffic.')){
      const key=field.slice(8);
      const traffic=(window.TRAFFIC_FIELDS||[]).find(item=>item[0]===key);
      return traffic?.[1]||'Полевой замер трафика';
    }
    if(field.startsWith('tech.')){
      const key=field.slice(5);
      const tech=(window.TECH_FIELDS||[]).find(item=>item[0]===key);
      return tech?.[1]||'Технический параметр';
    }
    return entry.label&&entry.label!==field?entry.label:(field||'Изменение');
  }

  function activityValue(value){
    if(value===true||value==='true')return 'Да';
    if(value===false||value==='false')return 'Нет';
    if(value==='')return 'Не заполнено';
    return String(value??'');
  }

  function historyItem(entry){
    const label=readableHistoryLabel(entry);
    const action=entry.action==='Изменено поле'?'Изменено':(entry.action||'Изменение');
    const from=activityValue(entry.from),to=activityValue(entry.to);
    return `<article class="history-item-v400"><span class="history-dot-v400"></span><div><strong>${esc(action)} · ${esc(label)}</strong><small>${esc(entry.actor||entry.actorEmail||'Участник')} · ${esc(new Date(entry.at).toLocaleString('ru-RU'))}</small>${entry.from||entry.to?`<p>${entry.from?`<del>${esc(from)}</del>`:''}${entry.to?`<ins>${esc(to)}</ins>`:''}</p>`:entry.details?`<p>${esc(entry.details)}</p>`:''}</div></article>`;
  }

  function renderHistoryPagination(card,data){
    const id=locationId(card);
    const list=card.querySelector(`[data-history-list="${CSS.escape(id)}"]`);
    const count=card.querySelector(`[data-history-count="${CSS.escape(id)}"]`);
    if(!list)return;
    const activity=Array.isArray(data.activity)?[...data.activity].reverse():[];
    if(count)count.textContent=activity.length;
    const pages=Math.max(1,Math.ceil(activity.length/HISTORY_PAGE_SIZE));
    const page=Math.min(historyPages.get(id)||1,pages);
    historyPages.set(id,page);
    const start=(page-1)*HISTORY_PAGE_SIZE;
    const items=activity.slice(start,start+HISTORY_PAGE_SIZE);
    list.innerHTML=items.length?items.map(historyItem).join(''):'<p class="empty-state-v400">История появится после первого изменения.</p>';
    if(activity.length>HISTORY_PAGE_SIZE){
      const pager=document.createElement('nav');
      pager.className='history-pagination-v414';
      pager.setAttribute('aria-label','Страницы истории');
      pager.innerHTML=`<button type="button" data-history-prev ${page<=1?'disabled':''}>Назад</button><span>Страница ${page} из ${pages}</span><button type="button" data-history-next ${page>=pages?'disabled':''}>Далее</button>`;
      list.appendChild(pager);
      pager.querySelector('[data-history-prev]')?.addEventListener('click',()=>{historyPages.set(id,page-1);renderHistoryPagination(card,data)});
      pager.querySelector('[data-history-next]')?.addEventListener('click',()=>{historyPages.set(id,page+1);renderHistoryPagination(card,data)});
    }
  }

  async function refreshCard(card){
    const id=locationId(card);
    if(!id)return;
    enhanceScore(card);
    moveNotesToComments(card);
    moveEconomyAndLaunch(card);
    await enhanceTaskForm(card);
    const data=await getLocationData(id);
    renderHistoryPagination(card,data);
  }

  async function enhanceAll(){
    for(const card of document.querySelectorAll('[data-location-card]'))await refreshCard(card);
  }

  function scheduleEnhance(delay=70){
    clearTimeout(enhanceTimer);
    enhanceTimer=setTimeout(()=>enhanceAll().catch(console.error),delay);
  }

  const observer=new MutationObserver(()=>scheduleEnhance(80));
  function install(){
    const root=document.getElementById('locations');
    if(root)observer.observe(root,{childList:true,subtree:true});
    scheduleEnhance(50);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('load',()=>scheduleEnhance(120),{once:true});
  window.BogatkaWorkflowV414={version:VERSION,ready:true,enhanceAll,refreshCard,SCORE_GUIDANCE,FIELD_LABELS,HISTORY_PAGE_SIZE};
})();
