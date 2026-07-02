import {test,expect} from '@playwright/test';

const REPORT='http://127.0.0.1:4173/bogatka-field-8f3c7d/report/index.html?token=test-v452-details';

test('public report shows source, inspection basis, power balance, decision reason and explicit checklist states',async({page})=>{
  const payload={
    name:'Тестовый отчёт',
    snapshot:{
      project:{name:'Богатка'},
      global:{},
      photos:[],
      locations:[{
        id:'test-location-v452',
        title:'Тестовая локация',
        address:'Гродно, тестовый адрес',
        form_data:{
          objectSource:'Объявление',
          listingUrl:'example.com/room-12',
          inspectionPurpose:'Повторные замеры',
          inspectionParticipants:'Директор и инженер',
          inspectionResult:'Условия подтверждены',
          decision:'Под вопросом',
          decisionReason:'Нужно уменьшить аренду',
          tech:{powerKw:'18',requiredPowerKw:'22'},
          check:{housing_dense:'yes',housing_occupied:'no',foot_traffic:'not_applicable'},
        },
      }],
    },
  };
  await page.route('**/bogatka-public-report?*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)}));
  await page.goto(REPORT,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.BogatkaPublicLocationDataV452?.ready&&window.BogatkaPublicLocationDetailsV452?.ready&&document.querySelector('.location-data-public-v452')),{timeout:15000});

  const details=page.locator('.location-data-public-v452');
  await expect(details).toContainText('Источник объекта: Объявление');
  await expect(details).toContainText('Повторные замеры');
  await expect(details).toContainText('Директор и инженер');
  await expect(details).toContainText('Условия подтверждены');
  await expect(details).toContainText('Нужно уменьшить аренду');
  await expect(details).toContainText('Дефицит 4 кВт');
  await expect(details.locator('a')).toHaveAttribute('href','https://example.com/room-12');

  const checklist=page.locator('.checklist-public-v452');
  await expect(checklist).toContainText('Да');
  await expect(checklist).toContainText('Нет');
  await expect(checklist).toContainText('Не требуется');
  await expect(checklist).toContainText('Не проверено');
  await expect(checklist).not.toContainText('Площадь подходит под выбранный формат');
  await expect(checklist).not.toContainText('Планировка подходит под стеллажи и кассу');

  const worker=await page.evaluate(()=>fetch('../sw-v340.js').then(response=>response.text()));
  expect(worker).toContain('./report/location-data-v452.js');
  expect(worker).toContain('./report/location-details-v452.js');
});
