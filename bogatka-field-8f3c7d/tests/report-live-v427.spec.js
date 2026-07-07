const {test,expect}=require('@playwright/test');

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=location-report-collapse-v464';

async function openApp(page){
  await page.route('**/functions/v1/bogatka-version',route=>route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({version:'4.2.8',versionToken:'428',sourceCommit:'report428abcdef',ahead:1}),
  }));
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaLiveReport?.ready===true&&
    window.BogatkaLiveReport.build?.__liveReportFinalV427===true&&
    window.BogatkaLiveReport.build?.__reportPolishV428===true&&
    window.BogatkaLiveReport.build?.__reportAuthorityV428===true&&
    window.buildReportHtml===window.BogatkaLiveReport.build&&
    typeof window.buildLocationReportHtml==='function'&&
    typeof window.exportLocationHtmlReport==='function'
  ),{timeout:30000});
  await page.waitForFunction(()=>document.querySelectorAll('[data-location-card]').length>1,{timeout:15000});
}

test('live report mirrors the current location DOM and removes editing controls',async({page})=>{
  await openApp(page);

  const result=await page.evaluate(async()=>{
    const card=document.querySelector('[data-location-card]');
    const body=card.querySelector('.location-body');
    const probe=document.createElement('details');
    probe.open=true;
    probe.dataset.liveReportProbe='1';
    probe.innerHTML='<summary>Новый динамический раздел</summary><div class="details-body"><label class="field">Новое поле<input value="Подхвачено автоматически"></label></div>';
    body.appendChild(probe);

    const source={
      cards:document.querySelectorAll('[data-location-card]').length,
      checklist:card.querySelectorAll('.check-row').length,
      scores:card.querySelectorAll('.score-table tbody tr').length,
      stops:window.BogatkaDecisionEngine?.STOPS?.length||card.querySelectorAll('.stop-row-v340').length,
    };
    const html=await window.BogatkaLiveReport.build();
    const doc=new DOMParser().parseFromString(html,'text/html');
    return {
      source,
      report:{
        cards:doc.querySelectorAll('.report-location-card').length,
        checklist:doc.querySelector('.report-location-card')?.querySelectorAll('.check-row').length||0,
        scores:doc.querySelector('.report-location-card')?.querySelectorAll('.score-table tbody tr').length||0,
        stops:doc.querySelector('.report-location-card')?.querySelectorAll('.stop-row-v340').length||0,
        controls:doc.querySelectorAll('.report-location-card input,.report-location-card select,.report-location-card textarea').length,
        actions:doc.querySelectorAll('.report-location-card .location-actions,.report-location-card [data-action]').length,
        text:doc.body.textContent,
        dashes:[...doc.querySelectorAll('.report-control-value')].filter(node=>node.textContent.trim()==='—').length,
      },
      sameBuilder:window.buildReportHtml===window.BogatkaLiveReport.build,
    };
  });

  expect(result.report.cards).toBe(result.source.cards);
  expect(result.report.checklist).toBe(result.source.checklist);
  expect(result.report.scores).toBe(result.source.scores);
  expect(result.report.stops).toBe(result.source.stops);
  expect(result.report.controls).toBe(0);
  expect(result.report.actions).toBe(0);
  expect(result.report.dashes).toBeGreaterThan(10);
  expect(result.report.text).toContain('Новый динамический раздел');
  expect(result.report.text).toContain('Подхвачено автоматически');
  expect(result.report.text).toContain('Параметры осмотра');
  expect(result.report.text).toContain('Арендодатель и условия');
  expect(result.report.text).toContain('Стоп-факторы');
  expect(result.report.text).toContain('Полевой замер трафика');
  expect(result.report.text).toContain('Быстрый чек-лист');
  expect(result.report.text).toContain('Оценка локации');
  expect(result.report.text).toContain('Технические и финансовые параметры');
  expect(result.report.text).toContain('Конкуренты и окружение');
  expect(result.report.text).toContain('Фотографии по категориям');
  expect(result.report.text).toContain('Задачи и комментарии');
  expect(result.sameBuilder).toBe(true);
});

