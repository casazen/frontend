import type { Page } from '@playwright/test';
import {
  PROPERTY_ID,
  configEnabled,
  configDisabled,
  recalculateResponse,
  suggestionsData,
} from '../fixtures/pricing.fixtures';

const pricingBase = `**/api/pricing-adapter`;

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

export async function mockPricingApiDefaults(page: Page): Promise<void> {
  await page.route(`${pricingBase}/suggestions/${PROPERTY_ID}`, (route) => {
    if (route.request().method() !== 'GET') { route.fallback(); return; }
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(suggestionsData),
    });
  });

  await page.route(`${pricingBase}/recalculate/${PROPERTY_ID}`, (route) => {
    if (route.request().method() !== 'POST') { route.fallback(); return; }
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(recalculateResponse),
    });
  });

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
