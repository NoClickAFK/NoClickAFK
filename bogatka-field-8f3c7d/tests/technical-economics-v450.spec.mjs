import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=450';
const TECH_NOTE='Здесь фиксируются параметры помещения и обязательные суммы по предложению. Прогноз выручки, расходы бизнеса и окупаемость рассчитываются в экономической модели.';
const ECONOMY_NOTE='Площадь, аренда, коммунальные платежи, депозит, ремонт и оборудование берутся из блока выше. Здесь вводятся только прогноз выручки, маржа и остальные расходы бизнеса.';

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaTechnicalEconomicsV450?.ready&&
    window.BogatkaLiveReport?.build?.__technicalEconomicsV450&&
    window.BogatkaSuite?.calculateEconomy?.__technicalEconomicsV450&&
    window.BogatkaDecisionEngine?.computeAll?.__technicalEconomicsV450&&
    document.querySelector('[data-location-card] [data-technical-economics-v450]')
  ),{timeout:25000});
  return page.locator('[data-location-card]').first();
}

async function seedFinancialData(page,card){
  const id=await card.getAttribute('data-location-card');
  await page.evaluate(async locationId=>{
    const data=await getLocationData(locationId);
    data.tech={
      ...(data.tech||{}),
      totalArea:'100',
      salesArea:'70',
      storageArea:'20',
      powerKw:'25',
      rentPerMonth:'2500',
      rentPerSqm:'999',
      utilities:'300',
      deposit:'2500',
      repairEstimate:'10000',
      equipmentEstimate:'15000',
      rentHolidays:'30 дней',
      indexation:'5% в год',
      openingHours:'ежедневно 09:00–21:00',
    };
    data.economy={
      ...(data.economy||{}),
      monthlyRevenue:'50000',
      grossMarginPct:'30',
      taxRatePct:'5',
      payroll:'6000',
      marketing:'1000',
      logistics:'800',
      otherOpex:'400',
      initialStock:'20000',
      workingCapital:'5000',
      openingOther:'2000',
      openingInvestmentOverride:'',
      forecastNote:'Расчёт по действующей точке в сопоставимом районе',
    };
    await idbPut(STORE,data,`location:${locationId}`);
    renderLocations();
  },id);
  await page.waitForFunction(locationId=>{
    const card=document.querySelector(`[data-location-card="${CSS.escape(locationId)}"]`);
    return Boolean(
      card?.querySelector('[data-field="tech.rentPerSqm"]')?.readOnly&&
      card?.querySelector('[data-economy-source-v450]')&&
      window.BogatkaTechnicalEconomicsV450.audit().ok
    );
  },id);
  return id;
}

test('technical section separates verified facts and makes rent per square metre derived',async({page})=>{
  const card=await openApp(page);
  const id=await seedFinancialData(page,card);
  const current=page.locator(`[data-location-card="${id}"]`);
  const technical=current.locator('details[data-technical-economics-v450]').filter({has:page.locator('summary:text-is("Технические и финансовые параметры")')});
  const rentPerSqm=technical.locator('[data-field="tech.rentPerSqm"]');

  await expect(technical.locator('.technical-guide-v450')).toHaveText(TECH_NOTE);
  await expect(technical.locator('[data-field="tech.totalArea"]').locator('xpath=ancestor::label')).toContainText('Общая площадь помещения, м²');
  await expect(technical.locator('[data-field="tech.storageArea"]').locator('xpath=ancestor::label')).toContainText('Складская и подсобная площадь, м²');
  await expect(technical.locator('[data-field="tech.utilities"]').locator('xpath=ancestor::label')).toContainText('Коммунальные и эксплуатационные платежи в месяц, BYN');
  await expect(technical.locator('[data-field="tech.deposit"]').locator('xpath=ancestor::label')).toContainText('Депозит / обеспечительный платёж, BYN');
  await expect(rentPerSqm).toHaveAttribute('readonly','');
  await expect(rentPerSqm).toHaveValue('25');
  await expect(rentPerSqm.locator('xpath=ancestor::label')).toContainText('рассчитывается автоматически');

  const stored=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(stored.tech.rentPerSqm).toBe('999');
});

test('economy uses technical sources without duplicate editable inputs',async({page})=>{
  const card=await openApp(page);
  const id=await seedFinancialData(page,card);
  const current=page.locator(`[data-location-card="${id}"]`);
  const economy=current.locator('.economy-v400');

  await expect(economy.locator('.section-note')).toHaveText(ECONOMY_NOTE);
  await expect(economy.locator('[data-source-v450="area"]')).toHaveText('100 м²');
  await expect(economy.locator('[data-source-v450="rent"]')).toContainText('2 500 BYN');
  await expect(economy.locator('[data-source-v450="rentPerSqm"]')).toHaveText('25 BYN/м²');
  await expect(economy.locator('[data-source-v450="utilities"]')).toContainText('300 BYN');
  await expect(economy.locator('[data-source-v450="openingBase"]')).toContainText('27 500 BYN');

  const override=economy.locator('[data-economy-key="openingInvestmentOverride"]');
  const forecast=economy.locator('[data-economy-key="forecastNote"]');
  await expect(override.locator('xpath=ancestor::label')).toContainText('Итоговые инвестиции вручную, BYN');
  await expect(override).toHaveAttribute('placeholder','Заполняйте только если итог должен отличаться от автоматического расчёта');
  await expect(forecast.locator('xpath=ancestor::label')).toContainText('Основание прогноза выручки');
  await expect(forecast).toHaveAttribute('placeholder','Факт действующей точки, расчёт трафика, аналогичный район или другой источник');

  await expect(economy.locator('[data-econ-result="rentBurdenPct"]').locator('xpath=..')).toContainText('Доля аренды в выручке');
  await expect(economy.locator('[data-econ-result="operatingMarginPct"]').locator('xpath=..')).toContainText('Операционная маржа');
  await expect(economy.locator('[data-econ-result="breakEvenRevenue"]').locator('xpath=..')).toContainText('Выручка для безубыточности');
});

