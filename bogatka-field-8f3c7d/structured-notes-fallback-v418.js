(function(){
  if(window.BogatkaStructuredNotesFallbackV418?.ready)return;

  const FIELDS=[
    ['pros','Главные плюсы','Что реально усиливает локацию: поток, район, помещение, условия.'],
    ['cons','Главные минусы','Что снижает привлекательность и потребует компромисса.'],
    ['risks','Риски / подводные камни','Что может сорвать запуск, увеличить бюджет или сроки.'],
    ['questions','Что уточнить у арендодателя','Вопросы по договору, платежам, ремонту, режиму и ограничениям.'],
    ['formatIdea','Идея формата магазина','Какой формат и ассортимент лучше подходят именно этой точке.'],
    ['notes','Дополнительные заметки','Любая важная информация, которая не вошла в остальные поля.']
  ];

  function apply(){
    let changed=false;
    document.querySelectorAll('[data-location-card]').forEach(card=>{
      const pane=card.querySelector('[data-collab-pane="comments"]');
      const notes=card.querySelector('.notes-grid');
      if(!pane||!notes||pane.querySelector('.structured-notes-v414'))return;

      const block=document.createElement('div');
      block.className='structured-notes-v414';
      const head=document.createElement('div');
      head.className='structured-notes-head-v414';
      const strong=document.createElement('strong');
      strong.textContent='Выводы и рабочие заметки';
      const help=document.createElement('span');
      help.textContent='Эти поля структурируют выводы по локации и сохраняются отдельно от обычных сообщений участников.';
      head.append(strong,help);
      block.appendChild(head);

      FIELDS.forEach(([field,label,placeholder])=>{
        const slot=document.createElement('label');
        slot.className='structured-note-v414';
        slot.dataset.noteSlotV414=field;
        const caption=document.createElement('span');
        caption.textContent=label;
        slot.appendChild(caption);
        const input=notes.querySelector(`[data-field="${field}"]`);
        if(input){
          input.placeholder=placeholder;
          input.rows=2;
          slot.appendChild(input);
        }
        block.appendChild(slot);
      });

      pane.prepend(block);
      notes.remove();
      changed=true;
    });
    return changed;
  }

  function install(){
    const root=document.getElementById('locations')||document.body;
    let pending=false;
    const schedule=()=>{
      if(pending)return;
      pending=true;
      setTimeout(()=>{pending=false;apply()},80);
    };
    const observer=new MutationObserver(schedule);
    observer.observe(root,{childList:true,subtree:true});
    apply();
    setTimeout(apply,250);
    setTimeout(apply,800);
    setTimeout(apply,1800);
    setTimeout(()=>{apply();observer.disconnect()},4000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();

  window.BogatkaStructuredNotesFallbackV418={version:'4.1.8',ready:true,apply};
})();
