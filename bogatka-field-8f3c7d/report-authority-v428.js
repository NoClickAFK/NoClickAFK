(function(){
  'use strict';

  const VERSION='4.2.8';
  const wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":'&#39;'}[char]));
  let attempts=0;

  function loadNextPatch(){
    ['./report-stability-v429.js','./report-finalize-v431.js','./report-finalize-v432.js'].forEach((source,index)=>{
      if(document.querySelector(`script[src="${source}"]`))return;
      const script=document.createElement('script');
      script.src=source;
      script.async=false;
      setTimeout(()=>document.head.appendChild(script),index?900*index:0);
    });
  }

  function findLocation(id){
    let list=[];
    try{list=Array.isArray(locations)?locations:[]}catch(_){list=[]}
    return list.find(item=>item.id===id&&!item.archivedAt)||null;
  }

  function safeFileNamePart(value){
    const normalized=String(value||'location').normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
    const safe=normalized.replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]+/g,'-').replace(/^-+|-+$/g,'').replace(/-{2,}/g,'-');
    return (safe||'location').slice(0,72);
  }

  function finalizer(){
    return window.BogatkaReportFinalizeV432||window.BogatkaReportFinalizeV431||null;
  }

  async function buildLocationReportHtml(locationId){
    const api=finalizer();
    if(typeof api?.buildLocationReportHtml==='function')return api.buildLocationReportHtml(locationId);
    throw new Error('Финальный модуль HTML-отчёта ещё не готов.');
  }

  async function exportLocationHtmlReport(locationId){
    const api=finalizer();
    if(typeof api?.exportLocationHtmlReport==='function')return api.exportLocationHtmlReport(locationId);
    const item=findLocation(locationId);
    if(typeof showSaving==='function')showSaving();
    try{
      const html=await buildLocationReportHtml(locationId);
      const name=safeFileNamePart(item?.title||item?.address||locationId);
      downloadBlob(new Blob([html],{type:'text/html;charset=utf-8'}),`bogatka-location-${name}-${new Date().toISOString().slice(0,10)}.html`);
      if(typeof showSaved==='function')showSaved();
      return html;
    }catch(error){
      if(typeof showError==='function')showError(error);
      throw error;
    }
  }

  function claimUnlessSuperseded(builder){
    const active=window.BogatkaLiveReport?.build||window.buildReportHtml;
    if(active?.__reportStabilityV429||active?.__reportFinalizeV431||active?.__reportFinalizeV432)return;
    claim(builder);
  }

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
      loadNextPatch();
      return;
    }

    const baseBuild=current;
    let buildReportHtmlV428=null;

    const exportHtmlReportV428=async function(){
      if(typeof showSaving==='function')showSaving();
      const html=await buildReportHtmlV428();
      downloadBlob(new Blob([html],{type:'text/html;charset=utf-8'}),`bogatka-premium-report-${new Date().toISOString().slice(0,10)}.html`);
      if(typeof showSaved==='function')showSaved();
      return html;
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
      try{return await baseBuild(...args)}finally{claimUnlessSuperseded(buildReportHtmlV428)}
    };

    buildReportHtmlV428.__reportAuthorityV428=true;
    buildReportHtmlV428.__reportPolishV428=true;
    buildReportHtmlV428.__liveReportFinalV427=true;
    buildReportHtmlV428.__locationProfileV416=true;
    buildReportHtmlV428.__locationProfileV425=true;
    buildReportHtmlV428.__locationOverviewV417=true;
    buildReportHtmlV428.__locationOverviewV421=true;
    buildReportHtmlV428.__locationPanelsV419=true;
    buildReportHtmlV428.__htmlAction=exportHtmlReportV428;
    buildReportHtmlV428.__pdfAction=openPdfReportV428;
    buildReportHtmlV428.__base=baseBuild;

    claim(buildReportHtmlV428);
    loadNextPatch();
    [100,300,700,1000,1200,1500,3000,5000].forEach(delay=>setTimeout(()=>claimUnlessSuperseded(buildReportHtmlV428),delay));
  }

  function claim(builder){
    const api=window.BogatkaLiveReport;
    if(api){
      api.version=VERSION;
      api.build=builder;
      api.buildLocationReportHtml=buildLocationReportHtml;
      api.exportLocationHtmlReport=exportLocationHtmlReport;
    }
    window.buildReportHtml=builder;
    window.exportHtmlReport=builder.__htmlAction;
    window.openPdfReport=builder.__pdfAction;
    window.buildLocationReportHtml=buildLocationReportHtml;
    window.exportLocationHtmlReport=exportLocationHtmlReport;
    try{buildReportHtml=window.buildReportHtml;exportHtmlReport=window.exportHtmlReport;openPdfReport=window.openPdfReport}catch(_){ }
  }

  install();
})();