(function(){
  'use strict';
  if(window.BogatkaLandlordConditionsV449?.ready)return;

  const VERSION='4.4.9';
  const RENT_LABEL='Что предварительно предложил арендодатель';
  const RENT_PLACEHOLDER='Ставка, депозит, каникулы, коммунальные платежи, индексация, ремонт, срок аренды';
  const CONTACT_LABEL='Комментарий по контакту';
  const CONTACT_PLACEHOLDER='Когда и как лучше связаться, кто принимает решение, важные детали общения';
  const SECTION_COPY='Кто принимает решение, как связаться и что уже предложено по аренде.';
  let timer=null;
  let reportAttempts=0;

  function captionFor(control){
    return control?.closest('label.field,label.profile-field-v416')?.querySelector(':scope > .profile-caption-v416,:scope > .evaluation-caption-v446')||null;
  }

  function panelCopy(panel){
    return panel?.querySelector(':scope > .panel-toggle-v419 .panel-copy-v419,:scope > .profile-section-head-v416 > span')||null;
  }

  function reportFieldWrapper(panel,field){
    return panel?.querySelector(
      `[data-landlord-order-v419="${field}"],[data-profile-field="${field}"],[data-overview-field="${field}"],[data-panel-field="${field}"]`
    )||null;
  }

  function relabel(control,label,placeholder){
    if(!control)return;
    const caption=captionFor(control);
    if(caption&&caption.textContent!==label)caption.textContent=label;
    if(placeholder&&control.placeholder!==placeholder)control.placeholder=placeholder;
    control.setAttribute('aria-label',label);
  }

  function relabelReportField(panel,field,label){
    const wrapper=reportFieldWrapper(panel,field);
    const caption=wrapper?.querySelector(':scope > .profile-caption-v416,:scope > .evaluation-caption-v446');
    if(caption&&caption.textContent!==label)caption.textContent=label;
  }

  function ensureReportHeading(documentReport,panel){
    let heading=panel.querySelector(':scope > .report-landlord-heading-v449');
    if(!heading){
      heading=documentReport.createElement('div');
      heading.className='report-landlord-heading-v449';
      const title=documentReport.createElement('strong');
      const copy=documentReport.createElement('span');
      heading.append(title,copy);
      panel.prepend(heading);
    }
    const title=heading.querySelector('strong');
    const copy=heading.querySelector('span');
    if(title&&title.textContent!=='Арендодатель и условия')title.textContent='Арендодатель и условия';
    if(copy&&copy.textContent!==SECTION_COPY)copy.textContent=SECTION_COPY;
    return heading;
  }

  function ensureReportStyles(documentReport){
    if(documentReport.getElementById('landlordConditionsStyleV449'))return;
    const style=documentReport.createElement('style');
    style.id='landlordConditionsStyleV449';
    style.textContent=`
      .report-landlord-heading-v449{display:grid;gap:2px;margin:0 0 10px;padding:0 0 9px;border-bottom:1px solid var(--line,#d6e3dc)}
      .report-landlord-heading-v449>strong{color:var(--green,#15583f);font-size:15px;line-height:1.25}
      .report-landlord-heading-v449>span{color:var(--muted,#65756d);font-size:10px;line-height:1.4}
      @media print{.report-landlord-heading-v449{break-after:avoid}}
    `;
    documentReport.head.append(style);
  }

  function patchWorkflowLabels(){
    const labels=window.BogatkaWorkflowV414?.FIELD_LABELS;
    if(labels)Object.assign(labels,{rentConditions:RENT_LABEL,contactNotes:CONTACT_LABEL});
  }

  function enhanceCard(card){
    const panel=card.querySelector('.landlord-card-v416');
    if(!panel)return;
    const sectionCopy=panelCopy(panel);
    if(sectionCopy&&sectionCopy.textContent!==SECTION_COPY)sectionCopy.textContent=SECTION_COPY;
    relabel(panel.querySelector('[data-field="rentConditions"]'),RENT_LABEL,RENT_PLACEHOLDER);
    relabel(panel.querySelector('[data-field="contactNotes"]'),CONTACT_LABEL,CONTACT_PLACEHOLDER);
    panel.dataset.landlordConditionsV449='1';
  }

  function enhanceAll(){
    patchWorkflowLabels();
    document.querySelectorAll('[data-location-card]').forEach(enhanceCard);
  }

  function audit(){
    const failures=[];
    const cards=[...document.querySelectorAll('[data-location-card]')];
    for(const card of cards){
      const id=card.dataset.locationCard||'unknown';
      const panel=card.querySelector('.landlord-card-v416');
      const rent=panel?.querySelector('[data-field="rentConditions"]');
      const contact=panel?.querySelector('[data-field="contactNotes"]');
      const copy=panelCopy(panel)?.textContent||'';
      if(!panel)failures.push(`${id}:panel`);
      if(captionFor(rent)?.textContent!==RENT_LABEL)failures.push(`${id}:rent-label`);
      if(rent?.placeholder!==RENT_PLACEHOLDER)failures.push(`${id}:rent-placeholder`);
      if(captionFor(contact)?.textContent!==CONTACT_LABEL)failures.push(`${id}:contact-label`);
      if(contact?.placeholder!==CONTACT_PLACEHOLDER)failures.push(`${id}:contact-placeholder`);
      if(copy!==SECTION_COPY)failures.push(`${id}:section-copy`);
    }
    return{ok:failures.length===0,cards:cards.length,failures};
  }

  function replaceReportLabel(block,oldLabels,newLabel){
    [...block.querySelectorAll('.report-landlord-grid-v416 > div')].forEach(item=>{
      const strong=item.querySelector('b');
      if(!strong)return;
      const current=strong.textContent.replace(/:\s*$/,'').trim();
      if(oldLabels.includes(current))strong.textContent=`${newLabel}:`;
    });
  }

  function transformReport(html){
    const documentReport=new DOMParser().parseFromString(html,'text/html');

    documentReport.querySelectorAll('.report-landlord-v416').forEach(block=>{
      replaceReportLabel(block,['Дополнительные условия','Предварительные условия аренды'],RENT_LABEL);
      replaceReportLabel(block,['Дополнительная информация','Дополнительная информация по контакту'],CONTACT_LABEL);
      block.dataset.landlordConditionsV449='1';
    });

    documentReport.querySelectorAll('.report-location-card .landlord-card-v416').forEach(panel=>{
      ensureReportHeading(documentReport,panel);
      relabelReportField(panel,'rentConditions',RENT_LABEL);
      relabelReportField(panel,'contactNotes',CONTACT_LABEL);
      panel.dataset.landlordConditionsV449='1';
    });

    documentReport.querySelectorAll('[data-field="rentConditions"]').forEach(control=>{
      const caption=captionFor(control);
      if(caption)caption.textContent=RENT_LABEL;
    });
    documentReport.querySelectorAll('[data-field="contactNotes"]').forEach(control=>{
      const caption=captionFor(control);
      if(caption)caption.textContent=CONTACT_LABEL;
    });
    ensureReportStyles(documentReport);
    return `<!doctype html>\n${documentReport.documentElement.outerHTML}`;
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

  function installReportWrapper(){
    reportAttempts+=1;
    const current=window.BogatkaLiveReport?.build;
    if(typeof current!=='function'||!current.__cardProgressReportV448){
      if(reportAttempts<240)setTimeout(installReportWrapper,80);
      return;
    }
    if(current.__landlordConditionsV449){claim(current);return}

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
    wrapped.__landlordConditionsV449=true;
    wrapped.__base=current;
    wrapped.__htmlAction=exportHtml;
    wrapped.__pdfAction=openPdf;
    claim(wrapped);
  }

  function schedule(delay=50){
    clearTimeout(timer);
    timer=setTimeout(enhanceAll,delay);
  }

  function install(){
    enhanceAll();
    installReportWrapper();
    const root=document.getElementById('locations')||document.body;
    new MutationObserver(()=>schedule(70)).observe(root,{childList:true,subtree:true});
    [150,500,1200,2500].forEach(delay=>setTimeout(enhanceAll,delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('load',()=>schedule(40),{once:true});

  window.BogatkaLandlordConditionsV449={
    version:VERSION,
    ready:true,
    enhanceAll,
    transformReport,
    audit,
    labels:{rent:RENT_LABEL,contact:CONTACT_LABEL},
    placeholders:{rent:RENT_PLACEHOLDER,contact:CONTACT_PLACEHOLDER},
    sectionCopy:SECTION_COPY,
  };
})();
