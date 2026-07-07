import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=location-report-collapse-v464';

async function openApp(page,width=1440,height=1200){
  await page.setViewportSize({width,height});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaInspectionLayoutV461?.ready&&
    window.BogatkaLocationDataV452?.ready&&
    window.BogatkaStatusNextTaskV447?.ready&&
    document.querySelector('[data-location-card][data-inspection-layout-v462="1"]')&&
    document.querySelector('[data-location-card] .next-task-card-v447')
  ),{timeout:30000});
  const card=page.locator('[data-location-card]').first();
  await card.evaluate(node=>window.BogatkaLocationCardCollapseV422?.setCollapsed?.(node,false,{persist:false}));
  return card;
}

const visibleField=(card,field)=>card.locator(`[data-field="${field}"]:not([data-stage6-marker-v461])`).first();

async function waitStored(page,id,field,value){
  await page.waitForFunction(async({id,field,value})=>{
    const data=await getLocationData(id);
    const actual=field.split('.').reduce((current,key)=>current?.[key],data);
    return String(actual??'')===String(value);
  },{id,field,value},{timeout:15000});
}

test('inspection context is redistributed into two balanced cards without duplicate visible controls',async({page})=>{
  const card=await openApp(page);
  const fields=['objectSource','listingUrl','objectSourceOther','inspectionPurpose','inspectionParticipants','inspectionResult'];
  for(const field of fields)await expect(card.locator(`[data-field="${field}"]:not([data-stage6-marker-v461])`)).toHaveCount(1);

  expect(await visibleField(card,'inspectionPurpose').evaluate(node=>node.closest('.inspection-grid-v416')!==null)).toBe(true);
  expect(await visibleField(card,'inspectionResult').evaluate(node=>node.closest('.inspection-grid-v416')!==null)).toBe(true);
  expect(await visibleField(card,'objectSource').evaluate(node=>node.closest('.landlord-grid-v416')!==null)).toBe(true);
  expect(await visibleField(card,'listingUrl').evaluate(node=>node.closest('.landlord-grid-v416')!==null)).toBe(true);
  expect(await visibleField(card,'inspectionParticipants').evaluate(node=>node.closest('.landlord-grid-v416')!==null)).toBe(true);
  await expect(card.locator('.landlord-inspection-v461')).toHaveCount(0);
  await expect(card.locator('.inspection-extra-v452')).toBeHidden();

  const geometry=await card.evaluate(node=>{
    const left=node.querySelector('.inspection-card-v416').getBoundingClientRect();
    const right=node.querySelector('.landlord-card-v416').getBoundingClientRect();
    return{heightDelta:Math.abs(left.height-right.height),bottomDelta:Math.abs(left.bottom-right.bottom)};
  });
  expect(geometry.heightDelta).toBeLessThanOrEqual(2);
  expect(geometry.bottomDelta).toBeLessThanOrEqual(2);
});

test('labels, source wording and controls use the established typography and dimensions',async({page})=>{
  const card=await openApp(page);
  const captions=await card.evaluate(node=>Object.fromEntries(
    ['objectSource','listingUrl','inspectionPurpose','inspectionParticipants','inspectionResult'].map(field=>{
      const control=[...node.querySelectorAll(`[data-field="${field}"]`)].find(item=>!item.hasAttribute('data-stage6-marker-v461'));
      return[field,control?.closest('label.field')?.querySelector(':scope > .profile-caption-v416')?.textContent||''];
    })
  ));
  expect(captions).toEqual({
    objectSource:'Как нашли объект',
    listingUrl:'Ссылка на объявление / карточку',
    inspectionPurpose:'Цель осмотра',
    inspectionParticipants:'Участники осмотра',
    inspectionResult:'Итог осмотра',
  });

  const source=visibleField(card,'objectSource');
  expect(await source.locator('option[value="Собственник"]').textContent()).toBe('Напрямую от собственника');
  expect(await source.locator('option[value="Агент / посредник"]').textContent()).toBe('Через агента / посредника');
  expect(await source.locator('option[value="Объявление"]').textContent()).toBe('По объявлению');

  const styles=await card.evaluate(node=>{
    const field=name=>[...node.querySelectorAll(`[data-field="${name}"]`)].find(item=>!item.hasAttribute('data-stage6-marker-v461'));
    const source=field('objectSource');
    const sourceTrigger=source.nextElementSibling?.classList.contains('premium-select-trigger')?source.nextElementSibling:source;
    const purpose=field('inspectionPurpose');
    const caption=purpose.closest('label.field').querySelector(':scope > .profile-caption-v416');
    const taskCaption=node.querySelector('.next-task-v447>.profile-caption-v416');
    const taskCard=node.querySelector('.next-task-card-v447');
    const taskTitle=taskCard.querySelector('strong');
    const taskMeta=taskCard.querySelector('small');
    return{
      sourceHeight:Math.round(sourceTrigger.getBoundingClientRect().height),
      purposeHeight:Math.round(purpose.getBoundingClientRect().height),
      sourceFont:getComputedStyle(sourceTrigger).fontSize,
      purposeFont:getComputedStyle(purpose).fontSize,
      captionFont:getComputedStyle(caption).fontSize,
      captionGap:Math.round(purpose.getBoundingClientRect().top-caption.getBoundingClientRect().bottom),
      taskTitleFont:getComputedStyle(taskTitle).fontSize,
      taskMetaFont:getComputedStyle(taskMeta).fontSize,
      taskTitleWeight:Number(getComputedStyle(taskTitle).fontWeight),
      taskMetaWeight:Number(getComputedStyle(taskMeta).fontWeight),
      taskGap:Math.round(taskCard.getBoundingClientRect().top-taskCaption.getBoundingClientRect().bottom),
      listingPadding:[getComputedStyle(field('listingUrl')).paddingLeft,getComputedStyle(field('listingUrl')).paddingRight],
      participantsPadding:[getComputedStyle(field('inspectionParticipants')).paddingLeft,getComputedStyle(field('inspectionParticipants')).paddingRight],
    };
  });
  expect(styles.sourceHeight).toBe(46);
  expect(styles.purposeHeight).toBe(46);
  expect(styles.sourceFont).toBe('12px');
  expect(styles.purposeFont).toBe('12px');
  expect(styles.captionFont).toBe('11px');
  expect(styles.captionGap).toBe(5);
  expect(styles.taskTitleFont).toBe('12px');
  expect(styles.taskMetaFont).toBe('12px');
  expect(styles.taskTitleWeight).toBeGreaterThan(styles.taskMetaWeight);
  expect(styles.taskGap).toBe(5);
  expect(styles.listingPadding).toEqual(styles.participantsPadding);
  expect(styles.listingPadding).toEqual(['10px','10px']);
});

