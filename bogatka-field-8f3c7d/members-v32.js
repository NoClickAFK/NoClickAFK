function bogatkaMemberInitial(value=''){
  const clean=String(value||'').trim();
  return clean ? clean[0].toUpperCase() : 'У';
}

if(typeof cloudLoadMembers==='function'){
  cloudLoadMembers=async function(){
    const root=document.querySelector('#cloudMembers');
    if(!root||!cloudProjectId||cloudRole!=='owner')return;
    const {data:members,error}=await cloudClient
      .from('project_members')
      .select('user_id,role,created_at')
      .eq('project_id',cloudProjectId)
      .order('created_at');
    if(error)throw new Error(error.message);

    const ids=(members||[]).map(item=>item.user_id);
    let profiles=[];
    if(ids.length){
      const result=await cloudClient.from('profiles').select('id,email,display_name').in('id',ids);
      if(result.error)throw new Error(result.error.message);
      profiles=result.data||[];
    }

    const profileMap=new Map(profiles.map(item=>[item.id,item]));
    root.innerHTML=(members||[]).map(member=>{
      const profile=profileMap.get(member.user_id)||{};
      const name=profile.display_name||profile.email||'Участник';
      const email=profile.email||'';
      return `<div class="cloud-member-premium">
        <div class="cloud-member-avatar" aria-hidden="true">${esc(bogatkaMemberInitial(name))}</div>
        <div class="cloud-member-identity">
          <div class="cloud-member-name">${esc(name)}</div>
          ${email?`<div class="cloud-member-email">${esc(email)}</div>`:''}
        </div>
        <span class="cloud-member-role">${esc(cloudRoleLabel(member.role))}</span>
      </div>`;
    }).join('')||'<div class="cloud-member-empty">Участников пока нет.</div>';
  };
}

function bogatkaEnhanceMembers(){
  const inviteButton=document.querySelector('#cloudInviteForm>button[type="submit"]');
  if(inviteButton){
    inviteButton.classList.remove('secondary');
    inviteButton.textContent='Добавить участника';
  }
  if(document.querySelector('#cloudMembers')&&typeof cloudLoadMembers==='function'){
    cloudLoadMembers().catch(error=>typeof cloudHandleError==='function'&&cloudHandleError(error));
  }
}

const bogatkaMembersObserver=new MutationObserver(()=>{
  clearTimeout(window.__bogatkaMembersTimer);
  window.__bogatkaMembersTimer=setTimeout(bogatkaEnhanceMembers,60);
});
bogatkaMembersObserver.observe(document.body,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bogatkaEnhanceMembers,{once:true});
else bogatkaEnhanceMembers();
