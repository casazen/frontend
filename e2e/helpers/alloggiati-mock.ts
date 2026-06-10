import type { Page } from '@playwright/test';
import type { AlloggiatiStatusDto, AlloggiatiSummaryDto, CheckInContextDto } from '../../src/types/alloggiati.types';

export const DEMO_CHECKIN_TOKEN = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const DEMO_BOOKING_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

export const demoCheckInContext: CheckInContextDto = {
  bookingId: DEMO_BOOKING_ID,
  guestId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  propertyName: 'Appartamento Centro',
  checkInDate: '2026-07-01T14:00:00Z',
  checkOutDate: '2026-07-04T10:00:00Z',
  guest: {
    firstName: 'Mario',
    lastName: 'Rossi',
    email: 'mario.rossi@example.com',
    placeOfBirth: '',
    nationality: '',
    documentNumber: '',
    documentIssuingCountry: '',
    address: '',
    city: '',
    postalCode: '',
    country: '',
  },
  dataComplete: false,
};

export const demoAlloggiatiSummary: AlloggiatiSummaryDto[] = [
  {
    bookingId: DEMO_BOOKING_ID,
    guestName: 'Mario Rossi',
    propertyName: 'Appartamento Centro',
    checkInDate: '2026-07-01T14:00:00Z',
    status: 'Pending',
    dataComplete: true,
    isOverdue: false,
    hoursUntilDeadline: 18,
  },
  {
    bookingId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    guestName: 'Luigi Verdi',
    propertyName: 'Monolocale Mare',
    checkInDate: '2026-06-08T14:00:00Z',
    status: 'Failed',
    dataComplete: true,
    isOverdue: true,
    hoursUntilDeadline: -2,
  },
];

export function demoAlloggiatiStatus(overrides: Partial<AlloggiatiStatusDto> = {}): AlloggiatiStatusDto {
  return {
    bookingId: DEMO_BOOKING_ID,
    status: 'Pending',
    confirmationNumber: null,
    errorMessage: null,
    reportedAt: null,
    hoursUntilDeadline: 18,
    isOverdue: false,
    dataComplete: true,
    ...overrides,
  };
}

export async function mockCheckInApi(page: Page): Promise<void> {
  await page.route(`**/api/checkin/${DEMO_CHECKIN_TOKEN}`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(demoCheckInContext),
    });
  });

  await page.route(`**/api/checkin/${DEMO_CHECKIN_TOKEN}/guest-data`, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ dataComplete: true }),
    });
  });

  await page.route(`**/api/checkin/${DEMO_CHECKIN_TOKEN}/document`, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ documentScanUrl: '/uploads/demo-scan.pdf' }),
    });
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
      body: JSON.stringify(demoAlloggiatiStatus({ status: 'Failed', errorMessage: 'Errore simulato' })),
    });
  });

  await page.route(`**/api/alloggiati/${DEMO_BOOKING_ID}/send`, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(demoAlloggiatiStatus({ status: 'Submitted', errorMessage: null })),
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
