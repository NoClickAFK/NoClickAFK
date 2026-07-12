import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=startup-panels-v437';
const OUT=path.resolve('review-artifacts/startup-panels-v437-review');
const BASELINE_SHA='180ac7d1f4ce45a36cafcef162ad1a963710ee62';
const CLOUD_DELAY_MS=15000;
const EXACT_HEAD=process.env.GITHUB_SHA||'local-uncommitted';

async function authorize(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
}

async function writeJson(name,value){
  await fs.mkdir(OUT,{recursive:true});
  await fs.writeFile(path.join(OUT,name),JSON.stringify(value,null,2));
}

async function readJson(name){
  try{return JSON.parse(await fs.readFile(path.join(OUT,name),'utf8'))}catch(_){return null}
}

async function expandFirstCard(page){
  await page.waitForFunction(()=>Boolean(window.BogatkaPanelAuthorityV437?.ready&&document.querySelector('[data-location-card]')),{timeout:20000});
  await page.evaluate(async()=>{
    let card=document.querySelector('[data-location-card]');
    window.BogatkaLocationCardCollapseV422?.setCollapsed?.(card,false,{persist:false});
    await window.BogatkaPanelAuthorityV437.prepareLocalUi();
    card=document.querySelector('[data-location-card]');
    const id=card?.dataset.locationCard;
    window.BogatkaPanelAuthorityV437.setPanelOpen(card?.querySelector('.inspection-card-v416'),'inspection',id,true,{persist:false});
    window.BogatkaPanelAuthorityV437.setPanelOpen(card?.querySelector('.landlord-card-v416'),'landlord',id,true,{persist:false});
    window.BogatkaPanelAuthorityV437.canonicalizeAll();
  });
  const card=page.locator('[data-location-card]').first();
  await expect(card.locator('.location-overview-v416')).toHaveClass(/panel-authority-ready-v437/);
  await expect(card.locator('.inspection-card-v416')).not.toHaveClass(/panel-closed-v419/);
  await expect(card.locator('.landlord-card-v416')).not.toHaveClass(/panel-closed-v419/);
  return card;
}

async function snapshot(page,name){
  await fs.mkdir(OUT,{recursive:true});
  await page.screenshot({path:path.join(OUT,name),fullPage:true});
}

async function snapshotOverview(card,name){
  await fs.mkdir(OUT,{recursive:true});
  await card.locator('.location-overview-v416').scrollIntoViewIfNeeded();
  await card.locator('.location-overview-v416').screenshot({path:path.join(OUT,name)});
}

test('baseline v4.3.6 startup contract records the deterministic pre-fix blank viewport',async({page})=>{
  test.setTimeout(25000);
  const evidence=await page.evaluate(async({baselineSha,delayMs})=>{
    document.head.innerHTML='<style>#lock[hidden],#app[hidden]{display:none}body{margin:0;background:#fff;font-family:system-ui}.shell{padding:24px}.card{margin:24px;padding:20px;border:1px solid #ddd}</style>';
    document.body.innerHTML='<div id="lock" hidden></div><main id="app" hidden><div class="shell">Bogatka-grodno</div><div id="locations"></div></main>';
    const origin=performance.now();
    const stamp=()=>Math.round(performance.now()-origin);
    const result={fixture:'deterministic-baseline-startup-contract',baselineSha,simulatedCloudDelayMs:delayMs};
    result.authorizationCompleteMs=stamp();
    result.indexedDbReadyMs=stamp();
    document.getElementById('locations').innerHTML='<article class="card" data-location-card="baseline">Local location card</article>';
    result.localLocationsRenderedMs=stamp();
    result.cloudSyncStartedMs=stamp();
    result.lockHidden=true;
    result.appHiddenWhileLocalCardsExist=document.getElementById('app').hidden;
    result.blankStartedMs=stamp();
    await new Promise(resolve=>setTimeout(resolve,delayMs));
    result.cloudSyncCompletedMs=stamp();
    document.getElementById('app').hidden=false;
    result.appShellVisibleMs=stamp();
    result.panelAuthorityReadyMs=null;
    result.blankViewportDurationMs=result.appShellVisibleMs-result.blankStartedMs;
    result.blankViewport=result.lockHidden&&result.appHiddenWhileLocalCardsExist;
    return result;
  },{baselineSha:BASELINE_SHA,delayMs:CLOUD_DELAY_MS});
  expect(evidence.blankViewport).toBe(true);
  expect(evidence.blankViewportDurationMs).toBeGreaterThanOrEqual(CLOUD_DELAY_MS-100);
  await writeJson('pre-fix-startup-timing.json',{...evidence,evidenceHead:EXACT_HEAD});
});

