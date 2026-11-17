import { expect, test } from '@playwright/test';

for (const viewport of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
  test(`person access summary and role comparison on ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => localStorage.setItem('casazen.locale', 'it'));
    await page.goto('/e2e/fixtures/person-access.html');
    await expect(page.getByRole('heading', { level: 1, name: 'Cosa vede Anna Rossi' })).toBeVisible();
    const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const capture = async (name: string) => {
      const path = testInfo.outputPath(`person-access-${viewport.name}-${name}.png`);
      await page.screenshot({ path, fullPage: true });
      await testInfo.attach(name, { path, contentType: 'image/png' });
    };
    await fits();
    await expect(page.getByText('Casa Lago', { exact: true })).toBeVisible();
    await expect(page.getByText('Riservata', { exact: true })).toHaveCount(0);
    const menu = page.getByTestId('preview-pages-short-rent');
    await expect(menu).not.toHaveAttribute('open');
    await expect(page.getByTestId('preview-cannot-long-rent')).toBeVisible();
    await capture('summary');
    const summary = menu.locator('summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(menu).toHaveAttribute('open');
    await expect(summary).toBeFocused();
    await fits();
    await capture('menu');

    await page.getByTestId('preview-role-Admin').click();
    await expect(page.getByTestId('preview-trying')).toBeVisible();
    await expect(page.getByTestId('preview-role-Admin')).toHaveAttribute('aria-pressed', 'true');
    await fits();
    await capture('comparison');
    await page.getByTestId('preview-back-today').click();
    await expect(page.getByTestId('preview-trying')).toHaveCount(0);
    await expect(page.getByTestId('preview-role-Collaborator')).toHaveAttribute('aria-pressed', 'true');
  });
}
