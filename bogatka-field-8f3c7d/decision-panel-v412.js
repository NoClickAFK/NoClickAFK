(function(){
  if(window.BogatkaDecisionPanel?.ready)return;
  const descriptions={
    'Оставить':'перейти к следующему этапу',
    'Под вопросом':'нужны дополнительные данные',
    'Исключить':'не рассматривать дальше',
  };
  function refresh(panel){
    panel.querySelectorAll('label[data-decision-value]').forEach(label=>label.classList.toggle('selected',Boolean(label.querySelector('input')?.checked)));
  }
  function enhance(panel){
    if(!panel||panel.dataset.decisionPanelV412==='1')return;
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
    refresh(panel);
  }
  function enhanceAll(){document.querySelectorAll('.decision').forEach(enhance)}
  const observer=new MutationObserver(()=>requestAnimationFrame(enhanceAll));
  function install(){
    const root=document.getElementById('locations');
    if(!root)return;
    observer.observe(root,{childList:true,subtree:true});
    enhanceAll();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.BogatkaDecisionPanel={version:'4.1.2',ready:true,enhanceAll};
})();
