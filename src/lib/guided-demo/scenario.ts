import { addDays, startOfMonth } from '@/lib/stay-dates';
import type { Booking, LeaseSummary, Property } from '@/types';
import type { DashboardToday } from '@/types/dashboard.types';

export type TourArea = 'short' | 'long';
export const SAMPLE_BOOKING_ID = 'cf000000-0000-4000-8000-000000000001';
export const SAMPLE_SHORT_ID = 'cf000000-0000-4000-8000-000000000002';
export const SAMPLE_LONG_ID = 'cf000000-0000-4000-8000-000000000003';
export const SAMPLE_LEASE_ID = 'cf000000-0000-4000-8000-000000000004';
const STAMP = '2026-01-01T10:00:00Z';

function sampleProperty(id: string, name: string, rentalMode: 'Short' | 'Long'): Property {
  return {
    id, name, rentalMode, city: 'Como', address: 'Via del Lungolago 12', postalCode: '22100',
    country: 'IT', currency: 'EUR', timezone: 'Europe/Rome', cancellationPolicyId: null,
    description: '', houseRules: '', bedrooms: 2, bathrooms: 1, maxGuests: 4,
    nightlyRate: 180, cleaningFee: 40, damageDeposit: 0, amenities: [], photoUrls: [], cinCode: null,
    isActive: true, isPaused: false, pausedAt: null, ownerId: 'demo', createdAt: STAMP, updatedAt: STAMP,
  };
}

export const sampleVilla = sampleProperty(SAMPLE_SHORT_ID, 'Villa del Lago', 'Short');
export const sampleFlat = sampleProperty(SAMPLE_LONG_ID, 'Casa dei Tigli', 'Long');

export function sampleBooking(day: string): Booking {
  return {
    id: SAMPLE_BOOKING_ID, bookingCode: 'DEMOT-00001', userId: 'demo', status: 'Confirmed', source: 'Manual',
    propertyId: sampleVilla.id, propertyName: sampleVilla.name, numberOfGuests: 2, checkInDate: day,
    checkOutDate: addDays(day, 2), currency: 'EUR', totalPrice: 400, createdAt: STAMP, updatedAt: STAMP,
    guest: { firstName: 'Piet', lastName: 'Jansen', email: 'piet@example.test', country: 'NL', phone: '' },
  };
}

export function sampleDay(day: string): DashboardToday {
  const stay = sampleBooking(day);
  const empty = { count: 0, items: [] };
  return {
    today: day, departures: empty, approvals: empty, services: empty,
    todo: { count: 1, items: [{
      action: 'CompleteGuestCheckIn', priority: 1, dueAt: null, label: `${stay.guest.firstName} ${stay.guest.lastName}`,
      propertyId: stay.propertyId, propertyName: sampleVilla.name, bookingId: stay.id, serviceRequestId: null, missing: [],
    }] },
    arrivals: { count: 1, items: [{
      bookingId: stay.id, guestName: `${stay.guest.firstName} ${stay.guest.lastName}`,
      propertyId: stay.propertyId, propertyName: sampleVilla.name, numberOfGuests: stay.numberOfGuests,
      checkInDate: day, checkOutDate: stay.checkOutDate, status: stay.status,
      checkIn: { state: 'InProgress', dataComplete: false }, cleaning: null,
    }] },
  };
}

export function sampleLease(day: string): LeaseSummary {
  const start = startOfMonth(day);
  return {
    id: SAMPLE_LEASE_ID, propertyId: sampleFlat.id, property: sampleFlat, stage: 'Active', status: 'Registered',
    fiscalRegime: 'CedolareSecca', contractType: 'Libero', taxRegime: 'CedolareSecca',
    startDate: start, endDate: addDays(`${Number(start.slice(0, 4)) + 4}${start.slice(4)}`, -1),
    monthlyRent: 850, stipulaDate: start, registrationDeadline: null,
    partyCount: 2, hasExtraEUTenant: false, createdAt: STAMP, updatedAt: STAMP,
    tenantFirstName: 'Ada', tenantLastName: 'Riva', overdueRentCount: 0, overdueRentAmount: 0,
  };
}
