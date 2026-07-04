import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=traffic-premium-hotfix';
const DESCRIPTION='Замеры помогают сравнить поток людей в разное время и понять, насколько локация подходит для магазина. Каждый замер сохраняется отдельно и может быть отредактирован или удалён';
const GUIDANCE='День недели определится автоматически после выбора даты. Показатели целевой аудитории, конкурента и парковки заполняйте только при наличии наблюдаемых данных';

async function editor(page){
  await page.evaluate(()=>{try{cloudRole=null}catch(_){ }window.cloudRole=null;window.BogatkaTrafficCompetitorsV453?.applyViewerState?.(document);});
}

async function openApp(page,width=1440,height=1000){
  await page.setViewportSize({width,height});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaTrafficCompetitorsV453?.ready&&
    window.BogatkaTrafficCompetitorsPersistenceV453?.ready&&
    window.BogatkaTrafficCompetitorsCompatV453?.ready&&
    document.querySelector('[data-location-card]')
  ),{timeout:30000});
  await editor(page);
  await page.evaluate(()=>window.BogatkaTrafficCompetitorsV453.enhanceAll());
  await page.waitForFunction(()=>window.BogatkaTrafficCompetitorsV453.audit().ok,{timeout:30000});
  return page.locator('[data-location-card]').first();
}

async function reveal(card,title){
  await card.evaluate((node,text)=>{
    window.BogatkaLocationCardCollapseV422?.setCollapsed?.(node,false,{persist:true});
    const details=[...node.querySelectorAll('details')].find(item=>item.querySelector(':scope > summary')?.textContent.includes(text));
    if(!details)return;
    details.open=true;
    for(let current=details;current&&current!==node;current=current.parentElement){
      if(current.tagName==='DETAILS')current.open=true;
      current.hidden=false;
      current.classList.remove('hidden','panel-closed-v419','collapsed');
      if(current.dataset?.panelOpenV419!==undefined)current.dataset.panelOpenV419='1';
    }
    window.BogatkaTrafficCompetitorsCompatV453?.openAncestors?.(details);
  },title);
}

async function openTraffic(page,card){
  await reveal(card,'Полевой замер трафика');
  await editor(page);
  await expect(card.locator('.traffic-stage7-v453')).toBeVisible();
}

async function waitStored(page,id,predicate,args={}){
  await page.waitForFunction(async({id,args,source})=>{
    const data=await getLocationData(id);
    return Function('data','args',`return (${source})(data,args)`)(data,args);
  },{id,args,source:predicate.toString()},{timeout:15000});
  await page.waitForFunction(()=>window.BogatkaTrafficCompetitorsPersistenceV453.pendingWrites===0,{timeout:15000});
}

async function seed(page,id,patch){
  await page.evaluate(async({id,patch})=>{
    const data=await getLocationData(id);
    Object.assign(data,patch);
    await idbPut(STORE,data,`location:${id}`);
    renderLocations();
  },{id,patch});
  await page.waitForFunction(()=>window.BogatkaTrafficCompetitorsV453.audit().ok,{timeout:30000});
  await editor(page);
}

async function addMeasurement(card){
  await card.locator('[data-stage7-action="add-traffic"]').click();
  return card.locator('.traffic-measurement-v453').last();
}

