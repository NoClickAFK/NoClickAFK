function bogatkaMemberInitial(value=''){
  const clean=String(value||'').trim();
  return clean?clean[0].toUpperCase():'У';
}

if(typeof cloudLoadMembers==='function'){
  cloudLoadMembers=async function(){
    const root=document.querySelector('#cloudMembers');
    if(!root||!cloudProjectId||cloudRole!=='owner')return;
    const memberResult=await cloudClient.from('project_members').select('user_id,role,created_at').eq('project_id',cloudProjectId).order('created_at');
    if(memberResult.error)throw new Error(memberResult.error.message);
    const ids=(memberResult.data||[]).map(item=>item.user_id);
    let profiles=[];
    if(ids.length){
      const profileResult=await cloudClient.from('profiles').select('id,email,display_name').in('id',ids);
      if(profileResult.error)throw new Error(profileResult.error.message);
      profiles=profileResult.data||[];
    }
    const map=new Map(profiles.map(item=>[item.id,item]));
    root.innerHTML=(memberResult.data||[]).map(member=>{
      const profile=map.get(member.user_id)||{};
      const name=profile.display_name||profile.email||'Участник';
      return `<div class="cloud-member-premium"><div class="cloud-member-avatar">${esc(bogatkaMemberInitial(name))}</div><div class="cloud-member-identity"><div class="cloud-member-name">${esc(name)}</div>${profile.email?`<div class="cloud-member-email">${esc(profile.email)}</div>`:''}</div><span class="cloud-member-role">${esc(cloudRoleLabel(member.role))}</span></div>`;
    }).join('')||'<div class="cloud-member-empty">Участников пока нет.</div>';
  };
}

const bogatkaInviteRoleName=role=>role==='viewer'?'Наблюдатель':'Редактор';
const bogatkaInviteState=item=>item.revoked_at?'revoked':item.accepted_at?'accepted':Date.parse(item.expires_at)<=Date.now()?'expired':'active';
const bogatkaInviteStateName=state=>({active:'Ожидает регистрации',accepted:'Принято',expired:'Истекло',revoked:'Отозвано'})[state]||state;

function bogatkaInviteUrl(raw,email){
  const url=new URL(location.origin+location.pathname);
  url.searchParams.set('v','409');
  url.searchParams.set('invite',raw);
  url.searchParams.set('email',String(email||'').trim().toLowerCase());
  return url.href;
}

async function bogatkaCopyInvite(text,message='Ссылка скопирована.'){
  let copied=false;
  try{
    if(navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(text);
      copied=true;
    }
  }catch(_){ }
  if(!copied){
    const area=document.createElement('textarea');
    area.value=text;
    area.setAttribute('readonly','');
    area.style.position='fixed';
    area.style.opacity='0';
    document.body.append(area);
    area.select();
    try{copied=document.execCommand('copy')}catch(_){copied=false}
    area.remove();
  }
  cloudSetMessage(copied?message:'Не удалось скопировать автоматически. Выделите ссылку вручную.',copied?'success':'error');
  return copied;
}

async function bogatkaLoadInvites(){
  const root=document.querySelector('#bogatkaInviteHistory');
  if(!root||!cloudProjectId||cloudRole!=='owner')return;
  const result=await cloudClient.from('project_invites').select('id,email,role,expires_at,accepted_at,revoked_at').eq('project_id',cloudProjectId).order('created_at',{ascending:false}).limit(100);
  if(result.error){root.textContent=result.error.message;return}
  root.innerHTML=(result.data||[]).map(item=>{
    const state=bogatkaInviteState(item);
    return `<div class="invite-row-v408 status-${state}"><div><b>${esc(item.email)}</b><span>${bogatkaInviteRoleName(item.role)} · ${bogatkaInviteStateName(state)}</span><small>ссылка действует до ${new Date(item.expires_at).toLocaleString('ru-RU')}</small></div>${state==='active'?`<button type="button" class="btn secondary small" data-revoke-v408="${item.id}">Отозвать</button>`:''}</div>`;
  }).join('')||'<div class="cloud-member-empty">Приглашений пока нет.</div>';
  root.querySelectorAll('[data-revoke-v408]').forEach(button=>button.addEventListener('click',async()=>{
    if(!confirm('Отозвать приглашение?'))return;
    const response=await cloudClient.rpc('revoke_project_invite',{p_invite_id:button.dataset.revokeV408});
    if(response.error||!response.data)return cloudSetMessage(response.error?.message||'Не удалось отозвать приглашение.','error');
    cloudSetMessage('Приглашение отозвано.','success');
    await bogatkaLoadInvites();
  }));
}

