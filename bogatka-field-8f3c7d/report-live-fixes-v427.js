(function(){
  'use strict';

  let attempts=0;
  const wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));

  async function stabilizeLocationUi(){
    const active=document.activeElement;
    const editing=Boolean(active&&document.getElementById('locations')?.contains(active)&&active.matches?.('input,textarea,select,[contenteditable="true"]'));
    if(editing)return false;
    if(typeof window.BogatkaLocationPanelsV419?.enhanceAll==='function')await window.BogatkaLocationPanelsV419.enhanceAll({force:true});
    if(typeof window.BogatkaLocationGlobalV421?.enhanceAll==='function')await window.BogatkaLocationGlobalV421.enhanceAll({force:true});
    return true;
  }

  function expandCollapsedBodiesForSnapshot(){
    const bodies=[...document.querySelectorAll('[data-location-card] > .location-body[hidden],[data-location-card] .location-body[hidden]')];
    bodies.forEach(body=>body.removeAttribute('hidden'));
    return ()=>bodies.forEach(body=>body.setAttribute('hidden',''));
  }

  function sourceCardIsArchived(id){
    if(!id)return true;
    const source=document.querySelector(`[data-location-card="${CSS.escape(id)}"]`);
    if(!source)return true;
    if(source.hidden||source.classList.contains('hidden'))return true;
    const item=Array.isArray(window.locations)?window.locations.find(location=>location.id===id):null;
    return Boolean(item?.archivedAt);
  }

  function install(){
    attempts+=1;
    const api=window.BogatkaLiveReport;
    if(!api?.ready||typeof api.build!=='function'){
      if(attempts<100)setTimeout(install,80);
      return;
    }
    if(api.build.__liveReportFinalV427){
      claim(api.build);
      return;
    }

    const baseBuild=api.build;

    async function ensureReportModules(){
      for(let attempt=0;attempt<40;attempt++){
        if(typeof window.BogatkaDecisionEngine?.computeAll==='function')break;
        await wait(50);
      }
      await stabilizeLocationUi();
      if(typeof window.BogatkaDecisionUI?.refresh==='function')await window.BogatkaDecisionUI.refresh();
      if(typeof window.BogatkaSuiteUI?.refresh==='function')await window.BogatkaSuiteUI.refresh();
    }

    function addPanelHeading(documentReport,card,selector,title,copy){
      const panel=card.querySelector(selector);
      if(!panel||panel.querySelector(':scope > .report-panel-heading-v427'))return;
      const heading=documentReport.createElement('header');
      heading.className='report-panel-heading-v427';
      const strong=documentReport.createElement('strong');
      strong.textContent=title;
      const span=documentReport.createElement('span');
      span.textContent=copy;
      heading.append(strong,span);
      panel.prepend(heading);
    }

    function staticStopValue(documentReport,value){
      const labels={clear:'Нет проблемы',risk:'Есть риск / уточнить',block:'Есть стоп-фактор'};
      const output=documentReport.createElement('span');
      output.className='report-control-value report-select-value';
      output.textContent=labels[value]||'—';
      return output;
    }

    async function addMissingStopFactors(documentReport,reportCard){
      if(reportCard.querySelector('.stop-factors-v340'))return;
      const id=reportCard.dataset.locationCard;
      const sourceCard=id?document.querySelector(`[data-location-card="${CSS.escape(id)}"]`):null;
      const sourceSection=sourceCard?.querySelector('.stop-factors-v340');
      let section=null;

      if(sourceSection){
        section=sourceSection.cloneNode(true);
        section.open=true;
        section.setAttribute('open','');
        section.querySelectorAll('.premium-select-trigger,.premium-select-menu').forEach(node=>node.remove());
        section.querySelectorAll('select[data-stop-key]').forEach(select=>{
          const key=select.dataset.stopKey||'';
          const original=sourceSection.querySelector(`select[data-stop-key="${CSS.escape(key)}"]`);
          select.replaceWith(staticStopValue(documentReport,original?.value||''));
        });
        section.querySelectorAll('button,input,textarea').forEach(node=>node.remove());
      }else{
        const definitions=window.BogatkaDecisionEngine?.STOPS||[];
        if(!definitions.length)return;
        const data=id&&typeof getLocationData==='function'?await getLocationData(id):{};
        section=documentReport.createElement('details');
        section.className='stop-factors-v340';
        section.open=true;
        section.setAttribute('open','');
        const summary=documentReport.createElement('summary');
        const title=documentReport.createElement('span');
        title.textContent='Стоп-факторы';
        const badge=documentReport.createElement('span');
        badge.className='stop-summary-badge-v340';
        const answered=definitions.filter(([key])=>Boolean(data?.stopFactors?.[key])).length;
        badge.textContent=answered===definitions.length?'проверены':`${definitions.length-answered} не проверено`;
        summary.append(title,badge);
        const body=documentReport.createElement('div');
        body.className='details-body';
        const note=documentReport.createElement('p');
        note.className='section-note';
        note.textContent='Условия, которые могут запретить открытие независимо от общего балла.';
        const grid=documentReport.createElement('div');
        grid.className='stop-grid-v340';
        for(const [key,label] of definitions){
          const row=documentReport.createElement('div');
          row.className='stop-row-v340';
          const strong=documentReport.createElement('strong');
          strong.textContent=label;
          row.append(strong,staticStopValue(documentReport,data?.stopFactors?.[key]||''));
          grid.appendChild(row);
        }
        body.append(note,grid);
        section.append(summary,body);
      }

      const overview=reportCard.querySelector('.decision-overview-v340');
      if(overview)overview.insertAdjacentElement('afterend',section);
      else reportCard.querySelector('.report-location-body,.location-body')?.prepend(section);
    }

    async function finalizeMarkup(html){
      const parser=new DOMParser();
      const documentReport=parser.parseFromString(html,'text/html');
      for(const card of [...documentReport.querySelectorAll('.report-location-card')]){
        const id=card.dataset.locationCard;
        if(sourceCardIsArchived(id)){
          card.remove();
          continue;
        }
        addPanelHeading(
          documentReport,
          card,
          '.inspection-card-v416',
          'Параметры осмотра и следующий шаг',
          'Статус, формат, состояние помещения и дальнейшее действие.'
        );
        addPanelHeading(
          documentReport,
          card,
          '.landlord-card-v416',
          'Арендодатель и условия',
          'Собственник, контактное лицо, контакты и договорённости.'
        );
        await addMissingStopFactors(documentReport,card);
        card.querySelectorAll('.profile-caption-v416').forEach(caption=>{
          const value=caption.textContent.trim();
          if(value&&!value.endsWith(':'))caption.textContent=`${value}:`;
        });
      }
      if(!documentReport.querySelector('#reportLiveFixStyleV427')){
        const style=documentReport.createElement('style');
        style.id='reportLiveFixStyleV427';
        style.textContent='.report-panel-heading-v427{padding:15px 17px;background:linear-gradient(180deg,#fff9ea,#ffefc6);border-bottom:1px solid #ead08e}.report-panel-heading-v427 strong{display:block;color:#15583f;font-size:18px}.report-panel-heading-v427 span{display:block;margin-top:3px;color:#80682f;font-size:12px}@media print{.report-panel-heading-v427{padding:8px 10px}}';
        documentReport.head.appendChild(style);
      }
      return `<!doctype html>\n${documentReport.documentElement.outerHTML}`;
    }

    const buildLiveReportHtml=async function(...args){
      const active=document.activeElement;
      let restoreBlur=null;
      if(active&&/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)){
        const hadOwn=Object.prototype.hasOwnProperty.call(active,'blur');
        const ownValue=hadOwn?active.blur:null;
        try{
          Object.defineProperty(active,'blur',{configurable:true,value:()=>{}});
          restoreBlur=()=>{
            try{
              if(hadOwn)Object.defineProperty(active,'blur',{configurable:true,writable:true,value:ownValue});
              else delete active.blur;
            }catch(_){}
          };
        }catch(_){}
      }
      const restoreCollapsed=expandCollapsedBodiesForSnapshot();
      try{
        await ensureReportModules();
        return await finalizeMarkup(await baseBuild(...args));
      }finally{
        restoreCollapsed();
        restoreBlur?.();
      }
    };

    buildLiveReportHtml.__liveReportFinalV427=true;
    buildLiveReportHtml.__locationProfileV416=true;
    buildLiveReportHtml.__locationProfileV425=true;
    buildLiveReportHtml.__locationOverviewV417=true;
    buildLiveReportHtml.__locationOverviewV421=true;
    buildLiveReportHtml.__locationPanelsV419=true;
    buildLiveReportHtml.__base=baseBuild;

    const exportHtmlReportLive=async function(){
      if(typeof showSaving==='function')showSaving();
      const html=await buildLiveReportHtml();
      downloadBlob(new Blob([html],{type:'text/html;charset=utf-8'}),`bogatka-premium-report-${new Date().toISOString().slice(0,10)}.html`);
      if(typeof showSaved==='function')showSaved();
    };

    const openPdfReportLive=async function(){
      const reportWindow=window.open('','_blank');
      if(!reportWindow)return alert('Браузер заблокировал новое окно. Разрешите всплывающие окна для создания PDF.');
      reportWindow.document.write('<p style="font-family:Arial;padding:30px">Формируется полный отчёт…</p>');
      try{
        const html=await buildLiveReportHtml();
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

    buildLiveReportHtml.__htmlAction=exportHtmlReportLive;
    buildLiveReportHtml.__pdfAction=openPdfReportLive;
    api.build=buildLiveReportHtml;
    claim(buildLiveReportHtml);
    setTimeout(()=>claim(buildLiveReportHtml),1000);
  }

  function claim(builder){
    const api=window.BogatkaLiveReport;
    if(api)api.build=builder;
    window.buildReportHtml=builder;
    window.exportHtmlReport=builder.__htmlAction||window.exportHtmlReport;
    window.openPdfReport=builder.__pdfAction||window.openPdfReport;
    try{
      buildReportHtml=window.buildReportHtml;
      exportHtmlReport=window.exportHtmlReport;
      openPdfReport=window.openPdfReport;
    }catch(_){}
  }

  install();
})();
