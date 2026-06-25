(function(){
  const S=window.BogatkaSuite;
  if(!S)return;
  const base=S.permanentlyDeleteArchived;
  S.permanentlyDeleteArchived=async function(id){
    const item=locations.find(location=>location.id===id);
    if(!item?.custom)return alert('Предустановленную локацию можно архивировать, но нельзя удалить окончательно.');
    return base(id);
  };
  function apply(){
    document.querySelectorAll('[data-archive-delete]').forEach(button=>{
      const item=locations.find(location=>location.id===button.dataset.archiveDelete);
      button.classList.toggle('hidden',!item?.custom);
    });
  }
  apply();
  let timer=null;
  new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(apply,40)}).observe(document.body,{childList:true,subtree:true});
})();
