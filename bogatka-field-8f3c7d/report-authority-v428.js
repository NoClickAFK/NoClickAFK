(function(){
  'use strict';

  const VERSION='4.2.8';
  const wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":'&#39;'}[char]));
  let attempts=0;

  function loadNextPatch(){
    ['./report-stability-v429.js','./report-finalize-v431.js'].forEach((source,index)=>{
      if(document.querySelector(`script[src="${source}"]`))return;
      const script=document.createElement('script');
      script.src=source;
      script.async=false;
      setTimeout(()=>document.head.appendChild(script),index?900:0);
    });
  }

  function claimUnlessSuperseded(builder){
    const active=window.BogatkaLiveReport?.build||window.buildReportHtml;
    if(active?.__reportStabilityV429||active?.__reportFinalizeV431)return;
    claim(builder);
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

  function replaceCover(documentReport,{item,data,global,recommendation,generatedAt}){
    const cover=documentReport.querySelector('.report-cover');
    if(!cover)return;
    const title=item.title||item.address||'Локация';
    const decision=data?.decision||recommendation||'Не выбрано';
    cover.innerHTML=`<h1>Отчёт по локации «Богатка»</h1><p class="report-subtitle">${escapeHtml(title)}</p><div class="report-cover-grid"><div><span>Адрес</span><strong>${escapeHtml(item.address||'—')}</strong></div><div><span>Кто проводил осмотр</span><strong>${escapeHtml(global?.inspector||'—')}</strong></div><div><span>Сформирован</span><strong>${escapeHtml(generatedAt.toLocaleString('ru-RU'))}</strong></div><div><span>Рекомендация / решение</span><strong>${escapeHtml(decision)}</strong></div></div>`;
  }

  function runLocationPolish(api,documentReport,card){
    if(!card)return card;
    if(typeof api?.polishLocationCard==='function')api.polishLocationCard(documentReport,card);
    return card;
  }

  async function buildLocationReportHtml(locationId){
    const api=window.BogatkaLiveReport;
    if(typeof window.BogatkaReportFinalizeV431?.buildLocationReportHtml==='function')return window.BogatkaReportFinalizeV431.buildLocationReportHtml(locationId);
    const item=findLocation(locationId);
    const sourceCard=document.querySelector(`[data-location-card="${CSS.escape(String(locationId||''))}"]`);
    if(!api?.ready||typeof api.build!=='function'||typeof api.cloneLocation!=='function')throw new Error('Модуль HTML-отчёта ещё не готов.');
    if(!item||!sourceCard)throw new Error('Локация для отчёта не найдена.');

    const finalHtml=await api.build();
    const parser=new DOMParser();
    let documentReport=parser.parseFromString(finalHtml,'text/html');
    const finalCard=documentReport.querySelector(`.report-location-card[data-location-card="${CSS.escape(locationId)}"]`);
    if(!finalCard)throw new Error('Не удалось подготовить выбранную локацию для отчёта.');

    const body=sourceCard.querySelector(':scope > .location-body');
    const wasHidden=Boolean(body?.hidden);
    if(body&&wasHidden)body.removeAttribute('hidden');
    let completeCard;
    try{
      const photos=await idbAll(PHOTO_STORE);
      completeCard=await api.cloneLocation(sourceCard,photos);
    }finally{
      if(body&&wasHidden)body.setAttribute('hidden','');
    }

    const freshBody=completeCard.querySelector(':scope > .location-body,:scope > .report-location-body');
    const existingBody=finalCard.querySelector(':scope > .location-body,:scope > .report-location-body');
    if(freshBody&&existingBody){
      freshBody.classList.add('report-location-body');
      existingBody.replaceWith(freshBody);
    }
    runLocationPolish(api,documentReport,finalCard);

    documentReport.querySelectorAll('.report-location-card').forEach(card=>{
      if(card.dataset.locationCard!==locationId)card.remove();
    });
    documentReport.querySelectorAll('main.report-shell > .report-section').forEach(section=>section.remove());

    const global=await idbGet(STORE,'global')||{};
    const data=await getLocationData(locationId);
    const recommendation=finalCard.querySelector('.report-head-status-v428,.recommendation-status-v448,.decision-recommendation-v340')?.textContent?.trim()||'';
    const generatedAt=new Date();
    replaceCover(documentReport,{item,data,global,recommendation,generatedAt});
    documentReport.title=`Отчёт по локации — ${item.title||item.address||'Богатка'}`;
    const footer=documentReport.querySelector('.report-meta-footer');
    if(footer)footer.textContent=`Отчёт по выбранной локации сформирован приложением «Богатка» · ${generatedAt.toLocaleString('ru-RU')}`;

    if(typeof api.polishReportStabilityHtml==='function'){
      documentReport=parser.parseFromString(api.polishReportStabilityHtml(`<!doctype html>\n${documentReport.documentElement.outerHTML}`),'text/html');
    }

    return `<!doctype html>\n${documentReport.documentElement.outerHTML}`;
  }

  async function exportLocationHtmlReport(locationId){
    if(typeof window.BogatkaReportFinalizeV431?.buildLocationReportHtml==='function')return window.exportLocationHtmlReport(locationId);
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
        claimUnlessSuperseded(buildReportHtmlV428);
      }
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
    try{
      buildReportHtml=window.buildReportHtml;
      exportHtmlReport=window.exportHtmlReport;
      openPdfReport=window.openPdfReport;
    }catch(_){ }
  }

  install();
})();
