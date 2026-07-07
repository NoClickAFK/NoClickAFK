import {test,expect} from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=location-ui-stability-v463';

async function openApp(page,width=390,height=844){
  await page.setViewportSize({width,height});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>{
    const card=document.querySelector('[data-location-card]');
    return Boolean(
      window.BogatkaLocationCardCollapseV422?.ready&&
      window.BogatkaCardProgressV448?.initialized&&
      window.BogatkaUIRefineV462?.ready&&
      window.BogatkaDecisionPanel?.ready&&
      window.BogatkaSyncIntegrity?.ready&&
      card?.querySelector('.location-actions [data-card-recommendation-v448]')
    );
  },{timeout:30000});
}

test('mobile action area keeps status without overflow while arrow stays upper-right',async({page})=>{
  await openApp(page);

  const card=page.locator('[data-location-card]').first();
  const layout=await card.evaluate(node=>{
    const head=node.querySelector(':scope > .location-head');
    const actions=head.querySelector(':scope > .location-actions');
    const buttons=actions.querySelector('.location-action-buttons-v448');
    const status=actions.querySelector('[data-card-recommendation-v448]');
    const side=head.querySelector(':scope > .location-head-side-v422');
    const toggle=side.querySelector('.location-collapse-toggle-v422');
    const actionRect=actions.getBoundingClientRect();
    const statusRect=status.getBoundingClientRect();
    const toggleRect=toggle.getBoundingClientRect();
    const buttonRects=[...buttons.children].map(item=>item.getBoundingClientRect());
    const overlaps=buttonRects.some(rect=>!(rect.right<=statusRect.left||rect.left>=statusRect.right||rect.bottom<=statusRect.top||rect.top>=statusRect.bottom));
    return{
      headOverflow:head.scrollWidth-head.clientWidth,
      actionOverflow:actions.scrollWidth-actions.clientWidth,
      statusParent:status.closest('.location-actions')===actions,
      statusInSide:side.contains(status),
      toggleParent:toggle.parentElement===side,
      statusInside:statusRect.left>=actionRect.left-1&&statusRect.right<=actionRect.right+1,
      rightDelta:Math.abs(toggleRect.right-statusRect.right),
      overlaps,
      statusHeight:statusRect.height,
      toggleAboveStatus:toggleRect.top<statusRect.top,
    };
  });
  expect(layout.headOverflow).toBeLessThanOrEqual(1);
  expect(layout.actionOverflow).toBeLessThanOrEqual(1);
  expect(layout.statusParent).toBe(true);
  expect(layout.statusInSide).toBe(false);
  expect(layout.toggleParent).toBe(true);
  expect(layout.statusInside).toBe(true);
  expect(layout.rightDelta).toBeLessThanOrEqual(2);
  expect(layout.overlaps).toBe(false);
  expect(layout.statusHeight).toBeGreaterThanOrEqual(30);
  expect(layout.toggleAboveStatus).toBe(true);

  await card.locator('.location-collapse-toggle-v422').click();
  await expect(card.locator(':scope > .location-body')).toBeHidden();
  await expect(card.locator('.location-actions [data-card-recommendation-v448]')).toBeVisible();
});

