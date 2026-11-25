import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { pinE2eLocale } from './helpers/locale';

for (const width of [1440, 390]) {
  test('Rental settings, site documents and dashboard disclosure at ' + width, async ({ page }) => {
    await pinE2eLocale(page, 'it');
    await page.setViewportSize({ width, height: width > 500 ? 1000 : 844 });
    await page.goto(demoUrl('/app/short-rent/settings', 'short-stay'));
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Impostazioni', exact: true })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Documenti sito' })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Stripe Connect' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await main.getByRole('link', { name: 'Documenti sito' }).click();
    await expect(page).toHaveURL(/settings\/site-documents$/);
    await page.goBack();
    await expect(main.getByRole('link', { name: 'Stripe Connect' })).toBeVisible();
    await page.goto(demoUrl('/app/short-rent', 'short-stay'));
    const performance = page.getByTestId('home-performance');
    await expect(performance.getByRole('button')).toBeVisible();
    await expect(page.getByTestId('dashboard-period')).toBeHidden();
    await performance.getByRole('button').click();
    await expect(page.getByTestId('dashboard-period')).toBeVisible();
  });
}
