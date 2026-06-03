import { test, expect } from '@playwright/test';
import { PROPERTY_ID, historyAfterSync, configDisabled } from './fixtures/pricing.fixtures';
import {
  mockPricingApiDefaults,
  mockConfigDisabled,
  mockHistoryAfterSync,
} from './helpers/api-mock';
import { demoUrl } from './helpers/demo-profile';

const PRICING_URL = `/properties/${PROPERTY_ID}/pricing`;
const HISTORY_URL = `/properties/${PROPERTY_ID}/pricing/history`;

// ---------------------------------------------------------------------------
// Test 1: Enable AI pricing → verify config saved → manual sync → history entry
// ---------------------------------------------------------------------------
test('enable AI pricing, trigger manual sync, and verify new history entry appears', async ({ page }) => {
  await mockPricingApiDefaults(page);

  let syncCalled = false;
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/pricing-adapter/sync/')) {
      syncCalled = true;
    }
  });

  await page.goto(demoUrl(PRICING_URL, 'short-stay'));

  // The AI pricing config card should be visible
  await expect(page.getByRole('heading', { name: 'AI Dynamic Pricing', level: 3 })).toBeVisible();

  // The toggle should already be ON (configEnabled.isEnabled = true)
  const toggle = page.getByRole('switch', { name: /enable ai pricing/i });
  await expect(toggle).toBeChecked();

  // The "Active" badge should be shown
  await expect(page.getByText('Active')).toBeVisible();

  // The sync button should be visible (pricing is enabled)
  const syncBtn = page.getByRole('button', { name: /run sync now/i });
  await expect(syncBtn).toBeVisible();

  // After sync is triggered, the history endpoint should return the updated list
  await mockHistoryAfterSync(page);

  // Click sync
  await syncBtn.click();

  await expect.poll(() => syncCalled).toBe(true);

  // Navigate to the history page to confirm the new entry is listed
  await page.goto(demoUrl(HISTORY_URL, 'short-stay'));

  const newEntryReason = historyAfterSync.items[0].changeReason; // 'Manual sync triggered'
  await expect(page.getByText(newEntryReason)).toBeVisible();

  // The total count should reflect the updated history
  await expect(page.getByText(`${historyAfterSync.total} entries`)).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 2: Disable AI pricing → toggle reflected in UI
// ---------------------------------------------------------------------------
test('disable AI pricing and verify the UI reflects the disabled state', async ({ page }) => {
  await mockPricingApiDefaults(page);

  // After the DELETE call, subsequent GET config calls should return disabled state
  let deleteCallCount = 0;
  await page.route(`**/api/pricing-adapter/config/${PROPERTY_ID}`, async (route) => {
    const method = route.request().method();
    if (method === 'DELETE') {
      deleteCallCount++;
      await route.fulfill({ status: 204 });
    } else if (method === 'GET') {
      // First GET → enabled; subsequent GETs (after disable) → disabled
      const body = deleteCallCount > 0 ? configDisabled : { ...configDisabled, isEnabled: true };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    } else {
      await route.fallback();
    }
  });

  await page.goto(demoUrl(PRICING_URL, 'short-stay'));

  // Pricing should start as enabled
  const toggle = page.getByRole('switch', { name: /enable ai pricing/i });
  await expect(toggle).toBeChecked();
  await expect(page.getByText('Active')).toBeVisible();

  // Click the toggle to disable AI pricing
  await toggle.click();

  await expect(page.getByText('Disabled', { exact: true })).toBeVisible({ timeout: 10000 });

  // The DELETE call must have been made
  expect(deleteCallCount).toBeGreaterThan(0);

  // The badge should now show "Disabled" (already asserted above)

  // The sync button should be hidden (pricing disabled → no sync available)
  await expect(page.getByRole('button', { name: /run sync now/i })).not.toBeVisible();

  // The empty state for the preview should appear
  await expect(page.getByText('AI pricing is disabled')).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 3: View audit trail → verify pagination works correctly
// ---------------------------------------------------------------------------
test('audit trail page paginates correctly across multiple pages', async ({ page }) => {
  await mockPricingApiDefaults(page);

  await page.goto(demoUrl(HISTORY_URL, 'short-stay'));

  // Page header
  await expect(page.getByRole('heading', { name: 'Pricing Audit Trail' })).toBeVisible();

  // First page: history entry from page 1 is visible
  await expect(page.getByText('Weekend peak demand')).toBeVisible();

  // Pagination summary: 25 total entries → 2 pages (page size 20)
  await expect(page.getByText(/page 1 of 2/i)).toBeVisible();
  await expect(page.getByText('25 entries')).toBeVisible();

  // Previous page button should be disabled on page 1
  const prevBtn = page.getByLabel('Previous page');
  const nextBtn = page.getByLabel('Next page');
  await expect(prevBtn).toBeDisabled();
  await expect(nextBtn).toBeEnabled();

  // Navigate to page 2
  await nextBtn.click();

  // Page 2 entry is now visible
  await expect(page.getByText('Low season adjustment')).toBeVisible();

  // Pagination state updated
  await expect(page.getByText(/page 2 of 2/i)).toBeVisible();

  // Next button should now be disabled on the last page
  await expect(nextBtn).toBeDisabled();
  await expect(prevBtn).toBeEnabled();

  // Navigate back to page 1
  await prevBtn.click();
  await expect(page.getByText('Weekend peak demand')).toBeVisible();
  await expect(page.getByText(/page 1 of 2/i)).toBeVisible();
});
