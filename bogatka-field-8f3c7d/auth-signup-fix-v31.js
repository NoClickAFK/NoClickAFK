const BOGATKA_INVITE_TOKEN_KEY='bogatka_pending_invite_v408';
const BOGATKA_INVITE_EMAIL_KEY='bogatka_pending_invite_email_v408';
let bogatkaInviteAcceptancePromise=null;

function bogatkaNormalizeInviteEmail(value=''){
  const email=String(value||'').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:'';
}

function bogatkaPendingInvite(){
  const params=new URLSearchParams(location.search);
  const token=String(params.get('invite')||'').trim().toLowerCase();
  const email=bogatkaNormalizeInviteEmail(params.get('email'));
  if(/^[0-9a-f]{64}$/.test(token)){
    localStorage.setItem(BOGATKA_INVITE_TOKEN_KEY,token);
    if(email)localStorage.setItem(BOGATKA_INVITE_EMAIL_KEY,email);
    if(email)localStorage.setItem('bogatka_access_authorized_v1','1');
  }
  const saved=String(localStorage.getItem(BOGATKA_INVITE_TOKEN_KEY)||'').trim().toLowerCase();
  if(!/^[0-9a-f]{64}$/.test(saved))return null;
  return {
    token:saved,
    email:bogatkaNormalizeInviteEmail(localStorage.getItem(BOGATKA_INVITE_EMAIL_KEY)),
  };
}

function bogatkaClearPendingInvite(){
  localStorage.removeItem(BOGATKA_INVITE_TOKEN_KEY);
  localStorage.removeItem(BOGATKA_INVITE_EMAIL_KEY);
  const url=new URL(location.href);
  url.searchParams.delete('invite');
  url.searchParams.delete('email');
  url.searchParams.set('v','410');
  history.replaceState(null,'',url.pathname+url.search+url.hash);
}

function bogatkaInviteRedirectUrl(){
  const invite=bogatkaPendingInvite();
  const url=new URL(location.origin+location.pathname);
  url.searchParams.set('v','410');
  url.searchParams.set('auth','confirmed');
  if(invite){
    url.searchParams.set('invite',invite.token);
    if(invite.email)url.searchParams.set('email',invite.email);
  }
  return url.href;
}

function bogatkaValidateNewPassword(password=''){
  const value=String(password||'');
  if(value.length<12)return 'Новый пароль должен содержать не менее 12 символов.';
  if(!/\p{L}/u.test(value)||!/[0-9]/.test(value))return 'Добавьте в пароль хотя бы одну букву и одну цифру.';
  return '';
}

function bogatkaBuildInviteNote(invite){
  const note=document.createElement('div');
  note.className='invite-auth-v408';
  const title=document.createElement('strong');
  title.textContent='Персональное приглашение';
  const text=document.createElement('p');
  text.append(document.createTextNode('Продолжите под email '));
  const email=document.createElement('b');
  email.textContent=invite.email||'из приглашения';
  text.append(email,document.createTextNode('. После входа доступ к проекту подключится автоматически.'));
  note.append(title,text);
  return note;
}

function bogatkaRefreshPasswordField(){
  const form=document.querySelector('#cloudAuthForm');
  const input=document.querySelector('#cloudPassword');
  if(!form||!input)return;
  const signup=document.querySelector('[data-cloud-tab="signup"]')?.classList.contains('active');
  input.minLength=signup?12:6;
  input.placeholder=signup?'Не менее 12 символов, буквы и цифры':'Пароль аккаунта';
  input.autocomplete=signup?'new-password':'current-password';

  const invite=bogatkaPendingInvite();
  if(invite&&form.dataset.inviteV410!=='1'){
    form.dataset.inviteV410='1';
    form.prepend(bogatkaBuildInviteNote(invite));
    const emailInput=document.querySelector('#cloudEmail');
    if(emailInput&&invite.email){
      emailInput.value=invite.email;
      emailInput.readOnly=true;
    }
    const title=document.querySelector('#cloudModal h2');
    if(title)title.textContent='Доступ по персональному приглашению';
  }
}

function bogatkaInviteAuthMode(){
  return new URLSearchParams(location.search).get('auth')==='confirmed'?'login':'signup';
}

function bogatkaOpenInviteAuth(){
  const invite=bogatkaPendingInvite();
  if(!invite)return false;
  if(typeof cloudSession!=='undefined'&&cloudSession?.user)return false;
  if(typeof cloudOpenModal!=='function')return false;
  cloudOpenModal();
  const mode=bogatkaInviteAuthMode();
  setTimeout(()=>{
    document.querySelector(`[data-cloud-tab="${mode}"]`)?.click();
    bogatkaRefreshPasswordField();
    const message=mode==='signup'
      ?'Создайте аккаунт по email из приглашения. После подтверждения почты доступ подключится автоматически.'
      :'Email подтверждён. Войдите под этим аккаунтом, чтобы завершить подключение доступа.';
    if(typeof cloudSetMessage==='function')cloudSetMessage(message,'info');
  },0);
  return true;
}

