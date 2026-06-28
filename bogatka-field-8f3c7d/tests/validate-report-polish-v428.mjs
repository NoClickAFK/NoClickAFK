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

const baseLoad=loader.indexOf("loadBogatkaPatch('script',{src:'./report-live-fixes-v427.js'})");
const polishLoad=loader.indexOf("loadBogatkaPatch('script',{src:'./report-polish-v428.js'})");
if(polishLoad<0)failures.push('v23.js does not load report-polish-v428.js');
if(polishLoad<baseLoad)failures.push('report-polish-v428.js is not loaded after the final v427 report wrapper');
if(!worker.includes("'./report-polish-v428.js'"))failures.push('Service Worker does not cache report-polish-v428.js');

for(const marker of [
  'comparison panel is collapsed after a page reload',
  'removes workflow-only sections',
  'use separated grid layouts',
])if(!browser.includes(marker))failures.push(`Browser regression missing ${marker}`);

if(failures.length){
  console.error('Bogatka report polish validation failed:');
  failures.forEach(failure=>console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Bogatka report polish validation passed.');
