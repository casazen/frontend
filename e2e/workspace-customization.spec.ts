import { mockPropertiesApi } from './helpers/properties-api-mock';
import { buildCreatedProperty } from './fixtures/properties.fixtures';
import { test, expect } from './test';
import { demoUrl, setDemoProfile } from './helpers/demo-profile';

test.describe.configure({ timeout: 90_000 });

for (const width of [390, 1440]) {
  test(`personal menu at ${width}px preserves access and can be reset`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setDemoProfile(page, 'short-stay');
    await page.goto(demoUrl('/app/short-rent/settings', 'short-stay'));
    const avatar = page.locator('header button[aria-haspopup="menu"]').last();
    async function customize() {
      await avatar.click();
      await page.getByRole('menuitem', { name: 'Personalizza area di lavoro' }).click();
      return page.getByRole('dialog');
    }
    const dialog = await customize();
    const choice = dialog.getByRole('checkbox', { name: 'Marketplace', exact: true });
    await choice.uncheck();
    if (width === 1440) await dialog.getByRole('checkbox', { name: 'Tabelle e margini compatti' }).check();
    await dialog.getByRole('button', { name: 'Fine', exact: true }).click();
    await page.reload();
    if (width === 1440) {
      await expect(page.getByTestId('app-shell')).toHaveAttribute('data-density', 'compact');
    } else {
      await page.locator('[data-more-trigger]').click();
    }
    const other = page.locator('summary[aria-label="Altre funzioni"]:visible');
    await other.click();
    await other.locator('..').getByRole('link', { name: 'Marketplace', exact: true }).click();
    await expect(page).toHaveURL(/short-rent\/marketplace/);
    const settings = await customize();
    await expect(settings.getByRole('checkbox', { name: 'Marketplace', exact: true })).not.toBeChecked();
    await settings.getByRole('button', { name: 'Ripristina vista iniziale' }).click();
    await expect(settings.getByRole('checkbox', { name: 'Marketplace', exact: true })).toBeChecked();
  });
}

test('property settings search carries the selected property into the rule editor', async ({ page }) => {
  await setDemoProfile(page, 'short-stay');
  const first = buildCreatedProperty({ name: 'Casa Lago' });
  const second = buildCreatedProperty({ id: '8bb0418c-484d-4cb4-93de-1a54c493acba', name: 'Casa Bosco' });
  await mockPropertiesApi(page, [first, second]);
  await page.goto(demoUrl('/app/short-rent/settings', 'short-stay'));
  const search = page.getByRole('searchbox', { name: 'Cerca nelle impostazioni' });
  await search.fill('zzznonesiste');
  await expect(page.getByRole('status').filter({ hasText: 'Nessuna impostazione' })).toBeVisible();
  await search.fill('regole');
  await page.getByLabel('Immobile', { exact: true }).selectOption(second.id);
  const link = page.locator('a[href*="step=rules"]');
  await expect(link).toHaveAttribute('href', new RegExp(second.id));
  await link.click();
  await expect(page).toHaveURL(new RegExp('propertyId=' + second.id + '&step=rules'));
});
