let bogatkaAuthPatchTimer=null;
let bogatkaAuthPatchStarted=false;

function bogatkaAuthText(message=''){
  const value=String(message||'');
  const lower=value.toLowerCase();
  if(lower.includes('invalid login credentials'))return 'Неверный пароль. Аккаунт с этой почтой уже существует; повторная регистрация не нужна.';
  if(lower.includes('email not confirmed'))return 'Email ещё не подтверждён.';
  if(lower.includes('user already registered'))return 'Аккаунт уже существует. Перейдите во вкладку «Вход».';
  if(lower.includes('rate limit'))return 'Лимит почтовых запросов временно исчерпан. Не отправляйте запрос повторно несколько раз подряд.';
  return value;
}

function bogatkaRecoveryUrl(){
  return `${location.origin}${location.pathname}?v=310&auth=recovery`;
}

function bogatkaAddAuthHelp(){
  const form=document.querySelector('#cloudAuthForm');
  if(!form||form.querySelector('#cloudForgotPasswordBtn'))return;
  const submit=form.querySelector('#cloudAuthSubmit');
  if(!submit)return;
  const row=document.createElement('div');
  row.className='cloud-forgot-row';
  row.innerHTML='<button type="button" class="cloud-forgot-btn" id="cloudForgotPasswordBtn">Не помню пароль</button>';
  submit.insertAdjacentElement('afterend',row);
  row.querySelector('button').addEventListener('click',async()=>{
    const email=document.querySelector('#cloudEmail')?.value.trim().toLowerCase();
    if(!email)return cloudSetMessage('Сначала укажите email существующего аккаунта.','error');
    cloudSetMessage('Отправляю письмо восстановления…','info');
    const {error}=await cloudClient.auth.resetPasswordForEmail(email,{redirectTo:bogatkaRecoveryUrl()});
    if(error)return cloudSetMessage(bogatkaAuthText(error.message),'error');
    cloudSetMessage('Запрос восстановления отправлен. Проверьте входящие письма и папку «Спам». Повторная регистрация не нужна.','success');
  });
}

function bogatkaStartAuthPatch(){
  if(bogatkaAuthPatchStarted)return;
  bogatkaAuthPatchStarted=true;
  const originalMessage=cloudSetMessage;
  cloudSetMessage=function(text='',type='info'){return originalMessage(bogatkaAuthText(text),type)};
  const observer=new MutationObserver(()=>{
    clearTimeout(bogatkaAuthPatchTimer);
    bogatkaAuthPatchTimer=setTimeout(bogatkaAddAuthHelp,40);
  });
  observer.observe(document.body,{childList:true,subtree:true});
  bogatkaAddAuthHelp();
}

if(document.readyState==='complete')bogatkaStartAuthPatch();
else window.addEventListener('load',bogatkaStartAuthPatch,{once:true});