test('legacy traffic is hidden without migration and structured controls use exact copy',async({page})=>{
  let card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  const legacy={weekdayMorning:'77',weekdayDay:'8',weekdayEvening:'19',weekendDay:'7',weekendEvening:'12',parkingOccupied:'5',dogWalkers:'4',competitorVisitors:'2'};
  await seed(page,id,{traffic:legacy,trafficMeasurements:[]});
  card=page.locator(`[data-location-card="${id}"]`);
  await openTraffic(page,card);

  await expect(card.locator('.traffic-intro-v453')).toHaveText(DESCRIPTION);
  await expect(card).not.toContainText('Ранее сохранённые поля');
  await expect(card).not.toContainText('Эти значения сохранены без преобразования и не удаляются.');
  await expect(card.locator('.legacy-traffic-v453')).toHaveCount(0);
  await expect(card.locator('.legacy-traffic-controls-v453')).toBeHidden();
  await expect(card.locator('.traffic-measurement-v453')).toHaveCount(0);

  const stored=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(stored.traffic).toEqual(legacy);
  expect(stored.trafficMeasurements).toEqual([]);

  await expect(card.locator('.traffic-summary-v453 span')).toHaveText(['Замеров','Всего минут','Учтено прохожих']);
  await expect(card.locator('[data-traffic-summary-v453="count"]')).toHaveText('0');
  await expect(card.locator('[data-traffic-summary-v453="minutes"]')).toHaveText('0');
  await expect(card.locator('[data-traffic-summary-v453="people"]')).toHaveText('0');

  const row=await addMeasurement(card);
  await expect(row.locator('[data-weekday-v453]')).toHaveText(GUIDANCE);
  await waitStored(page,id,(data)=>data.trafficMeasurements?.length===1);
  const after=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(after.traffic).toEqual(legacy);
  expect(after.trafficMeasurements).toHaveLength(1);
});

test('premium traffic form has required rows, labels, placeholders and responsive layout',async({page})=>{
  const card=await openApp(page,1440,1000);
  await openTraffic(page,card);
  const row=await addMeasurement(card);

  const first=['Дата замера','Начало замера','Длительность','Погода'];
  const second=['Прохожих всего','Потенциальная целевая аудитория','Прохожих с собаками','Посетителей конкурента','Занято парковки, %'];
  await expect(row.locator('.traffic-primary-row-v453 .profile-caption-v416')).toHaveText(first);
  await expect(row.locator('.traffic-indicators-row-v453 .profile-caption-v416')).toHaveText(second);
  await expect(row.locator('.traffic-comment-row-v453 .profile-caption-v416')).toHaveText(['Комментарий']);
  await expect(row.locator('[data-stage7-field="peopleCount"]')).toHaveAttribute('placeholder','Все люди, прошедшие мимо точки наблюдения');
  await expect(row.locator('[data-stage7-field="targetCustomers"]')).toHaveAttribute('placeholder','Оценочно, только если можно определить');
  await expect(row.locator('[data-stage7-field="dogWalkers"]')).toHaveAttribute('placeholder','Люди, проходящие или гуляющие с собаками');
  await expect(row.locator('[data-stage7-field="competitorVisitors"]')).toHaveAttribute('placeholder','Заполняйте только при наличии конкурента');
  await expect(row.locator('[data-stage7-field="parkingOccupiedPct"]')).toHaveAttribute('placeholder','Заполняйте только при наличии парковки');
  await expect(row.locator('[data-stage7-field="comment"]')).toHaveAttribute('placeholder','Например: где проводился замер, что происходило рядом, были ли очереди, мероприятия, перекрытия или другие факторы, повлиявшие на поток');

  const desktop=await row.evaluate(node=>{
    const first=node.querySelector('.traffic-primary-row-v453');
    const second=node.querySelector('.traffic-indicators-row-v453');
    const comment=node.querySelector('.traffic-comment-row-v453').getBoundingClientRect();
    const card=node.getBoundingClientRect();
    const label=node.querySelector('.stage7-field-v453');
    const input=node.querySelector('.stage7-field-v453 input');
    return{
      firstColumns:getComputedStyle(first).gridTemplateColumns.split(' ').length,
      secondColumns:getComputedStyle(second).gridTemplateColumns.split(' ').length,
      commentWidth:comment.width,
      innerWidth:card.width-32,
      gap:getComputedStyle(label).gap,
      inputHeight:input.getBoundingClientRect().height,
      overflow:node.scrollWidth-node.clientWidth,
    };
  });
  expect(desktop.firstColumns).toBe(4);
  expect(desktop.secondColumns).toBe(5);
  expect(Math.abs(desktop.commentWidth-desktop.innerWidth)).toBeLessThanOrEqual(2);
  expect(desktop.gap).toBe('5px');
  expect(desktop.inputHeight).toBeGreaterThanOrEqual(48);
  expect(desktop.overflow).toBeLessThanOrEqual(1);

  await page.setViewportSize({width:390,height:900});
  const mobile=await row.evaluate(node=>({
    firstColumns:getComputedStyle(node.querySelector('.traffic-primary-row-v453')).gridTemplateColumns.split(' ').length,
    secondColumns:getComputedStyle(node.querySelector('.traffic-indicators-row-v453')).gridTemplateColumns.split(' ').length,
    overflow:node.scrollWidth-node.clientWidth,
    buttonOverlap:(()=>{
      const button=node.querySelector('[data-stage7-action="remove-traffic"]').getBoundingClientRect();
      const fields=node.querySelector('.traffic-primary-row-v453').getBoundingClientRect();
      return button.bottom>fields.top&&button.right>fields.left&&button.left<fields.right;
    })(),
  }));
  expect(mobile.firstColumns).toBe(1);
  expect(mobile.secondColumns).toBe(1);
  expect(mobile.overflow).toBeLessThanOrEqual(1);
  expect(mobile.buttonOverlap).toBe(false);
});

