import { test as base, expect } from '@playwright/test';
import { installDemoUserMeMock, mockPlansCatalog } from './helpers/org-api-mock';
import { mockPropertiesApi } from './helpers/properties-api-mock';
import { mockCinComplianceApi } from './helpers/cin-mock';

async function installDefaultDemoApiMocks(page: import('@playwright/test').Page): Promise<void> {
  const emptyServiceRequests = { items: [], total: 0, page: 1, pageSize: 50 };
  const emptySuppliers = { items: [], totalCount: 0, page: 1, pageSize: 50 };
  const emptyList = { count: 0, items: [] };
  const emptyToday = { today: '2026-06-16', arrivals: emptyList, departures: emptyList, approvals: emptyList, todo: emptyList, services: emptyList };
  const emptyOverview = {
    period: { kind: 'Month', from: '2026-06-01', to: '2026-06-30', nights: 30 },
    today: '2026-06-16',
    propertyCount: 1,
    occupancy: { occupiedNights: 0, availableNights: 30, closedNights: 0, rate: 0, deltaPoints: null },
    revenue: { amount: 0, currency: 'EUR', stayCount: 0, deltaPercent: null },
    upcoming: { count: 0, previousCount: 0, pendingApproval: 0 },
    nextArrivals: [],
    series: { unit: 'week', buckets: [] },
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

  await page.route('**/api/dashboard/today**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyToday) });
  });

  await page.route('**/api/dashboard/overview**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyOverview) });
  });

  await page.route('**/api/dashboard/ical-feeds**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  // PL-15: an activated host. The activation checklist of the dashboard hides once every step is done, so the specs
  // that do not test it see the dashboard as before.
  await page.route('**/api/onboarding/status**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const keys = ['account', 'organization', 'property', 'cin', 'payments', 'sitePublished', 'firstBooking'];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        roleChosen: true,
        orgProvisioned: true,
        consentsAccepted: true,
        propertyCreated: true,
        sitePublished: true,
        firstBookingTaken: true,
        activated: true,
        publicBookingUrl: null,
        steps: keys.map((key) => ({ key, state: 'done', reason: null, done: null, total: null })),
      }),
    });
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

  await page.route('**/api/bookings**', async (route) => {
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

  // The list of bookings (SR-04) asks for a page and for the counters of its chips: none, unless a spec answers otherwise.
  await page.route('**/api/bookings/search**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], totalCount: 0, page: 1, pageSize: 20 }) });
  });

  await page.route('**/api/bookings/counts**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ all: 0, toConfirm: 0, upcoming: 0, inProgress: 0, completed: 0, cancelled: 0 }),
    });
  });

  // The history of a booking (SR-05c) is asked by the drawer and by the tab Cronologia of the booking page: none, unless a spec answers otherwise.
  await page.route('**/api/bookings/*/timeline', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ bookingId: '', events: [] }) });
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

  // The area of the long-term rents opens on its overview (LR-05): no lease at all, so it shows the guide of the first steps, and
  // an empty agenda, unless a spec answers otherwise.
  const noRents = { count: 0, amount: 0 };
  const emptyLongRentOverview = {
    today: '2026-06-16',
    leases: { active: 0, expiring: 0, inPreparation: 0, toSign: 0, toRegister: 0, ended: 0 },
    rentMonth: '2026-06',
    rents: { expected: noRents, collected: noRents, pending: noRents, overdue: noRents },
    checklist: [],
    nextDeadline: null,
    now: null,
  };
  await page.route('**/api/long-rent/overview**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyLongRentOverview) });
  });

  await page.route('**/api/long-rent/deadlines**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ from: '2026-06-16', to: '2026-09-14', items: [], truncated: false }),
    });
  });
}

async function mockLegalDocuments(page: import('@playwright/test').Page): Promise<void> {
  const legalDoc = {
    version: '1.0.0',
    effectiveAt: '2026-01-01T00:00:00Z',
    title: 'Test Document',
    summary: 'E2E test document.',
    // D3: the public footer only renders privacy/terms when the backend sends an http(s) documentUrl.
    documentUrl: 'https://example.com/legal/document',
  };

  await page.route(/\/api\/legal\/tos(\?.*)?$/, async (route) => {
    if (route.request().method() !== 'GET') { await route.fallback(); return; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(legalDoc) });
  });
  await page.route(/\/api\/legal\/privacy(\?.*)?$/, async (route) => {
    if (route.request().method() !== 'GET') { await route.fallback(); return; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(legalDoc) });
  });
  await page.route(/\/api\/legal\/dpa(\?.*)?$/, async (route) => {
    if (route.request().method() !== 'GET') { await route.fallback(); return; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(legalDoc) });
  });
  await page.route(/\/api\/legal\/subprocessors(\?.*)?$/, async (route) => {
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
        localStorage.setItem('casazen.locale', 'it');
      }
    });
    await installDemoUserMeMock(page);
    await mockPlansCatalog(page);
    await installDefaultDemoApiMocks(page);
    await mockLegalDocuments(page);
    await page.route('**/api/public/features', async (route) => {
      if (route.request().method() !== 'GET') { await route.fallback(); return; }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ otaPartnerApi: false }),
      });
    });
    await use(page);
  },
});

export { expect };
