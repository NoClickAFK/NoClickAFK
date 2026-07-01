import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=449';
const RENT_LABEL='Что предварительно предложил арендодатель';
const RENT_PLACEHOLDER='Ставка, депозит, каникулы, коммунальные платежи, индексация, ремонт, срок аренды';
const CONTACT_LABEL='Комментарий по контакту';
const CONTACT_PLACEHOLDER='Когда и как лучше связаться, кто принимает решение, важные детали общения';

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaLandlordConditionsV449?.ready&&
    window.BogatkaLiveReport?.build?.__landlordConditionsV449&&
    window.buildReportHtml===window.BogatkaLiveReport.build&&
    document.querySelector('[data-location-card] .landlord-card-v416[data-landlord-conditions-v449="1"]')
  ),{timeout:25000});
  return page.locator('[data-location-card]').first();
}

test('landlord panel separates contact facts from lease proposal',async({page})=>{
  const card=await openApp(page);
  const panel=card.locator('.landlord-card-v416');
  const rent=panel.locator('[data-field="rentConditions"]');
  const contact=panel.locator('[data-field="contactNotes"]');

  await expect(panel.locator('.profile-section-head-v416 > span')).toHaveText('Кто принимает решение, как связаться и что уже предложено по аренде.');
  await expect(rent.locator('xpath=ancestor::label').locator(':scope > .profile-caption-v416,:scope > .evaluation-caption-v446')).toHaveText(RENT_LABEL);
  await expect(rent).toHaveAttribute('placeholder',RENT_PLACEHOLDER);
  await expect(contact.locator('xpath=ancestor::label').locator(':scope > .profile-caption-v416,:scope > .evaluation-caption-v446')).toHaveText(CONTACT_LABEL);
  await expect(contact).toHaveAttribute('placeholder',CONTACT_PLACEHOLDER);

  const text=await panel.innerText();
  expect(text).not.toContain('Дополнительная информация');
  expect(text).not.toContain('договорённости');
  expect(text).not.toContain('Следующий шаг');
});

test('existing data keys persist without migration or duplication',async({page})=>{
  const card=await openApp(page);
  const id=await card.getAttribute('data-location-card');
  const rent=card.locator('[data-field="rentConditions"]');
  const contact=card.locator('[data-field="contactNotes"]');

  await rent.fill('Депозит один месяц, каникулы 30 дней');
  await contact.fill('Связываться после 15:00, решение принимает собственник');
  await page.waitForTimeout(900);

  const stored=await page.evaluate(locationId=>getLocationData(locationId),id);
  expect(stored.rentConditions).toBe('Депозит один месяц, каникулы 30 дней');
  expect(stored.contactNotes).toBe('Связываться после 15:00, решение принимает собственник');
  expect(stored.rent??'').toBe('');

  await page.evaluate(()=>renderLocations());
  await page.waitForFunction(locationId=>document.querySelector(`[data-location-card="${CSS.escape(locationId)}"] .landlord-card-v416[data-landlord-conditions-v449="1"]`),id);
  const rerendered=page.locator(`[data-location-card="${id}"]`);
  await expect(rerendered.locator('[data-field="rentConditions"]')).toHaveValue('Депозит один месяц, каникулы 30 дней');
  await expect(rerendered.locator('[data-field="contactNotes"]')).toHaveValue('Связываться после 15:00, решение принимает собственник');
});

test('history uses the narrowed field names',async({page})=>{
  await openApp(page);
  const labels=await page.evaluate(()=>({
    rent:window.BogatkaWorkflowV414.FIELD_LABELS.rentConditions,
    contact:window.BogatkaWorkflowV414.FIELD_LABELS.contactNotes,
  }));
  expect(labels).toEqual({rent:RENT_LABEL,contact:CONTACT_LABEL});
});

test('HTML and PDF source use the same landlord wording',async({page})=>{
  const card=await openApp(page);
  await card.locator('[data-field="rentConditions"]').fill('Каникулы 30 дней');
  await card.locator('[data-field="contactNotes"]').fill('Лучше писать в Telegram');
  await page.waitForTimeout(700);

  const report=await page.evaluate(async()=>{
    const html=await window.BogatkaLiveReport.build();
    const doc=new DOMParser().parseFromString(html,'text/html');
    const block=doc.querySelector('.report-landlord-v416');
    return{
      text:block?.textContent||'',
      authoritative:window.buildReportHtml===window.BogatkaLiveReport.build,
      marker:Boolean(window.BogatkaLiveReport.build.__landlordConditionsV449),
      htmlAction:window.exportHtmlReport===window.BogatkaLiveReport.build.__htmlAction,
      pdfAction:window.openPdfReport===window.BogatkaLiveReport.build.__pdfAction,
    };
  });

  expect(report.authoritative).toBe(true);
  expect(report.marker).toBe(true);
  expect(report.htmlAction).toBe(true);
  expect(report.pdfAction).toBe(true);
  expect(report.text).toContain(`${RENT_LABEL}:`);
  expect(report.text).toContain('Каникулы 30 дней');
  expect(report.text).toContain(`${CONTACT_LABEL}:`);
  expect(report.text).toContain('Лучше писать в Telegram');
  expect(report.text).not.toContain('Дополнительные условия:');
  expect(report.text).not.toContain('Дополнительная информация:');
});

test('critical lease checks remain unchanged',async({page})=>{
  await openApp(page);
  const state=await page.evaluate(()=>({
    version:window.BogatkaCriticalDeal?.VERSION,
    count:window.BogatkaCriticalDeal?.CONDITIONS?.length,
    keys:window.BogatkaCriticalDeal?.CONDITIONS?.map(item=>item.key),
  }));
  expect(state.version).toBe('4.3.3');
  expect(state.count).toBe(10);
  expect(new Set(state.keys).size).toBe(10);
});
