const {test,expect}=require('@playwright/test');

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/';

test('repository build version controls UI when remote metadata is older',async({page})=>{
  const diagnostics=[];
  page.on('pageerror',error=>diagnostics.push(`pageerror: ${error?.stack||error}`));
  page.on('console',message=>{if(['error','warning'].includes(message.type()))diagnostics.push(`console.${message.type()}: ${message.text()}`)});
  await page.route('**/functions/v1/bogatka-version',async route=>{
    await route.fulfill({
      status:200,
      contentType:'application/json',
      body:JSON.stringify({
        version:'4.2.6',
        versionToken:'426',
        sourceCommit:'abcdef1234567890abcdef1234567890abcdef12',
        ahead:1,
        baseVersion:'4.2.5',
        resolvedAt:'2026-06-28T18:00:00.000Z',
      }),
    });
  });

  await page.addInitScript(()=>{
    localStorage.setItem('bogatka_access_authorized_v1','1');
    localStorage.removeItem('bogatka_build_meta_v426');
  });

  await page.goto(`${APP}?v=436`,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(5000);
  const initial=await page.evaluate(()=>({
    label:document.getElementById('versionLabel')?.textContent||'',
    build:window.BOGATKA_BUILD||null,
    versionApi:Boolean(window.BogatkaVersion),
    accessVersionLoaded:[...document.scripts].some(script=>script.src.includes('access-version-v400.js')),
  }));
  expect(initial,diagnostics.join('\n')).toMatchObject({
    label:'4.3.6',
    versionApi:true,
    accessVersionLoaded:true,
    build:{version:'4.3.6',versionToken:'436',remoteIgnored:'4.2.6',sourceCommit:'68e2d77d77a74176ae36ceff55cab122e57201e6'},
  });

  const generated=await page.evaluate(()=>window.BogatkaVersion.makeAppUrl());
  expect(generated).toContain('?v=436');

  await page.evaluate(()=>{document.getElementById('versionLabel').textContent='4.0.0'});
  await expect(page.locator('#versionLabel')).toHaveText('4.3.6');
});