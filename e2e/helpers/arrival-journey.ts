import type { Page } from '@playwright/test';
import { mockPropertiesApi } from './properties-api-mock';
import { buildCreatedProperty, buildPropertyDetailFromProperty } from '../fixtures/properties.fixtures';
import type { DashboardToday } from '../../src/types/dashboard.types';
import { demoAlloggiatiStatus, demoAlloggiatiGuestSummary } from './alloggiati-mock';
import { addDays, todayInRome } from '../../src/lib/stay-dates';
import type { Booking } from '../../src/types';

export const bookingId = 'cf000000-0000-4000-8000-000000000001';
export const guestName = 'Piet Jansen';
export const property = buildCreatedProperty({
  id: 'cf000000-0000-4000-8000-000000000002',
  name: 'Casa del porto',
});

export async function mockArrivalJourney(page: Page) {
  const today = todayInRome();
  const checkout = addDays(today, 3);
  await mockPropertiesApi(page, [property]);
  const empty = { count: 0, items: [] };
  const snapshot: DashboardToday = {
    today,
    arrivals: {
      count: 1,
      items: [{
        bookingId, propertyId: property.id, propertyName: property.name, guestName,
        numberOfGuests: 2, checkInDate: today, checkOutDate: checkout, status: 'Confirmed',
        checkIn: { state: 'InProgress', dataComplete: false }, cleaning: null,
      }],
    },
    approvals: empty, todo: empty, departures: empty, services: empty,
  };
  const booking: Booking = {
    id: bookingId, propertyId: property.id, propertyName: property.name, userId: 'demo-host',
    checkInDate: today, checkOutDate: checkout, numberOfGuests: 2,
    numberOfAdults: 2, numberOfChildren: 0, basePrice: 180, touristTax: 0, cleaningFee: 0,
    totalPrice: 180, currency: 'EUR', status: 'Confirmed', source: 'Manual',
    guest: { firstName: 'Piet', lastName: 'Jansen', email: 'guest@example.test', phone: '', country: 'NL' },
    createdAt: today, updatedAt: today,
  };
  await page.route('**/api/dashboard/today**', (route) => route.fulfill({ json: snapshot }));
  await page.route(`**/api/bookings/${bookingId}`, (route) => route.fulfill({ json: booking }));
  await page.route(`**/api/properties/${property.id}`, (route) => route.fulfill({ json: buildPropertyDetailFromProperty(property) }));
  await page.route(`**/api/bookings/${bookingId}/checkin-session`, (route) =>
    route.fulfill({ json: { status: 'InCompilazione', canIssueLink: false } }));
  await page.route(`**/api/alloggiati/${bookingId}/status`, (route) =>
    route.fulfill({ json: demoAlloggiatiStatus({ bookingId, dataComplete: false, deadlineAt: `${addDays(today, 1)}T09:00:00Z` }) }));
  await page.route(`**/api/alloggiati/${bookingId}/guest-summary`, (route) =>
    route.fulfill({ json: { ...demoAlloggiatiGuestSummary, bookingId, arrivalDate: today, dataComplete: false, exportReady: false, guests: [] } }));
}
