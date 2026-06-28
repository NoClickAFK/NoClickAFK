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

function installSyncIntegrityGate(){
  if(window.__bogatkaSyncIntegrityGateV412||typeof cloudInit!=='function')return;
  window.__bogatkaSyncIntegrityGateV412=true;
  const baseCloudInit=cloudInit;
  cloudInit=async function gatedCloudInit(){
    for(let attempt=0;attempt<300;attempt++){
      if(window.BogatkaSyncIntegrity?.ready&&window.BogatkaSyncCompatibility?.ready&&window.BogatkaSyncFieldCompatV416?.ready)return baseCloudInit();
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    throw new Error('Не загрузился модуль безопасной синхронизации. Выполните полное обновление страницы.');
  };
  window.cloudInit=cloudInit;
}

function ensureWorkflowEnhancements(){
  const run=()=>{
    const result=window.BogatkaWorkflowV414?.enhanceAll?.();
    if(result?.catch)result.catch(console.error);
  };
  [250,700,1500,3000].forEach(delay=>setTimeout(run,delay));
}

function applyVersion23Enhancements(){
  if(redirectLegacyRecovery())return;
  const versionLabel=document.getElementById('versionLabel');
  if(versionLabel)versionLabel.textContent='4.0.0';
  const accessButton=document.getElementById('shareAccessBtn');
  if(accessButton)accessButton.textContent='Пригласить участника';
  upgradeAccessScreen();
  installSyncIntegrityGate();

  loadBogatkaPatch('link',{rel:'stylesheet',href:'./auth-v31.css'});
  loadBogatkaPatch('link',{rel:'stylesheet',href:'./members-v32.css'});
  loadBogatkaPatch('link',{rel:'stylesheet',href:'./stability-v33.css'});
  loadBogatkaPatch('link',{rel:'stylesheet',href:'./polish-v34.css'});
  loadBogatkaPatch('link',{rel:'stylesheet',href:'./insights-v331.css'});
  loadBogatkaPatch('link',{rel:'stylesheet',href:'./compare-v332.css'});
  loadBogatkaPatch('link',{rel:'stylesheet',href:'./decision-v340.css'});
  loadBogatkaPatch('link',{rel:'stylesheet',href:'./compare-v340.css'});
  loadBogatkaPatch('link',{rel:'stylesheet',href:'./suite-v400.css'});
  loadBogatkaPatch('link',{rel:'stylesheet',href:'./visual-v411.css'});
  loadBogatkaPatch('link',{rel:'stylesheet',href:'./decision-panel-v412.css'});
  loadBogatkaPatch('link',{rel:'stylesheet',href:'./workflow-v414.css'});
  loadBogatkaPatch('link',{rel:'stylesheet',href:'./workflow-fixes-v415.css'});
  loadBogatkaPatch('link',{rel:'stylesheet',href:'./location-profile-v416.css'});
  loadBogatkaPatch('link',{rel:'stylesheet',href:'./location-overview-v417.css'});
  loadBogatkaPatch('link',{rel:'stylesheet',href:'./location-panels-v419.css'});
  loadBogatkaPatch('link',{rel:'stylesheet',href:'./location-card-collapse-v422.css'});
  loadBogatkaPatch('script',{src:'./auth-v31.js'});
  loadBogatkaPatch('script',{src:'./auth-signup-fix-v31.js'});
  loadBogatkaPatch('script',{src:'./members-v32.js'});
  loadBogatkaPatch('script',{src:'./invites-v408.js'});
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
  loadBogatkaPatch('script',{src:'./archive-label-v400.js'});
  loadBogatkaPatch('script',{src:'./backup-v400.js'});
  loadBogatkaPatch('script',{src:'./report-v400.js'});
  loadBogatkaPatch('script',{src:'./access-version-v400.js'});
  loadBogatkaPatch('script',{src:'./visual-v411.js'});
  loadBogatkaPatch('script',{src:'./decision-panel-v412.js'});
  loadBogatkaPatch('script',{src:'./workflow-v414.js'});
  loadBogatkaPatch('script',{src:'./workflow-fixes-v415.js'});
  loadBogatkaPatch('script',{src:'./score-guide-fix-v415.js'});
  loadBogatkaPatch('script',{src:'./sync-field-compat-v416.js'});
  loadBogatkaPatch('script',{src:'./field-integrity-v416.js'});
  loadBogatkaPatch('script',{src:'./object-type-normalize-v416.js'});
  loadBogatkaPatch('script',{src:'./location-profile-v416.js'});
  loadBogatkaPatch('script',{src:'./location-overview-v417.js'});
  loadBogatkaPatch('script',{src:'./location-overview-init-v417.js'});
  loadBogatkaPatch('script',{src:'./location-panels-v419.js'});
  loadBogatkaPatch('script',{src:'./location-panels-render-v419.js'});
  loadBogatkaPatch('script',{src:'./location-card-collapse-v422.js'});
  ensureWorkflowEnhancements();

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

loadBogatkaPatch('link',{rel:'stylesheet',href:'./location-card-collapse-v422.css'});
loadBogatkaPatch('script',{src:'./location-card-collapse-v422.js'});
window.addEventListener('load',applyVersion23Enhancements);