test('all calculations ignore a stale manually stored rent-per-square-metre value',async({page})=>{
  const card=await openApp(page);
  const id=await seedFinancialData(page,card);
  const result=await page.evaluate(async locationId=>{
    const data=await getLocationData(locationId);
    const economy=window.BogatkaSuite.calculateEconomy(data);
    const metrics=await window.BogatkaDecisionEngine.computeAll();
    const metric=metrics.find(item=>item.id===locationId);
    return{
      calculated:economy.rentPerSqm,
      metric:metric?.rentPerSqm,
      area:metric?.area,
      rent:metric?.rent,
      stored:data.tech.rentPerSqm,
      fixedCosts:economy.fixedCosts,
      openingInvestment:economy.openingInvestment,
    };
  },id);

  expect(result.calculated).toBe(25);
  expect(result.metric).toBe(25);
  expect(result.area).toBe(100);
  expect(result.rent).toBe(2500);
  expect(result.stored).toBe('999');
  expect(result.fixedCosts).toBe(11000);
  expect(result.openingInvestment).toBe(54500);
});

test('history labels identify each technical and economic field',async({page})=>{
  await openApp(page);
  const labels=await page.evaluate(()=>({
    area:window.BogatkaWorkflowV414.FIELD_LABELS['tech.totalArea'],
    rent:window.BogatkaWorkflowV414.FIELD_LABELS['tech.rentPerMonth'],
    rentPerSqm:window.BogatkaWorkflowV414.FIELD_LABELS['tech.rentPerSqm'],
    revenue:window.BogatkaWorkflowV414.FIELD_LABELS['economy.monthlyRevenue'],
    forecast:window.BogatkaWorkflowV414.FIELD_LABELS['economy.forecastNote'],
    override:window.BogatkaWorkflowV414.FIELD_LABELS['economy.openingInvestmentOverride'],
  }));
  expect(labels).toEqual({
    area:'Общая площадь помещения, м²',
    rent:'Аренда в месяц, BYN',
    rentPerSqm:'Аренда за м², BYN — рассчитывается автоматически',
    revenue:'Прогноз выручки в месяц, BYN',
    forecast:'Основание прогноза выручки',
    override:'Итоговые инвестиции вручную, BYN',
  });
});

test('HTML and PDF source retain the same fields, sources and calculated value',async({page})=>{
  const card=await openApp(page);
  const id=await seedFinancialData(page,card);
  const report=await page.evaluate(async locationId=>{
    const before=await getLocationData(locationId);
    const html=await window.BogatkaLiveReport.build();
    const after=await getLocationData(locationId);
    const doc=new DOMParser().parseFromString(html,'text/html');
    const location=doc.querySelector(`[data-location-card="${CSS.escape(locationId)}"]`);
    return{
      text:location?.textContent||'',
      technicalMarkers:location?.querySelectorAll('[data-technical-economics-report-v450]').length||0,
      style:Boolean(doc.getElementById('technicalEconomicsStyleV450')),
      authoritative:window.buildReportHtml===window.BogatkaLiveReport.build,
      marker:Boolean(window.BogatkaLiveReport.build.__technicalEconomicsV450),
      htmlAction:window.exportHtmlReport===window.BogatkaLiveReport.build.__htmlAction,
      pdfAction:window.openPdfReport===window.BogatkaLiveReport.build.__pdfAction,
      storedBefore:before.tech.rentPerSqm,
      storedAfter:after.tech.rentPerSqm,
    };
  },id);

  expect(report.authoritative).toBe(true);
  expect(report.marker).toBe(true);
  expect(report.htmlAction).toBe(true);
  expect(report.pdfAction).toBe(true);
  expect(report.technicalMarkers).toBeGreaterThanOrEqual(2);
  expect(report.style).toBe(true);
  expect(report.text).toContain('Общая площадь помещения, м²');
  expect(report.text).toContain('Аренда за м², BYN — рассчитывается автоматически');
  expect(report.text).toContain('Основание прогноза выручки');
  expect(report.text).toContain('25 BYN/м²');
  expect(report.text).toContain('Расчёт по действующей точке в сопоставимом районе');
  expect(report.storedBefore).toBe('999');
  expect(report.storedAfter).toBe('999');
});

test('critical lease checks remain unchanged',async({page})=>{
  await openApp(page);
  const state=await page.evaluate(()=>({
    version:window.BogatkaCriticalDeal?.VERSION,
    count:window.BogatkaCriticalDeal?.CONDITIONS?.length,
    keys:window.BogatkaCriticalDeal?.CONDITIONS?.map(item=>item.key),
  }));
  expect(state.version).toBe('4.3.3');
  expect(state.count).toBe(10);
  expect(new Set(state.keys).size).toBe(10);
});