test('duration, weather, weekday, summary and independent persistence work',async({page})=>{
  let card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await seed(page,id,{trafficMeasurements:[{
    id:'unknown-weather',date:'2026-07-01',startTime:'09:00',durationMinutes:'45',peopleCount:'10',
    targetCustomers:'',dogWalkers:'',competitorVisitors:'',parkingOccupiedPct:'',weather:'Порывистый ветер',comment:'Старое значение',
    createdAt:'2026-07-01T00:00:00.000Z',updatedAt:'2026-07-01T00:00:00.000Z',
  }]});
  card=page.locator(`[data-location-card="${id}"]`);
  await openTraffic(page,card);

  const first=card.locator('.traffic-measurement-v453').first();
  const duration=first.locator('[data-stage7-field="durationMinutes"]');
  const weather=first.locator('[data-stage7-field="weather"]');
  await expect(duration.locator('option')).toContainText(['15 минут','30 минут','60 минут','90 минут','120 минут','45 минут']);
  await expect(duration).toHaveValue('45');
  await expect(weather).toHaveValue('Порывистый ветер');
  await expect(weather.locator('option')).toContainText('Порывистый ветер');

  await duration.selectOption('120');
  await weather.selectOption('Дождь');
  await first.locator('[data-stage7-field="peopleCount"]').fill('42');
  await first.locator('[data-stage7-field="date"]').fill('2026-07-02');
  await first.locator('[data-stage7-field="date"]').blur();
  await waitStored(page,id,(data)=>data.trafficMeasurements?.[0]?.durationMinutes==='120'&&data.trafficMeasurements?.[0]?.weather==='Дождь'&&data.trafficMeasurements?.[0]?.peopleCount==='42'&&data.trafficMeasurements?.[0]?.date==='2026-07-02');

  await expect(card.locator('[data-traffic-summary-v453="count"]')).toHaveText('1');
  await expect(card.locator('[data-traffic-summary-v453="minutes"]')).toHaveText('120');
  await expect(card.locator('[data-traffic-summary-v453="people"]')).toHaveText('42');
  await expect(first.locator('[data-weekday-v453]')).toHaveText('Четверг');

  const second=await addMeasurement(card);
  await second.locator('[data-stage7-field="durationMinutes"]').selectOption('90');
  await second.locator('[data-stage7-field="peopleCount"]').fill('8');
  await second.locator('[data-stage7-field="targetCustomers"]').fill('7');
  await second.locator('[data-stage7-field="dogWalkers"]').fill('6');
  await second.locator('[data-stage7-field="competitorVisitors"]').fill('5');
  await second.locator('[data-stage7-field="parkingOccupiedPct"]').fill('4');
  await second.locator('[data-stage7-field="comment"]').fill('Второй независимый замер');
  await second.locator('[data-stage7-field="comment"]').blur();
  await waitStored(page,id,(data)=>data.trafficMeasurements?.length===2&&data.trafficMeasurements?.[1]?.comment==='Второй независимый замер');

  await expect(card.locator('[data-traffic-summary-v453="count"]')).toHaveText('2');
  await expect(card.locator('[data-traffic-summary-v453="minutes"]')).toHaveText('210');
  await expect(card.locator('[data-traffic-summary-v453="people"]')).toHaveText('50');

  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.BogatkaTrafficCompetitorsV453?.audit().ok,{timeout:30000});
  card=page.locator(`[data-location-card="${id}"]`);
  await openTraffic(page,card);
  await expect(card.locator('.traffic-measurement-v453')).toHaveCount(2);
  await expect(card.locator('.traffic-measurement-v453').nth(0).locator('[data-stage7-field="weather"]')).toHaveValue('Дождь');
  await expect(card.locator('.traffic-measurement-v453').nth(1).locator('[data-stage7-field="comment"]')).toHaveValue('Второй независимый замер');
});

