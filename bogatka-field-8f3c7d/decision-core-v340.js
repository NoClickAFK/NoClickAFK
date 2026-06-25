(function(){
if(window.BogatkaDecisionEngine)return;
const VERSION='3.4.0';
const WEIGHTS={housing:8,occupied:8,foot:12,car:4,parking:7,stop:4,anchor:6,visibility:8,sign:7,loading:6,condition:6,storage:5,competition:8,overall:11};
const STOPS=[
['legalUse','Назначение не допускает розничную торговлю'],
['signage','Нельзя согласовать заметную вывеску'],
['loading','Нет приемлемой разгрузки тяжёлого товара'],
['power','Недостаточная мощность и её нельзя увеличить'],
['dampness','Сырость, плесень, протечки или вредители'],
['fireSafety','Нельзя выполнить требования пожарной безопасности'],
['workingHours','Режим работы критически ограничен'],
['access','Вход или доступ неприемлемы для покупателей и доставки']
];
const PHOTO_KEYS=['street','entrance','parking','interior','engineering'];
let lastMetrics=[];
const filled=v=>v!==null&&v!==undefined&&(typeof v!=='string'||v.trim()!=='');
const ratio=a=>a.length?a.filter(filled).length/a.length:0;
function number(v){if(typeof v==='number')return Number.isFinite(v)?v:null;if(typeof v!=='string')return null;const m=v.replace(/\s+/g,'').replace(',','.').match(/-?\d+(?:\.\d+)?/);return m&&Number.isFinite(Number(m[0]))?Number(m[0]):null}
function weighted(data){let earned=0,coverage=0,count=0;for(const [key,w] of Object.entries(WEIGHTS)){const v=Number(data?.score?.[key]);if(!Number.isFinite(v)||v<1||v>5)continue;coverage+=w;count++;earned+=w*((v-1)/4)}return{weighted:Math.round(earned*10)/10,scoreCoverage:coverage,answeredScores:count,quality:coverage?Math.round(earned/coverage*1000)/10:0}}
function stopState(data){const values=STOPS.map(([key])=>data?.stopFactors?.[key]||'');return{blocks:values.filter(v=>v==='block').length,risks:values.filter(v=>v==='risk').length,answered:values.filter(v=>['clear','risk','block'].includes(v)).length,labels:STOPS.filter(([key])=>data?.stopFactors?.[key]==='block').map(([,label])=>label)}}
function completeness(data,categories){
const basic=[data.status,data.objectType,data.date,data.time,data.rent,data.contact];
const scores=Object.keys(WEIGHTS).map(k=>data?.score?.[k]);
const tech=[data?.tech?.totalArea,data?.tech?.rentPerMonth||data.rent,data?.tech?.powerKw,data?.tech?.openingHours,data?.tech?.utilities,data?.tech?.repairEstimate];
const photos=PHOTO_KEYS.map(k=>categories.has(k)?'1':'');
const stops=STOPS.map(([k])=>data?.stopFactors?.[k]);
const conclusion=[data.pros,data.cons,data.risks,data.questions,data.decision];
const sections={basic:ratio(basic),scores:ratio(scores),technical:ratio(tech),photos:ratio(photos),stops:ratio(stops),conclusion:ratio(conclusion)};
const percent=Math.round((sections.basic*.20+sections.scores*.25+sections.technical*.15+sections.photos*.20+sections.stops*.10+sections.conclusion*.10)*100);
const missing=[];
[['status','статус'],['objectType','тип объекта'],['date','дата'],['time','время'],['rent','аренда'],['contact','контакт']].forEach(([k,l])=>{if(!filled(data[k]))missing.push(l)});
const ms=scores.filter(v=>!filled(v)).length;if(ms)missing.push(`${ms} оценок из 14`);
[[data?.tech?.totalArea,'площадь'],[data?.tech?.rentPerMonth||data.rent,'аренда в месяц'],[data?.tech?.powerKw,'мощность'],[data?.tech?.openingHours,'режим работы']].forEach(([v,l])=>{if(!filled(v))missing.push(l)});
const mp=PHOTO_KEYS.filter(k=>!categories.has(k)).length;if(mp)missing.push(`${mp} обязательных фотокатегорий`);
const mst=stops.filter(v=>!filled(v)).length;if(mst)missing.push(`${mst} стоп-факторов не проверено`);
if(!filled(data.decision))missing.push('итоговое решение');
return{percent,sections,missing}}
function recommend(m){if(m.blocks)return{label:'СТОП',className:'stop',reason:`Критических факторов: ${m.blocks}`};if(m.completion<35)return{label:'Недостаточно данных',className:'empty',reason:'Заполните карточку минимум на 35%'};if(m.risks&&m.completion<70)return{label:'Требует проверки',className:'risk',reason:`Нерешённых рисков: ${m.risks}`};if(m.weighted>=75&&m.completion>=70)return{label:'Высокий приоритет',className:'priority',reason:'Сильная оценка и достаточная полнота данных'};if(m.weighted>=60)return{label:'Перспективно',className:'good',reason:'Стоит продолжать переговоры'};if(m.weighted>=45)return{label:'Средний потенциал',className:'medium',reason:'Нужны улучшения условий'};return{label:'Слабая локация',className:'weak',reason:'Текущая оценка ниже рабочего порога'}}
async function computeAll(){
const photos=await idbAll(PHOTO_STORE),photoMap=new Map();
for(const p of photos){if(!photoMap.has(p.locationId))photoMap.set(p.locationId,[]);photoMap.get(p.locationId).push(p)}
const metrics=[];
for(let i=0;i<locations.length;i++){
const item=locations[i],data=await getLocationData(item.id),items=photoMap.get(item.id)||[],categories=new Set(items.map(p=>p.category||'other')),w=weighted(data),c=completeness(data,categories),s=stopState(data),area=number(data?.tech?.totalArea),rent=number(data?.tech?.rentPerMonth)??number(data.rent);
const m={id:item.id,item,data,originalIndex:i,rawScore:totalFromData(data),weighted:w.weighted,scoreCoverage:w.scoreCoverage,answeredScores:w.answeredScores,quality:w.quality,completion:c.percent,sections:c.sections,missing:c.missing,blocks:s.blocks,risks:s.risks,stopAnswered:s.answered,stopLabels:s.labels,photoCount:items.length,area,rent,rentPerSqm:number(data?.tech?.rentPerSqm)??(rent!==null&&area?rent/area:null)};m.recommendation=recommend(m);metrics.push(m)}
const ranked=[...metrics].sort((a,b)=>a.blocks-b.blocks||a.risks-b.risks||b.weighted-a.weighted||b.completion-a.completion||b.rawScore-a.rawScore||a.originalIndex-b.originalIndex);ranked.forEach((m,i)=>m.rank=i+1);lastMetrics=metrics;return metrics}
window.BogatkaDecisionEngine={VERSION,WEIGHTS,STOPS,PHOTO_KEYS,computeAll,get lastMetrics(){return lastMetrics}};
})();
