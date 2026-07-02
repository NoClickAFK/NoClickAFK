import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('bogatka-field-8f3c7d');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('v453 runtime and report assets are integrated after v452',()=>{
  const loader=read('v23.js');
  const worker=read('sw-v340.js');
  const report=read('report/index.html');
  expect(loader.indexOf('traffic-competitors-v453.js')).toBeGreaterThan(loader.indexOf('location-data-stability-v452.js'));
  expect(loader).toContain('traffic-competitors-v453.css');
  expect(worker).toContain('./traffic-competitors-v453.js');
  expect(worker).toContain('./traffic-competitors-v453.css');
  expect(worker).toContain('./report/traffic-competitors-v453.js');
  expect(report).toContain('./traffic-competitors-v453.js');
});

test('v453 explicitly preserves legacy traffic and first competitor structures',()=>{
  const source=read('traffic-competitors-v453.js');
  expect(source).toContain("const VERSION='4.5.3'");
  expect(source).toContain("TRAFFIC='trafficMeasurements'");
  expect(source).toContain("COMPETITORS='competitors'");
  expect(source).toContain('data.traffic');
  expect(source).toContain('data.competitor');
  expect(source).not.toContain('delete data.traffic');
  expect(source).not.toContain('delete data.competitor');
});
