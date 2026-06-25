(function(){
  const VERSION='4.0.0';
  const ignoredKeys=new Set(['updatedAt','createdAt','cloudId','cloudRevision','cloudUpdatedAt','cloudSyncedAt']);
  let enhanceTimer=null;

  function setVersion(){
    const label=document.getElementById('versionLabel');
    if(label&&label.textContent!==VERSION)label.textContent=VERSION;
  }

  if(typeof window.upgradeV22Controls==='function'&&!window.upgradeV22Controls.__v331){
    const baseUpgradeV22Controls=window.upgradeV22Controls;
    const wrapped=function(){baseUpgradeV22Controls();setVersion()};
    wrapped.__v331=true;
    window.upgradeV22Controls=wrapped;
  }

  function metric(id,label,className=''){
    const element=document.createElement('div');
    element.className=`metric ${className}`.trim();
    element.innerHTML=`<strong id="${id}">0</strong><span>${label}</span>`;
    return element;
  }

  function ensureSummaryMetrics(){
    const grid=document.querySelector('.summary-grid');
    if(!grid)return;
    grid.classList.add('summary-grid-v331');
    const completed=document.getElementById('completedCount')?.closest('.metric');
    const best=document.getElementById('bestScore')?.closest('.metric');
    const keep=document.getElementById('keepCount')?.closest('.metric');
    const photo=document.getElementById('photoCount')?.closest('.metric');
    if(completed&&!document.getElementById('totalLocationsCount'))completed.insertAdjacentElement('beforebegin',metric('totalLocationsCount','всего локаций'));
    if(completed)completed.querySelector('span').textContent='осмотрено';
    if(best&&!document.getElementById('averageScore'))best.insertAdjacentElement('afterend',metric('averageScore','средний балл'));
    if(keep&&!document.getElementById('candidateCount'))keep.insertAdjacentElement('beforebegin',metric('candidateCount','кандидатов'));
    if(keep&&!document.getElementById('negotiationCount'))keep.insertAdjacentElement('beforebegin',metric('negotiationCount','переговоры'));
    if(keep&&!document.getElementById('excludedCount'))keep.insertAdjacentElement('afterend',metric('excludedCount','исключить'));
    if(photo)photo.querySelector('span').textContent='фотографий';
  }

  function hasMeaningfulValue(value,key=''){
    if(ignoredKeys.has(key)||key.startsWith('cloud'))return false;
    if(value===true)return true;
    if(value===false||value===null||value===undefined)return false;
    if(typeof value==='string')return value.trim()!=='';
    if(typeof value==='number')return Number.isFinite(value);
    if(Array.isArray(value))return value.some(item=>hasMeaningfulValue(item));
    if(typeof value==='object')return Object.entries(value).some(([nestedKey,nestedValue])=>hasMeaningfulValue(nestedValue,nestedKey));
    return false;
  }

  async function updateSummaryV331(){
    ensureSummaryMetrics();
    const photos=await idbAll(PHOTO_STORE);
    const photosByLocation=new Set(photos.map(photo=>photo.locationId));
    let inspected=0,best=0,keep=0,excluded=0,candidates=0,negotiations=0;
    const scoredTotals=[];
    for(const locationItem of locations){
      const data=await getLocationData(locationItem.id);
      if(data.archivedAt||locationItem.archivedAt)continue;
      const total=totalFromData(data);
      if(total>0){scoredTotals.push(total);best=Math.max(best,total)}
      if(hasMeaningfulValue(data)||photosByLocation.has(locationItem.id))inspected+=1;
      if(data.status==='Кандидат')candidates+=1;
      if(data.status==='Переговоры')negotiations+=1;
      if(data.decision==='Оставить'||data.status==='Оставить')keep+=1;
      if(data.decision==='Исключить'||data.status==='Исключить')excluded+=1;
    }
    const activeCount=locations.filter(item=>!item.archivedAt).length;
    const average=scoredTotals.length?scoredTotals.reduce((sum,value)=>sum+value,0)/scoredTotals.length:0;
    const values={totalLocationsCount:activeCount,completedCount:inspected,bestScore:best,averageScore:average?average.toFixed(1):'0',candidateCount:candidates,negotiationCount:negotiations,keepCount:keep,excludedCount:excluded,photoCount:photos.length};
    Object.entries(values).forEach(([id,value])=>{const target=document.getElementById(id);if(target)target.textContent=value});
    await updateStorageUsage();
  }

  window.updateSummary=updateSummaryV331;
  try{updateSummary=updateSummaryV331}catch(_){}

  function ensureScoreGuides(){
    document.querySelectorAll('[data-location-card] details').forEach(details=>{
      const summary=details.querySelector(':scope > summary');
      if(!summary||!summary.textContent.includes('70-балльной'))return;
      const body=details.querySelector('.details-body');
      if(!body||body.querySelector('.score-guide-v331'))return;
      const guide=document.createElement('div');
      guide.className='score-guide-v331';
      guide.innerHTML=`<div class="score-guide-title">Как пользоваться оценкой</div><p>Ставьте балл только после проверки показателя. Если данных пока нет, оставьте «—». Итоговая сумма нужна для сравнения локаций между собой и не заменяет окончательное решение.</p><div class="score-scale-v331"><span><b>1</b> критически плохо</span><span><b>2</b> слабо</span><span><b>3</b> приемлемо</span><span><b>4</b> хорошо</span><span><b>5</b> отлично</span></div><div class="score-guide-note-v331"><b>Важно:</b> в строке «Слабость конкурентов рядом» оценка обратная: 1 — конкуренты сильные, 5 — конкуренты слабые и локация выгоднее.</div>`;
      body.prepend(guide);
      const header=body.querySelector('.score-table thead th:last-child');
      if(header)header.textContent='Оценка';
    });
  }

  function enhance(){setVersion();ensureSummaryMetrics();ensureScoreGuides()}
  function scheduleEnhance(){clearTimeout(enhanceTimer);enhanceTimer=setTimeout(enhance,40)}
  enhance();
  updateSummaryV331().catch(console.error);
  const observer=new MutationObserver(scheduleEnhance);
  observer.observe(document.body,{childList:true,subtree:true});
})();
