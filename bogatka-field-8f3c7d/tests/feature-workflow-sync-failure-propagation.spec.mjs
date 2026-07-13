import {test,expect} from '@playwright/test';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT=path.resolve('.');
const WORKFLOW=path.join(ROOT,'.github/workflows/bogatka-feature-tests.yml');
const temporary=[];

function shellQuote(value){
  return `'${String(value).replaceAll("'","'\"'\"'")}'`;
}

function extractStepRun(workflow,stepName){
  const lines=workflow.split('\n');
  const stepIndex=lines.findIndex(line=>line.trim()===`- name: ${stepName}`);
  if(stepIndex<0)throw new Error(`Workflow step not found: ${stepName}`);
  const runIndex=lines.findIndex((line,index)=>index>stepIndex&&line.trim()==='run: |');
  if(runIndex<0)throw new Error(`Workflow run block not found: ${stepName}`);
  const body=[];
  for(let index=runIndex+1;index<lines.length;index++){
    const line=lines[index];
    if(line.startsWith('      - name: '))break;
    if(line.startsWith('          '))body.push(line.slice(10));
    else if(!line.trim())body.push('');
  }
  return body.join('\n').trimEnd();
}

function extractFunction(script,name){
  const lines=script.split('\n');
  const start=lines.findIndex(line=>line===`${name}() {`);
  if(start<0)throw new Error(`Function not found: ${name}`);
  const end=lines.findIndex((line,index)=>index>start&&line==='}');
  if(end<0)throw new Error(`Function end not found: ${name}`);
  return lines.slice(start,end+1).join('\n');
}

function runScript(content,logName='combined.log'){
  const directory=mkdtempSync(path.join(os.tmpdir(),'bogatka-sync-runner-'));
  temporary.push(directory);
  const scriptPath=path.join(directory,'scenario.sh');
  const logPath=path.join(directory,logName);
  writeFileSync(scriptPath,content);
  const result=spawnSync('bash',[scriptPath,logPath],{encoding:'utf8'});
  return{
    ...result,
    log:readFileSync(logPath,'utf8'),
  };
}

function actualRunnerScenario(commands){
  const workflow=readFileSync(WORKFLOW,'utf8');
  const syncBlock=extractStepRun(workflow,'Run sync safety regressions');
  const runRegression=extractFunction(syncBlock,'run_regression');
  const finishRegressions=extractFunction(syncBlock,'finish_regressions');
  const calls=commands.map(({name,command})=>`run_regression ${shellQuote(name)} bash -c ${shellQuote(command)}`).join('\n');
  return runScript(`set -uo pipefail
SYNC_LOG="$1"
: > "$SYNC_LOG"
failures=0
failed_regressions=()
${runRegression}
${finishRegressions}
${calls}
finish_regressions
`);
}

test.afterAll(()=>{
  for(const directory of temporary)rmSync(directory,{recursive:true,force:true});
});

test('legacy sequential tee pipelines can hide an early failure behind a later success',()=>{
  const result=runScript(`set -o pipefail
LOG="$1"
: > "$LOG"
bash -c 'echo legacy-early-failure; exit 7' 2>&1 | tee -a "$LOG"
bash -c 'echo legacy-later-success; exit 0' 2>&1 | tee -a "$LOG"
`);
  expect(result.status).toBe(0);
  expect(result.log).toContain('legacy-early-failure');
  expect(result.log).toContain('legacy-later-success');
});

test('actual workflow runner preserves an early failure and still executes later suites',()=>{
  const result=actualRunnerScenario([
    {name:'early failure',command:'echo early-failure-output; exit 7'},
    {name:'later success',command:'echo later-success-output; exit 0'},
  ]);
  expect(result.status).not.toBe(0);
  expect(result.stdout).toContain('early failure failed with exit code 7');
  expect(result.stdout).toContain('1 sync/archive regression suite(s) failed: early failure (7)');
  expect(result.log).toContain('early-failure-output');
  expect(result.log).toContain('later-success-output');
  expect(result.log).toContain('early failure exit 7');
  expect(result.log).toContain('later success exit 0');
});