test('removed UI sections disappear from the next generated report',async({page})=>{
  await openApp(page);
  const state=await page.evaluate(async()=>{
    const body=document.querySelector('[data-location-card] .location-body');
    const probe=document.createElement('section');
    probe.dataset.liveRemovalProbe='1';
    probe.innerHTML='<h3>Временный удаляемый раздел</h3><label class="field">Поле<input value="Временное значение"></label>';
    body.appendChild(probe);
    const before=await window.BogatkaLiveReport.build();
    probe.remove();
    const after=await window.BogatkaLiveReport.build();
    return {
      before:before.includes('Временный удаляемый раздел')&&before.includes('Временное значение'),
      after:after.includes('Временный удаляемый раздел')||after.includes('Временное значение'),
    };
  });
  expect(state.before).toBe(true);
  expect(state.after).toBe(false);
});

test('collapsed active cards stay complete while archived cards stay excluded',async({page})=>{
  await openApp(page);
  const state=await page.evaluate(async()=>{
    const cards=[...document.querySelectorAll('[data-location-card]')];
    const active=cards[0];
    const archived=cards[1];
    const activeId=active.dataset.locationCard;
    const archivedId=archived.dataset.locationCard;
    const body=active.querySelector('.location-body');
    const archivedAt=new Date().toISOString();
    const archivedMeta=locations.find(item=>item.id===archivedId);
    if(archivedMeta)archivedMeta.archivedAt=archivedAt;
    archived.classList.add('hidden');
    const html=await window.BogatkaLiveReport.build();
    const doc=new DOMParser().parseFromString(html,'text/html');
    const reportActive=doc.querySelector(`[data-location-card="${CSS.escape(activeId)}"]`);
    const reportArchived=doc.querySelector(`[data-location-card="${CSS.escape(archivedId)}"]`);
    return {
      activePresent:Boolean(reportActive),
      activeComplete:Boolean(reportActive?.textContent.includes('Быстрый чек-лист')&&reportActive?.querySelector('.location-body')),
      archivedPresent:Boolean(reportArchived),
      collapsedRestored:body.hidden,
    };
  });
  expect(state.activePresent).toBe(true);
  expect(state.activeComplete).toBe(true);
  expect(state.archivedPresent).toBe(false);
  expect(state.collapsedRestored).toBe(true);
});