function bogatkaScheduleInviteAuth(){
  let attempts=0;
  const timer=setInterval(()=>{
    attempts++;
    if(bogatkaOpenInviteAuth()||attempts>=40)clearInterval(timer);
  },125);
}

if(typeof cloudEnsureProject==='function'){
  const bogatkaBaseEnsureProject=cloudEnsureProject;
  cloudEnsureProject=async function(){
    const invite=bogatkaPendingInvite();
    if(!invite)return bogatkaBaseEnsureProject();
    if(!cloudSession?.user)throw new Error('Сначала войдите под аккаунтом из персонального приглашения.');
    const sessionEmail=bogatkaNormalizeInviteEmail(cloudSession.user.email);
    if(invite.email&&invite.email!==sessionEmail){
      throw new Error(`Эта ссылка выдана для ${invite.email}. Войдите под этим email.`);
    }

    if(!bogatkaInviteAcceptancePromise){
      bogatkaInviteAcceptancePromise=(async()=>{
        const accepted=await cloudClient.rpc('accept_bogatka_project_invite',{p_token:invite.token});
        if(accepted.error)throw new Error(accepted.error.message);
        if(!accepted.data)throw new Error('Не удалось принять персональное приглашение.');
        cloudProjectId=accepted.data;
        bogatkaClearPendingInvite();
        sessionStorage.setItem('bogatka_invite_accepted_v408','1');
        window.dispatchEvent(new CustomEvent('bogatka:invite-accepted'));
        return accepted.data;
      })().finally(()=>{bogatkaInviteAcceptancePromise=null;});
    }

    cloudProjectId=await bogatkaInviteAcceptancePromise;
    return bogatkaBaseEnsureProject();
  };
  window.cloudEnsureProject=cloudEnsureProject;
}

if(typeof cloudHandleAuth==='function'){
  cloudHandleAuth=async function(event,mode){
    event.preventDefault();
    const invite=bogatkaPendingInvite();
    const email=bogatkaNormalizeInviteEmail(document.querySelector('#cloudEmail')?.value);
    const password=document.querySelector('#cloudPassword')?.value||'';
    const displayName=document.querySelector('#cloudDisplayName')?.value.trim()||'';
    if(!email)return cloudSetMessage('Укажите корректный email.','error');
    if(invite?.email&&email!==invite.email)return cloudSetMessage(`Эта ссылка выдана для ${invite.email}.`,'error');
    if(mode==='signup'){
      const policyError=bogatkaValidateNewPassword(password);
      if(policyError)return cloudSetMessage(policyError,'error');
    }else if(password.length<6){
      return cloudSetMessage('Укажите пароль аккаунта.','error');
    }
    cloudSetMessage(mode==='signup'?'Создаю аккаунт…':'Проверяю данные входа…','info');
    if(mode==='signup'){
      const {data,error}=await cloudClient.auth.signUp({email,password,options:{data:{display_name:displayName||email.split('@')[0]},emailRedirectTo:bogatkaInviteRedirectUrl()}});
      if(error)return cloudSetMessage(error.message,'error');
      if(!data?.session&&Array.isArray(data?.user?.identities)&&data.user.identities.length===0){
        document.querySelector('[data-cloud-tab="login"]')?.click();
        return cloudSetMessage('Аккаунт уже существует. Введите прежний пароль или восстановите его.','info');
      }
      if(!data?.session)return cloudSetMessage('Аккаунт создан. Подтвердите email по письму. После подтверждения вернитесь по ссылке и войдите.','success');
    }else{
      const {error}=await cloudClient.auth.signInWithPassword({email,password});
      if(error)return cloudSetMessage(error.message,'error');
    }
    cloudSetMessage(invite?'Вход выполнен. Подключаю доступ к проекту…':'Вход выполнен. Запускаю синхронизацию…','success');
  };
  window.cloudHandleAuth=cloudHandleAuth;
}

document.addEventListener('click',event=>{
  if(event.target.closest('[data-cloud-tab]'))setTimeout(bogatkaRefreshPasswordField,0);
});

function bogatkaInstallPasswordObserver(){
  const modal=document.querySelector('#cloudModal');
  if(!modal||modal.dataset.inviteObserverV410==='1')return;
  modal.dataset.inviteObserverV410='1';
  const observer=new MutationObserver(bogatkaRefreshPasswordField);
  observer.observe(modal,{childList:true,subtree:true});
  bogatkaRefreshPasswordField();
}

bogatkaPendingInvite();
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',bogatkaInstallPasswordObserver,{once:true});
  window.addEventListener('load',bogatkaScheduleInviteAuth,{once:true});
}else{
  bogatkaInstallPasswordObserver();
  bogatkaScheduleInviteAuth();
}

window.bogatkaValidateNewPassword=bogatkaValidateNewPassword;
window.bogatkaPendingInvite=bogatkaPendingInvite;
window.bogatkaInviteRedirectUrl=bogatkaInviteRedirectUrl;
window.bogatkaOpenInviteAuth=bogatkaOpenInviteAuth;
