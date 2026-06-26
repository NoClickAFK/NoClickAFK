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
}

if(typeof cloudHandleAuth==='function'){
  cloudHandleAuth=async function(event,mode){
    event.preventDefault();
    const email=document.querySelector('#cloudEmail')?.value.trim().toLowerCase();
    const password=document.querySelector('#cloudPassword')?.value||'';
    const displayName=document.querySelector('#cloudDisplayName')?.value.trim()||'';
    if(!email)return cloudSetMessage('Укажите email.','error');
    if(mode==='signup'){
      const policyError=bogatkaValidateNewPassword(password);
      if(policyError)return cloudSetMessage(policyError,'error');
    }else if(password.length<6){
      return cloudSetMessage('Укажите пароль аккаунта.','error');
    }
    cloudSetMessage(mode==='signup'?'Проверяю адрес…':'Проверяю данные входа…','info');
    if(mode==='signup'){
      const {data,error}=await cloudClient.auth.signUp({email,password,options:{data:{display_name:displayName||email.split('@')[0]},emailRedirectTo:`${location.origin}${location.pathname}?auth=confirmed`}});
      if(error)return cloudSetMessage(error.message,'error');
      if(!data?.session&&Array.isArray(data?.user?.identities)&&data.user.identities.length===0){
        document.querySelector('[data-cloud-tab="login"]')?.click();
        return cloudSetMessage('Аккаунт с этой почтой уже существует. Новый аккаунт не создавался и письмо не отправлялось. Введите прежний пароль или нажмите «Не помню пароль».','info');
      }
      if(!data?.session)return cloudSetMessage('Аккаунт создан. Проверьте письмо подтверждения, затем вернитесь и войдите.','success');
    }else{
      const {error}=await cloudClient.auth.signInWithPassword({email,password});
      if(error)return cloudSetMessage(error.message,'error');
    }
    cloudSetMessage('Вход выполнен. Запускаю синхронизацию…','success');
  };
}

document.addEventListener('click',event=>{
  if(event.target.closest('[data-cloud-tab]'))setTimeout(bogatkaRefreshPasswordField,0);
});

const bogatkaPasswordObserver=new MutationObserver(bogatkaRefreshPasswordField);
bogatkaPasswordObserver.observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bogatkaRefreshPasswordField,{once:true});
else bogatkaRefreshPasswordField();

window.bogatkaValidateNewPassword=bogatkaValidateNewPassword;