test('new location receives canonical progress accordions before it is scrolled into view',async({page})=>{
  await openApp(page,1440,1000);
  await page.evaluate(()=>{
    const base=Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView=function(...args){
      if(this.matches?.('[data-location-card]')&&this.textContent.includes('Новая тестовая локация UI')){
        window.__newCardScrollSnapshot={
          raw:this.querySelectorAll('.progress-heading-v448').length,
          progress:this.querySelectorAll('.decision-progress-v448.progress-card-v462').length,
          toggle:this.querySelectorAll('.progress-card-toggle-v462').length,
          content:this.querySelectorAll('.progress-card-content-v462').length,
          fillToggle:this.querySelectorAll('.fill-plan-toggle-v462').length,
          fillChevron:this.querySelectorAll('.fill-plan-chevron-v462').length,
        };
      }
      return base.apply(this,args);
    };
  });
  await page.locator('#addLocationBtn').click();
  await page.locator('#locationTitle').fill('Новая тестовая локация UI');
  await page.locator('#locationAddress').fill('Гродно, тестовый адрес UI');
  await page.locator('#saveLocationBtn').click();
  await page.waitForFunction(()=>Boolean(window.__newCardScrollSnapshot));
  expect(await page.evaluate(()=>window.__newCardScrollSnapshot)).toEqual({raw:0,progress:1,toggle:1,content:1,fillToggle:1,fillChevron:1});
  const card=page.locator('[data-location-card]').filter({hasText:'Новая тестовая локация UI'});
  await expect(card).toHaveCount(1);
  await expect(card.locator('.decision-progress-v448.progress-card-v462')).toHaveCount(1);
  await expect(card.locator('.progress-card-toggle-v462')).toHaveCount(1);
  await expect(card.locator('.progress-card-content-v462')).toHaveCount(1);
  await expect(card.locator('.fill-plan-toggle-v462')).toHaveCount(1);
  await expect(card.locator('.fill-plan-chevron-v462')).toHaveCount(1);
  await expect(card).not.toContainText(/Следующий приоритет|Далее/);
  const titles=await card.locator('.fill-plan-copy-v448 strong').allTextContents();
  expect(titles).toEqual(expect.arrayContaining(['Параметры осмотра','Арендодатель и условия','Оценка локации','Технические и финансовые параметры','Фотографии по категориям','Проверки перед арендой','Предварительное решение по локации']));
});

test('desktop and mobile header use stable action rows and one right edge',async({page})=>{
  await openApp(page,1440,1000);
  const card=page.locator('[data-location-card]').first();
  const snapshot=async()=>card.evaluate(node=>{
    const head=node.querySelector(':scope > .location-head');
    const toggle=head.querySelector('.location-collapse-toggle-v422').getBoundingClientRect();
    const actions=head.querySelector(':scope > .location-actions');
    const status=actions.querySelector('[data-card-recommendation-v448]').getBoundingClientRect();
    const buttons=[...actions.querySelectorAll('.location-action-buttons-v448 > *')].map(element=>({text:element.textContent.trim(),rect:element.getBoundingClientRect(),scrollWidth:element.scrollWidth,clientWidth:element.clientWidth}));
    return{
      overflow:Math.max(head.scrollWidth-head.clientWidth,actions.scrollWidth-actions.clientWidth),
      rightDelta:Math.abs(toggle.right-status.right),
      statusTop:status.top,
      buttons:buttons.map(item=>({text:item.text,top:item.rect.top,bottom:item.rect.bottom,right:item.rect.right,left:item.rect.left,clipped:item.scrollWidth>item.clientWidth+1})),
    };
  });
  const desktop=await snapshot();
  expect(desktop.overflow).toBeLessThanOrEqual(1);
  expect(desktop.rightDelta).toBeLessThanOrEqual(2);
  expect(Math.abs(desktop.buttons[0].top-desktop.statusTop)).toBeLessThanOrEqual(4);
  for(const width of [320,375,390,430]){
    await page.setViewportSize({width,height:900});
    const mobile=await snapshot();
    expect(mobile.overflow,`overflow at ${width}`).toBeLessThanOrEqual(1);
    expect(mobile.rightDelta,`right edge at ${width}`).toBeLessThanOrEqual(2);
    expect(mobile.buttons.length).toBeGreaterThanOrEqual(6);
    const first=mobile.buttons.slice(0,3),second=mobile.buttons.slice(3,6);
    expect(Math.max(...first.map(item=>item.top))-Math.min(...first.map(item=>item.top)),`first row ${width}`).toBeLessThanOrEqual(2);
    expect(Math.max(...second.map(item=>item.top))-Math.min(...second.map(item=>item.top)),`second row ${width}`).toBeLessThanOrEqual(2);
    expect(Math.min(...second.map(item=>item.top))).toBeGreaterThan(Math.max(...first.map(item=>item.top)));
    expect(mobile.statusTop).toBeGreaterThan(Math.max(...second.map(item=>item.top)));
    expect(mobile.buttons.slice(0,6).some(item=>item.clipped)).toBe(false);
  }
});

