(function(){
  if(window.BogatkaScoreGuideFixV415?.ready)return;
  let timer=null;

  function makeScaleItem(value,label){
    const item=document.createElement('span');
    const number=document.createElement('b');
    number.textContent=value;
    item.append(number,document.createTextNode(` ${label}`));
    return item;
  }

  function buildGuide(){
    const guide=document.createElement('div');
    guide.className='score-guide-v331 score-guide-v414';

    const title=document.createElement('div');
    title.className='score-guide-title';
    title.textContent='Зачем нужна оценка после чек-листа';

    const paragraph=document.createElement('p');
    paragraph.textContent='Чек-лист фиксирует, что условие проверено и присутствует. Оценка показывает, насколько это условие сильное по сравнению с другими локациями. Например, парковка есть, но она маленькая и почти всегда занята — оценка 2.';

    const scale=document.createElement('div');
    scale.className='score-scale-v331';
    scale.append(
      makeScaleItem('1','критически слабо'),
      makeScaleItem('2','ниже нормы'),
      makeScaleItem('3','приемлемо'),
      makeScaleItem('4','сильный показатель'),
      makeScaleItem('5','явное преимущество')
    );

    const note=document.createElement('div');
    note.className='score-guide-note-v331';
    const noteTitle=document.createElement('b');
    noteTitle.textContent='Правило:';
    note.append(noteTitle,document.createTextNode(' ставьте балл только после проверки факта. Пустое значение означает «ещё не оценено», а не ноль.'));

    guide.append(title,paragraph,scale,note);
    return guide;
  }

  function enhance(){
    document.querySelectorAll('[data-location-card]').forEach(card=>{
      const details=[...card.querySelectorAll(':scope .location-body > details')].find(item=>{
        const title=item.querySelector(':scope > summary')?.textContent||'';
        return title.includes('70-балльной')||title.includes('Сравнительная оценка локации');
      });
      const body=details?.querySelector('.details-body');
      if(!body)return;

      let guide=body.querySelector('.score-guide-v331');
      if(!guide){
        guide=buildGuide();
        body.prepend(guide);
        return;
      }
      if(guide.classList.contains('score-guide-v414'))return;
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
