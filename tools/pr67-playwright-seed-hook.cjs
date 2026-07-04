const playwright=require('@playwright/test');
const originalLaunch=playwright.chromium.launch.bind(playwright.chromium);
playwright.chromium.launch=async(...launchArgs)=>{
  const browser=await originalLaunch(...launchArgs);
  const originalNewPage=browser.newPage.bind(browser);
  browser.newPage=async(...pageArgs)=>{
    const page=await originalNewPage(...pageArgs);
    const originalGoto=page.goto.bind(page);
    page.goto=async(url,options)=>{
      const response=await originalGoto(url,options);
      if(String(url).includes('noclickafk.github.io/NoClickAFK/bogatka-field-8f3c7d/')){
        try{
          await page.waitForFunction(()=>Boolean(window.BogatkaCardProgressV448?.ready&&window.BogatkaLocationCardCollapseV422?.ready&&document.querySelector('#addLocationBtn')),{timeout:30000});
          if(await page.locator('[data-location-card]:visible').count()===0){
            await page.locator('#addLocationBtn').click();
            await page.locator('#locationTitle').fill('Production verification');
            await page.locator('#locationAddress').fill('Гродно, тестовая локация');
            await page.locator('#locationNote').fill('Изолированная браузерная проверка PR #67');
            await page.locator('#saveLocationBtn').click();
            await page.waitForSelector('[data-location-card]:visible',{timeout:15000});
          }
          const card=page.locator('[data-location-card]:visible').first();
          const quick=card.getByRole('button',{name:/Быстрый чек-лист/}).first();
          if(await quick.count()&&await quick.getAttribute('aria-expanded')!=='true')await quick.click();
          await card.locator('[data-field="listingUrl"]:not([data-stage6-marker-v461])').waitFor({state:'attached',timeout:30000});
          await page.waitForFunction(()=>Boolean(document.querySelector('[data-location-card]:not([hidden]) .location-actions [data-card-recommendation-v448]')),{timeout:15000});
        }catch(error){console.error('SEED_HOOK_ERROR',error)}
      }
      return response;
    };
    return page;
  };
  return browser;
};