test('decision reason is collapsible, explicitly saveable and persists multiline text',async({page})=>{
  await openApp(page,390,900);
  const card=page.locator('[data-location-card]').first();
  const id=await card.getAttribute('data-location-card');
  const section=card.locator('.decision-reason-section-v412');
  await expect(section).toHaveCount(1);
  await expect(section.locator('.decision-reason-toggle-v412')).toHaveCount(1);
  await expect(section.locator('[data-decision-reason-status-v412]')).toHaveText('Не выбрано');
  await card.locator('input[type="radio"][data-field="decision"][value="Оставить"]').check();
  await expect(section).toHaveAttribute('open','');
  await expect(section.locator('[data-decision-reason-status-v412]')).toHaveText('Нужно заполнить');
  const value='— подходящий поток и район;\n— приемлемая аренда;\n— требуется письменное подтверждение разгрузки.';
  const result=await page.evaluate(async({locationId,text})=>{
    const card=document.querySelector(`[data-location-card="${CSS.escape(locationId)}"]`);
    const input=card.querySelector('[data-field="decisionReason"]');
    input.value=text;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    const dirty=card.querySelector('[data-decision-reason-status-v412]').textContent;
    const saved=await window.BogatkaDecisionPanel.flushReason(card);
    const stored=await getLocationData(locationId);
    return{dirty,saved,stored:stored.decisionReason,buttonDisabled:card.querySelector('[data-decision-reason-save-v412]').disabled,feedback:card.querySelector('[data-decision-reason-feedback-v412]').textContent};
  },{locationId:id,text:value});
  expect(result).toMatchObject({dirty:'Есть изменения',saved:true,stored:value,buttonDisabled:true,feedback:'Причина сохранена'});
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaDecisionPanel?.ready&&document.querySelector('.decision-reason-section-v412')));
  const reloaded=page.locator(`[data-location-card="${id}"]`);
  await expect(reloaded.locator('[data-field="decisionReason"]')).toHaveValue(value);
  const remote=await page.evaluate(async locationId=>{
    const card=document.querySelector(`[data-location-card="${CSS.escape(locationId)}"]`);
    const input=card.querySelector('[data-field="decisionReason"]');
    input.focus();
    input.value='Локальная несохранённая причина';
    input.dataset.locationDataDirtyV452='1';
    const stored=await getLocationData(locationId);
    const incoming={...stored,decisionReason:'Причина с другого устройства'};
    await window.BogatkaSyncIntegrity.hydrateLocationCard(locationId,incoming);
    const protectedValue=input.value;
    input.blur();
    delete input.dataset.locationDataDirtyV452;
    await window.BogatkaDurableFieldsV452.flush();
    await idbPut(STORE,incoming,`location:${locationId}`);
    await window.BogatkaSyncIntegrity.hydrateLocationCard(locationId,incoming);
    return{
      protectedValue,
      hydratedValue:input.value,
      status:card.querySelector('[data-decision-reason-status-v412]').textContent,
      saveDisabled:card.querySelector('[data-decision-reason-save-v412]').disabled,
    };
  },id);
  expect(remote).toEqual({protectedValue:'Локальная несохранённая причина',hydratedValue:'Причина с другого устройства',status:'Сохранено',saveDisabled:true});
  await page.evaluate(async locationId=>{
    cloudRole='viewer';window.cloudRole='viewer';
    const card=document.querySelector(`[data-location-card="${CSS.escape(locationId)}"]`);
    await window.BogatkaDecisionPanel.enhanceCard(card);
  },id);
  await expect(reloaded.locator('[data-field="decisionReason"]')).toBeDisabled();
  await expect(reloaded.locator('[data-decision-reason-save-v412]')).toBeDisabled();
  expect(await reloaded.evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);
});

