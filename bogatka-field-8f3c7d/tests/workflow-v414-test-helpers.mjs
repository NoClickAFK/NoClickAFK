export const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=446';

export async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaWorkflowV414?.ready&&
    window.BogatkaWorkflowRefineV440?.ready&&
    document.querySelector('[data-location-card] .structured-notes-v414')
  ));
  return page.locator('[data-location-card]').first();
}

export async function openPane(page,name){
  await page.evaluate(target=>{
    const card=document.querySelector('[data-location-card]');
    const details=card?.querySelector('.collaboration-v400');
    if(details)details.open=true;
    const button=card?.querySelector(`[data-collab-tab="${target}"]`);
    if(button&&!button.classList.contains('active'))button.click();
  },name);
}
