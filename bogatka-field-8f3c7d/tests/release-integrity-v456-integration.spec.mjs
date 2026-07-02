import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('bogatka-field-8f3c7d');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('v456 is the final runtime module and is available offline',()=>{
  const loader=read('durable-fields-v452.js');
  const worker=read('sw-v340.js');
  expect(loader.indexOf('release-integrity-v456.js')).toBeGreaterThan(loader.indexOf('opening-project-v455.js'));
  expect(worker).toContain('./release-integrity-v456.js');
});

test('release audit is read-only and non-destructive',()=>{
  const source=read('release-integrity-v456.js');
  expect(source).not.toContain('idbPut(');
  expect(source).not.toContain('idbDelete(');
  expect(source).not.toContain('delete data.');
  expect(source).not.toContain('localStorage.clear');
});
