const BOGATKA_RECOVERY_FLAG='bogatka_password_recovery_pending';
let bogatkaRecoveryShown=false;

function bogatkaRecoveryRequested(){
  return sessionStorage.getItem(BOGATKA_RECOVERY_FLAG)==='1'||new URLSearchParams(location.search).get('auth')==='recovery'||location.hash.includes('type=recovery');
}

function bogatkaShowRecovery(){
  if(bogatkaRecoveryShown||!bogatkaRecoveryRequested()||!cloudClient)return;
  bogatkaRecoveryShown=true;
  const root=document.querySelector('#cloudModal');
  const card=root?.querySelector('.modal-card');
  if(!root||!card)return;
  root.classList.remove('hidden');
  card.classList.add('recovery-card');
  card.innerHTML=`
    <h2>Создать новый пароль</h2>
    <p class="recovery-title-note">Ссылка подтверждена. Придумайте новый пароль для существующего аккаунта. Локации, фотографии и роль владельца останутся без изменений.</p>
    <form class="cloud-form" id="bogatkaRecoveryForm">
      <label class="field">Новый пароль<input id="bogatkaNewPassword" type="password" minlength="8" autocomplete="new-password" required placeholder="Минимум 8 символов"></label>
      <label class="field">Повторите пароль<input id="bogatkaRepeatPassword" type="password" minlength="8" autocomplete="new-password" required placeholder="Введите пароль ещё раз"></label>
      <button class="btn" type="submit">Сохранить новый пароль</button>
    </form>
    <div class="cloud-message" id="cloudMessage"></div>
    <div class="cloud-recovery-note">После сохранения на этом устройстве вход выполнится автоматически. На телефоне и других устройствах используйте новый пароль.</div>`;
  card.querySelector('#bogatkaRecoveryForm').addEventListener('submit',bogatkaSaveRecovery);
}

async function bogatkaSaveRecovery(event){
  event.preventDefault();
  const first=document.querySelector('#bogatkaNewPassword')?.value||'';
  const second=document.querySelector('#bogatkaRepeatPassword')?.value||'';
  if(first.length<8)return cloudSetMessage('Пароль должен содержать не менее 8 символов.','error');
  if(first!==second)return cloudSetMessage('Пароли не совпадают.','error');
  cloudSetMessage('Сохраняю новый пароль…','info');
  const {error}=await cloudClient.auth.updateUser({password:first});
  if(error)return cloudSetMessage(error.message,'error');
  sessionStorage.removeItem(BOGATKA_RECOVERY_FLAG);
  history.replaceState(null,'',`${location.pathname}?v=310`);
  bogatkaRecoveryShown=false;
  cloudRenderModal();
  cloudSetMessage('Пароль изменён. Аккаунт восстановлен, синхронизация запускается.','success');
  cloudSyncAll({manual:true}).catch(cloudHandleError);
}

function bogatkaRecoveryBoot(){
  if(location.hash.includes('type=recovery')||new URLSearchParams(location.search).get('auth')==='recovery')sessionStorage.setItem(BOGATKA_RECOVERY_FLAG,'1');
  const timer=setInterval(()=>{
    if(cloudClient){
      clearInterval(timer);
      if(bogatkaRecoveryRequested())setTimeout(bogatkaShowRecovery,450);
      cloudClient.auth.onAuthStateChange((event)=>{
        if(event==='PASSWORD_RECOVERY'){
          sessionStorage.setItem(BOGATKA_RECOVERY_FLAG,'1');
          setTimeout(bogatkaShowRecovery,200);
        }
      });
    }
  },80);
  setTimeout(()=>clearInterval(timer),15000);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bogatkaRecoveryBoot,{once:true});
else bogatkaRecoveryBoot();
