import { AxiosError, type AxiosAdapter } from 'axios';
import { getDemoProfileKey, type ExtendedDemoProfile } from '@/config/demo.config';
import { buildDemoProfile } from '@/lib/demo-profile';
import { addDays, endOfMonth, nightsBetween, startOfMonth, todayInRome } from '@/lib/stay-dates';
import type { AlloggiatiGuestSummaryDto } from '@/types/alloggiati.types';
import type { CheckInSessionStatusDto } from '@/types/public-checkin.types';
import type { LeaseDetail, LongRentPropertyAggregate } from '@/types';
import type { DashboardOverview } from '@/types/dashboard.types';
import { sampleBooking, sampleDay, sampleFlat, sampleLease, sampleVilla } from './scenario';

function shortReads(path: string, day: string, params: Record<string, string>): unknown {
  const booking = sampleBooking(day);
  const empty = { count: 0, items: [] };
  switch (path) {
    case '/dashboard/today': return sampleDay(day);
    case '/dashboard/overview': {
      const from = params.from || (params.period === 'Last30Days' ? addDays(day, -29) : startOfMonth(day));
      const to = params.to || (params.period === 'Last30Days' ? day : endOfMonth(day));
      const nights = nightsBetween(from, to) + 1;
      const occupiedNights = Math.max(0, nightsBetween(from > day ? from : day, to < booking.checkOutDate ? addDays(to, 1) : booking.checkOutDate));
      return {
        period: { kind: params.period || 'Month', from, to, nights }, today: day, propertyCount: 1,
        occupancy: { availableNights: nights, occupiedNights, closedNights: 0, rate: occupiedNights / nights },
        upcoming: { count: 0, previousCount: 0, pendingApproval: 0 }, nextArrivals: [],
      } satisfies DashboardOverview;
    }
    case '/properties': return [sampleVilla];
    case `/properties/${sampleVilla.id}`: return sampleVilla;
    case '/bookings': return [booking];
    case `/bookings/${booking.id}`: return booking;
    case `/bookings/${booking.id}/checkin-session`: return {
      sessionId: 'cf000000-0000-4000-8000-000000000005', status: 'InCompilazione',
      sentAt: day + 'T07:00:00Z', expiresAt: booking.checkOutDate + 'T08:00:00Z',
      emailStatus: 'Sent', canIssueLink: false,
    } satisfies CheckInSessionStatusDto;
    case `/alloggiati/${booking.id}/status`: return {
      bookingId: booking.id, status: 'DaInviare', dataComplete: false,
      deadlineAt: addDays(day, 1) + 'T14:00:00Z', isOverdue: false, isShortStay: false,
    };
    case `/alloggiati/${booking.id}/guest-summary`: return {
      bookingId: booking.id, status: 'DaInviare', arrivalDate: day, stayDays: 2, stayExceedsMaxDays: false,
      declaredGuests: booking.numberOfGuests, dataComplete: false, exportReady: false, missingCodeTables: [], guests: [],
    } satisfies AlloggiatiGuestSummaryDto;
    case '/compliance/summary': return {
      propertiesPending: empty, guestCheckInsIncomplete: empty, checkoutsDue: empty,
      alloggiatiFailures: empty, alloggiatiManualRequired: empty, turnoversPending: empty,
    };
    case '/dashboard/ical-feeds':
    case '/me/activities': return [];
    case '/messages': return { items: [], totalCount: 0, page: 1, pageSize: 20 };
    case '/messages/unread': return { total: 0, byBooking: {} };
    case '/me/activities/count': return { count: 0 };
  }
}

function longReads(path: string, day: string): unknown {
  const lease = sampleLease(day);
  switch (path) {
    case '/properties': return [sampleFlat];
    case `/properties/${sampleFlat.id}`: return sampleFlat;
    case '/long-rent/properties': return [{
      ...sampleFlat, unit: null, ape: 'Identified', apeValid: true, apeClass: 'C', cadastralComplete: true,
      status: 'Rented', currentLease: { leaseId: lease.id, stage: 'Active', currentTermEndDate: lease.endDate, noticeOn: null, freeFrom: null },
      preparingLease: null, scheduledModeChange: null,
    } satisfies LongRentPropertyAggregate];
    case `/properties/${sampleFlat.id}/documents`: return [];
    case `/properties/${sampleFlat.id}/mode`: return { propertyId: sampleFlat.id, currentMode: 'Long', scheduledChange: null };
    case '/leases': return [lease];
    case `/leases/${lease.id}`: return {
      ...lease, securityDeposit: 1700, concordatoAssessment: null, hasSignedPdf: false, registration: null, events: [],
      parties: [{ id: 'demo-tenant', role: 'Tenant', firstName: 'Ada', lastName: 'Riva', fiscalCodeMasked: '************000X', contactEmailMasked: 'a***@example.test', isExtraEU: false }],
    } satisfies LeaseDetail;
  }
}

/** Only the two guided personas and dual have data. Unknown routes and every write stop locally. */
export function readGuidedFixture(path: string, persona: ExtendedDemoProfile, day: string, params: Record<string, string> = {}): unknown {
  if (path === '/public/features') return {};
  if (path === '/users/me') return buildDemoProfile(persona);
  if (path === '/onboarding/status') return { activated: true, roleChosen: true, orgProvisioned: true, consentsAccepted: true,
    propertyCreated: true, sitePublished: true, firstBookingTaken: true, steps: [] };
  if (persona === 'dual' && path === '/properties') {
    if (params.mode === 'long') return [sampleFlat];
    if (params.mode === 'short') return [sampleVilla];
    return [sampleVilla, sampleFlat];
  }
  if (persona === 'short-stay' || persona === 'dual') {
    const data = shortReads(path, day, params);
    if (data !== undefined) return data;
  }
  if (persona === 'long-term' || persona === 'dual') return longReads(path, day);
}

export const guidedDemoAdapter: AxiosAdapter = async (config) => {
  const read = config.method?.toLowerCase() === 'get';
  const path = (config.url ?? '').split('?')[0];
  const data = read ? readGuidedFixture(path, getDemoProfileKey(), todayInRome(), config.params) : undefined;
  if (data === undefined) {
    const status = read ? 404 : 405;
    throw new AxiosError('Unavailable in the guided demo', 'ERR_BAD_REQUEST', config, undefined, {
      status, statusText: 'Unavailable in the guided demo', headers: {}, data: {}, config,
    });
  }
  return { data, status: 200, statusText: 'OK', headers: {}, config };
};
