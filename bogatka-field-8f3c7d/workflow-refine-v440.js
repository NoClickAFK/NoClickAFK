(function(){
  'use strict';
  if(window.BogatkaWorkflowRefineV440?.ready)return;

  const VERSION='4.4.0';
  const ANIMATION_MS=240;
  const INTRO_CLASS='collaboration-intro-v445';
  const TASK_HELP='Опишите конкретный результат, назначьте ответственного, срок и приоритет. После создания можно изменить статус задачи: перевести её в работу, поставить на ожидание или завершить.';
  const NOTES_HELP='Здесь можно отдельно зафиксировать основные выводы по локации, чтобы они не потерялись среди обычных комментариев участников.';
  const TASK_EXAMPLES={
    normal:[
      'Собрать недостающие документы и ответы по локации',
      'Подготовить список открытых вопросов к следующему обсуждению',
      'Сверить полученные документы с результатами осмотра помещения',
    ],
    high:[
      'Получить письменный ответ по спорному условию аренды',
      'Зафиксировать, кто и за чей счёт устраняет недостатки помещения',
      'Подтвердить срок устранения выявленного недостатка помещения',
    ],
    critical:[
      'Получить документы, подтверждающие законность перепланировки помещения',
      'Получить письменное разрешение на обязательные работы',
      'Устранить ограничение, которое блокирует аренду помещения (если это возможно)',
    ],
  };
  const PRIORITY_LABELS={normal:'Обычные',high:'Высокий приоритет',critical:'Критические'};
  let enhanceTimer=null;

  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function syncVisibleSelect(select){
    const trigger=select?.nextElementSibling?.classList.contains('premium-select-trigger')?select.nextElementSibling:null;
    if(trigger&&typeof bogatkaSyncPremiumSelect==='function')bogatkaSyncPremiumSelect(select,trigger);
  }

  function normalizeIntro(intro){
    if(!intro)return;
    intro.classList.add(INTRO_CLASS);
    intro.dataset.collaborationIntroV445='1';
    const title=intro.querySelector(':scope > strong');
    const description=intro.querySelector(':scope > span');
    if(title)title.dataset.collaborationIntroTitleV445='1';
    if(description)description.dataset.collaborationIntroDescriptionV445='1';
  }

  function updateExamplesSummary(details,open=details.open){
    const summary=details?.querySelector(':scope > summary');
    if(!summary)return;
    const state=open?'open':'closed';
    if(summary.dataset.taskExamplesStateV440===state)return;
    const prefix=document.createElement('span');
    prefix.dataset.taskExamplesPrefixV443='1';
    prefix.textContent='Примеры задач —\u00a0';
    const instruction=document.createElement('span');
    instruction.dataset.taskExamplesInstructionV440='1';
    if(open){
      instruction.textContent='выберите подходящий вариант и нажмите на него';
    }else{
      const strong=document.createElement('strong');
      strong.textContent='нажмите, чтобы открыть';
      instruction.appendChild(strong);
    }
    summary.replaceChildren(prefix,instruction);
    summary.dataset.taskExamplesStateV440=state;
    summary.setAttribute('aria-expanded',String(open));
  }

  function examplesMarkup(){
    return `<div class="task-examples-content-v443"><p class="task-examples-note-v440">Текст задачи и приоритет подставятся автоматически — при необходимости их можно изменить.</p>${Object.entries(TASK_EXAMPLES).map(([priority,items])=>`<section><strong>${esc(PRIORITY_LABELS[priority])}</strong>${items.map(title=>`<button type="button" data-task-example-title="${esc(title)}" data-task-example-priority="${priority}">${esc(title)}</button>`).join('')}</section>`).join('')}</div>`;
  }

  function setExamplesOpen(details,open,{animate=true}={}){
    const body=details?.querySelector(':scope > div');
    if(!details||!body)return;
    const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    clearTimeout(details.__bogatkaExamplesTimerV443);
    details.dataset.taskExamplesTargetV444=open?'open':'closed';

    if(!animate||reducedMotion){
      details.open=open;
      body.style.removeProperty('height');
      body.style.removeProperty('opacity');
      details.dataset.taskExamplesAnimatingV443='0';
      updateExamplesSummary(details,open);
      return;
    }

    if(details.dataset.taskExamplesAnimatingV443==='1')return;
    details.dataset.taskExamplesAnimatingV443='1';
    const startHeight=body.getBoundingClientRect().height;
    body.style.height=`${startHeight}px`;
    body.style.opacity=open?'0':'1';

    if(open){
      details.open=true;
      updateExamplesSummary(details,true);
      const targetHeight=body.scrollHeight;
      requestAnimationFrame(()=>{
        body.style.height=`${targetHeight}px`;
        body.style.opacity='1';
      });
    }else{
      updateExamplesSummary(details,false);
      requestAnimationFrame(()=>{
        body.style.height='0px';
        body.style.opacity='0';
      });
    }

    details.__bogatkaExamplesTimerV443=setTimeout(()=>{
      details.open=open;
      body.style.removeProperty('height');
      body.style.removeProperty('opacity');
      details.dataset.taskExamplesAnimatingV443='0';
      updateExamplesSummary(details,open);
    },ANIMATION_MS+50);
  }

  function moveExamplesBeforeForm(card,details,form){
    const help=card.querySelector('.task-form-help-v414');
    if(help){
      if(help.nextElementSibling!==details)help.insertAdjacentElement('afterend',details);
      return;
    }
    if(form.previousElementSibling!==details)form.insertAdjacentElement('beforebegin',details);
  }

  function enhanceTaskExamples(card){
    const form=card.querySelector('.task-form-v400');
    const details=card.querySelector('.task-examples-v414');
    const body=details?.querySelector(':scope > div');
    const summary=details?.querySelector(':scope > summary');
    if(!form||!details||!body||!summary)return;

    moveExamplesBeforeForm(card,details,form);

    if(details.dataset.workflowRefineV440!=='1'){
      details.dataset.workflowRefineV440='1';
      body.innerHTML=examplesMarkup();
      summary.addEventListener('click',event=>{
        event.preventDefault();
        setExamplesOpen(details,!details.open);
      });
      details.addEventListener('toggle',()=>{
        if(details.dataset.taskExamplesAnimatingV443!=='1')updateExamplesSummary(details,details.open);
      });
      body.querySelectorAll('[data-task-example-title]').forEach(button=>button.addEventListener('click',()=>{
        const title=form.querySelector('textarea[name="title"]');
        const priority=form.querySelector('select[name="priority"]');
        if(title){
          title.value=button.dataset.taskExampleTitle||'';
          title.dispatchEvent(new Event('input',{bubbles:true}));
          title.focus();
        }
        if(priority){
          priority.value=button.dataset.taskExamplePriority||'normal';
          priority.dispatchEvent(new Event('change',{bubbles:true}));
          syncVisibleSelect(priority);
        }
      }));
      setExamplesOpen(details,details.open,{animate:false});
    }else if(details.dataset.taskExamplesAnimatingV443==='1'){
      updateExamplesSummary(details,details.dataset.taskExamplesTargetV444==='open');
    }else{
      updateExamplesSummary(details,details.open);
    }
  }

  function enhanceTaskCopy(card){
    const intro=card.querySelector('.task-form-help-v414');
    normalizeIntro(intro);
    const help=intro?.querySelector(':scope > span');
    if(help&&help.textContent!==TASK_HELP)help.textContent=TASK_HELP;
    const title=card.querySelector('.task-form-v400 textarea[name="title"]');
    if(title&&title.placeholder!=='Например: собрать недостающие документы и ответы по локации')title.placeholder='Например: собрать недостающие документы и ответы по локации';
  }

  function enhanceStructuredNotes(card){
    const structured=card.querySelector('.structured-notes-v414');
    if(!structured)return;
    let header=structured.querySelector(':scope > .structured-notes-head-v414');
    if(!header&&structured.previousElementSibling?.classList.contains('structured-notes-head-v414'))header=structured.previousElementSibling;
    if(header&&header.parentElement===structured)structured.insertAdjacentElement('beforebegin',header);
    if(header){
      header.dataset.commentsIntroV444='1';
      normalizeIntro(header);
      const description=header.querySelector(':scope > span');
      if(description&&description.textContent!==NOTES_HELP)description.textContent=NOTES_HELP;
    }
    structured.querySelector('[data-note-slot-v414="questions"]')?.remove();
  }

  function enhanceCard(card){
    enhanceTaskCopy(card);
    enhanceTaskExamples(card);
    enhanceStructuredNotes(card);
  }

  function enhanceAll(){
    document.querySelectorAll('[data-location-card]').forEach(enhanceCard);
  }

  function scheduleEnhance(delay=30){
    clearTimeout(enhanceTimer);
    enhanceTimer=setTimeout(enhanceAll,delay);
  }

  const observer=new MutationObserver(()=>scheduleEnhance(35));
  function install(){
    const root=document.getElementById('locations')||document.body;
    observer.observe(root,{childList:true,subtree:true});
    enhanceAll();
    [100,350,800,1600].forEach(delay=>setTimeout(enhanceAll,delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.BogatkaWorkflowRefineV440={version:VERSION,ready:true,enhanceAll,TASK_EXAMPLES};
})();
