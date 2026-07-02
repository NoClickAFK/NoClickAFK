(function(){
  'use strict';
  if(window.BogatkaPublicTrafficCompetitorsV453?.ready)return;

  const VERSION='4.5.3';
  const TRAFFIC_LABELS={date:'Дата',startTime:'Начало',durationMinutes:'Длительность',peopleCount:'Всего людей',targetCustomers:'Целевые покупатели',dogWalkers:'Люди с собаками',competitorVisitors:'Посетители конкурента',parkingOccupiedPct:'Занято парковки',weather:'Погода',comment:'Комментарий'};
  const COMPETITOR_LABELS={name:'Название',type:'Тип',distance:'Расстояние / время пешком',flow:'Примерный поток',prices:'Цены',assortment:'Ассортимент',strengths:'Сильные стороны',weaknesses:'Слабые стороны',photoReference:'Фото конкурента',comment:'Комментарий'};
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const filled=value=>value!==undefined&&value!==null&&String(value).trim()!=='';
  const list=value=>Array.isArray(value)?value.filter(item=>item&&typeof item==='object'):[];
  const display=value=>filled(value)?esc(value):'—';
  let attempts=0;

  function weekday(value){
    if(!value)return'';
    const date=new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime())?'':date.toLocaleDateString('ru-RU',{weekday:'long'});
  }

  function legacyTrafficRows(data={}){
    const definitions=Array.isArray(window.TRAFFIC_FIELDS)?window.TRAFFIC_FIELDS:[];
    const source=data.traffic||{};
    return definitions.filter(([key])=>filled(source[key])).map(([key,label])=>({label,value:source[key]}));
  }

  function trafficHtml(data={}){
    const measurements=list(data.trafficMeasurements).map((item,index)=>`<article class="public-traffic-card-v453"><h4>Замер ${index+1}${weekday(item.date)?` · ${esc(weekday(item.date))}`:''}</h4><div class="public-data-grid-v453">${Object.entries(TRAFFIC_LABELS).map(([key,label])=>{let value=item[key];if(key==='durationMinutes'&&filled(value))value=`${value} минут`;if(key==='parkingOccupiedPct'&&filled(value))value=`${value}%`;return`<div><b>${esc(label)}:</b> ${display(value)}</div>`;}).join('')}</div></article>`).join('');
    const legacy=legacyTrafficRows(data);
    const old=legacy.length?`<details class="public-legacy-v453"><summary>Ранее сохранённые поля трафика — ${legacy.length}</summary><div class="public-data-grid-v453">${legacy.map(row=>`<div><b>${esc(row.label)}:</b> ${display(row.value)}</div>`).join('')}</div><p>Значения сохранены без преобразования.</p></details>`:'';
    return`<section class="report-extra public-traffic-v453"><h3>Полевые замеры трафика</h3>${measurements||'<p class="empty">Новых замеров пока нет.</p>'}${old}</section>`;
  }

  function competitorHasData(item={}){return Object.keys(COMPETITOR_LABELS).some(key=>filled(item[key]));}

  function competitorsHtml(data={}){
    const items=[];
    const first=data.competitor&&typeof data.competitor==='object'?data.competitor:{};
    if(competitorHasData(first))items.push({title:'Ближайший прямой конкурент',item:first});
    list(data.competitors).forEach((item,index)=>{if(competitorHasData(item))items.push({title:`Конкурент ${index+2}`,item});});
    const cards=items.map(({title,item})=>`<article class="public-competitor-card-v453"><h4>${esc(title)}</h4><div class="public-data-grid-v453">${Object.entries(COMPETITOR_LABELS).map(([key,label])=>`<div><b>${esc(label)}:</b> ${display(item[key])}</div>`).join('')}</div></article>`).join('');
    return`<section class="report-extra public-competitors-v453"><h3>Конкуренты и окружение</h3>${cards||'<p class="empty">Конкуренты пока не заполнены.</p>'}</section>`;
  }

  function removeOldSection(article,title){
    const heading=[...article.querySelectorAll('h3')].find(node=>node.textContent.trim()===title);
    if(!heading)return;
    const next=heading.nextElementSibling;heading.remove();next?.remove();
  }

  function appendStructured(article,data={}){
    const body=article?.querySelector('.location-body');
    if(!body)return false;
    body.querySelector('.public-traffic-v453')?.remove();body.querySelector('.public-competitors-v453')?.remove();
    removeOldSection(article,'Полевой замер трафика');removeOldSection(article,'Конкуренты и окружение');
    const trafficHolder=document.createElement('div');trafficHolder.innerHTML=trafficHtml(data);
    const scoreHeading=[...body.querySelectorAll('h3')].find(node=>node.textContent.trim()==='Оценка локации');
    if(scoreHeading)body.insertBefore(trafficHolder.firstElementChild,scoreHeading);else body.prepend(trafficHolder.firstElementChild);
    const competitorHolder=document.createElement('div');competitorHolder.innerHTML=competitorsHtml(data);
    const notes=body.querySelector('.notes-grid');if(notes)body.insertBefore(competitorHolder.firstElementChild,notes);else body.append(competitorHolder.firstElementChild);
    return true;
  }

  function installStyle(){
    if(document.getElementById('publicTrafficCompetitorsStyleV453'))return;
    const style=document.createElement('style');style.id='publicTrafficCompetitorsStyleV453';
    style.textContent='.public-traffic-v453,.public-competitors-v453{display:grid;gap:10px}.public-traffic-card-v453,.public-competitor-card-v453{border:1px solid #d6e3dc;border-radius:13px;padding:12px;background:#fff}.public-traffic-card-v453 h4,.public-competitor-card-v453 h4{margin:0 0 8px;color:#15583f}.public-data-grid-v453{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.public-data-grid-v453>div{padding:7px 8px;border:1px solid #e0e8e4;border-radius:8px;background:#f9fbfa;font-size:11px;white-space:pre-wrap}.public-legacy-v453{border:1px dashed #c6d6ce;border-radius:11px;padding:9px;background:#f8fbf9}.public-legacy-v453 summary{cursor:pointer;color:#15583f;font-weight:800}.public-legacy-v453 p{margin:8px 0 0;color:#65756d;font-size:10px}@media(max-width:620px){.public-data-grid-v453{grid-template-columns:1fr}}';
    document.head.append(style);
  }

  function install(){
    attempts+=1;installStyle();
    const current=window.renderReport||((typeof renderReport==='function')?renderReport:null);
    if(typeof current!=='function'){if(attempts<100)setTimeout(install,50);return false;}
    if(current.__trafficCompetitorsV453)return true;
    const wrapped=function(payload){
      const result=current(payload);
      const locations=(Array.isArray(payload?.snapshot?.locations)?payload.snapshot.locations:[]).filter(location=>!location.form_data?.archivedAt);
      document.querySelectorAll('#reportRoot article.location').forEach((article,index)=>appendStructured(article,locations[index]?.form_data||{}));
      return result;
    };
    wrapped.__trafficCompetitorsV453=true;wrapped.__base=current;window.renderReport=wrapped;
    try{renderReport=wrapped}catch(_){ }
    setTimeout(()=>{try{if(typeof loadReport==='function')loadReport()}catch(error){console.error(error);}},0);
    return true;
  }

  window.BogatkaPublicTrafficCompetitorsV453={version:VERSION,ready:true,legacyTrafficRows,trafficHtml,competitorsHtml,appendStructured,install};
  install();
})();
