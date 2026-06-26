(function(){
  if(window.BogatkaScoreGuideFixV415?.ready)return;
  let timer=null;

  function enhance(){
    document.querySelectorAll('[data-location-card]').forEach(card=>{
      const details=[...card.querySelectorAll(':scope .location-body > details')].find(item=>{
        const title=item.querySelector(':scope > summary')?.textContent||'';
        return title.includes('70-балльной')||title.includes('Сравнительная оценка локации');
      });
      const guide=details?.querySelector('.score-guide-v331');
      if(!guide||guide.classList.contains('score-guide-v414'))return;
      guide.classList.add('score-guide-v414');
      const title=guide.querySelector('.score-guide-title');
      const paragraph=guide.querySelector('p');
      if(title)title.textContent='Зачем нужна оценка после чек-листа';
      if(paragraph)paragraph.textContent='Чек-лист фиксирует, что условие проверено и присутствует. Оценка показывает, насколько это условие сильное по сравнению с другими локациями. Например, парковка есть, но она маленькая и почти всегда занята — оценка 2.';
    });
  }

  const observer=new MutationObserver(()=>{
    clearTimeout(timer);
    timer=setTimeout(enhance,40);
  });
  function install(){
    const root=document.getElementById('locations')||document.body;
    observer.observe(root,{childList:true,subtree:true});
    enhance();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.BogatkaScoreGuideFixV415={ready:true,enhance};
})();
