import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('bogatka-field-8f3c7d');
const errors=[];
const required={
  'workflow-fixes-v415.js':['BogatkaWorkflowFixesV415','commentResetV415','task-priority-trigger-v415'],
  'workflow-fixes-v415.css':['.comment-form-v400','.task-priority-trigger-v415','.premium-select-option'],
  'v23.js':["href:'./workflow-fixes-v415.css'","src:'./workflow-fixes-v415.js'"],
  'sw-v340.js':["'./workflow-fixes-v415.css'","'./workflow-fixes-v415.js'"],
};

for(const [file,markers] of Object.entries(required)){
  const full=path.join(root,file);
  if(!fs.existsSync(full)){errors.push(`Missing ${file}`);continue}
  const text=fs.readFileSync(full,'utf8');
  for(const marker of markers)if(!text.includes(marker))errors.push(`${file} missing ${marker}`);
}

if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('Workflow fixes v415 validation passed.');
