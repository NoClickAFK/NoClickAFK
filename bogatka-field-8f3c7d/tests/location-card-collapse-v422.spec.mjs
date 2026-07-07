import {test,expect} from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=final-ui-stability-reason-v465';

async function openApp(page){
  await page.setViewportSize({width:1440,height:1000});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>{
    const card=document.querySelector('[data-location-card]');
    return Boolean(
      window.BogatkaLocationCardCollapseV422?.ready&&
      window.BogatkaCardProgressV448?.ready&&
      document.querySelectorAll('[data-location-card]').length>1&&
      card?.querySelector('.location-actions [data-card-recommendation-v448]')&&
      card?.querySelector('.location-head-side-v422 .location-collapse-toggle-v422')&&
      document.querySelector('#locationComparisonPanel > summary[aria-expanded="false"]')
    );
  },{timeout:30000});
}

async function expectAllCollapsed(page){
  const cards=page.locator('[data-location-card]');
  const count=await cards.count();
  expect(count).toBeGreaterThan(1);
  for(let index=0;index<count;index++){
    const card=cards.nth(index);
    await expect(card).toHaveClass(/location-card-collapsed-v422/);
    await expect(card.locator(':scope > .location-body')).toBeHidden();
    await expect(card.locator('.location-collapse-toggle-v422')).toHaveAttribute('aria-expanded','false');
    await expect(card.locator('.location-collapse-toggle-v422')).toHaveAttribute('aria-label','Развернуть локацию');
  }
}

test('all cards start collapsed, ignore legacy expanded state and reset on reload',async({page})=>{
  await openApp(page);
  await expectAllCollapsed(page);

  const cards=page.locator('[data-location-card]');
  const first=cards.first();
  const second=cards.nth(1);
  const firstId=await first.getAttribute('data-location-card');
  await page.evaluate(locationId=>localStorage.setItem(`bogatka.location.collapsed.v422.${locationId}`,'0'),firstId);
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaLocationCardCollapseV422?.ready&&document.querySelector('[data-location-card] .location-collapse-toggle-v422')),{timeout:30000});
  await expectAllCollapsed(page);

  const reloaded=page.locator(`[data-location-card="${firstId}"]`);
  await reloaded.locator('.location-collapse-toggle-v422').click();
  await expect(reloaded.locator(':scope > .location-body')).toBeVisible();
  await expect(reloaded.locator('.location-collapse-toggle-v422')).toHaveAttribute('aria-expanded','true');
  await expect(reloaded.locator('.location-collapse-toggle-v422')).toHaveAttribute('aria-label','Свернуть локацию');
  await expect(second.locator(':scope > .location-body')).toBeHidden();

  await page.evaluate(async()=>{
    await updateSummary();
    window.BogatkaLocationCardCollapseV422.enhanceAll();
  });
  await expect(reloaded.locator(':scope > .location-body')).toBeVisible();

  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaLocationCardCollapseV422?.ready&&document.querySelector('[data-location-card] .location-collapse-toggle-v422')),{timeout:30000});
  await expectAllCollapsed(page);
});

test('desktop status remains aligned and desktop actions keep their approved dimensions',async({page})=>{
  await openApp(page);
  const result=await page.locator('[data-location-card]').first().evaluate(card=>{
    const head=card.querySelector(':scope > .location-head');
    const actions=head.querySelector('.location-actions');
    const buttons=actions.querySelector(':scope > .location-action-buttons-v448');
    const status=actions.querySelector(':scope > .card-recommendation-head-v448 [data-card-recommendation-v448]');
    const toggle=head.querySelector('.location-collapse-toggle-v422');
    const buttonRects=[...buttons.children].map(node=>node.getBoundingClientRect());
    const actionsRect=actions.getBoundingClientRect();
    const statusRect=status.getBoundingClientRect();
    const toggleRect=toggle.getBoundingClientRect();
    return{
      labels:[...buttons.children].map(node=>node.textContent.trim()),
      heights:buttonRects.map(rect=>rect.height),
      statusParent:status.closest('.location-actions')===actions,
      rightGap:Math.abs(actionsRect.right-statusRect.right),
      toggleAboveStatus:toggleRect.top<statusRect.top,
      headOverflow:head.scrollWidth-head.clientWidth,
      actionOverflow:actions.scrollWidth-actions.clientWidth,
    };
  });
  expect(result.labels.slice(0,3)).toEqual(['Открыть на карте','Изменить адрес','Отчёт HTML']);
  expect(result.labels).not.toContain('Сохранить GPS');
  expect(result.statusParent).toBe(true);
  expect(result.rightGap).toBeLessThanOrEqual(2);
  expect(result.toggleAboveStatus).toBe(true);
  expect(result.headOverflow).toBeLessThanOrEqual(1);
  expect(result.actionOverflow).toBeLessThanOrEqual(1);
  expect(Math.max(...result.heights)-Math.min(...result.heights)).toBeLessThanOrEqual(2);
  expect(result.heights.some(height=>height!==36)).toBe(true);
});

