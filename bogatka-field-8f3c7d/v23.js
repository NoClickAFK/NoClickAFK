const BOGATKA_STATIC_STYLE_MANIFEST=Object.freeze([
  'polish-v34.css','insights-v331.css','compare-v332.css','decision-v340.css','critical-deal-v430.css','compare-v340.css','suite-v400.css','visual-v411.css',
  'decision-panel-v412.css','workflow-v414.css','workflow-fixes-v415.css','workflow-refine-v440.css','location-profile-v416.css','location-overview-v417.css',
  'location-panels-v419.css','location-card-collapse-v422.css','status-next-task-v447.css','card-progress-v448.css','quick-checklist-v451.css','location-data-v452.css',
  'traffic-competitors-v453.css','launch-gate-v454.css','opening-project-v455.css',
]);
const BOGATKA_VISIBLE_VERSION='4.3.4';

function verifyStaticStylesheetManifest(){
  const loaded=new Set([...document.head.querySelectorAll('link[rel="stylesheet"]')].map(link=>new URL(link.href,location.href).pathname.split('/').pop()));
  const missing=BOGATKA_STATIC_STYLE_MANIFEST.filter(file=>!loaded.has(file));
  if(missing.length)console.error(`Не загружены статические стили: ${missing.join(', ')}`);
  return missing.length===0;
}

