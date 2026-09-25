import { test as base, expect } from '@playwright/test';
import { installDemoUserMeMock, mockPlansCatalog } from './helpers/org-api-mock';
import { mockPropertiesApi } from './helpers/properties-api-mock';
import { mockCinComplianceApi } from './helpers/cin-mock';

async function installDefaultDemoApiMocks(page: import('@playwright/test').Page): Promise<void> {
  const emptyServiceRequests = { items: [], total: 0, page: 1, pageSize: 50 };
  const emptySuppliers = { items: [], totalCount: 0, page: 1, pageSize: 50 };
  const emptyDashboard = {
    period: { kind: 'Month', from: '2026-06-01', to: '2026-06-30', nights: 30 },
    today: '2026-06-16',
    propertyCount: 0,
    occupancy: { occupiedNights: 0, availableNights: 0, closedNights: 0, rate: null },
    revenue: { amount: 0, currency: 'EUR', stayCount: 0 },
    arrivalsToday: { count: 0, items: [] },
    departuresToday: { count: 0, items: [] },
    upcomingCheckIns: { count: 0, items: [] },
    recentBookings: [],
  };
  const emptyComplianceSummary = {
    propertiesPending: { count: 0, items: [] },
    guestCheckInsIncomplete: { count: 0, items: [] },
    checkoutsDue: { count: 0, items: [] },
    alloggiatiFailures: { count: 0, items: [] },
    alloggiatiManualRequired: { count: 0, items: [] },
    turnoversPending: { count: 0, items: [] },
  };

  await mockPropertiesApi(page, []);
  await mockCinComplianceApi(page, {
    items: [],
    totalCount: 0,
    summary: {
      valid: 0,
      missing: 0,
      invalid: 0,
      daysUntilDeadline: null,
      deadline: null,
      deadlineStatus: 'none',
      hasNonCompliant: false,
    },
  });

  await page.route('**/api/dashboard/kpis**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyDashboard) });
  });

  await page.route('**/api/dashboard/ical-feeds**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/api/compliance/summary**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyComplianceSummary) });
  });

  await page.route('**/api/bookings/approval-requests**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/api/bookings', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const path = new URL(route.request().url()).pathname.replace(/\/$/, '');
    if (!path.endsWith('/api/bookings') && !path.endsWith('/bookings')) {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/api/payments**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const path = new URL(route.request().url()).pathname.replace(/\/$/, '');
    if (!path.endsWith('/api/payments') && !path.endsWith('/payments')) {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/api/ota/integrations**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/api/service-requests**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const path = new URL(route.request().url()).pathname.replace(/\/$/, '');
    if (!path.endsWith('/api/service-requests') && !path.endsWith('/service-requests')) {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyServiceRequests) });
  });

  await page.route('**/api/long-rent/service-requests**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const path = new URL(route.request().url()).pathname.replace(/\/$/, '');
    if (!path.endsWith('/api/long-rent/service-requests') && !path.endsWith('/long-rent/service-requests')) {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyServiceRequests) });
  });

  await page.route('**/api/suppliers**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptySuppliers) });
  });

  await page.route('**/api/long-rent/service-requests/suppliers**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptySuppliers) });
  });
}

async function mockLegalDocuments(page: import('@playwright/test').Page): Promise<void> {
  const legalDoc = {
    version: '1.0.0',
    effectiveAt: '2026-01-01T00:00:00Z',
    title: 'Test Document',
    summary: 'E2E test document.',
  };

  await page.route('**/api/legal/tos', async (route) => {
    if (route.request().method() !== 'GET') { await route.fallback(); return; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(legalDoc) });
  });
  await page.route('**/api/legal/privacy', async (route) => {
    if (route.request().method() !== 'GET') { await route.fallback(); return; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(legalDoc) });
  });
  await page.route('**/api/legal/dpa', async (route) => {
    if (route.request().method() !== 'GET') { await route.fallback(); return; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(legalDoc) });
  });
  await page.route('**/api/legal/subprocessors', async (route) => {
    if (route.request().method() !== 'GET') { await route.fallback(); return; }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version: '1.0.0',
        effectiveAt: '2026-01-01T00:00:00Z',
        items: [{ name: 'Test Processor', purpose: 'Testing', region: 'EU' }],
      }),
    });
  });
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      if (!localStorage.getItem('casazen.locale')) {
        localStorage.setItem('casazen.locale', 'en');
      }
    });
    await installDemoUserMeMock(page);
    await mockPlansCatalog(page);
    await installDefaultDemoApiMocks(page);
    await mockLegalDocuments(page);
    await use(page);
  },
});

export { expect };
