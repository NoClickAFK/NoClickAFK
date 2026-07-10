(function(){
  if(window.BogatkaDecisionPanel?.ready)return;
  const descriptions={
    'Оставить':'перейти к следующему этапу',
    'Под вопросом':'нужны дополнительные данные',
    'Исключить':'не рассматривать дальше',
  };
  const stateKey=id=>`bogatka_decision_reason_open_v412:${id}`;
  const OPTIONAL_HINT='Необязательно — можно кратко зафиксировать аргументы решения';
  let observerFrame=0;
  const filled=value=>String(value||'').trim()!=='';
  const currentRole=()=>{
    let lexical=null;
    try{lexical=typeof cloudRole==='undefined'?null:cloudRole}catch(_){ }
    const exposed=window.cloudRole??null;
    if(lexical==='viewer'||exposed==='viewer')return 'viewer';
    return exposed??lexical;
  };
  const isViewer=()=>currentRole()==='viewer';
  const setAttr=(node,name,value)=>{if(node&&node.getAttribute(name)!==String(value))node.setAttribute(name,String(value))};
  const setData=(node,name,value)=>{if(node&&node.dataset[name]!==String(value))node.dataset[name]=String(value)};
  const setHidden=(node,value)=>{if(node&&node.hidden!==Boolean(value))node.hidden=Boolean(value)};
  const setDisabled=(node,value)=>{if(node&&node.disabled!==Boolean(value))node.disabled=Boolean(value)};
  const setRequired=(node,value)=>{if(node&&node.required!==Boolean(value))node.required=Boolean(value)};

  function refresh(panel){
    panel.querySelectorAll('label[data-decision-value]').forEach(label=>{
      const selected=Boolean(label.querySelector('input')?.checked);
      if(label.classList.contains('selected')!==selected)label.classList.toggle('selected',selected);
    });
  }
  function enhanceDecision(panel){
    if(!panel)return;
    if(panel.dataset.decisionPanelV412!=='1'){
      panel.dataset.decisionPanelV412='1';
      panel.classList.add('decision-panel-v412');
      const labels=[...panel.querySelectorAll(':scope > label')];
      const copy=document.createElement('div');
      copy.className='decision-copy-v412';
      copy.innerHTML='<strong>Предварительное решение по локации</strong><p>Зафиксируйте текущий вывод после осмотра. Решение можно изменить позже; оно используется в общей сводке и определяет, переходить ли к проекту открытия магазина.</p>';
      const actions=document.createElement('div');
      actions.className='decision-actions-v412';
      for(const label of labels){
        const input=label.querySelector('input');
        if(!input)continue;
        const value=input.value;
        label.dataset.decisionValue=value;
        const text=document.createElement('span');
        text.className='decision-option-copy-v412';
        text.innerHTML=`<strong>${value}</strong><small>${descriptions[value]||''}</small>`;
        label.replaceChildren(input,text);
        input.addEventListener('change',()=>refresh(panel));
        actions.appendChild(label);
      }
      panel.replaceChildren(copy,actions);
    }
    refresh(panel);
  }
  function decisionValue(card){return card.querySelector('input[type="radio"][data-field="decision"]:checked')?.value||''}
  function reasonControl(card){return card.querySelector('.decision-reason-section-v412 [data-field="decisionReason"]')}

  function syncOpenState(section){
    if(!section)return;
    const open=Boolean(section.open);
    const summary=section.querySelector(':scope > summary');
    const body=section.querySelector(':scope > .decision-reason-body-v412');
    setAttr(summary,'aria-expanded',String(open));
    setHidden(body,!open);
    setAttr(body,'aria-hidden',String(!open));
  }
  function setOpen(section,open,{persist=true}={}){
    if(!section)return;
    const next=Boolean(open);
    if(section.open!==next)section.open=next;
    syncOpenState(section);
    const id=section.closest('[data-location-card]')?.dataset.locationCard;
    if(persist&&id)try{localStorage.setItem(stateKey(id),next?'1':'0')}catch(_){ }
  }
  function persistedValue(control){return control?.dataset.decisionReasonPersistedV412??''}
  function setPersisted(control,value){setData(control,'decisionReasonPersistedV412',String(value??''))}
  function setMessage(section,text,state='idle'){
    const node=section?.querySelector('[data-decision-reason-feedback-v412]');
    if(!node)return;
    if(node.textContent!==text)node.textContent=text;
    setData(node,'state',state);
  }
  function reasonStatusModel(card,control){
    const decision=decisionValue(card);
    const current=String(control?.value??'');
    const persisted=persistedValue(control);
    const dirty=current!==persisted;
    if(dirty)return{label:'Есть изменения',semantic:'dirty',dirty,missing:false,decision,current};
    if(filled(current))return{label:'Сохранено',semantic:'saved',dirty,missing:false,decision,current};
    if(filled(decision))return{label:'Необязательно',semantic:'optional',dirty,missing:false,decision,current};
    return{label:'Не заполнено',semantic:'empty',dirty,missing:false,decision,current};
  }
  function syncReasonState(card,{message=''}={}){
    const section=card?.querySelector('.decision-reason-section-v412');
    const control=reasonControl(card);
    if(!section||!control)return;
    const model=reasonStatusModel(card,control);
    const status=section.querySelector('[data-decision-reason-status-v412]');
    if(status){
      if(status.textContent!==model.label)status.textContent=model.label;
      setData(status,'state',model.semantic);
    }
    setData(section,'reasonState',model.semantic);
    setData(section,'requiredMissing','false');
    setRequired(control,false);
    setAttr(control,'aria-required','false');
    const save=section.querySelector('[data-decision-reason-save-v412]');
    setDisabled(save,isViewer()||!model.dirty);
    setDisabled(control,isViewer());
    section.querySelector('.decision-reason-warning-v452')?.setAttribute('hidden','');
    if(message)setMessage(section,message,model.semantic);
    else if(model.dirty)setMessage(section,'Есть несохранённые изменения','dirty');
    else if(model.semantic==='saved')setMessage(section,'Причина сохранена','saved');
    else setMessage(section,OPTIONAL_HINT,'optional');
  }
  async function flushReason(card,{explicit=true}={}){
    const section=card?.querySelector('.decision-reason-section-v412');
    const control=reasonControl(card);
    if(!section||!control||isViewer())return false;
    if(control.value===persistedValue(control)){
      syncReasonState(card);
      return true;
    }
    clearTimeout(control._locationDataSaveTimerV452);
    control._locationDataSaveTimerV452=null;
    setMessage(section,'Сохраняем…','saving');
    const button=section.querySelector('[data-decision-reason-save-v412]');
    setDisabled(button,true);
    try{
      if(typeof saveField!=='function')throw new Error('Не найдена функция сохранения поля.');
      await saveField(control);
      setPersisted(control,control.value);
      syncReasonState(card,{message:filled(control.value)?'Причина сохранена':OPTIONAL_HINT});
      return true;
    }catch(error){
      setOpen(section,true);
      setMessage(section,error?.message||String(error),'error');
      setDisabled(button,false);
      if(explicit&&typeof showError==='function')showError(error);
      return false;
    }
  }
  function ensureReasonSection(card){
    const old=card.querySelector('.decision-reason-v452');
    const locationId=card.dataset.locationCard;
    if(!old||!locationId)return card.querySelector('.decision-reason-section-v412');
    const existing=card.querySelector('.decision-reason-section-v412');
    if(existing)return existing;
    const control=old.querySelector('[data-field="decisionReason"],textarea');
    if(!control)return null;
    control.dataset.location=locationId;
    control.dataset.field='decisionReason';
    control.dataset.locationDataV452='1';
    control.rows=5;
    control.placeholder='Например:\n— подходящий поток и район;\n— приемлемая аренда;\n— требуется письменное подтверждение разгрузки.';
    control.required=false;
    control.setAttribute('aria-required','false');
    old.querySelector('.decision-reason-warning-v452')?.remove();
    const section=document.createElement('details');
    section.className='decision-reason-section-v412 decision-reason-v452';
    section.dataset.decisionReasonV412='1';
    section.dataset.requiredMissing='false';
    section.innerHTML='<summary class="decision-reason-toggle-v412" aria-expanded="false"><span class="decision-reason-copy-v412"><strong class="decision-reason-title-v412">Причина решения</strong><span class="decision-reason-description-v412">Необязательно — можно кратко зафиксировать аргументы решения.</span></span><span class="decision-reason-status-v412" data-decision-reason-status-v412>Не заполнено</span><i class="decision-reason-chevron-v412" aria-hidden="true"></i></summary><div class="decision-reason-body-v412" hidden aria-hidden="true"><p class="decision-reason-helper-v412">Необязательно — можно кратко зафиксировать аргументы решения.</p><div class="decision-reason-control-v412"></div><div class="decision-reason-actions-v412"><button type="button" class="btn secondary small decision-reason-save-v412" data-decision-reason-save-v412>Сохранить причину</button><small data-decision-reason-feedback-v412>Необязательно — можно кратко зафиксировать аргументы решения</small></div></div>';
    section.querySelector('.decision-reason-control-v412').append(control);
    old.replaceWith(section);
    try{section.open=localStorage.getItem(stateKey(locationId))==='1'}catch(_){section.open=false}
    syncOpenState(section);
    section.addEventListener('toggle',()=>{
      syncOpenState(section);
      try{localStorage.setItem(stateKey(locationId),section.open?'1':'0')}catch(_){ }
    });
    control.addEventListener('input',()=>syncReasonState(card));
    control.addEventListener('blur',()=>syncReasonState(card));
    section.querySelector('[data-decision-reason-save-v412]').addEventListener('click',()=>flushReason(card));
    card.querySelectorAll('input[type="radio"][data-field="decision"]').forEach(radio=>{
      if(radio.dataset.decisionReasonSectionBoundV412==='1')return;
      radio.dataset.decisionReasonSectionBoundV412='1';
      radio.addEventListener('change',()=>{
        refresh(radio.closest('.decision'));
        syncReasonState(card);
      });
    });
    return section;
  }
  async function enhanceCard(card){
    if(!card?.dataset?.locationCard)return false;
    const panel=card.querySelector('.decision');
    enhanceDecision(panel);
    const section=ensureReasonSection(card);
    if(!section)return false;
    const control=reasonControl(card);
    if(control){
      const data=typeof getLocationData==='function'?await getLocationData(card.dataset.locationCard):{};
      const stored=String(data?.decisionReason||'');
      const safe=document.activeElement!==control&&control.dataset.locationDataDirtyV452!=='1';
      if(safe){
        window.BogatkaLocationDataStabilityV452?.acceptAuthoritativeControl?.(control);
        if(control.value!==stored)control.value=stored;
        setPersisted(control,stored);
      }
      control.required=false;
      control.setAttribute('aria-required','false');
    }
    section.dataset.requiredMissing='false';
    syncOpenState(section);
    syncReasonState(card);
    return true;
  }
  async function enhanceAll(){for(const card of document.querySelectorAll('[data-location-card]'))await enhanceCard(card)}
  function openReason(card,{focus=false}={}){
    const section=card?.querySelector('.decision-reason-section-v412');
    if(!section)return false;
    setOpen(section,true);
    if(focus)reasonControl(card)?.focus({preventScroll:true});
    return true;
  }
  const observer=new MutationObserver(()=>{
    if(observerFrame)return;
    observerFrame=requestAnimationFrame(()=>{
      observerFrame=0;
      enhanceAll().catch(console.error);
    });
  });
  function install(){
    const root=document.getElementById('locations');
    if(!root)return;
    observer.observe(root,{childList:true,subtree:true});
    enhanceAll().catch(console.error);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.BogatkaDecisionPanel={version:'4.1.2',ready:true,enhanceAll,enhanceCard,openReason,flushReason,syncReasonState,reasonStatusModel};
})();
