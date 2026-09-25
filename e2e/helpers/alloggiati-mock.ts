import type { Page } from '@playwright/test';
import type {
  AlloggiatiGuestSummaryDto,
  AlloggiatiStatusDto,
  AlloggiatiSummaryDto,
} from '../../src/types/alloggiati.types';
import type { PublicCheckInContextDto } from '../../src/types/public-checkin.types';

export const DEMO_CHECKIN_TOKEN = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const DEMO_BOOKING_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

export const demoPublicCheckInContext: PublicCheckInContextDto = {
  completed: false,
  status: 'Inviato',
  sessionId: '11111111-1111-1111-1111-111111111111',
  propertyName: 'Appartamento Centro',
  checkInDate: '2026-07-01T14:00:00Z',
  checkOutDate: '2026-07-04T10:00:00Z',
  declaredGuests: 1,
  privacyNoticeVersion: '1.0',
  guests: [
    {
      type: 'SingleGuest',
      firstName: 'Mario',
      lastName: 'Rossi',
      gender: 'Male',
      dateOfBirth: '1990-05-15',
      bornInItaly: true,
      birthComuneName: 'Roma',
      birthProvince: 'RM',
      birthCountryName: 'Italia',
      citizenshipName: 'Italiana',
      documentType: 'IdentityCard',
      documentIssuePlaceName: 'Roma',
    },
  ],
};

export const demoAlloggiatiSummary: AlloggiatiSummaryDto[] = [
  {
    bookingId: DEMO_BOOKING_ID,
    guestName: 'Mario Rossi',
    propertyName: 'Appartamento Centro',
    checkInDate: '2026-07-01T00:00:00Z',
    status: 'DaInviareManualmente',
    dataComplete: true,
    isOverdue: false,
    hoursUntilDeadline: 18,
    deadlineAt: '2026-07-01T22:00:00Z',
    isShortStay: false,
  },
  {
    bookingId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    guestName: 'Luigi Verdi',
    propertyName: 'Monolocale Mare',
    checkInDate: '2026-06-08T00:00:00Z',
    status: 'DaInviareManualmente',
    dataComplete: true,
    isOverdue: true,
    hoursUntilDeadline: 0,
    deadlineAt: '2026-06-08T22:00:00Z',
    isShortStay: false,
  },
];

export function demoAlloggiatiStatus(overrides: Partial<AlloggiatiStatusDto> = {}): AlloggiatiStatusDto {
  return {
    bookingId: DEMO_BOOKING_ID,
    status: 'DaInviareManualmente',
    confirmationNumber: null,
    errorCode: null,
    reportedAt: null,
    deadlineAt: '2026-07-01T22:00:00Z',
    isShortStay: false,
    hoursUntilDeadline: 18,
    isOverdue: false,
    dataComplete: true,
    ...overrides,
  };
}

export const demoAlloggiatiGuestSummary: AlloggiatiGuestSummaryDto = {
  bookingId: DEMO_BOOKING_ID,
  status: 'DaInviareManualmente',
  arrivalDate: '2026-07-01T00:00:00Z',
  stayDays: 3,
  stayExceedsMaxDays: false,
  declaredGuests: 2,
  guests: [
    {
      guestId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      kind: 'HeadOfFamilyOrGroup',
      arrivalDate: '2026-07-01T00:00:00Z',
      stayDays: 3,
      lastName: 'Rossi',
      firstName: 'Mario',
      gender: 'Male',
      dateOfBirth: '1985-03-10T00:00:00Z',
      placeOfBirth: 'Milano',
      citizenship: 'Italiana',
      documentType: 'IdentityCard',
      documentNumber: 'CA12345AB',
      documentIssuePlace: 'Comune di Milano',
      missingFields: [],
    },
  ],
};

export async function mockCheckInApi(page: Page): Promise<void> {
  await page.route(`**/api/public/checkin/${DEMO_CHECKIN_TOKEN}`, async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(demoPublicCheckInContext),
      });
      return;
    }
    if (method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessionId: demoPublicCheckInContext.sessionId,
          message: 'ok',
        }),
      });
      return;
    }
    await route.fallback();
  });
}

export async function mockAlloggiatiApi(page: Page): Promise<void> {
  await page.route('**/api/alloggiati/summary**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(demoAlloggiatiSummary),
    });
  });

  await page.route(`**/api/alloggiati/${DEMO_BOOKING_ID}/status`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(demoAlloggiatiStatus()),
    });
  });

  await page.route(`**/api/alloggiati/${DEMO_BOOKING_ID}/guest-summary`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(demoAlloggiatiGuestSummary),
    });
  });

  // Same contract as the backend (CO-11): the host declares the manual submission, never "Inviato".
  await page.route(`**/api/alloggiati/${DEMO_BOOKING_ID}/mark-sent-manually`, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    const { sentOn } = route.request().postDataJSON() as { sentOn: string };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        demoAlloggiatiStatus({ status: 'InviatoManualmente', reportedAt: `${sentOn}T00:00:00Z` }),
      ),
    });
  });
}

export async function mockBookingDetailApi(page: Page): Promise<void> {
  await page.route(`**/api/bookings/${DEMO_BOOKING_ID}`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: DEMO_BOOKING_ID,
        propertyId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        status: 'Confirmed',
        checkInDate: '2026-07-01T14:00:00Z',
        checkOutDate: '2026-07-04T10:00:00Z',
        numberOfGuests: 2,
        totalPrice: 450,
        currency: 'EUR',
        specialRequests: null,
        createdAt: '2026-06-01T10:00:00Z',
        updatedAt: '2026-06-01T10:00:00Z',
        guest: {
          firstName: 'Mario',
          lastName: 'Rossi',
          email: 'mario.rossi@example.com',
          phone: '+39 333 1234567',
          country: 'IT',
        },
      }),
    });
  });
}
