(function(){
  'use strict';
  if(window.BogatkaLocationEvaluationRefineV446?.ready)return;

  const VERSION='4.4.6';
  const SCORE_GUIDANCE={
    housing:{label:'Плотность жилой застройки',low:'1 — жилья рядом мало или оно далеко',high:'5 — плотный жилой массив непосредственно вокруг точки'},
    occupied:{label:'Фактическая заселённость района',low:'1 — много пустующих или строящихся домов',high:'5 — дома давно и плотно заселены'},
    foot:{label:'Интенсивность пешеходного потока',low:'1 — редкий или случайный поток',high:'5 — стабильный поток потенциальных покупателей'},
    car:{label:'Удобство автомобильного подъезда',low:'1 — подъезд неудобный или ограниченный',high:'5 — простой и удобный подъезд с основных направлений'},
    stop:{label:'Доступность общественного транспорта',low:'1 — остановка далеко или неудобна',high:'5 — остановка рядом и обслуживает нужный поток'},
    anchor:{label:'Поток от соседних объектов',low:'1 — соседние объекты почти не создают поток',high:'5 — рядом есть объекты с устойчивым ежедневным потоком'},
    parking:{label:'Удобство парковки',low:'1 — парковки фактически нет',high:'5 — места есть и обычно доступны рядом со входом'},
    visibility:{label:'Заметность входа и фасада',low:'1 — вход трудно найти',high:'5 — вход и фасад хорошо видны с основных направлений'},
    sign:{label:'Видимость будущей вывески',low:'1 — место для вывески почти незаметно',high:'5 — есть крупное и хорошо видимое место'},
    loading:{label:'Удобство разгрузки и перемещения товара',low:'1 — тяжёлый товар переносить далеко и неудобно',high:'5 — путь разгрузки короткий и безопасный'},
    competition:{label:'Соответствие помещения формату магазина',low:'1 — помещение плохо подходит под выбранный формат',high:'5 — помещение хорошо подходит под выбранный формат'},
    condition:{label:'Простота подготовки помещения к запуску',low:'1 — потребуется сложная и дорогая подготовка',high:'5 — достаточно минимальных подготовительных работ'},
    storage:{label:'Качество складской и подсобной зоны',low:'1 — склад отсутствует или непригоден',high:'5 — склад достаточный, сухой и удобный'},
    overall:{label:'Общий потенциал локации',low:'1 — точка в целом неубедительна',high:'5 — сильная точка с понятным потенциалом'},
  };
  const SCORE_FIELD_LABELS=Object.fromEntries(Object.entries(SCORE_GUIDANCE).map(([key,value])=>[`score.${key}`,value.label]));
  const SCORE_DESCRIPTION='Чек-лист подтверждает наличие конкретных условий, а оценка помогает сравнить локации по спросу, потоку, доступности, заметности и пригодности помещения.';
  let timer=null;

  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function relabelField(control,text){
    const label=control?.closest('label.field');
    if(!label)return;
    let caption=label.querySelector(':scope > .evaluation-caption-v446,:scope > .profile-caption-v416');
    if(!caption){
      [...label.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE&&node.textContent.trim()).forEach(node=>node.remove());
      caption=document.createElement('span');
      caption.className='evaluation-caption-v446';
      label.prepend(caption);
    }
    if(caption.textContent!==text)caption.textContent=text;
  }

  function patchWorkflowDefinitions(){
    const workflow=window.BogatkaWorkflowV414;
    if(!workflow)return;
    Object.assign(workflow.SCORE_GUIDANCE||{},SCORE_GUIDANCE);
    Object.assign(workflow.FIELD_LABELS||{},SCORE_FIELD_LABELS,{rentConditions:'Предварительные условия аренды'});
  }

  function updateScoreSection(card){
    const details=[...card.querySelectorAll(':scope .location-body > details')].find(item=>{
      const title=item.querySelector(':scope > summary')?.textContent||'';
      return title.includes('70-балльной')||title.includes('Сравнительная оценка');
    });
    if(!details)return;
    const summary=details.querySelector(':scope > summary');
    if(summary&&summary.textContent!=='Сравнительная оценка потенциала локации — 70 баллов')summary.textContent='Сравнительная оценка потенциала локации — 70 баллов';
    const guide=details.querySelector('.score-guide-v331');
    const paragraph=guide?.querySelector('p');
    if(paragraph&&paragraph.textContent!==SCORE_DESCRIPTION)paragraph.textContent=SCORE_DESCRIPTION;
    details.querySelectorAll('.score-table tbody tr').forEach(row=>{
      const select=row.querySelector('select[data-field^="score."]');
      const key=String(select?.dataset.field||'').replace(/^score\./,'');
      const definition=SCORE_GUIDANCE[key];
      const cell=row.querySelector('td:first-child');
      if(!definition||!cell)return;
      const currentTitle=cell.querySelector('.score-label-v414 > strong')?.textContent||'';
      const currentHints=[...cell.querySelectorAll('.score-label-v414 small > span')].map(item=>item.textContent||'');
      if(currentTitle===definition.label&&currentHints[0]===definition.low&&currentHints[1]===definition.high){
        row.dataset.evaluationRefineV446='1';
        return;
      }
      cell.innerHTML=`<div class="score-label-v414"><strong>${esc(definition.label)}</strong><small><span>${esc(definition.low)}</span><span>${esc(definition.high)}</span></small></div>`;
      row.dataset.evaluationRefineV446='1';
    });
  }

  function updateProfileAndCompetitorCopy(card){
    const rentConditions=card.querySelector('[data-field="rentConditions"]');
    if(rentConditions){
      relabelField(rentConditions,'Предварительные условия аренды');
      const placeholder='Что предварительно озвучил арендодатель: депозит, каникулы, коммунальные платежи, индексация, ремонт';
      if(rentConditions.placeholder!==placeholder)rentConditions.placeholder=placeholder;
    }
    relabelField(card.querySelector('[data-field="competitor.name"]'),'Ближайший прямой конкурент');
  }

  function enhanceCard(card){
    updateScoreSection(card);
    updateProfileAndCompetitorCopy(card);
  }

  function enhanceAll(){
    patchWorkflowDefinitions();
    document.querySelectorAll('[data-location-card]').forEach(enhanceCard);
  }

  function schedule(delay=40){
    clearTimeout(timer);
    timer=setTimeout(enhanceAll,delay);
  }

  const observer=new MutationObserver(()=>schedule());
  function install(){
    const root=document.getElementById('locations')||document.body;
    observer.observe(root,{childList:true,subtree:true});
    enhanceAll();
    [120,400,900,1800].forEach(delay=>setTimeout(enhanceAll,delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.BogatkaLocationEvaluationRefineV446={version:VERSION,ready:true,enhanceAll,SCORE_GUIDANCE};
})();
