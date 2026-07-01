(function(){
  'use strict';
  if(window.BogatkaQuickChecklistReportV451?.ready)return;

  const VERSION='4.5.1';
  let attempts=0;

  function transformReport(html){
    const api=window.BogatkaQuickChecklistV451;
    const reportDocument=new DOMParser().parseFromString(html,'text/html');
    reportDocument.querySelectorAll('[data-quick-checklist-v451],.quick-checklist-v451').forEach(details=>{
      details.dataset.quickChecklistV451='1';
      details.dataset.quickChecklistReportV451='1';
      details.querySelectorAll('.check-row').forEach(row=>{
        const state=api?.normalizeState?.(row.dataset.checkState)||row.dataset.checkState||'unchecked';
        row.dataset.checkState=state;
        row.classList.add(`report-check-${state}-v451`);
        const value=row.querySelector('.report-select-value,.report-control-value');
        if(value)value.textContent=api?.stateLabel?.(state)||({yes:'Да',no:'Нет',not_applicable:'Не требуется',unchecked:'Не проверено'}[state]||'Не проверено');
      });
    });
    if(!reportDocument.getElementById('quickChecklistReportStyleV451')){
      const style=reportDocument.createElement('style');
      style.id='quickChecklistReportStyleV451';
      style.textContent=`
        .report-location-card .quick-checklist-v451 .check-row{display:grid!important;grid-template-columns:minmax(0,1fr) 132px!important;align-items:center!important;gap:10px!important;padding:8px 10px!important;border:1px solid #dfe8e3!important;border-radius:10px!important;background:#fff!important;break-inside:avoid}
        .report-location-card .quick-checklist-v451 .check-row>span:first-of-type{font-size:10px!important;line-height:1.35!important;color:#294c3c!important}
        .report-location-card .quick-checklist-v451 .report-control-value{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:29px!important;padding:5px 8px!important;border-radius:8px!important;border:1px solid #d7e2dc!important;font-size:9px!important;font-weight:800!important;text-align:center!important}
        .report-location-card .quick-checklist-v451 .report-check-yes-v451 .report-control-value{background:#e8f5ed!important;border-color:#bedcc9!important;color:#246043!important}
        .report-location-card .quick-checklist-v451 .report-check-no-v451 .report-control-value{background:#fff0f0!important;border-color:#e4c1c1!important;color:#8b3434!important}
        .report-location-card .quick-checklist-v451 .report-check-not_applicable-v451 .report-control-value{background:#f1f3f2!important;border-color:#d9dfdc!important;color:#66746d!important}
        .report-location-card .quick-checklist-v451 .report-check-unchecked-v451 .report-control-value{background:#fff8e9!important;border-color:#ead6a8!important;color:#85611c!important}
        .report-location-card .quick-checklist-summary-v451{grid-template-columns:1.35fr repeat(4,minmax(0,1fr))!important;break-inside:avoid}
        @media print{.report-location-card .quick-checklist-v451 .check-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
      `;
      reportDocument.head.appendChild(style);
    }
    return `<!doctype html>\n${reportDocument.documentElement.outerHTML}`;
  }

  function claim(builder){
    const api=window.BogatkaLiveReport;
    if(api)api.build=builder;
    window.buildReportHtml=builder;
    window.exportHtmlReport=builder.__htmlAction;
    window.openPdfReport=builder.__pdfAction;
    try{
      buildReportHtml=builder;
      exportHtmlReport=builder.__htmlAction;
      openPdfReport=builder.__pdfAction;
    }catch(_){ }
  }

  function install(){
    attempts+=1;
    const current=window.BogatkaLiveReport?.build;
    const compatible=Boolean(
      current?.__technicalEconomicsReportV450&&
      current?.__reportStabilityV429&&
      window.BogatkaQuickChecklistV451?.ready
    );
    if(typeof current==='function'&&compatible){
      if(current.__quickChecklistReportV451){
        claim(current);
      }else{
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
            reportWindow.document.open();
            reportWindow.document.write(html);
            reportWindow.document.close();
            await Promise.all([...reportWindow.document.images].map(image=>image.complete?Promise.resolve():new Promise(resolve=>{
              image.addEventListener('load',resolve,{once:true});
              image.addEventListener('error',resolve,{once:true});
            })));
            if(reportWindow.document.fonts?.ready)await reportWindow.document.fonts.ready;
            reportWindow.focus();
            reportWindow.print();
          }catch(error){
            reportWindow.close();
            throw error;
          }
        };
        wrapped=async function(...args){
          await window.BogatkaQuickChecklistV451.enhanceAll();
          const result=transformReport(await current(...args));
          claim(wrapped);
          return result;
        };
        Object.assign(wrapped,current);
        wrapped.__quickChecklistV451=true;
        wrapped.__quickChecklistReportV451=true;
        wrapped.__base=current;
        wrapped.__htmlAction=exportHtml;
        wrapped.__pdfAction=openPdf;
        claim(wrapped);
      }
    }
    if(attempts<120)setTimeout(install,250);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('load',()=>setTimeout(install,100),{once:true});

  window.BogatkaQuickChecklistReportV451={
    version:VERSION,
    ready:true,
    install,
    transformReport,
  };
})();