test('parking rejects invalid values and add edit delete remain safe',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  await openTraffic(page,card);
  const row=await addMeasurement(card);
  await row.locator('[data-stage7-field="parkingOccupiedPct"]').fill('50');
  await row.locator('[data-stage7-field="parkingOccupiedPct"]').blur();
  await waitStored(page,id,(data)=>data.trafficMeasurements?.[0]?.parkingOccupiedPct==='50');

  const parking=row.locator('[data-stage7-field="parkingOccupiedPct"]');
  await parking.fill('120');
  await parking.blur();
  await expect(parking).toHaveValue('50');
  expect((await page.evaluate(locationId=>getLocationData(locationId),id)).trafficMeasurements[0].parkingOccupiedPct).toBe('50');

  const people=row.locator('[data-stage7-field="peopleCount"]');
  await people.fill('12');
  await people.blur();
  await waitStored(page,id,(data)=>data.trafficMeasurements?.[0]?.peopleCount==='12');
  await expect(card.locator('[data-traffic-summary-v453="people"]')).toHaveText('12');

  page.once('dialog',dialog=>dialog.accept());
  await row.locator('[data-stage7-action="remove-traffic"]').click();
  await waitStored(page,id,(data)=>Array.isArray(data.trafficMeasurements)&&data.trafficMeasurements.length===0);
  await expect(card.locator('.traffic-measurement-v453')).toHaveCount(0);
  await expect(card.locator('.stage7-empty-v453')).toBeVisible();
  await expect(card.locator('[data-traffic-summary-v453="count"]')).toHaveText('0');
});

test('viewer remains read-only and focused input is not rerendered',async({page})=>{
  const card=await openApp(page);
  await openTraffic(page,card);
  const row=await addMeasurement(card);
  const comment=row.locator('[data-stage7-field="comment"]');
  await comment.focus();
  await comment.type('Фокус сохраняется');
  await expect(comment).toBeFocused();

  await page.evaluate(()=>{
    cloudRole='viewer';
    window.cloudRole='viewer';
    window.BogatkaTrafficCompetitorsV453.applyViewerState(document);
  });
  for(const control of await card.locator('.traffic-stage7-v453 input,.traffic-stage7-v453 select,.traffic-stage7-v453 textarea').all())await expect(control).toBeDisabled();
  await expect(card.locator('[data-stage7-action="add-traffic"]')).toBeHidden();
  await expect(card.locator('[data-stage7-action="remove-traffic"]')).toBeHidden();
});
