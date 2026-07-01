(function(){
  'use strict';
  if(window.BogatkaCardProgressReportV448?.ready)return;

  const VERSION='4.4.8';
  let attempts=0;

  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const clamp=value=>Math.min(100,Math.max(0,Number(value||0)));

  function markRecommendationSelectors(){
    document.querySelectorAll('[data-card-recommendation-v448]').forEach(node=>{
      node.dataset.recommendation=node.closest('[data-location-card]')?.dataset.locationCard||'1';
    });
  }

  function metricById(id,index){
    const metrics=window.BogatkaDecisionUI?.lastMetrics||[];
    return metrics.find(metric=>metric.id===id)||metrics[index]||null;
  }

  function groupText(group){
    if(!group)return'';
    if(group.missingCount===0)return'Раздел заполнен';
    if(group.key==='scores')return`Осталось оценить ${group.missingCount} из ${group.total} критериев`;
    if(group.key==='photos')return group.detail||`Не хватает ${group.missingCount} фото`;
    if(group.key==='checks')return group.detail||`Не завершено ${group.missingCount} проверок`;
    const labels=(group.missingLabels||[]).slice(0,3);
    return `${labels.join(', ')}${(group.missingLabels||[]).length>3?` и ещё ${(group.missingLabels||[]).length-3}`:''}`;
  }

  function reportProgressHtml(metric){
    const quality=metric?.qualityScore;
    const qualityText=quality===null||quality===undefined?'—':`${Number.isInteger(quality)?quality:Number(quality).toFixed(1)}/100`;
    const coverage=Math.round(metric?.scoreCoveragePct||0);
    const completion=Math.round(metric?.completion||0);
    const groups=(metric?.progressGroups||[]).filter(group=>group.missingCount>0);
    const plan=groups.length?groups.map((group,index)=>`
      <div class="report-progress-row-v448${index===0?' active':''}">
        <div><span>${index===0?'Следующий приоритет':'Далее'}</span><strong>${escapeHtml(group.title)}</strong><small>${escapeHtml(groupText(group))}</small></div>
        <b>${group.percent}%</b>
      </div>`).join(''):'<div class="report-progress-complete-v448"><strong>Карточка заполнена.</strong><span>Можно переходить к итоговому решению.</span></div>';
    return `<section class="report-card-progress-v448">
      <div class="report-progress-title-v448"><div><h3>Оценка и готовность данных</h3><p>Качество локации отделено от полноты заполнения.</p></div><div class="report-progress-decision-v448 ${escapeHtml(metric?.recommendation?.className||'empty')}"><span>Рекомендация</span><strong>${escapeHtml(metric?.recommendation?.label||'Недостаточно данных')}</strong><small>${escapeHtml(metric?.recommendation?.reason||'')}</small></div></div>
      <div class="report-progress-metrics-v448">
        <div><span>Качество локации</span><strong>${qualityText}</strong><small>${quality===null||quality===undefined?'Нет оценок':'По заполненным критериям'}</small></div>
        <div><span>Надёжность оценки</span><strong>${coverage}%</strong><small>${metric?.answeredScores||0} из 14 критериев</small></div>
        <div><span>Готовность карточки</span><strong>${completion}%</strong><small>${metric?.completedProgressGroups||0} из ${metric?.totalProgressGroups||7} разделов</small></div>
        <div><span>Проверки перед арендой</span><strong>${escapeHtml(metric?.dealGate?.compactText||'Не проверено')}</strong><small>${escapeHtml(metric?.dealGate?.badge||'')}</small></div>
      </div>
      <div class="report-quality-scale-v448"><i style="left:${clamp(quality)}%"></i></div>
      <p class="report-score-rule-v448"><strong>Как считается качество:</strong> 1 балл = 0, 2 = 25, 3 = 50, 4 = 75, 5 = 100. Пустые критерии не занижают качество — они уменьшают надёжность оценки.</p>
      <div class="report-fill-plan-v448"><h4>Что заполнить дальше</h4>${plan}</div>
    </section>`;
  }

  function transformReport(html){
    const documentReport=new DOMParser().parseFromString(html,'text/html');
    const cards=[...documentReport.querySelectorAll('.report-location-card')];
    cards.forEach((card,index)=>{
      const id=card.dataset.locationCard||card.dataset.locationId||locations?.[index]?.id;
      const metric=metricById(id,index);
      const header=card.querySelector('.report-head-metrics-v428');
      if(header){
        header.className='report-head-recommendation-v448';
        header.innerHTML=`<span>Текущая рекомендация</span><strong>${escapeHtml(metric?.recommendation?.label||'Недостаточно данных')}</strong><small>${escapeHtml(metric?.recommendation?.reason||'')}</small>`;
      }
      card.querySelector('.report-card-progress-v448')?.remove();
      const body=card.querySelector('.report-location-body,.location-body');
      body?.insertAdjacentHTML('afterbegin',reportProgressHtml(metric));
    });
    if(!documentReport.getElementById('reportCardProgressStyleV448')){
      const style=documentReport.createElement('style');
      style.id='reportCardProgressStyleV448';
      style.textContent=`
        .report-location-card .location-head{grid-template-columns:minmax(0,1fr) minmax(250px,316px)!important}
        .report-head-recommendation-v448{display:grid;gap:4px;min-width:0;padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:#f4f8f6}
        .report-head-recommendation-v448>span,.report-progress-decision-v448>span{color:var(--muted);font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}
        .report-head-recommendation-v448>strong{color:var(--green);font-size:16px;line-height:1.25}.report-head-recommendation-v448>small{color:var(--muted);font-size:10px;line-height:1.35}
        .report-card-progress-v448{margin:0 0 16px;padding:15px;border:1px solid var(--line);border-radius:16px;background:linear-gradient(180deg,#fbfdfc,#f2f7f4);break-inside:avoid}
        .report-progress-title-v448{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,320px);gap:12px;align-items:start}.report-progress-title-v448 h3{margin:0;color:var(--green);font-size:18px}.report-progress-title-v448 p{margin:3px 0 0;color:var(--muted);font-size:10px}
        .report-progress-decision-v448{display:grid;gap:3px;padding:9px 11px;border:1px solid var(--line);border-radius:11px;background:#fff}.report-progress-decision-v448>strong{color:var(--green);font-size:13px}.report-progress-decision-v448>small{color:var(--muted);font-size:9px;line-height:1.3}
        .report-progress-decision-v448.stop{border-color:#d79b9b;background:#fff1f1}.report-progress-decision-v448.stop>strong{color:#8f2d2d}.report-progress-decision-v448.risk{border-color:#ddbd7b;background:#fff7e7}.report-progress-decision-v448.risk>strong{color:#7e540f}
        .report-progress-metrics-v448{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:11px}.report-progress-metrics-v448>div{display:grid;gap:3px;padding:9px;border:1px solid var(--line);border-radius:10px;background:#fff}.report-progress-metrics-v448 span{color:var(--muted);font-size:9px}.report-progress-metrics-v448 strong{color:var(--green);font-size:16px}.report-progress-metrics-v448 small{color:var(--muted);font-size:8px;line-height:1.3}
        .report-quality-scale-v448{position:relative;height:8px;margin-top:10px;border-radius:999px;background:linear-gradient(90deg,#d8b8b8 0 39%,#ddd7aa 39% 59%,#bcd8c8 59% 74%,#7fc39c 74% 100%)}.report-quality-scale-v448 i{position:absolute;top:50%;width:13px;height:13px;border:2px solid #fff;border-radius:50%;background:var(--green);transform:translate(-50%,-50%)}
        .report-score-rule-v448{margin:9px 0 0;padding:8px 10px;border-left:3px solid #5d9c7d;border-radius:8px;background:#edf6f1;color:var(--muted);font-size:9px;line-height:1.4}.report-score-rule-v448 strong{color:#315f49}
        .report-fill-plan-v448{margin-top:10px}.report-fill-plan-v448 h4{margin:0 0 6px;color:var(--green);font-size:12px}.report-progress-row-v448{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:7px 9px;border-top:1px solid var(--line)}.report-progress-row-v448>div{display:grid;gap:1px}.report-progress-row-v448 span{color:var(--muted);font-size:7px;text-transform:uppercase}.report-progress-row-v448 strong{font-size:10px}.report-progress-row-v448 small{color:var(--muted);font-size:8px}.report-progress-row-v448>b{color:var(--green);font-size:10px}.report-progress-complete-v448{display:grid;gap:2px;padding:8px;border:1px solid #b8d9c5;border-radius:9px;background:#eff9f3;font-size:9px}
        @media(max-width:700px){.report-location-card .location-head,.report-progress-title-v448{grid-template-columns:1fr!important}.report-progress-metrics-v448{grid-template-columns:1fr 1fr}.report-head-recommendation-v448{width:100%!important}}
        @media print{.report-location-card .location-head{grid-template-columns:minmax(0,1fr) 70mm!important}.report-progress-title-v448{grid-template-columns:minmax(0,1fr) 60mm}.report-progress-metrics-v448{grid-template-columns:repeat(4,1fr)}}`;
      documentReport.head.append(style);
    }
    return `<!doctype html>\n${documentReport.documentElement.outerHTML}`;
  }

  function claim(builder){
    const api=window.BogatkaLiveReport;
    if(api)api.build=builder;
    window.buildReportHtml=builder;
    window.exportHtmlReport=builder.__htmlAction;
    window.openPdfReport=builder.__pdfAction;
    try{buildReportHtml=builder;exportHtmlReport=builder.__htmlAction;openPdfReport=builder.__pdfAction}catch(_){ }
  }

  function install(){
    attempts+=1;
    markRecommendationSelectors();
    const current=window.BogatkaLiveReport?.build;
    if(typeof current!=='function'||!current.__reportStabilityV429){
      if(attempts<220)setTimeout(install,80);
      return;
    }
    if(current.__cardProgressReportV448){claim(current);return}

    let wrapped=null;
    const exportHtml=async function(){
      if(typeof showSaving==='function')showSaving();
      const html=await wrapped();
      downloadBlob(new Blob([html],{type:'text/html;charset=utf-8'}),`bogatka-premium-report-${new Date().toISOString().slice(0,10)}.html`);
      if(typeof showSaved==='function')showSaved();
    };
    const openPdf=async function(){
      const reportWindow=window.open('','_blank');
      if(!reportWindow)return alert('Браузер заблокировал новое окно. Разрешите всплывающие окна для создания PDF.');
      reportWindow.document.write('<p style="font-family:Arial;padding:30px">Формируется полный отчёт…</p>');
      try{
        const html=await wrapped();
        reportWindow.document.open();reportWindow.document.write(html);reportWindow.document.close();
        await Promise.all([...reportWindow.document.images].map(image=>image.complete?Promise.resolve():new Promise(resolve=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true})})));
        if(reportWindow.document.fonts?.ready)await reportWindow.document.fonts.ready;
        reportWindow.focus();reportWindow.print();
      }catch(error){reportWindow.close();throw error}
    };
    wrapped=async function(...args){
      const html=await current(...args);
      const result=transformReport(html);
      claim(wrapped);
      return result;
    };
    for(const key of ['__reportStabilityV429','__reportAuthorityV429','__reportAuthorityV428','__reportPolishV428','__liveReportFinalV427','__locationProfileV416','__locationProfileV425','__locationOverviewV417','__locationOverviewV421','__locationPanelsV419','__statusNextTaskV447','__cardProgressV448'])wrapped[key]=true;
    wrapped.__cardProgressReportV448=true;
    wrapped.__base=current;
    wrapped.__htmlAction=exportHtml;
    wrapped.__pdfAction=openPdf;
    claim(wrapped);
  }

  const observer=new MutationObserver(()=>markRecommendationSelectors());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('load',()=>setTimeout(install,100),{once:true});

  window.BogatkaCardProgressReportV448={version:VERSION,ready:true,transformReport,install,markRecommendationSelectors};
})();
