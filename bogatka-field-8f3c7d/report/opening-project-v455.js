(function(){
  'use strict';
  if(window.BogatkaPublicOpeningProjectV455?.ready)return;

  const VERSION='4.5.5';
  const PHASES=[['contract','1. Договор и передача помещения'],['planning','2. Планировка и согласования'],['repair','3. Ремонт и подготовка помещения'],['equipment','4. Оборудование и системы'],['supply','5. Поставщики и товар'],['staff','6. Персонал'],['opening','7. Реклама и открытие']];
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const status=value=>({todo:'не начато',doing:'в работе',waiting:'ожидает',done:'готово'})[value]||value||'не начато';
  let attempts=0;

  function inferPhase(item={}){
    if(PHASES.some(([key])=>key===item.phase))return item.phase;
    const title=String(item.title||'').toLowerCase();
    if(/договор|депозит|акт передачи|ключ/.test(title))return'contract';
    if(/планир|проект|дизайн|обслед|соглас|вывес/.test(title))return'planning';
    if(/ремонт|смет|подряд|материал|уборк/.test(title))return'repair';
    if(/оборуд|интернет|касс|охран|видео|пожар|освещ/.test(title))return'equipment';
    if(/постав|ассортимент|товар|ценник/.test(title))return'supply';
    if(/персонал|сотруд|обуч|смен/.test(title))return'staff';
    return'opening';
  }

  function allowed(data={}){return String(data.decision||'').trim()==='Оставить'&&window.BogatkaCriticalDeal?.evaluate?.(data)?.code==='confirmed';}

  function html(data={}){
    const project=data.launchProject;
    if(!project?.enabled||!allowed(data))return'';
    const milestones=Array.isArray(project.milestones)?project.milestones:[];
    const done=milestones.filter(item=>item.status==='done').length;
    const grouped=Object.fromEntries(PHASES.map(([key])=>[key,[]]));
    milestones.forEach(item=>(grouped[inferPhase(item)]||grouped.opening).push(item));
    return`<section class="report-extra public-opening-v455"><h3>Проект открытия: ${done}/${milestones.length}</h3><div class="summary-grid"><div><b>Фаза:</b> ${esc(project.stage||'—')}</div><div><b>Дата открытия:</b> ${esc(project.targetDate||'—')}</div><div><b>Ответственный:</b> ${esc(project.manager||'—')}</div><div><b>Бюджет:</b> ${esc(project.budget||'—')} BYN</div></div>${PHASES.map(([key,title])=>grouped[key].length?`<h4>${esc(title)}</h4><ol class="milestones">${grouped[key].map(item=>`<li class="${item.status==='done'?'done':''}"><b>${esc(item.title)}</b><span>${esc(item.assignee||'—')} · ${esc(item.dueDate||'без срока')} · ${esc(status(item.status))}</span></li>`).join('')}</ol>`:'').join('')}</section>`;
  }

  function removeOld(article){[...article.querySelectorAll('h3')].filter(heading=>heading.textContent.trim().startsWith('Проект открытия')).forEach(heading=>heading.closest('section')?.remove());}

  function install(){
    attempts+=1;
    const current=window.renderReport||((typeof renderReport==='function')?renderReport:null);
    if(typeof current!=='function'){if(attempts<120)setTimeout(install,50);return false;}
    if(current.__openingProjectV455)return true;
    const wrapped=function(payload){
      const result=current(payload);
      const items=(Array.isArray(payload?.snapshot?.locations)?payload.snapshot.locations:[]).filter(location=>!location.form_data?.archivedAt);
      document.querySelectorAll('#reportRoot article.location').forEach((article,index)=>{removeOld(article);const markup=html(items[index]?.form_data||{});if(markup)article.querySelector('.location-body')?.insertAdjacentHTML('beforeend',markup);});
      return result;
    };
    Object.assign(wrapped,current);wrapped.__openingProjectV455=true;wrapped.__base=current;window.renderReport=wrapped;try{renderReport=wrapped}catch(_){ }
    setTimeout(()=>{try{if(typeof loadReport==='function')loadReport()}catch(error){console.error(error);}},0);return true;
  }

  window.BogatkaPublicOpeningProjectV455={version:VERSION,ready:true,PHASES,inferPhase,allowed,html,install};
  install();
})();
