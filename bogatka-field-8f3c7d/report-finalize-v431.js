(function(){
  'use strict';
  if(window.BogatkaReportFinalizeV431?.ready)return;

  const VERSION='4.3.1';
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const clean=value=>String(value??'').replace(/[\s\u00a0]+/g,' ').trim();
  const filled=value=>value!==undefined&&value!==null&&clean(value)!==''&&clean(value)!=='—'&&!/^не выбра/i.test(clean(value));
  const formatNumber=(value,digits=0)=>value===undefined||value===null||value===''||!Number.isFinite(Number(value))?'Не указано':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:digits}).format(Number(value));
  const formatDate=value=>{if(!filled(value))return'';try{return new Date(value).toLocaleDateString('ru-RU')}catch(_){return clean(value)}};
  let attempts=0;
  let lastClaimed=null;

  function locationItems(){
    try{if(Array.isArray(locations))return locations.filter(item=>!item.archivedAt)}catch(_){ }
    return Array.isArray(window.locations)?window.locations.filter(item=>!item.archivedAt):[];
  }

  async function allPhotos(){
    try{return await idbAll(PHOTO_STORE)}catch(_){return[]}
  }

  async function computeMetrics(){
    if(typeof window.BogatkaDecisionEngine?.computeAll==='function')return await window.BogatkaDecisionEngine.computeAll();
    if(Array.isArray(window.BogatkaDecisionEngine?.lastMetrics)&&window.BogatkaDecisionEngine.lastMetrics.length)return window.BogatkaDecisionEngine.lastMetrics;
    const items=locationItems();
    const result=[];
    for(let index=0;index<items.length;index++){
      const item=items[index];
      let data={};
      try{data=await getLocationData(item.id)}catch(_){data={}}
      result.push({id:item.id,item,data,rank:index+1,rawScore:0,weighted:0,completion:0,recommendation:{label:'Недостаточно данных',className:'empty'},photoCount:0,missing:[],dealGate:{text:'Не оценено'}});
    }
    return result;
  }

  function field(label,value,options={}){
    if(!filled(value))return'';
    return `<div class="report-field${options.wide?' report-field-wide':''}"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
  }

  function fieldGrid(items){
    const html=items.filter(Boolean).join('');
    return html?`<div class="report-field-grid">${html}</div>`:'';
  }

  function section(title,body,{subtitle='',compact=false}={}){
    if(!body)return'';
    return `<section class="report-section${compact?' report-section-compact':''}"><div class="report-section-title"><div><h3>${esc(title)}</h3>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div></div><div class="report-section-body">${body}</div></section>`;
  }

  function empty(message){
    return `<div class="report-empty">${esc(message)}</div>`;
  }

  function status(label,className=''){
    return `<span class="report-status ${esc(className)}">${esc(label||'Недостаточно данных')}</span>`;
  }

  function decisionBody(metric){
    const data=metric.data||{};
    const parts=[];
    if(filled(data.decision))parts.push(field('Решение',data.decision));
    if(filled(data.decisionReason))parts.push(field('Причина решения',data.decisionReason,{wide:true}));
    else if(filled(data.decision))parts.push(`<div class="report-note warning">Причина решения не заполнена.</div>`);
    if(filled(metric.recommendation?.reason))parts.push(field('Комментарий системы',metric.recommendation.reason,{wide:true}));
    return fieldGrid(parts);
  }

  function basicBody(metric){
    const item=metric.item||{};
    const data=metric.data||{};
    return fieldGrid([
      field('Адрес',item.address||data.address,{wide:true}),
      field('Статус осмотра',data.status),
      field('Тип объекта',data.objectType),
      field('Дата осмотра',formatDate(data.date)),
      field('Время',data.time),
      field('Контакт',data.contact),
      field('Контактное лицо / роль',data.contactRole),
      field('Собственник / организация',data.ownerName),
    ]);
  }

  function technicalBody(metric){
    const tech=metric.data?.tech||{};
    return fieldGrid([
      field('Общая площадь',tech.totalArea?`${formatNumber(tech.totalArea,1)} м²`:''),
      field('Аренда в месяц',tech.rentPerMonth?`${formatNumber(tech.rentPerMonth,2)} BYN`:''),
      field('Аренда за м²',tech.rentPerSqm?`${formatNumber(tech.rentPerSqm,2)} BYN/м²`:''),
      field('Электрическая мощность',tech.powerKw?`${formatNumber(tech.powerKw,1)} кВт`:''),
      field('Режим работы',tech.openingHours),
      field('Коммунальные условия',tech.utilities,{wide:true}),
      field('Оценка ремонта',tech.repairEstimate,{wide:true}),
      field('Загрузка / разгрузка',tech.loading,{wide:true}),
    ]);
  }

  function economyBody(metric){
    const data=metric.data||{};
    const economy=data.economy||data.economics||{};
    const body=fieldGrid([
      field('Прогноз выручки',economy.revenue||economy.monthlyRevenue),
      field('Маржа',economy.margin||economy.marginPct),
      field('Окупаемость',economy.payback||economy.paybackMonths),
      field('Комментарий',economy.comment,{wide:true}),
    ]);
    if(body)return body;
    if(filled(data?.tech?.rentPerMonth)||filled(data?.tech?.totalArea))return empty('Экономическая модель не рассчитана: не хватает прогноза выручки и маржи.');
    return'';
  }

  function trafficBody(metric){
    const rows=Array.isArray(metric.data?.trafficMeasurements)?metric.data.trafficMeasurements:[];
    const meaningful=rows.filter(row=>['date','startTime','peopleCount','targetCustomers','dogWalkers','competitorVisitors','parkingOccupiedPct','comment'].some(key=>filled(row?.[key])));
    if(!meaningful.length)return'';
    return `<div class="report-mini-list">${meaningful.map((row,index)=>`<article><h4>Замер ${index+1}</h4>${fieldGrid([
      field('Дата',formatDate(row.date)),field('Начало',row.startTime),field('Длительность',row.durationMinutes?`${row.durationMinutes} минут`:''),field('Прохожих всего',row.peopleCount),field('Целевая аудитория',row.targetCustomers),field('Прохожих с собаками',row.dogWalkers),field('Посетителей конкурента',row.competitorVisitors),field('Парковка занята',row.parkingOccupiedPct?`${row.parkingOccupiedPct}%`:''),field('Комментарий',row.comment,{wide:true})
    ])}</article>`).join('')}</div>`;
  }

  function competitorsBody(metric){
    const data=metric.data||{};
    const list=Array.isArray(data.competitors)?data.competitors:[];
    const legacy=data.competitor&&typeof data.competitor==='object'?data.competitor:null;
    const rows=[...list];
    if(legacy&&Object.values(legacy).some(filled))rows.push({...legacy,name:legacy.name||'Ближайший конкурент'});
    const meaningful=rows.filter(row=>['name','type','distance','flow','prices','assortment','strengths','weaknesses','comment'].some(key=>filled(row?.[key])));
    if(!meaningful.length)return'';
    return `<div class="report-mini-list">${meaningful.map((row,index)=>`<article><h4>${esc(row.name||`Конкурент ${index+1}`)}</h4>${fieldGrid([
      field('Тип',row.type),field('Расстояние',row.distance),field('Поток',row.flow),field('Цены',row.prices),field('Ассортимент',row.assortment,{wide:true}),field('Сильные стороны',row.strengths,{wide:true}),field('Слабые стороны',row.weaknesses,{wide:true}),field('Комментарий',row.comment,{wide:true})
    ])}</article>`).join('')}</div>`;
  }

  function conclusionBody(metric){
    const data=metric.data||{};
    return fieldGrid([
      field('Плюсы',data.pros,{wide:true}),
      field('Минусы',data.cons,{wide:true}),
      field('Риски',data.risks,{wide:true}),
      field('Открытые вопросы',data.questions,{wide:true}),
    ]);
  }

  async function photosBody(metric,photos){
    const rows=photos.filter(photo=>photo.locationId===metric.id);
    if(!rows.length)return empty('Фотографии по этой локации пока не добавлены.');
    const cards=[];
    for(const photo of rows.slice(0,24)){
      let source='';
      try{source=await blobToDataURL(photo.blob)}catch(_){source=''}
      const caption=photo.caption||photo.originalName||'Фотография локации';
      if(source)cards.push(`<figure class="report-photo"><img src="${esc(source)}" alt="${esc(caption)}"><figcaption>${esc(caption)}</figcaption></figure>`);
    }
    return cards.length?`<div class="report-photo-grid">${cards.join('')}</div>`:empty('Фотографии по этой локации пока не добавлены.');
  }

  function tasksBody(metric){
    const tasks=Array.isArray(metric.data?.tasks)?metric.data.tasks:[];
    const comments=Array.isArray(metric.data?.comments)?metric.data.comments:[];
    const taskRows=tasks.filter(item=>filled(item?.title)||filled(item?.text)||filled(item?.comment));
    const commentRows=comments.filter(item=>filled(item?.text)||filled(item?.comment));
    if(!taskRows.length&&!commentRows.length)return'';
    return `<div class="report-mini-list">${taskRows.map(item=>`<article><h4>${esc(item.title||item.text||'Задача')}</h4>${fieldGrid([field('Статус',item.status),field('Приоритет',item.priority),field('Комментарий',item.comment||item.text,{wide:true})])}</article>`).join('')}${commentRows.map(item=>`<article><h4>Комментарий</h4>${fieldGrid([field('Текст',item.text||item.comment,{wide:true})])}</article>`).join('')}</div>`;
  }

  function locationHeader(metric,{compact=false}={}){
    const item=metric.item||{};
    const data=metric.data||{};
    const title=item.title||item.address||'Локация';
    return `<header class="report-location-header"><div><p class="report-eyebrow">${compact?'Краткая карточка':'Локация'}</p><h2>${esc(title)}</h2>${item.address&&item.address!==title?`<p>${esc(item.address)}</p>`:''}</div><div class="report-metrics"><div><strong>${formatNumber(metric.rawScore,0)}</strong><span>/70 балл</span></div><div><strong>${formatNumber(metric.weighted,1)}</strong><span>/100 вес</span></div><div><strong>${formatNumber(metric.completion,0)}%</strong><span>заполнено</span></div>${status(metric.recommendation?.label,metric.recommendation?.className)}</div></header>${filled(data.decision)?`<div class="report-decision-strip"><span>Решение</span><strong>${esc(data.decision)}</strong></div>`:''}`;
  }

  async function renderLocation(metric,photos,{full=false,single=false}={}){
    const rich=single||full||metric.completion>=35||metric.photoCount>0||filled(metric.data?.decision);
    const sections=[];
    sections.push(section('Основные сведения',basicBody(metric)));
    if(rich){
      sections.push(section('Технические параметры',technicalBody(metric)));
      sections.push(section('Экономическая модель',economyBody(metric),{compact:true}));
      sections.push(section('Трафик',trafficBody(metric)));
      sections.push(section('Конкуренты',competitorsBody(metric)));
      sections.push(section('Решение',decisionBody(metric),{compact:true}));
      sections.push(section('Выводы и риски',conclusionBody(metric)));
      sections.push(section('Задачи и комментарии',tasksBody(metric)));
      sections.push(section('Фотографии',await photosBody(metric,photos),{compact:true}));
    }else{
      const missing=Array.isArray(metric.missing)&&metric.missing.length?metric.missing.slice(0,6).join(', '):'Заполнено мало данных';
      sections.push(section('Состояние заполнения',empty(`Краткая карточка: ${missing}.`),{compact:true}));
    }
    return `<article class="report-location" data-report-location-id="${esc(metric.id)}">${locationHeader(metric,{compact:!rich})}${sections.filter(Boolean).join('')}</article>`;
  }

  function cover(metrics,{singleMetric=null}={}){
    const now=new Date();
    let global={};
    try{global=window.__bogatkaReportGlobal||{}}catch(_){global={}}
    const target=singleMetric;
    const title=target?'Отчёт по локации «Богатка»':'Сводный отчёт по локациям «Богатка»';
    const subtitle=target?(target.item?.title||target.item?.address||'Выбранная локация'):'Управленческий HTML-отчёт по всем активным локациям';
    return `<section class="report-cover"><div><p class="report-eyebrow">Bogatka · ${esc(VERSION)}</p><h1>${esc(title)}</h1><p class="report-subtitle">${esc(subtitle)}</p></div><div class="report-cover-grid"><div><span>Сформирован</span><strong>${esc(now.toLocaleString('ru-RU'))}</strong></div><div><span>Локаций</span><strong>${target?'1':metrics.length}</strong></div><div><span>Рекомендация</span><strong>${esc(target?.recommendation?.label||metrics[0]?.recommendation?.label||'См. сравнение')}</strong></div><div><span>Решение</span><strong>${esc(target?.data?.decision||'См. карточки')}</strong></div></div></section>`;
  }

  function summary(metrics){
    const active=metrics.length;
    const withDecision=metrics.filter(m=>filled(m.data?.decision)).length;
    const best=[...metrics].sort((a,b)=>b.weighted-a.weighted)[0];
    const avg=active?metrics.reduce((sum,m)=>sum+(Number(m.completion)||0),0)/active:0;
    return `<section class="report-summary report-section"><div class="report-section-title"><div><h2>Общая сводка</h2><p>Ключевые показатели без рабочих форм и пустых полей.</p></div></div><div class="report-kpi-grid"><div><strong>${active}</strong><span>активных локаций</span></div><div><strong>${withDecision}</strong><span>с решением</span></div><div><strong>${best?formatNumber(best.weighted,1):'0'}</strong><span>лучший вес /100</span></div><div><strong>${formatNumber(avg,0)}%</strong><span>средняя заполненность</span></div></div></section>`;
  }

  function comparison(metrics){
    const rows=[...metrics].sort((a,b)=>(a.rank||999)-(b.rank||999));
    if(!rows.length)return'';
    return `<section class="report-comparison report-section"><div class="report-section-title"><div><h2>Сравнение локаций</h2><p>Рейтинг, рекомендация, баллы и решение.</p></div></div><div class="report-table-wrap"><table><thead><tr><th>#</th><th>Локация</th><th>Рекомендация</th><th>Балл</th><th>Вес</th><th>Заполнено</th><th>Решение</th></tr></thead><tbody>${rows.map(m=>`<tr><td>${m.rank||''}</td><td><strong>${esc(m.item?.title||m.item?.address||'Локация')}</strong>${m.item?.address?`<small>${esc(m.item.address)}</small>`:''}</td><td>${status(m.recommendation?.label,m.recommendation?.className)}</td><td>${formatNumber(m.rawScore,0)}/70</td><td>${formatNumber(m.weighted,1)}/100</td><td>${formatNumber(m.completion,0)}%</td><td>${esc(m.data?.decision||'Не выбрано')}</td></tr>`).join('')}</tbody></table></div></section>`;
  }

  function styles(){return `<style id="reportFinalV431">
    :root{--green:#15583f;--green2:#1f7354;--ink:#173329;--muted:#60756b;--line:#d8e5de;--paper:#fff;--soft:#f3f8f5;--warn:#fff4dc;--bad:#fdeaea;--shadow:0 16px 44px rgba(20,72,52,.08)}
    *{box-sizing:border-box}html{margin:0;background:#edf4f0;color:var(--ink);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}body{margin:0;line-height:1.45}.report-document{max-width:1220px;margin:0 auto;padding:24px}.report-cover{overflow:hidden;border-radius:30px;background:linear-gradient(135deg,#114932,#287a58);color:#fff;padding:34px 38px;box-shadow:var(--shadow);margin-bottom:20px}.report-eyebrow{margin:0 0 8px;color:inherit;opacity:.7;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.report-cover h1{margin:0;font-size:34px;line-height:1.1}.report-subtitle{margin:10px 0 24px;opacity:.86}.report-cover-grid,.report-kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.report-cover-grid>div{border:1px solid rgba(255,255,255,.24);border-radius:16px;background:rgba(255,255,255,.1);padding:12px}.report-cover-grid span,.report-kpi-grid span,.report-field span,.report-decision-strip span{display:block;color:inherit;opacity:.68;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.report-cover-grid strong,.report-kpi-grid strong{display:block;margin-top:4px;font-size:20px}.report-section,.report-location{border:1px solid var(--line);border-radius:24px;background:#fff;box-shadow:var(--shadow);margin:18px 0;padding:20px}.report-section-compact{box-shadow:none;background:#fbfdfc}.report-section-title{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:14px}.report-section-title h2,.report-section-title h3{margin:0;color:var(--green);line-height:1.2}.report-section-title h2{font-size:24px}.report-section-title h3{font-size:18px}.report-section-title p{margin:4px 0 0;color:var(--muted);font-size:13px}.report-location{padding:0;overflow:hidden}.report-location-header{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:20px;align-items:start;background:linear-gradient(180deg,#fff,#f5faf7);padding:22px}.report-location-header h2{margin:0;color:var(--green);font-size:24px}.report-location-header p:not(.report-eyebrow){margin:6px 0 0;color:var(--muted)}.report-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.report-metrics>div{min-height:66px;border:1px solid var(--line);border-radius:14px;background:#fff;padding:9px;text-align:center}.report-metrics strong{display:block;color:var(--green);font-size:22px}.report-metrics span{font-size:10px;color:var(--muted)}.report-status{display:inline-flex;align-items:center;justify-content:center;min-height:32px;border-radius:999px;background:#e8f4ee;color:var(--green);padding:6px 10px;font-size:11px;font-weight:900;text-align:center}.report-metrics>.report-status{grid-column:1/-1}.report-status.stop{background:var(--bad);color:#8d3030}.report-status.risk,.report-status.medium{background:#fff0d2;color:#805610}.report-status.empty{background:#edf1ef;color:#68776f}.report-status.priority,.report-status.good{background:#e2f3e9;color:#17613d}.report-decision-strip{display:flex;gap:10px;align-items:center;border-top:1px solid var(--line);background:#f8fbf9;padding:12px 22px}.report-decision-strip strong{color:var(--green)}.report-location>.report-section{margin:16px 18px;box-shadow:none}.report-field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.report-field{border:1px solid var(--line);border-radius:14px;background:#fff;padding:11px 12px;min-width:0}.report-field-wide{grid-column:1/-1}.report-field span{color:var(--muted);opacity:1}.report-field strong{display:block;margin-top:5px;white-space:pre-wrap;overflow-wrap:anywhere}.report-empty,.report-note{border-radius:14px;padding:12px 14px;background:var(--soft);color:var(--muted);font-weight:700}.report-note.warning{background:var(--warn);color:#805610}.report-table-wrap{overflow:auto;border:1px solid var(--line);border-radius:16px}table{width:100%;border-collapse:collapse;min-width:780px}th,td{border-bottom:1px solid var(--line);padding:10px 11px;text-align:left;vertical-align:top;font-size:12px}th{background:#edf6f1;color:var(--green);font-weight:900}td small{display:block;color:var(--muted);margin-top:3px}.report-mini-list{display:grid;gap:10px}.report-mini-list article{border:1px solid var(--line);border-radius:16px;background:#fff;padding:12px}.report-mini-list h4{margin:0 0 10px;color:var(--green)}.report-photo-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.report-photo{margin:0;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#fff}.report-photo img{display:block;width:100%;height:180px;object-fit:cover}.report-photo figcaption{padding:9px 10px;font-size:12px;color:var(--muted)}.report-meta-footer{margin:24px 0 0;color:var(--muted);font-size:12px;text-align:center}.report-actions{display:flex;gap:8px;justify-content:flex-end;margin:0 0 14px}.report-actions button{border:0;border-radius:999px;background:var(--green);color:#fff;padding:9px 13px;font-weight:800;cursor:pointer}
    @media(max-width:760px){.report-document{padding:12px}.report-cover{border-radius:22px;padding:24px}.report-cover h1{font-size:27px}.report-cover-grid,.report-kpi-grid,.report-location-header,.report-field-grid,.report-photo-grid{grid-template-columns:1fr}.report-metrics{max-width:360px}table{min-width:680px}.report-location>.report-section{margin:12px}}
    @media print{@page{size:A4 portrait;margin:12mm}html{background:#fff}body{background:#fff}.report-document{max-width:none;padding:0}.report-actions{display:none!important}.report-cover,.report-section,.report-location{box-shadow:none;break-inside:avoid}.report-cover{border-radius:0;margin:0 0 6mm}.report-location-header{grid-template-columns:minmax(0,1fr) 78mm}.report-photo img{height:42mm}}
  </style>`}

  async function renderReport({locationId=null,baseBuild=null}={}){
    if(typeof baseBuild==='function'){
      try{await baseBuild()}catch(error){console.warn('Base report refresh before final render failed.',error)}
    }
    const metrics=await computeMetrics();
    const photos=await allPhotos();
    const selected=locationId?metrics.find(metric=>metric.id===locationId):null;
    const list=selected?[selected]:metrics;
    const locationHtml=[];
    for(const metric of list)locationHtml.push(await renderLocation(metric,photos,{single:Boolean(selected)}));
    const body=[
      cover(metrics,{singleMetric:selected}),
      selected?'':summary(metrics),
      selected?'':comparison(metrics),
      ...locationHtml,
      `<footer class="report-meta-footer">Отчёт сформирован приложением «Богатка» · финальный экспорт ${esc(VERSION)}</footer>`
    ].filter(Boolean).join('');
    const title=selected?`Отчёт по локации — ${selected.item?.title||selected.item?.address||'Богатка'}`:'Сводный отчёт по локациям — Богатка';
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>${styles()}</head><body><main class="report-document"><div class="report-actions"><button type="button" onclick="window.print()">Печать / PDF</button></div>${body}</main><script>document.addEventListener('click',event=>{const img=event.target.closest('.report-photo img');if(img)window.open(img.src,'_blank','noopener')});<\/script></body></html>`;
  }

  function safeFileNamePart(value){
    const normalized=String(value||'location').normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
    const safe=normalized.replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]+/g,'-').replace(/^-+|-+$/g,'').replace(/-{2,}/g,'-');
    return (safe||'location').slice(0,72);
  }

  function findLocation(id){return locationItems().find(item=>item.id===id)||null}

  function claim(builder){
    const api=window.BogatkaLiveReport;
    if(api){
      api.version=VERSION;
      api.build=builder;
      api.finalizeReportHtmlV431=html=>html;
      api.buildLocationReportHtml=buildLocationReportHtmlV431;
      api.exportLocationHtmlReport=exportLocationHtmlReportV431;
    }
    window.buildReportHtml=builder;
    window.exportHtmlReport=builder.__htmlAction;
    window.openPdfReport=builder.__pdfAction;
    window.buildLocationReportHtml=buildLocationReportHtmlV431;
    window.exportLocationHtmlReport=exportLocationHtmlReportV431;
    try{buildReportHtml=window.buildReportHtml;exportHtmlReport=window.exportHtmlReport;openPdfReport=window.openPdfReport}catch(_){ }
  }

  async function buildLocationReportHtmlV431(locationId){
    if(!findLocation(locationId))throw new Error('Локация для отчёта не найдена.');
    return renderReport({locationId});
  }

  async function exportLocationHtmlReportV431(locationId){
    const item=findLocation(locationId);
    if(typeof showSaving==='function')showSaving();
    try{
      const html=await buildLocationReportHtmlV431(locationId);
      downloadBlob(new Blob([html],{type:'text/html;charset=utf-8'}),`bogatka-location-${safeFileNamePart(item?.title||item?.address||locationId)}-${new Date().toISOString().slice(0,10)}.html`);
      if(typeof showSaved==='function')showSaved();
      return html;
    }catch(error){if(typeof showError==='function')showError(error);throw error}
  }

  function install(){
    attempts+=1;
    const current=window.BogatkaLiveReport?.build||window.buildReportHtml;
    if(typeof current!=='function'||current.__reportFinalizeV431){
      if(current?.__reportFinalizeV431)claim(current);
      if(attempts<160)setTimeout(install,250);
      return;
    }
    const hasReportBase=current.__reportStabilityV429||current.__reportAuthorityV428||current.__liveReportFinalV427;
    if(!hasReportBase){
      if(attempts<160)setTimeout(install,250);
      return;
    }
    const baseBuild=current;
    const wrapped=async function(){
      const html=await renderReport({baseBuild});
      claim(wrapped);
      return html;
    };
    Object.assign(wrapped,baseBuild);
    wrapped.__reportFinalizeV431=true;
    wrapped.__reportStabilityV429=true;
    wrapped.__reportAuthorityV428=true;
    wrapped.__reportPolishV428=true;
    wrapped.__liveReportFinalV427=true;
    wrapped.__base=baseBuild;
    wrapped.__htmlAction=async function(){
      if(typeof showSaving==='function')showSaving();
      const html=await wrapped();
      downloadBlob(new Blob([html],{type:'text/html;charset=utf-8'}),`bogatka-premium-report-${new Date().toISOString().slice(0,10)}.html`);
      if(typeof showSaved==='function')showSaved();
      return html;
    };
    wrapped.__pdfAction=async function(){
      const reportWindow=window.open('','_blank');
      if(!reportWindow)return alert('Браузер заблокировал новое окно. Разрешите всплывающие окна для создания PDF.');
      reportWindow.document.write('<p style="font-family:Arial;padding:30px">Формируется полный отчёт…</p>');
      try{
        const html=await wrapped();
        reportWindow.document.open();
        reportWindow.document.write(html);
        reportWindow.document.close();
        await wait(220);
        reportWindow.focus();
        reportWindow.print();
      }catch(error){reportWindow.close();throw error}
    };
    lastClaimed=wrapped;
    claim(wrapped);
    if(attempts<160)setTimeout(install,250);
  }

  window.BogatkaReportFinalizeV431={version:VERSION,ready:true,install,renderReport,buildLocationReportHtml:buildLocationReportHtmlV431};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('load',()=>setTimeout(install,100),{once:true});
})();