test('expanded state and saved form data survive a same-document no-op render without node replacement',async({page})=>{
  await openApp(page);
  const first=page.locator('[data-location-card]').first();
  const id=await first.getAttribute('data-location-card');
  await first.locator('.location-collapse-toggle-v422').click();
  await expect(first.locator(':scope > .location-body')).toBeVisible();
  const floor=first.locator('[data-field="floorLocation"]');
  await floor.fill('1-й этаж, отдельный вход');
  await floor.blur();
  await expect.poll(()=>page.evaluate(async locationId=>(await getLocationData(locationId)).floorLocation,id)).toBe('1-й этаж, отдельный вход');

  const identity=await page.evaluate(locationId=>{
    const card=document.querySelector(`[data-location-card="${CSS.escape(locationId)}"]`);
    window.__sameDocumentCard=card;
    window.__sameDocumentToggle=card.querySelector('.location-collapse-toggle-v422');
    window.__sameDocumentBadge=card.querySelector('[data-card-recommendation-v448]');
    const rendered=renderLocations();
    const current=document.querySelector(`[data-location-card="${CSS.escape(locationId)}"]`);
    return{
      rendered,
      sameCard:current===window.__sameDocumentCard,
      sameToggle:current.querySelector('.location-collapse-toggle-v422')===window.__sameDocumentToggle,
      sameBadge:current.querySelector('[data-card-recommendation-v448]')===window.__sameDocumentBadge,
    };
  },id);
  expect(identity.rendered).toBe(false);
  expect(identity.sameCard).toBe(true);
  expect(identity.sameToggle).toBe(true);
  expect(identity.sameBadge).toBe(true);

  const rerendered=page.locator(`[data-location-card="${id}"]`);
  await expect(rerendered.locator(':scope > .location-body')).toBeVisible();
  await expect(rerendered.locator('[data-field="floorLocation"]')).toHaveValue('1-й этаж, отдельный вход');
});

