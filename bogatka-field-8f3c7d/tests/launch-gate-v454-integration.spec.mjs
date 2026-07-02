import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('bogatka-field-8f3c7d');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('v454 loads after stage 7 and is cached',()=>{
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

test('v454 uses a non-destructive gate overlay',()=>{
  const source=read('launch-gate-v454.js');
  const styles=read('launch-gate-v454.css');
  expect(source).toContain("data.decision||''");
  expect(source).toContain("gate.code!=='confirmed'");
  expect(source).toContain('launch-gate-overlay-v454');
  expect(source).toContain('removeOverlay(details)');
  expect(source).not.toContain('body.replaceChildren()');
  expect(source).not.toContain('body.innerHTML=');
  expect(styles).toContain('data-launch-gate-body-v454');
});
