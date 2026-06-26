function bogatkaMemberInitial(value=''){
  const clean=String(value||'').trim();
  return clean?clean[0].toUpperCase():'У';
}

const bogatkaInviteRoleName=role=>role==='viewer'?'Наблюдатель':role==='editor'?'Редактор':cloudRoleLabel(role);
const bogatkaDateTime=value=>value?new Date(value).toLocaleString('ru-RU'):'—';
let bogatkaMemberRecords=[];
let bogatkaMemberProjectId=null;
let bogatkaCollaborationChannel=null;
let bogatkaCollaborationChannelProject=null;
let bogatkaCollaborationRefreshTimer=null;

async function bogatkaFetchMembers(){
  if(!cloudProjectId||cloudRole!=='owner')return [];
  const memberResult=await cloudClient.from('project_members').select('user_id,role,created_at').eq('project_id',cloudProjectId).order('created_at');
  if(memberResult.error)throw new Error(memberResult.error.message);
  const members=memberResult.data||[];
  const ids=members.map(item=>item.user_id);
  let profiles=[];
  if(ids.length){
    const profileResult=await cloudClient.from('profiles').select('id,email,display_name').in('id',ids);
    if(profileResult.error)throw new Error(profileResult.error.message);
    profiles=profileResult.data||[];
  }
  const profileMap=new Map(profiles.map(item=>[item.id,item]));
  bogatkaMemberProjectId=cloudProjectId;
  bogatkaMemberRecords=members.map(member=>({...member,profile:profileMap.get(member.user_id)||{}}));
  return bogatkaMemberRecords;
}

function bogatkaMemberCard(record){
  const profile=record.profile||{};
  const name=profile.display_name||profile.email||'Участник';
  const email=profile.email||'';
  const owner=record.role==='owner';
  const controls=owner
    ?'<span class="cloud-member-role owner">Владелец</span>'
    :`<div class="member-controls-v410"><label class="member-role-field-v410"><span>Роль</span><select data-member-role-v410="${esc(record.user_id)}" data-current-role="${esc(record.role)}"><option value="editor"${record.role==='editor'?' selected':''}>Редактор</option><option value="viewer"${record.role==='viewer'?' selected':''}>Наблюдатель</option></select></label><button type="button" class="btn secondary member-save-v410" data-save-member-v410="${esc(record.user_id)}" disabled>Сохранить</button><button type="button" class="member-remove-v410" data-remove-member-v410="${esc(record.user_id)}" aria-label="Отключить доступ участника" title="Отключить доступ">Отключить</button></div>`;
  return `<article class="cloud-member-premium" data-member-card-v410="${esc(record.user_id)}"><div class="cloud-member-avatar">${esc(bogatkaMemberInitial(name))}</div><div class="cloud-member-identity"><div class="cloud-member-name">${esc(name)}</div>${email?`<div class="cloud-member-email">${esc(email)}</div>`:''}<div class="cloud-member-since-v410">В проекте с ${bogatkaDateTime(record.created_at)}</div></div>${controls}</article>`;
}

function bogatkaBindMemberControls(root){
  root.querySelectorAll('[data-member-role-v410]').forEach(select=>{
    select.addEventListener('change',()=>{
      const button=root.querySelector(`[data-save-member-v410="${CSS.escape(select.dataset.memberRoleV410)}"]`);
      if(button)button.disabled=select.value===select.dataset.currentRole;
    });
  });

  root.querySelectorAll('[data-save-member-v410]').forEach(button=>button.addEventListener('click',async()=>{
    const userId=button.dataset.saveMemberV410;
    const select=root.querySelector(`[data-member-role-v410="${CSS.escape(userId)}"]`);
    const role=select?.value;
    if(!['editor','viewer'].includes(role))return;
    button.disabled=true;
    cloudSetMessage('Изменяю роль участника…','info');
    const response=await cloudClient.rpc('update_project_member_role',{p_project_id:cloudProjectId,p_user_id:userId,p_role:role});
    if(response.error||!response.data){
      button.disabled=false;
      return cloudSetMessage(response.error?.message||'Не удалось изменить роль.','error');
    }
    cloudSetMessage(`Роль изменена: ${bogatkaInviteRoleName(role)}.`,'success');
    await bogatkaRefreshCollaboration();
  }));

  root.querySelectorAll('[data-remove-member-v410]').forEach(button=>button.addEventListener('click',async()=>{
    const userId=button.dataset.removeMemberV410;
    const record=bogatkaMemberRecords.find(item=>item.user_id===userId);
    const label=record?.profile?.display_name||record?.profile?.email||'этого участника';
    if(!confirm(`Отключить доступ для ${label}? Участник перестанет видеть проект и синхронизировать изменения.`))return;
    button.disabled=true;
    cloudSetMessage('Отключаю доступ участника…','info');
    const response=await cloudClient.rpc('remove_project_member',{p_project_id:cloudProjectId,p_user_id:userId});
    if(response.error||!response.data){
      button.disabled=false;
      return cloudSetMessage(response.error?.message||'Не удалось отключить доступ.','error');
    }
    cloudSetMessage('Доступ участника отключён.','success');
    await bogatkaRefreshCollaboration();
  }));
}

