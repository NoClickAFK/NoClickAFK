(function(){
  if(window.__bogatkaCollaborationV410)return;
  window.__bogatkaCollaborationV410=true;
  if(typeof cloudSetStatus!=='function'||typeof cloudRenderModal!=='function')return;

  function renderAccountPill(){
    const statusbar=document.querySelector('.statusbar');
    if(!statusbar)return;
    let pill=document.querySelector('#cloudAccountPillV410');
    const email=String(cloudSession?.user?.email||'').trim();
    if(!email){
      pill?.remove();
      return;
    }
    if(!pill){
      pill=document.createElement('button');
      pill.type='button';
      pill.id='cloudAccountPillV410';
      pill.className='pill cloud-account-pill-v410';
      pill.addEventListener('click',()=>{
        if(typeof cloudOpenModal==='function')cloudOpenModal();
      });
      statusbar.appendChild(pill);
    }
    pill.replaceChildren();
    const dot=document.createElement('span');
    dot.className='account-dot-v410';
    const emailNode=document.createElement('span');
    emailNode.className='account-email-v410';
    emailNode.textContent=email;
    const roleNode=document.createElement('span');
    roleNode.className='account-role-v410';
    roleNode.textContent=typeof cloudRoleLabel==='function'?cloudRoleLabel(cloudRole):String(cloudRole||'');
    pill.append(dot,emailNode,roleNode);
    pill.title=`Активный аккаунт: ${email}${cloudRole?` · ${roleNode.textContent}`:''}`;
    pill.setAttribute('aria-label',pill.title);
  }

  const baseSetStatus=cloudSetStatus;
  cloudSetStatus=function collaborationSetStatus(...args){
    const result=baseSetStatus(...args);
    renderAccountPill();
    return result;
  };
  window.cloudSetStatus=cloudSetStatus;

  const baseRenderModal=cloudRenderModal;
  cloudRenderModal=function collaborationRenderModal(...args){
    const result=baseRenderModal(...args);
    renderAccountPill();
    return result;
  };
  window.cloudRenderModal=cloudRenderModal;

  window.addEventListener('bogatka:invite-accepted',renderAccountPill);
  window.addEventListener('load',()=>{
    setTimeout(renderAccountPill,0);
    setTimeout(renderAccountPill,700);
    setTimeout(renderAccountPill,1800);
  },{once:true});

  window.BogatkaCollaboration={
    version:'4.1.0',
    renderAccountPill,
    get account(){return cloudSession?.user?.email||null},
    get role(){return cloudRole||null},
  };
})();