test('moved controls keep persistence, conditional source behavior and viewer protection',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  const purpose=visibleField(card,'inspectionPurpose');
  const participants=visibleField(card,'inspectionParticipants');
  const source=visibleField(card,'objectSource');
  const other=visibleField(card,'objectSourceOther');

  await purpose.fill('Повторная проверка замеров');
  await purpose.blur();
  await waitStored(page,id,'inspectionPurpose','Повторная проверка замеров');
  await participants.fill('Дмитрий и представитель собственника');
  await participants.blur();
  await waitStored(page,id,'inspectionParticipants','Дмитрий и представитель собственника');

  await source.evaluate(select=>{select.value='Другое';select.dispatchEvent(new Event('change',{bubbles:true}));});
  await waitStored(page,id,'objectSource','Другое');
  await expect(other.locator('xpath=..')).toBeVisible();
  await other.fill('Управляющая компания');
  await other.blur();
  await waitStored(page,id,'objectSourceOther','Управляющая компания');

  await page.evaluate(()=>{try{cloudRole='viewer'}catch(_){ }window.cloudRole='viewer';window.BogatkaLocationDataV452.applyViewerState(document);});
  for(const field of ['objectSource','listingUrl','objectSourceOther','inspectionPurpose','inspectionParticipants','inspectionResult'])await expect(visibleField(card,field)).toBeDisabled();
});

test('mobile layout stays single-column and overflow free',async({page})=>{
  const card=await openApp(page,390,900);
  const result=await card.evaluate(node=>{
    const overview=node.querySelector('.location-overview-v416');
    const left=node.querySelector('.inspection-card-v416');
    const right=node.querySelector('.landlord-card-v416');
    const task=node.querySelector('.next-task-card-v447');
    const landlordGrid=node.querySelector('.landlord-grid-v416');
    return{
      overviewWidth:overview.getBoundingClientRect().width,
      overviewScroll:overview.scrollWidth,
      leftWidth:left.getBoundingClientRect().width,
      rightWidth:right.getBoundingClientRect().width,
      taskWidth:task.getBoundingClientRect().width,
      columns:getComputedStyle(overview).gridTemplateColumns,
      rightColumns:getComputedStyle(landlordGrid).gridTemplateColumns,
      landlordOverflow:landlordGrid.scrollWidth-landlordGrid.clientWidth,
    };
  });
  expect(result.overviewScroll).toBeLessThanOrEqual(Math.ceil(result.overviewWidth)+1);
  expect(result.leftWidth).toBeLessThanOrEqual(result.overviewWidth+1);
  expect(result.rightWidth).toBeLessThanOrEqual(result.overviewWidth+1);
  expect(result.taskWidth).toBeLessThanOrEqual(result.leftWidth);
  expect(result.columns.split(' ').length).toBe(1);
  expect(result.rightColumns.split(' ').length).toBe(1);
  expect(result.landlordOverflow).toBeLessThanOrEqual(1);
});

test('v461 assets are present in the offline cache manifest',async({page})=>{
  await openApp(page);
  const worker=await page.evaluate(()=>fetch('./sw-v340.js').then(response=>response.text()));
  expect(worker).toContain('./inspection-layout-v461.css');
  expect(worker).toContain('./inspection-layout-v461.js');
});
