(function(){
'use strict';
const C=window.BogatkaReportCoreV433;
if(!C)throw new Error('Bogatka report core is unavailable.');
const {VERSION,clean,node,append,findSection,fieldMap,firstValue,firstSentence,parseNumber,makePill,metricItems,contextData,sectionSubtitle,makeMetric,makeLabeledValue,pickLeadPhoto}=C;
function buildSingleHero(doc,location,oldCover){
  const data=contextData(location);
  const hero=node(doc,'section','report-hero-v433 report-hero-single-v433'),copy=node(doc,'div','report-hero-copy-v433'),eyebrow=node(doc,'p','report-eyebrow-v433');
  append(eyebrow,node(doc,'span','','BOGATKA'),node(doc,'span','report-eyebrow-separator-v433','•'),node(doc,'span','','ДОСЬЕ ЛОКАЦИИ'),node(doc,'span','report-version-v433',VERSION));
  const title=node(doc,'h1','report-display-v433',data.title),address=node(doc,'p','report-address-v433',data.address||'Адрес не указан'),context=node(doc,'p','report-context-v433','Решение по объекту на основе осмотра, оценки, экономики и рыночного окружения.');
  const conclusion=node(doc,'div','report-hero-conclusion-v433');append(conclusion,node(doc,'span','','Исполнительное заключение'),node(doc,'p','',data.reason||data.system||'Заключение пока не зафиксировано.'));
  const next=node(doc,'div','report-next-action-v433');append(next,node(doc,'span','','Следующее действие'),node(doc,'p','',data.next||'Следующее действие пока не определено.'));
  append(copy,eyebrow,title,address,context,conclusion,next);
  const panel=node(doc,'aside','report-hero-panel-v433'),statusRow=node(doc,'div','report-hero-status-row-v433'),rec=node(doc,'div','report-hero-status-v433');
  const heroStatus=data.statusNode?.cloneNode(true)||makePill(doc,data.recommendation||'Недостаточно данных');if(heroStatus)heroStatus.classList.add('report-status-v433');
  append(rec,node(doc,'span','','Аналитическая рекомендация'),heroStatus);
  const decision=node(doc,'div','report-decision-primary-v433');append(decision,node(doc,'span','','Управленческое решение'),node(doc,'strong','',data.decision||'Не выбрано'));
  append(statusRow,rec,decision);
  const metricGrid=node(doc,'div','report-hero-metrics-v433 report-metrics');data.metrics.slice(0,3).forEach(item=>metricGrid.appendChild(makeMetric(doc,item)));
  const compatibilityStatus=data.statusNode?.cloneNode(true)||makePill(doc,data.recommendation||'Недостаточно данных');if(compatibilityStatus){compatibilityStatus.classList.add('report-compat-status-v433');metricGrid.appendChild(compatibilityStatus)}
  append(panel,statusRow,metricGrid);
  const lead=pickLeadPhoto(location);
  if(lead){const figure=node(doc,'figure','report-hero-photo-v433'),img=lead.querySelector('img')?.cloneNode(true),caption=lead.querySelector('figcaption')?.cloneNode(true);if(img){img.loading='eager';append(figure,img,caption);panel.appendChild(figure)}}
  append(hero,copy,panel);oldCover.replaceWith(hero);
  location.querySelector(':scope>.report-location-header')?.remove();location.querySelector(':scope>.report-decision-strip')?.remove();findSection(location,'Решение')?.remove();
  return data;
}
function buildExecutiveDecision(doc,location,data){
  const section=node(doc,'section','report-executive-decision-v433'),heading=node(doc,'div','report-section-heading-v433');
  append(heading,node(doc,'p','report-kicker-v433','EXECUTIVE SUMMARY'),node(doc,'h2','','Решение в одном экране'));
  const conclusion=node(doc,'div','report-executive-conclusion-v433');append(conclusion,node(doc,'span','','Вывод'),node(doc,'p','',data.reason||data.system||'Обоснование решения пока не зафиксировано.'));
  const grid=node(doc,'div','report-executive-grid-v433');append(grid,makeLabeledValue(doc,'Сильные стороны',data.strengths||'Сильные стороны отдельно не зафиксированы.','strength'),makeLabeledValue(doc,'Основные риски',data.risks||'Риски отдельно не зафиксированы.','risk'),makeLabeledValue(doc,'Следующий шаг',data.next||'Следующий шаг пока не определён.','next'));
  append(section,heading,conclusion,grid);location.prepend(section);
}
function transformEconomySection(doc,section){
  if(!section||section.dataset.economyExecutiveV433)return;
  const body=section.querySelector('.report-section-body,.report-accordion-body-v432');if(!body)return;
  const values=fieldMap(body),revenue=firstValue(values,['Прогноз выручки в месяц']),margin=firstValue(values,['Валовая маржа']);
  body.replaceChildren();body.classList.add('report-economy-body-v433');section.dataset.economyExecutiveV433='';
  if(!revenue||!margin){body.appendChild(node(doc,'div','report-economy-empty-v433','Финансовая модель не рассчитана: требуется прогноз выручки и валовой маржи.'));return}
  const primaryData=[['Выручка в месяц',revenue],['Операционная прибыль',firstValue(values,['Операционная прибыль'])||'—'],['Инвестиции в открытие',firstValue(values,['Итоговые инвестиции в открытие'])||'—'],['Окупаемость',firstValue(values,['Расчётная окупаемость'])||'—']];
  const primary=node(doc,'div','report-finance-primary-v433');primaryData.forEach(([label,value])=>{const metric=node(doc,'div','report-finance-metric-v433');append(metric,node(doc,'span','',label),node(doc,'strong','',value));primary.appendChild(metric)});
  const ratioValue=firstValue(values,['Доля аренды в выручке']),ratio=parseNumber(ratioValue),ratioBlock=node(doc,'div','report-finance-ratio-v433');
  append(ratioBlock,node(doc,'div','report-finance-ratio-copy-v433',ratioValue?`Доля аренды в выручке: ${ratioValue}`:'Доля аренды в выручке не рассчитана.'));
  const track=node(doc,'div','report-finance-track-v433'),fill=node(doc,'span','report-finance-fill-v433');fill.style.width=`${Math.max(0,Math.min(100,ratio??0))}%`;track.appendChild(fill);ratioBlock.appendChild(track);
  const labels=['Валовая маржа','Налоги с выручки','Валовая прибыль','Ежемесячные постоянные расходы','Операционная маржа','Выручка для безубыточности','Фонд оплаты труда','Маркетинг','Логистика','Прочие ежемесячные расходы','Стартовый товарный запас','Оборотный капитал','Прочие разовые затраты'];
  const breakdown=node(doc,'dl','report-finance-breakdown-v433');labels.forEach(label=>{const value=values.get(label)?.value;if(value)append(breakdown,node(doc,'dt','',label),node(doc,'dd','',value))});
  append(body,primary,ratioBlock,breakdown);
  const note=firstValue(values,['Основание прогноза','Комментарий']);if(note){const narrative=node(doc,'div','report-finance-note-v433');append(narrative,node(doc,'span','','Основание прогноза'),node(doc,'p','',note));body.appendChild(narrative)}
}
function makeAccordion(doc,section,index,open){
  if(section.dataset.reportAccordionV432)return;
  const title=C.sectionTitle(section)||`Раздел ${index+1}`,originalBody=section.querySelector('.report-section-body');if(!originalBody)return;
  const button=node(doc,'button','report-accordion-summary-v432 report-accordion-summary-v433');button.type='button';button.setAttribute('aria-expanded',String(open));
  const bodyId=`report-section-${index+1}-${Math.random().toString(36).slice(2,8)}`;button.setAttribute('aria-controls',bodyId);
  append(button,node(doc,'span','report-section-icon-v432',String(index+1).padStart(2,'0')),append(node(doc,'span','report-section-label-v432'),node(doc,'strong','',title),node(doc,'small','',sectionSubtitle(title))),node(doc,'span','report-chevron-v432'));
  button.lastElementChild.setAttribute('aria-hidden','true');
  const accordionBody=node(doc,'div','report-accordion-body-v432 report-accordion-body-v433');accordionBody.id=bodyId;if(!open)accordionBody.hidden=true;while(originalBody.firstChild)accordionBody.appendChild(originalBody.firstChild);
  section.replaceChildren(button,accordionBody);section.classList.add('report-accordion-v432','report-section-accordion-v432','report-section-editorial-v433');section.dataset.reportAccordionV432='';section.dataset.open=String(open);
}
function wrapSingleSections(doc,location){
  const desired=['Основные сведения','Технические параметры','Экономическая модель','Трафик','Конкуренты','Выводы и риски','Задачи и комментарии','Фотографии'];
  [...location.querySelectorAll(':scope>.report-section')].forEach(section=>{const title=C.sectionTitle(section);if(!desired.includes(title)&&title==='Состояние заполнения')section.remove()});
  desired.forEach(title=>{const section=[...location.querySelectorAll(':scope>.report-section')].find(item=>C.sectionTitle(item)===title);if(section)location.appendChild(section)});
  [...location.querySelectorAll(':scope>.report-section')].forEach((section,index)=>makeAccordion(doc,section,index,/^(?:Основные сведения|Экономическая модель)$/i.test(C.sectionTitle(section))));
}
Object.assign(C,{buildSingleHero,buildExecutiveDecision,makeAccordion,wrapSingleSections,transformEconomySection});
})();
