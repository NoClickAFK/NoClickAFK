import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test('v414 service worker asset list is unique and complete',()=>{
  const source=fs.readFileSync(path.resolve('bogatka-field-8f3c7d/sw-v340.js'),'utf8');
  const list=source.slice(source.indexOf('const CORE_ASSETS=['),source.indexOf('];',source.indexOf('const CORE_ASSETS=[')));
  const assets=[...list.matchAll(/'([^']+)'/g)].map(match=>match[1]);
  expect(new Set(assets).size).toBe(assets.length);
  expect(source).toContain("CACHE_NAME='bogatka-location-v414'");
  expect(assets).toContain('./workflow-v414.js');
  expect(assets).toContain('./workflow-v414.css');
});
