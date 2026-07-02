import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('bogatka-field-8f3c7d');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('v453 assets are loaded and cached once',()=>{
  const durable=read('durable-fields-v452.js');
  const worker=read('sw-v340.js');
  const publicLoader=read('report/location-details-v452.js');
  const occurrences=(text,value)=>text.split(value).length-1;

  expect(durable).toContain("href:'./traffic-competitors-v453.css'");
  expect(durable).toContain("src:'./traffic-competitors-v453.js'");
  expect(occurrences(worker,'./traffic-competitors-v453.css')).toBe(1);
  expect(occurrences(worker,'./traffic-competitors-v453.js')).toBe(1);
  expect(occurrences(worker,'./report/traffic-competitors-v453.js')).toBe(1);
  expect(publicLoader).toContain("'./traffic-competitors-v453.js'");
  expect(publicLoader).toContain('script.src=src');
});

test('v453 keeps legacy traffic and first competitor structures',()=>{
  const source=read('traffic-competitors-v453.js');
  expect(source).toContain("const TRAFFIC_KEY='trafficMeasurements'");
  expect(source).toContain("const COMPETITORS_KEY='competitors'");
  expect(source).toContain('data.traffic');
  expect(source).toContain('data.competitor');
  expect(source).not.toContain('delete data.traffic');
  expect(source).not.toContain('delete data.competitor');
});

test('public report supports structured traffic and competitor lists',()=>{
  const source=read('report/traffic-competitors-v453.js');
  expect(source).toContain('trafficMeasurements');
  expect(source).toContain('data.competitors');
  expect(source).toContain('Ближайший прямой конкурент');
});
