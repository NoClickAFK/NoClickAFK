function loadBogatkaPatch(tagName,attributes){
  const marker=attributes.src||attributes.href;
  if(marker&&document.querySelector(`${tagName}[src="${marker}"],${tagName}[href="${marker}"]`))return;
  const element=document.createElement(tagName);
  Object.entries(attributes).forEach(([key,value])=>element.setAttribute(key,value));
  document.head.appendChild(element);
}

function upgradeAccessScreen(){
  const card=document.querySelector('#lock .lock-card');
  if(!card||card.querySelector('.lock-help'))return;
  const paragraph=card.querySelector('p');
  if(paragraph)paragraph.textContent='Доступ к рабочему чек-листу защищён. При первом запуске откройте исходную ссылку доступа или введите шестизначный код.';
  const help=document.createElement('div');
  help.className='lock-help';
  help.innerHTML='<span>🔐</span><div><strong>Код вводится один раз на каждом новом устройстве.</strong><br>После успешного входа приложение запомнит устройство до очистки данных браузера.</div>';
  paragraph?.insertAdjacentElement('afterend',help);
  const input=document.querySelector('#accessPin');
  if(input){input.placeholder='Введите 6 цифр';input.setAttribute('aria-label','Шестизначный код доступа')}
}

function applyVersion23Enhancements(){
  if(location.hash.includes('type=recovery')||new URLSearchParams(location.search).get('auth')==='recovery')sessionStorage.setItem('bogatka_password_recovery_pending','1');
  const versionLabel=document.getElementById('versionLabel');
  if(versionLabel)versionLabel.textContent=typeof APP_VERSION==='string'?APP_VERSION:'3.0.0';
  upgradeAccessScreen();

  loadBogatkaPatch('link',{rel:'stylesheet',href:'./auth-v31.css'});
  loadBogatkaPatch('script',{src:'./auth-v31.js'});
  loadBogatkaPatch('script',{src:'./auth-signup-fix-v31.js'});
  loadBogatkaPatch('script',{src:'./recovery-v31.js'});

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
