import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('bogatka-field-8f3c7d');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('v454 is loaded after stage 7 and cached for app and public report',()=>{
  const loader=read('durable-fields-v452.js');
  const worker=read('sw-v340.js');
  const publicLoader=read('report/location-details-v452.js');
  expect(loader.indexOf('launch-gate-v454.js')).toBeGreaterThan(loader.indexOf('traffic-competitors-v453.js'));
  expect(loader).toContain('launch-gate-v454.css');
  expect(worker).toContain('./launch-gate-v454.js');
  expect(worker).toContain('./launch-gate-v454.css');
  expect(worker).toContain('./report/launch-gate-v454.js');
  expect(publicLoader).toContain("'./launch-gate-v454.js'");
});

test('v454 never deletes an existing opening project',()=>{
  const source=read('launch-gate-v454.js');
  expect(source).toContain("data.decision||''");
  expect(source).toContain("gate.code!=='confirmed'");
  expect(source).not.toContain('delete data.launchProject');
  expect(source).not.toContain('data.launchProject=null');
});
