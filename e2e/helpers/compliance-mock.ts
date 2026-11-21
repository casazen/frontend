import type { Page } from '@playwright/test';
import type {
  ComplianceActivationResult,
  ComplianceSummaryResult,
  CheckoutWizardState,
  SafetyChecklist,
  SafetyItemCode,
} from '../../src/types/compliance.types';
import type { DeclareTicinoDayRequest, TicinoDeclaration, TicinoNotificationDay } from '../../src/types/swissCompliance.types';

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

const SAFETY_ITEM_CODES: SafetyItemCode[] = [
  'FireExtinguishers',
  'GasDetector',
  'CoDetector',
  'SystemsCompliance',
  'BdsrDeclaration',
  'SmokeDetector',
  'EmergencyInstructions',
];

/** Safety checklist (CO-07) of a property that has not answered it yet: every item "not answered", facts unknown. */
const demoSafetyChecklistUnanswered: SafetyChecklist = {
  schemaVersion: 1,
  legalBasis: 'D.L. 145/2023 art. 13-ter',
  declarationTextVersion: 'e2e',
  saved: false,
  importedFromLegacy: false,
  facts: {
    entrepreneurial: null,
    hasGasSupply: null,
    combustionAppliances: null,
    floorCount: null,
    floorAreasSqm: null,
  },
  items: SAFETY_ITEM_CODES.map((code) => ({
    code,
    requirement: code === 'SmokeDetector' || code === 'EmergencyInstructions' ? 'Optional' : 'Undetermined',
    status: 'NotAnswered',
    notApplicableReason: null,
    answer: null,
    quantity: null,
    location: null,
    detectorType: null,
    checkedOn: null,
    expiresOn: null,
    evidenceDocumentId: null,
    evidenceFileName: null,
    notes: null,
  })),
  minimumExtinguishers: null,
  isComplete: false,
  blockers: [],
  warnings: [],
  confirmedAt: null,
  confirmedTextVersion: null,
  updatedAt: null,
};

/**
 * The compliance reads of any property (not only the demo one): a safety sheet not answered yet and an activation with its blockers
 * open. The wizard "Aggiungi immobile" reads both for the property it has just created, whatever its id.
 */
export async function mockCompliancePendingForAnyProperty(page: Page): Promise<void> {
  await page.route('**/api/properties/*/compliance/safety-checklist', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(demoSafetyChecklistUnanswered) });
  });

  await page.route('**/api/properties/*/compliance/activation', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(demoActivationPending) });
  });
}

export async function mockComplianceApi(page: Page): Promise<void> {
  await page.route(`**/api/properties/${DEMO_PROPERTY_ID}/compliance/safety-checklist`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(demoSafetyChecklistUnanswered),
    });
  });

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

/** A Ticino property of the host with one arrival day still to notify to the cantonal police (E30/F02/US03, casazen/backend#979). */
export const DEMO_TICINO_PROPERTY_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
export const DEMO_TICINO_BOOKING_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const DEMO_TICINO_DAY = '2026-11-19';
export const DEMO_TICINO_DUE_AT = '2026-11-20T14:00:00Z';

/**
 * The arrival day as `GET /api/properties/{id}/swiss/ticino-notification` sends it, typed with the app's types so that a change of the contract breaks this
 * mock too: one guest with everything the file needs, nothing declared and no file written yet.
 */
export function demoTicinoDay(overrides: Partial<TicinoNotificationDay> = {}): TicinoNotificationDay {
  return {
    propertyId: DEMO_TICINO_PROPERTY_ID,
    day: DEMO_TICINO_DAY,
    structureId: 'NL-12345678',
    stayCount: 1,
    rows: [{ bookingId: DEMO_TICINO_BOOKING_ID, guestName: 'Mario Rossi', personsOver14: 0, personsUnder14: 0, kind: 'guest', groupSize: 0 }],
    issues: [],
    xmlAvailable: true,
    receiptCount: 0,
    dueAt: DEMO_TICINO_DUE_AT,
    reference: `TI-${DEMO_TICINO_PROPERTY_ID.replaceAll('-', '')}-20261119`,
    portalUrl: 'https://www.notifiche.ti.ch',
    pendingDays: [{ day: DEMO_TICINO_DAY, stayCount: 1, dueAt: DEMO_TICINO_DUE_AT }],
    warnings: [],
    csvCharset: 'windows-1252',
    transliteratedCount: 0,
    declaredAt: null,
    declaredBy: null,
    fileGeneratedAt: null,
    fileGeneratedCount: 0,
    alreadyDeclared: false,
    ...overrides,
  };
}

