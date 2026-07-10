const {test,expect}=require('@playwright/test');

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/';

test('repository build version controls UI when remote metadata is older',async({page})=>{
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

  await page.goto(`${APP}?v=433`,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#versionLabel')).toHaveText('4.3.3',{timeout:15000});
  await page.waitForFunction(()=>window.BOGATKA_BUILD?.remoteIgnored==='4.2.6',null,{timeout:15000});

  const build=await page.evaluate(()=>window.BOGATKA_BUILD);
  expect(build.version).toBe('4.3.3');
  expect(build.versionToken).toBe('433');
  expect(build.remoteIgnored).toBe('4.2.6');

  const generated=await page.evaluate(()=>window.BogatkaVersion.makeAppUrl());
  expect(generated).toContain('?v=433');

  await page.evaluate(()=>{document.getElementById('versionLabel').textContent='4.0.0'});
  await expect(page.locator('#versionLabel')).toHaveText('4.3.3');
});
