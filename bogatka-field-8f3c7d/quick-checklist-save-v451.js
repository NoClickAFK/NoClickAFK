(function(){
  'use strict';
  if(window.BogatkaQuickChecklistSaveV451?.ready)return;

  const VERSION='4.5.1';
  let attempts=0;

  function checklistProxy(element){
    const field=String(element?.dataset?.field||'');
    if(!field.startsWith('check.'))return null;
    const row=element.closest?.('.check-row');
    const label=row?.querySelector(':scope > span')?.textContent?.trim()||field;
    return{
      dataset:element.dataset,
      type:element.type,
      value:element.value,
      checked:Boolean(element.checked),
      closest(selector){
        if(selector==='label')return{childNodes:[{textContent:label}]};
        return element.closest?.(selector)||null;
      },
    };
  }

  function install(){
    attempts+=1;
    const current=window.saveField;
    if(typeof current!=='function'){
      if(attempts<160)setTimeout(install,80);
      return false;
    }
    if(current.__quickChecklistSaveV451)return true;
    const wrapped=function(element){
      return current(checklistProxy(element)||element);
    };
    wrapped.__quickChecklistSaveV451=true;
    wrapped.__base=current;
    window.saveField=wrapped;
    try{saveField=wrapped}catch(_){ }
    if(attempts<160)setTimeout(install,80);
    return true;
  }

  install();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  window.addEventListener('load',()=>setTimeout(install,40),{once:true});
  [400,900,1500,2600].forEach(delay=>setTimeout(install,delay));

  window.BogatkaQuickChecklistSaveV451={
    version:VERSION,
    ready:true,
    install,
    checklistProxy,
  };
})();