async function bogatkaCreateInvite(event){
  event.preventDefault();
  const email=document.querySelector('#bogatkaInviteEmail')?.value.trim().toLowerCase();
  const role=document.querySelector('#bogatkaInviteRole')?.value||'editor';
  const hours=Number(document.querySelector('#bogatkaInviteLifetime')?.value||72);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email||''))return cloudSetMessage('Укажите корректный email участника.','error');
  if(!['editor','viewer'].includes(role))return cloudSetMessage('Недопустимая роль приглашения.','error');
  if(![24,72,168].includes(hours))return cloudSetMessage('Недопустимый срок действия ссылки.','error');
  cloudSetMessage('Создаю персональную ссылку…','info');
  const response=await cloudClient.rpc('create_project_invite',{p_project_id:cloudProjectId,p_email:email,p_role:role,p_expires_hours:hours});
  if(response.error)return cloudSetMessage(response.error.message,'error');
  const row=Array.isArray(response.data)?response.data[0]:response.data;
  if(!row?.invite_token)return cloudSetMessage('Сервер не вернул приглашение.','error');
  const link=bogatkaInviteUrl(row.invite_token,row.invite_email||email);
  const result=document.querySelector('#bogatkaInviteResult');
  if(!result)return cloudSetMessage('Не удалось открыть результат приглашения.','error');
  result.classList.remove('hidden');
  result.innerHTML=`<strong>Персональная одноразовая ссылка</strong><p>Для <b>${esc(row.invite_email||email)}</b> · ${bogatkaInviteRoleName(row.invite_role||role)} · действует до ${new Date(row.invite_expires_at).toLocaleString('ru-RU')}.</p><input type="text" readonly value="${esc(link)}"><div class="invite-actions-v408"><button type="button" class="btn" data-copy-v408>Копировать</button><button type="button" class="btn secondary" data-share-v408>Поделиться</button></div><small>После принятия приглашения доступ участника сохраняется, пока владелец проекта его не отключит.</small>`;
  result.querySelector('[data-copy-v408]').addEventListener('click',()=>bogatkaCopyInvite(link,'Персональная ссылка скопирована.'));
  result.querySelector('[data-share-v408]').addEventListener('click',async()=>{
    if(navigator.share){
      try{
        await navigator.share({title:'Приглашение в проект «Богатка»',text:`Персональная ссылка для ${email}`,url:link});
        return;
      }catch(error){
        if(error?.name==='AbortError')return;
      }
    }
    await bogatkaCopyInvite(link,'Персональная ссылка скопирована.');
  });
  document.querySelector('#bogatkaInviteEmail').value='';
  cloudSetMessage('Персональная ссылка создана.','success');
  await bogatkaLoadInvites();
}

function bogatkaEnhanceMembers(){
  const oldForm=document.querySelector('#cloudInviteForm');
  const section=oldForm?.closest('.cloud-section');
  if(!section||cloudRole!=='owner'||section.dataset.invitesV408)return;
  section.dataset.invitesV408='1';
  section.innerHTML=`<h3>Персональные приглашения</h3><p class="cloud-copy">Каждому участнику создаётся отдельная одноразовая ссылка, привязанная к email.</p><form class="cloud-form" id="bogatkaInviteForm"><div class="invite-grid-v408"><label class="field">Email<input type="email" id="bogatkaInviteEmail" required placeholder="name@example.com"></label><label class="field">Роль<select id="bogatkaInviteRole"><option value="editor">Редактор</option><option value="viewer">Наблюдатель</option></select></label><label class="field">Срок действия ссылки<select id="bogatkaInviteLifetime"><option value="24">24 часа</option><option value="72" selected>3 дня</option><option value="168">7 дней</option></select><small class="invite-lifetime-help-v409">Это срок, в течение которого участник должен открыть ссылку и принять приглашение. После регистрации доступ к проекту сохраняется, пока владелец его не отключит.</small></label></div><button class="btn" type="submit">Создать персональную ссылку</button></form><div class="invite-result-v408 hidden" id="bogatkaInviteResult"></div><div class="application-link-v408"><div class="application-link-copy-v409"><b>Постоянная ссылка на приложение</b><small>Открывает приложение без приглашения и сама по себе не выдаёт доступ к проекту.</small></div><button type="button" class="btn secondary application-link-button-v409" id="bogatkaCopyAppLink">Копировать</button></div><h4>История приглашений</h4><div class="invite-history-v408" id="bogatkaInviteHistory">Загрузка…</div><h4>Участники проекта</h4><div class="cloud-members" id="cloudMembers">Загрузка…</div>`;
  section.querySelector('#bogatkaInviteForm').addEventListener('submit',bogatkaCreateInvite);
  section.querySelector('#bogatkaCopyAppLink').addEventListener('click',()=>bogatkaCopyInvite(`${location.origin}${location.pathname}?v=409`,'Постоянная ссылка на приложение скопирована.'));
  bogatkaLoadInvites();
  cloudLoadMembers().catch(error=>cloudSetMessage(error.message,'error'));
}

function bogatkaInstallMembersObserver(){
  const modal=document.querySelector('#cloudModal');
  if(!modal||modal.dataset.membersObserverV408==='1')return;
  modal.dataset.membersObserverV408='1';
  const observer=new MutationObserver(()=>{
    clearTimeout(window.__bogatkaMembersTimer);
    window.__bogatkaMembersTimer=setTimeout(bogatkaEnhanceMembers,60);
  });
  observer.observe(modal,{childList:true,subtree:true});
  bogatkaEnhanceMembers();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bogatkaInstallMembersObserver,{once:true});
else bogatkaInstallMembersObserver();

window.BogatkaInviteManager={version:'4.0.9',loadInvites:bogatkaLoadInvites,createLink:bogatkaInviteUrl};
