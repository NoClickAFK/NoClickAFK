function applyVersion23Enhancements(){
  const versionLabel=document.getElementById('versionLabel');
  if(versionLabel)versionLabel.textContent='2.3.0';

  document.addEventListener('keydown',event=>{
    const target=event.target;
    if(event.key!=='Enter')return;
    if(!(target instanceof HTMLInputElement))return;
    if(['checkbox','radio','file','button','submit'].includes(target.type))return;
    event.preventDefault();
    target.blur();
  });
}

window.addEventListener('load',applyVersion23Enhancements);
