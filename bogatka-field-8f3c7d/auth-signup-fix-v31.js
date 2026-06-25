if(typeof cloudHandleAuth==='function'){
  cloudHandleAuth=async function(event,mode){
    event.preventDefault();
    const email=document.querySelector('#cloudEmail')?.value.trim().toLowerCase();
    const password=document.querySelector('#cloudPassword')?.value||'';
    const displayName=document.querySelector('#cloudDisplayName')?.value.trim()||'';
    if(!email||password.length<6)return cloudSetMessage('Укажите email и пароль не короче 6 символов.','error');
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
