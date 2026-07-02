(function(){
  'use strict';
  if(window.BogatkaTechnicalEconomicsReportV450?.ready)return;

  const VERSION='4.5.0';
  let attempts=0;

  function selectedText(control){
    if(control.tagName!=='SELECT')return control.value??'';
    return control.options?.[control.selectedIndex]?.textContent?.trim()||control.value||'';
  }

  function staticizeEconomy(reportDocument,source){
    const clone=source.cloneNode(true);
    clone.open=true;
    clone.setAttribute('open','');
    clone.dataset.technicalEconomicsV450='1';
    clone.dataset.technicalEconomicsReportV450='1';
    clone.querySelectorAll('input,select,textarea').forEach(control=>{
      const output=reportDocument.createElement('span');
      output.className='report-control-value report-text-value';
      const value=selectedText(control);
      output.textContent=String(value??'').trim()||'—';
      control.replaceWith(output);
    });
    clone.querySelectorAll('button,[data-action],form').forEach(node=>node.remove());
    clone.querySelectorAll('details').forEach(details=>{
      details.open=true;
      details.setAttribute('open','');
    });
    return clone;
  }

  function liveEconomy(id){
    if(!id)return null;
    const escaped=CSS.escape(id);
    return document.querySelector(`[data-location-card="${escaped}"] .economy-v400`)
      ||document.querySelector(`[data-economy-details="${escaped}"]`);
  }

  function ensureEconomy(reportDocument,card){
    const existing=card.querySelector('.economy-v400');
    if(existing){
      existing.dataset.technicalEconomicsV450='1';
      existing.dataset.technicalEconomicsReportV450='1';
      return existing;
    }
    const id=card.dataset.locationCard||card.dataset.locationId||'';
    const source=liveEconomy(id);
    if(!source)return null;
    const clone=staticizeEconomy(reportDocument,source);
    const body=card.querySelector('.report-location-body,.location-body')||card;
    body.appendChild(clone);
    return clone;
  }

  function transformReport(html){
    const reportDocument=new DOMParser().parseFromString(html,'text/html');
    reportDocument.querySelectorAll('.report-location-card').forEach(card=>ensureEconomy(reportDocument,card));
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
      current?.__technicalEconomicsV450&&
      current?.__reportStabilityV429
    );
    if(typeof current==='function'&&compatible){
      if(current.__technicalEconomicsReportV450){
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
          const result=transformReport(await current(...args));
          claim(wrapped);
          return result;
        };
        Object.assign(wrapped,current);
        wrapped.__technicalEconomicsV450=true;
        wrapped.__technicalEconomicsReportV450=true;
        wrapped.__base=current;
        wrapped.__htmlAction=exportHtml;
        wrapped.__pdfAction=openPdf;
        claim(wrapped);
      }
    }
    if(attempts<100)setTimeout(install,250);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('load',()=>setTimeout(install,100),{once:true});

  window.BogatkaTechnicalEconomicsReportV450={
    version:VERSION,
    ready:true,
    install,
    transformReport,
    ensureEconomy,
  };
})();
