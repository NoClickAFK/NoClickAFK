import {test} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=462';

test('diagnose mobile overflow source',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(document.querySelector('[data-location-card] [data-critical-deal]')),{timeout:30000});
  await page.evaluate(()=>{
    const card=document.querySelector('[data-location-card]');
    window.BogatkaLocationCardCollapseV422?.setCollapsed?.(card,false,{persist:false});
    const section=card?.querySelector('[data-critical-deal]');
    if(section){section.open=true;section.setAttribute('open','');}
  });
  await page.waitForTimeout(250);
  const report=await page.evaluate(()=>{
    const root=document.documentElement;
    const viewport=root.clientWidth;
    const selector=node=>{
      const parts=[];
      for(let current=node;current&&current.nodeType===1&&parts.length<6;current=current.parentElement){
        let part=current.tagName.toLowerCase();
        if(current.id)part+=`#${current.id}`;
        else if(current.classList.length)part+=`.${[...current.classList].slice(0,3).join('.')}`;
        parts.unshift(part);
      }
      return parts.join(' > ');
    };
    const nodes=[...document.querySelectorAll('body *')].map(node=>{
      const rect=node.getBoundingClientRect();
      const style=getComputedStyle(node);
      return{
        selector:selector(node),
        left:Math.round(rect.left*10)/10,
        right:Math.round(rect.right*10)/10,
        width:Math.round(rect.width*10)/10,
        clientWidth:node.clientWidth,
        scrollWidth:node.scrollWidth,
        display:style.display,
        position:style.position,
        minWidth:style.minWidth,
        maxWidth:style.maxWidth,
        overflowX:style.overflowX,
        whiteSpace:style.whiteSpace,
        gridTemplateColumns:style.gridTemplateColumns,
        text:String(node.textContent||'').replace(/\s+/g,' ').trim().slice(0,120),
      };
    }).filter(item=>item.right>viewport+1||item.left<-1||item.scrollWidth>item.clientWidth+1)
      .sort((a,b)=>Math.max(b.right-viewport,b.scrollWidth-b.clientWidth)-Math.max(a.right-viewport,a.scrollWidth-a.clientWidth))
      .slice(0,40);
    return{clientWidth:viewport,scrollWidth:root.scrollWidth,delta:root.scrollWidth-viewport,nodes};
  });
  console.log(`OVERFLOW_DIAGNOSTIC ${JSON.stringify(report)}`);
});
