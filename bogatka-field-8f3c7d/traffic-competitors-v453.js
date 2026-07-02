(function(){
  'use strict';
  if(window.BogatkaTrafficCompetitorsV453?.ready)return;

  const VERSION='4.5.3';
  const TRAFFIC_KEY='trafficMeasurements';
  const COMPETITORS_KEY='competitors';
  const TRAFFIC_FIELDS=[
    ['date','Дата замера','date'],['startTime','Начало замера','time'],
    ['durationMinutes','Длительность','select',[['15','15 минут'],['30','30 минут'],['60','60 минут']]],
    ['peopleCount','Всего людей','number'],['targetCustomers','Целевые покупатели','number'],
    ['dogWalkers','Люди с собаками','number'],['competitorVisitors','Посетители конкурента','number'],
    ['parkingOccupiedPct','Занято парковки, %','number'],['weather','Погода','text'],
    ['comment','Комментарий','textarea',null,true],
  ];
  const COMPETITOR_FIELDS=[
    ['name','Название','text'],
    ['type','Тип конкурента','select',[['','Не выбрано'],['Сетевой зоомагазин','Сетевой зоомагазин'],['Независимый зоомагазин','Независимый зоомагазин'],['Ветеринарная аптека','Ветеринарная аптека'],['Супермаркет с зоотоварами','Супермаркет с зоотоварами'],['Пункт выдачи / маркетплейс','Пункт выдачи / маркетплейс'],['Другое','Другое']]],
    ['distance','Расстояние / время пешком','text'],['flow','Примерный поток','text'],['prices','Цены','text'],
    ['assortment','Ассортимент','textarea',null,true],['strengths','Сильные стороны','textarea',null,true],
    ['weaknesses','Слабые стороны','textarea',null,true],['photoReference','Фото конкурента','text'],
    ['comment','Комментарий','textarea',null,true],
  ];
  const timers=new Map();
  let observer=null;
  let scheduleTimer=null;
  let lastError=null;
  let reportAttempts=0;

  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const filled=value=>value!==undefined&&value!==null&&String(value).trim()!=='';
  const createId=()=>window.crypto?.randomUUID?.()||`v453-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const normalizeList=value=>Array.isArray(value)?value.filter(item=>item&&typeof item==='object').map(item=>({...item,id:item.id||createId()})):[];
  const isViewer=()=>{try{return window.cloudRole==='viewer'||cloudRole==='viewer'}catch(_){return false}};

  function findDetails(card,title){
    return[...card.querySelectorAll('details')].find(node=>String(node.querySelector(':scope > summary')?.textContent||'').includes(title))||null;
  }

  function weekday(value){
    if(!value)return'День недели появится после выбора даты';
    const date=new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime())?'Проверьте дату':date.toLocaleDateString('ru-RU',{weekday:'long'});
  }

  function fieldHtml([key,label,kind,options,wide],value,extra=''){
    const common=`data-stage7-field="${esc(key)}" ${extra}`;
    let control='';
    if(kind==='textarea')control=`<textarea rows="3" ${common}>${esc(value??'')}</textarea>`;
    else if(kind==='select')control=`<select ${common}>${options.map(([optionValue,optionLabel])=>`<option value="${esc(optionValue)}"${String(optionValue)===String(value??'')?' selected':''}>${esc(optionLabel)}</option>`).join('')}</select>`;
    else control=`<input type="${kind}" value="${esc(value??'')}"${kind==='number'?' min="0" step="1"':''} ${common}>`;
    return`<label class="field stage7-field-v453${wide?' stage7-wide-v453':''}"><span class="profile-caption-v416">${esc(label)}</span>${control}</label>`;
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
    const definitions=Array.isArray(window.TRAFFIC_FIELDS)?window.TRAFFIC_FIELDS:[];
    const source=data.traffic||{};
    return definitions.filter(([key])=>filled(source[key])).map(([key,label])=>({key,label,value:source[key]}));
  }

  function trafficArticle(item,index){
    return`<article class="traffic-measurement-v453" data-traffic-id="${esc(item.id)}" data-created-at="${esc(item.createdAt||'')}"><div class="stage7-card-head-v453"><div><span>Замер ${index+1}</span><strong data-weekday-v453>${esc(weekday(item.date))}</strong></div><button type="button" class="btn danger small" data-stage7-action="remove-traffic">Удалить</button></div><div class="traffic-measurement-grid-v453">${TRAFFIC_FIELDS.map(def=>fieldHtml(def,item[def[0]])).join('')}</div></article>`;
  }

  function competitorArticle(item,index,legacy=false){
    return`<article class="competitor-card-v453" data-competitor-id="${esc(legacy?'legacy':item.id)}" data-created-at="${esc(item.createdAt||'')}" data-competitor-legacy="${legacy?'1':'0'}"><div class="stage7-card-head-v453"><div><span>${legacy?'Ближайший прямой конкурент':`Конкурент ${index+1}`}</span><strong>${legacy?'Существующие данные сохранены в прежнем объекте competitor.':'Дополнительный конкурент хранится отдельной записью.'}</strong></div>${legacy?'':`<button type="button" class="btn danger small" data-stage7-action="remove-competitor">Удалить</button>`}</div><div class="competitor-grid-v453">${COMPETITOR_FIELDS.map(def=>fieldHtml(def,item[def[0]],legacy?`data-stage7-legacy-competitor="1" data-field="competitor.${esc(def[0])}"`:'' )).join('')}</div></article>`;
  }

  function enhanceSelects(root){
    root.querySelectorAll('select').forEach(select=>{
      if(!select.nextElementSibling?.classList.contains('premium-select-trigger'))window.bogatkaEnhanceSelect?.(select);
    });
  }

  function updateTrafficSummary(root){
    const rows=[...root.querySelectorAll('.traffic-measurement-v453')];
    const values={
      count:rows.length,
      minutes:rows.reduce((sum,row)=>sum+(Number(row.querySelector('[data-stage7-field="durationMinutes"]')?.value)||0),0),
      people:rows.reduce((sum,row)=>sum+(Number(row.querySelector('[data-stage7-field="peopleCount"]')?.value)||0),0),
    };
    Object.entries(values).forEach(([key,value])=>{const node=root.querySelector(`[data-traffic-summary-v453="${key}"]`);if(node)node.textContent=String(value);});
  }

  function renderTraffic(card,data={},force=false){
    const body=findDetails(card,'Полевой замер трафика')?.querySelector('.details-body');
    if(!body)return false;
    if(body.querySelector('.traffic-stage7-v453')&&!force)return true;
    const rows=normalizeList(data[TRAFFIC_KEY]);
    const legacy=legacyTrafficRows(data);
    body.innerHTML=`<div class="traffic-stage7-v453"><p class="section-note"><strong>Каждый замер хранится отдельно.</strong> Укажите дату, начало, длительность, погоду и комментарий.</p><div class="traffic-summary-v453"><div><span>Замеров</span><strong data-traffic-summary-v453="count">0</strong></div><div><span>Всего минут</span><strong data-traffic-summary-v453="minutes">0</strong></div><div><span>Учтено людей</span><strong data-traffic-summary-v453="people">0</strong></div></div>${legacy.length?`<details class="legacy-traffic-v453"><summary>Ранее сохранённые поля — ${legacy.length}</summary><div class="legacy-traffic-grid-v453">${legacy.map(row=>`<div><span>${esc(row.label)}</span><strong>${esc(row.value)}</strong></div>`).join('')}</div><p>Эти значения сохранены без преобразования и не удаляются.</p></details>`:''}<div class="traffic-measurements-list-v453">${rows.length?rows.map(trafficArticle).join(''):'<div class="stage7-empty-v453">Замеров пока нет.</div>'}</div><button type="button" class="btn secondary" data-stage7-action="add-traffic">+ Добавить замер</button></div>`;
    updateTrafficSummary(body);
    enhanceSelects(body);
    return true;
  }

  function renderCompetitors(card,data={},force=false){
    const body=findDetails(card,'Конкуренты и окружение')?.querySelector('.details-body');
    if(!body)return false;
    if(body.querySelector('.competitors-stage7-v453')&&!force)return true;
    const legacy=data.competitor&&typeof data.competitor==='object'?{...data.competitor}:{};
    const extras=normalizeList(data[COMPETITORS_KEY]);
    body.innerHTML=`<div class="competitors-stage7-v453"><p class="section-note"><strong>Фиксируйте каждого конкурента отдельно.</strong> Фотографии добавляйте в категорию «Конкуренты».</p><div class="competitors-list-v453">${competitorArticle(legacy,0,true)}${extras.map((item,index)=>competitorArticle(item,index+1,false)).join('')}</div><button type="button" class="btn secondary" data-stage7-action="add-competitor">+ Добавить конкурента</button></div>`;
    body.querySelectorAll('[data-stage7-legacy-competitor][data-field]').forEach(control=>control.dataset.location=card.dataset.locationCard||'');
    enhanceSelects(body);
    return true;
  }

  function controlValue(control){return control?.type==='checkbox'?control.checked:control?.value??'';}

  function collectRows(card,selector,idAttribute,fields){
    return[...card.querySelectorAll(selector)].map(row=>{
      const item={id:row.getAttribute(idAttribute)||createId(),createdAt:row.dataset.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
      fields.forEach(([key])=>item[key]=controlValue(row.querySelector(`[data-stage7-field="${key}"]`)));
      return item;
    });
  }

  function proxy(locationId,field,value,label){
    return{dataset:{location:locationId,field},type:'custom',value,checked:false,closest(selector){return selector==='label'?{childNodes:[{textContent:label}]}:null;}};
  }

  async function saveValue(locationId,field,value,label){
    if(isViewer())return false;
    const save=window.saveField||((typeof saveField==='function')?saveField:null);
    if(typeof save!=='function')throw new Error('Не найдена функция сохранения данных.');
    await save(proxy(locationId,field,value,label));
    return true;
  }

  function scheduleSave(key,callback,delay=260){
    clearTimeout(timers.get(key));
    timers.set(key,setTimeout(()=>{timers.delete(key);callback().catch(error=>{lastError=error;window.showError?.(error)||console.error(error);});},delay));
  }

  async function saveTraffic(card){
    await saveValue(card.dataset.locationCard,TRAFFIC_KEY,collectRows(card,'.traffic-measurement-v453','data-traffic-id',TRAFFIC_FIELDS),'Замеры трафика');
  }

  async function saveCompetitors(card){
    await saveValue(card.dataset.locationCard,COMPETITORS_KEY,collectRows(card,'.competitor-card-v453[data-competitor-legacy="0"]','data-competitor-id',COMPETITOR_FIELDS),'Дополнительные конкуренты');
  }

  async function addTraffic(card){
    const list=card.querySelector('.traffic-measurements-list-v453');
    list?.querySelector('.stage7-empty-v453')?.remove();
    const index=list?.querySelectorAll('.traffic-measurement-v453').length||0;
    list?.insertAdjacentHTML('beforeend',trafficArticle(trafficTemplate(),index));
    enhanceSelects(list||card);updateTrafficSummary(card);applyViewerState(card);await saveTraffic(card);
  }

  async function addCompetitor(card){
    const list=card.querySelector('.competitors-list-v453');
    const index=(list?.querySelectorAll('.competitor-card-v453[data-competitor-legacy="0"]').length||0)+1;
    list?.insertAdjacentHTML('beforeend',competitorArticle(competitorTemplate(),index,false));
    enhanceSelects(list||card);applyViewerState(card);await saveCompetitors(card);
  }

  async function removeTraffic(card,article){
    if(!article||!window.confirm('Удалить этот замер трафика?'))return;
    article.remove();
    const list=card.querySelector('.traffic-measurements-list-v453');
    if(list&&!list.querySelector('.traffic-measurement-v453'))list.innerHTML='<div class="stage7-empty-v453">Замеров пока нет.</div>';
    updateTrafficSummary(card);await saveTraffic(card);
  }

  async function removeCompetitor(card,article){
    if(!article||!window.confirm('Удалить этого конкурента?'))return;
    article.remove();await saveCompetitors(card);
  }

  function applyViewerState(root=document){
    const readOnly=isViewer();
    root.querySelectorAll?.('.traffic-stage7-v453 input,.traffic-stage7-v453 select,.traffic-stage7-v453 textarea,.competitors-stage7-v453 input,.competitors-stage7-v453 select,.competitors-stage7-v453 textarea').forEach(control=>control.disabled=readOnly);
    root.querySelectorAll?.('[data-stage7-action]').forEach(button=>{button.hidden=readOnly;button.disabled=readOnly;});
  }

  async function enhanceCard(card){
    const id=card?.dataset?.locationCard;
    if(!id||typeof window.getLocationData!=='function')return false;
    const data=await window.getLocationData(id);
    const ok=renderTraffic(card,data)&&renderCompetitors(card,data);
    applyViewerState(card);
    if(ok)card.dataset.trafficCompetitorsV453='1';
    return ok;
  }

  async function enhanceAll(){
    try{
      if(window.BogatkaWorkflowV414?.FIELD_LABELS)Object.assign(window.BogatkaWorkflowV414.FIELD_LABELS,{trafficMeasurements:'Замеры трафика',competitors:'Дополнительные конкуренты'});
      for(const card of document.querySelectorAll('[data-location-card]'))await enhanceCard(card);
      applyViewerState(document);lastError=null;return true;
    }catch(error){lastError=error;console.error(error);return false;}
  }

  function reportRows(data,fields){
    return fields.map(([key,label])=>`<div><b>${esc(label)}:</b> ${filled(data?.[key])?esc(data[key]):'—'}</div>`).join('');
  }

  function liveSections(data={}){
    const traffic=normalizeList(data[TRAFFIC_KEY]).map((item,index)=>`<article class="report-stage7-card-v453"><h4>Замер ${index+1}</h4><div class="report-stage7-grid-v453">${reportRows(item,TRAFFIC_FIELDS)}</div></article>`).join('');
    const competitors=[];
    if(data.competitor&&Object.values(data.competitor).some(filled))competitors.push({title:'Ближайший прямой конкурент',item:data.competitor});
    normalizeList(data[COMPETITORS_KEY]).forEach((item,index)=>competitors.push({title:`Конкурент ${index+2}`,item}));
    return`<section class="report-extra report-stage7-v453"><h3>Полевые замеры трафика</h3>${traffic||'<p>Новых замеров пока нет.</p>'}</section><section class="report-extra report-stage7-v453"><h3>Конкуренты и окружение</h3>${competitors.map(({title,item})=>`<article class="report-stage7-card-v453"><h4>${esc(title)}</h4><div class="report-stage7-grid-v453">${reportRows(item,COMPETITOR_FIELDS)}</div></article>`).join('')||'<p>Конкуренты пока не заполнены.</p>'}</section>`;
  }

  async function transformLiveReport(html){
    const doc=new DOMParser().parseFromString(html,'text/html');
    const active=(window.locations||[]).filter(location=>!location.archivedAt);
    const cards=[...doc.querySelectorAll('.report-location-card')];
    for(let index=0;index<cards.length;index++){
      const location=active[index];
      if(!location)continue;
      const data=await window.getLocationData(location.id);
      const body=cards[index].querySelector('.report-location-body,.location-body')||cards[index];
      body.querySelectorAll('.report-stage7-v453').forEach(node=>node.remove());
      body.insertAdjacentHTML('beforeend',liveSections(data));
    }
    if(!doc.getElementById('reportStage7StyleV453')){
      const style=doc.createElement('style');style.id='reportStage7StyleV453';
      style.textContent='.report-stage7-v453{display:grid;gap:8px}.report-stage7-card-v453{padding:10px;border:1px solid #d9e4de;border-radius:10px;background:#fff}.report-stage7-card-v453 h4{margin:0 0 7px;color:#15583f}.report-stage7-grid-v453{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.report-stage7-grid-v453>div{padding:6px;border:1px solid #e3ebe7;border-radius:7px;background:#f9fbfa;font-size:10px}@media(max-width:620px){.report-stage7-grid-v453{grid-template-columns:1fr}}';
      doc.head.append(style);
    }
    return`<!doctype html>\n${doc.documentElement.outerHTML}`;
  }

  function installLiveReport(){
    reportAttempts+=1;
    const api=window.BogatkaLiveReport;
    const current=api?.build;
    if(typeof current!=='function'){
      if(reportAttempts<160)setTimeout(installLiveReport,100);
      return false;
    }
    if(current.__trafficCompetitorsV453)return true;
    const wrapped=async function(...args){return transformLiveReport(await current(...args));};
    Object.assign(wrapped,current);wrapped.__trafficCompetitorsV453=true;wrapped.__base=current;
    api.build=wrapped;window.buildReportHtml=wrapped;
    try{buildReportHtml=wrapped}catch(_){ }
    if(reportAttempts<160)setTimeout(installLiveReport,250);
    return true;
  }

  function audit(){
    const failures=[];
    document.querySelectorAll('[data-location-card]').forEach(card=>{
      const id=card.dataset.locationCard;
      if(!card.querySelector('.traffic-stage7-v453'))failures.push(`${id}:traffic:missing`);
      if(!card.querySelector('.competitors-stage7-v453'))failures.push(`${id}:competitors:missing`);
      if(card.querySelector('[data-field^="traffic."]'))failures.push(`${id}:legacy-traffic:visible`);
      if(!card.querySelector('[data-field="competitor.name"]'))failures.push(`${id}:legacy-competitor:missing`);
    });
    return{ok:failures.length===0,failures,lastError:lastError?String(lastError):''};
  }

  function schedule(delay=80){clearTimeout(scheduleTimer);scheduleTimer=setTimeout(()=>enhanceAll(),delay);}

  function install(){
    const root=document.getElementById('locations')||document.body;
    root.addEventListener('click',event=>{
      const button=event.target.closest?.('[data-stage7-action]');const card=button?.closest?.('[data-location-card]');
      if(!button||!card||isViewer())return;
      const action=button.dataset.stage7Action;
      const operation=action==='add-traffic'?addTraffic(card):action==='add-competitor'?addCompetitor(card):action==='remove-traffic'?removeTraffic(card,button.closest('.traffic-measurement-v453')):action==='remove-competitor'?removeCompetitor(card,button.closest('.competitor-card-v453')):null;
      operation?.catch?.(error=>{lastError=error;console.error(error);});
    });
    const onChange=event=>{
      const control=event.target;const card=control?.closest?.('[data-location-card]');if(!card||isViewer())return;
      const traffic=control.closest?.('.traffic-measurement-v453');const competitor=control.closest?.('.competitor-card-v453');
      if(traffic){if(control.dataset.stage7Field==='date')traffic.querySelector('[data-weekday-v453]').textContent=weekday(control.value);updateTrafficSummary(card);scheduleSave(`${card.dataset.locationCard}:traffic`,()=>saveTraffic(card));}
      else if(competitor?.dataset.competitorLegacy==='1'){const field=control.dataset.field;if(field)scheduleSave(`${card.dataset.locationCard}:${field}`,()=>saveValue(card.dataset.locationCard,field,controlValue(control),field));}
      else if(competitor)scheduleSave(`${card.dataset.locationCard}:competitors`,()=>saveCompetitors(card));
    };
    root.addEventListener('input',onChange,true);root.addEventListener('change',onChange,true);
    observer=new MutationObserver(()=>schedule(100));observer.observe(root,{childList:true,subtree:true});
    schedule(20);[250,700,1500,3000,6000].forEach(delay=>setTimeout(()=>schedule(0),delay));
    setInterval(()=>applyViewerState(document),1200);installLiveReport();
  }

  window.BogatkaTrafficCompetitorsV453={version:VERSION,ready:true,TRAFFIC_FIELDS,COMPETITOR_FIELDS,trafficTemplate,competitorTemplate,legacyTrafficRows,renderTraffic,renderCompetitors,enhanceAll,enhanceCard,applyViewerState,audit,transformLiveReport,get lastError(){return lastError;}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('load',()=>schedule(20),{once:true});
})();
