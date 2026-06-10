import { test, expect } from './test';
import {
  PROPERTY_ID,
  configEnabled,
  configDisabled,
  historyPage1,
  historyPage2,
  historyAfterSync,
  previewDataMinimal,
} from './fixtures/pricing.fixtures';
import {
  mockPricingApiDefaults,
  mockConfigDisabled,
  mockHistoryAfterSync,
} from './helpers/api-mock';
import { demoUrl } from './helpers/demo-profile';
import { mockCurrentUserWithOrg, mockEntitlement, mockPlansCatalog } from './helpers/org-api-mock';

const PRICING_URL = `/properties/${PROPERTY_ID}/pricing`;
const HISTORY_URL = `/properties/${PROPERTY_ID}/pricing/history`;

test.describe('Pricing Adapter verification (AC16–AC20)', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlansCatalog(page);
    await mockCurrentUserWithOrg(page);
    await mockEntitlement(page);
    await mockPricingApiDefaults(page);
  });

  test('AC16: pricing dashboard shows the AI configuration section', async ({ page }) => {
    await page.goto(demoUrl(PRICING_URL, 'short-stay'));

    await expect(page.getByRole('heading', { name: 'AI Dynamic Pricing', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'AI Dynamic Pricing', level: 3 })).toBeVisible();
    await expect(page.getByRole('switch', { name: /enable ai pricing/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /save configuration/i })).toBeVisible();
  });

  test('AC17: enabling AI pricing saves config, shows success toast, and Active badge', async ({
    page,
  }) => {
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

    const toggle = page.getByRole('switch', { name: /enable ai pricing/i });
    await expect(toggle).not.toBeChecked();
    await expect(page.getByText('Disabled', { exact: true })).toBeVisible();

    await toggle.click();

    await expect.poll(() => saveCallCount).toBe(1);
    await expect(page.getByText('Pricing configuration saved')).toBeVisible();
    await expect(page.getByText('Active')).toBeVisible();
    await expect(toggle).toBeChecked();
  });

  test('AC18: manual sync shows spinner, success toast, and no console errors', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    let syncCalled = false;
    await page.route(`**/api/pricing-adapter/sync/${PROPERTY_ID}`, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      syncCalled = true;
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ jobId: 'job-e2e-sync-001' }),
      });
    });

    await page.goto(demoUrl(PRICING_URL, 'short-stay'));

    const syncBtn = page.getByTestId('sync-btn');
    await expect(syncBtn).toBeVisible();

    await syncBtn.click();

    await expect(syncBtn).toContainText('Syncing...');
    await expect.poll(() => syncCalled).toBe(true);
    await expect(page.getByText('Pricing sync started — history will update shortly')).toBeVisible();
    const relevantErrors = consoleErrors.filter(
      (msg) =>
        !msg.includes('No response from server') &&
        !msg.includes('ERR_CONNECTION_REFUSED') &&
        !msg.includes('[Auth Debug]'),
    );
    expect(relevantErrors).toEqual([]);
  });

  test('AC19: history table shows date, prices, and AI confidence columns', async ({ page }) => {
    await page.goto(demoUrl(PRICING_URL, 'short-stay'));

    const historySection = page
      .getByRole('heading', { name: 'Price Adaptation History' })
      .locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');

    await expect(historySection).toBeVisible();
    await expect(historySection.getByRole('columnheader', { name: 'Date' })).toBeVisible();
    await expect(historySection.getByRole('columnheader', { name: 'Prev Price' })).toBeVisible();
    await expect(historySection.getByRole('columnheader', { name: 'New Price' })).toBeVisible();
    await expect(historySection.getByRole('columnheader', { name: 'Confidence' })).toBeVisible();

    const firstEntry = historyPage1.items[0];
    await expect(historySection.getByText(firstEntry.changeReason)).toBeVisible();
    await expect(historySection.getByText('92%')).toBeVisible();
  });

  test('AC20: preview section renders at least seven future price rows', async ({ page }) => {
    await page.route(`**/api/pricing-adapter/preview/${PROPERTY_ID}`, (route) => {
      if (route.request().method() !== 'GET') {
        route.fallback();
        return;
      }
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(previewDataMinimal),
      });
    });

    await page.goto(demoUrl(PRICING_URL, 'short-stay'));

    const priceDetailsTable = page
      .getByRole('heading', { name: 'Price Details' })
      .locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]')
      .locator('table tbody tr');

    await expect(page.getByRole('heading', { name: '90-Day Price Preview' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Price Details' })).toBeVisible();
    await expect(priceDetailsTable).toHaveCount(7);
    await expect(priceDetailsTable.first()).toContainText('2026');
    await expect(priceDetailsTable.first()).toContainText('€');
  });
});

