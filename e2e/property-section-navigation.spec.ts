import { expect, test } from './test';
import { buildCreatedProperty } from './fixtures/properties.fixtures';
import { demoUrl } from './helpers/demo-profile';
import { mockPropertiesApi } from './helpers/properties-api-mock';

for (const width of [390, 1440]) {
  test(`property sections keep their address and keyboard navigation at ${width}px`, async ({ page }) => {
    const property = buildCreatedProperty();
    await mockPropertiesApi(page, [property]);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(demoUrl('/app/short-rent/properties/' + property.id, 'short-stay'));
    if (width === 390) {
      await page.getByTestId('property-tabs-select').selectOption('photos');
    } else {
      await expect(page.getByRole('tablist', { name: /immobile/i })).toHaveAttribute('aria-orientation', 'vertical');
      await page.getByTestId('property-tab-info').focus();
      await page.keyboard.press('ArrowDown');
      await expect(page.getByTestId('property-tab-photos')).toBeFocused();
      await page.keyboard.press('Enter');
    }
    await expect(page).toHaveURL(/tab=photos/);
    await page.reload();
    if (width === 390) await expect(page.getByTestId('property-tabs-select')).toHaveValue('photos');
    else await expect(page.getByTestId('property-tab-photos')).toHaveAttribute('aria-selected', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}
