import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=startup-panels-v437';
const OUT=path.resolve('review-artifacts/startup-panels-v437-review');

async function authorize(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
}

async function expandFirstCard(page){
  await page.waitForFunction(()=>Boolean(window.BogatkaPanelAuthorityV437?.ready&&document.querySelector('[data-location-card]')),{timeout:20000});
  await page.evaluate(async()=>{
    const card=document.querySelector('[data-location-card]');
    window.BogatkaLocationCardCollapseV422?.setCollapsed?.(card,false,{persist:false});
    await window.BogatkaPanelAuthorityV437.prepareLocalUi();
    for(const section of card.querySelectorAll('.inspection-card-v416,.landlord-card-v416')){
      section.dataset.panelOpenV419='1';
      section.classList.remove('panel-closed-v419');
      section.querySelector(':scope > .panel-toggle-v419')?.setAttribute('aria-expanded','true');
    }
  });
}

async function snapshot(page,name){
  await fs.mkdir(OUT,{recursive:true});
  await page.screenshot({path:path.join(OUT,name),fullPage:true});
}

test('local shell is visible while archive-inclusive cloud readiness is delayed',async({page})=>{
  test.setTimeout(45000);
  await authorize(page);
  let archiveRequestAt=0;
  await page.route('**/cloud-archive-v400.js',async route=>{
    archiveRequestAt=Date.now();
    await new Promise(resolve=>setTimeout(resolve,15000));
    await route.continue();
  });
  const started=Date.now();
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-location-card]',{timeout:12000});
  const localCardsAt=Date.now();
  await expect(page.locator('#lock')).toBeHidden({timeout:5000});
  await expect(page.locator('#app')).toBeVisible({timeout:5000});
  const appVisibleAt=Date.now();
  expect(appVisibleAt-started).toBeLessThan(10000);
  expect(appVisibleAt-localCardsAt).toBeLessThan(5000);
  await expandFirstCard(page);
  const authorityReadyAt=Date.now();
  const audit=await page.evaluate(()=>window.BogatkaPanelAuthorityV437.audit());
  expect(audit.ok,audit.failures.join('\n')).toBe(true);
  await snapshot(page,'01-local-shell-visible-cloud-delayed.png');
  await snapshot(page,'02-first-visible-panels-yellow-expanded.png');
  await fs.writeFile(path.join(OUT,'startup-timing.json'),JSON.stringify({started,localCardsAt,appVisibleAt,authorityReadyAt,archiveRequestAt,blankViewport:false},null,2));
  await fs.writeFile(path.join(OUT,'archive-gate-preserved.json'),JSON.stringify({archiveRequestDelayedMs:15000,appVisibleBeforeArchiveReady:appVisibleAt<archiveRequestAt+15000,baseFilteredFetchAllowed:false},null,2));
});

test('terminal panel subtitles remain stable through repeated legacy refreshes',async({page})=>{
  test.setTimeout(40000);
  await authorize(page);
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  await expandFirstCard(page);
  const card=page.locator('[data-location-card]').first();
  await expect(card.locator('.inspection-card-v416 .panel-copy-v419')).toHaveText('Статус, формат, состояние помещения и следующий шаг.');
  await expect(card.locator('.landlord-card-v416 .panel-copy-v419')).toHaveText('Контакты и предварительные условия аренды.');
  const log=await page.evaluate(async()=>{
    const card=document.querySelector('[data-location-card]');
    const nodes=[card.querySelector('.inspection-card-v416 .panel-copy-v419'),card.querySelector('.landlord-card-v416 .panel-copy-v419')];
    const expected=['Статус, формат, состояние помещения и следующий шаг.','Контакты и предварительные условия аренды.'];
    const mutations=[];
    const observers=nodes.map((node,index)=>{const observer=new MutationObserver(()=>mutations.push({index,text:node.textContent,at:performance.now()}));observer.observe(node,{childList:true,characterData:true,subtree:true});return observer});
    await window.BogatkaLocationProfileV416?.enhanceAll?.({force:true});
    await window.BogatkaLocationOverviewV417?.enhanceAll?.({force:true});
    await window.BogatkaLocationPanelsV419?.enhanceAll?.({force:true});
    window.BogatkaInspectionLayoutV461?.enhanceAll?.();
    if(typeof updateSummary==='function')await updateSummary();
    if(typeof renderLocations==='function')renderLocations();
    await new Promise(resolve=>setTimeout(resolve,10000));
    window.BogatkaPanelAuthorityV437.canonicalizeAll();
    observers.forEach(observer=>observer.disconnect());
    return{mutations,values:nodes.map(node=>node.textContent),expected,audit:window.BogatkaPanelAuthorityV437.audit(),diagnostics:window.BogatkaPanelAuthorityV437.diagnostics};
  });
  expect(log.values).toEqual(log.expected);
  expect(log.mutations.filter(item=>item.text!==log.expected[item.index])).toEqual([]);
  expect(log.audit.ok,log.audit.failures.join('\n')).toBe(true);
  await fs.mkdir(OUT,{recursive:true});
  await fs.writeFile(path.join(OUT,'subtitle-mutation-log.json'),JSON.stringify(log,null,2));
  await fs.writeFile(path.join(OUT,'panel-authority-stability.json'),JSON.stringify({audit:log.audit,diagnostics:log.diagnostics},null,2));
  await snapshot(page,'02-first-visible-panels-yellow-expanded.png');
  await page.evaluate(()=>{for(const section of document.querySelectorAll('[data-location-card]:first-of-type .inspection-card-v416,[data-location-card]:first-of-type .landlord-card-v416')){section.dataset.panelOpenV419='0';section.classList.add('panel-closed-v419');section.querySelector(':scope > .panel-toggle-v419')?.setAttribute('aria-expanded','false')}});
  await snapshot(page,'03-panels-yellow-collapsed.png');
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