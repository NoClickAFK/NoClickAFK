(function(){
  'use strict';
  if(window.BogatkaPublicLocationDetailsV452?.ready)return;

  const VERSION='4.5.2';
  const numeric=value=>{
    if(typeof value==='number')return Number.isFinite(value)?value:null;
    if(typeof value!=='string')return null;
    const match=value.replace(/\s+/g,'').replace(',','.').match(/-?\d+(?:\.\d+)?/);
    return match&&Number.isFinite(Number(match[0]))?Number(match[0]):null;
  };
  const format=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Math.abs(Number(value)));

  function balanceText(data={}){
    const available=numeric(data?.tech?.powerKw);
    const required=numeric(data?.tech?.requiredPowerKw);
    if(available===null||required===null)return'—';
    const balance=available-required;
    if(balance>0)return`Запас ${format(balance)} кВт`;
    if(balance<0)return`Дефицит ${format(balance)} кВт`;
    return'Мощность без запаса';
  }

  function safeUrl(value){
    const raw=String(value||'').trim();
    if(!raw)return null;
    try{
      const parsed=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);
      return ['http:','https:'].includes(parsed.protocol)?parsed.href:null;
    }catch(_){return null}
  }

  function addValue(grid,label,value,href=null){
    const item=document.createElement('div');
    const title=document.createElement('b');
    title.textContent=`${label}: `;
    item.append(title);
    if(href){
      const link=document.createElement('a');
      link.href=href;
      link.target='_blank';
      link.rel='noopener';
      link.textContent='Открыть объявление';
      item.append(link);
    }else item.append(document.createTextNode(value===undefined||value===null||String(value).trim()===''?'—':String(value)));
    grid.append(item);
  }

  function appendDetails(article,data={}){
    const body=article?.querySelector('.location-body');
    if(!body||body.querySelector('.location-data-public-v452'))return;
    const section=document.createElement('section');
    section.className='report-extra location-data-public-v452';
    const heading=document.createElement('h3');
    heading.textContent='Источник и сведения об осмотре';
    const grid=document.createElement('div');
    grid.className='summary-grid';
    const source=data.objectSource==='Другое'&&data.objectSourceOther?data.objectSourceOther:data.objectSource;
    const listing=safeUrl(data.listingUrl);
    addValue(grid,'Источник объекта',source);
    addValue(grid,'Ссылка на объявление',data.listingUrl,listing);
    addValue(grid,'Цель осмотра',data.inspectionPurpose);
    addValue(grid,'Кто участвовал',data.inspectionParticipants);
    addValue(grid,'Итог осмотра',data.inspectionResult);
    addValue(grid,'Причина решения',data.decisionReason);
    addValue(grid,'Доступная мощность',data?.tech?.powerKw===undefined?'—':`${data.tech.powerKw} кВт`);
    addValue(grid,'Требуемая мощность',data?.tech?.requiredPowerKw===undefined?'—':`${data.tech.requiredPowerKw} кВт`);
    addValue(grid,'Запас / дефицит',balanceText(data));
    section.append(heading,grid);
    body.prepend(section);
  }

  function install(){
    const current=typeof renderReport==='function'?renderReport:window.renderReport;
    if(typeof current!=='function'||current.__locationDetailsV452)return false;
    const wrapped=function(payload){
      const result=current(payload);
      const locations=(Array.isArray(payload?.snapshot?.locations)?payload.snapshot.locations:[]).filter(location=>!location.form_data?.archivedAt);
      document.querySelectorAll('#reportRoot article.location').forEach((article,index)=>appendDetails(article,locations[index]?.form_data||{}));
      return result;
    };
    wrapped.__locationDetailsV452=true;
    wrapped.__base=current;
    try{renderReport=wrapped}catch(_){ }
    window.renderReport=wrapped;
    return true;
  }

  install();
  setTimeout(()=>{
    install();
    try{if(typeof loadReport==='function')loadReport()}catch(_){ }
  },0);

  window.BogatkaPublicLocationDetailsV452={version:VERSION,ready:true,balanceText,appendDetails,install};
})();
