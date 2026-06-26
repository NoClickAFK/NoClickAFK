import { test, expect } from '@playwright/test';
const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=400';
async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaSelectSync&&window.BogatkaCloudStability));
}

test('remote custom selects update visible labels',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async()=>{
    const id=locations[0].id;
    const selects=[
      document.querySelector(`select[data-location="${id}"][data-field="status"]`),
      document.querySelector(`select[data-location="${id}"][data-field="objectType"]`),
      document.querySelector(`select[data-location="${id}"][data-field^="scores."]`),
    ];
    const data=await getLocationData(id);
    for(const select of selects){
      const option=[...select.options].find(item=>item.value)||select.options[0];
      setNested(data,select.dataset.field,option.value);
    }
    await cloudOriginalIdbPut(STORE,data,`location:${id}`);
    await bogatkaRefreshLocationFields(id);
    return selects.map(select=>({
      value:select.value,
      expected:select.selectedOptions[0]?.textContent||'',
      visible:select.nextElementSibling?.querySelector('.premium-select-value')?.textContent||'',
    }));
  });
  for(const item of result){
    expect(item.value).not.toBe('');
    expect(item.visible).toBe(item.expected);
  }
});

test('select changes persist and mark the location dirty',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async()=>{
    const id=locations[0].id;
    cloudWriteState({dirtyLocations:[],dirtyPhotos:[],deletedPhotos:{},knownLocationIds:[id],knownPhotoIds:[]});
    const selects=[
      document.querySelector(`select[data-location="${id}"][data-field="status"]`),
      document.querySelector(`select[data-location="${id}"][data-field="objectType"]`),
      document.querySelector(`select[data-location="${id}"][data-field^="scores."]`),
    ];
    for(const select of selects){
      const option=[...select.options].find(item=>item.value&&item.value!==select.value)||[...select.options].find(item=>item.value);
      select.value=option.value;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,650));
    }
    const stored=await getLocationData(id);
    const state=cloudReadState();
    return {
      dirty:state.dirtyLocations.includes(id),
      values:selects.map(select=>String(getNested(stored,select.dataset.field)||'')),
      labels:selects.map(select=>({
        expected:select.selectedOptions[0]?.textContent||'',
        visible:select.nextElementSibling?.querySelector('.premium-select-value')?.textContent||'',
      })),
    };
  });
  expect(result.dirty).toBe(true);
  for(const value of result.values)expect(value).not.toBe('');
  for(const label of result.labels)expect(label.visible).toBe(label.expected);
});
