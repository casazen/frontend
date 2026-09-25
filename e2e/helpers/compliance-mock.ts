import type { Page } from '@playwright/test';
import type {
  ComplianceActivationResult,
  ComplianceSummaryResult,
  CheckoutWizardState,
} from '../../src/types/compliance.types';

export const DEMO_PROPERTY_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
export const DEMO_CHECKOUT_BOOKING_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

export const demoActivationPending: ComplianceActivationResult = {
  complianceStatus: 'Pending',
  steps: [
    { id: 'base-data', label: 'Dati base proprietà', status: 'complete', blocker: true },
    { id: 'cin', label: 'Codice CIN', status: 'pending', blocker: true, message: 'Codice CIN mancante.' },
    { id: 'documents', label: 'Documenti obbligatori', status: 'pending', blocker: true },
    { id: 'safety', label: 'Checklist sicurezza', status: 'pending', blocker: true },
    { id: 'tourist-tax', label: 'Imposta di soggiorno', status: 'pending', blocker: true },
    { id: 'ical', label: 'Sincronizzazione calendario', status: 'warning', blocker: false },
  ],
};

/**
 * The cockpit with the contract of `GET /api/compliance/summary` (CO-04, A5-09): action by name and id of the target,
 * never a path; labels as the API builds them (property name, guest name). Typed with the app's types, so a change
 * of the contract breaks this mock too.
 */
export const demoComplianceSummary: ComplianceSummaryResult = {
  propertiesPending: {
    count: 1,
    items: [
      {
        id: DEMO_PROPERTY_ID,
        label: 'Appartamento Centro',
        action: 'ActivateProperty',
        propertyId: DEMO_PROPERTY_ID,
        bookingId: null,
      },
    ],
  },
  guestCheckInsIncomplete: {
    count: 1,
    items: [
      {
        id: DEMO_CHECKOUT_BOOKING_ID,
        label: 'Mario Rossi',
        action: 'CompleteGuestCheckIn',
        propertyId: null,
        bookingId: DEMO_CHECKOUT_BOOKING_ID,
      },
    ],
  },
  checkoutsDue: {
    count: 1,
    items: [
      {
        id: DEMO_CHECKOUT_BOOKING_ID,
        label: 'Mario Rossi',
        action: 'CheckOut',
        propertyId: null,
        bookingId: DEMO_CHECKOUT_BOOKING_ID,
      },
    ],
  },
  alloggiatiFailures: {
    count: 0,
    items: [],
  },
  alloggiatiManualRequired: {
    count: 1,
    items: [
      {
        id: DEMO_CHECKOUT_BOOKING_ID,
        label: 'Mario Rossi',
        action: 'SendAlloggiati',
        propertyId: null,
        bookingId: DEMO_CHECKOUT_BOOKING_ID,
      },
    ],
  },
  turnoversPending: {
    count: 0,
    items: [],
  },
};

/** `checkout-wizard/start` as the API answers it (CO-17): 5 steps, nothing answered yet. */
export const demoCheckoutWizard: CheckoutWizardState = {
  bookingId: DEMO_CHECKOUT_BOOKING_ID,
  bookingStatus: 'CheckedIn',
  currentStep: 'stay-summary',
  startedAt: '2026-09-25T08:00:00Z',
  completedAt: null,
  steps: [
    { id: 'stay-summary', label: 'Riepilogo soggiorno', status: 'pending', blocker: true },
    { id: 'alloggiati', label: 'Alloggiati Web', status: 'warning', blocker: false },
    { id: 'cleaning', label: 'Pulizie', status: 'pending', blocker: false },
    { id: 'tourist-tax', label: 'Imposta di soggiorno', status: 'pending', blocker: false },
    { id: 'property-ready', label: 'Proprietà pronta', status: 'pending', blocker: false },
  ],
  stay: {
    guestName: 'Mario Rossi',
    propertyId: DEMO_PROPERTY_ID,
    propertyName: 'Appartamento Centro',
    propertyCity: 'Roma',
    checkInDate: '2026-09-22T00:00:00Z',
    checkOutDate: '2026-09-25T00:00:00Z',
    nights: 3,
    numberOfGuests: 2,
    numberOfAdults: 2,
    numberOfChildren: 0,
    arrivedAt: null,
    source: 'Direct',
    departureConfirmed: false,
  },
  alloggiati: {
    status: 'DaInviareManualmente',
    sent: false,
    deadlineAt: '2026-09-23T22:00:00Z',
    isOverdue: true,
    dataComplete: true,
  },
  cleaning: { choice: null, supplierOrgId: null, category: null, notes: null, requestId: null },
  touristTax: { recordedAmount: 18, currency: 'EUR', collectedWithOnlinePayment: true, collection: null },
  propertyReady: { ready: null, readyAt: null, notes: null },
};

export async function mockComplianceApi(page: Page): Promise<void> {
  await page.route(`**/api/properties/${DEMO_PROPERTY_ID}/compliance/activation`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(demoActivationPending),
    });
  });

  await page.route(`**/api/properties/${DEMO_PROPERTY_ID}/compliance/activation/complete`, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ complianceStatus: 'Pending', incompleteBlockers: ['cin'] }),
    });
  });

  await page.route('**/api/compliance/summary**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(demoComplianceSummary),
    });
  });

  await page.route(`**/api/bookings/${DEMO_CHECKOUT_BOOKING_ID}/checkout-wizard/start`, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(demoCheckoutWizard),
    });
  });
}
