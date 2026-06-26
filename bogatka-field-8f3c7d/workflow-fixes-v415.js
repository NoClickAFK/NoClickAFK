(function(){
  if(window.BogatkaWorkflowFixesV415?.ready)return;

  const VERSION='4.1.5';
  let enhanceTimer=null;

  function bindCommentReset(form){
    if(!form||form.dataset.commentResetV415==='1')return;
    form.dataset.commentResetV415='1';
    form.addEventListener('submit',event=>{
      const textarea=form.querySelector('textarea[name="text"]');
      const card=form.closest('[data-location-card]');
      const id=card?.dataset.locationCard||'';
      const submitted=textarea?.value.trim()||'';
      if(!textarea||!id||!submitted)return;

      const countNode=card.querySelector(`[data-comment-count="${CSS.escape(id)}"]`);
      const beforeCount=Number(countNode?.textContent||0);
      let attempt=0;

      const clearAfterSave=async()=>{
        attempt+=1;
        try{
          const data=await getLocationData(id);
          const comments=Array.isArray(data.comments)?data.comments:[];
          if(comments.length>beforeCount){
            form.reset();
            textarea.value='';
            textarea.defaultValue='';
            textarea.dispatchEvent(new Event('input',{bubbles:true}));
            return;
          }
        }catch(error){
          console.warn('Не удалось проверить сохранение комментария',error);
        }
        if(attempt<50)setTimeout(clearAfterSave,60);
      };

      setTimeout(clearAfterSave,0);
    },true);
  }

  function enhanceTaskPriority(form){
    const select=form?.querySelector('select[name="priority"]');
    if(!select)return;
    select.classList.add('task-priority-select-v415');
    const trigger=select.nextElementSibling;
    if(trigger?.classList.contains('premium-select-trigger'))trigger.classList.add('task-priority-trigger-v415');
  }

  function enhance(root=document){
    root.querySelectorAll?.('.comment-form-v400').forEach(bindCommentReset);
    root.querySelectorAll?.('.task-form-v400').forEach(enhanceTaskPriority);
  }

  function scheduleEnhance(delay=40){
    clearTimeout(enhanceTimer);
    enhanceTimer=setTimeout(()=>enhance(),delay);
  }

  document.addEventListener('pointerdown',event=>{
    const trigger=event.target.closest('.premium-select-trigger');
    if(!trigger)return;
    requestAnimationFrame(()=>{
      const menu=document.querySelector('.premium-select-menu.open');
      if(menu)menu.classList.toggle('task-priority-menu-v415',trigger.classList.contains('task-priority-trigger-v415'));
    });
  },true);

  const observer=new MutationObserver(()=>scheduleEnhance(50));
  function install(){
    const root=document.getElementById('locations')||document.body;
    observer.observe(root,{childList:true,subtree:true});
    enhance(root);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.BogatkaWorkflowFixesV415={version:VERSION,ready:true,enhance};
})();
