(function(){
  if(window.BogatkaLocationOverviewGuardV418?.ready)return;

  const FIELD_ORDER=['rent','ownerName','contact','contactPhone','contactMessenger','contactEmail','rentConditions','contactNotes'];

  function fieldOf(node){
    return node?.querySelector?.('[data-field]')?.dataset.field||'';
  }

  function desiredNodes(grid){
    return FIELD_ORDER.map(field=>[...grid.children].find(node=>fieldOf(node)===field)).filter(Boolean);
  }

  function alreadyOrdered(grid){
    const desired=desiredNodes(grid);
    const current=[...grid.children].filter(node=>FIELD_ORDER.includes(fieldOf(node)));
    return current.length===desired.length&&current.every((node,index)=>node===desired[index]);
  }

  function protect(grid){
    if(!grid||grid.dataset.landlordOrderGuardV418==='1')return;
    grid.dataset.landlordOrderGuardV418='1';
    const nativeAppendChild=grid.appendChild.bind(grid);
    grid.appendChild=function guardedAppendChild(node){
      if(node?.parentNode===grid&&alreadyOrdered(grid))return node;
      return nativeAppendChild(node);
    };
  }

  function protectAll(){
    document.querySelectorAll('.landlord-grid-v416').forEach(protect);
  }

  function install(){
    const root=document.getElementById('locations')||document.body;
    protectAll();
    new MutationObserver(protectAll).observe(root,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();

  window.BogatkaLocationOverviewGuardV418={version:'4.1.8',ready:true,protectAll,alreadyOrdered};
})();
