const {test,expect}=require('@playwright/test');
const {openApp,seedFixtures,pageFromHtml,visualSnapshot}=require('./report-premium-v433.helpers.js');

test('single report has one boardroom hero, one decision presentation and executive summary',async({page,context})=>{
  await openApp(page);
  const generated=await seedFixtures(page);
  const report=await pageFromHtml(context,generated.single,{width:1440,height:900});
  const result=await visualSnapshot(report);
  expect(result.heroCount).toBe(1);
  expect(result.oldCover).toBe(0);
  expect(result.duplicateLocationHeader).toBe(0);
  expect(result.executiveCount).toBe(1);
  expect(result.decisionPrimary).toBe(1);
  expect(result.decisionStrips).toBe(0);
  expect(result.decisionAccordions).toBe(0);
  expect(result.heroBottom).toBeLessThanOrEqual(820);
  expect(result.executiveTop).toBeLessThan(900);
  expect(result.heroSummaryGap).toBeGreaterThanOrEqual(40);
  expect(result.heroSummaryGap).toBeLessThanOrEqual(52);
  expect(result.displaySize).toBeGreaterThanOrEqual(42);
  expect(result.displaySize).toBeLessThanOrEqual(48);
  expect(result.sectionSize).toBeGreaterThanOrEqual(19);
  expect(result.bodySize).toBeGreaterThanOrEqual(15);
  expect(result.captionSize).toBeGreaterThanOrEqual(12.5);
  expect(result.kpiSize).toBeGreaterThanOrEqual(30);
  expect(result.nestedAppBlocks).toBe(0);
  expect(result.rawDetails).toBe(0);
  expect(result.controls).toBe(0);
  expect(result.overflow).toBeLessThanOrEqual(1);
  expect(result.generator).toBe('Bogatka premium export 4.3.3');
  expect(result.fieldShadows.every(value=>value==='none')).toBe(true);
  expect(result.fieldRadii.every(value=>value===0)).toBe(true);
});

test('economy section uses four primary financial metrics and a secondary breakdown',async({page,context})=>{
  await openApp(page);
  const generated=await seedFixtures(page);
  const report=await pageFromHtml(context,generated.single,{width:1440,height:1200});
  const economy=report.locator('.report-section-accordion-v432').filter({hasText:'Экономическая модель'}).first();
  await expect(economy).toBeVisible();
  const result=await economy.evaluate(section=>({
    primary:section.querySelectorAll('.report-finance-primary-v433 .report-finance-metric-v433').length,
    breakdown:section.querySelectorAll('.report-finance-breakdown-v433 dt').length,
    zeros:(section.textContent.match(/\b0(?:[,.]0+)?\s*BYN/g)||[]).length,
    empty:section.querySelectorAll('.report-economy-empty-v433').length,
    labels:[...section.querySelectorAll('.report-finance-metric-v433 span')].map(node=>node.textContent.trim()),
  }));
  expect(result.primary).toBe(4);
  expect(result.breakdown).toBeGreaterThan(4);
  expect(result.zeros).toBe(0);
  expect(result.empty).toBe(0);
  expect(result.labels).toEqual(['Выручка в месяц','Операционная прибыль','Инвестиции в открытие','Окупаемость']);
});

test('full report follows executive narrative and separates shortlist, risks, comparison and dossiers',async({page,context})=>{
  await openApp(page);
  const generated=await seedFixtures(page);
  const report=await pageFromHtml(context,generated.full,{width:1440,height:1100});
  const result=await report.evaluate(()=>({
    topChildren:[...document.querySelector('.report-document').children].map(node=>node.className||node.tagName),
    shortlist:document.querySelectorAll('.report-shortlist-card-v433').length,
    riskRows:document.querySelectorAll('.report-risk-row-v433').length,
    comparisonHidden:document.querySelector('.report-comparison-body-v433')?.hidden,
    locationCount:document.querySelectorAll('.report-location-dossier-v433').length,
    openLocations:document.querySelectorAll('.report-location-dossier-v433[data-open="true"]>.report-location-body-v433:not([hidden])').length,
    collapsedLocations:document.querySelectorAll('.report-location-dossier-v433[data-open="false"]>.report-location-body-v433[hidden]').length,
    firstSummaryText:document.querySelector('.report-location-summary-v433')?.textContent||'',
    statusPills:[...document.querySelectorAll('.report-location-summary-v433 .report-status')].map(node=>node.textContent.trim()),
    overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
  }));
  const joined=result.topChildren.join('|');
  expect(joined.indexOf('report-hero-v433')).toBeLessThan(joined.indexOf('report-portfolio-summary-v433'));
  expect(joined.indexOf('report-portfolio-summary-v433')).toBeLessThan(joined.indexOf('report-shortlist-v433'));
  expect(joined.indexOf('report-shortlist-v433')).toBeLessThan(joined.indexOf('report-risk-overview-v433'));
  expect(joined.indexOf('report-risk-overview-v433')).toBeLessThan(joined.indexOf('report-comparison'));
  expect(result.shortlist).toBeGreaterThan(0);
  expect(result.shortlist).toBeLessThanOrEqual(3);
  expect(result.riskRows).toBeGreaterThan(0);
  expect(result.comparisonHidden).toBe(true);
  expect(result.locationCount).toBeGreaterThan(1);
  expect(result.openLocations).toBe(1);
  expect(result.collapsedLocations).toBe(result.locationCount-1);
  expect(result.firstSummaryText).toMatch(/\/70|балл/i);
  expect(result.firstSummaryText).toMatch(/%|заполн/i);
  expect(result.firstSummaryText).toMatch(/Оставить|Уточнить|Не выбрано/i);
  expect(result.statusPills.length).toBeLessThanOrEqual(result.locationCount);
  expect(result.overflow).toBeLessThanOrEqual(1);
});
