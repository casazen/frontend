import { test, expect } from './test';
import { demoUrl, setDemoProfile } from './helpers/demo-profile';
import { pinE2eLocale } from './helpers/locale';

test('the guide panel of the header is the manual: search, topics and the full manual in their own tab', async ({ page }) => {
  await pinE2eLocale(page, 'it');
  await setDemoProfile(page, 'short-stay');
  await page.goto(demoUrl('/app/short-rent', 'short-stay'));
  await page.getByTestId('guide-button').click();
  const panel = page.getByTestId('guide-panel');
  await expect(panel.getByRole('searchbox', { name: 'Cerca nel manuale' })).toBeVisible();
  await expect(panel.getByTestId('guide-topics').getByRole('listitem')).toHaveCount(4);
  const fullManual = panel.getByTestId('guide-full-manual');
  await expect(fullManual).toHaveAttribute('href', '/guida/');
  await expect(fullManual).toHaveAttribute('target', '_blank');
  await expect(panel.getByTestId('guide-setup')).toHaveCount(0);
  await expect(panel.getByTestId('guide-todo')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('guide topics page remains usable on a phone', async ({ page }) => {
  await pinE2eLocale(page, 'it');
  await setDemoProfile(page, 'short-stay');
  await page.goto(demoUrl('/app/short-rent/help', 'short-stay'));
  await expect(page.getByRole('heading', { name: 'Guida CasaZen' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Cerca nella guida' }).fill('ricevuta del portale');
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(1);
  await page.getByRole('link', { name: 'Alloggiati e adempimenti', exact: true }).click();
  await expect(page).toHaveURL(/#guide-compliance$/);
  await expect(page.getByText(/Di norma CasaZen prepara i dati e il file per l.invio manuale/)).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('link', { name: 'Torna agli argomenti' }).click();
  await expect(page.getByRole('searchbox', { name: 'Cerca nella guida' })).toHaveValue('ricevuta del portale');
  await page.getByRole('searchbox', { name: 'Cerca nella guida' }).fill('');
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(11);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
