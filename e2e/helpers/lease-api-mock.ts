import type { Page } from '@playwright/test';
import { emptyLeasesList } from '../fixtures/leases.fixtures';

export async function mockLeasesApiEmpty(page: Page): Promise<void> {
  await page.route(/\/api\/leases(\?.*)?$/, (route) => {
    if (route.request().method() !== 'GET') {
      route.fallback();
      return;
    }
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(emptyLeasesList),
    });
  });
}
