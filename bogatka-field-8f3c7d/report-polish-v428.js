(function(){
  'use strict';

  const VERSION='4.2.8';
  const wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
  let attempts=0;

  function closeComparisonOnBoot(){
    const panel=document.getElementById('locationComparisonPanel');
    if(!panel)return false;
    if(panel.dataset.defaultCollapsedV428==='1')return true;
    panel.open=false;
    panel.removeAttribute('open');
    panel.dataset.defaultCollapsedV428='1';
    return true;
  }

  function installDefaultCollapsedState(){
    if(closeComparisonOnBoot())return;
    const observer=new MutationObserver(()=>{
      if(closeComparisonOnBoot())observer.disconnect();
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),12000);
  }

  function text(node,fallback='—'){
    const value=node?.textContent?.trim();
    return value||fallback;
  }

  function makeMetric(documentReport,value,suffix,label){
    const card=documentReport.createElement('div');
    card.className='report-head-metric-v428';
    const line=documentReport.createElement('div');
    line.className='report-head-metric-line-v428';
    const strong=documentReport.createElement('strong');
    strong.textContent=value;
    line.appendChild(strong);
    if(suffix){
      const small=documentReport.createElement('small');
      small.textContent=suffix;
      line.appendChild(small);
    }
    const caption=documentReport.createElement('span');
    caption.textContent=label;
    card.append(line,caption);
    return card;
  }

  function rebuildLocationHeader(documentReport,card){
    const head=card.querySelector('.location-head');
    if(!head||head.querySelector('.report-head-metrics-v428'))return;
    const rawBox=head.querySelector('.scorebox');
    const decisionHead=head.querySelector('.decision-head-v340');
    const raw=text(rawBox?.querySelector('strong'),'0');
    const weighted=text(decisionHead?.querySelector('.decision-score-v340 strong'),'0');
    const completion=text(decisionHead?.querySelector('.decision-complete-v340 strong'),'0%');
    const recommendation=decisionHead?.querySelector('.decision-recommendation-v340');

    const metrics=documentReport.createElement('div');
    metrics.className='report-head-metrics-v428';
    metrics.append(
      makeMetric(documentReport,raw,'/70','балл'),
      makeMetric(documentReport,weighted,'/100','взвешенно'),
      makeMetric(documentReport,completion,'','заполнено')
    );

    const status=documentReport.createElement('div');
    status.className='report-head-status-v428';
    if(recommendation){
      for(const className of recommendation.classList){
        if(className!=='decision-recommendation-v340')status.classList.add(className);
      }
    }
    status.textContent=text(recommendation,'Недостаточно данных');
    metrics.appendChild(status);

    rawBox?.remove();
    decisionHead?.remove();
    head.appendChild(metrics);
  }

  function removeTechnicalReportUi(card){
    card.querySelectorAll([
      '.decision-overview-v340',
      '.economy-v400',
      '.launch-project-v400',
      '[data-collab-pane="history"]',
      '.history-list-v400',
      '.history-item-v400',
      '.task-form-help-v414',
      '.task-examples-v414',
      '.decision-formula-v340',
      '.completion-missing-v340',
      '.checklist-guide-v414',
      '.report-pane-title'
    ].join(',')).forEach(node=>node.remove());

    card.querySelectorAll('.structured-notes-head-v414 span,.project-comments-title-v414 span').forEach(node=>node.remove());
    card.querySelector('.decision-copy-v412 p')?.remove();
  }

  function polishCollaboration(documentReport,card){
    const collaboration=card.querySelector('.collaboration-v400');
    if(!collaboration)return;
    const summary=collaboration.querySelector(':scope > summary');
    if(summary)summary.textContent='Задачи и комментарии';

    for(const pane of collaboration.querySelectorAll('[data-collab-pane]')){
      const kind=pane.dataset.collabPane;
      if(kind==='history'){
        pane.remove();
        continue;
      }
      const title=documentReport.createElement('h3');
      title.className='report-collab-title-v428';
      title.textContent=kind==='tasks'?'Задачи':'Комментарии и рабочие заметки';
      pane.prepend(title);
      pane.classList.add('active');
    }

    const tasks=collaboration.querySelector('[data-collab-pane="tasks"]');
    const comments=collaboration.querySelector('[data-collab-pane="comments"]');
    const taskList=tasks?.querySelector('.task-list-v400');
    const commentList=comments?.querySelector('.comment-list-v400');
    if(taskList&&!taskList.textContent.trim())taskList.textContent='Задач пока нет.';
    if(commentList&&!commentList.textContent.trim())commentList.textContent='Комментариев пока нет.';
  }

  function polishDecision(card){
    const decision=card.querySelector('.decision-panel-v412,.decision');
    if(!decision)return;
    const copy=decision.querySelector('.decision-copy-v412 strong');
    if(copy)copy.textContent='Предварительное решение по локации';
  }

  function polishReport(html){
    const parser=new DOMParser();
    const documentReport=parser.parseFromString(html,'text/html');

    documentReport.querySelectorAll('.report-detailed-comparison').forEach(node=>node.remove());

    for(const card of documentReport.querySelectorAll('.report-location-card')){
      rebuildLocationHeader(documentReport,card);
      removeTechnicalReportUi(card);
      polishCollaboration(documentReport,card);
      polishDecision(card);
    }

    const style=documentReport.createElement('style');
    style.id='reportPolishV428';
    style.textContent=`
      .report-location-card .location-head{grid-template-columns:minmax(0,1fr) minmax(330px,410px);align-items:start}
      .report-head-metrics-v428{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;min-width:0}
      .report-head-metric-v428{display:flex;min-height:76px;flex-direction:column;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:14px;background:#fff;padding:9px 8px;text-align:center}
      .report-head-metric-line-v428{display:flex;align-items:baseline;justify-content:center;gap:5px;white-space:nowrap}
      .report-head-metric-line-v428 strong{font-size:24px;line-height:1;color:var(--green)}
      .report-head-metric-line-v428 small{font-size:12px;color:var(--ink)}
      .report-head-metric-v428>span{display:block;margin-top:6px;font-size:10px;line-height:1.2;color:var(--muted)}
      .report-head-status-v428{grid-column:1/-1;display:flex;min-height:34px;align-items:center;justify-content:center;border:1px solid #8aa197;border-radius:11px;background:#f1f6f3;padding:7px 12px;font-size:12px;font-weight:800;color:#435b51;text-align:center}
      .report-head-status-v428.stop{border-color:#c77a7a;background:#fdeaea;color:#8b3030}
      .report-head-status-v428.risk{border-color:#d6ad64;background:#fff3dc;color:#805715}

      .score-guide-v331,.score-guide-v414,.score-guide-v415{display:block;border:1px solid var(--line);border-radius:15px;background:linear-gradient(180deg,#f8fbf9,#eef6f2);padding:16px;margin:0 0 14px}
      .score-guide-title{display:block;margin:0 0 7px;font-size:18px;line-height:1.25;font-weight:850;color:var(--green)}
      .score-guide-v331 p,.score-guide-v414 p,.score-guide-v415 p{display:block;margin:0 0 13px;line-height:1.55;color:var(--ink)}
      .score-scale-v331,.score-scale-v415{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:12px 0!important;padding:0!important;background:none!important;border:0!important}
      .score-scale-v331>span,.score-scale-v415>span{display:flex;align-items:center;gap:7px;min-height:48px;border:1px solid var(--line);border-radius:11px;background:#fff;padding:8px 9px;line-height:1.25}
      .score-scale-v331 b,.score-scale-v415 b{display:inline-flex;flex:0 0 26px;width:26px;height:26px;align-items:center;justify-content:center;border-radius:8px;background:#e3f2ea;color:var(--green)}
      .score-guide-note-v331,.score-guide-note-v415{display:block;margin-top:10px;border-left:3px solid #c99531;border-radius:8px;background:#fff7e5;padding:10px 12px;line-height:1.45}
      .score-label-v414{display:flex;flex-direction:column;gap:7px}
      .score-label-v414>strong{display:block;font-size:12px;line-height:1.35;color:var(--ink)}
      .score-label-v414>small{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;font-size:10px;line-height:1.35}
      .score-label-v414>small>span{display:block;border-radius:8px;background:#f3f7f5;padding:6px 8px;color:var(--muted)}
      .score-label-v414>small>span:last-child{background:#eaf5ef;color:#35634f}
      .score-table td{padding:10px!important;vertical-align:middle!important}
      .score-table td:first-child{width:70%}

      .collaboration-v400>.details-body{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      .collab-pane-v400{display:block!important;border:1px solid var(--line);border-radius:14px;background:#fbfdfc;padding:14px;min-width:0}
      .report-collab-title-v428{margin:0 0 12px;padding:0 0 9px;border-bottom:1px solid var(--line);font-size:17px;line-height:1.3;color:var(--green)}
      .task-list-v400,.comment-list-v400{display:grid;gap:9px;color:var(--muted)}
      .task-card-v400,.comment-card-v400{margin:0!important;background:#fff}
      .structured-notes-v414{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:14px}
      .structured-notes-head-v414{grid-column:1/-1;display:block;margin:0 0 2px}
      .structured-notes-head-v414 strong,.project-comments-title-v414 strong{display:block;font-size:14px;color:var(--green)}
      .structured-note-v414{display:flex;flex-direction:column;gap:5px;min-width:0;color:var(--green);font-size:11px;font-weight:750}
      .structured-note-v414 .report-control-value{min-height:58px;background:#fff;color:var(--ink);font-size:12px;font-weight:600}
      .project-comments-title-v414{display:block;margin:12px 0 8px;padding-top:12px;border-top:1px solid var(--line)}

      .decision-panel-v412{display:block!important;border:1px solid var(--line);border-radius:16px;background:linear-gradient(180deg,#f8fbf9,#eff7f3);padding:15px;margin:14px 0}
      .decision-copy-v412{display:block;margin:0 0 12px}
      .decision-copy-v412 strong{display:block;font-size:17px;color:var(--green)}
      .decision-actions-v412{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      .decision-actions-v412 label{display:flex!important;align-items:center;gap:9px;min-height:62px;border:1px solid var(--line);border-radius:12px;background:#fff;padding:10px 12px}
      .decision-option-copy-v412{display:flex;flex-direction:column;gap:2px;min-width:0}
      .decision-option-copy-v412 strong{display:block;font-size:13px;line-height:1.25;color:var(--ink)}
      .decision-option-copy-v412 small{display:block;font-size:10px;line-height:1.3;color:var(--muted)}

      @media(max-width:900px){
        .report-location-card .location-head{grid-template-columns:1fr}
        .collaboration-v400>.details-body{grid-template-columns:1fr}
      }
      @media(max-width:620px){
        .report-head-metrics-v428,.score-scale-v331,.score-scale-v415,.score-label-v414>small,.structured-notes-v414,.decision-actions-v412{grid-template-columns:1fr!important}
        .report-head-status-v428{grid-column:auto}
      }
      @media print{
        .report-location-card .location-head{grid-template-columns:minmax(0,1fr) 92mm}
        .report-head-metric-v428{min-height:17mm;padding:2mm}
        .report-head-metric-line-v428 strong{font-size:17px}
        .report-head-status-v428{min-height:8mm;padding:1.5mm 2mm}
        .score-scale-v331,.score-scale-v415{grid-template-columns:repeat(5,1fr)!important}
        .collaboration-v400>.details-body{grid-template-columns:1fr 1fr!important}
        .decision-actions-v412{grid-template-columns:repeat(3,1fr)!important}
      }
    `;
    documentReport.head.appendChild(style);

    return `<!doctype html>\n${documentReport.documentElement.outerHTML}`;
  }

  function claim(builder){
    const api=window.BogatkaLiveReport;
    if(api){
      api.version=VERSION;
      api.build=builder;
    }
    window.buildReportHtml=builder;
    window.exportHtmlReport=builder.__htmlAction||window.exportHtmlReport;
    window.openPdfReport=builder.__pdfAction||window.openPdfReport;
    try{
      buildReportHtml=window.buildReportHtml;
      exportHtmlReport=window.exportHtmlReport;
      openPdfReport=window.openPdfReport;
    }catch(_){}
  }

  function install(){
    attempts+=1;
    const api=window.BogatkaLiveReport;
    if(!api?.ready||typeof api.build!=='function'){
      if(attempts<120)setTimeout(install,80);
      return;
    }
    if(api.build.__reportPolishV428){
      claim(api.build);
      return;
    }

    const baseBuild=api.build;
    const buildReportHtmlV428=async function(...args){
      const panel=document.getElementById('locationComparisonPanel');
      const wasOpen=Boolean(panel?.open);
      const oldVisibility=panel?.style.visibility||'';
      if(panel)panel.style.visibility='hidden';
      try{
        return polishReport(await baseBuild(...args));
      }finally{
        if(panel){
          panel.open=wasOpen;
          if(wasOpen)panel.setAttribute('open','');else panel.removeAttribute('open');
          panel.style.visibility=oldVisibility;
        }
      }
    };

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

    buildReportHtmlV428.__reportPolishV428=true;
    buildReportHtmlV428.__liveReportFinalV427=true;
    buildReportHtmlV428.__htmlAction=exportHtmlReportV428;
    buildReportHtmlV428.__pdfAction=openPdfReportV428;
    buildReportHtmlV428.__base=baseBuild;
    claim(buildReportHtmlV428);
    setTimeout(()=>claim(buildReportHtmlV428),1200);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installDefaultCollapsedState,{once:true});else installDefaultCollapsedState();
  install();
})();
