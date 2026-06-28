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

const report=read('report-live-v427.js');
const loader=read('v23.js');
const worker=read('sw-v340.js');
const browserTest=read('tests/report-live-v427.spec.js');

for(const marker of [
  "const VERSION='4.2.7'",
  "document.querySelectorAll('#locations > [data-location-card]')",
  'source.cloneNode(true)',
  "querySelectorAll('input,select,textarea')",
  'replaceControl',
  "querySelectorAll('[data-photos]')",
  'blobToDataURL(photo.blob)',
  'report-control-value',
  'report-comparison-table',
  'report-location-card',
  '@media print',
  'buildLiveReportHtml',
  'exportHtmlReportLive',
  'openPdfReportLive',
  'window.buildReportHtml=buildLiveReportHtml',
  'window.BogatkaLiveReport',
])if(report&&!report.includes(marker))failures.push(`report-live-v427.js missing ${marker}`);

if(report.includes('data-report-photo="${escapeHtml(source)}"'))failures.push('Photo payload is duplicated in a data attribute');
if(!report.includes("button.querySelector('img')"))failures.push('Report lightbox does not reuse the embedded full-resolution image');
if(!report.includes("output.textContent=control.checked?'Да':'—'"))failures.push('Unchecked checklist values are not represented with a dash');
if(!report.includes("output.textContent=dash(value)"))failures.push('Empty text values are not represented with a dash');

const reportLoad=loader.indexOf("loadBogatkaPatch('script',{src:'./report-live-v427.js'})");
const lastLocationModule=loader.indexOf("loadBogatkaPatch('script',{src:'./location-card-collapse-v422.js'})");
if(reportLoad<0)failures.push('v23.js does not load report-live-v427.js');
if(lastLocationModule<0||reportLoad<lastLocationModule)failures.push('Live report engine is not loaded after the current location UI modules');
if(!worker.includes("'./report-live-v427.js'"))failures.push('Service Worker does not cache report-live-v427.js');

for(const marker of ['New dynamic section','removed UI sections disappear','same premium report engine']){
  if(!browserTest.toLowerCase().includes(marker.toLowerCase()))failures.push(`Report browser regression missing ${marker}`);
}

if(failures.length){
  console.error('Bogatka live report validation failed:');
  failures.forEach(failure=>console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Bogatka live report validation passed.');
