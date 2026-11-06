import { expect, type Page } from '@playwright/test';
import type { Property } from '../../src/types';
import { mockCompliancePendingForAnyProperty } from './compliance-mock';
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
  await mockComuniApi(page);
  await mockPropertyIcalApi(page);
  await mockCompliancePendingForAnyProperty(page);

  const isCollectionPath = (url: string) => {
    const path = new URL(url).pathname.replace(/\/$/, '');
    return path.endsWith('/api/properties') || path.endsWith('/properties');
  };

  await page.route('**/api/properties**', async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    const path = new URL(url).pathname;

    if (path.includes('/cin-compliance') || /\/cin$/.test(path)) {
      await route.fallback();
      return;
    }

    // The photos step of the wizard reads the gallery of the property it has just created: none yet.
    if (method === 'GET' && /\/properties\/[^/]+\/images\/?$/.test(path)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          photoUrls: [],
          maxPhotos: 20,
          maxFilesPerRequest: 10,
          maxFileSizeBytes: 10 * 1024 * 1024,
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
        }),
      });
      return;
    }

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

    // The wizard of a new property asks how many properties the plan allows (SR-07a): a plan with room, whatever the store holds.
    if (method === 'GET' && path.endsWith('/properties/plan-usage')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ used: store.properties.length, max: null, unlimited: true, canAdd: true }),
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

    const byIdMatch = path.match(/\/api\/properties\/([^/]+)\/?$/);
    if (method === 'GET' && byIdMatch) {
      const property = store.properties.find((p) => p.id === byIdMatch[1]);
      if (!property) {
        await route.fulfill({ status: 404, body: JSON.stringify({ title: 'Not Found' }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(property),
      });
      return;
    }

    // PATCH semantics on PUT (A2-04): what the body carries is changed, the rest stays. The API answers 204.
    if (method === 'PUT' && byIdMatch) {
      const index = store.properties.findIndex((p) => p.id === byIdMatch[1]);
      if (index < 0) {
        await route.fulfill({ status: 404, body: JSON.stringify({ title: 'Not Found' }) });
        return;
      }
      store.properties[index] = { ...store.properties[index], ...(route.request().postDataJSON() as Partial<Property>) };
      await route.fulfill({ status: 204 });
      return;
    }

    await route.fallback();
  });

  await mockListingDataApi(page);

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

/** Official ISTAT comuni list (SU-04) with the two comuni the specs use: the property form picks the city from it. */
const MOCK_COMUNI = [
  {
    istatCode: '015146',
    cadastralCode: 'F205',
    name: 'Milano',
    displayName: 'Milano',
    provinceCode: 'MI',
    regionCode: 'LOM',
    regionIstatCode: '03',
    regionName: 'Lombardia',
    isActive: true,
  },
  {
    istatCode: '058091',
    cadastralCode: 'H501',
    name: 'Roma',
    displayName: 'Roma',
    provinceCode: 'RM',
    regionCode: 'LAZ',
    regionIstatCode: '12',
    regionName: 'Lazio',
    isActive: true,
  },
];

export async function mockComuniApi(page: Page): Promise<void> {
  await page.route(/\/api\/comuni(\/|\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/\/$/, '');
    let body: unknown;
    if (path.endsWith('/comuni/status')) {
      body = { datasetAvailable: true, referenceDate: '2026-01-01', sourceVersion: 'e2e' };
    } else if (path.endsWith('/comuni')) {
      const query = (url.searchParams.get('q') ?? '').toLowerCase();
      body = { datasetAvailable: true, items: MOCK_COMUNI.filter((c) => c.name.toLowerCase().includes(query)) };
    } else {
      body = MOCK_COMUNI.find((c) => path.endsWith(`/comuni/${c.istatCode}`));
    }
    await route.fulfill({
      status: body ? 200 : 404,
      contentType: 'application/json',
      body: JSON.stringify(body ?? { status: 404, title: 'Not Found' }),
    });
  });
}

export interface PropertyWizardInput {
  name: string;
  address: string;
  /** Name of a comune of the mocked ISTAT list: it gives the city. */
  comune: string;
  postalCode?: string;
}

/**
 * Fills the first step of «Aggiungi immobile» (SR-07b): the kind and the spaces keep the defaults of the design, and the city comes
 * from the ISTAT comune picker (there is no free text). Only the answers the test cares about are given.
 */
export async function fillPropertyWizard(page: Page, values: PropertyWizardInput): Promise<void> {
  await page.getByLabel("Nome dell'immobile", { exact: true }).fill(values.name);
  await page.getByLabel('Indirizzo', { exact: true }).fill(values.address);
  await page.getByTestId('comune-picker-input').fill(values.comune);
  await page.getByRole('option', { name: new RegExp(`^${values.comune}`) }).first().click();
  // The region under the field is read from the chosen comune: it is there once the choice has taken effect.
  await expect(page.getByTestId('comune-picker-region')).toBeVisible();
  if (values.postalCode) await page.getByLabel('CAP', { exact: true }).fill(values.postalCode);
}

