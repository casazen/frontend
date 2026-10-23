import { test, expect } from './test';
import { demoUrl, setDemoProfile } from './helpers/demo-profile';
import { pinE2eLocale } from './helpers/locale';

test('guide opens from the header and remains usable on a phone', async ({ page }) => {
  await pinE2eLocale(page, 'it');
  await setDemoProfile(page, 'short-stay');
  await page.goto(demoUrl('/app/short-rent', 'short-stay'));
  await page.getByRole('link', { name: 'Guida', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/short-rent\/help/);
  await expect(page.getByRole('heading', { name: 'Guida CasaZen' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Cerca nella guida' }).fill('ricevuta del portale');
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(1);
  await page.getByRole('link', { name: 'Alloggiati e adempimenti', exact: true }).click();
  await expect(page).toHaveURL(/#guide-compliance$/);
  await expect(page.getByText(/Nel flusso attuale CasaZen prepara/)).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('searchbox').fill('');
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(11);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
