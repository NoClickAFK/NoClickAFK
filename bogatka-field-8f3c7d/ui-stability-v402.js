(function(){
  if(window.__bogatkaUiStabilityV402)return;
  window.__bogatkaUiStabilityV402=true;
  if(typeof updateSummary!=='function')return;

  const baseUpdateSummary=updateSummary;
  let pending=false;
  let refreshTimer=null;
  let running=null;
  let lastInteractionAt=0;

  const editorSelector='#app input:not([type="button"]):not([type="submit"]):not([type="file"]),#app textarea,#app select,#app [contenteditable="true"]';

  function isEditing(){
    if(document.hidden)return false;
    const active=document.activeElement;
    if(active?.matches?.(editorSelector))return true;
    return Date.now()-lastInteractionAt<700;
  }

  function markInteraction(){lastInteractionAt=Date.now()}
  for(const name of ['pointerdown','touchstart','keydown','input','change','focusin','focusout'])document.addEventListener(name,markInteraction,true);

  async function runFullRefresh(){
    if(running)return running;
    running=Promise.resolve(baseUpdateSummary()).finally(()=>{running=null});
    return running;
  }

  function requestRefresh(delay=900){
    pending=true;
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(async()=>{
      if(isEditing()){
        requestRefresh(700);
        return;
      }
      pending=false;
      try{await runFullRefresh()}catch(error){console.error(error)}
    },Math.max(100,delay));
  }

  async function stableUpdateSummary(){
    if(isEditing()){
      requestRefresh(900);
      return;
    }
    pending=false;
    clearTimeout(refreshTimer);
    return runFullRefresh();
  }

  window.updateSummary=stableUpdateSummary;
  try{updateSummary=stableUpdateSummary}catch(_){}

  window.BogatkaUIStability={
    version:'4.0.2',
    isEditing,
    requestRefresh,
    flush:async()=>{
      if(isEditing())return false;
      pending=false;
      clearTimeout(refreshTimer);
      await runFullRefresh();
      return true;
    },
    get pending(){return pending},
    principle:'never-reorder-or-rebuild-cards-while-editing',
  };
})();
