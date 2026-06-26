(function(){
  if(window.__bogatkaInvitesV408)return;
  window.__bogatkaInvitesV408=true;

  function updateButton(){
    const button=document.querySelector('#shareAccessBtn');
    if(button)button.textContent='Пригласить участника';
  }

  function showAcceptedMessage(){
    if(!sessionStorage.getItem('bogatka_invite_accepted_v408'))return;
    sessionStorage.removeItem('bogatka_invite_accepted_v408');
    if(typeof cloudSetMessage==='function')cloudSetMessage('Персональное приглашение принято. Доступ к проекту подключён.','success');
  }

  document.addEventListener('click',event=>{
    if(!event.target.closest?.('#shareAccessBtn'))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(typeof cloudOpenModal==='function')cloudOpenModal();
    else document.querySelector('#cloudModal')?.classList.remove('hidden');
    setTimeout(()=>{
      if((typeof cloudSession==='undefined'||!cloudSession)&&typeof cloudSetMessage==='function')cloudSetMessage('Войдите в облачный аккаунт. Персональные ссылки создаёт владелец проекта.','info');
      else if((typeof cloudRole==='undefined'||cloudRole!=='owner')&&typeof cloudSetMessage==='function')cloudSetMessage('Создавать персональные ссылки может только владелец проекта.','error');
      if(typeof bogatkaEnhanceMembers==='function')bogatkaEnhanceMembers();
    },0);
  },true);

  window.addEventListener('bogatka:invite-accepted',showAcceptedMessage);

  function install(){
    updateButton();
    showAcceptedMessage();
  }

  window.BogatkaInvites={version:'4.0.8',principle:'one-email-one-personal-link'};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();