function loadBogatkaPatch(tagName,attributes){
  const marker=attributes.src||attributes.href;
  if(marker&&document.querySelector(`${tagName}[src="${marker}"],${tagName}[href="${marker}"]`))return;
  if(tagName==='link'&&attributes.rel==='stylesheet'){
    console.error(`Активный stylesheet должен быть объявлен статически в index.html: ${marker||'unknown'}`);
    return;
  }
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

function installLegacyRentMigrationV425(){
  if(window.__bogatkaLegacyRentMigrationV425||typeof getLocationData!=='function'||typeof idbPut!=='function')return;
  window.__bogatkaLegacyRentMigrationV425=true;
  const baseGetLocationData=window.getLocationData||getLocationData;
  const wrapped=async function migratedGetLocationData(id){
    const data=await baseGetLocationData(id);
    const legacy=String(data?.rent??'').trim();
    if(!legacy)return data;
    const compact=legacy.replace(/\s+/g,'').replace(',','.');
    const amount=compact.match(/\d+(?:\.\d+)?/)?.[0]||'';
    const numericOnly=/^\s*\d[\d\s]*(?:[.,]\d+)?\s*(?:BYN|бел\.?\s*руб\.?|руб\.?|р\.?)?\s*$/i.test(legacy);
    const next={...data,tech:{...(data.tech||{})},migrations:{...(data.migrations||{})}};
    if(amount&&!String(next.tech.rentPerMonth??'').trim())next.tech.rentPerMonth=amount;
    if(!numericOnly){
      const note=`Аренда: ${legacy}`;
      const current=String(next.rentConditions||'').trim();
      if(!current)next.rentConditions=note;
      else if(!current.includes(legacy))next.rentConditions=`${current}\n${note}`;
    }
    next.rent='';
    next.migrations.rentToTechV425=true;
    next.updatedAt=new Date().toISOString();
    await idbPut(STORE,next,`location:${id}`);
    return next;
  };
  wrapped.__legacyRentMigrationV425=true;
  wrapped.__base=baseGetLocationData;
  window.getLocationData=wrapped;
  try{getLocationData=wrapped}catch(_){}
}

function ensureWorkflowEnhancements(){
  const run=()=>{
    const result=window.BogatkaWorkflowV414?.enhanceAll?.();
    if(result?.catch)result.catch(console.error);
  };
  [250,700,1500,3000].forEach(delay=>setTimeout(run,delay));
}

function installFreshEditorSelectionV463(){
  if(window.__bogatkaFreshEditorSelectionV463)return;
  window.__bogatkaFreshEditorSelectionV463=true;
  const selector='[data-location][data-field],[data-global]';
  const states=new WeakMap();
  const capture=(control,focused=document.activeElement===control)=>{
    if(!control?.matches?.(selector))return;
    states.set(control,{value:'value' in control?String(control.value??''):'',start:typeof control.selectionStart==='number'?control.selectionStart:null,end:typeof control.selectionEnd==='number'?control.selectionEnd:null,direction:control.selectionDirection||'none',focused:Boolean(focused)});
  };
  const root=document.getElementById('locations')||document.body;
  root.addEventListener('input',event=>capture(event.target,true),true);
  root.addEventListener('change',event=>capture(event.target,document.activeElement===event.target),true);
  root.addEventListener('blur',event=>capture(event.target,false),true);
  let attempts=0;
  const wrap=()=>{
    attempts+=1;
    const current=window.updateSummary||((typeof updateSummary==='function')?updateSummary:null);
    if(typeof current!=='function'){
      if(attempts<120)setTimeout(wrap,80);
      return;
    }
    if(current.__freshEditorSelectionV463)return;
    const wrapped=async function(...args){
      const node=document.activeElement?.matches?.(selector)?document.activeElement:null;
      if(node&&!states.has(node))capture(node,true);
      try{return await current.apply(this,args)}finally{
        const latest=node&&states.get(node);
        if(!latest?.focused||!node.isConnected||node.disabled)return;
        if('value' in node&&String(node.value??'')!==latest.value)return;
        const active=document.activeElement;
        if(active!==node&&active!==document.body&&active!==document.documentElement)return;
        if(active!==node)node.focus({preventScroll:true});
        if(latest.start!==null&&typeof node.setSelectionRange==='function'){
          try{node.setSelectionRange(latest.start,latest.end,latest.direction)}catch(_){ }
        }
      }
    };
    Object.assign(wrapped,current);
    wrapped.__freshEditorSelectionV463=true;
    wrapped.__base=current;
    window.updateSummary=wrapped;
    try{updateSummary=wrapped}catch(_){}
  };
  wrap();
  [100,400,1000,2500].forEach(delay=>setTimeout(wrap,delay));
}

function applyVersion23Enhancements(){
  if(redirectLegacyRecovery())return;
  verifyStaticStylesheetManifest();
  const versionLabel=document.getElementById('versionLabel');
  if(versionLabel)versionLabel.textContent=BOGATKA_VISIBLE_VERSION;
  const accessButton=document.getElementById('shareAccessBtn');
  if(accessButton)accessButton.textContent='Пригласить участника';
  upgradeAccessScreen();
  installSyncIntegrityGate();
  installLegacyRentMigrationV425();
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
  loadBogatkaPatch('script',{src:'./critical-deal-schema-v430.js'});
  loadBogatkaPatch('script',{src:'./decision-core-v340.js'});
  loadBogatkaPatch('script',{src:'./suite-core-v400.js'});
  loadBogatkaPatch('script',{src:'./decision-ui-v340.js'});
  loadBogatkaPatch('script',{src:'./compare-v430.js'});
  loadBogatkaPatch('script',{src:'./suite-ui-v400.js'});
  loadBogatkaPatch('script',{src:'./archive-label-v400.js'});
  loadBogatkaPatch('script',{src:'./backup-v400.js'});
  loadBogatkaPatch('script',{src:'./report-v400.js'});
  loadBogatkaPatch('script',{src:'./access-version-v400.js'});
  loadBogatkaPatch('script',{src:'./visual-v411.js'});
  loadBogatkaPatch('script',{src:'./decision-panel-v412.js'});
  loadBogatkaPatch('script',{src:'./workflow-v414.js'});
  loadBogatkaPatch('script',{src:'./workflow-fixes-v415.js'});
  loadBogatkaPatch('script',{src:'./workflow-refine-v440.js'});
  loadBogatkaPatch('script',{src:'./score-guide-fix-v415.js'});
  loadBogatkaPatch('script',{src:'./sync-field-compat-v416.js'});
  loadBogatkaPatch('script',{src:'./field-integrity-v416.js'});
  loadBogatkaPatch('script',{src:'./object-type-normalize-v416.js'});
  loadBogatkaPatch('script',{src:'./location-profile-v416.js'});
  loadBogatkaPatch('script',{src:'./location-evaluation-refine-v446.js'});
  loadBogatkaPatch('script',{src:'./location-overview-v417.js'});
  loadBogatkaPatch('script',{src:'./location-overview-init-v417.js'});
  loadBogatkaPatch('script',{src:'./location-panels-v419.js'});
  loadBogatkaPatch('script',{src:'./location-panels-render-v419.js'});
  loadBogatkaPatch('script',{src:'./location-global-v421.js'});
  loadBogatkaPatch('script',{src:'./location-card-collapse-v422.js'});
  loadBogatkaPatch('script',{src:'./report-live-v427.js'});
  loadBogatkaPatch('script',{src:'./report-live-fixes-v427.js'});
  loadBogatkaPatch('script',{src:'./report-polish-v428.js'});
  loadBogatkaPatch('script',{src:'./report-authority-v428.js'});
  loadBogatkaPatch('script',{src:'./report-finalize-v431.js'});
  loadBogatkaPatch('script',{src:'./report-finalize-v432.js'});
  loadBogatkaPatch('script',{src:'./status-next-task-v447.js'});
  loadBogatkaPatch('script',{src:'./card-progress-init-v448.js'});
  loadBogatkaPatch('script',{src:'./card-progress-v448.js'});
  loadBogatkaPatch('script',{src:'./card-progress-report-v448.js'});
  loadBogatkaPatch('script',{src:'./landlord-conditions-v449.js'});
  loadBogatkaPatch('script',{src:'./technical-economics-v450.js'});
  loadBogatkaPatch('script',{src:'./technical-economics-report-v450.js'});
  loadBogatkaPatch('script',{src:'./quick-checklist-v451.js'});
  loadBogatkaPatch('script',{src:'./quick-checklist-report-v451.js'});
  loadBogatkaPatch('script',{src:'./location-data-v452.js'});
  loadBogatkaPatch('script',{src:'./location-data-stability-v452.js'});
  loadBogatkaPatch('script',{src:'./durable-fields-v452.js'});
  loadBogatkaPatch('script',{src:'./readiness-progress-v434.js'});
  loadBogatkaPatch('script',{src:'./selftest-v400.js'});
  ensureWorkflowEnhancements();
  installFreshEditorSelectionV463();
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

loadBogatkaPatch('script',{src:'./location-card-collapse-v422.js'});
window.addEventListener('load',applyVersion23Enhancements);