/**
 * Goes through the first step of the wizard and presses «Continua»: that is where the property is created. Returns the answer of the
 * creation, so the test can look at its status; the wizard is then on its next step.
 */
export async function createPropertyWithWizard(page: Page, values: PropertyWizardInput) {
  await fillPropertyWizard(page, values);
  const created = page.waitForResponse(
    (response) => response.request().method() === 'POST' && /\/properties\/?$/.test(new URL(response.url()).pathname),
  );
  await page.getByTestId('property-wizard-next').click();
  return created;
}

/** iCal calendars of a property (PC-10, PC-12): no feed connected, an export link. */
export async function mockPropertyIcalApi(page: Page): Promise<void> {
  await page.route('**/api/properties/*/ical/**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith('/ical/feeds')
      ? []
      : path.endsWith('/ical/export-url')
        ? { exportUrl: 'https://casazen.example/ical/export/e2e-token.ics' }
        : { exportUrl: 'https://casazen.example/ical/export/e2e-token.ics', blockCount: 0, feeds: [] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

const AMENITY_CATALOG = {
  groups: [
    { id: 'comfort', label: { it: 'Comfort', en: 'Comfort' } },
    { id: 'kitchen', label: { it: 'Cucina', en: 'Kitchen' } },
    { id: 'outdoor', label: { it: 'Esterni e posizione', en: 'Outdoors and location' } },
  ],
  amenities: [
    { name: 'WiFi', icon: 'wifi', group: 'comfort', label: { it: 'Wi-Fi', en: 'Wi-Fi' } },
    { name: 'Washer', icon: 'shirt', group: 'comfort', label: { it: 'Lavatrice', en: 'Washing machine' } },
    { name: 'Kitchen', icon: 'utensils', group: 'kitchen', label: { it: 'Cucina', en: 'Kitchen' } },
    { name: 'Pool', icon: 'waves', group: 'outdoor', label: { it: 'Piscina', en: 'Pool' } },
  ],
};

/**
 * The listing data the wizard reads and writes besides the property (NF-31, NF-32, NF-34, NF-35): the rooms, the length-of-stay discounts,
 * the site profile with the texts of the other languages, the captions of the photos and the catalog of the amenities. Empty to begin
 * with; what is saved is echoed back, as the server does. Without it the wizard cannot open on a property that exists.
 */
export async function mockListingDataApi(page: Page): Promise<void> {
  const state = { rooms: [] as unknown[], discounts: [] as unknown[], translations: {} as Record<string, unknown> };
  const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  const propertyOf = (url: string) => new URL(url).pathname.match(/\/properties\/([^/]+)\//)?.[1] ?? '';

  await page.route('**/api/public/amenities', (route) => route.fulfill(json(AMENITY_CATALOG)));

  await page.route('**/api/properties/*/rooms', async (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as { rooms: Array<{ id?: string | null; type: string; beds: unknown[] }> };
      state.rooms = body.rooms.map((room, position) => ({ id: room.id ?? `room-${position + 1}`, position, type: room.type, beds: room.beds }));
    }
    await route.fulfill(json(state.rooms));
  });

  await page.route('**/api/properties/*/stay-discounts', async (route) => {
    if (route.request().method() === 'PUT') state.discounts = (route.request().postDataJSON() as { discounts: unknown[] }).discounts;
    await route.fulfill(json(state.discounts));
  });

  await page.route('**/api/properties/*/site-profile', async (route) => {
    if (route.request().method() === 'PUT') state.translations = (route.request().postDataJSON() as { translations: Record<string, unknown> }).translations;
    const origins = Object.fromEntries(
      Object.entries(state.translations).flatMap(([language, texts]) => Object.keys(texts as object).map((field) => [`${language}.${field}`, 'UserWritten'])),
    );
    await route.fulfill(
      json({
        propertyId: propertyOf(route.request().url()),
        floorLevel: null,
        renovatedYear: null,
        energyClass: null,
        energyIndex: null,
        areaKind: null,
        childrenWelcome: null,
        checkInTo: null,
        videoUrl: null,
        tourUrl: null,
        zone: null,
        near: null,
        floorNote: null,
        outdoorNote: null,
        checkInMethod: null,
        rulesNote: null,
        highlights: [],
        safetyNotes: [],
        tags: [],
        derivedTags: [],
        translations: state.translations,
        origins,
        updatedAt: new Date(0).toISOString(),
      }),
    );
  });

  await page.route('**/api/properties/*/site-profile/photos', (route) => route.fulfill(json([])));
}
