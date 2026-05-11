import type { Page } from '@playwright/test';
import {
  PROPERTY_ID,
  configEnabled,
  configDisabled,
  historyPage1,
  historyPage2,
  historyAfterSync,
  previewData,
} from '../fixtures/pricing.fixtures';

/**
 * The axios client uses VITE_API_BASE_URL which defaults to
 * https://localhost:5001/api in development.  Playwright intercepts
 * any URL matching these globs regardless of origin.
 */
const pricingBase = `**/api/pricing-adapter`;

/**
 * Registers the full set of default API mocks needed for the AI pricing flow.
 * Playwright route handlers are evaluated in LIFO order — later registrations
 * take priority, so individual tests can override a specific route by calling
 * page.route() AFTER this helper.
 */
export async function mockPricingApiDefaults(page: Page): Promise<void> {
  // GET preview
  await page.route(`${pricingBase}/preview/${PROPERTY_ID}`, (route) => {
    if (route.request().method() !== 'GET') { route.fallback(); return; }
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(previewData),
    });
  });

  // POST sync
  await page.route(`${pricingBase}/sync/${PROPERTY_ID}`, (route) => {
    if (route.request().method() !== 'POST') { route.fallback(); return; }
    route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ jobId: 'job-e2e-sync-001' }),
    });
  });

  // GET history (with optional query string)
  await page.route(`${pricingBase}/history/${PROPERTY_ID}**`, (route) => {
    if (route.request().method() !== 'GET') { route.fallback(); return; }
    const url = new URL(route.request().url());
    const page_ = Number(url.searchParams.get('page') ?? '1');
    const body = page_ >= 2 ? historyPage2 : historyPage1;
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });

  // Config endpoint — handle GET / POST / DELETE by method
  await page.route(`${pricingBase}/config/${PROPERTY_ID}`, (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(configEnabled),
      });
    } else if (method === 'POST') {
      const raw = route.request().postData() ?? '{}';
      const body = JSON.parse(raw);
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...configEnabled, ...body }),
      });
    } else if (method === 'DELETE') {
      route.fulfill({ status: 204 });
    } else {
      route.fallback();
    }
  });
}

/**
 * Overrides the GET config endpoint to return the disabled configuration.
 * Call AFTER mockPricingApiDefaults — Playwright evaluates routes LIFO.
 */
export async function mockConfigDisabled(page: Page): Promise<void> {
  await page.route(`${pricingBase}/config/${PROPERTY_ID}`, (route) => {
    if (route.request().method() !== 'GET') { route.fallback(); return; }
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(configDisabled),
    });
  });
}

/**
 * Overrides GET history to return the post-sync state (new entry at top).
 */
export async function mockHistoryAfterSync(page: Page): Promise<void> {
  await page.route(`${pricingBase}/history/${PROPERTY_ID}**`, (route) => {
    if (route.request().method() !== 'GET') { route.fallback(); return; }
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(historyAfterSync),
    });
  });
}
