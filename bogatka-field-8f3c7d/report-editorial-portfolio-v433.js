(function(){
'use strict';
const C=window.BogatkaReportCoreV433;
if(!C)throw new Error('Bogatka report core is unavailable.');
const {VERSION,clean,node,append,findSection,firstSentence,parseNumber,makePill,contextData,makeLabeledValue,transformEconomySection,sectionTitle,isSingle}=C;
function buildFullHero(doc,cover,locations){
  const hero=node(doc,'section','report-hero-v433 report-hero-full-v433'),copy=node(doc,'div','report-hero-copy-v433'),eyebrow=node(doc,'p','report-eyebrow-v433');
  append(eyebrow,node(doc,'span','','BOGATKA'),node(doc,'span','report-eyebrow-separator-v433','•'),node(doc,'span','','PORTFOLIO REVIEW'),node(doc,'span','report-version-v433',VERSION));
  append(copy,eyebrow,node(doc,'h1','report-display-v433','Портфель локаций: управленческий обзор'),node(doc,'p','report-context-v433','Приоритеты, риски и готовность данных по активным объектам.'),node(doc,'p','report-full-hero-note-v433','Отчёт предназначен для выбора локаций и фиксации следующего управленческого действия.'));
  const panel=node(doc,'aside','report-portfolio-count-v433');append(panel,node(doc,'span','','Активных локаций'),node(doc,'strong','',String(locations.length)),node(doc,'small','','Детальные досье приведены ниже'));
  append(hero,copy,panel);cover.replaceWith(hero);return hero;
}
function buildPortfolioSummary(doc,oldSummary,locations){
  const withDecision=locations.filter(location=>contextData(location).decision).length,selected=locations.filter(location=>/остав|выбр|приоритет/i.test(contextData(location).decision)).length,pending=locations.length-withDecision;
  const weighted=locations.map(location=>parseNumber(contextData(location).metrics[1]?.value)).filter(Number.isFinite),completion=locations.map(location=>parseNumber(contextData(location).metrics[2]?.value)).filter(Number.isFinite);
  const summary=node(doc,'section','report-portfolio-summary-v433 report-top-section-v433'),heading=node(doc,'div','report-section-heading-v433');append(heading,node(doc,'p','report-kicker-v433','PORTFOLIO SNAPSHOT'),node(doc,'h2','','Исполнительная сводка'));
  const grid=node(doc,'div','report-portfolio-kpis-v433');
  [['Локаций',locations.length],['С решением',withDecision],['Выбрано / оставить',selected],['Ожидают решения',pending],['Лучший вес',weighted.length?`${Math.max(...weighted)}/100`:'—'],['Средняя готовность',completion.length?`${Math.round(completion.reduce((a,b)=>a+b,0)/completion.length)}%`:'—']].forEach(([label,value])=>{const item=node(doc,'div','report-portfolio-kpi-v433');append(item,node(doc,'strong','',String(value)),node(doc,'span','',label));grid.appendChild(item)});
  append(summary,heading,grid);oldSummary?.replaceWith(summary);return summary;
}
function locationInsight(location,data){
  return firstSentence(data.reason||data.system||data.strengths||data.risks,150)||(parseNumber(data.metrics[2]?.value)!==null&&parseNumber(data.metrics[2]?.value)<35?'Ключевые данные по объекту заполнены не полностью.':'Дополнительный вывод по локации не зафиксирован.');
}
function buildShortlist(doc,locations){
  const candidates=locations.map((location,index)=>({location,index,data:contextData(location)})).filter(item=>item.data.metrics.some(metric=>parseNumber(metric.value)!==null)||item.data.recommendation).slice(0,3);
  if(!candidates.length)return null;
  const section=node(doc,'section','report-shortlist-v433 report-top-section-v433'),heading=node(doc,'div','report-section-heading-v433');append(heading,node(doc,'p','report-kicker-v433','PRIORITY SHORTLIST'),node(doc,'h2','','Локации для первого рассмотрения'));
  const grid=node(doc,'div','report-shortlist-grid-v433');
  candidates.forEach(({location,index,data})=>{
    const card=node(doc,'article','report-shortlist-card-v433'),top=node(doc,'div','report-shortlist-top-v433');append(top,node(doc,'span','report-shortlist-rank-v433',String(index+1).padStart(2,'0')),makePill(doc,data.recommendation||'Недостаточно данных'));
    const metrics=node(doc,'div','report-shortlist-metrics-v433');data.metrics.slice(0,3).forEach(item=>append(metrics,makeLabeledValue(doc,item.label,item.value,'compact')));
    append(card,top,node(doc,'h3','',data.title),node(doc,'p','report-shortlist-address-v433',data.address||'Адрес не указан'),metrics,makeLabeledValue(doc,'Решение',data.decision||'Не выбрано','decision'),node(doc,'p','report-shortlist-insight-v433',locationInsight(location,data)));grid.appendChild(card);
  });
  append(section,heading,grid);return section;
}
function buildRiskOverview(doc,locations){
  const low=locations.map((location,index)=>({location,index,data:contextData(location)})).filter(item=>{const completion=parseNumber(item.data.metrics[2]?.value);return completion===null||completion<35||!item.data.decision});
  const section=node(doc,'section','report-risk-overview-v433 report-top-section-v433'),heading=node(doc,'div','report-section-heading-v433');append(heading,node(doc,'p','report-kicker-v433','DATA & RISK CONTROL'),node(doc,'h2','','Риски и незавершённые данные'));
  if(!low.length){append(section,heading,node(doc,'p','report-neutral-message-v433','Критичных пробелов в данных по активным локациям не выявлено.'));return section}
  const list=node(doc,'div','report-risk-list-v433');
  low.forEach(({index,data})=>{const row=node(doc,'div','report-risk-row-v433'),name=node(doc,'div','report-risk-location-v433');append(name,node(doc,'strong','',data.title),node(doc,'small','',data.address||'Адрес не указан'));const completion=data.metrics[2]?.value||'—',action=data.next||(!data.decision?'Требуется управленческое решение.':'Требуется дополнить ключевые данные.');append(row,node(doc,'span','report-risk-rank-v433',String(index+1).padStart(2,'0')),name,makeLabeledValue(doc,'Готовность',completion,'compact'),node(doc,'p','report-risk-action-v433',action));list.appendChild(row)});
  append(section,heading,list);return section;
}
function makeComparisonAccordion(doc,comparison){
  if(!comparison)return;const heading=clean(comparison.querySelector('h2')?.textContent)||'Сравнение локаций',tableWrap=comparison.querySelector('.report-table-wrap');if(!tableWrap)return;
  const button=node(doc,'button','report-comparison-toggle-v433 report-accordion-summary-v432');button.type='button';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','report-comparison-body-v433');append(button,append(node(doc,'span','report-comparison-title-v433'),node(doc,'small','','АНАЛИТИЧЕСКИЙ ИНСТРУМЕНТ'),node(doc,'strong','',heading)),node(doc,'span','report-comparison-hint-v433','Открыть таблицу'),node(doc,'span','report-chevron-v432'));button.lastElementChild.setAttribute('aria-hidden','true');
  const body=node(doc,'div','report-comparison-body-v433 report-accordion-body-v432');body.id='report-comparison-body-v433';body.hidden=true;body.appendChild(tableWrap);comparison.replaceChildren(button,body);comparison.className='report-comparison report-comparison-v433 report-comparison-accordion-v433 report-accordion-v432';comparison.dataset.open='false';
}
function dehydratePhotos(root){root.querySelectorAll('.report-photo img').forEach(img=>{if(img.getAttribute('src')&&!img.dataset.reportSrc){img.dataset.reportSrc=img.getAttribute('src');img.removeAttribute('src');img.loading='lazy'}})}
function makeLocationSummary(doc,location,index,open,dataOverride=null){
  const data=dataOverride||contextData(location),button=node(doc,'button','report-location-summary-v432 report-accordion-summary-v432 report-location-summary-v433');button.type='button';button.setAttribute('aria-expanded',String(open));const bodyId=`report-location-body-${index+1}`;button.setAttribute('aria-controls',bodyId);
  const rank=node(doc,'span','report-rank-v432',String(index+1).padStart(2,'0')),identity=node(doc,'span','report-location-summary-title-v432');append(identity,node(doc,'strong','',data.title),node(doc,'small','',data.address||'Адрес не указан'));
  const metrics=node(doc,'span','report-location-summary-metrics-v433');data.metrics.slice(0,3).forEach(item=>{const metric=node(doc,'span','report-location-summary-metric-v433');append(metric,node(doc,'strong','',item.value||'—'),node(doc,'small','',item.label||'Показатель'));metrics.appendChild(metric)});
  const management=node(doc,'span','report-location-management-v433');append(management,node(doc,'small','','Решение'),node(doc,'strong','',data.decision||'Не выбрано'));
  const statuses=node(doc,'span','report-location-statuses-v433'),recommendation=data.statusNode?.cloneNode(true)||makePill(doc,data.recommendation||'Недостаточно данных');if(recommendation){recommendation.classList.add('report-status-v433');statuses.appendChild(recommendation)}
  const chevron=node(doc,'span','report-chevron-v432');chevron.setAttribute('aria-hidden','true');append(button,rank,identity,metrics,management,node(doc,'span','report-location-insight-v433',locationInsight(location,data)),statuses,chevron);return button;
}
function wrapFullLocations(doc,locations){
  locations.forEach((location,index)=>{
    if(location.dataset.reportAccordionV432)return;const open=index===0,data=contextData(location),header=location.querySelector(':scope>.report-location-header'),strip=location.querySelector(':scope>.report-decision-strip'),body=node(doc,'div','report-accordion-body-v432 report-location-body-v433');body.id=`report-location-body-${index+1}`;
    while(location.firstChild)body.appendChild(location.firstChild);header?.remove();strip?.remove();if(!open){body.hidden=true;dehydratePhotos(body)}
    location.classList.add('report-accordion-v432','report-location-accordion-v432','report-location-dossier-v433');location.dataset.reportAccordionV432='';location.dataset.open=String(open);append(location,makeLocationSummary(doc,body,index,open,data),body);
    body.querySelectorAll('.report-section').forEach(section=>{section.classList.add('report-detail-section-v433');const title=sectionTitle(section),heading=section.querySelector('.report-section-title');if(heading){heading.classList.add('report-detail-heading-v433');heading.querySelector('h3,h2')?.classList.add('report-detail-title-v433')}if(title==='Экономическая модель')transformEconomySection(doc,section)});
  });
}
function addReportClasses(doc){
  const single=isSingle(doc);doc.documentElement.classList.add('report-html-v433');doc.body.classList.add('report-body-v433');doc.querySelector('.report-document')?.classList.add('report-document-v433',single?'report-document-single-v433':'report-document-full-v433');
  doc.querySelectorAll('.report-status').forEach(status=>status.classList.add('report-status-v433'));
  doc.querySelectorAll('.report-field').forEach(field=>{field.classList.add('report-data-row-v433');const label=clean(field.querySelector('span')?.textContent),value=clean(field.querySelector('strong')?.textContent);if(/причина|комментарий|основание|вывод|наблюден|плюсы|минусы|риски|вопрос/i.test(label)||value.length>110)field.classList.add('report-narrative-row-v433','report-field-wide')});
  doc.querySelectorAll('.report-photo').forEach(photo=>photo.classList.add('report-photo-v433'));
}
Object.assign(C,{ready:true,buildFullHero,buildPortfolioSummary,locationInsight,buildShortlist,buildRiskOverview,makeComparisonAccordion,dehydratePhotos,makeLocationSummary,wrapFullLocations,addReportClasses});
})();
