import {test,expect} from '@playwright/test';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT=path.resolve('.');
const WORKFLOW=path.join(ROOT,'.github/workflows/bogatka-feature-tests.yml');
const RESOLVER=path.join(ROOT,'.github/scripts/resolve-feature-diff-base.sh');
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

test.afterAll(()=>{
  for(const directory of temporary)rmSync(directory,{recursive:true,force:true});
});

test('feature workflow declares guarded pull-request and dispatch base inputs',()=>{
  const workflow=readFileSync(WORKFLOW,'utf8');
  const resolver=readFileSync(RESOLVER,'utf8');
  expect(workflow).toContain('workflow_dispatch:');
  expect(workflow).toContain('base_sha:');
  expect(workflow).toContain("PR_BASE_SHA: ${{ github.event.pull_request.base.sha || '' }}");
  expect(workflow).toContain("WORKFLOW_INPUT_BASE_SHA: ${{ inputs.base_sha || '' }}");
  expect(workflow).toContain('bash .github/scripts/resolve-feature-diff-base.sh');
  expect(workflow).not.toMatch(/git diff[^\n]*github\.event\.pull_request\.base\.sha/);
  expect(resolver).toContain('git rev-parse --verify');
  expect(resolver).toContain('git merge-base HEAD');
  expect(resolver).toContain("resolve_commit 'HEAD^'");
  expect(resolver).toContain('Unable to resolve a valid comparison base');
});

test('pull_request uses and verifies the event base SHA',()=>{
  const repo=makeRepo();
  const base=git(repo,'rev-parse','HEAD');
  commitFile(repo,'pull-request.txt');
  const result=runResolver(repo,{GITHUB_EVENT_NAME:'pull_request',PR_BASE_SHA:base});
  expect(result.status,result.stderr).toBe(0);
  expect(result.stdout).toContain('Event name: pull_request');
  expect(result.stdout).toContain(`Resolved base SHA: ${base}`);
  expect(result.stdout).toContain('pull-request.txt');
  expect(result.changed.trim()).toBe('pull-request.txt');
  expect(result.output).toContain(`base_sha=${base}`);
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
