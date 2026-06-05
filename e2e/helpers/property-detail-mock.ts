import type { Page } from '@playwright/test';
import { PROPERTY_DETAIL_ID, propertyDetailFixture } from '../fixtures/property-detail.fixtures';

export async function mockPropertyDetailApi(page: Page): Promise<void> {
  await page.route(`**/api/properties/${PROPERTY_DETAIL_ID}/detail`, (route) => {
    if (route.request().method() !== 'GET') {
      route.fallback();
      return;
    }
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(propertyDetailFixture),
    });
  });

  await page.route(`**/api/properties/${PROPERTY_DETAIL_ID}/documents`, (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(propertyDetailFixture.documents),
      });
    } else if (method === 'POST') {
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'doc-e2e-new',
          fileName: 'uploaded.pdf',
          fileType: 'pdf',
          uploadedAt: new Date().toISOString(),
          downloadUrl: '/uploads/properties/uploaded.pdf',
        }),
      });
    } else {
      route.fallback();
    }
  });

  await page.route(`**/api/properties/${PROPERTY_DETAIL_ID}/documents/*`, (route) => {
    if (route.request().method() === 'DELETE') {
      route.fulfill({ status: 204 });
    } else {
      route.fallback();
    }
  });
}

export { PROPERTY_DETAIL_ID };
