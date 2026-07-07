(function(){
  'use strict';
  if(window.BogatkaCardProgressV448?.ready)return;

  const VERSION='4.4.8';
  const SCORE_BANDS=[
    {max:39,label:'Слабая',className:'weak'},
    {max:59,label:'Требует доработки',className:'medium'},
    {max:74,label:'Перспективная',className:'good'},
    {max:100,label:'Сильная',className:'priority'},
  ];
  const PHOTO_CATEGORY_LABELS={
    street:'улица и окружение',entrance:'вход и фасад',parking:'парковка',traffic:'трафик',
    competitors:'конкуренты',interior:'помещение',storage:'склад',engineering:'инженерия',documents:'документы',other:'прочее',
  };
  const GROUP_ORDER=['inspection','landlord','scores','technical','photos','checks','conclusion'];
  const GROUP_WEIGHTS={inspection:12,landlord:8,scores:25,technical:15,photos:20,checks:10,conclusion:10};
  const GROUP_TARGETS={
    inspection:'inspection',landlord:'landlord',scores:'scores',technical:'technical',photos:'photos',checks:'checks',conclusion:'conclusion',
  };
  let timer=null;
  let updateWrapperAttempts=0;

  const filled=value=>value!==undefined&&value!==null&&(typeof value!=='string'||value.trim()!=='');
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  const round1=value=>Math.round(Number(value||0)*10)/10;
  const text=(node,value)=>{if(node&&node.textContent!==String(value))node.textContent=String(value)};
  const attr=(node,name,value)=>{if(node&&node.getAttribute(name)!==String(value))node.setAttribute(name,String(value))};
  const setHidden=(node,value)=>{if(node&&node.hidden!==Boolean(value))node.hidden=Boolean(value)};
  const setClass=(node,name,enabled)=>{if(node&&node.classList.contains(name)!==Boolean(enabled))node.classList.toggle(name,Boolean(enabled))};
  const setStyle=(node,name,value,priority='')=>{
    if(!node)return;
    if(node.style.getPropertyValue(name)===String(value)&&node.style.getPropertyPriority(name)===priority)return;
    node.style.setProperty(name,String(value),priority);
  };
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function scoreAnalysis(data={},weights={}){
    let earned=0;
    let coverage=0;
    let answered=0;
    const totalWeight=Object.values(weights).reduce((sum,value)=>sum+Number(value||0),0)||100;
    for(const [key,weightValue] of Object.entries(weights)){
      const value=Number(data?.score?.[key]);
      const weight=Number(weightValue||0);
      if(!Number.isFinite(value)||value<1||value>5||weight<=0)continue;
      answered+=1;
      coverage+=weight;
      earned+=weight*((value-1)/4);
    }
    const coveragePercent=totalWeight?coverage/totalWeight*100:0;
    const qualityScore=coverage>0?earned/coverage*100:null;
    const ratingScore=totalWeight?earned/totalWeight*100:0;
    return {
      answered,
      total:Object.keys(weights).length,
      coverageWeight:round1(coverage),
      coveragePercent:round1(coveragePercent),
      qualityScore:qualityScore===null?null:round1(qualityScore),
      ratingScore:round1(ratingScore),
    };
  }

  function simpleRequirement(label,value){return{label,done:filled(value)}}

  function inspectionRequirements(data={}){
    const items=[
      simpleRequirement('статус работы',data.status),
      simpleRequirement('тип объекта',data.objectType),
      simpleRequirement('дата осмотра',data.date),
      simpleRequirement('время осмотра',data.time),
      simpleRequirement('этаж / расположение',data.floorLocation),
      simpleRequirement('состояние помещения',data.premiseCondition),
      simpleRequirement('доступность помещения',data.premiseAvailability),
      simpleRequirement('готовность собственника',data.landlordReadiness),
    ];
    if(data.objectType==='Другое')items.splice(2,0,simpleRequirement('уточнение типа объекта',data.objectTypeOther));
    return items;
  }

  function landlordRequirements(data={}){
    const items=[
      simpleRequirement('собственник / организация',data.ownerName),
      simpleRequirement('роль контактного лица',data.contactRole),
      simpleRequirement('контактное лицо',data.contact),
      {label:'телефон, мессенджер или email',done:[data.contactPhone,data.contactMessenger,data.contactEmail].some(filled)},
    ];
    if(data.contactRole==='Другое')items.splice(2,0,simpleRequirement('уточнение роли контактного лица',data.contactRoleOther));
    return items;
  }

  function technicalRequirements(data={}){
    return[
      simpleRequirement('общая площадь',data?.tech?.totalArea),
      simpleRequirement('аренда в месяц',data?.tech?.rentPerMonth),
      simpleRequirement('электрическая мощность',data?.tech?.powerKw),
      simpleRequirement('режим работы',data?.tech?.openingHours),
      simpleRequirement('коммунальные расходы',data?.tech?.utilities),
      simpleRequirement('оценка ремонта',data?.tech?.repairEstimate),
    ];
  }

  function conclusionRequirements(data={}){
    return[
      simpleRequirement('главные плюсы',data.pros),
      simpleRequirement('главные минусы',data.cons),
      simpleRequirement('риски',data.risks),
      simpleRequirement('вопросы арендодателю',data.questions),
      simpleRequirement('предварительное решение',data.decision),
    ];
  }

  function requirementGroup(key,title,items,detail=''){
    const total=items.length;
    const done=items.filter(item=>item.done).length;
    const missingLabels=items.filter(item=>!item.done).map(item=>item.label);
    return{
      key,title,weight:GROUP_WEIGHTS[key],target:GROUP_TARGETS[key],done,total,
      ratio:total?done/total:1,
      percent:total?Math.round(done/total*100):100,
      missingCount:Math.max(0,total-done),missingLabels,detail,
    };
  }

  function scoreGroup(data={},weights={}){
    const keys=Object.keys(weights);
    const items=keys.map(key=>simpleRequirement(key,data?.score?.[key]));
    const group=requirementGroup('scores','Сравнительная оценка',items);
    group.detail=group.missingCount?`Оценено ${group.done} из ${group.total} критериев.`:'Все 14 критериев оценены.';
    return group;
  }

  function photoGroup(metric={}){
    const plan=metric.photoPlan||{};
    const total=Number(plan.requiredTotal||0);
    const done=Number(plan.completed||0);
    const missing=Array.isArray(plan.missing)?plan.missing:[];
    const missingLabels=missing.map(item=>{
      const label=PHOTO_CATEGORY_LABELS[item.category]||item.category;
      return `${label}: ещё ${item.missing}`;
    });
    const effectiveTotal=total||5;
    const effectiveDone=total?done:Math.min(effectiveTotal,Number(metric.photoCount||0));
    return{
      key:'photos',title:'Фотографии',weight:GROUP_WEIGHTS.photos,target:'photos',
      done:effectiveDone,total:effectiveTotal,ratio:effectiveTotal?effectiveDone/effectiveTotal:1,
      percent:effectiveTotal?Math.round(effectiveDone/effectiveTotal*100):100,
      missingCount:Math.max(0,effectiveTotal-effectiveDone),missingLabels,
      detail:Math.max(0,effectiveTotal-effectiveDone)?`Не хватает ${Math.max(0,effectiveTotal-effectiveDone)} фото по обязательному плану.`:'План фотографий выполнен.',
    };
  }

  function checksGroup(metric={}){
    const entries=metric.dealGate?.entries||[];
    const total=entries.length||10;
    const deal=window.BogatkaCriticalDeal;
    const complete=entry=>Boolean(deal?.isCompleted?.(entry.value,entry.definition));
    const done=entries.length?entries.filter(complete).length:Number(metric.stopAnswered||0);
    const missingLabels=entries.filter(entry=>!complete(entry)).map(entry=>entry.definition?.title||'проверка');
    return{
      key:'checks',title:'Проверки перед арендой',weight:GROUP_WEIGHTS.checks,target:'checks',
      done,total,ratio:total?done/total:1,percent:total?Math.round(done/total*100):100,
      missingCount:Math.max(0,total-done),missingLabels,
      detail:Math.max(0,total-done)?`Не завершено ${Math.max(0,total-done)} из ${total} проверок.`:'Все проверки завершены.',
    };
  }

  function buildProgress(metric={}){
    const data=metric.data||{};
    const groups=[
      requirementGroup('inspection','Осмотр и статус',inspectionRequirements(data)),
      requirementGroup('landlord','Арендодатель и связь',landlordRequirements(data)),
      scoreGroup(data,window.BogatkaDecisionEngine?.WEIGHTS||{}),
      requirementGroup('technical','Технические и финансовые данные',technicalRequirements(data)),
      photoGroup(metric),
      checksGroup(metric),
      requirementGroup('conclusion','Выводы и решение',conclusionRequirements(data)),
    ];
    const percent=Math.round(groups.reduce((sum,group)=>sum+group.ratio*group.weight,0));
    const completeGroups=groups.filter(group=>group.missingCount===0).length;
    const missing=groups.filter(group=>group.missingCount>0).map(group=>{
      if(group.key==='scores')return `${group.missingCount} оценок из ${group.total}`;
      if(group.key==='photos')return `${group.missingCount} обязательных фото`;
      if(group.key==='checks')return `${group.missingCount} проверок перед арендой`;
      return `${group.title.toLowerCase()}: ${group.missingLabels.slice(0,3).join(', ')}${group.missingLabels.length>3?` и ещё ${group.missingLabels.length-3}`:''}`;
    });
    const basicGroups=groups.filter(group=>group.key==='inspection'||group.key==='landlord');
    const basicDone=basicGroups.reduce((sum,group)=>sum+group.done,0);
    const basicTotal=basicGroups.reduce((sum,group)=>sum+group.total,0);
    const sections={
      basic:basicTotal?basicDone/basicTotal:1,
      scores:groups.find(group=>group.key==='scores')?.ratio||0,
      technical:groups.find(group=>group.key==='technical')?.ratio||0,
      photos:groups.find(group=>group.key==='photos')?.ratio||0,
      stops:groups.find(group=>group.key==='checks')?.ratio||0,
      conclusion:groups.find(group=>group.key==='conclusion')?.ratio||0,
    };
    return{groups,percent,completeGroups,totalGroups:groups.length,missing,sections};
  }

  function recommendation(metric,analysis,progress){
    if(metric.dealGate?.code==='blocked')return{label:'СТОП',className:'stop',reason:metric.dealGate.text||'Есть блокирующее условие перед арендой.'};
    const economy=metric.economy||{};
    if(economy.revenue>0&&economy.grossMarginPct>0){
      if(economy.operatingProfit<=0)return{label:'Экономика не сходится',className:'stop',reason:'Прогнозная операционная прибыль отрицательная.'};
      if((economy.rentBurdenPct??0)>18)return{label:'Высокая аренда',className:'risk',reason:'Арендная нагрузка выше 18% прогнозной выручки.'};
    }
    if(analysis.answered<5||analysis.coveragePercent<35){
      return{label:'Недостаточно оценок',className:'empty',reason:`Оцените минимум 5 критериев. Сейчас заполнено ${analysis.answered} из ${analysis.total}.`};
    }
    if(progress.percent<35)return{label:'Недостаточно данных',className:'empty',reason:'Карточка заполнена меньше чем на 35%.'};
    const quality=analysis.qualityScore??0;
    if(quality>=75&&analysis.coveragePercent>=70&&progress.percent>=70)return{label:'Высокий приоритет',className:'priority',reason:'Сильная оценка подтверждена достаточным объёмом данных.'};
    if(quality>=60&&analysis.coveragePercent>=50)return{label:'Перспективно',className:'good',reason:'Показатели выше рабочего порога; стоит продолжать переговоры.'};
    if(quality>=45&&analysis.coveragePercent>=50)return{label:'Средний потенциал',className:'medium',reason:'Локация требует улучшения условий или дополнительной проверки.'};
    if(analysis.coveragePercent>=50)return{label:'Слабая локация',className:'weak',reason:'Качество по заполненным критериям ниже рабочего порога.'};
    return{label:'Недостаточно оценок',className:'empty',reason:'Оценка пока недостаточно надёжна для вывода.'};
  }

  function transformMetrics(metrics=[]){
    const weights=window.BogatkaDecisionEngine?.WEIGHTS||{};
    for(const metric of metrics){
      const analysis=scoreAnalysis(metric.data,weights);
      const progress=buildProgress(metric);
      metric.weightedContribution=analysis.ratingScore;
      metric.ratingScore=analysis.ratingScore;
      metric.qualityScore=analysis.qualityScore;
      metric.quality=analysis.qualityScore??0;
      metric.scoreCoverage=analysis.coveragePercent;
      metric.scoreCoveragePct=analysis.coveragePercent;
      metric.answeredScores=analysis.answered;
      metric.weighted=analysis.ratingScore;
      metric.completion=progress.percent;
      metric.sections=progress.sections;
      metric.missing=progress.missing;
      metric.progressGroups=progress.groups;
      metric.completedProgressGroups=progress.completeGroups;
      metric.totalProgressGroups=progress.totalGroups;
      metric.recommendation=recommendation(metric,analysis,progress);
    }
    const ranked=[...metrics].sort((left,right)=>(left.dealGate?.priority??9)-(right.dealGate?.priority??9)||left.risks-right.risks||right.ratingScore-left.ratingScore||right.completion-left.completion||right.rawScore-left.rawScore||left.originalIndex-right.originalIndex);
    ranked.forEach((metric,index)=>metric.rank=index+1);
    return metrics;
  }

  function installEngineWrapper(){
    const engine=window.BogatkaDecisionEngine;
    if(!engine||typeof engine.computeAll!=='function'||engine.computeAll.__cardProgressV448)return false;
    const base=engine.computeAll.bind(engine);
    const wrapped=async function(...args){return transformMetrics(await base(...args))};
    wrapped.__cardProgressV448=true;
    wrapped.__base=base;
    engine.computeAll=wrapped;
    return true;
  }

  function qualityBand(score){
    if(score===null||score===undefined)return{label:'Нет оценки',className:'empty'};
    return SCORE_BANDS.find(band=>score<=band.max)||SCORE_BANDS.at(-1);
  }

  function normalizedRecommendation(recommendation={}){
    const semantic=String(recommendation.className||'empty');
    const label=String(recommendation.label||'Недостаточно данных');
    const title=String(recommendation.reason||label);
    return{
      label,
      semantic,
      className:`recommendation-status-v448 ${semantic}`,
      title,
      ariaLabel:`Текущая рекомендация: ${label}`,
    };
  }

  function setRecommendationStatus(node,recommendation={}){
    if(!node)return false;
    const next=normalizedRecommendation(recommendation);
    const same=node.textContent===next.label&&
      node.className===next.className&&
      node.dataset.recommendationClass===next.semantic&&
      node.title===next.title&&
      node.getAttribute('aria-label')===next.ariaLabel&&
      !node.hidden;
    if(same)return false;
    if(node.className!==next.className)node.className=next.className;
    if(node.dataset.recommendationClass!==next.semantic)node.dataset.recommendationClass=next.semantic;
    text(node,next.label);
    if(node.title!==next.title)node.title=next.title;
    attr(node,'aria-label',next.ariaLabel);
    setHidden(node,false);
    return true;
  }

  function compactMissing(group){
    if(group.missingCount===0)return'Раздел заполнен.';
    if(group.key==='scores')return `Осталось оценить ${group.missingCount} из ${group.total} критериев.`;
    if(group.key==='photos')return group.detail;
    if(group.key==='checks')return group.detail;
    const shown=group.missingLabels.slice(0,3);
    return `${shown.join(', ')}${group.missingLabels.length>3?` и ещё ${group.missingLabels.length-3}`:''}.`;
  }

  function ensureHeader(card){
    const scorebox=card.querySelector(':scope > .location-head .scorebox');
    if(scorebox){
      setHidden(scorebox,true);
      attr(scorebox,'aria-hidden','true');
      if(!scorebox.classList.contains('card-metric-hidden-v448'))scorebox.classList.add('card-metric-hidden-v448');
    }
    const actions=card.querySelector(':scope > .location-head .location-actions');
    let head=card.querySelector('[data-card-recommendation-v448]')?.closest('.decision-head-v340')||card.querySelector(':scope > .location-head .decision-head-v340');
    if(!actions)return null;
    if(!head){
      head=document.createElement('div');
      head.className='decision-head-v340 card-recommendation-head-v448 location-action-status-v448';
      actions.appendChild(head);
    }
    if(head.dataset.cardProgressV448!=='1')head.dataset.cardProgressV448='1';
    if(!head.classList.contains('card-recommendation-head-v448'))head.classList.add('card-recommendation-head-v448');
    if(!head.classList.contains('location-action-status-v448'))head.classList.add('location-action-status-v448');
    let badge=head.querySelector('[data-card-recommendation-v448]');
    if(!badge){
      badge=head.querySelector('[data-recommendation]');
      if(badge)badge.setAttribute('data-card-recommendation-v448','');
      else{
        badge=document.createElement('strong');
        badge.setAttribute('data-card-recommendation-v448','');
        badge.textContent='Недостаточно данных';
        head.appendChild(badge);
      }
    }
    for(const child of [...head.children])if(child!==badge)child.remove();
    if(!badge.classList.contains('recommendation-status-v448'))badge.className='recommendation-status-v448 empty';
    let buttons=actions.querySelector(':scope > .location-action-buttons-v448');
    if(!buttons){
      buttons=document.createElement('div');
      buttons.className='location-action-buttons-v448';
      actions.prepend(buttons);
    }
    for(const child of [...actions.children]){
      if(child===buttons||child===head)continue;
      buttons.appendChild(child);
    }
    if(head.parentElement!==actions)actions.appendChild(head);
    return head;
  }

  function ensureOverview(card){
    const overview=card.querySelector(':scope .decision-overview-v340');
    if(!overview)return null;
    if(overview.dataset.cardProgressV448==='1')return overview;
    overview.dataset.cardProgressV448='1';
    overview.classList.add('decision-progress-v448');
    overview.innerHTML=`
      <div class="progress-heading-v448">
        <div><strong>Общая оценка и готовность данных</strong><span>Здесь видно, насколько подходит локация и сколько данных уже собрано</span></div>
      </div>
      <div class="progress-metrics-v448">
        <article class="progress-metric-v448"><span>Качество локации</span><strong data-progress-quality-v448>Нет оценки</strong><small data-progress-quality-meta-v448>Оцените критерии ниже в карточке локации</small></article>
        <article class="progress-metric-v448"><span>Надёжность оценки</span><strong data-progress-coverage-v448>0%</strong><small data-progress-coverage-meta-v448>Оценено 0 из 14 критериев</small></article>
        <article class="progress-metric-v448"><span>Готовность карточки</span><strong data-progress-completion-v448>0%</strong><small data-progress-completion-meta-v448>Заполнено 0 из 7 разделов</small></article>
        <article class="progress-metric-v448"><span>Проверки перед арендой</span><strong data-progress-checks-v448>0 из 10</strong><small data-progress-checks-meta-v448>Проверок завершено</small><small class="progress-metric-note-v448" data-progress-checks-note-v448 hidden></small></article>
      </div>
      <div class="quality-scale-v448" data-quality-scale-v448>
        <div class="quality-scale-track-v448"><span></span><i data-quality-marker-v448></i></div>
        <div class="quality-scale-labels-v448"><span>0–39<br>слабая</span><span>40–59<br>доработать</span><span>60–74<br>перспективная</span><span>75–100<br>сильная</span></div>
      </div>
      <div class="score-explanation-v448"><strong>Что означают показатели</strong><span>Оценки ставятся ниже в разделе оценки локации. Качество показывает средний результат по заполненным критериям, а надёжность — сколько из 14 критериев уже оценено. Пустые критерии не снижают качество, но уменьшают надёжность</span></div>
      <div class="completion-track-v448"><span data-progress-completion-bar-v448></span></div>
      <div class="fill-plan-v448">
        <div class="fill-plan-heading-v448"><strong>Что заполнить дальше</strong><span data-fill-plan-summary-v448></span></div>
        <div class="fill-plan-list-v448" data-fill-plan-list-v448></div>
      </div>`;
    overview.addEventListener('click',event=>{
      const button=event.target.closest('[data-progress-target-v448]');
      if(button)openTarget(card,button.dataset.progressTargetV448);
    });
    return overview;
  }

  function findDetails(card,needle){
    return [...card.querySelectorAll(':scope .location-body > details')].find(details=>details.querySelector(':scope > summary')?.textContent.toLowerCase().includes(needle));
  }

  function openTarget(card,target){
    let node=null;
    if(target==='inspection')node=card.querySelector('.inspection-card-v416');
    else if(target==='landlord')node=card.querySelector('.landlord-card-v416');
    else if(target==='scores')node=findDetails(card,'70-балль');
    else if(target==='technical')node=findDetails(card,'технические и финансовые');
    else if(target==='photos')node=findDetails(card,'фотограф');
    else if(target==='checks')node=card.querySelector('[data-critical-deal]');
    else if(target==='conclusion')node=card.querySelector('.decision-panel-v412,.decision');
    if(!node)return;
    if(node.tagName==='DETAILS'){
      node.open=true;
      node.setAttribute('open','');
    }
    node.scrollIntoView({behavior:'smooth',block:'start'});
    if(node.matches('section,div,details')){
      node.classList.add('progress-target-flash-v448');
      setTimeout(()=>node.classList.remove('progress-target-flash-v448'),1300);
    }
  }

  function renderPlan(overview,metric){
    const list=overview.querySelector('[data-fill-plan-list-v448]');
    if(!list)return;
    const groups=Array.isArray(metric.progressGroups)?metric.progressGroups:[];
    const incomplete=groups.filter(group=>group.missingCount>0);
    text(overview.querySelector('[data-fill-plan-summary-v448]'),incomplete.length?`${metric.completedProgressGroups} из ${metric.totalProgressGroups} разделов готовы`:'Все обязательные разделы заполнены');
    const signature=JSON.stringify(incomplete.map(group=>({key:group.key,title:group.title,target:group.target,percent:group.percent,missingCount:group.missingCount,missingLabels:group.missingLabels,detail:group.detail})));
    if(list.dataset.fillPlanSignatureV448===signature)return;
    if(!incomplete.length){
      list.innerHTML='<div class="fill-plan-complete-v448"><strong>Карточка заполнена.</strong><span>Можно переходить к итоговому решению и проверке условий аренды.</span></div>';
    }else{
      list.innerHTML=incomplete.map((group,index)=>`
        <article class="fill-plan-item-v448${index===0?' active':''}">
          <div class="fill-plan-copy-v448"><span>${index===0?'Следующий приоритет':'Далее'}</span><strong>${escapeHtml(group.title)}</strong><small>${escapeHtml(compactMissing(group))}</small></div>
          <div class="fill-plan-progress-v448"><span style="width:${clamp(group.percent,0,100)}%"></span></div>
          <button type="button" class="btn secondary small" data-progress-target-v448="${escapeHtml(group.target)}">Открыть раздел</button>
        </article>`).join('');
    }
    list.dataset.fillPlanSignatureV448=signature;
  }

  function renderMetric(card,metric){
    const header=ensureHeader(card);
    const overview=ensureOverview(card);
    if(!header||!overview)return;
    const recommendation=metric.recommendation||{label:'Недостаточно данных',className:'empty'};
    setRecommendationStatus(header.querySelector('[data-card-recommendation-v448]'),recommendation);

    const quality=metric.qualityScore;
    const band=qualityBand(quality);
    const answered=metric.answeredScores||0;
    text(overview.querySelector('[data-progress-quality-v448]'),quality===null||quality===undefined?'Нет оценки':`${Number.isInteger(quality)?quality:quality.toFixed(1)}/100`);
    text(overview.querySelector('[data-progress-quality-meta-v448]'),answered?'Средний результат по заполненным критериям':'Оцените критерии ниже в карточке локации');
    text(overview.querySelector('[data-progress-coverage-v448]'),`${Math.round(metric.scoreCoveragePct||0)}%`);
    text(overview.querySelector('[data-progress-coverage-meta-v448]'),`Оценено ${answered} из 14 критериев`);
    text(overview.querySelector('[data-progress-completion-v448]'),`${metric.completion||0}%`);
    text(overview.querySelector('[data-progress-completion-meta-v448]'),`Заполнено ${metric.completedProgressGroups||0} из ${metric.totalProgressGroups||7} разделов`);

    const checksGroup=metric.progressGroups?.find(group=>group.key==='checks');
    const checksDone=checksGroup?.done??Number(metric.stopAnswered||0);
    const checksTotal=checksGroup?.total??10;
    text(overview.querySelector('[data-progress-checks-v448]'),`${checksDone} из ${checksTotal}`);
    text(overview.querySelector('[data-progress-checks-meta-v448]'),'Проверок завершено');
    const checksNote=overview.querySelector('[data-progress-checks-note-v448]');
    const compactText=String(metric.dealGate?.compactText||'').trim();
    const note=compactText==='Нужно письменно'
      ?'Есть пункты без письменного подтверждения'
      :(compactText&&compactText!=='Не проверено'?compactText:'');
    if(checksNote){
      text(checksNote,note);
      setHidden(checksNote,!note);
    }

    const scale=overview.querySelector('[data-quality-scale-v448]');
    if(scale){
      if(scale.dataset.qualityBand!==band.className)scale.dataset.qualityBand=band.className;
      setStyle(scale,'--quality-position',`${clamp(quality??0,0,100)}%`);
      setClass(scale,'empty',quality===null||quality===undefined);
    }
    const completionBar=overview.querySelector('[data-progress-completion-bar-v448]');
    if(completionBar)setStyle(completionBar,'width',`${clamp(metric.completion||0,0,100)}%`);
    renderPlan(overview,metric);

    const rank=card.querySelector(`[data-auto-rank="${CSS.escape(metric.id)}"]`);
    const rankTitle='Рейтинг учитывает стоп-факторы, риски, качество и надёжность оценки.';
    if(rank&&rank.title!==rankTitle)rank.title=rankTitle;
  }

  function patchSortLabel(){
    const select=document.getElementById('locationSortMode');
    if(!select)return;
    const weighted=select.querySelector('option[value="weighted"]');
    text(weighted,'По рейтингу оценки');
    const raw=select.querySelector('option[value="raw"]');
    text(raw,'По сумме 70-балльной шкалы');
  }

  async function renderAll(){
    installEngineWrapper();
    const metrics=window.BogatkaDecisionUI?.lastMetrics||[];
    for(const metric of metrics){
      const card=document.querySelector(`[data-location-card="${CSS.escape(metric.id)}"]`);
      if(card)renderMetric(card,metric);
    }
    patchSortLabel();
    markReportBuilder();
  }

  function markReportBuilder(){
    const builder=window.BogatkaLiveReport?.build;
    if(typeof builder==='function')builder.__cardProgressV448=true;
  }

  function installUpdateSummaryWrapper(){
    updateWrapperAttempts+=1;
    if(typeof window.updateSummary!=='function'&&typeof updateSummary!=='function'){
      if(updateWrapperAttempts<120)setTimeout(installUpdateSummaryWrapper,100);
      return;
    }
    const current=window.updateSummary||updateSummary;
    if(current.__cardProgressV448)return;
    const wrapped=async function(...args){
      const result=await current(...args);
      await renderAll();
      return result;
    };
    wrapped.__cardProgressV448=true;
    wrapped.__base=current;
    window.updateSummary=wrapped;
    try{updateSummary=wrapped}catch(_){ }
  }

  function schedule(delay=50){
    clearTimeout(timer);
    timer=setTimeout(()=>renderAll().catch(console.error),delay);
  }

  async function bootstrap(){
    installEngineWrapper();
    installUpdateSummaryWrapper();
    markReportBuilder();
    try{
      if(typeof updateSummary==='function')await updateSummary();
      else await renderAll();
    }catch(error){console.error(error)}
    const root=document.getElementById('locations')||document.body;
    new MutationObserver(()=>schedule(90)).observe(root,{childList:true,subtree:true});
    [200,600,1400,3000,6000].forEach(delay=>setTimeout(()=>{
      installEngineWrapper();
      installUpdateSummaryWrapper();
      markReportBuilder();
      schedule(20);
    },delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrap,{once:true});else bootstrap();
  window.addEventListener('load',()=>schedule(60),{once:true});

  window.BogatkaCardProgressV448={
    version:VERSION,ready:true,scoreAnalysis,buildProgress,transformMetrics,recommendation,renderAll,openTarget,
    GROUP_ORDER,GROUP_WEIGHTS,SCORE_BANDS,
  };
})();

/* Consolidated v462 compatibility surface; keep window.BogatkaUIRefineV462 for callers and saved UI state. */
(function(){
'use strict';
if(window.BogatkaUIRefineV462?.ready)return;
const VERSION='4.6.2';
let timer=null;
let running=false;
const read=key=>{try{return localStorage.getItem(key)}catch(_){return null}};
const write=(key,value)=>{try{localStorage.setItem(key,value)}catch(_){}};

function setOpen(button,content,open,key){
  const value=String(Boolean(open));
  if(button.getAttribute('aria-expanded')!==value)button.setAttribute('aria-expanded',value);
  if(content.hidden===Boolean(open))content.hidden=!open;
  if(key)write(key,open?'1':'0');
}

function splitReason(node){
  if(!node)return false;
  const value=String(node.textContent||'').replace(/\s+/g,' ').trim();
  const match=value.match(/^Оцените минимум 5 критериев\.?\s*Сейчас заполнено\s+(\d+)\s+из\s+(\d+)\.?$/i);
  if(!match)return false;
  const first='Оцените минимум 5 критериев';
  const second=`Сейчас заполнено ${match[1]} из ${match[2]}`;
  if(node.children.length===2&&node.children[0].textContent===first&&node.children[1].textContent===second)return true;
  const one=document.createElement('span');
  const two=document.createElement('span');
  one.className=two.className='recommendation-line-v462';
  one.textContent=first;
  two.textContent=second;
  node.replaceChildren(one,two);
  return true;
}

function ensureFillPlan(overview,card){
  const plan=overview.querySelector('.fill-plan-v448');
  const list=plan?.querySelector('[data-fill-plan-list-v448]');
  if(!plan||!list)return false;
  if(plan.dataset.uiRefineV462==='1')return true;
  const old=plan.querySelector(':scope > .fill-plan-heading-v448');
  const summary=old?.querySelector('[data-fill-plan-summary-v448]')||document.createElement('span');
  summary.dataset.fillPlanSummaryV448='';
  const button=document.createElement('button');
  const copy=document.createElement('span');
  const title=document.createElement('strong');
  const arrow=document.createElement('i');
  button.type='button';
  button.className='fill-plan-toggle-v462';
  copy.className='fill-plan-toggle-copy-v462';
  title.textContent=old?.querySelector('strong')?.textContent||'Что заполнить дальше';
  arrow.className='fill-plan-chevron-v462';
  arrow.setAttribute('aria-hidden','true');
  copy.append(title,summary);
  button.append(copy,arrow);
  old?.replaceWith(button);
  const key=`bogatka_fill_plan_open_v462:${card.dataset.locationCard||'location'}`;
  setOpen(button,list,read(key)==='1',null);
  button.addEventListener('click',()=>setOpen(button,list,button.getAttribute('aria-expanded')!=='true',key));
  plan.dataset.uiRefineV462='1';
  return true;
}

function ensureProgress(card){
  const overview=card.querySelector('.decision-overview-v340.decision-progress-v448');
  if(!overview)return false;
  if(overview.dataset.uiRefineV462==='1'){
    ensureFillPlan(overview,card);
    return true;
  }
  const heading=overview.querySelector(':scope > .progress-heading-v448');
  if(!heading)return false;
  const titleBlock=heading.querySelector(':scope > div:first-child');
  const content=document.createElement('div');
  content.className='progress-card-content-v462';
  while(overview.firstChild)content.append(overview.firstChild);
  heading.remove();
  const button=document.createElement('button');
  const copy=document.createElement('span');
  const title=document.createElement('strong');
  const note=document.createElement('span');
  const arrow=document.createElement('i');
  button.type='button';
  button.className='progress-card-toggle-v462';
  copy.className='progress-card-toggle-copy-v462';
  title.textContent=titleBlock?.querySelector('strong')?.textContent||'Общая оценка и готовность данных';
  note.textContent=titleBlock?.querySelector('span')?.textContent||'Здесь видно, насколько подходит локация и сколько данных уже собрано';
  arrow.className='progress-card-chevron-v462';
  arrow.setAttribute('aria-hidden','true');
  copy.append(title,note);
  button.append(copy,arrow);
  overview.append(button,content);
  const key=`bogatka_progress_open_v462:${card.dataset.locationCard||'location'}`;
  setOpen(button,content,read(key)==='1',null);
  button.addEventListener('click',()=>setOpen(button,content,button.getAttribute('aria-expanded')!=='true',key));
  overview.classList.add('progress-card-v462');
  overview.dataset.uiRefineV462='1';
  ensureFillPlan(overview,card);
  return true;
}

function setImportantStyle(node,name,value){
  if(node.style.getPropertyValue(name)===value&&node.style.getPropertyPriority(name)==='important')return;
  node.style.setProperty(name,value,'important');
}

function applyLayoutGuards(card){
  for(const grid of card.querySelectorAll('.inspection-grid-v416,.landlord-grid-v416')){
    setImportantStyle(grid,'row-gap','12px');
    setImportantStyle(grid,'column-gap','14px');
  }
  const selector='.inspection-grid-v416>label.field:not([hidden]):not(.hidden):not(.panel-hidden-v419),.landlord-grid-v416>label.field:not([hidden]):not(.hidden):not(.panel-hidden-v419),.inspection-grid-v416>.next-task-v447';
  for(const field of card.querySelectorAll(selector))setImportantStyle(field,'gap','5px');
  const metrics=card.querySelector('.progress-metrics-v448');
  if(metrics?.style.getPropertyValue('grid-template-columns'))metrics.style.removeProperty('grid-template-columns');
}

async function syncLegacyStatus(card){
  const select=card.querySelector('select[data-field="status"]');
  const id=card.dataset.locationCard;
  if(!select||!id||select===document.activeElement||select.value)return;
  const data=await getLocationData(id);
  const value=window.BogatkaStatusNextTaskV447?.normalizeStatus?.(data?.status)||String(data?.status||'');
  if(!value||![...select.options].some(option=>option.value===value))return;
  select.value=value;
  const trigger=select.nextElementSibling;
  if(trigger?.classList?.contains('premium-select-trigger')){
    const label=trigger.querySelector('.premium-select-value');
    if(label&&label.textContent!==(select.selectedOptions?.[0]?.textContent||value))label.textContent=select.selectedOptions?.[0]?.textContent||value;
    if(trigger.dataset.syncedValue!==value)trigger.dataset.syncedValue=value;
    if(trigger.disabled!==select.disabled)trigger.disabled=select.disabled;
  }
}

function wrapStatusEnhancer(){
  const api=window.BogatkaStatusNextTaskV447;
  const base=api?.enhanceAll;
  if(!api||typeof base!=='function')return false;
  if(base.__uiRefineV462)return true;
  const wrapped=async function(...args){
    const focused=document.activeElement;
    const restore=focused instanceof HTMLInputElement||focused instanceof HTMLTextAreaElement||focused instanceof HTMLSelectElement;
    const start=restore&&typeof focused.selectionStart==='number'?focused.selectionStart:null;
    const end=restore&&typeof focused.selectionEnd==='number'?focused.selectionEnd:null;
    const result=await base.apply(api,args);
    for(const card of document.querySelectorAll('[data-location-card]'))await syncLegacyStatus(card);
    if(restore&&focused.isConnected&&(document.activeElement===document.body||document.activeElement===null)){
      focused.focus({preventScroll:true});
      if(start!==null&&typeof focused.setSelectionRange==='function')focused.setSelectionRange(start,end??start);
    }
    return result;
  };
  wrapped.__uiRefineV462=true;
  wrapped.__base=base;
  api.enhanceAll=wrapped;
  return true;
}

function enhanceCard(card){
  if(!card?.dataset?.locationCard)return false;
  ensureProgress(card);
  applyLayoutGuards(card);
  return true;
}

function enhanceAll(){
  let count=0;
  for(const card of document.querySelectorAll('[data-location-card]'))if(enhanceCard(card))count+=1;
  return count;
}

function wrapProgressRenderer(){
  const api=window.BogatkaCardProgressV448;
  const base=api?.renderAll;
  if(!api||typeof base!=='function')return false;
  if(base.__uiRefineV462)return true;
  const wrapped=async function(...args){
    const result=await base.apply(api,args);
    enhanceAll();
    return result;
  };
  wrapped.__uiRefineV462=true;
  wrapped.__base=base;
  api.renderAll=wrapped;
  return true;
}

async function completeRuntime(){
  if(running)return;
  running=true;
  try{
    wrapStatusEnhancer();
    wrapProgressRenderer();
    if(!document.querySelector('.decision-progress-v448')&&window.BogatkaCardProgressV448?.ready){
      await window.BogatkaCardProgressV448.renderAll();
    }
    if(window.BogatkaInspectionLayoutV461?.ready){
      await window.BogatkaInspectionLayoutV461.enhanceAll();
    }
    enhanceAll();
  }catch(error){console.error(error)}
  finally{running=false}
}

function schedule(delay=70){
  clearTimeout(timer);
  timer=setTimeout(()=>completeRuntime(),delay);
}

function install(){
  wrapStatusEnhancer();
  wrapProgressRenderer();
  const root=document.getElementById('locations')||document.body;
  new MutationObserver(()=>schedule(90)).observe(root,{childList:true,subtree:true});
  schedule(10);
  [50,150,400,900,1800,3500,6000].forEach(delay=>setTimeout(()=>schedule(0),delay));
  addEventListener('resize',()=>schedule(20),{passive:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.addEventListener('load',()=>schedule(10),{once:true});
window.BogatkaUIRefineV462={version:VERSION,ready:true,enhanceAll,ensureProgressAccordion:ensureProgress,splitRecommendationReason:splitReason,installStatusEnhanceWrapper:wrapStatusEnhancer,installProgressRendererWrapper:wrapProgressRenderer,applyLayoutGuards,completeRuntime};
})();
