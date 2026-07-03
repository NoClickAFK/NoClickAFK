import {test} from '@playwright/test';

async function open(page,version){
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(`http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=${version}`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(document.querySelector('[data-location-card]')),{timeout:30000});
}

function collectOverflow(){
  const viewport=document.documentElement.clientWidth;
  const path=node=>{
    const parts=[];
    for(let current=node;current&&current.nodeType===1&&parts.length<7;current=current.parentElement){
      let part=current.tagName.toLowerCase();
      if(current.id)part+=`#${current.id}`;
      else if(current.classList.length)part+=`.${[...current.classList].slice(0,4).join('.')}`;
      parts.unshift(part);
    }
    return parts.join(' > ');
  };
  return [...document.querySelectorAll('body *')].map(node=>{
    const rect=node.getBoundingClientRect();
    const style=getComputedStyle(node);
    return{path:path(node),left:rect.left,right:rect.right,width:rect.width,clientWidth:node.clientWidth,scrollWidth:node.scrollWidth,display:style.display,position:style.position,minWidth:style.minWidth,maxWidth:style.maxWidth,overflowX:style.overflowX,whiteSpace:style.whiteSpace,grid:style.gridTemplateColumns,text:String(node.textContent||'').replace(/\s+/g,' ').trim().slice(0,90)};
  }).filter(item=>item.right>viewport+1||item.left<-1||item.scrollWidth>item.clientWidth+1)
    .sort((a,b)=>Math.max(b.right-viewport,b.scrollWidth-b.clientWidth)-Math.max(a.right-viewport,a.scrollWidth-a.clientWidth))
    .slice(0,50);
}

test('diagnose v460 progress cascade',async({page})=>{
  await open(page,'460');
  await page.waitForFunction(()=>Boolean(document.querySelector('.progress-metrics-v448')),{timeout:30000});
  const report=await page.evaluate(()=>{
    const metrics=document.querySelector('.progress-metrics-v448');
    const matching=[];
    for(const sheet of [...document.styleSheets]){
      let rules=[];
      try{rules=[...sheet.cssRules]}catch(_){continue}
      for(const rule of rules){
        if(rule.cssRules){
          for(const child of [...rule.cssRules])if(String(child.selectorText||'').includes('progress-metrics-v448'))matching.push({href:sheet.href||'inline',media:rule.conditionText||'',selector:child.selectorText,style:child.style.cssText});
        }else if(String(rule.selectorText||'').includes('progress-metrics-v448'))matching.push({href:sheet.href||'inline',media:'',selector:rule.selectorText,style:rule.style.cssText});
      }
    }
    return{innerWidth,clientWidth:document.documentElement.clientWidth,match700:matchMedia('(max-width:700px)').matches,columns:getComputedStyle(metrics).gridTemplateColumns,inline:metrics.getAttribute('style'),links:[...document.querySelectorAll('link[rel="stylesheet"]')].map(link=>link.getAttribute('href')),matching};
  });
  console.log(`V460_METRICS_DIAGNOSTIC ${JSON.stringify(report)}`);
});

test('diagnose v440 page overflow',async({page})=>{
  await open(page,'440');
  await page.waitForFunction(()=>Boolean(document.querySelector('[data-critical-deal]')),{timeout:30000});
  await page.evaluate(()=>{
    const card=document.querySelector('[data-location-card]');
    window.BogatkaLocationCardCollapseV422?.setCollapsed?.(card,false,{persist:false});
    const section=card?.querySelector('[data-critical-deal]');
    if(section){section.open=true;section.setAttribute('open','');}
  });
  await page.waitForTimeout(300);
  const report=await page.evaluate(()=>({innerWidth,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,delta:document.documentElement.scrollWidth-document.documentElement.clientWidth,nodes:collectOverflow()}));
  console.log(`V440_OVERFLOW_DIAGNOSTIC ${JSON.stringify(report)}`);
});