test.describe('Pricing Adapter — additional implemented flows', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlansCatalog(page);
    await mockCurrentUserWithOrg(page);
    await mockEntitlement(page);
    await mockPricingApiDefaults(page);
  });

  test('disable AI pricing hides sync control and shows disabled empty state', async ({ page }) => {
    let deleteCallCount = 0;
    await page.route(`**/api/pricing-adapter/config/${PROPERTY_ID}`, async (route) => {
      const method = route.request().method();
      if (method === 'DELETE') {
        deleteCallCount++;
        await route.fulfill({ status: 204 });
        return;
      }
      if (method === 'GET') {
        const body = deleteCallCount > 0 ? configDisabled : { ...configDisabled, isEnabled: true };
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

    const toggle = page.getByRole('switch', { name: /enable ai pricing/i });
    await expect(toggle).toBeChecked();

    await toggle.click();

    await expect(page.getByText('AI pricing disabled')).toBeVisible();
    await expect.poll(() => deleteCallCount).toBe(1);
    await expect(page.getByText('Disabled', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /run sync now/i })).not.toBeVisible();
    await expect(page.getByText('AI pricing is disabled')).toBeVisible();
  });

  test('save configuration sends adaptation frequency and pricing factors', async ({ page }) => {
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
    await page.getByTestId('include-seasonality').click();
    await page.getByTestId('include-public-holidays').click();
    await page.getByTestId('save-config-btn').click();

    await expect(page.getByText('Pricing configuration saved')).toBeVisible();
    expect(savedBody).toMatchObject({
      adaptationFrequency: 'weekly',
      includeSeasonality: false,
      includePublicHolidays: false,
    });
  });

  test('manual sync updates history list on dashboard', async ({ page }) => {
    await mockHistoryAfterSync(page);

    await page.goto(demoUrl(PRICING_URL, 'short-stay'));
    await page.getByRole('button', { name: /run sync now/i }).click();
    await expect(page.getByText('Pricing sync started — history will update shortly')).toBeVisible();
    await expect(page.getByText(historyAfterSync.items[0].changeReason)).toBeVisible();
  });

  test('history date filters are available on the dashboard', async ({ page }) => {
    await page.goto(demoUrl(PRICING_URL, 'short-stay'));

    await expect(page.getByTestId('history-filter-from')).toBeVisible();
    await expect(page.getByTestId('history-filter-to')).toBeVisible();

    await page.getByTestId('history-filter-from').fill('2026-05-01');
    await page.getByTestId('history-filter-to').fill('2026-05-31');

    await expect(page.getByText('Weekend peak demand')).toBeVisible();
  });

  test('full history page paginates across multiple pages', async ({ page }) => {
    await page.goto(demoUrl(HISTORY_URL, 'short-stay'));

    await expect(page.getByRole('heading', { name: 'Pricing Audit Trail' })).toBeVisible();
    await expect(page.getByText('Weekend peak demand')).toBeVisible();
    await expect(page.getByText(/page 1 of 2/i)).toBeVisible();

    const nextBtn = page.getByLabel('Next page');
    await nextBtn.click();

    await expect(page.getByText('Low season adjustment')).toBeVisible();
    await expect(page.getByText(/page 2 of 2/i)).toBeVisible();
    await expect(page.getByLabel('Next page')).toBeDisabled();
  });

  test('navigate from dashboard to full history page', async ({ page }) => {
    await page.goto(demoUrl(PRICING_URL, 'short-stay'));

    await page.getByRole('link', { name: /full history/i }).click();
    await expect(page).toHaveURL(new RegExp(`/properties/${PROPERTY_ID}/pricing/history`));
    await expect(page.getByRole('heading', { name: 'Pricing Audit Trail' })).toBeVisible();
  });
});