if(typeof cloudLoadMembers==='function'){
  cloudLoadMembers=async function(){
    const root=document.querySelector('#cloudMembers');
    if(!root||!cloudProjectId||cloudRole!=='owner')return [];
    root.setAttribute('aria-busy','true');
    const records=await bogatkaFetchMembers();
    root.innerHTML=records.map(bogatkaMemberCard).join('')||'<div class="cloud-member-empty">Участников пока нет.</div>';
    root.removeAttribute('aria-busy');
    bogatkaBindMemberControls(root);
    return records;
  };
  window.cloudLoadMembers=cloudLoadMembers;
}

function bogatkaInviteState(item,memberIds){
  if(item.revoked_at)return 'revoked';
  if(item.accepted_at)return memberIds.has(item.accepted_by)?'accepted':'removed';
  if(Date.parse(item.expires_at)<=Date.now())return 'expired';
  return 'active';
}

const bogatkaInviteStateName=state=>({
  active:'Ожидает принятия',
  accepted:'Принято',
  removed:'Доступ отключён',
  expired:'Срок истёк',
  revoked:'Ссылка отозвана',
})[state]||state;

function bogatkaInviteMeta(item,state){
  if(state==='accepted')return `Принято ${bogatkaDateTime(item.accepted_at)}. Доступ участника активен.`;
  if(state==='removed')return `Принято ${bogatkaDateTime(item.accepted_at)}. Позже доступ был отключён владельцем.`;
  if(state==='revoked')return `Отозвано ${bogatkaDateTime(item.revoked_at)}. Ссылка больше не действует.`;
  if(state==='expired')return `Срок действия закончился ${bogatkaDateTime(item.expires_at)}.`;
  return `Ссылка действует до ${bogatkaDateTime(item.expires_at)}.`;
}

