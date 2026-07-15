import {test,expect} from '@playwright/test';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT=path.resolve('.');
const WORKFLOW=path.join(ROOT,'.github/workflows/bogatka-feature-tests.yml');
const RESOLVER=path.join(ROOT,'.github/scripts/resolve-feature-diff-base.sh');
const PUBLICATION_BLOCKER='bogatka-field-8f3c7d/tests/release-blockers-v437.spec.mjs';
const temporary=[];

function command(cwd,program,args,env={}){
  return spawnSync(program,args,{cwd,encoding:'utf8',env:{...process.env,...env}});
}

function git(cwd,...args){
  const result=command(cwd,'git',args);
  if(result.status!==0)throw new Error(`git ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}

function makeRepo(){
  const repo=mkdtempSync(path.join(os.tmpdir(),'bogatka-diff-base-'));
  temporary.push(repo);
  git(repo,'init','-b','main');
  git(repo,'config','user.email','workflow-test@example.com');
  git(repo,'config','user.name','Workflow Test');
  writeFileSync(path.join(repo,'base.txt'),'base\n');
  git(repo,'add','base.txt');
  git(repo,'commit','-m','base');
  return repo;
}

function commitFile(repo,name,content='changed\n'){
  writeFileSync(path.join(repo,name),content);
  git(repo,'add',name);
  git(repo,'commit','-m',`change ${name}`);
  return git(repo,'rev-parse','HEAD');
}

function runResolver(repo,env){
  const changedFile=path.join(repo,'changed-files.txt');
  const githubOutput=path.join(repo,'github-output.txt');
  const result=command(repo,'bash',[RESOLVER],{
    GITHUB_OUTPUT:githubOutput,
    CHANGED_FILE_OUTPUT:changedFile,
    DEFAULT_BRANCH:'main',
    PR_BASE_SHA:'',
    WORKFLOW_INPUT_BASE_SHA:'',
    ...env,
  });
  return{
    ...result,
    changedFile,
    githubOutput,
    changed:result.status===0?readFileSync(changedFile,'utf8'):'',
    output:result.status===0?readFileSync(githubOutput,'utf8'):'',
  };
}

function selectionScript(){
  const lines=readFileSync(WORKFLOW,'utf8').split('\n');
  const stepIndex=lines.findIndex(line=>line.trim()==='- name: Select tests for changed domains');
  const runIndex=lines.findIndex((line,index)=>index>stepIndex&&line.trim()==='run: |');
  const endIndex=lines.findIndex((line,index)=>index>runIndex&&line.startsWith('      - name:'));
  if(stepIndex<0||runIndex<0||endIndex<0)throw new Error('Unable to extract the workflow selection step.');
  const body=lines.slice(runIndex+1,endIndex);
  const indentation=Math.min(...body.filter(line=>line.trim()).map(line=>line.match(/^\s*/)[0].length));
  return body.map(line=>line.slice(indentation)).join('\n');
}

function runSelection(changedFiles){
  const directory=mkdtempSync(path.join(os.tmpdir(),'bogatka-selection-'));
  temporary.push(directory);
  const changedFile=path.join(directory,'changed-files.txt');
  const selectedFile=path.join(directory,'selected-tests.txt');
  const githubOutput=path.join(directory,'github-output.txt');
  writeFileSync(changedFile,`${changedFiles.join('\n')}\n`);
  const script=selectionScript()
    .replaceAll('/tmp/bogatka-changed-files.txt',changedFile)
    .replaceAll('/tmp/selected-tests.txt',selectedFile);
  const result=command(ROOT,'bash',['-c',script],{GITHUB_OUTPUT:githubOutput});
  return{
    ...result,
    selected:result.status===0?readFileSync(selectedFile,'utf8').trim().split('\n').filter(Boolean):[],
    output:result.status===0?readFileSync(githubOutput,'utf8'):'',
  };
}

function outputValue(output,key){
  return output.split('\n').find(line=>line.startsWith(`${key}=`))?.slice(key.length+1)||'';
}

test.afterAll(()=>{
  for(const directory of temporary)rmSync(directory,{recursive:true,force:true});
});

test('feature workflow declares guarded bases, preserves artifacts, and keeps compare mapped',()=>{
  const workflow=readFileSync(WORKFLOW,'utf8');
  const resolver=readFileSync(RESOLVER,'utf8');
  expect(workflow).toContain('workflow_dispatch:');
  expect(workflow).toContain('base_sha:');
  expect(workflow).toContain("PR_BASE_SHA: ${{ github.event.pull_request.base.sha || '' }}");
  expect(workflow).toContain("WORKFLOW_INPUT_BASE_SHA: ${{ inputs.base_sha || '' }}");
  expect(workflow).toContain('bash .github/scripts/resolve-feature-diff-base.sh');
  expect(workflow).toContain("photo-plan|compare'");
  expect(workflow).toContain('--output=/tmp/bogatka-workflow-resolver-results');
  expect(workflow).not.toMatch(/git diff[^\n]*github\.event\.pull_request\.base\.sha/);
  expect(resolver).toContain('git rev-parse --verify');
  expect(resolver).toContain('git merge-base HEAD');
  expect(resolver).toContain('git merge-base "$base_sha" HEAD');
  expect(resolver).toContain("resolve_commit 'HEAD^'");
  expect(resolver).toContain('Unable to resolve a valid comparison base');
  expect(resolver).toContain('does not share a merge base with HEAD');
});

test('cloud.js-only selection executes the publication blocker and sync safety',()=>{
  const result=runSelection(['bogatka-field-8f3c7d/cloud.js']);
  expect(result.status,result.stderr).toBe(0);
  expect(result.selected).toContain(PUBLICATION_BLOCKER);
  expect(result.selected.filter(item=>item===PUBLICATION_BLOCKER)).toHaveLength(1);
  expect(outputValue(result.output,'sync_changed')).toBe('true');
});

test('mutation authority selection keeps the publication blocker mapped once',()=>{
  const result=runSelection(['bogatka-field-8f3c7d/mutation-authority-v437.js']);
  expect(result.status,result.stderr).toBe(0);
  expect(result.selected).toContain(PUBLICATION_BLOCKER);
  expect(result.selected.filter(item=>item===PUBLICATION_BLOCKER)).toHaveLength(1);
});

test('publication focused test and aggregator changes keep the aggregator selected',()=>{
  for(const changed of [
    'bogatka-field-8f3c7d/tests/release-blockers-publication-authority-v437.spec.mjs',
    'bogatka-field-8f3c7d/tests/release-blockers-v437.spec.mjs',
  ]){
    const result=runSelection([changed]);
    expect(result.status,result.stderr).toBe(0);
    expect(result.selected).toContain(PUBLICATION_BLOCKER);
    expect(result.selected.filter(item=>item===PUBLICATION_BLOCKER)).toHaveLength(1);
  }
});

test('unrelated file does not select the publication blocker accidentally',()=>{
  const result=runSelection(['bogatka-field-8f3c7d/docs/unrelated-note.md']);
  expect(result.status,result.stderr).toBe(0);
  expect(result.selected).not.toContain(PUBLICATION_BLOCKER);
});

test('pull_request uses and verifies the event base SHA',()=>{
  const repo=makeRepo();
  const base=git(repo,'rev-parse','HEAD');
  commitFile(repo,'pull-request.txt');
  const result=runResolver(repo,{GITHUB_EVENT_NAME:'pull_request',PR_BASE_SHA:base});
  expect(result.status,result.stderr).toBe(0);
  expect(result.stdout).toContain('Event name: pull_request');
  expect(result.stdout).toContain(`Resolved base SHA: ${base}`);
  expect(result.stdout).toContain(`Diff merge base SHA: ${base}`);
  expect(result.stdout).toContain('pull-request.txt');
  expect(result.changed.trim()).toBe('pull-request.txt');
  expect(result.output).toContain(`base_sha=${base}`);
  expect(result.output).toContain(`diff_merge_base=${base}`);
});

test('workflow_dispatch honors an explicit base_sha',()=>{
  const repo=makeRepo();
  const base=git(repo,'rev-parse','HEAD');
  commitFile(repo,'explicit-dispatch.txt');
  const result=runResolver(repo,{GITHUB_EVENT_NAME:'workflow_dispatch',WORKFLOW_INPUT_BASE_SHA:base});
  expect(result.status,result.stderr).toBe(0);
  expect(result.stdout).toContain('Base source: workflow_dispatch input base_sha');
  expect(result.changed.trim()).toBe('explicit-dispatch.txt');
});

test('workflow_dispatch rejects an existing base from unrelated history',()=>{
  const repo=makeRepo();
  const originalHead=git(repo,'rev-parse','HEAD');
  git(repo,'checkout','--orphan','unrelated');
  rmSync(path.join(repo,'base.txt'),{force:true});
  writeFileSync(path.join(repo,'unrelated.txt'),'unrelated\n');
  git(repo,'add','-A');
  git(repo,'commit','-m','unrelated history');
  const unrelated=git(repo,'rev-parse','HEAD');
  git(repo,'checkout','--detach',originalHead);
  const result=runResolver(repo,{GITHUB_EVENT_NAME:'workflow_dispatch',WORKFLOW_INPUT_BASE_SHA:unrelated});
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain(`Resolved base '${unrelated}' does not share a merge base with HEAD`);
});

test('workflow_dispatch without input uses the merge base with origin main',()=>{
  const parent=mkdtempSync(path.join(os.tmpdir(),'bogatka-diff-remote-'));
  temporary.push(parent);
  const remote=path.join(parent,'origin.git');
  mkdirSync(remote);
  git(remote,'init','--bare');
  const repo=makeRepo();
  const base=git(repo,'rev-parse','HEAD');
  git(repo,'remote','add','origin',remote);
  git(repo,'push','-u','origin','main');
  git(repo,'checkout','-b','feature');
  commitFile(repo,'merge-base-dispatch.txt');
  const result=runResolver(repo,{GITHUB_EVENT_NAME:'workflow_dispatch'});
  expect(result.status,result.stderr).toBe(0);
  expect(result.stdout).toContain(`Resolved base SHA: ${base}`);
  expect(result.stdout).toContain('Base source: merge base with origin/main');
  expect(result.changed.trim()).toBe('merge-base-dispatch.txt');
});

test('workflow_dispatch falls back to HEAD parent when the default branch cannot resolve',()=>{
  const repo=makeRepo();
  const base=git(repo,'rev-parse','HEAD');
  commitFile(repo,'head-parent-fallback.txt');
  const result=runResolver(repo,{GITHUB_EVENT_NAME:'workflow_dispatch',DEFAULT_BRANCH:'missing'});
  expect(result.status,result.stderr).toBe(0);
  expect(result.stdout).toContain(`Resolved base SHA: ${base}`);
  expect(result.stdout).toContain('Base source: safe fallback HEAD^');
  expect(result.changed.trim()).toBe('head-parent-fallback.txt');
});

test('resolver fails explicitly when no valid comparison base exists',()=>{
  const repo=makeRepo();
  const result=runResolver(repo,{GITHUB_EVENT_NAME:'workflow_dispatch',DEFAULT_BRANCH:'missing'});
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('Unable to resolve a valid comparison base');
});

test('a valid zero-change diff remains successful and reports zero files',()=>{
  const repo=makeRepo();
  const head=git(repo,'rev-parse','HEAD');
  const result=runResolver(repo,{GITHUB_EVENT_NAME:'workflow_dispatch',WORKFLOW_INPUT_BASE_SHA:head});
  expect(result.status,result.stderr).toBe(0);
  expect(result.stdout).toContain('Valid diff evaluated; changed file count: 0');
  expect(result.changed).toBe('');
  expect(result.output).toContain('changed_count=0');
});
