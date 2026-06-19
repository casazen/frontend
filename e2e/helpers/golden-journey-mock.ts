/**
 * Shared mocks for Golden Journey E2E (F0 skeleton — steps 1–4).
 * Full journey wired in Fase 1 (#301).
 */
import type { Page } from '@playwright/test';
import { mockPropertiesApi } from './properties-api-mock';
import { buildCreatedProperty } from '../fixtures/properties.fixtures';
import { mockPublicBookingReadApi } from './public-booking-readmodel-mock';

const GJ_PROPERTY = buildCreatedProperty({
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  name: 'GJ Villa Test',
  slug: 'gj-villa-test',
});

export const GJ_SLUG = GJ_PROPERTY.slug ?? 'gj-villa-test';

export async function installGoldenJourneyApiMocks(page: Page): Promise<void> {
  const apiErrors: { url: string; status: number }[] = [];

  page.on('response', (res) => {
    const url = res.url();
    if (url.includes('/api/') && res.status() >= 500) {
      apiErrors.push({ url, status: res.status() });
    }
  });

  page.on('close', () => {
    if (apiErrors.length > 0) {
      console.warn('GJ API 500s detected:', apiErrors);
    }
  });

  await mockPropertiesApi(page, [GJ_PROPERTY]);
  await mockPublicBookingReadApi(page);

  await page.route('**/api/suppliers/**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'Active', services: ['cleaning'] }),
      });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/bookings**', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
          status: 'Confirmed',
          propertyId: GJ_PROPERTY.id,
        }),
      });
      return;
    }
    await route.fallback();
  });
}

export function assertNoApi500(page: Page): void {
  page.on('response', (res) => {
    if (res.url().includes('/api/') && res.status() >= 500) {
      throw new Error(`GJ step triggered API ${res.status()}: ${res.url()}`);
    }
  });
}
