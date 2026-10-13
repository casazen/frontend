import type { Page } from '@playwright/test';

/** Codes served by the backend catalog `GET /api/service-categories` (ServiceCategories.All, SU-03). */
export const SERVICE_CATEGORY_CODES = [
  'cleaning',
  'maintenance',
  'plumbing',
  'laundry',
  'linen',
  'check-in',
  'gardening',
  'events',
  'rental',
  'excursions',
];

export async function mockServiceCategoriesApi(page: Page): Promise<void> {
  await page.route('**/api/service-categories', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: SERVICE_CATEGORY_CODES.map((code) => ({ code })) }),
    });
  });
}
