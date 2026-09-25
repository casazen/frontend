import { test, expect } from './test';
import {
  PROPERTY_ID,
  configEnabled,
  configDisabled,
  suggestionsDataMinimal,
} from './fixtures/pricing.fixtures';
import {
  mockPricingApiDefaults,
  mockConfigDisabled,
  mockDelayedRecalculate,
} from './helpers/api-mock';
import { demoUrl } from './helpers/demo-profile';
import { mockCurrentUserWithOrg, mockEntitlement, mockPlansCatalog } from './helpers/org-api-mock';

const PRICING_URL = `/properties/${PROPERTY_ID}/pricing`;

test.describe('Seasonal suggestions (D4, PC-15)', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlansCatalog(page);
    await mockCurrentUserWithOrg(page);
    await mockEntitlement(page);
    await mockPricingApiDefaults(page);
  });

  test('page shows the seasonal suggestions settings, no AI wording', async ({ page }) => {
    await page.goto(demoUrl(PRICING_URL, 'short-stay'));

    await expect(page.getByRole('heading', { name: 'Seasonal suggestions', level: 1 })).toBeVisible();
    await expect(page.getByRole('switch', { name: /turn on seasonal suggestions/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /save rules/i })).toBeVisible();
    await expect(page.getByText(/\bAI\b/)).toHaveCount(0);
    await expect(page.getByText(/confidence/i)).toHaveCount(0);
  });

  test('enabling saves the config, shows success toast and On badge', async ({ page }) => {
    await mockConfigDisabled(page);

    let saveCallCount = 0;
    await page.route(`**/api/pricing-adapter/config/${PROPERTY_ID}`, async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        saveCallCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(configEnabled),
        });
        return;
      }
      if (method === 'GET') {
        const body = saveCallCount > 0 ? configEnabled : configDisabled;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(body),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto(demoUrl(PRICING_URL, 'short-stay'));

    const toggle = page.getByRole('switch', { name: /turn on seasonal suggestions/i });
    await expect(toggle).not.toBeChecked();
    await expect(page.getByText('Off', { exact: true })).toBeVisible();

    await toggle.click();

    await expect.poll(() => saveCallCount).toBe(1);
    await expect(page.getByText('Suggestion rules saved')).toBeVisible();
    await expect(page.getByText('On', { exact: true })).toBeVisible();
    await expect(toggle).toBeChecked();
  });

  test('manual recalculation shows spinner and success toast', async ({ page }) => {
    let recalculateCalled = false;
    await mockDelayedRecalculate(page, {
      onRecalculate: () => {
        recalculateCalled = true;
      },
    });

    await page.goto(demoUrl(PRICING_URL, 'short-stay'));

    const button = page.getByTestId('recalculate-btn');
    await expect(button).toBeVisible();
    await button.click();
    await expect(button).toContainText('Computing...', { timeout: 10_000 });
    await expect.poll(() => recalculateCalled).toBe(true);
    await expect(page.getByText('Suggestions recalculated')).toBeVisible();
  });

  test('suggestions show the real base price and the rule applied', async ({ page }) => {
    await page.route(`**/api/pricing-adapter/suggestions/${PROPERTY_ID}`, (route) => {
      if (route.request().method() !== 'GET') {
        route.fallback();
        return;
      }
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(suggestionsDataMinimal),
      });
    });

    await page.goto(demoUrl(PRICING_URL, 'short-stay'));

    await expect(page.getByTestId('current-base-price')).toContainText('180');
    const rows = page.getByTestId('suggestions-table').locator('tbody tr');
    await expect(rows).toHaveCount(7);
    await expect(rows.nth(2)).toContainText('Republic Day');
    await expect(rows.nth(3)).toContainText('High season ×1.30');
    await expect(page.getByTestId('read-only-notice')).toBeVisible();
  });

  test('disabling hides the recalculation and shows the disabled state', async ({ page }) => {
    let deleteCallCount = 0;
    await page.route(`**/api/pricing-adapter/config/${PROPERTY_ID}`, async (route) => {
      const method = route.request().method();
      if (method === 'DELETE') {
        deleteCallCount++;
        await route.fulfill({ status: 204 });
        return;
      }
      if (method === 'GET') {
        const body = deleteCallCount > 0 ? configDisabled : configEnabled;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(body),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto(demoUrl(PRICING_URL, 'short-stay'));

    const toggle = page.getByRole('switch', { name: /turn on seasonal suggestions/i });
    await expect(toggle).toBeChecked();

    await toggle.click();

    await expect(page.getByText('Seasonal suggestions turned off')).toBeVisible();
    await expect.poll(() => deleteCallCount).toBe(1);
    await expect(page.getByTestId('recalculate-btn')).not.toBeVisible();
    await expect(page.getByText('Seasonal suggestions are off')).toBeVisible();
  });

  test('save sends frequency and explicit rules', async ({ page }) => {
    let savedBody: Record<string, unknown> | null = null;

    await page.route(`**/api/pricing-adapter/config/${PROPERTY_ID}`, async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        savedBody = JSON.parse(route.request().postData() ?? '{}');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...configEnabled, ...savedBody }),
        });
        return;
      }
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(configEnabled),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto(demoUrl(PRICING_URL, 'short-stay'));

    await page.getByTestId('frequency-weekly').check();
    await page.getByTestId('high-month-9').click();
    await page.getByTestId('holiday-multiplier').fill('1.4');
    await page.getByTestId('include-public-holidays').click();
    await page.getByTestId('save-config-btn').click();

    await expect(page.getByText('Suggestion rules saved')).toBeVisible();
    expect(savedBody).toMatchObject({
      adaptationFrequency: 'weekly',
      highSeasonMonths: [6, 7, 8, 9],
      holidayMultiplier: 1.4,
      includePublicHolidays: false,
    });
  });
});
