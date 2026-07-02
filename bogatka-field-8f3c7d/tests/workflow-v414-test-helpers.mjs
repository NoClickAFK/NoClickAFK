export const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=458';

export async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaWorkflowV414?.ready&&
    window.BogatkaWorkflowRefineV440?.ready&&
    window.BogatkaSuiteSaveOrderV452?.ready&&
    document.querySelector('[data-location-card] .structured-notes-v414')
  ));
  await page.evaluate(()=>window.BogatkaSuiteSaveOrderV452.finalizeWorkflowUi());
  await page.waitForFunction(()=>{
    const card=document.querySelector('[data-location-card]');
    const form=card?.querySelector('.task-form-v400');
    const help=card?.querySelector('.task-form-help-v414');
    const examples=card?.querySelector('.task-examples-v414');
    const comments=card?.querySelector('.structured-notes-head-v414');
    if(!form||!help||!examples||!comments)return false;
    const children=[...form.parentElement.children];
    return help.dataset.collaborationIntroV445==='1'&&
      comments.dataset.collaborationIntroV445==='1'&&
      children.indexOf(examples)===children.indexOf(help)+1&&
      children.indexOf(form)===children.indexOf(help)+2;
  });
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
