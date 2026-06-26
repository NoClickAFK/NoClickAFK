import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=400';

async function authorize(page) {
  await page.addInitScript(() => {
    localStorage.setItem('bogatka_access_authorized_v1', '1');
  });
}

test('Bogatka 4.0.0 loads and passes the built-in self-test', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));

  await authorize(page);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });

  await expect(page.locator('#app')).toBeVisible();
  await expect(page.locator('#versionLabel')).toHaveText('4.0.0');
  await expect(page.locator('[data-location-card]')).toHaveCount(7);
  await expect(page.locator('#diagnosticsPillV400')).toHaveText('Самопроверка: OK', { timeout: 20_000 });

  const selfTest = await page.evaluate(() => {
    const raw = localStorage.getItem('bogatka_selftest_v400');
    return raw ? JSON.parse(raw) : null;
  });

  expect(selfTest?.version).toBe('4.0.0');
  expect(selfTest?.ok).toBe(true);
  expect(selfTest?.checks?.length).toBeGreaterThan(10);
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