function bogatkaInviteUrl(raw,email){
  const url=new URL(location.origin+location.pathname);
  url.searchParams.set('v','410');
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
  if(bogatkaMemberProjectId!==cloudProjectId)await bogatkaFetchMembers();
  root.setAttribute('aria-busy','true');
  const result=await cloudClient.from('project_invites').select('id,email,role,created_at,expires_at,accepted_at,accepted_by,revoked_at').eq('project_id',cloudProjectId).order('created_at',{ascending:false}).limit(100);
  if(result.error){
    root.removeAttribute('aria-busy');
    root.textContent=result.error.message;
    return;
  }
  const memberIds=new Set(bogatkaMemberRecords.map(item=>item.user_id));
  root.innerHTML=(result.data||[]).map(item=>{
    const state=bogatkaInviteState(item,memberIds);
    return `<article class="invite-row-v408 status-${state}"><div class="invite-row-main-v410"><div class="invite-row-title-v410"><b>${esc(item.email)}</b><span class="invite-role-badge-v410">${esc(bogatkaInviteRoleName(item.role))}</span><span class="invite-status-badge-v410 status-${state}">${esc(bogatkaInviteStateName(state))}</span></div><div class="invite-row-meta-v410">${esc(bogatkaInviteMeta(item,state))}</div><div class="invite-row-created-v410">Создано ${bogatkaDateTime(item.created_at)}</div></div>${state==='active'?`<button type="button" class="btn secondary invite-revoke-v410" data-revoke-v408="${esc(item.id)}">Отозвать ссылку</button>`:''}</article>`;
  }).join('')||'<div class="cloud-member-empty">Приглашений пока нет.</div>';
  root.removeAttribute('aria-busy');
  root.querySelectorAll('[data-revoke-v408]').forEach(button=>button.addEventListener('click',async()=>{
    if(!confirm('Отозвать эту персональную ссылку? После отзыва использовать её будет нельзя.'))return;
    button.disabled=true;
    const response=await cloudClient.rpc('revoke_project_invite',{p_invite_id:button.dataset.revokeV408});
    if(response.error||!response.data){
      button.disabled=false;
      return cloudSetMessage(response.error?.message||'Не удалось отозвать приглашение.','error');
    }
    cloudSetMessage('Персональная ссылка отозвана.','success');
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
  result.innerHTML=`<div class="invite-result-head-v410"><strong>Персональная одноразовая ссылка</strong><span>${esc(bogatkaInviteRoleName(row.invite_role||role))}</span></div><p class="invite-result-summary-v410">Для <b>${esc(row.invite_email||email)}</b>. Ссылка действует до ${bogatkaDateTime(row.invite_expires_at)}.</p><input class="invite-link-input-v410" type="text" readonly value="${esc(link)}"><div class="invite-actions-v408"><button type="button" class="btn" data-copy-v408>Копировать</button><button type="button" class="btn secondary" data-share-v408>Поделиться</button></div><p class="invite-result-note-v410">После принятия приглашения доступ участника сохраняется, пока владелец проекта его не отключит.</p>`;
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

async function bogatkaRefreshCollaboration(){
  if(!cloudProjectId||cloudRole!=='owner')return;
  await cloudLoadMembers();
  await bogatkaLoadInvites();
}

function bogatkaScheduleCollaborationRefresh(){
  clearTimeout(bogatkaCollaborationRefreshTimer);
  bogatkaCollaborationRefreshTimer=setTimeout(()=>{
    if(document.querySelector('#cloudModal:not(.hidden)')&&cloudRole==='owner'){
      bogatkaRefreshCollaboration().catch(error=>cloudSetMessage(error.message,'error'));
    }
  },250);
}

async function bogatkaInstallCollaborationRealtime(){
  if(!cloudClient?.channel||!cloudProjectId||cloudRole!=='owner')return;
  if(bogatkaCollaborationChannel&&bogatkaCollaborationChannelProject===cloudProjectId)return;
  if(bogatkaCollaborationChannel&&cloudClient.removeChannel){
    try{await cloudClient.removeChannel(bogatkaCollaborationChannel)}catch(_){ }
  }
  bogatkaCollaborationChannelProject=cloudProjectId;
  bogatkaCollaborationChannel=cloudClient
    .channel(`bogatka-collaboration-${cloudProjectId}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'project_members',filter:`project_id=eq.${cloudProjectId}`},bogatkaScheduleCollaborationRefresh)
    .on('postgres_changes',{event:'*',schema:'public',table:'project_invites',filter:`project_id=eq.${cloudProjectId}`},bogatkaScheduleCollaborationRefresh)
    .subscribe();
}

function bogatkaEnhanceMembers(){
  const oldForm=document.querySelector('#cloudInviteForm');
  const section=oldForm?.closest('.cloud-section');
  if(!section||cloudRole!=='owner'||section.dataset.invitesV410)return;
  section.dataset.invitesV410='1';
  section.innerHTML=`<div class="collaboration-heading-v410"><div><h3>Персональные приглашения</h3><p class="cloud-copy">Для каждого нового участника создаётся отдельная одноразовая ссылка, привязанная к его email.</p></div></div><form class="cloud-form" id="bogatkaInviteForm"><div class="invite-grid-v408"><label class="field">Email<input type="email" id="bogatkaInviteEmail" required placeholder="name@example.com"></label><label class="field">Роль<select id="bogatkaInviteRole"><option value="editor">Редактор</option><option value="viewer">Наблюдатель</option></select></label><label class="field">Срок действия ссылки<select id="bogatkaInviteLifetime"><option value="24">24 часа</option><option value="72" selected>3 дня</option><option value="168">7 дней</option></select><small class="invite-lifetime-help-v409">За это время участник должен открыть ссылку и принять приглашение. После регистрации доступ сохраняется, пока владелец его не отключит.</small></label></div><button class="btn" type="submit">Создать персональную ссылку</button></form><div class="invite-result-v408 hidden" id="bogatkaInviteResult"></div><div class="application-link-v408"><div class="application-link-copy-v409"><b>Ссылка на вход и регистрацию</b><small>Открывает приложение без персонального приглашения, но сама по себе не выдаёт доступ к проекту. Новому пользователю всё равно потребуется регистрация и приглашение владельца.</small></div><button type="button" class="btn secondary application-link-button-v409" id="bogatkaCopyAppLink">Копировать</button></div><section class="collaboration-list-section-v410"><div class="collaboration-section-title-v410"><h4>История приглашений</h4><span>Все созданные ссылки и их статус</span></div><div class="invite-history-v408" id="bogatkaInviteHistory">Загрузка…</div></section><section class="collaboration-list-section-v410"><div class="collaboration-section-title-v410"><h4>Участники проекта</h4><span>Роли и действующий доступ</span></div><div class="cloud-members" id="cloudMembers">Загрузка…</div></section>`;
  section.querySelector('#bogatkaInviteForm').addEventListener('submit',bogatkaCreateInvite);
  section.querySelector('#bogatkaCopyAppLink').addEventListener('click',()=>bogatkaCopyInvite(`${location.origin}${location.pathname}?v=410`,'Ссылка на вход и регистрацию скопирована.'));
  bogatkaRefreshCollaboration().catch(error=>cloudSetMessage(error.message,'error'));
  bogatkaInstallCollaborationRealtime().catch(console.error);
}

function bogatkaInstallMembersObserver(){
  const modal=document.querySelector('#cloudModal');
  if(!modal||modal.dataset.membersObserverV410==='1')return;
  modal.dataset.membersObserverV410='1';
  const observer=new MutationObserver(()=>{
    clearTimeout(window.__bogatkaMembersTimer);
    window.__bogatkaMembersTimer=setTimeout(bogatkaEnhanceMembers,60);
  });
  observer.observe(modal,{childList:true,subtree:true});
  bogatkaEnhanceMembers();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bogatkaInstallMembersObserver,{once:true});
else bogatkaInstallMembersObserver();

window.bogatkaEnhanceMembers=bogatkaEnhanceMembers;
window.bogatkaLoadInvites=bogatkaLoadInvites;
window.bogatkaRefreshCollaboration=bogatkaRefreshCollaboration;
window.BogatkaInviteManager={version:'4.1.0',loadInvites:bogatkaLoadInvites,createLink:bogatkaInviteUrl,refresh:bogatkaRefreshCollaboration};
