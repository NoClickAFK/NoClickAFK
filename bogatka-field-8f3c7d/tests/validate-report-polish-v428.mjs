import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('bogatka-field-8f3c7d');
const failures=[];
const read=file=>{
  const full=path.join(root,file);
  if(!fs.existsSync(full)){
    failures.push(`Missing ${file}`);
    return '';
  }
  return fs.readFileSync(full,'utf8');
};

const polish=read('report-polish-v428.js');
const authority=read('report-authority-v428.js');
const finalizer431=read('report-finalize-v431.js');
const finalizer432=read('report-finalize-v432.js');
const loader=read('v23.js');
const worker=read('sw-v340.js');
const browser=read('tests/report-polish-v428.spec.js');

for(const marker of [
  "const VERSION='4.2.8'",
  'closeComparisonOnBoot',
  'report-head-metrics-v428',
  'report-head-metric-v428',
  'report-head-status-v428',
  "querySelectorAll('.report-detailed-comparison')",
  "'.economy-v400'",
  "'.launch-project-v400'",
  "'[data-collab-pane=\"history\"]'",
  "'.task-examples-v414'",
  'score-scale-v331',
  'score-label-v414>small',
  'collaboration-v400>.details-body',
  'decision-actions-v412',
  '__reportPolishV428',
])if(!polish.includes(marker))failures.push(`report-polish-v428.js missing ${marker}`);

for(const marker of [
  "const VERSION='4.2.8'",
  '__reportAuthorityV428',
  '__reportPolishV428',
  '__locationProfileV416',
  '__locationProfileV425',
  '__locationOverviewV417',
  '__locationOverviewV421',
  '__locationPanelsV419',
  'buildReportHtmlV428',
  'claim(buildReportHtmlV428)',
  'finally',
  'exportHtmlReportV428',
  'openPdfReportV428',
  './report-finalize-v431.js',
  './report-finalize-v432.js',
  'BogatkaReportFinalizeV432',
])if(!authority.includes(marker))failures.push(`report-authority-v428.js missing ${marker}`);

// v4.3.1 remains the semantic/data base for the exported report.
for(const marker of [
  "const VERSION='4.3.1'",
  'renderReport',
  'report-document',
  'report-location',
  'report-section',
  'report-field-grid',
  'buildLocationReportHtmlV431',
  '__reportFinalizeV431',
  'BogatkaDecisionEngine?.computeAll',
])if(!finalizer431.includes(marker))failures.push(`report-finalize-v431.js missing ${marker}`);

// v4.3.2 owns the final report-only style and accordion presentation.
for(const marker of [
  "const VERSION='4.3.2'",
  'BogatkaReportFinalizeV432',
  'finalizeHtml',
  'buildLocationReportHtmlV432',
  'exportLocationHtmlReportV432',
  'id="reportFinalV432"',
  'report-accordion-v432',
  'report-location-accordion-v432',
  'report-section-accordion-v432',
  'report-accordion-summary-v432',
  'report-accordion-body-v432',
])if(!finalizer432.includes(marker))failures.push(`report-finalize-v432.js missing ${marker}`);

const baseLoad=loader.indexOf("loadBogatkaPatch('script',{src:'./report-live-fixes-v427.js'})");
const polishLoad=loader.indexOf("loadBogatkaPatch('script',{src:'./report-polish-v428.js'})");
const authorityLoad=loader.indexOf("loadBogatkaPatch('script',{src:'./report-authority-v428.js'})");
const finalizer431Load=loader.indexOf("loadBogatkaPatch('script',{src:'./report-finalize-v431.js'})");
const finalizer432Load=loader.indexOf("loadBogatkaPatch('script',{src:'./report-finalize-v432.js'})");
if(polishLoad<0)failures.push('v23.js does not load report-polish-v428.js');
if(authorityLoad<0)failures.push('v23.js does not load report-authority-v428.js');
if(finalizer431Load<0)failures.push('v23.js does not load report-finalize-v431.js');
if(finalizer432Load<0)failures.push('v23.js does not load report-finalize-v432.js');
if(polishLoad<baseLoad)failures.push('report-polish-v428.js is not loaded after the final v427 report wrapper');
if(authorityLoad<polishLoad)failures.push('report-authority-v428.js is not loaded after report-polish-v428.js');
if(finalizer431Load<authorityLoad)failures.push('report-finalize-v431.js is not loaded after report-authority-v428.js');
if(finalizer432Load<finalizer431Load)failures.push('report-finalize-v432.js is not loaded after report-finalize-v431.js');
for(const asset of ["'./report-polish-v428.js'","'./report-authority-v428.js'","'./report-finalize-v431.js'","'./report-finalize-v432.js'"]){
  if(!worker.includes(asset))failures.push(`Service Worker does not cache ${asset}`);
}

for(const marker of [
  'comparison panel is collapsed after a page reload',
  'premium semantic report export has owned accordions and no old style blocks',
  'single-location report has premium collapsible section cards',
  'export report desktop, mobile and print CSS keep premium accordions unclipped',
])if(!browser.includes(marker))failures.push(`Browser regression missing ${marker}`);

for(const marker of [
  "premiumStyle:doc.querySelectorAll('#reportFinalV432').length",
  'expect(result.premiumStyle).toBe(1)',
  "accordions:doc.querySelectorAll('.report-accordion-v432').length",
  'expect(result.accordions).toBeGreaterThan(0)',
  'technicalEconomicsStyleV450|quickChecklistReportStyleV451|reportFinalV431',
  'expect(result.oldStyleBlocks).toBe(false)',
])if(!browser.includes(marker))failures.push(`v4.3.2 browser regression missing ${marker}`);

if(failures.length){
  console.error('Bogatka report polish validation failed:');
  failures.forEach(failure=>console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Bogatka report polish validation passed.');
