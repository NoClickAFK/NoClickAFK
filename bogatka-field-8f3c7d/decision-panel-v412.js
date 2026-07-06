(function(){
  if(window.BogatkaDecisionPanel?.ready)return;
  const descriptions={
    'Оставить':'перейти к следующему этапу',
    'Под вопросом':'нужны дополнительные данные',
    'Исключить':'не рассматривать дальше',
  };
  const stateKey=id=>`bogatka_decision_reason_open_v412:${id}`;
  let saveWrapperAttempts=0;
  const filled=value=>String(value||'').trim()!=='';
  const currentRole=()=>{
    let lexical=null;
    try{lexical=typeof cloudRole==='undefined'?null:cloudRole}catch(_){ }
    const exposed=window.cloudRole??null;
    if(lexical==='viewer'||exposed==='viewer')return 'viewer';
    return exposed??lexical;
  };
  const isViewer=()=>currentRole()==='viewer';
  function refresh(panel){
    panel.querySelectorAll('label[data-decision-value]').forEach(label=>label.classList.toggle('selected',Boolean(label.querySelector('input')?.checked)));
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
  function setOpen(section,open,{persist=true}={}){
    if(!section)return;
    section.open=Boolean(open);
    const id=section.closest('[data-location-card]')?.dataset.locationCard;
    if(persist&&id)try{localStorage.setItem(stateKey(id),open?'1':'0')}catch(_){ }
  }
  function persistedValue(control){return control?.dataset.decisionReasonPersistedV412??''}
  function setPersisted(control,value){if(control)control.dataset.decisionReasonPersistedV412=String(value??'')}
  function setMessage(section,text,state='idle'){
    const node=section?.querySelector('[data-decision-reason-feedback-v412]');
    if(node){node.textContent=text;node.dataset.state=state;}
  }
  function syncReasonState(card,{validate=false,message=''}={}){
    const section=card?.querySelector('.decision-reason-section-v412');
    const control=reasonControl(card);
    if(!section||!control)return;
    const decision=decisionValue(card);
    const dirty=control.value!==persistedValue(control);
    const missing=filled(decision)&&!filled(control.value);
    const focused=document.activeElement===control;
    const status=section.querySelector('[data-decision-reason-status-v412]');
    let label='Не выбрано',semantic='empty';
    if(dirty){label='Есть изменения';semantic='dirty';}
    else if(!filled(decision)){label='Не выбрано';semantic='empty';}
    else if(missing){label='Нужно заполнить';semantic='required';}
    else if(filled(control.value)){label='Сохранено';semantic='saved';}
    if(status){status.textContent=label;status.dataset.state=semantic;}
    section.dataset.reasonState=semantic;
    section.dataset.requiredMissing=String(missing&&validate&&!focused);
    control.required=filled(decision);
    control.setAttribute('aria-required',String(filled(decision)));
    const save=section.querySelector('[data-decision-reason-save-v412]');
    if(save)save.disabled=isViewer()||!dirty||(missing&&!filled(control.value));
    control.disabled=isViewer();
    if(message)setMessage(section,message,semantic);
    else if(dirty)setMessage(section,'Есть несохранённые изменения','dirty');
    else if(missing&&validate&&!focused)setMessage(section,'Укажите причину выбранного решения.','error');
    else if(filled(control.value))setMessage(section,'Причина сохранена','saved');
    else setMessage(section,'Причина пока не заполнена','idle');
  }
  async function flushReason(card,{explicit=true}={}){
    const section=card?.querySelector('.decision-reason-section-v412');
    const control=reasonControl(card);
    if(!section||!control||isViewer())return false;
    const decision=decisionValue(card);
    if(filled(decision)&&!filled(control.value)){
      setOpen(section,true);
      syncReasonState(card,{validate:true,message:'Укажите причину выбранного решения.'});
      return false;
    }
    if(control.value===persistedValue(control)){
      syncReasonState(card,{validate:true});
      return true;
    }
    clearTimeout(control._locationDataSaveTimerV452);
    control._locationDataSaveTimerV452=null;
    setMessage(section,'Сохраняем…','saving');
    const button=section.querySelector('[data-decision-reason-save-v412]');
    if(button)button.disabled=true;
    try{
      if(typeof saveField!=='function')throw new Error('Не найдена функция сохранения поля.');
      await saveField(control);
      setPersisted(control,control.value);
      syncReasonState(card,{validate:true,message:'Причина сохранена'});
      return true;
    }catch(error){
      setOpen(section,true);
      setMessage(section,error?.message||String(error),'error');
      if(button)button.disabled=false;
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
    old.querySelector('.decision-reason-warning-v452')?.remove();
    const section=document.createElement('details');
    section.className='decision-reason-section-v412';
    section.dataset.decisionReasonV412='1';
    section.innerHTML='<summary class="decision-reason-toggle-v412"><span class="decision-reason-title-v412">Причина решения</span><span class="decision-reason-status-v412" data-decision-reason-status-v412>Не выбрано</span><i class="decision-reason-chevron-v412" aria-hidden="true"></i></summary><div class="decision-reason-body-v412"><p class="decision-reason-helper-v412">Укажите основные причины решения. Если причин несколько, запишите каждую с новой строки.</p><div class="decision-reason-control-v412"></div><div class="decision-reason-actions-v412"><button type="button" class="btn secondary" data-decision-reason-save-v412>Сохранить причину</button><small data-decision-reason-feedback-v412>Причина пока не заполнена</small></div></div>';
    section.querySelector('.decision-reason-control-v412').append(control);
    old.replaceWith(section);
    try{section.open=localStorage.getItem(stateKey(locationId))==='1'}catch(_){section.open=false}
    section.addEventListener('toggle',()=>{try{localStorage.setItem(stateKey(locationId),section.open?'1':'0')}catch(_){ }});
    control.addEventListener('input',()=>syncReasonState(card));
    control.addEventListener('blur',()=>syncReasonState(card,{validate:true}));
    section.querySelector('[data-decision-reason-save-v412]').addEventListener('click',()=>flushReason(card));
    card.querySelectorAll('input[type="radio"][data-field="decision"]').forEach(radio=>{
      if(radio.dataset.decisionReasonSectionBoundV412==='1')return;
      radio.dataset.decisionReasonSectionBoundV412='1';
      radio.addEventListener('change',()=>{
        refresh(radio.closest('.decision'));
        if(filled(decisionValue(card))&&!filled(control.value))setOpen(section,true);
        syncReasonState(card,{validate:true});
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
    if(control&&!control.dataset.decisionReasonPersistedV412){
      const data=typeof getLocationData==='function'?await getLocationData(card.dataset.locationCard):{};
      if(document.activeElement!==control&&control.dataset.locationDataDirtyV452!=='1')control.value=String(data?.decisionReason||'');
      setPersisted(control,String(data?.decisionReason||''));
    }
    if(filled(decisionValue(card))&&!filled(control?.value)&&section.dataset.initialMissingOpenedV412!=='1'){
      section.dataset.initialMissingOpenedV412='1';
      setOpen(section,true,{persist:false});
    }
    syncReasonState(card,{validate:false});
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
  function installSaveWrapper(){
    saveWrapperAttempts++;
    if(typeof window.saveField!=='function'&&typeof saveField!=='function')return false;
    const current=window.saveField||saveField;
    if(current.__decisionReasonFeedbackV412)return true;
    const wrapped=async function(element,...args){
      const result=await current(element,...args);
      if(element?.dataset?.field==='decisionReason'){
        setPersisted(element,element.value);
        const card=element.closest('[data-location-card]');
        if(card)syncReasonState(card,{validate:true,message:'Причина сохранена'});
      }
      return result;
    };
    wrapped.__decisionReasonFeedbackV412=true;
    wrapped.__base=current;
    window.saveField=wrapped;
    try{saveField=wrapped}catch(_){ }
    return true;
  }
  const observer=new MutationObserver(()=>requestAnimationFrame(()=>enhanceAll().catch(console.error)));
  function install(){
    const root=document.getElementById('locations');
    if(!root)return;
    installSaveWrapper();
    observer.observe(root,{childList:true,subtree:true});
    enhanceAll().catch(console.error);
    [100,400,1000,2500].forEach(delay=>setTimeout(()=>{installSaveWrapper();enhanceAll().catch(console.error)},delay));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.BogatkaDecisionPanel={version:'4.1.2',ready:true,enhanceAll,enhanceCard,openReason,flushReason,syncReasonState,installSaveWrapper};
})();