test('no-op remote rows and existing photos preserve card and badge node identities',async({page})=>{
  await openApp(page,1440,1000);
  const result=await page.evaluate(async()=>{
    const selected=locations.filter(item=>!item.archivedAt).slice(0,3);
    locations=[...selected];
    cloudProjectId='project-noop-ui';
    cloudSession={user:{id:'user-noop-ui'}};
    const now='2026-07-06T12:00:00.000Z';
    const rows=[];
    for(let index=0;index<selected.length;index++){
      const item=selected[index];
      const data=await getLocationData(item.id);
      const clean=window.BogatkaSyncMerge.clean(data);
      const row={id:`cloud-noop-${index}`,project_id:cloudProjectId,client_id:item.id,title:item.title,address:item.address||'',note:item.note||'',status:clean.status||null,object_type:clean.objectType||null,form_data:clean,sort_order:index,revision:1,created_at:now,updated_at:now,archived_at:null};
      rows.push(row);
      item.cloudId=row.id;
      await window.BogatkaSyncState.rawPut()(STORE,{...clean,cloudId:row.id,cloudRevision:1,cloudUpdatedAt:now},`location:${item.id}`);
      await window.BogatkaSyncState.writeBase(item.id,{revision:1,updatedAt:now,formData:clean,meta:{title:item.title,address:item.address||'',note:item.note||'',sortOrder:index,archivedAt:null}});
    }
    await window.BogatkaSyncState.rawPut()(STORE,selected,'meta:locations');
    renderLocations();
    await restoreAllForms();
    await window.BogatkaCardEnhancer.enhanceAll({renderProgress:true});
    const photo={id:'photo-noop-ui',locationId:selected[0].id,category:'other',caption:'same',storagePath:'fixture/noop.jpg',cloudLocationId:rows[0].id,cloudSyncedAt:now,originalName:'noop.jpg',width:100,height:100,size:4,createdAt:now,blob:new Blob(['same'],{type:'image/jpeg'})};
    await window.BogatkaSyncState.rawPut()(PHOTO_STORE,photo);
    const remotePhoto={id:photo.id,project_id:cloudProjectId,location_id:rows[0].id,category:photo.category,caption:photo.caption,storage_path:photo.storagePath,original_name:photo.originalName,mime_type:'image/jpeg',width:photo.width,height:photo.height,file_size:photo.size,created_at:now,updated_at:now};
    const state={dirtyLocations:[],dirtyPhotos:[],deletedPhotos:{},deletedLocations:{},knownLocationIds:selected.map(item=>item.id),knownPhotoIds:[photo.id],metaDirty:false,stateDirty:false};
    const cards=selected.map(item=>document.querySelector(`[data-location-card="${CSS.escape(item.id)}"]`));
    const badges=cards.map(card=>card.querySelector('[data-card-recommendation-v448]'));
    const texts=badges.map(node=>node.textContent);
    let renderCalls=0,violations=0;
    const original=window.renderLocations;
    const counted=function(...args){renderCalls++;return original.apply(this,args)};
    counted.__base=original;
    window.renderLocations=counted;try{renderLocations=counted}catch(_){ }
    const observer=new MutationObserver(()=>{
      badges.forEach((badge,index)=>{if(!badge.isConnected||!badge.textContent||badge.textContent!==texts[index]||getComputedStyle(badge).display==='none'||getComputedStyle(badge).visibility==='hidden')violations++});
    });
    observer.observe(document.getElementById('locations'),{childList:true,subtree:true,characterData:true,attributes:true});
    await cloudApplyRemote(rows,[remotePhoto],null,state);
    observer.disconnect();
    window.renderLocations=original;try{renderLocations=original}catch(_){ }
    return{
      renderCalls,violations,
      sameCards:cards.every((node,index)=>node===document.querySelector(`[data-location-card="${CSS.escape(selected[index].id)}"]`)),
      sameBadges:badges.every((node,index)=>node===document.querySelector(`[data-location-card="${CSS.escape(selected[index].id)}"] [data-card-recommendation-v448]`)),
      texts:badges.map(node=>node.textContent),
      diagnostics:window.BogatkaSyncIntegrity.lastApply,
    };
  });
  expect(result.renderCalls).toBe(0);
  expect(result.violations).toBe(0);
  expect(result.sameCards).toBe(true);
  expect(result.sameBadges).toBe(true);
  expect(result.texts.every(Boolean)).toBe(true);
  expect(result.diagnostics).toMatchObject({structural:false,dataChanged:[],photoChanged:[],rendered:false});
});
