import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('bogatka-field-8f3c7d');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('v455 is loaded after launch gate and cached everywhere',()=>{
  const loader=read('durable-fields-v452.js');
  const worker=read('sw-v340.js');
  const publicGate=read('report/launch-gate-v454.js');
  expect(loader.indexOf('opening-project-v455.js')).toBeGreaterThan(loader.indexOf('launch-gate-v454.js'));
  expect(loader).toContain('opening-project-v455.css');
  expect(worker).toContain('./opening-project-v455.js');
  expect(worker).toContain('./opening-project-v455.css');
  expect(worker).toContain('./report/opening-project-v455.js');
  expect(publicGate).toContain("script.src='./opening-project-v455.js'");
});

test('v455 defines seven additive launch phases without destructive migration',()=>{
  const source=read('opening-project-v455.js');
  expect(source).toContain("key:'contract'");
  expect(source).toContain("key:'planning'");
  expect(source).toContain("key:'repair'");
  expect(source).toContain("key:'equipment'");
  expect(source).toContain("key:'supply'");
  expect(source).toContain("key:'staff'");
  expect(source).toContain("key:'opening'");
  expect(source).not.toContain('delete project.milestones');
  expect(source).not.toContain('data.launchProject={}');
});