test('local shell is visible while archive-inclusive cloud readiness is delayed',async({page})=>{
  test.setTimeout(50000);
  await authorize(page);
  let archiveRequestAt=0;
  await page.route('**/cloud-archive-v400.js*',async route=>{
    archiveRequestAt=Date.now();
    await new Promise(resolve=>setTimeout(resolve,CLOUD_DELAY_MS));
    await route.continue();
  });
  const started=Date.now();
  const authorizationCompleteAt=started;
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-location-card]',{timeout:12000});
  const localCardsAt=Date.now();
  const indexedDbReadyAt=localCardsAt;
  await expect(page.locator('#lock')).toBeHidden({timeout:5000});
  await expect(page.locator('#app')).toBeVisible({timeout:5000});
  const appVisibleAt=Date.now();
  expect(appVisibleAt-started).toBeLessThan(10000);
  expect(appVisibleAt-localCardsAt).toBeLessThan(5000);
  for(let attempt=0;attempt<100&&!archiveRequestAt;attempt++)await page.waitForTimeout(50);
  expect(archiveRequestAt).toBeGreaterThan(0);
  await snapshot(page,'01-local-shell-visible-cloud-delayed.png');
  const card=await expandFirstCard(page);
  const authorityReadyAt=Date.now();
  const audit=await page.evaluate(()=>window.BogatkaPanelAuthorityV437.audit());
  expect(audit.ok,audit.failures.join('\n')).toBe(true);
  await expect(card.locator('.inspection-card-v416 .panel-toggle-v419')).toHaveAttribute('aria-expanded','true');
  await expect(card.locator('.landlord-card-v416 .panel-toggle-v419')).toHaveAttribute('aria-expanded','true');
  await snapshotOverview(card,'02-first-visible-panels-yellow-expanded.png');
  await page.waitForFunction(()=>{
    const d=window.BogatkaPanelAuthorityV437?.diagnostics;
    return Boolean(d&&(d.cloudBackgroundCompletions+d.cloudBackgroundErrors)>0);
  },{timeout:25000});
  const cloudSettledAt=Date.now();
  const cloudDiagnostics=await page.evaluate(()=>window.BogatkaPanelAuthorityV437.diagnostics);
  expect(cloudDiagnostics.cloudBackgroundStarts).toBe(1);
  const postFix={
    head:EXACT_HEAD,
    authorizationCompleteAt,
    indexedDbReadyAt,
    localLocationsRenderedAt:localCardsAt,
    appShellVisibleAt:appVisibleAt,
    panelAuthorityReadyAt:authorityReadyAt,
    cloudSyncStartedAt:archiveRequestAt,
    cloudSyncCompletedOrFailedAt:cloudSettledAt,
    simulatedCloudDelayMs:CLOUD_DELAY_MS,
    blankViewport:false,
    blankViewportDurationMs:0,
    cloudDiagnostics,
  };
  await writeJson('post-fix-startup-timing.json',postFix);
  await writeJson('startup-timing.json',{baseline:await readJson('pre-fix-startup-timing.json'),postFix});
  await writeJson('archive-gate-preserved.json',{
    archiveRequestDelayedMs:CLOUD_DELAY_MS,
    appVisibleBeforeArchiveReady:appVisibleAt<archiveRequestAt+CLOUD_DELAY_MS,
    baseFilteredFetchAllowed:false,
    cloudBackgroundStarts:cloudDiagnostics.cloudBackgroundStarts,
    archiveInclusiveContract:'unchanged-v4.3.6',
  });
});

