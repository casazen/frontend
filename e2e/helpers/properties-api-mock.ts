import type { Page } from '@playwright/test';
import type { Property } from '../../src/types';
import {
  buildCreatedProperty,
  buildPropertyDetailFromProperty,
  emptyPropertyList,
} from '../fixtures/properties.fixtures';

/**
 * Stateful in-memory mock for property list, create, and detail endpoints.
 */
export async function mockPropertiesApi(page: Page, initial: Property[] = emptyPropertyList): Promise<void> {
  const store = { properties: [...initial] };

  const isCollectionPath = (url: string) => {
    const path = new URL(url).pathname.replace(/\/$/, '');
    return path.endsWith('/api/properties') || path.endsWith('/properties');
  };

  await page.route('**/api/properties**', async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    const path = new URL(url).pathname;

    if (path.includes('/detail') || path.includes('/documents') || path.includes('/images')) {
      await route.fallback();
      return;
    }

    if (method === 'GET' && isCollectionPath(url)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(store.properties),
      });
      return;
    }

    if (method === 'POST' && isCollectionPath(url)) {
      const body = route.request().postDataJSON() as Partial<Property>;
      const created = buildCreatedProperty({
        name: body.name ?? 'Casa E2E Flow',
        description: body.description,
        address: body.address,
        city: body.city,
        country: body.country,
        postalCode: body.postalCode,
        bedrooms: body.bedrooms,
        bathrooms: body.bathrooms,
        maxGuests: body.maxGuests,
        nightlyRate: body.nightlyRate,
        amenities: body.amenities ?? [],
        isActive: body.isActive ?? true,
      });
      store.properties.push(created);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
      return;
    }

    await route.fallback();
  });

  await page.route('**/api/properties/*/detail', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    const match = route.request().url().match(/\/api\/properties\/([^/]+)\/detail/);
    const id = match?.[1];
    const property = store.properties.find((p) => p.id === id);

    if (!property) {
      await route.fulfill({ status: 404, body: JSON.stringify({ title: 'Not Found' }) });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildPropertyDetailFromProperty(property)),
    });
  });
}
