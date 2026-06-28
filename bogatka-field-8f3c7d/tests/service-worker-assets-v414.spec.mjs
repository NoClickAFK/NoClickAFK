import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test('v423 service worker asset list is unique and complete',()=>{
  const source=fs.readFileSync(path.resolve('bogatka-field-8f3c7d/sw-v340.js'),'utf8');
  const start=source.indexOf('const CORE_ASSETS=[');
  const list=source.slice(start,source.indexOf('];',start));
  const assets=[...list.matchAll(/'([^']+)'/g)].map(match=>match[1]);
  expect(new Set(assets).size).toBe(assets.length);
  expect(source).toContain("CACHE_NAME='bogatka-location-v423'");
  for(const asset of ['./workflow-v414.js','./workflow-v414.css','./location-panels-v419.js','./location-panels-render-v419.js','./location-panels-v419.css','./location-global-v421.js','./location-global-v421.css','./location-card-collapse-v422.js','./location-card-collapse-v422.css']){
    expect(assets).toContain(asset);
  }
});
