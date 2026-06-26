const BOGATKA_INVITE_TOKEN_KEY='bogatka_pending_invite_v408';
const BOGATKA_INVITE_EMAIL_KEY='bogatka_pending_invite_email_v408';

function bogatkaPendingInvite(){
  const params=new URLSearchParams(location.search);
  const token=String(params.get('invite')||'').trim().toLowerCase();
  const email=String(params.get('email')||'').trim().toLowerCase();
  if(/^[0-9a-f]{64}$/.test(token)){
    localStorage.setItem(BOGATKA_INVITE_TOKEN_KEY,token);
    if(email)localStorage.setItem(BOGATKA_INVITE_EMAIL_KEY,email);
    localStorage.setItem('bogatka_access_authorized_v1','1');
  }
  const saved=String(localStorage.getItem(BOGATKA_INVITE_TOKEN_KEY)||'').toLowerCase();
  if(!/^[0-9a-f]{64}$/.test(saved))return null;
  return {token:saved,email:String(localStorage.getItem(BOGATKA_INVITE_EMAIL_KEY)||email).toLowerCase()};
}

function bogatkaClearPendingInvite(){
  localStorage.removeItem(BOGATKA_INVITE_TOKEN_KEY);
  localStorage.removeItem(BOGATKA_INVITE_EMAIL_KEY);
  const url=new URL(location.href);
  url.searchParams.delete('invite');
  url.searchParams.delete('email');
  url.searchParams.set('v','408');
  history.replaceState(null,'',url.pathname+url.search+url.hash);
}

function bogatkaInviteRedirectUrl(){
  const invite=bogatkaPendingInvite();
  const url=new URL(location.origin+location.pathname);
  url.searchParams.set('v','408');
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

function bogatkaRefreshPasswordField(){
  const form=document.querySelector('#cloudAuthForm');
  const input=document.querySelector('#cloudPassword');
  if(!form||!input)return;
  const signup=document.querySelector('[data-cloud-tab="signup"]')?.classList.contains('active');
  input.minLength=signup?12:6;
  input.placeholder=signup?'Не менее 12 символов, буквы и цифры':'Пароль аккаунта';
  input.autocomplete=signup?'new-password':'current-password';

  const invite=bogatkaPendingInvite();
  if(invite&&form.dataset.inviteV408!=='1'){
    form.dataset.inviteV408='1';
    const note=document.createElement('div');
    note.className='invite-auth-v408';
    note.innerHTML=`<strong>Персональное приглашение</strong><p>Войдите или зарегистрируйтесь под email <b>${invite.email||'из приглашения'}</b>. После входа доступ подключится автоматически.</p>`;
    form.prepend(note);
    const emailInput=document.querySelector('#cloudEmail');
    if(emailInput&&invite.email){emailInput.value=invite.email;emailInput.readOnly=true}
    const title=document.querySelector('#cloudModal h2');
    if(title)title.textContent='Вход по персональному приглашению';
  }
}

if(typeof cloudEnsureProject==='function'){
  const bogatkaBaseEnsureProject=cloudEnsureProject;
  cloudEnsureProject=async function(){
    const invite=bogatkaPendingInvite();
    if(invite&&cloudSession?.user?.email&&invite.email!==String(cloudSession.user.email).toLowerCase()){
      throw new Error(`Эта ссылка выдана для ${invite.email}. Войдите под этим email.`);
    }
    const projectId=await bogatkaBaseEnsureProject();
    if(invite){
      bogatkaClearPendingInvite();
      sessionStorage.setItem('bogatka_invite_accepted_v408','1');
    }
    return projectId;
  };
  window.cloudEnsureProject=cloudEnsureProject;
}

if(typeof cloudHandleAuth==='function'){
  cloudHandleAuth=async function(event,mode){
    event.preventDefault();
    const invite=bogatkaPendingInvite();
    const email=document.querySelector('#cloudEmail')?.value.trim().toLowerCase();
    const password=document.querySelector('#cloudPassword')?.value||'';
    const displayName=document.querySelector('#cloudDisplayName')?.value.trim()||'';
    if(!email)return cloudSetMessage('Укажите email.','error');
    if(invite?.email&&email!==invite.email)return cloudSetMessage(`Эта ссылка выдана для ${invite.email}.`,'error');
    if(mode==='signup'){
      const policyError=bogatkaValidateNewPassword(password);
      if(policyError)return cloudSetMessage(policyError,'error');
    }else if(password.length<6){
      return cloudSetMessage('Укажите пароль аккаунта.','error');
    }
    cloudSetMessage(mode==='signup'?'Проверяю адрес…':'Проверяю данные входа…','info');
    if(mode==='signup'){
      const {data,error}=await cloudClient.auth.signUp({email,password,options:{data:{display_name:displayName||email.split('@')[0]},emailRedirectTo:bogatkaInviteRedirectUrl()}});
      if(error)return cloudSetMessage(error.message,'error');
      if(!data?.session&&Array.isArray(data?.user?.identities)&&data.user.identities.length===0){
        document.querySelector('[data-cloud-tab="login"]')?.click();
        return cloudSetMessage('Аккаунт уже существует. Введите прежний пароль или восстановите его.','info');
      }
      if(!data?.session)return cloudSetMessage('Аккаунт создан. Подтвердите email по письму, затем войдите. Персональная ссылка сохранена.','success');
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

bogatkaPendingInvite();
const bogatkaPasswordObserver=new MutationObserver(bogatkaRefreshPasswordField);
bogatkaPasswordObserver.observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bogatkaRefreshPasswordField,{once:true});
else bogatkaRefreshPasswordField();

window.bogatkaValidateNewPassword=bogatkaValidateNewPassword;
window.bogatkaPendingInvite=bogatkaPendingInvite;
window.bogatkaInviteRedirectUrl=bogatkaInviteRedirectUrl;
