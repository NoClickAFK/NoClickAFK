(function(){
  'use strict';

  const VERSION='4.2.9';
  const wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
  let attempts=0;

  function ensureLiveStyle(){
    if(document.getElementById('reportStabilityLiveStyleV429'))return;
    const style=document.createElement('style');
    style.id='reportStabilityLiveStyleV429';
    style.textContent=`
      #locationComparisonPanel.comparison-report-snapshot-v429{visibility:visible!important}
      #locationComparisonPanel.comparison-report-snapshot-closed-v429>.comparison-body-v332{display:none!important}
      #locationComparisonPanel.comparison-report-snapshot-closed-v429[open]>summary{border-bottom:0!important;background:linear-gradient(180deg,#f8fbf9,#f0f7f3)!important}
      #locationComparisonPanel.comparison-report-snapshot-closed-v429[open] .comparison-chevron-v332{transform:rotate(45deg) translateY(-3px)!important}
    `;
    document.head.appendChild(style);
  }

  function polishReport(html){
    const parser=new DOMParser();
    const documentReport=parser.parseFromString(html,'text/html');
    documentReport.getElementById('reportStabilityV429')?.remove();
    const style=documentReport.createElement('style');
    style.id='reportStabilityV429';
    style.textContent=`
      .report-location-card .location-head{
        display:grid!important;
        grid-template-columns:minmax(0,1fr) 316px!important;
        gap:22px!important;
        align-items:start!important;
      }
      .report-location-card .location-title-wrap{min-width:0}
      .report-head-metrics-v428{
        width:316px!important;
        max-width:316px!important;
        min-width:0!important;
        justify-self:end!important;
        align-self:start!important;
        grid-template-columns:repeat(3,minmax(0,1fr))!important;
        gap:7px!important;
      }
      .report-head-metric-v428{
        min-height:60px!important;
        border-radius:12px!important;
        padding:7px 5px!important;
      }
      .report-head-metric-line-v428{gap:3px!important}
      .report-head-metric-line-v428 strong{font-size:21px!important}
      .report-head-metric-line-v428 small{font-size:10px!important}
      .report-head-metric-v428>span{margin-top:4px!important;font-size:9px!important;line-height:1.15!important}
      .report-head-status-v428{
        min-height:29px!important;
        border-radius:10px!important;
        padding:5px 9px!important;
        font-size:11px!important;
        line-height:1.2!important;
      }
      @media(max-width:680px){
        .report-location-card .location-head{grid-template-columns:1fr!important;gap:14px!important}
        .report-head-metrics-v428{width:100%!important;max-width:316px!important;justify-self:start!important}
      }
      @media print{
        .report-location-card .location-head{grid-template-columns:minmax(0,1fr) 78mm!important;gap:5mm!important}
        .report-head-metrics-v428{width:78mm!important;max-width:78mm!important}
        .report-head-metric-v428{min-height:14mm!important;padding:1.5mm!important}
        .report-head-metric-line-v428 strong{font-size:15px!important}
        .report-head-status-v428{min-height:7mm!important;padding:1mm 2mm!important}
      }
    `;
    documentReport.head.appendChild(style);
    return `<!doctype html>\n${documentReport.documentElement.outerHTML}`;
  }

  function install(){
    attempts+=1;
    const api=window.BogatkaLiveReport;
    const current=api?.build;
    if(!api?.ready||typeof current!=='function'||!current.__reportAuthorityV428){
      if(attempts<160)setTimeout(install,80);
      return;
    }
    if(current.__reportStabilityV429){
      claim(current);
      return;
    }

    ensureLiveStyle();
    const baseBuild=current;
    let buildReportHtmlV429=null;

    const exportHtmlReportV429=async function(){
      if(typeof showSaving==='function')showSaving();
      const html=await buildReportHtmlV429();
      downloadBlob(new Blob([html],{type:'text/html;charset=utf-8'}),`bogatka-premium-report-${new Date().toISOString().slice(0,10)}.html`);
      if(typeof showSaved==='function')showSaved();
    };

    const openPdfReportV429=async function(){
      const reportWindow=window.open('','_blank');
      if(!reportWindow)return alert('Браузер заблокировал новое окно. Разрешите всплывающие окна для создания PDF.');
      reportWindow.document.write('<p style="font-family:Arial;padding:30px">Формируется полный отчёт…</p>');
      try{
        const html=await buildReportHtmlV429();
        reportWindow.document.open();
        reportWindow.document.write(html);
        reportWindow.document.close();
        await Promise.all([...reportWindow.document.images].map(image=>image.complete?Promise.resolve():new Promise(resolve=>{
          image.addEventListener('load',resolve,{once:true});
          image.addEventListener('error',resolve,{once:true});
        })));
        if(reportWindow.document.fonts?.ready)await reportWindow.document.fonts.ready;
        await wait(220);
        reportWindow.focus();
        reportWindow.print();
      }catch(error){
        reportWindow.close();
        throw error;
      }
    };

    buildReportHtmlV429=async function(...args){
      const panel=document.getElementById('locationComparisonPanel');
      const wasOpen=Boolean(panel?.open);
      const oldVisibility=panel?.style.visibility||'';
      if(panel){
        panel.classList.add('comparison-report-snapshot-v429');
        if(!wasOpen)panel.classList.add('comparison-report-snapshot-closed-v429');
      }
      try{
        return polishReport(await baseBuild(...args));
      }finally{
        if(panel){
          panel.open=wasOpen;
          if(wasOpen)panel.setAttribute('open','');else panel.removeAttribute('open');
          panel.style.visibility=oldVisibility;
          panel.classList.remove('comparison-report-snapshot-v429','comparison-report-snapshot-closed-v429');
        }
        claim(buildReportHtmlV429);
      }
    };

    buildReportHtmlV429.__reportStabilityV429=true;
    buildReportHtmlV429.__reportAuthorityV429=true;
    buildReportHtmlV429.__reportAuthorityV428=true;
    buildReportHtmlV429.__reportPolishV428=true;
    buildReportHtmlV429.__liveReportFinalV427=true;
    buildReportHtmlV429.__locationProfileV416=true;
    buildReportHtmlV429.__locationProfileV425=true;
    buildReportHtmlV429.__locationOverviewV417=true;
    buildReportHtmlV429.__locationOverviewV421=true;
    buildReportHtmlV429.__locationPanelsV419=true;
    buildReportHtmlV429.__htmlAction=exportHtmlReportV429;
    buildReportHtmlV429.__pdfAction=openPdfReportV429;
    buildReportHtmlV429.__base=baseBuild;

    claim(buildReportHtmlV429);
    const guard=setInterval(()=>claim(buildReportHtmlV429),250);
    setTimeout(()=>clearInterval(guard),8500);
  }

  function claim(builder){
    const api=window.BogatkaLiveReport;
    if(api){
      api.version=VERSION;
      api.build=builder;
    }
    window.buildReportHtml=builder;
    window.exportHtmlReport=builder.__htmlAction;
    window.openPdfReport=builder.__pdfAction;
    try{
      buildReportHtml=window.buildReportHtml;
      exportHtmlReport=window.exportHtmlReport;
      openPdfReport=window.openPdfReport;
    }catch(_){}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureLiveStyle,{once:true});else ensureLiveStyle();
  install();
})();
