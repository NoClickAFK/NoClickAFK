(function(){
  'use strict';

  const VERSION='4.2.8';
  const wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
  let attempts=0;

  function install(){
    attempts+=1;
    const api=window.BogatkaLiveReport;
    const current=api?.build;
    if(!api?.ready||typeof current!=='function'||!current.__reportPolishV428){
      if(attempts<140)setTimeout(install,80);
      return;
    }
    if(current.__reportAuthorityV428){
      claim(current);
      return;
    }

    const baseBuild=current;
    let buildReportHtmlV428=null;

    const exportHtmlReportV428=async function(){
      if(typeof showSaving==='function')showSaving();
      const html=await buildReportHtmlV428();
      downloadBlob(new Blob([html],{type:'text/html;charset=utf-8'}),`bogatka-premium-report-${new Date().toISOString().slice(0,10)}.html`);
      if(typeof showSaved==='function')showSaved();
    };

    const openPdfReportV428=async function(){
      const reportWindow=window.open('','_blank');
      if(!reportWindow)return alert('Браузер заблокировал новое окно. Разрешите всплывающие окна для создания PDF.');
      reportWindow.document.write('<p style="font-family:Arial;padding:30px">Формируется полный отчёт…</p>');
      try{
        const html=await buildReportHtmlV428();
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

    buildReportHtmlV428=async function(...args){
      try{
        return await baseBuild(...args);
      }finally{
        claim(buildReportHtmlV428);
      }
    };

    buildReportHtmlV428.__reportAuthorityV428=true;
    buildReportHtmlV428.__reportPolishV428=true;
    buildReportHtmlV428.__liveReportFinalV427=true;
    buildReportHtmlV428.__htmlAction=exportHtmlReportV428;
    buildReportHtmlV428.__pdfAction=openPdfReportV428;
    buildReportHtmlV428.__base=baseBuild;

    claim(buildReportHtmlV428);
    [100,300,700,1500,3000,5000].forEach(delay=>setTimeout(()=>claim(buildReportHtmlV428),delay));
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

  install();
})();