test('individual HTML action exports only the selected location without geolocation',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async()=>{
    const active=locations.filter(item=>!item.archivedAt).slice(0,2);
    const [selected,other]=active;
    const selectedReason='Уникальная причина выбранной локации\nВторая строка причины';
    const otherReason='Причина другой локации';
    for(const [item,reason] of [[selected,selectedReason],[other,otherReason]]){
      const data=await getLocationData(item.id);
      data.decisionReason=reason;
      data.decision='Оставить';
      await idbPut(STORE,data,`location:${item.id}`);
      const control=document.querySelector(`[data-location-card="${CSS.escape(item.id)}"] [data-field="decisionReason"]`);
      if(control){control.value=reason;control.dataset.decisionReasonPersistedV412=reason;}
    }
    const selectedPhoto={id:'location-report-photo-selected',locationId:selected.id,category:'other',caption:'ФОТО ТОЛЬКО ВЫБРАННОЙ ЛОКАЦИИ',originalName:'selected.jpg',width:120,height:80,size:8,createdAt:new Date().toISOString(),blob:new Blob(['selected'],{type:'image/jpeg'})};
    const otherPhoto={id:'location-report-photo-other',locationId:other.id,category:'other',caption:'ФОТО ДРУГОЙ ЛОКАЦИИ',originalName:'other.jpg',width:120,height:80,size:8,createdAt:new Date().toISOString(),blob:new Blob(['other'],{type:'image/jpeg'})};
    await idbPut(PHOTO_STORE,selectedPhoto);
    await idbPut(PHOTO_STORE,otherPhoto);

    let geoCalls=0;
    const geolocation=navigator.geolocation;
    if(geolocation){
      try{geolocation.getCurrentPosition=()=>{geoCalls+=1}}catch(_){ }
    }
    window.__locationReportDownload=null;
    const capture=(blob,name)=>blob.text().then(html=>{window.__locationReportDownload={html,name}});
    window.downloadBlob=capture;
    try{downloadBlob=capture}catch(_){ }

    const selectedCard=document.querySelector(`[data-location-card="${CSS.escape(selected.id)}"]`);
    selectedCard.querySelector('[data-action="export-location-html"]').click();
    for(let index=0;index<200&&!window.__locationReportDownload;index++)await new Promise(requestAnimationFrame);
    if(!window.__locationReportDownload)throw new Error('Location report download was not captured.');
    const {html,name}=window.__locationReportDownload;
    const doc=new DOMParser().parseFromString(html,'text/html');
    const globalHtml=await window.BogatkaLiveReport.build();
    const globalDoc=new DOMParser().parseFromString(globalHtml,'text/html');
    return{
      geoCalls,
      collapsed:selectedCard.classList.contains('location-card-collapsed-v422'),
      buttons:[...document.querySelectorAll('[data-location-card] .location-action-buttons-v448')].map(group=>[...group.children].map(node=>node.textContent.trim())),
      name,
      unsafeName:/[<>:"/\\|?*]/.test(name),
      locationCards:doc.querySelectorAll('.report-location-card').length,
      selectedTitle:doc.body.textContent.includes(selected.title||selected.address),
      selectedAddress:doc.body.textContent.includes(selected.address),
      selectedReason:doc.body.textContent.includes(selectedReason),
      selectedPhoto:doc.body.textContent.includes(selectedPhoto.caption),
      otherTitle:doc.body.textContent.includes(other.title||other.address),
      otherReason:doc.body.textContent.includes(otherReason),
      otherPhoto:doc.body.textContent.includes(otherPhoto.caption),
      comparison:Boolean(doc.querySelector('.report-comparison')),
      globalSummary:[...doc.querySelectorAll('h2')].some(node=>node.textContent.trim()==='Общая сводка'),
      lightboxScript:html.includes('report-photo-open')&&html.includes('reportLightbox'),
      globalCards:globalDoc.querySelectorAll('.report-location-card').length,
      activeCards:document.querySelectorAll('[data-location-card]:not(.hidden)').length,
      globalComparison:Boolean(globalDoc.querySelector('.report-comparison')),
    };
  });

  expect(result.geoCalls).toBe(0);
  expect(result.collapsed).toBe(true);
  expect(result.buttons.every(labels=>labels.includes('Отчёт HTML')&&!labels.includes('Сохранить GPS'))).toBe(true);
  expect(result.name).toMatch(/^bogatka-location-.+-\d{4}-\d{2}-\d{2}\.html$/);
  expect(result.unsafeName).toBe(false);
  expect(result.locationCards).toBe(1);
  expect(result.selectedTitle).toBe(true);
  expect(result.selectedAddress).toBe(true);
  expect(result.selectedReason).toBe(true);
  expect(result.selectedPhoto).toBe(true);
  expect(result.otherTitle).toBe(false);
  expect(result.otherReason).toBe(false);
  expect(result.otherPhoto).toBe(false);
  expect(result.comparison).toBe(false);
  expect(result.globalSummary).toBe(false);
  expect(result.lightboxScript).toBe(true);
  expect(result.globalCards).toBe(result.activeCards);
  expect(result.globalComparison).toBe(true);
});

test('HTML and PDF actions remain backed by the same premium global engine',async({page})=>{
  await openApp(page);
  const state=await page.evaluate(()=>({
    version:window.BogatkaLiveReport.version,
    buildShared:window.buildReportHtml===window.BogatkaLiveReport.build,
    authority:window.BogatkaLiveReport.build?.__reportAuthorityV428===true,
    htmlAction:typeof window.exportHtmlReport==='function',
    pdfAction:typeof window.openPdfReport==='function',
    locationAction:typeof window.exportLocationHtmlReport==='function',
    htmlSource:String(window.exportHtmlReport),
    pdfSource:String(window.openPdfReport),
  }));
  expect(state.version).toBe('4.2.8');
  expect(state.buildShared).toBe(true);
  expect(state.authority).toBe(true);
  expect(state.htmlAction).toBe(true);
  expect(state.pdfAction).toBe(true);
  expect(state.locationAction).toBe(true);
  expect(state.htmlSource).toContain('buildReportHtmlV428');
  expect(state.pdfSource).toContain('buildReportHtmlV428');
});
