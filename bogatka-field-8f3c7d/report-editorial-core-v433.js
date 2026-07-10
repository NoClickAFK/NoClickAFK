(function(){
'use strict';
const VERSION='4.3.3';
const clean=value=>String(value??'').replace(/[\s\u00a0]+/g,' ').trim();
const preserve=value=>String(value??'').replace(/\r\n?/g,'\n').trim();
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function safeName(value){
  const normalized=String(value||'location').normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
  return(normalized.replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]+/g,'-').replace(/^-+|-+$/g,'').replace(/-{2,}/g,'-')||'location').slice(0,72);
}
function node(doc,tag,className,text){
  const element=doc.createElement(tag);
  if(className)element.className=className;
  if(text!==undefined&&text!==null)element.textContent=String(text);
  return element;
}
function append(parent,...children){children.flat().filter(Boolean).forEach(child=>parent.appendChild(child));return parent}
function isSingle(doc){return !doc.querySelector('.report-summary,.report-comparison')}
function sectionTitle(section){return clean(section?.querySelector('.report-section-title h2,.report-section-title h3,.report-section-label-v432 strong,h2,h3')?.textContent)}
function findSection(root,title){return[...root.querySelectorAll('.report-section')].find(section=>sectionTitle(section)===title)||null}
function fieldMap(root){
  const values=new Map();
  root?.querySelectorAll('.report-field').forEach(field=>{
    const label=clean(field.querySelector('span')?.textContent);
    const value=preserve(field.querySelector('strong')?.textContent);
    if(label&&!values.has(label))values.set(label,{label,value,node:field});
  });
  return values;
}
function firstValue(map,labels){for(const label of labels){const value=map.get(label)?.value;if(value)return value}return''}
function firstSentence(value,limit=180){
  const text=clean(value);if(!text)return'';
  const sentence=text.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim()||text;
  return sentence.length>limit?`${sentence.slice(0,limit-1).trim()}…`:sentence;
}
function parseNumber(value){const match=String(value||'').replace(/\s/g,'').replace(',','.').match(/-?\d+(?:\.\d+)?/);return match?Number(match[0]):null}
function statusClass(value){
  const text=clean(value).toLowerCase();
  if(/стоп|отклон|исключ/.test(text))return'stop';
  if(/риск|уточн|средн/.test(text))return'risk';
  if(/перспектив|приоритет|хорош|остав/.test(text))return'good';
  return'empty';
}
function makePill(doc,textValue,kind=''){
  if(!clean(textValue))return null;
  return node(doc,'span',`report-status report-status-v433 ${kind||statusClass(textValue)}`,textValue);
}
function metricItems(root){
  return[...root.querySelectorAll('.report-metrics>div')].map(item=>({value:clean(item.querySelector('strong')?.textContent),label:clean(item.querySelector('span')?.textContent)})).filter(item=>item.value||item.label);
}
function removeNoise(doc){
  doc.querySelectorAll('.report-metrics>div').forEach(metric=>{const value=clean(metric.querySelector('strong')?.textContent);if(/^0(?:[,.]0+)?$/.test(value)||/^0\s*%$/.test(value))metric.remove()});
  doc.querySelectorAll('td').forEach(cell=>{if(/^0\s*\/\s*(?:70|100)|^0\s*%/i.test(clean(cell.textContent)))cell.textContent='—'});
  doc.querySelectorAll('.report-field').forEach(field=>{
    const label=clean(field.querySelector('span')?.textContent),value=clean(field.querySelector('strong')?.textContent);
    if(/^(?:0(?:[,.]0+)?\s*BYN|0(?:[,.]0+)?%|0(?:[,.]0+)?\s*мес\.)$/i.test(value))field.remove();
    if(label==='Статус экономики'&&/недостаточно данных/i.test(value))field.remove();
  });
}
function updateGeneratorMetadata(doc){
  let meta=doc.querySelector('meta[name="generator"]');
  if(!meta){meta=doc.createElement('meta');meta.name='generator';doc.head.appendChild(meta)}
  meta.content=`Bogatka premium export ${VERSION}`;
  const footer=doc.querySelector('.report-meta-footer');
  if(footer)footer.textContent=`Отчёт сформирован приложением «Богатка» · управленческий экспорт ${VERSION}`;
  doc.querySelectorAll('[data-generator-version]').forEach(element=>element.textContent=VERSION);
}
function contextData(location){
  const header=location.querySelector('.report-location-header');
  const decisionSection=findSection(location,'Решение'),conclusionSection=findSection(location,'Выводы и риски'),tasksSection=findSection(location,'Задачи и комментарии'),competitorSection=findSection(location,'Конкуренты');
  const decisionFields=fieldMap(decisionSection),conclusionFields=fieldMap(conclusionSection),taskFields=fieldMap(tasksSection),competitorFields=fieldMap(competitorSection);
  const decision=clean(location.querySelector('.report-decision-strip strong')?.textContent)||firstValue(decisionFields,['Решение']);
  const recommendation=clean(header?.querySelector('.report-status')?.textContent);
  return{
    title:clean(header?.querySelector('h2')?.textContent)||'Локация',
    address:preserve(header?.querySelector('p:not(.report-eyebrow)')?.textContent),
    recommendation,statusNode:header?.querySelector('.report-status')?.cloneNode(true)||null,decision,metrics:metricItems(header||location),
    reason:firstValue(decisionFields,['Причина решения']),system:firstValue(decisionFields,['Комментарий системы']),
    strengths:firstValue(conclusionFields,['Плюсы'])||firstValue(competitorFields,['Сильные стороны']),
    risks:firstValue(conclusionFields,['Риски','Минусы'])||firstValue(competitorFields,['Слабые стороны']),
    next:firstValue(taskFields,['Задача','Комментарий','Текст'])||firstValue(conclusionFields,['Открытые вопросы'])||firstValue(decisionFields,['Комментарий системы']),
  };
}
function sectionSubtitle(title){return({'Основные сведения':'Ключевые факты об объекте','Технические параметры':'Площадь, аренда и инженерные условия','Экономическая модель':'Финансовая модель и окупаемость','Трафик':'Полевые замеры потока','Конкуренты':'Окружение и рыночный контекст','Выводы и риски':'Аргументы, ограничения и открытые вопросы','Задачи и комментарии':'Зафиксированные действия и наблюдения','Фотографии':'Фотофиксация объекта и окружения'})[title]||'Материалы раздела'}
function makeMetric(doc,item){const wrapper=node(doc,'div','report-hero-metric-v433');append(wrapper,node(doc,'strong','',item.value||'—'),node(doc,'span','',item.label||'Показатель'));return wrapper}
function makeLabeledValue(doc,label,value,className=''){const wrapper=node(doc,'div',`report-labeled-value-v433 ${className}`.trim());append(wrapper,node(doc,'span','',label),node(doc,'strong','',value||'Не зафиксировано'));return wrapper}
function pickLeadPhoto(location){return location.querySelector('.report-photo img')?.closest('.report-photo')||null}
function installLocationExportGuard(){
  if(document.documentElement.dataset.reportExportGuardV433==='true')return;
  document.documentElement.dataset.reportExportGuardV433='true';
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-action="export-location-html"]');
    if(!button)return;
    const card=button.closest('[data-location-card]');
    const locationId=card?.dataset.locationCard;
    const exporter=window.BogatkaReportFinalizeV433?.exportLocationHtmlReport;
    if(!locationId||typeof exporter!=='function')return;
    event.preventDefault();
    event.stopImmediatePropagation();
    Promise.resolve(exporter(locationId)).catch(error=>console.error('Location report export failed.',error));
  },true);
}
window.BogatkaReportCoreV433={VERSION,clean,preserve,wait,safeName,node,append,isSingle,sectionTitle,findSection,fieldMap,firstValue,firstSentence,parseNumber,statusClass,makePill,metricItems,removeNoise,updateGeneratorMetadata,contextData,sectionSubtitle,makeMetric,makeLabeledValue,pickLeadPhoto,installLocationExportGuard};
installLocationExportGuard();
})();
