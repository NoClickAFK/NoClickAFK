escapeHtml=function(value=''){return String(value).replace(/[&<>"']/g,function(char){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]})};
(function(){
  'use strict';
  const deal=window.BogatkaCriticalDeal;
  if(!deal)return;

  stopState=function(data){
    const gate=deal.evaluate(data);
    return {blocks:gate.counts.blocked,risks:gate.counts.needs_formalization,gate};
  };

  recommendation=function(data,weighted,economy){
    const gate=deal.evaluate(data);
    if(gate.code==='blocked')return{text:'СТОП',className:'stop'};
    if(economy.revenue>0&&economy.profit<=0)return{text:'Экономика не сходится',className:'stop'};
    if(economy.rentBurden>18)return{text:'Высокая аренда',className:'risk'};
    if(weighted>=75)return{text:'Высокий приоритет',className:'good'};
    if(weighted>=60)return{text:'Перспективно',className:'good'};
    if(weighted>=45)return{text:'Средний потенциал',className:'medium'};
    return{text:'Недостаточно данных',className:'empty'};
  };

  renderStops=function(data){
    const gate=deal.evaluate(data);
    const tone=gate.code==='blocked'?'stop':gate.code==='needs_formalization'?'risk':gate.code==='confirmed'?'good':'empty';
    const rows=gate.entries.map(function(entry){
      return '<tr><td><strong>'+escapeHtml(entry.definition.title)+'</strong></td><td><b>Статус:</b> '+escapeHtml(deal.statusLabel(entry.value.status))+'<br><b>Чем подтверждено:</b> '+escapeHtml(deal.evidenceLabel(entry.value.evidenceType))+'<br><b>Комментарий / что ещё нужно получить:</b> '+display(entry.value.note)+'</td></tr>';
    }).join('');
    return '<section class="report-extra critical-deal-report"><h3>Проверки перед арендой</h3><p><span class="rec '+tone+'">'+escapeHtml(gate.text)+'</span></p><table><tbody>'+rows+'</tbody></table></section>';
  };

  renderComparison=function(locations){
    const rows=locations.map(function(location,index){
      const data=location.form_data||{};
      const weighted=weightedScore(data);
      const economy=calculateEconomy(data);
      const gate=deal.evaluate(data);
      return {index:index+1,title:location.title||location.address,weighted,raw:totalScore(data),rec:recommendation(data,weighted,economy),gate,economy,status:data.status||location.status||'—'};
    }).sort(function(left,right){return left.gate.priority-right.gate.priority||right.weighted-left.weighted});
    return '<section class="comparison"><h2>Сравнение локаций</h2><div class="wide-table"><table><thead><tr><th>Ранг</th><th>Локация</th><th>Рекомендация</th><th>Вес /100</th><th>Балл /70</th><th>Перед арендой</th><th>Статус</th><th>Аренда</th><th>Прибыль</th><th>Окупаемость</th></tr></thead><tbody>'+rows.map(function(row,index){
      const tone=row.gate.code==='blocked'?'stop':row.gate.code==='needs_formalization'?'risk':row.gate.code==='confirmed'?'good':'empty';
      return '<tr><td>#'+(index+1)+'</td><td>'+escapeHtml(row.title)+'</td><td><span class="rec '+row.rec.className+'">'+escapeHtml(row.rec.text)+'</span></td><td>'+row.weighted+'</td><td>'+row.raw+'</td><td><span class="rec '+tone+'">'+escapeHtml(row.gate.compactText)+'</span></td><td>'+escapeHtml(row.status)+'</td><td>'+formatNumber(row.economy.rent,2)+'</td><td>'+formatNumber(row.economy.profit,2)+'</td><td>'+(row.economy.payback==null?'—':formatNumber(row.economy.payback,1)+' мес.')+'</td></tr>';
    }).join('')+'</tbody></table></div></section>';
  };
})();
