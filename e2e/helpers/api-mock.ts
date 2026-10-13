import type { Page } from '@playwright/test';
import {
  PROPERTY_ID,
  configEnabled,
  configDisabled,
  recalculateResponse,
  suggestionsData,
} from '../fixtures/pricing.fixtures';

/**
 * The axios client uses VITE_API_BASE_URL which defaults to
 * https://localhost:5001/api in development.  Playwright intercepts
 * any URL matching these globs regardless of origin.
 */
const pricingBase = `**/api/pricing-adapter`;

/**
 * Overrides POST recalculate with a delayed response so the UI can show the pending spinner.
 * Call AFTER mockPricingApiDefaults — Playwright evaluates routes LIFO.
 */
export async function mockDelayedRecalculate(
  page: Page,
  options: { delayMs?: number; onRecalculate?: () => void } = {},
): Promise<void> {
  const delayMs = options.delayMs ?? 800;

  await page.route(`${pricingBase}/recalculate/${PROPERTY_ID}`, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    options.onRecalculate?.();
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(recalculateResponse),
    });
  });
}

/**
 * Registers the full set of default API mocks needed for the seasonal suggestions flow.
 * Playwright route handlers are evaluated in LIFO order — later registrations
 * take priority, so individual tests can override a specific route by calling
 * page.route() AFTER this helper.
 */
export async function mockPricingApiDefaults(page: Page): Promise<void> {
  // GET suggestions
  await page.route(`${pricingBase}/suggestions/${PROPERTY_ID}`, (route) => {
    if (route.request().method() !== 'GET') { route.fallback(); return; }
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(suggestionsData),
    });
  });

  // POST recalculate
  await page.route(`${pricingBase}/recalculate/${PROPERTY_ID}`, (route) => {
    if (route.request().method() !== 'POST') { route.fallback(); return; }
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(recalculateResponse),
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
