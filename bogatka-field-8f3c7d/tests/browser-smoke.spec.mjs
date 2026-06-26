import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=400';
const RESET_URL = 'http://127.0.0.1:4173/bogatka-field-8f3c7d/reset/';

async function authorize(page) {
  await page.addInitScript(() => localStorage.setItem('bogatka_access_authorized_v1', '1'));
}

test('Bogatka 4.0.0 loads and passes acceptance checks', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  await authorize(page);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });

  await expect(page.locator('#app')).toBeVisible();
  await expect(page.locator('#versionLabel')).toHaveText('4.0.0');
  await expect(page.locator('[data-location-card]')).toHaveCount(7);
  await expect(page.locator('#diagnosticsPillV400')).toHaveText('Самопроверка: OK', { timeout: 20_000 });

  const state = await page.evaluate(() => {
    const raw = localStorage.getItem('bogatka_selftest_v400');
    const merged = window.BogatkaBackupImport?.mergeRecord(
      { tasks:[{id:'local-task',title:'Local',updatedAt:'2026-01-01T00:00:00Z'}], comments:[{id:'removed-comment',text:'Old'}], deletedCommentIds:[] },
      { tasks:[{id:'remote-task',title:'Remote',updatedAt:'2026-01-02T00:00:00Z'}], comments:[], deletedCommentIds:['removed-comment'] }
    );
    return {
      selfTest: raw ? JSON.parse(raw) : null,
      archiveSync: Boolean(window.BogatkaCloudArchive?.enabled),
      normalized: window.BogatkaAddressFix?.normalizeAddress('Гродно, ул. Лидская, 34'),
      duplicate: window.BogatkaAddressFix?.findAddressDuplicate('г. Гродно, улица Лидская, 34')?.exact,
      backupTaskIds: merged?.tasks?.map(item => item.id).sort(),
      backupComments: merged?.comments?.length,
      weakPasswordError: window.bogatkaValidateNewPassword?.('weak123'),
      strongPasswordError: window.bogatkaValidateNewPassword?.('StrongPassword2026'),
    };
  });

  expect(state.selfTest?.version).toBe('4.0.0');
  expect(state.selfTest?.ok).toBe(true);
  expect(state.selfTest?.checks?.length).toBeGreaterThan(10);
  expect(state.archiveSync).toBe(true);
  expect(state.normalized).toBe('лидская 34');
  expect(state.duplicate).toBe(true);
  expect(state.backupTaskIds).toEqual(['local-task','remote-task']);
  expect(state.backupComments).toBe(0);
  expect(state.weakPasswordError).toContain('12');
  expect(state.strongPasswordError).toBe('');
  expect(pageErrors).toEqual([]);
});

test('mobile layout does not create page-level horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authorize(page);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await expect(page.locator('#app')).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
});

test('password recovery uses current security policy and return URL', async ({ page }) => {
  await page.goto(RESET_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#newPassword')).toHaveAttribute('minlength', '12');
  await expect(page.locator('#repeatPassword')).toHaveAttribute('minlength', '12');
  await expect(page.locator('#returnToApp')).toHaveAttribute('href', '../?v=400');
});
