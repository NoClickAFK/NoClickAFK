const APP_URL='../?v=400';
const statusBox=document.querySelector('#statusBox');
const leadText=document.querySelector('#leadText');
const form=document.querySelector('#passwordForm');
const actions=document.querySelector('#resultActions');
const saveButton=document.querySelector('#savePasswordBtn');
const returnLink=document.querySelector('#returnToApp');
const requestAgainButton=document.querySelector('#requestAgainBtn');
let client=null;
let readyForPassword=false;

function setStatus(text,type='info'){
  statusBox.textContent=text;
  statusBox.className=`status status-${type}`;
}

function validateNewPassword(password=''){
  const value=String(password||'');
  if(value.length<12)return 'Пароль должен содержать не менее 12 символов.';
  if(!/\p{L}/u.test(value)||!/[0-9]/.test(value))return 'Добавьте в пароль хотя бы одну букву и одну цифру.';
  return '';
}

function showForm(){
  readyForPassword=true;
  form.classList.remove('hidden');
  actions.classList.add('hidden');
  leadText.textContent='Ссылка подтверждена. Придумайте новый пароль для существующего аккаунта.';
  setStatus('Можно задать новый пароль.','success');
  document.querySelector('#newPassword')?.focus();
}

function showError(message){
  form.classList.add('hidden');
  actions.classList.remove('hidden');
  requestAgainButton.classList.remove('hidden');
  leadText.textContent='Ссылка восстановления не сработала.';
  setStatus(message,'error');
}

function cleanAddress(){
  history.replaceState(null,'',location.pathname);
}

async function resolveRecoverySession(){
  if(!window.BOGATKA_SUPABASE||!window.supabase?.createClient){
    showError('Не удалось загрузить защищённое подключение. Обновите страницу и попробуйте ещё раз.');
    return;
  }

  const query=new URLSearchParams(location.search);
  const hash=new URLSearchParams(location.hash.replace(/^#/,''));
  const authError=query.get('error_description')||hash.get('error_description');
  if(authError){
    showError(decodeURIComponent(authError.replace(/\+/g,' ')));
    return;
  }

  client=window.supabase.createClient(
    BOGATKA_SUPABASE.url,
    BOGATKA_SUPABASE.publishableKey,
    {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
  );

  client.auth.onAuthStateChange((event,session)=>{
    if((event==='PASSWORD_RECOVERY'||event==='SIGNED_IN')&&session&&!readyForPassword){
      setTimeout(showForm,0);
    }
  });

  const code=query.get('code');
  if(code){
    const {error}=await client.auth.exchangeCodeForSession(code);
    if(error){showError(`Не удалось подтвердить ссылку: ${error.message}`);return;}
  }

  for(let attempt=0;attempt<20;attempt++){
    const {data,error}=await client.auth.getSession();
    if(error){showError(`Ошибка проверки ссылки: ${error.message}`);return;}
    if(data.session){showForm();return;}
    await new Promise(resolve=>setTimeout(resolve,150));
  }

  showError('Ссылка просрочена, уже использована или открыта не полностью. Запросите новое письмо из приложения.');
}

form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!client||!readyForPassword)return;
  const password=document.querySelector('#newPassword').value;
  const repeat=document.querySelector('#repeatPassword').value;
  const policyError=validateNewPassword(password);
  if(policyError){setStatus(policyError,'error');return;}
  if(password!==repeat){setStatus('Пароли не совпадают.','error');return;}

  saveButton.disabled=true;
  saveButton.textContent='Сохраняю…';
  setStatus('Сохраняю новый пароль в защищённом аккаунте…','info');
  const {error}=await client.auth.updateUser({password});
  if(error){
    saveButton.disabled=false;
    saveButton.textContent='Сохранить новый пароль';
    setStatus(`Не удалось изменить пароль: ${error.message}`,'error');
    return;
  }

  cleanAddress();
  form.classList.add('hidden');
  actions.classList.remove('hidden');
  requestAgainButton.classList.add('hidden');
  leadText.textContent='Пароль успешно изменён.';
  setStatus('Аккаунт восстановлен. Вход уже выполнен на этом устройстве.','success');
  returnLink.href=APP_URL;
  setTimeout(()=>location.replace(APP_URL),1800);
});

document.querySelectorAll('[data-toggle-password]').forEach(button=>{
  button.addEventListener('click',()=>{
    const input=document.getElementById(button.dataset.togglePassword);
    const visible=input.type==='text';
    input.type=visible?'password':'text';
    button.textContent=visible?'◉':'◌';
    button.setAttribute('aria-label',visible?'Показать пароль':'Скрыть пароль');
  });
});

requestAgainButton.addEventListener('click',()=>location.replace(APP_URL));
window.bogatkaValidateRecoveryPassword=validateNewPassword;
resolveRecoverySession();
