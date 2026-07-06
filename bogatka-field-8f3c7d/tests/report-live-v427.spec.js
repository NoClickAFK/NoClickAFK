const {test,expect}=require('@playwright/test');

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=428';

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
    window.buildReportHtml===window.BogatkaLiveReport.build
  ),{timeout:20000});
  await page.waitForFunction(()=>document.querySelectorAll('[data-location-card]').length>0,{timeout:15000});
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
    body.insertBefore(probe,body.querySelector('[data-collaboration]')||null);

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
    body.hidden=true;
    active.classList.add('location-card-collapsed-v422');
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

test('HTML and PDF actions are backed by the same premium report engine',async({page})=>{
  await openApp(page);
  const state=await page.evaluate(()=>({
    version:window.BogatkaLiveReport.version,
    buildShared:window.buildReportHtml===window.BogatkaLiveReport.build,
    authority:window.BogatkaLiveReport.build?.__reportAuthorityV428===true,
    htmlAction:typeof window.exportHtmlReport==='function',
    pdfAction:typeof window.openPdfReport==='function',
    htmlSource:String(window.exportHtmlReport),
    pdfSource:String(window.openPdfReport),
  }));
  expect(state.version).toBe('4.2.8');
  expect(state.buildShared).toBe(true);
  expect(state.authority).toBe(true);
  expect(state.htmlAction).toBe(true);
  expect(state.pdfAction).toBe(true);
  expect(state.htmlSource).toContain('buildReportHtmlV428');
  expect(state.pdfSource).toContain('buildReportHtmlV428');
});
