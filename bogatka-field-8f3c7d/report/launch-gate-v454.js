(function(){
  'use strict';
  if(window.BogatkaPublicLaunchGateV454?.ready)return;

  const VERSION='4.5.4';
  let attempts=0;

  function allowed(data={}){
    return String(data.decision||'').trim()==='Оставить'&&window.BogatkaCriticalDeal?.evaluate?.(data)?.code==='confirmed';
  }

  function removeLaunch(article){
    [...article.querySelectorAll('h3')].filter(heading=>heading.textContent.trim().startsWith('Проект открытия')).forEach(heading=>heading.closest('section')?.remove());
  }

  function install(){
    attempts+=1;
    const current=window.renderReport||((typeof renderReport==='function')?renderReport:null);
    if(typeof current!=='function'){if(attempts<100)setTimeout(install,50);return false;}
    if(current.__launchGateV454)return true;
    const wrapped=function(payload){
      const result=current(payload);
      const items=(Array.isArray(payload?.snapshot?.locations)?payload.snapshot.locations:[]).filter(location=>!location.form_data?.archivedAt);
      document.querySelectorAll('#reportRoot article.location').forEach((article,index)=>{if(!allowed(items[index]?.form_data||{}))removeLaunch(article);});
      return result;
    };
    Object.assign(wrapped,current);wrapped.__launchGateV454=true;wrapped.__base=current;
    window.renderReport=wrapped;try{renderReport=wrapped}catch(_){ }
    setTimeout(()=>{try{if(typeof loadReport==='function')loadReport()}catch(error){console.error(error);}},0);
    return true;
  }

  function loadStage9(){
    if(document.querySelector('script[src="./opening-project-v455.js"]'))return;
    const script=document.createElement('script');script.src='./opening-project-v455.js';script.async=false;document.head.append(script);
  }

  window.BogatkaPublicLaunchGateV454={version:VERSION,ready:true,allowed,removeLaunch,install};
  install();loadStage9();
})();