/** The cockpit of the host with that arrival day listed as a thing to do (`NotifyTicinoPolice`, the day in `period`); empty once the day is declared. */
export function demoTicinoSummary(declared: boolean): ComplianceSummaryResult {
  const empty = { count: 0, items: [] };
  return {
    propertiesPending: empty,
    guestCheckInsIncomplete: empty,
    checkoutsDue: empty,
    alloggiatiFailures: empty,
    alloggiatiManualRequired: empty,
    turnoversPending: empty,
    ticinoNotifications: declared
      ? empty
      : {
          count: 1,
          items: [
            {
              id: DEMO_TICINO_PROPERTY_ID,
              label: 'Casa Lugano',
              action: 'NotifyTicinoPolice',
              propertyId: DEMO_TICINO_PROPERTY_ID,
              bookingId: null,
              period: DEMO_TICINO_DAY,
              dueAt: DEMO_TICINO_DUE_AT,
            },
          ],
        },
  };
}

/** What the mock of the Ticino notification has seen: the declarations the host made, and how many files it was asked for. */
interface TicinoNotificationServer {
  declarations: DeclareTicinoDayRequest[];
  files: number;
}

/**
 * The API of the guided notification to the Ticino police for the property of `DEMO_TICINO_PROPERTY_ID`, with the state a server keeps: the day to notify, its file, the
 * declaration (POST and DELETE of `…/ticino-notification/declare`) and the summary of the cockpit, which lists the day until it is declared and not after. Answers over the
 * defaults of the fixture (the last route registered wins), so a spec calls it after `test` has set them up.
 */
export async function mockTicinoNotificationApi(page: Page): Promise<TicinoNotificationServer> {
  const server: TicinoNotificationServer = { declarations: [], files: 0 };
  let declaration: TicinoDeclaration | null = null;
  const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

  await page.route('**/api/compliance/summary**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill(json(demoTicinoSummary(declaration !== null)));
  });

  // The day (`?date=` in its address), and the file of the day. The declaration below is registered after it, so it answers its own address.
  await page.route(`**/api/properties/${DEMO_TICINO_PROPERTY_ID}/swiss/ticino-notification**`, async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill(
        json(
          demoTicinoDay(
            declaration
              ? { declaredAt: declaration.declaredAt, declaredBy: declaration.declaredBy, alreadyDeclared: true, fileGeneratedCount: server.files, fileGeneratedAt: declaration.declaredAt }
              : { fileGeneratedCount: server.files, fileGeneratedAt: server.files > 0 ? '2026-11-19T20:00:00Z' : null },
          ),
        ),
      );
      return;
    }
    if (method === 'POST') {
      server.files += 1;
      await route.fulfill({
        status: 200,
        contentType: 'text/csv; charset=windows-1252',
        headers: { 'Content-Disposition': 'attachment; filename="notifiche-ti-2026-11-19.csv"' },
        body: 'Id Struttura;Cognome;Nome\r\nNL-12345678;Rossi;Mario\r\n',
      });
      return;
    }
    await route.fallback();
  });

  // The declaration of the day (idempotent) and its undo.
  await page.route(`**/api/properties/${DEMO_TICINO_PROPERTY_ID}/swiss/ticino-notification/declare**`, async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      const request = route.request().postDataJSON() as DeclareTicinoDayRequest;
      server.declarations.push(request);
      const created = declaration === null;
      declaration ??= {
        propertyId: DEMO_TICINO_PROPERTY_ID,
        arrivalDay: request.arrivalDay,
        declaredAt: '2026-11-19T20:30:00Z',
        declaredBy: 'Luca Bianchi',
        receiptId: request.receiptId ?? null,
        created,
      };
      await route.fulfill(json({ ...declaration, created }));
      return;
    }
    if (method === 'DELETE') {
      declaration = null;
      await route.fulfill({ status: 204 });
      return;
    }
    await route.fallback();
  });

  return server;
}
