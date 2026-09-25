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
      cinCode: 'IT058091C27G5FFZDZ',
      cinStatus: 'valid',
      city: 'Napoli',
    },
  ],
  totalCount: 2,
  summary: {
    valid: 1,
    missing: 1,
    invalid: 0,
    // CO-20: no deadline configured by default (Cin:ExposureDeadline): the banner shows the obligation without a date.
    daysUntilDeadline: null,
    deadline: null,
    deadlineStatus: 'none',
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
