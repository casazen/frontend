import type { Page } from '@playwright/test';

export async function mockEmptyAdminStats(page: Page) {
  await page.route('**/api/admin/stats', route => route.fulfill({ json: {
    totalProperties: 0,
    activeProperties: 0,
    totalBookings: 0,
    bookingsThisMonth: 0,
    upcomingCheckIns: 0,
    totalRevenue: 0,
    cinCompliance: { total: 0, valid: 0, missing: 0, invalid: 0 },
    otaSyncHealth: { synced: 0, failed: 0, neverSynced: 0 },
  } }));
}
