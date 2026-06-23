import { test as base, expect } from '@playwright/test';
import { installDemoUserMeMock, mockPlansCatalog } from './helpers/org-api-mock';

async function mockLegalDocuments(page: import('@playwright/test').Page): Promise<void> {
  const legalDoc = {
    version: '1.0.0',
    effectiveAt: '2026-01-01T00:00:00Z',
    title: 'Test Document',
    summary: 'E2E test document.',
  };

  await page.route('**/api/legal/tos', async (route) => {
    if (route.request().method() !== 'GET') { await route.fallback(); return; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(legalDoc) });
  });
  await page.route('**/api/legal/privacy', async (route) => {
    if (route.request().method() !== 'GET') { await route.fallback(); return; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(legalDoc) });
  });
  await page.route('**/api/legal/dpa', async (route) => {
    if (route.request().method() !== 'GET') { await route.fallback(); return; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(legalDoc) });
  });
  await page.route('**/api/legal/subprocessors', async (route) => {
    if (route.request().method() !== 'GET') { await route.fallback(); return; }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version: '1.0.0',
        effectiveAt: '2026-01-01T00:00:00Z',
        items: [{ name: 'Test Processor', purpose: 'Testing', region: 'EU' }],
      }),
    });
  });
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      if (!localStorage.getItem('casazen.locale')) {
        localStorage.setItem('casazen.locale', 'en');
      }
    });
    await installDemoUserMeMock(page);
    await mockPlansCatalog(page);
    await mockLegalDocuments(page);
    await use(page);
  },
});

export { expect };
