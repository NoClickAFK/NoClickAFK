(function(){
  'use strict';
  if(window.BogatkaTrafficCompetitorsV453?.ready)return;

  const VERSION='4.5.3';
  const TRAFFIC_KEY='trafficMeasurements';
  const COMPETITORS_KEY='competitors';
  const TRAFFIC_FIELDS=[
    ['date','Дата замера','date'],
    ['startTime','Начало замера','time'],
    ['durationMinutes','Длительность','select',[['15','15 минут'],['30','30 минут'],['60','60 минут']]],
    ['peopleCount','Всего людей','number'],
    ['targetCustomers','Целевые покупатели','number'],
    ['dogWalkers','Люди с собаками','number'],
    ['competitorVisitors','Посетители конкурента','number'],
    ['parkingOccupiedPct','Занято парковки, %','number'],
    ['weather','Погода','text'],
    ['comment','Комментарий','textarea','wide'],
  ];
  const COMPETITOR_FIELDS=[
    ['name','Название','text'],
    ['type','Тип конкурента','select',[['','Не выбрано'],['Сетевой зоомагазин','Сетевой зоомагазин'],['Независимый зоомагазин','Независимый зоомагазин'],['Ветеринарная аптека','Ветеринарная аптека'],['Супермаркет с зоотоварами','Супермаркет с зоотоварами'],['Пункт выдачи / маркетплейс','Пункт выдачи / маркетплейс'],['Другое','Другое']]],
    ['distance','Расстояние / время пешком','text'],
    ['flow','Примерный поток','text'],
    ['prices','Цены','text'],
    ['assortment','Ассортимент','textarea','wide'],
    ['strengths','Сильные стороны','textarea','wide'],
    ['weaknesses','Слабые стороны','textarea','wide'],
    ['photoReference','Фото конкурента','text'],
    ['comment','Комментарий','textarea','wide'],
  ];
  const timers=new Map();
  let observer=null;
  let scheduleTimer=null;
  let viewerTimer=null;
  let lastError=null;

  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[char]));
  const filled=value=>value!==undefined&&value!==null&&String(value).trim()!=='';
  const cloneList=value=>Array.isArray(value)?value.filter(item=>item&&typeof item==='object').map(item=>({...item,id:item.id||createId()})):[];
  const createId=()=>window.crypto?.randomUUID?.()||`v453-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const isViewer=()=>{try{return window.cloudRole==='viewer'||cloudRole==='viewer'}catch(_){return false}};

  function findDetails(card,title){
    return[...card.querySelectorAll('details')].find(details=>String(details.querySelector(':scope > summary')?.textContent||'').includes(title))||null;
  }

  function weekday(value){
    if(!value)return'День недели появится после выбора даты';
    const date=new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime())?'Проверьте дату':date.toLocaleDateString('ru-RU',{weekday:'long'});
  }

  function fieldHtml(definition,value,extra=''){
    const [key,label,kind,options,wideMarker]=definition;
    const wide=wideMarker==='wide'||options==='wide';
    const common=`data-stage7-field="${escapeHtml(key)}" ${extra}`;
    let control='';
    if(kind==='textarea')control=`<textarea rows="3" ${common}>${escapeHtml(value??'')}</textarea>`;
    else if(kind==='select')control=`<select ${common}>${(options||[]).map(([optionValue,optionLabel])=>`<option value="${escapeHtml(optionValue)}"${String(optionValue)===String(value??'')?' selected':''}>${escapeHtml(optionLabel)}</option>`).join('')}</select>`;
    else control=`<input type="${kind}" value="${escapeHtml(value??'')}"${kind==='number'?' min="0" step="1"':''} ${common}>`;
    return`<label class="field stage7-field-v453${wide?' stage7-wide-v453':''}"><span class="profile-caption-v416">${escapeHtml(label)}</span>${control}</label>`;
  }

  function trafficTemplate(){
    const now=new Date().toISOString();
    return{id:createId(),date:'',startTime:'',durationMinutes:'30',peopleCount:'',targetCustomers:'',dogWalkers:'',competitorVisitors:'',parkingOccupiedPct:'',weather:'',comment:'',createdAt:now,updatedAt:now};
  }

  function competitorTemplate(){
    const now=new Date().toISOString();
    return{id:createId(),name:'',type:'',distance:'',flow:'',prices:'',assortment:'',strengths:'',weaknesses:'',photoReference:'',comment:'',createdAt:now,updatedAt:now};
  }

  function legacyTrafficRows(data={}){
    const definitions=typeof window.TRAFFIC_FIELDS!=='undefined'&&Array.isArray(window.TRAFFIC_FIELDS)?window.TRAFFIC_FIELDS:(typeof TRAFFIC_FIELDS!=='undefined'&&Array.isArray(TRAFFIC_FIELDS)?TRAFFIC_FIELDS:[]);
    const source=data.traffic||{};
    return definitions.filter(([key])=>filled(source[key])).map(([key,label])=>({key,label,value:source[key]}));
  }

  function trafficArticle(item,index){
    return`<article class="traffic-measurement-v453" data-traffic-id="${escapeHtml(item.id)}" data-created-at="${escapeHtml(item.createdAt||'')}"><div class="stage7-card-head-v453"><div><span>Замер ${index+1}</span><strong data-weekday-v453>${escapeHtml(weekday(item.date))}</strong></div><button type="button" class="btn danger small" data-stage7-action="remove-traffic">Удалить</button></div><div class="traffic-measurement-grid-v453">${TRAFFIC_FIELDS.map(definition=>fieldHtml(definition,item[definition[0]])).join('')}</div></article>`;
  }

  function competitorArticle(item,index,legacy=false){
    const extra=legacy?'data-stage7-legacy-competitor="1"':'';
    return`<article class="competitor-card-v453" data-competitor-id="${escapeHtml(legacy?'legacy':item.id)}" data-created-at="${escapeHtml(item.createdAt||'')}" data-competitor-legacy="${legacy?'1':'0'}"><div class="stage7-card-head-v453"><div><span>${legacy?'Ближайший прямой конкурент':`Конкурент ${index+1}`}</span><strong>${legacy?'Старые данные сохранены в прежнем объекте competitor.':'Дополнительный конкурент хранится отдельной записью.'}</strong></div>${legacy?'':`<button type="button" class="btn danger small" data-stage7-action="remove-competitor">Удалить</button>`}</div><div class="competitor-grid-v453">${COMPETITOR_FIELDS.map(definition=>fieldHtml(definition,item[definition[0]],legacy?`${extra} data-field="competitor.${escapeHtml(definition[0])}"`:extra)).join('')}</div></article>`;
  }

  function updateTrafficSummary(root){
    const rows=[...root.querySelectorAll('.traffic-measurement-v453')];
    const minutes=rows.reduce((sum,row)=>sum+(Number(row.querySelector('[data-stage7-field="durationMinutes"]')?.value)||0),0);
    const people=rows.reduce((sum,row)=>sum+(Number(row.querySelector('[data-stage7-field="peopleCount"]')?.value)||0),0);
    const values={count:rows.length,minutes,people};
    for(const [key,value] of Object.entries(values)){
      const node=root.querySelector(`[data-traffic-summary-v453="${key}"]`);
      if(node)node.textContent=String(value);
    }
  }

  function renderTraffic(card,data={},force=false){
    const body=findDetails(card,'Полевой замер трафика')?.querySelector('.details-body');
    if(!body)return false;
    if(body.querySelector('.traffic-stage7-v453')&&!force)return true;
    const rows=cloneList(data[TRAFFIC_KEY]);
    const legacy=legacyTrafficRows(data);
    body.innerHTML=`<div class="traffic-stage7-v453"><p class="section-note"><strong>Каждый замер хранится отдельно.</strong> Укажите дату, начало, длительность, погоду и комментарий.</p><div class="traffic-summary-v453"><div><span>Замеров</span><strong data-traffic-summary-v453="count">0</strong></div><div><span>Всего минут</span><strong data-traffic-summary-v453="minutes">0</strong></div><div><span>Учтено людей</span><strong data-traffic-summary-v453="people">0</strong></div></div>${legacy.length?`<details class="legacy-traffic-v453"><summary>Ранее сохранённые поля — ${legacy.length}</summary><div class="legacy-traffic-grid-v453">${legacy.map(row=>`<div><span>${escapeHtml(row.label)}</span><strong>${escapeHtml(row.value)}</strong></div>`).join('')}</div><p>Значения сохранены без преобразования и не удаляются.</p></details>`:''}<div class="traffic-measurements-list-v453">${rows.length?rows.map(trafficArticle).join(''):'<div class="stage7-empty-v453">Замеров пока нет.</div>'}</div><button type="button" class="btn secondary" data-stage7-action="add-traffic">+ Добавить замер</button></div>`;
    updateTrafficSummary(body);
    return true;
  }

  function renderCompetitors(card,data={},force=false){
    const body=findDetails(card,'Конкуренты и окружение')?.querySelector('.details-body');
    if(!body)return false;
    if(body.querySelector('.competitors-stage7-v453')&&!force)return true;
    const legacy=data.competitor&&typeof data.competitor==='object'?{...data.competitor}:{};
    const extras=cloneList(data[COMPETITORS_KEY]);
    body.innerHTML=`<div class="competitors-stage7-v453"><p class="section-note"><strong>Фиксируйте каждого конкурента отдельно.</strong> Фото добавляйте в категорию «Конкуренты».</p><div class="competitors-list-v453">${competitorArticle(legacy,0,true)}${extras.map((item,index)=>competitorArticle(item,index+1,false)).join('')}</div><button type="button" class="btn secondary" data-stage7-action="add-competitor">+ Добавить конкурента</button></div>`;
    body.querySelectorAll('[data-stage7-legacy-competitor][data-field]').forEach(control=>control.dataset.location=card.dataset.locationCard||'');
    return true;
  }

  function controlValue(control){
    if(control.type==='checkbox')return control.checked;
    return control.value;
  }

  function collectRows(card,selector,idAttribute,fields){
    return[...card.querySelectorAll(selector)].map(row=>{
      const item={id:row.getAttribute(idAttribute)||createId(),createdAt:row.dataset.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
      for(const [key] of fields)item[key]=controlValue(row.querySelector(`[data-stage7-field="${key}"]`)||{value:''});
      return item;
    });
  }

  function saveProxy(locationId,field,value,label){
    return{dataset:{location:locationId,field},type:'custom',value,checked:false,closest(selector){return selector==='label'?{childNodes:[{textContent:label}]}:null;}};
  }

  async function saveValue(locationId,field,value,label){
    if(isViewer())return false;
    const save=window.saveField||((typeof saveField==='function')?saveField:null);
    if(typeof save!=='function')throw new Error('Не найдена функция сохранения данных.');
    await save(saveProxy(locationId,field,value,label));
    return true;
  }

  function scheduleSave(key,callback,delay=240){
    clearTimeout(timers.get(key));
    timers.set(key,setTimeout(()=>{
      timers.delete(key);
      callback().catch(error=>{
        lastError=error;
        if(typeof window.showError==='function')window.showError(error);else console.error(error);
      });
    },delay));
  }

  async function saveTraffic(card){
    const locationId=card.dataset.locationCard;
    const rows=collectRows(card,'.traffic-measurement-v453','data-traffic-id',TRAFFIC_FIELDS);
    await saveValue(locationId,TRAFFIC_KEY,rows,'Замеры трафика');
  }

  async function saveCompetitors(card){
    const locationId=card.dataset.locationCard;
    const rows=collectRows(card,'.competitor-card-v453[data-competitor-legacy="0"]','data-competitor-id',COMPETITOR_FIELDS);
    await saveValue(locationId,COMPETITORS_KEY,rows,'Дополнительные конкуренты');
  }

  async function addTraffic(card){
    const list=card.querySelector('.traffic-measurements-list-v453');
    if(!list)return;
    list.querySelector('.stage7-empty-v453')?.remove();
    const index=list.querySelectorAll('.traffic-measurement-v453').length;
    list.insertAdjacentHTML('beforeend',trafficArticle(trafficTemplate(),index));
    updateTrafficSummary(card);
    applyViewerState(card);
    await saveTraffic(card);
  }

  async function addCompetitor(card){
    const list=card.querySelector('.competitors-list-v453');
    if(!list)return;
    const index=list.querySelectorAll('.competitor-card-v453[data-competitor-legacy="0"]').length+1;
    list.insertAdjacentHTML('beforeend',competitorArticle(competitorTemplate(),index,false));
    applyViewerState(card);
    await saveCompetitors(card);
  }

  async function removeTraffic(card,article){
    if(!window.confirm('Удалить этот замер трафика?'))return;
    article.remove();
    const list=card.querySelector('.traffic-measurements-list-v453');
    if(list&&!list.querySelector('.traffic-measurement-v453'))list.innerHTML='<div class="stage7-empty-v453">Замеров пока нет.</div>';
    updateTrafficSummary(card);
    await saveTraffic(card);
  }

  async function removeCompetitor(card,article){
    if(!window.confirm('Удалить этого конкурента?'))return;
    article.remove();
    await saveCompetitors(card);
  }

  function applyViewerState(root=document){
    const readOnly=isViewer();
    root.querySelectorAll?.('.traffic-stage7-v453 input,.traffic-stage7-v453 select,.traffic-stage7-v453 textarea,.competitors-stage7-v453 input,.competitors-stage7-v453 select,.competitors-stage7-v453 textarea').forEach(control=>control.disabled=readOnly);
    root.querySelectorAll?.('[data-stage7-action]').forEach(button=>{button.hidden=readOnly;button.disabled=readOnly;});
  }

  async function enhanceCard(card){
    const locationId=card?.dataset?.locationCard;
    if(!locationId||typeof window.getLocationData!=='function')return false;
    const data=await window.getLocationData(locationId);
    const traffic=renderTraffic(card,data);
    const competitors=renderCompetitors(card,data);
    applyViewerState(card);
    if(traffic&&competitors)card.dataset.trafficCompetitorsV453='1';
    return traffic&&competitors;
  }

  async function enhanceAll(){
    try{
      if(window.BogatkaWorkflowV414?.FIELD_LABELS)Object.assign(window.BogatkaWorkflowV414.FIELD_LABELS,{trafficMeasurements:'Замеры трафика',competitors:'Дополнительные конкуренты'});
      for(const card of document.querySelectorAll('[data-location-card]'))await enhanceCard(card);
      applyViewerState(document);
      lastError=null;
      return true;
    }catch(error){
      lastError=error;
      console.error(error);
      return false;
    }
  }

  function audit(){
    const failures=[];
    for(const card of document.querySelectorAll('[data-location-card]')){
      const id=card.dataset.locationCard;
      if(!card.querySelector('.traffic-stage7-v453'))failures.push(`${id}:traffic:missing`);
      if(!card.querySelector('.competitors-stage7-v453'))failures.push(`${id}:competitors:missing`);
      if(card.querySelector('[data-field^="traffic."]'))failures.push(`${id}:legacy-traffic:visible`);
      if(!card.querySelector('[data-field="competitor.name"]'))failures.push(`${id}:legacy-competitor:missing`);
    }
    return{ok:failures.length===0,failures,lastError:lastError?String(lastError):''};
  }

  function schedule(delay=80){
    clearTimeout(scheduleTimer);
    scheduleTimer=setTimeout(()=>enhanceAll(),delay);
  }

  function install(){
    const root=document.getElementById('locations')||document.body;
    root.addEventListener('click',event=>{
      const button=event.target.closest?.('[data-stage7-action]');
      const card=button?.closest?.('[data-location-card]');
      if(!button||!card||isViewer())return;
      const action=button.dataset.stage7Action;
      const run=action==='add-traffic'?addTraffic(card):action==='add-competitor'?addCompetitor(card):action==='remove-traffic'?removeTraffic(card,button.closest('.traffic-measurement-v453')):action==='remove-competitor'?removeCompetitor(card,button.closest('.competitor-card-v453')):null;
      if(run?.catch)run.catch(error=>{lastError=error;console.error(error);});
    });
    const changeHandler=event=>{
      const control=event.target;
      const card=control?.closest?.('[data-location-card]');
      if(!card||isViewer())return;
      const trafficRow=control.closest?.('.traffic-measurement-v453');
      const competitorRow=control.closest?.('.competitor-card-v453');
      if(trafficRow){
        if(control.dataset.stage7Field==='date')trafficRow.querySelector('[data-weekday-v453]').textContent=weekday(control.value);
        updateTrafficSummary(card);
        scheduleSave(`${card.dataset.locationCard}:traffic`,()=>saveTraffic(card));
      }else if(competitorRow?.dataset.competitorLegacy==='1'){
        const field=control.dataset.field;
        if(field)scheduleSave(`${card.dataset.locationCard}:${field}`,()=>saveValue(card.dataset.locationCard,field,controlValue(control),control.closest('label')?.textContent?.trim()||field));
      }else if(competitorRow){
        scheduleSave(`${card.dataset.locationCard}:competitors`,()=>saveCompetitors(card));
      }
    };
    root.addEventListener('input',changeHandler,true);
    root.addEventListener('change',changeHandler,true);
    observer=new MutationObserver(()=>schedule(100));
    observer.observe(root,{childList:true,subtree:true});
    schedule(20);
    [250,700,1500,3000,6000].forEach(delay=>setTimeout(()=>schedule(0),delay));
    viewerTimer=setInterval(()=>applyViewerState(document),1200);
  }

  const api={
    version:VERSION,
    ready:true,
    TRAFFIC_FIELDS,
    COMPETITOR_FIELDS,
    trafficTemplate,
    competitorTemplate,
    legacyTrafficRows,
    renderTraffic,
    renderCompetitors,
    enhanceAll,
    enhanceCard,
    applyViewerState,
    audit,
    get lastError(){return lastError;},
    get viewerTimer(){return viewerTimer;},
  };
  window.BogatkaTrafficCompetitorsV453=api;

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('load',()=>schedule(20),{once:true});
})();
