(function(){
  'use strict';
  if(window.BogatkaPublicLocationDataV452?.installed)return;

  const VERSION='4.5.2';
  const LABELS={unchecked:'Не проверено',yes:'Да',no:'Нет',not_applicable:'Не требуется'};
  const escapeValue=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function normalizeState(value){
    if(value===true||value===1)return'yes';
    if(value===false||value===0||value===null||value===undefined||value==='')return'unchecked';
    const text=String(value).trim().toLowerCase();
    if(['yes','true','confirmed','да','есть','подтверждено'].includes(text))return'yes';
    if(['no','нет','отсутствует','не подтверждено'].includes(text))return'no';
    if(['not_applicable','not_required','n/a','не требуется','не применимо'].includes(text))return'not_applicable';
    return'unchecked';
  }

  function renderExplicitChecklist(data={}){
    const groups={};
    for(const [key,label,group] of (typeof CHECKLIST!=='undefined'?CHECKLIST:[])){
      const state=normalizeState(data?.check?.[key]);
      (groups[group]||=[]).push({label,state});
    }
    const entries=Object.entries(groups);
    if(!entries.length)return'<p class="empty">Пункты чек-листа отсутствуют.</p>';
    return `<div class="check-grid checklist-public-v452">${entries.map(([group,items])=>`<div class="check-group"><h4>${escapeValue(group)}</h4><ul>${items.map(item=>`<li class="check-state-${item.state}-v452"><span>${escapeValue(item.label)}</span><b>${LABELS[item.state]}</b></li>`).join('')}</ul></div>`).join('')}</div>`;
  }

  function installStyle(){
    if(document.getElementById('locationDataPublicStyleV452'))return;
    const style=document.createElement('style');
    style.id='locationDataPublicStyleV452';
    style.textContent='.checklist-public-v452 .check-group ul{display:grid;gap:6px;padding:0;margin:8px 0 0;list-style:none}.checklist-public-v452 .check-group li{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:7px 8px;border:1px solid #dce6e1;border-radius:9px;background:#fff;font-size:11px}.checklist-public-v452 .check-group li b{min-width:86px;padding:4px 7px;border-radius:7px;text-align:center;font-size:9px}.checklist-public-v452 .check-state-yes-v452 b{background:#e8f5ed;color:#246043}.checklist-public-v452 .check-state-no-v452 b{background:#fff0f0;color:#8b3434}.checklist-public-v452 .check-state-not_applicable-v452 b{background:#f1f3f2;color:#66746d}.checklist-public-v452 .check-state-unchecked-v452 b{background:#fff8e9;color:#85611c}';
    document.head.appendChild(style);
  }

  function install(){
    installStyle();
    try{renderChecklist=renderExplicitChecklist}catch(_){ }
    window.renderChecklist=renderExplicitChecklist;
  }

  install();
  setTimeout(()=>{
    install();
    try{if(typeof loadReport==='function')loadReport()}catch(_){ }
  },0);
  window.BogatkaPublicLocationDataV452={version:VERSION,ready:true,installed:true,normalizeState,renderExplicitChecklist,install};
})();