test('comparison arrow, location arrows and recommendation badges stay stable for 15 seconds',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async()=>{
    const comparison=document.querySelector('#locationComparisonPanel');
    const comparisonSummary=comparison.querySelector(':scope > summary');
    const buttons=[...document.querySelectorAll('.location-collapse-toggle-v422')];
    const badges=[...document.querySelectorAll('[data-card-recommendation-v448]')];
    const initial={
      comparison,
      comparisonSummary,
      buttons:[...buttons],
      badges:[...badges],
      buttonStates:buttons.map(node=>({expanded:node.getAttribute('aria-expanded'),label:node.getAttribute('aria-label'),className:node.className})),
      badgeStates:badges.map(node=>({text:node.textContent,className:node.className,hidden:node.hidden,title:node.title,aria:node.getAttribute('aria-label')})),
    };
    const mutations=[];
    const tracked=new Set([comparison,comparisonSummary,...buttons,...badges]);
    const observer=new MutationObserver(records=>{
      for(const record of records){
        const target=record.target.nodeType===Node.TEXT_NODE?record.target.parentElement:record.target;
        if(!tracked.has(target))continue;
        mutations.push({
          type:record.type,
          name:record.attributeName||'',
          target:target===comparison?'comparison':target===comparisonSummary?'comparison-summary':buttons.includes(target)?`button-${buttons.indexOf(target)}`:`badge-${badges.indexOf(target)}`,
          text:target.textContent||'',
          hidden:Boolean(target.hidden),
          expanded:target.getAttribute?.('aria-expanded')||'',
          className:target.className||'',
        });
      }
    });
    observer.observe(document.getElementById('locations'),{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-expanded','aria-label','class','hidden','style','title']});
    observer.observe(comparison,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['open','aria-expanded','class','hidden','style']});

    let renderCalls=0;
    const originalWindowRender=window.renderLocations;
    const wrapped=function(...args){renderCalls+=1;return originalWindowRender.apply(this,args)};
    window.renderLocations=wrapped;
    try{renderLocations=wrapped}catch(_){ }

    for(let index=0;index<4;index++)await updateSummary();
    window.BogatkaLocationCardCollapseV422.enhanceAll();
    window.BogatkaCardProgressInitV448?.refineAll?.();
    await cloudSyncAll({manual:false});
    for(let index=0;index<6;index++)cloudHandleRealtime?.({});
    window.scrollTo(0,Math.min(document.body.scrollHeight,900));
    const unrelated=document.querySelector('[data-location-card] .location-body > details');
    if(unrelated){unrelated.open=true;unrelated.open=false;}
    await new Promise(resolve=>setTimeout(resolve,15050));
    observer.disconnect();
    window.renderLocations=originalWindowRender;
    try{renderLocations=originalWindowRender}catch(_){ }

    const currentButtons=[...document.querySelectorAll('.location-collapse-toggle-v422')];
    const currentBadges=[...document.querySelectorAll('[data-card-recommendation-v448]')];
    return{
      comparisonSame:document.querySelector('#locationComparisonPanel')===initial.comparison,
      comparisonSummarySame:document.querySelector('#locationComparisonPanel > summary')===initial.comparisonSummary,
      comparisonExpanded:comparisonSummary.getAttribute('aria-expanded'),
      comparisonOpen:comparison.open,
      buttonIdentity:currentButtons.length===initial.buttons.length&&currentButtons.every((node,index)=>node===initial.buttons[index]),
      badgeIdentity:currentBadges.length===initial.badges.length&&currentBadges.every((node,index)=>node===initial.badges[index]),
      buttonStates:currentButtons.map(node=>({expanded:node.getAttribute('aria-expanded'),label:node.getAttribute('aria-label'),className:node.className})),
      badgeStates:currentBadges.map(node=>({text:node.textContent,className:node.className,hidden:node.hidden,title:node.title,aria:node.getAttribute('aria-label')})),
      initialButtonStates:initial.buttonStates,
      initialBadgeStates:initial.badgeStates,
      trackedMutations:mutations,
      renderCalls,
    };
  });

  expect(result.comparisonSame).toBe(true);
  expect(result.comparisonSummarySame).toBe(true);
  expect(result.comparisonExpanded).toBe('false');
  expect(result.comparisonOpen).toBe(false);
  expect(result.buttonIdentity).toBe(true);
  expect(result.badgeIdentity).toBe(true);
  expect(result.buttonStates).toEqual(result.initialButtonStates);
  expect(result.badgeStates).toEqual(result.initialBadgeStates);
  expect(result.badgeStates.every(item=>item.text.trim()!==''&&!item.hidden)).toBe(true);
  expect(result.renderCalls).toBe(0);
  expect(result.trackedMutations).toEqual([]);
});

test('real toggle interactions change only the selected disclosure once',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async()=>{
    const comparison=document.querySelector('#locationComparisonPanel');
    const comparisonSummary=comparison.querySelector(':scope > summary');
    const buttons=[...document.querySelectorAll('.location-collapse-toggle-v422')];
    const changes=[];
    const observer=new MutationObserver(records=>{
      for(const record of records)if(record.attributeName==='aria-expanded')changes.push(record.target);
    });
    observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['aria-expanded']});
    comparisonSummary.click();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    buttons[0].click();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    observer.disconnect();
    return{
      comparisonExpanded:comparisonSummary.getAttribute('aria-expanded'),
      firstExpanded:buttons[0].getAttribute('aria-expanded'),
      others:buttons.slice(1).map(button=>button.getAttribute('aria-expanded')),
      comparisonChanges:changes.filter(node=>node===comparisonSummary).length,
      firstChanges:changes.filter(node=>node===buttons[0]).length,
      otherChanges:changes.filter(node=>buttons.slice(1).includes(node)).length,
    };
  });
  expect(result.comparisonExpanded).toBe('true');
  expect(result.firstExpanded).toBe('true');
  expect(result.others.every(value=>value==='false')).toBe(true);
  expect(result.comparisonChanges).toBe(1);
  expect(result.firstChanges).toBe(1);
  expect(result.otherChanges).toBe(0);
});