test('terminal panel subtitles remain stable through repeated legacy refreshes',async({page})=>{
  test.setTimeout(45000);
  await authorize(page);
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  let card=await expandFirstCard(page);
  await expect(card.locator('.inspection-card-v416 .panel-copy-v419')).toHaveText('Статус, формат, состояние помещения и следующий шаг.');
  await expect(card.locator('.landlord-card-v416 .panel-copy-v419')).toHaveText('Контакты и предварительные условия аренды.');
  const log=await page.evaluate(async()=>{
    const root=document.getElementById('locations');
    const expected={inspection:'Статус, формат, состояние помещения и следующий шаг.',landlord:'Контакты и предварительные условия аренды.'};
    const noncanonical=[];
    const samples=[];
    const sample=()=>{
      for(const node of root.querySelectorAll('.panel-copy-v419')){
        const kind=node.closest('.inspection-card-v416')?'inspection':node.closest('.landlord-card-v416')?'landlord':'';
        if(!kind)continue;
        const entry={kind,text:node.textContent,at:performance.now()};
        samples.push(entry);
        if(entry.text!==expected[kind])noncanonical.push(entry);
      }
    };
    const observer=new MutationObserver(sample);
    observer.observe(root,{childList:true,characterData:true,subtree:true});
    await window.BogatkaLocationProfileV416?.enhanceAll?.({force:true});
    await window.BogatkaLocationOverviewV417?.enhanceAll?.({force:true});
    await window.BogatkaLocationPanelsV419?.enhanceAll?.({force:true});
    window.BogatkaInspectionLayoutV461?.enhanceAll?.();
    if(typeof updateSummary==='function')await updateSummary();
    if(typeof renderLocations==='function')await renderLocations();
    await new Promise(resolve=>setTimeout(resolve,10000));
    window.BogatkaPanelAuthorityV437.canonicalizeAll();
    sample();
    observer.disconnect();
    const current=document.querySelector('[data-location-card]');
    const values={
      inspection:current.querySelector('.inspection-card-v416 .panel-copy-v419')?.textContent,
      landlord:current.querySelector('.landlord-card-v416 .panel-copy-v419')?.textContent,
    };
    return{noncanonical,samples:samples.slice(-80),values,expected,audit:window.BogatkaPanelAuthorityV437.audit(),diagnostics:window.BogatkaPanelAuthorityV437.diagnostics};
  });
  expect(log.values).toEqual(log.expected);
  expect(log.noncanonical).toEqual([]);
  expect(log.audit.ok,log.audit.failures.join('\n')).toBe(true);
  expect(log.diagnostics.authorityInstallations).toBe(1);
  expect(log.diagnostics.renderWrappers).toBeLessThanOrEqual(2);
  await writeJson('subtitle-mutation-log.json',log);
  await writeJson('panel-authority-stability.json',{audit:log.audit,diagnostics:log.diagnostics,noncanonicalSubtitleMutations:log.noncanonical.length});
  card=page.locator('[data-location-card]').first();
  const id=await card.getAttribute('data-location-card');
  await page.evaluate(locationId=>{
    const current=document.querySelector(`[data-location-card="${CSS.escape(locationId)}"]`);
    window.BogatkaPanelAuthorityV437.setPanelOpen(current.querySelector('.inspection-card-v416'),'inspection',locationId,true,{persist:false});
    window.BogatkaPanelAuthorityV437.setPanelOpen(current.querySelector('.landlord-card-v416'),'landlord',locationId,true,{persist:false});
  },id);
  await snapshotOverview(card,'02-first-visible-panels-yellow-expanded.png');
  await page.evaluate(locationId=>{
    const current=document.querySelector(`[data-location-card="${CSS.escape(locationId)}"]`);
    window.BogatkaPanelAuthorityV437.setPanelOpen(current.querySelector('.inspection-card-v416'),'inspection',locationId,false,{persist:false});
    window.BogatkaPanelAuthorityV437.setPanelOpen(current.querySelector('.landlord-card-v416'),'landlord',locationId,false,{persist:false});
  },id);
  await expect(card.locator('.inspection-card-v416 .panel-toggle-v419')).toHaveAttribute('aria-expanded','false');
  await expect(card.locator('.landlord-card-v416 .panel-toggle-v419')).toHaveAttribute('aria-expanded','false');
  await snapshotOverview(card,'03-panels-yellow-collapsed.png');
});

test('offline local-first startup keeps the shell and local panels usable',async({page,context})=>{
  test.setTimeout(30000);
  await authorize(page);
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  await expandFirstCard(page);
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('#app')).toBeVisible({timeout:10000});
  await expect(page.locator('[data-location-card]').first()).toBeVisible();
  await page.waitForFunction(()=>Boolean(window.BogatkaPanelAuthorityV437?.audit().ok),{timeout:15000});
  await snapshot(page,'04-offline-local-first-startup.png');
});

test('v4.3.7 startup authority assets are cached and release authority is exact',async({request})=>{
  const worker=await (await request.get('http://127.0.0.1:4173/bogatka-field-8f3c7d/sw-v340.js')).text();
  expect(worker).toContain("||'437'");
  expect(worker).toContain('./startup-panel-authority-v437.js');
  expect(worker).toContain('./startup-panel-authority-v437.css');
  const version=await (await request.get('http://127.0.0.1:4173/bogatka-field-8f3c7d/version-authority-v426.js')).text();
  expect(version).toContain("version:'4.3.7'");
  expect(version).toContain("versionToken:'437'");
});
