function loadBogatkaPatch(tagName,attributes){
  const marker=attributes.src||attributes.href;
  if(marker&&document.querySelector(`${tagName}[src="${marker}"],${tagName}[href="${marker}"]`))return;
  const element=document.createElement(tagName);
  if(tagName==='script')element.async=false;
  Object.entries(attributes).forEach(([key,value])=>element.setAttribute(key,value));
  document.head.appendChild(element);
}

function redirectLegacyRecovery(){
  const query=new URLSearchParams(location.search);
  const recovery=location.hash.includes('type=recovery')||query.get('auth')==='recovery';
  if(!recovery)return false;
  const target=new URL('./reset/',location.href);
  target.hash=location.hash;
  if(query.get('code'))target.searchParams.set('code',query.get('code'));
  location.replace(target.href);
  return true;
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
  if(redirectLegacyRecovery())return;
  const versionLabel=document.getElementById('versionLabel');
  if(versionLabel)versionLabel.textContent='4.0.0';
  upgradeAccessScreen();

  loadBogatkaPatch('link',{rel:'stylesheet',href:'./auth-v31.css'});
  loadBogatkaPatch('link',{rel:'stylesheet',href:'./members-v32.css'});
  loadBogatkaPatch('link',{rel:'stylesheet',href:'./stability-v33.css'});
  loadBogatkaPatch('link',{rel:'stylesheet',href:'./polish-v34.css'});
  loadBogatkaPatch('link',{rel:'stylesheet',href:'./insights-v331.css'});
  loadBogatkaPatch('link',{rel:'stylesheet',href:'./compare-v332.css'});
  loadBogatkaPatch('link',{rel:'stylesheet',href:'./decision-v340.css'});
  loadBogatkaPatch('link',{rel:'stylesheet',href:'./compare-v340.css'});
  loadBogatkaPatch('link',{rel:'stylesheet',href:'./suite-v400.css'});
  loadBogatkaPatch('script',{src:'./auth-v31.js'});
  loadBogatkaPatch('script',{src:'./auth-signup-fix-v31.js'});
  loadBogatkaPatch('script',{src:'./members-v32.js'});
  loadBogatkaPatch('script',{src:'./stability-v33.js'});
  loadBogatkaPatch('script',{src:'./stability-v331.js'});
  loadBogatkaPatch('script',{src:'./polish-v34.js'});
  loadBogatkaPatch('script',{src:'./account-v34.js'});
  loadBogatkaPatch('script',{src:'./insights-v331.js'});
  loadBogatkaPatch('script',{src:'./version-guard-v340.js'});
  loadBogatkaPatch('script',{src:'./decision-core-v340.js'});
  loadBogatkaPatch('script',{src:'./suite-core-v400.js'});
  loadBogatkaPatch('script',{src:'./decision-ui-v340.js'});
  loadBogatkaPatch('script',{src:'./compare-v340.js'});
  loadBogatkaPatch('script',{src:'./suite-ui-v400.js'});
  loadBogatkaPatch('script',{src:'./report-v400.js'});

  document.addEventListener('keydown',event=>{
    const target=event.target;
    if(event.key!=='Enter')return;
    if(!(target instanceof HTMLInputElement))return;
    if(['checkbox','radio','file','button','submit'].includes(target.type))return;
    if(target.closest('#cloudAuthForm,#cloudInviteForm,#bogatkaRecoveryForm'))return;
    event.preventDefault();
    target.blur();
  });
}

window.addEventListener('load',applyVersion23Enhancements);
