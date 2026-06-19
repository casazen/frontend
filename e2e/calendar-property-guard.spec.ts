import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { mockPropertiesApi } from './helpers/properties-api-mock';
import { buildCreatedProperty } from './fixtures/properties.fixtures';

const PROPERTY_A = buildCreatedProperty({
  id: '11111111-1111-1111-1111-111111111101',
  name: 'Villa Mare',
});
const PROPERTY_B = buildCreatedProperty({
  id: '11111111-1111-1111-1111-111111111102',
  name: 'Casa Montagna',
  city: 'Cortina',
});

test.describe('Calendar property guard (#282)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/bookings/calendar**', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      const url = new URL(route.request().url());
      const propertyId = url.searchParams.get('propertyId');
      if (!propertyId) {
        await route.fulfill({ status: 400, body: JSON.stringify({ error: 'propertyId required' }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ bookings: [], timezone: 'Europe/Rome', utcOffsetMinutes: 60 }),
      });
    });
  });

  test('does not hammer calendar API without propertyId', async ({ page }) => {
    await mockPropertiesApi(page, [PROPERTY_A, PROPERTY_B]);

    const calendarRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/bookings/calendar')) {
        calendarRequests.push(req.url());
      }
    });

    await page.goto(demoUrl('/app/short-rent/bookings/calendar', 'short-stay'), {
      waitUntil: 'networkidle',
    });

    await expect(page.locator('#calendar-property')).toBeVisible();
    expect(calendarRequests.length).toBeLessThanOrEqual(2);
    for (const url of calendarRequests) {
      expect(new URL(url).searchParams.get('propertyId')).toBeTruthy();
    }
  });

  test('shows Italian empty state when no properties', async ({ page }) => {
    await mockPropertiesApi(page, []);

    await page.goto(demoUrl('/app/short-rent/bookings/calendar', 'short-stay'), {
      waitUntil: 'networkidle',
    });

    await expect(page.getByText('Nessuna proprietà disponibile')).toBeVisible();
    await expect(page.getByText(/Aggiungi una proprietà per visualizzare il calendario/i)).toBeVisible();
  });
});
