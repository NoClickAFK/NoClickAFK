(function(){
  'use strict';
  if(window.BogatkaOpeningProjectV455?.ready)return;

  const VERSION='4.5.5';
  const PHASES=[
    {key:'contract',title:'1. Договор и передача помещения',items:[
      ['lease_signed','Договор аренды подписан'],['deposit_paid','Депозит и первый платёж внесены'],['transfer_act','Акт передачи помещения подписан'],['keys_received','Ключи и доступ к помещению получены'],['landlord_work_done','Работы арендодателя до передачи завершены']
    ]},
    {key:'planning',title:'2. Планировка и согласования',items:[
      ['technical_survey','Техническое обследование завершено'],['measurements_done','Выполнены обмеры помещения'],['layout_approved','Планировка утверждена'],['design_approved','Дизайн и рабочий проект утверждены'],['engineering_approved','Инженерные решения согласованы'],['signage_approved','Вывеска и наружное оформление согласованы']
    ]},
    {key:'repair',title:'3. Ремонт и подготовка помещения',items:[
      ['repair_estimate','Смета ремонта согласована'],['contractor_selected','Подрядчик выбран и договор заключён'],['materials_ordered','Материалы заказаны'],['rough_work_done','Черновые и демонтажные работы завершены'],['engineering_work_done','Электрика, вентиляция и другие инженерные работы завершены'],['finish_work_done','Чистовые работы завершены'],['repair_accepted','Ремонт принят, помещение убрано']
    ]},
    {key:'equipment',title:'4. Оборудование и системы',items:[
      ['trade_equipment','Торговое оборудование установлено'],['lighting_ready','Освещение установлено и проверено'],['internet_cash','Интернет и кассовая система подключены'],['security_video','Охрана и видеонаблюдение подключены'],['fire_system','Пожарная система проверена'],['signage_installed','Вывеска изготовлена и установлена']
    ]},
    {key:'supply',title:'5. Поставщики и товар',items:[
      ['suppliers_agreed','Поставщики и условия поставок согласованы'],['assortment_agreed','Стартовый ассортимент утверждён'],['initial_order','Стартовый заказ размещён'],['initial_delivery','Первая поставка принята'],['merchandising_done','Товар размещён и ценники подготовлены']
    ]},
    {key:'staff',title:'6. Персонал',items:[
      ['staff_plan','Штат и график работы определены'],['staff_hired','Персонал подобран'],['staff_trained','Персонал обучен'],['staff_documents','Документы и доступы сотрудников оформлены'],['test_shift','Проведена тестовая смена']
    ]},
    {key:'opening',title:'7. Реклама и открытие',items:[
      ['marketing_plan','План продвижения открытия утверждён'],['maps_social','Карты, сайт и социальные площадки обновлены'],['promo_materials','Рекламные материалы подготовлены'],['opening_event','Сценарий и предложение на открытие подготовлены'],['final_readiness','Финальная готовность магазина проверена'],['store_opened','Магазин открыт']
    ]}
  ];
  const templates=PHASES.flatMap((phase,phaseIndex)=>phase.items.map(([key,title],itemIndex)=>({templateKey:key,title,phase:phase.key,order:phaseIndex*100+itemIndex})));
  const templateByTitle=new Map(templates.map(item=>[item.title,item]));
  let attempts=0;
  let reportAttempts=0;
  let renderTimer=null;
  let lastError=null;

  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const isViewer=()=>{try{return window.cloudRole==='viewer'||cloudRole==='viewer'}catch(_){return false}};
  const suite=()=>window.BogatkaSuite;
  const gateApi=()=>window.BogatkaLaunchGateV454;
  const now=()=>new Date().toISOString();

  function activeLocations(){
    try{if(typeof locations!=='undefined'&&Array.isArray(locations))return locations.filter(item=>!item.archivedAt);}catch(_){ }
    return Array.isArray(window.locations)?window.locations.filter(item=>!item.archivedAt):[];
  }

  function inferPhase(item={}){
    if(PHASES.some(phase=>phase.key===item.phase))return item.phase;
    const match=templateByTitle.get(String(item.title||''));
    if(match)return match.phase;
    const title=String(item.title||'').toLowerCase();
    if(/договор|депозит|акт передачи|ключ/.test(title))return'contract';
    if(/планир|проект|дизайн|обслед|соглас|вывес/.test(title))return'planning';
    if(/ремонт|смет|подряд|материал|уборк/.test(title))return'repair';
    if(/оборуд|интернет|касс|охран|видео|пожар|освещ/.test(title))return'equipment';
    if(/постав|ассортимент|товар|ценник/.test(title))return'supply';
    if(/персонал|сотруд|обуч|смен/.test(title))return'staff';
    return'opening';
  }

  function projectAnalysis(project={}){
    const milestones=Array.isArray(project.milestones)?project.milestones:[];
    const existingKeys=new Set(milestones.map(item=>item.templateKey).filter(Boolean));
    const existingTitles=new Set(milestones.map(item=>String(item.title||'')));
    const missing=templates.filter(item=>!existingKeys.has(item.templateKey)&&!existingTitles.has(item.title));
    const grouped=Object.fromEntries(PHASES.map(phase=>[phase.key,[]]));
    milestones.forEach(item=>(grouped[inferPhase(item)]||grouped.opening).push(item));
    Object.values(grouped).forEach(items=>items.sort((a,b)=>(a.order??9999)-(b.order??9999)));
    const done=milestones.filter(item=>item.status==='done').length;
    return{milestones,grouped,missing,done,total:milestones.length,percent:milestones.length?Math.round(done/milestones.length*100):0};
  }

  function expandProjectData(data){
    const project=data.launchProject;
    if(!project?.enabled)return{project,added:0,changed:false};
    project.milestones=Array.isArray(project.milestones)?project.milestones:[];
    let changed=false;
    for(const item of project.milestones){
      const match=templateByTitle.get(String(item.title||''));
      if(!item.phase){item.phase=match?.phase||inferPhase(item);changed=true;}
      if(!item.templateKey&&match){item.templateKey=match.templateKey;changed=true;}
    }
    const analysis=projectAnalysis(project);
    for(const template of analysis.missing){
      project.milestones.push({id:crypto.randomUUID(),templateKey:template.templateKey,title:template.title,phase:template.phase,order:template.order,status:'todo',assignee:'',dueDate:'',note:'',createdAt:now()});
      changed=true;
    }
    if(project.schemaVersion!==VERSION){project.schemaVersion=VERSION;changed=true;}
    return{project,added:analysis.missing.length,changed};
  }

  function installEnsureWrapper(){
    const api=suite();
    const current=api?.ensureLaunchProject;
    if(typeof current!=='function')return false;
    if(current.__openingProjectV455)return true;
    const wrapped=function(data){
      const wasEnabled=Boolean(data?.launchProject?.enabled);
      const project=current(data);
      if(!wasEnabled)expandProjectData(data);
      return project;
    };
    Object.assign(wrapped,current);wrapped.__openingProjectV455=true;wrapped.__base=current;
    api.ensureLaunchProject=wrapped;
    return true;
  }

  async function expandStoredProject(locationId){
    if(isViewer())return;
    const data=await getLocationData(locationId);
    const result=expandProjectData(data);
    if(!result.changed)return;
    suite()?.appendActivityToData?.(data,{action:'Расширен проект открытия',label:'Проект открытия',details:`Добавлено этапов: ${result.added}`});
    data.updatedAt=now();
    await idbPut(STORE,data,`location:${locationId}`);
    await updateSummary();
    await renderAll();
  }

  function statusLabel(status){return({todo:'Не начато',doing:'В работе',waiting:'Ожидает',done:'Готово'})[status]||'Не начато';}

  function phaseMarkup(phase,items){
    const done=items.filter(item=>item.status==='done').length;
    return`<details class="launch-v455-phase" data-launch-phase-v455="${phase.key}" open><summary><div>${esc(phase.title)}<small>${done} из ${items.length} завершено</small></div><strong>${items.length?Math.round(done/items.length*100):0}%</strong></summary><div class="launch-v455-phase-body">${items.length?items.map(item=>`<article class="launch-v455-milestone ${item.status==='done'?'done':''}" data-launch-milestone-v455="${esc(item.id)}"><div><strong>${esc(item.title)}</strong><small>${esc(item.note||'')}</small></div><select data-launch-v455-status="${esc(item.id)}"><option value="todo"${item.status==='todo'?' selected':''}>Не начато</option><option value="doing"${item.status==='doing'?' selected':''}>В работе</option><option value="waiting"${item.status==='waiting'?' selected':''}>Ожидает</option><option value="done"${item.status==='done'?' selected':''}>Готово</option></select><input type="text" value="${esc(item.assignee||'')}" placeholder="Ответственный" data-launch-v455-assignee="${esc(item.id)}"><input type="date" value="${esc(item.dueDate||'')}" data-launch-v455-date="${esc(item.id)}"></article>`).join(''):'<div class="launch-v455-empty">В этой фазе пока нет этапов.</div>'}</div></details>`;
  }

  function renderProject(card,data={}){
    const id=card.dataset.locationCard;
    const body=card.querySelector(`[data-launch-body="${CSS.escape(id)}"]`);
    const label=card.querySelector(`[data-launch-label="${CSS.escape(id)}"]`);
    const details=card.querySelector(`[data-launch-details="${CSS.escape(id)}"]`);
    const project=data.launchProject;
    if(!body||!details||!project?.enabled||!gateApi()?.gateState(data).allowed)return false;
    if(body.contains(document.activeElement)){schedule(500);return true;}
    const analysis=projectAnalysis(project);
    if(label)label.textContent=`${analysis.done}/${analysis.total} · ${analysis.percent}%`;
    details.dataset.openingProjectV455='1';
    body.innerHTML=`<div class="launch-v455" data-viewer="${isViewer()?'1':'0'}"><div class="launch-v455-overview"><div><span>Текущая фаза</span><strong>${esc(project.stage||'Подготовка договора')}</strong></div><div><span>Плановая дата</span><strong>${esc(project.targetDate||'не задана')}</strong></div><div><span>Ответственный</span><strong>${esc(project.manager||'не назначен')}</strong></div><div><span>Общий прогресс</span><strong>${analysis.done}/${analysis.total} · ${analysis.percent}%</strong></div></div><div class="launch-v455-progress"><span style="width:${analysis.percent}%"></span></div><div class="launch-v455-fields"><label class="field">Текущая фаза<select data-launch-v455-field="stage"><option>Подготовка договора</option><option>Планировка и согласования</option><option>Ремонт</option><option>Оборудование и системы</option><option>Поставщики и товар</option><option>Персонал</option><option>Реклама и открытие</option><option>Открыт</option></select></label><label class="field">Плановая дата<input type="date" data-launch-v455-field="targetDate" value="${esc(project.targetDate||'')}"></label><label class="field">Ответственный<input type="text" data-launch-v455-field="manager" value="${esc(project.manager||'')}"></label><label class="field">Бюджет проекта, BYN<input type="number" step="any" data-launch-v455-field="budget" value="${esc(project.budget||'')}"></label><label class="field launch-v455-notes">Примечания по запуску<textarea rows="3" data-launch-v455-field="notes">${esc(project.notes||'')}</textarea></label></div>${analysis.missing.length?`<div class="launch-v455-actions"><button type="button" class="btn secondary" data-launch-v455-action="expand">Добавить недостающие этапы (${analysis.missing.length})</button><p>Существующие этапы и их статусы не изменятся.</p></div>`:''}<div class="launch-v455-phases">${PHASES.map(phase=>phaseMarkup(phase,analysis.grouped[phase.key])).join('')}</div></div>`;
    const stage=body.querySelector('[data-launch-v455-field="stage"]');if(stage)stage.value=project.stage||'Подготовка договора';
    body.querySelectorAll('[data-launch-v455-field]').forEach(control=>{control.disabled=isViewer();control.addEventListener('change',()=>suite().saveLaunchField(id,control.dataset.launchV455Field,control.value).catch(showError));});
    body.querySelectorAll('[data-launch-v455-status]').forEach(control=>{control.disabled=isViewer();control.addEventListener('change',()=>suite().updateMilestone(id,control.dataset.launchV455Status,{status:control.value,phase:inferPhase(analysis.milestones.find(item=>item.id===control.dataset.launchV455Status))}).catch(showError));});
    body.querySelectorAll('[data-launch-v455-assignee]').forEach(control=>{control.disabled=isViewer();control.addEventListener('change',()=>suite().updateMilestone(id,control.dataset.launchV455Assignee,{assignee:control.value}).catch(showError));});
    body.querySelectorAll('[data-launch-v455-date]').forEach(control=>{control.disabled=isViewer();control.addEventListener('change',()=>suite().updateMilestone(id,control.dataset.launchV455Date,{dueDate:control.value}).catch(showError));});
    body.querySelector('[data-launch-v455-action="expand"]')?.addEventListener('click',()=>expandStoredProject(id).catch(showError));
    return true;
  }

  async function renderAll(){
    try{
      installEnsureWrapper();
      for(const card of document.querySelectorAll('[data-location-card]'))renderProject(card,await getLocationData(card.dataset.locationCard));
      lastError=null;return true;
    }catch(error){lastError=error;console.error(error);return false;}
  }

  function reportProjectHtml(data={}){
    const project=data.launchProject;if(!project?.enabled||!gateApi()?.gateState(data).allowed)return'';
    const analysis=projectAnalysis(project);
    return`<section class="report-suite-section launch-report launch-report-v455"><h3>Проект открытия: ${analysis.done}/${analysis.total} (${analysis.percent}%)</h3><div class="report-suite-grid"><div><b>Фаза:</b> ${esc(project.stage||'—')}</div><div><b>Дата:</b> ${esc(project.targetDate||'—')}</div><div><b>Ответственный:</b> ${esc(project.manager||'—')}</div><div><b>Бюджет:</b> ${esc(project.budget||'—')} BYN</div></div>${PHASES.map(phase=>{const items=analysis.grouped[phase.key];if(!items.length)return'';return`<h4>${esc(phase.title)}</h4><ol class="report-milestones">${items.map(item=>`<li class="${item.status==='done'?'done':''}"><b>${esc(item.title)}</b><span>${esc(item.assignee||'—')} · ${esc(item.dueDate||'без срока')} · ${esc(statusLabel(item.status))}</span></li>`).join('')}</ol>`;}).join('')}</section>`;
  }

  async function transformReport(html){
    const documentReport=new DOMParser().parseFromString(html,'text/html');
    const cards=[...documentReport.querySelectorAll('.report-location-card,.report-location')];
    const items=activeLocations();
    for(let index=0;index<cards.length;index++){
      const location=items[index];if(!location)continue;
      const data=await getLocationData(location.id);
      cards[index].querySelectorAll('.launch-report').forEach(section=>section.remove());
      const markup=reportProjectHtml(data);
      if(markup)(cards[index].querySelector('.report-suite-v400,.report-location-body,.location-body')||cards[index]).insertAdjacentHTML('beforeend',markup);
    }
    return`<!doctype html>\n${documentReport.documentElement.outerHTML}`;
  }

  function chainContains(fn,marker){const seen=new Set();while(typeof fn==='function'&&!seen.has(fn)){if(fn[marker])return true;seen.add(fn);fn=fn.__base;}return false;}
  function installReport(){
    reportAttempts+=1;const api=window.BogatkaLiveReport;const current=api?.build;
    if(typeof current!=='function'||!current.__launchGateV454){if(reportAttempts<220)setTimeout(installReport,100);return false;}
    if(chainContains(current,'__openingProjectV455'))return true;
    const wrapped=async function(...args){return transformReport(await current(...args));};Object.assign(wrapped,current);wrapped.__openingProjectV455=true;wrapped.__base=current;api.build=wrapped;window.buildReportHtml=wrapped;try{buildReportHtml=wrapped}catch(_){ }return true;
  }

  function schedule(delay=100){clearTimeout(renderTimer);renderTimer=setTimeout(()=>renderAll(),delay);}
  function audit(){const failures=[];document.querySelectorAll('[data-location-card]').forEach(card=>{const dataNode=card.querySelector('[data-launch-details]');if(dataNode?.dataset.launchGateV454==='ready'&&dataNode.querySelector('[data-launch-body]')?.children.length&&!dataNode.dataset.openingProjectV455)failures.push(`${card.dataset.locationCard}:v455-missing`);});return{ok:failures.length===0,failures,lastError:lastError?String(lastError):''};}

  function install(){
    attempts+=1;if(!suite()||!gateApi()){if(attempts<220)setTimeout(install,80);return;}
    installEnsureWrapper();const root=document.getElementById('locations')||document.body;
    new MutationObserver(records=>{if(records.some(record=>record.target.closest?.('[data-launch-details]')))schedule(120);}).observe(root,{childList:true,subtree:true});
    root.addEventListener('focusout',event=>{if(event.target.closest?.('[data-launch-body]'))schedule(250);},true);
    schedule(20);[500,1200,2500,5000].forEach(delay=>setTimeout(()=>schedule(0),delay));installReport();
  }

  window.BogatkaOpeningProjectV455={version:VERSION,ready:true,PHASES,templates,inferPhase,projectAnalysis,expandProjectData,renderProject,renderAll,reportProjectHtml,transformReport,audit,get lastError(){return lastError;}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
