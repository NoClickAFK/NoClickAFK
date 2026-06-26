(function(){
  if(window.__bogatkaVisualV411)return;
  window.__bogatkaVisualV411=true;

  let observer=null;
  let scheduled=false;

  function pluralizeLinks(count){
    const mod10=count%10;
    const mod100=count%100;
    if(mod10===1&&mod100!==11)return `${count} ссылка`;
    if(mod10>=2&&mod10<=4&&(mod100<12||mod100>14))return `${count} ссылки`;
    return `${count} ссылок`;
  }

  function updateInvitationCount(history,badge){
    if(!history||!badge)return;
    const count=history.querySelectorAll(':scope > .invite-row-v408').length;
    badge.textContent=pluralizeLinks(count);
  }

  function setAccordionState(section,trigger,panel,open){
    section.classList.toggle('open',open);
    trigger.setAttribute('aria-expanded',String(open));
    panel.setAttribute('aria-hidden',String(!open));
  }

  function enhanceInvitationHistory(){
    const history=document.querySelector('#bogatkaInviteHistory');
    const section=history?.closest('.collaboration-list-section-v410');
    if(!history||!section||section.dataset.accordionV411==='1')return false;

    section.dataset.accordionV411='1';
    section.classList.add('collaboration-accordion-v411');

    const oldTitle=section.querySelector(':scope > .collaboration-section-title-v410');
    const trigger=document.createElement('button');
    trigger.type='button';
    trigger.className='collaboration-accordion-trigger-v411';
    trigger.id='inviteHistoryToggleV411';
    trigger.setAttribute('aria-expanded','false');
    trigger.setAttribute('aria-controls','inviteHistoryPanelV411');
    trigger.innerHTML='<span class="collaboration-accordion-copy-v411"><strong>История приглашений</strong><small>Все созданные ссылки и их статус</small></span><span class="collaboration-accordion-count-v411" id="inviteHistoryCountV411">0 ссылок</span><span class="collaboration-accordion-chevron-v411" aria-hidden="true"></span>';

    const panel=document.createElement('div');
    panel.className='collaboration-accordion-panel-v411';
    panel.id='inviteHistoryPanelV411';
    panel.setAttribute('role','region');
    panel.setAttribute('aria-labelledby',trigger.id);
    panel.setAttribute('aria-hidden','true');

    const inner=document.createElement('div');
    inner.className='collaboration-accordion-inner-v411';
    panel.appendChild(inner);

    if(oldTitle)oldTitle.replaceWith(trigger);
    else section.prepend(trigger);
    inner.appendChild(history);
    section.appendChild(panel);

    const badge=trigger.querySelector('#inviteHistoryCountV411');
    updateInvitationCount(history,badge);

    const countObserver=new MutationObserver(()=>updateInvitationCount(history,badge));
    countObserver.observe(history,{childList:true});

    trigger.addEventListener('click',()=>{
      const open=trigger.getAttribute('aria-expanded')!=='true';
      setAccordionState(section,trigger,panel,open);
    });

    setAccordionState(section,trigger,panel,false);
    return true;
  }

  function runEnhancement(){
    scheduled=false;
    enhanceInvitationHistory();
  }

  function scheduleEnhancement(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(runEnhancement);
  }

  function install(){
    const modal=document.querySelector('#cloudModal');
    if(!modal)return;
    if(!observer){
      observer=new MutationObserver(scheduleEnhancement);
      observer.observe(modal,{childList:true,subtree:true});
    }
    scheduleEnhancement();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  window.addEventListener('load',install,{once:true});
  window.addEventListener('bogatka:invite-accepted',scheduleEnhancement);

  window.BogatkaVisualPolish={
    version:'4.1.1',
    enhanceInvitationHistory,
    get historyOpen(){return document.querySelector('.collaboration-accordion-v411')?.classList.contains('open')||false},
  };
})();