test('actual workflow runner preserves a late failure',()=>{
  const result=actualRunnerScenario([
    {name:'early success',command:'echo early-success-output; exit 0'},
    {name:'late failure',command:'echo late-failure-output; exit 9'},
  ]);
  expect(result.status).not.toBe(0);
  expect(result.stdout).toContain('late failure failed with exit code 9');
  expect(result.stdout).toContain('1 sync/archive regression suite(s) failed: late failure (9)');
  expect(result.log).toContain('early-success-output');
  expect(result.log).toContain('late-failure-output');
});

test('actual workflow runner returns success only when every suite succeeds',()=>{
  const result=actualRunnerScenario([
    {name:'first success',command:'echo first-success-output; exit 0'},
    {name:'second success',command:'echo second-success-output; exit 0'},
  ]);
  expect(result.status,result.stderr).toBe(0);
  expect(result.stdout).toContain('All sync/archive regression suites passed.');
  expect(result.log).toContain('first-success-output');
  expect(result.log).toContain('second-success-output');
});

test('actual workflow runner aggregates multiple failures without stopping later suites',()=>{
  const result=actualRunnerScenario([
    {name:'first failure',command:'echo first-failure-output; exit 3'},
    {name:'middle success',command:'echo middle-success-output; exit 0'},
    {name:'second failure',command:'echo second-failure-output; exit 4'},
  ]);
  expect(result.status).not.toBe(0);
  expect(result.stdout).toContain('first failure failed with exit code 3');
  expect(result.stdout).toContain('second failure failed with exit code 4');
  expect(result.stdout).toContain('2 sync/archive regression suite(s) failed: first failure (3) second failure (4)');
  expect(result.log).toContain('middle-success-output');
});

test('workflow guards every sync/archive invocation and preserves failure artifacts',()=>{
  const workflow=readFileSync(WORKFLOW,'utf8');
  const syncBlock=extractStepRun(workflow,'Run sync safety regressions');
  const expected=[
    ['browser sync stability','bogatka-field-8f3c7d/tests/browser-sync-stability.spec.mjs'],
    ['sync integrity','bogatka-field-8f3c7d/tests/sync-integrity-v412.spec.mjs'],
    ['release integrity','bogatka-field-8f3c7d/tests/release-integrity-v456.spec.mjs'],
    ['sync convergence v4.3.5','bogatka-field-8f3c7d/tests/sync-convergence-v435.spec.mjs'],
    ['in-flight edit serialization','bogatka-field-8f3c7d/tests/sync-inflight-edit-v435.spec.mjs'],
    ['archive synchronization v4.3.6','bogatka-field-8f3c7d/tests/archive-sync-v436.spec.mjs'],
    ['archive startup guard','bogatka-field-8f3c7d/tests/archive-startup-guard-v436.spec.mjs'],
    ['archive final races','bogatka-field-8f3c7d/tests/archive-final-races-v436.spec.mjs'],
    ['late fetch hydration','bogatka-field-8f3c7d/tests/archive-late-fetch-hydration-v436.spec.mjs'],
    ['archive startup fetch readiness','bogatka-field-8f3c7d/tests/archive-startup-fetch-ready-v436.spec.mjs'],
  ];
  expect(syncBlock).toContain('local command_status=${PIPESTATUS[0]}');
  expect(syncBlock).toContain('failures=$((failures + 1))');
  expect(syncBlock).toContain('finish_regressions');
  expect((syncBlock.match(/^run_regression "/gm)||[]).length).toBe(expected.length);
  expect((syncBlock.match(/^\s+npx playwright test /gm)||[]).length).toBe(expected.length);
  expect((syncBlock.match(/\| tee -a "\$SYNC_LOG"/g)||[]).length).toBe(1);
  for(const [name,file] of expected){
    expect(syncBlock).toContain(`run_regression "${name}" \\\n  npx playwright test ${file}`);
  }
  expect(workflow).toContain('feature-workflow-sync-failure-propagation.spec.mjs');
  expect(workflow).toMatch(/- name: Upload startup panels v4\.3\.7 review artifacts\n\s+if: always\(\)/);
  expect(workflow).toMatch(/- name: Upload archive sync v4\.3\.6 review artifacts\n\s+if: always\(\)/);
  expect(workflow).toMatch(/- name: Upload cloud sync v4\.3\.5 review artifacts\n\s+if: always\(\)/);
  expect(workflow).toMatch(/- name: Upload feature diagnostics\n\s+if: failure\(\)/);
});
