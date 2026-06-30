import {test,expect} from '@playwright/test';
import {openApp,openPane} from './workflow-v414-test-helpers.mjs';

test('history uses current readable labels and ten entries per page',async({page})=>{
  const card=await openApp(page);
  await page.evaluate(async()=>{
    const id=locations[0].id;
    const data=await getLocationData(id);
    data.activity=Array.from({length:23},(_,index)=>({
      id:`entry-${index}`,
      at:new Date(Date.now()-index*1000).toISOString(),
      actor:'Дмитрий',
      action:'Изменено поле',
      field:index%2?'score.storage':'score.overall',
      from:'1',
      to:'2',
    }));
    await idbPut(STORE,data,`location:${id}`);
    await updateSummary();
    await window.BogatkaWorkflowV414.refreshCard(document.querySelector(`[data-location-card="${id}"]`));
  });
  await openPane(page,'history');
  const history=card.locator('[data-history-list]');
  await expect(history.locator('.history-item-v400')).toHaveCount(10);
  await expect(history.locator('.history-item-v400').first()).toContainText(/Общий потенциал локации|Качество складской и подсобной зоны/);
  await expect(history.locator('.history-pagination-v414')).toContainText('Страница 1 из 3');
  await history.locator('[data-history-next]').click();
  await expect(history.locator('.history-pagination-v414')).toContainText('Страница 2 из 3');
});
