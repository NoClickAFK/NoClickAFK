function loadBogatkaPatch(tagName,attributes){
  const marker=attributes.src||attributes.href;
  if(marker&&document.querySelector(`${tagName}[src="${marker}"],${tagName}[href="${marker}"]`))return;
  const element=document.createElement(tagName);
  Object.entries(attributes).forEach(([key,value])=>element.setAttribute(key,value));
  document.head.appendChild(element);
}

function applyVersion23Enhancements(){
  const versionLabel=document.getElementById('versionLabel');
  if(versionLabel)versionLabel.textContent=typeof APP_VERSION==='string'?APP_VERSION:'3.0.0';

  loadBogatkaPatch('link',{rel:'stylesheet',href:'./auth-v31.css'});
  loadBogatkaPatch('script',{src:'./auth-v31.js'});
  loadBogatkaPatch('script',{src:'./auth-signup-fix-v31.js'});

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
