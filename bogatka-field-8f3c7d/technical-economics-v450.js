(function(){
  'use strict';
  if(window.BogatkaTechnicalEconomicsV450?.ready)return;

  const VERSION='4.5.0';
  const TECH_NOTE='Здесь фиксируются параметры помещения и обязательные суммы по предложению. Прогноз выручки, расходы бизнеса и окупаемость рассчитываются в экономической модели.';
  const ECONOMY_NOTE='Площадь, аренда, коммунальные платежи, депозит, ремонт и оборудование берутся из блока выше. Здесь вводятся только прогноз выручки, маржа и остальные расходы бизнеса.';
  const TECH_LABELS={
    totalArea:'Общая площадь помещения, м²',
    salesArea:'Торговая площадь, м²',
    storageArea:'Складская и подсобная площадь, м²',
    ceilingHeight:'Высота потолка, м',
    entranceWidth:'Ширина входа, м',
    powerKw:'Доступная электрическая мощность, кВт',
    rentPerMonth:'Аренда в месяц, BYN',
    rentPerSqm:'Аренда за м², BYN — рассчитывается автоматически',
    utilities:'Коммунальные и эксплуатационные платежи в месяц, BYN',
    deposit:'Депозит / обеспечительный платёж, BYN',
    rentHolidays:'Арендные каникулы',
    indexation:'Индексация аренды',
    repairEstimate:'Предварительная стоимость ремонта, BYN',
    equipmentEstimate:'Предварительная стоимость оборудования, BYN',
    openingHours:'Допустимый режим работы',
  };
  const ECONOMY_LABELS={
    monthlyRevenue:'Прогноз выручки в месяц, BYN',
    grossMarginPct:'Валовая маржа, %',
    taxRatePct:'Налоги с выручки, %',
    payroll:'Фонд оплаты труда в месяц, BYN',
    marketing:'Маркетинг в месяц, BYN',
    logistics:'Логистика в месяц, BYN',
    otherOpex:'Прочие ежемесячные расходы, BYN',
    initialStock:'Стартовый товарный запас, BYN',
    workingCapital:'Оборотный капитал, BYN',
    openingOther:'Прочие разовые затраты на открытие, BYN',
    openingInvestmentOverride:'Итоговые инвестиции вручную, BYN',
    forecastNote:'Основание прогноза выручки',
  };
  const PLACEHOLDERS={
    rentHolidays:'Например: 30 дней',
    indexation:'Например: 5% один раз в год',
    openingHours:'Например: ежедневно 09:00–21:00',
    openingInvestmentOverride:'Заполняйте только если итог должен отличаться от автоматического расчёта',
    forecastNote:'Факт действующей точки, расчёт трафика, аналогичный район или другой источник',
  };
  const RESULT_LABELS={
    rentPerSqm:'Аренда за м²',
    rentBurdenPct:'Доля аренды в выручке',
    grossProfit:'Валовая прибыль',
    fixedCosts:'Ежемесячные постоянные расходы',
    operatingProfit:'Операционная прибыль',
    operatingMarginPct:'Операционная маржа',
    breakEvenRevenue:'Выручка для безубыточности',
    openingInvestment:'Итоговые инвестиции в открытие',
    paybackMonths:'Расчётная окупаемость',
  };
  let timer=null;
  let reportAttempts=0;
  let calculationAttempts=0;

  function number(value){
    if(typeof value==='number')return Number.isFinite(value)?value:null;
    if(typeof value!=='string')return null;
    const match=value.replace(/\s+/g,'').replace(',','.').match(/-?\d+(?:\.\d+)?/);
    if(!match)return null;
    const parsed=Number(match[0]);
    return Number.isFinite(parsed)?parsed:null;
  }

  function formatNumber(value,digits=2){
    if(value===null||value===undefined||!Number.isFinite(Number(value)))return'—';
    return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:digits}).format(Number(value));
  }

  function formatMoney(value){
    return value===null||value===undefined? '—' : `${formatNumber(value,2)} BYN`;
  }

  function labelWrapper(control){
    return control?.closest('label.field')||null;
  }

  function setLabel(control,text){
    const wrapper=labelWrapper(control);
    if(!wrapper)return;
    const caption=wrapper.querySelector(':scope > .profile-caption-v416,:scope > .evaluation-caption-v446,:scope > .technical-caption-v450');
    if(caption){
      if(caption.textContent!==text)caption.textContent=text;
      return;
    }
    const textNode=[...wrapper.childNodes].find(node=>node.nodeType===Node.TEXT_NODE&&node.textContent.trim());
    if(textNode){
      if(textNode.textContent!==text)textNode.textContent=text;
      return;
    }
    const created=document.createElement('span');
    created.className='technical-caption-v450';
    created.textContent=text;
    wrapper.prepend(created);
  }

  function detailsBySummary(card,needle){
    return [...card.querySelectorAll(':scope .location-body > details')].find(details=>details.querySelector(':scope > summary')?.textContent.includes(needle))||null;
  }

  function patchDefinitions(){
    if(typeof TECH_FIELDS!=='undefined'){
      for(const definition of TECH_FIELDS){
        const label=TECH_LABELS[definition[0]];
        if(label)definition[1]=label;
      }
    }
    const history=window.BogatkaWorkflowV414?.FIELD_LABELS;
    if(history){
      Object.entries(TECH_LABELS).forEach(([key,label])=>history[`tech.${key}`]=label);
      Object.entries(ECONOMY_LABELS).forEach(([key,label])=>history[`economy.${key}`]=label);
    }
  }

  function installStyles(targetDocument=document){
    if(targetDocument.getElementById('technicalEconomicsStyleV450'))return;
    const style=targetDocument.createElement('style');
    style.id='technicalEconomicsStyleV450';
    style.textContent=`
      .technical-guide-v450{margin:0 0 12px;padding:10px 12px;border:1px solid #d8e5dd;border-radius:11px;background:#f3f8f5;color:#5f7168;font-size:11px;line-height:1.45}
      .technical-derived-v450 input{background:#eef4f1!important;color:#355247;cursor:default}
      .derived-note-v450{display:block;margin-top:4px;color:#718078;font-size:10px;line-height:1.35}
      .economy-source-v450{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:0 0 14px}
      .economy-source-v450>div{padding:9px 10px;border:1px solid #d8e5dd;border-radius:11px;background:#f8fbf9;min-width:0}
      .economy-source-v450 span{display:block;color:#718078;font-size:10px;line-height:1.3}
      .economy-source-v450 strong{display:block;margin-top:3px;color:#174f3a;font-size:12px;line-height:1.3;overflow-wrap:anywhere}
      .technical-caption-v450{display:block;margin:0 0 5px;color:#174f3a;font-size:11px;font-weight:800;line-height:1.35}
      @media(max-width:900px){.economy-source-v450{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:520px){.economy-source-v450{grid-template-columns:1fr}}
      @media print{.economy-source-v450{grid-template-columns:repeat(5,minmax(0,1fr));break-inside:avoid}.technical-guide-v450{break-inside:avoid}}
    `;
    targetDocument.head.append(style);
  }

  function ensureGuide(details,className,text){
    const body=details?.querySelector('.details-body');
    if(!body)return;
    let guide=body.querySelector(`:scope > .${className}`);
    if(!guide){
      guide=document.createElement('div');
      guide.className=className;
      body.prepend(guide);
    }
    if(guide.textContent!==text)guide.textContent=text;
  }

  function economySourceMarkup(){
    return `<div class="economy-source-v450" data-economy-source-v450="1">
      <div><span>Общая площадь</span><strong data-source-v450="area">—</strong></div>
      <div><span>Аренда в месяц</span><strong data-source-v450="rent">—</strong></div>
      <div><span>Аренда за м²</span><strong data-source-v450="rentPerSqm">—</strong></div>
      <div><span>Коммунальные и эксплуатация</span><strong data-source-v450="utilities">—</strong></div>
      <div><span>Ремонт + оборудование + депозит</span><strong data-source-v450="openingBase">—</strong></div>
    </div>`;
  }

  function ensureEconomySource(details){
    const body=details?.querySelector('.details-body');
    if(!body)return null;
    let source=body.querySelector(':scope > [data-economy-source-v450]');
    if(!source){
      const fields=body.querySelector('.economy-fields-v400');
      const holder=document.createElement('div');
      holder.innerHTML=economySourceMarkup();
      source=holder.firstElementChild;
      if(fields)fields.insertAdjacentElement('beforebegin',source);else body.append(source);
    }
    return source;
  }

  function patchTechnicalFields(card){
    const details=detailsBySummary(card,'Технические и финансовые');
    if(!details)return null;
    details.dataset.technicalEconomicsV450='1';
    ensureGuide(details,'technical-guide-v450',TECH_NOTE);
    Object.entries(TECH_LABELS).forEach(([key,label])=>{
      const control=details.querySelector(`[data-field="tech.${key}"]`);
      if(!control)return;
      setLabel(control,label);
      const placeholder=PLACEHOLDERS[key];
      if(placeholder)control.placeholder=placeholder;
      if(key==='rentPerSqm'){
        control.readOnly=true;
        control.setAttribute('aria-readonly','true');
        control.placeholder='Рассчитается после площади и аренды';
        const wrapper=labelWrapper(control);
        wrapper?.classList.add('technical-derived-v450');
        if(wrapper&&!wrapper.querySelector('.derived-note-v450')){
          const note=document.createElement('small');
          note.className='derived-note-v450';
          note.textContent='Значение рассчитывается из общей площади и аренды в месяц и не вводится вручную.';
          wrapper.append(note);
        }
      }
    });
    return details;
  }

  function patchEconomyFields(card){
    const details=card.querySelector('.economy-v400');
    if(!details)return null;
    details.dataset.technicalEconomicsV450='1';
    const note=details.querySelector('.section-note');
    if(note&&note.textContent!==ECONOMY_NOTE)note.textContent=ECONOMY_NOTE;
    ensureEconomySource(details);
    Object.entries(ECONOMY_LABELS).forEach(([key,label])=>{
      const control=details.querySelector(`[data-economy-key="${key}"]`);
      if(!control)return;
      setLabel(control,label);
      const placeholder=PLACEHOLDERS[key];
      if(placeholder)control.placeholder=placeholder;
    });
    Object.entries(RESULT_LABELS).forEach(([key,label])=>{
      const result=details.querySelector(`[data-econ-result="${key}"]`);
      const caption=result?.parentElement?.querySelector('span');
      if(caption&&caption.textContent!==label)caption.textContent=label;
    });
    return details;
  }

  function calculatedSources(data){
    const area=number(data?.tech?.totalArea);
    const rent=number(data?.tech?.rentPerMonth)??number(data?.rent);
    const utilities=number(data?.tech?.utilities)??number(data?.economy?.utilities);
    const repair=number(data?.tech?.repairEstimate)||0;
    const equipment=number(data?.tech?.equipmentEstimate)||0;
    const deposit=number(data?.tech?.deposit)||0;
    return{
      area,
      rent,
      utilities,
      rentPerSqm:area>0&&rent!==null?rent/area:null,
      openingBase:repair+equipment+deposit,
    };
  }

  async function refreshCard(card){
    const id=card?.dataset.locationCard;
    if(!id||typeof getLocationData!=='function')return;
    patchTechnicalFields(card);
    const economyDetails=patchEconomyFields(card);
    const data=await getLocationData(id);
    const sources=calculatedSources(data);
    const derived=card.querySelector('[data-field="tech.rentPerSqm"]');
    if(derived&&derived!==document.activeElement){
      const next=sources.rentPerSqm===null?'':String(Math.round(sources.rentPerSqm*100)/100);
      if(derived.value!==next)derived.value=next;
    }
    const source=economyDetails?.querySelector('[data-economy-source-v450]');
    if(source){
      const values={
        area:sources.area===null?'—':`${formatNumber(sources.area,2)} м²`,
        rent:formatMoney(sources.rent),
        rentPerSqm:sources.rentPerSqm===null?'—':`${formatNumber(sources.rentPerSqm,2)} BYN/м²`,
        utilities:formatMoney(sources.utilities),
        openingBase:formatMoney(sources.openingBase),
      };
      Object.entries(values).forEach(([key,value])=>{
        const target=source.querySelector(`[data-source-v450="${key}"]`);
        if(target&&target.textContent!==value)target.textContent=value;
      });
    }
    const area=card.querySelector('[data-field="tech.totalArea"]');
    const rent=card.querySelector('[data-field="tech.rentPerMonth"]');
    [area,rent].forEach(control=>{
      if(!control||control.dataset.derivedListenerV450==='1')return;
      control.dataset.derivedListenerV450='1';
      control.addEventListener('input',()=>schedule(20));
      control.addEventListener('change',()=>schedule(20));
    });
  }

  async function enhanceAll(){
    patchDefinitions();
    installStyles();
    for(const card of document.querySelectorAll('[data-location-card]'))await refreshCard(card);
  }

  function installCalculationWrappers(){
    calculationAttempts+=1;
    const suite=window.BogatkaSuite;
    const engine=window.BogatkaDecisionEngine;
    if(!suite||!engine||typeof suite.calculateEconomy!=='function'||typeof engine.computeAll!=='function'){
      if(calculationAttempts<240)setTimeout(installCalculationWrappers,80);
      return;
    }

    if(!suite.calculateEconomy.__technicalEconomicsV450){
      const baseEconomy=suite.calculateEconomy.bind(suite);
      const wrappedEconomy=function(data={}){
        const result=baseEconomy(data);
        const source=calculatedSources(data);
        return{
          ...result,
          area:source.area||0,
          rent:source.rent||0,
          utilities:source.utilities||0,
          rentPerSqm:source.rentPerSqm,
        };
      };
      wrappedEconomy.__technicalEconomicsV450=true;
      wrappedEconomy.__base=baseEconomy;
      suite.calculateEconomy=wrappedEconomy;
    }

    if(!engine.computeAll.__technicalEconomicsV450){
      const baseCompute=engine.computeAll.bind(engine);
      const wrappedCompute=async function(...args){
        const metrics=await baseCompute(...args);
        metrics.forEach(metric=>{
          const economy=suite.calculateEconomy(metric.data||{});
          const source=calculatedSources(metric.data||{});
          metric.area=source.area;
          metric.rent=source.rent;
          metric.rentPerSqm=source.rentPerSqm;
          metric.economy=economy;
        });
        return metrics;
      };
      wrappedCompute.__technicalEconomicsV450=true;
      wrappedCompute.__base=baseCompute;
      engine.computeAll=wrappedCompute;
    }
  }

  function transformReport(html){
    const reportDocument=new DOMParser().parseFromString(html,'text/html');
    installStyles(reportDocument);
    reportDocument.querySelectorAll('[data-technical-economics-v450]').forEach(section=>section.dataset.technicalEconomicsReportV450='1');
    return `<!doctype html>\n${reportDocument.documentElement.outerHTML}`;
  }

  function claimReport(builder){
    const api=window.BogatkaLiveReport;
    if(api)api.build=builder;
    window.buildReportHtml=builder;
    window.exportHtmlReport=builder.__htmlAction;
    window.openPdfReport=builder.__pdfAction;
    try{
      buildReportHtml=builder;
      exportHtmlReport=builder.__htmlAction;
      openPdfReport=builder.__pdfAction;
    }catch(_){ }
  }

  function installReportWrapper(){
    reportAttempts+=1;
    const current=window.BogatkaLiveReport?.build;
    if(typeof current!=='function'||!current.__landlordConditionsV449){
      if(reportAttempts<240)setTimeout(installReportWrapper,80);
      return;
    }
    if(current.__technicalEconomicsV450){claimReport(current);return}

    let wrapped=null;
    const exportHtml=async function(){
      if(typeof showSaving==='function')showSaving();
      const html=await wrapped();
      downloadBlob(new Blob([html],{type:'text/html;charset=utf-8'}),`bogatka-premium-report-${new Date().toISOString().slice(0,10)}.html`);
      if(typeof showSaved==='function')showSaved();
    };
    const openPdf=async function(){
      const reportWindow=window.open('','_blank');
      if(!reportWindow)return alert('Браузер заблокировал новое окно. Разрешите всплывающие окна для создания PDF.');
      reportWindow.document.write('<p style="font-family:Arial;padding:30px">Формируется полный отчёт…</p>');
      try{
        const html=await wrapped();
        reportWindow.document.open();
        reportWindow.document.write(html);
        reportWindow.document.close();
        await Promise.all([...reportWindow.document.images].map(image=>image.complete?Promise.resolve():new Promise(resolve=>{
          image.addEventListener('load',resolve,{once:true});
          image.addEventListener('error',resolve,{once:true});
        })));
        if(reportWindow.document.fonts?.ready)await reportWindow.document.fonts.ready;
        reportWindow.focus();
        reportWindow.print();
      }catch(error){
        reportWindow.close();
        throw error;
      }
    };
    wrapped=async function(...args){
      await enhanceAll();
      const result=transformReport(await current(...args));
      claimReport(wrapped);
      return result;
    };
    Object.assign(wrapped,current);
    wrapped.__technicalEconomicsV450=true;
    wrapped.__base=current;
    wrapped.__htmlAction=exportHtml;
    wrapped.__pdfAction=openPdf;
    claimReport(wrapped);
  }

  function audit(){
    const failures=[];
    for(const card of document.querySelectorAll('[data-location-card]')){
      const id=card.dataset.locationCard||'unknown';
      const derived=card.querySelector('[data-field="tech.rentPerSqm"]');
      const technical=detailsBySummary(card,'Технические и финансовые');
      const economy=card.querySelector('.economy-v400');
      if(!technical?.querySelector('.technical-guide-v450'))failures.push(`${id}:technical-guide`);
      if(!derived?.readOnly)failures.push(`${id}:rent-per-sqm-readonly`);
      if(!economy?.querySelector('[data-economy-source-v450]'))failures.push(`${id}:economy-source`);
      if(economy?.querySelector('[data-economy-key="forecastNote"]')?.placeholder!==PLACEHOLDERS.forecastNote)failures.push(`${id}:forecast-placeholder`);
    }
    return{ok:failures.length===0,cards:document.querySelectorAll('[data-location-card]').length,failures};
  }

  function schedule(delay=60){
    clearTimeout(timer);
    timer=setTimeout(()=>enhanceAll().catch(console.error),delay);
  }

  function install(){
    patchDefinitions();
    installStyles();
    installCalculationWrappers();
    installReportWrapper();
    enhanceAll().catch(console.error);
    const root=document.getElementById('locations')||document.body;
    new MutationObserver(()=>schedule(80)).observe(root,{childList:true,subtree:true});
    [150,500,1200,2500].forEach(delay=>setTimeout(()=>enhanceAll().catch(console.error),delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('load',()=>schedule(40),{once:true});

  window.BogatkaTechnicalEconomicsV450={
    version:VERSION,
    ready:true,
    enhanceAll,
    refreshCard,
    calculatedSources,
    transformReport,
    audit,
    labels:{technical:TECH_LABELS,economy:ECONOMY_LABELS,results:RESULT_LABELS},
    notes:{technical:TECH_NOTE,economy:ECONOMY_NOTE},
  };
})();
