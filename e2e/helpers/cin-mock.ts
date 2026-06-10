import type { Page } from '@playwright/test';
import type { CinComplianceResponse } from '../../src/types/cin.types';

export const DEMO_PROPERTY_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

export const demoCinCompliance: CinComplianceResponse = {
  items: [
    {
      propertyId: DEMO_PROPERTY_ID,
      propertyName: 'Appartamento Centro',
      cinCode: null,
      cinStatus: 'missing',
      city: 'Roma',
    },
    {
      propertyId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      propertyName: 'Monolocale Mare',
      cinCode: 'IT-12345-0123456789',
      cinStatus: 'valid',
      city: 'Napoli',
    },
  ],
  totalCount: 2,
  summary: {
    valid: 1,
    missing: 1,
    invalid: 0,
    daysUntilDeadline: 0,
    deadline: '2026-03-01',
    hasNonCompliant: true,
  },
};

export async function mockCinComplianceApi(page: Page, data: CinComplianceResponse = demoCinCompliance): Promise<void> {
  await page.route('**/api/properties/cin-compliance**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });
  });
}
