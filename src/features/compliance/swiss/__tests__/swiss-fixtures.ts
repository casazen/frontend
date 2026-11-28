import type { SwissNotificationDay, SwissNotificationGuest } from '@/types/swissCompliance.types';

export const SWISS_PROPERTY_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
export const SWISS_BOOKING_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
export const SWISS_OTHER_BOOKING_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
export const SWISS_DAY = '2026-11-19';
export const SWISS_OTHER_DAY = '2026-11-18';

export function swissGuest(overrides: Partial<SwissNotificationGuest> = {}): SwissNotificationGuest {
  return {
    bookingId: SWISS_BOOKING_ID,
    bookingCode: 'ABCDE-12345',
    position: 0,
    arrival: SWISS_DAY,
    departure: '2026-11-22',
    firstName: 'Mario',
    lastName: 'Rossi',
    birthDate: '1984-01-04',
    placeOfBirth: 'Milano',
    nationality: 'Italiana',
    nationalityCode: 'ITA',
    documentType: 'passport',
    documentNumber: 'YA1234567',
    street: 'Via Roma 1',
    postalCode: '20121',
    city: 'Milano',
    residenceCountryCode: 'ITA',
    plate: 'MI123456',
    ...overrides,
  };
}

export function swissDay(overrides: Partial<SwissNotificationDay> = {}): SwissNotificationDay {
  return {
    propertyId: SWISS_PROPERTY_ID,
    day: SWISS_DAY,
    regimeCode: 'CH-SH',
    cantonCode: 'SH',
    portalUrl: 'https://gast.sh.ch/meldung',
    channel: 'PortalForm',
    deadlineKind: 'DailyByTime',
    deadlineNote: 'Invio giornaliero entro le 02:00.',
    certainty: 'Partial',
    effectiveDuty: 'Required',
    stayCount: 1,
    guests: [swissGuest()],
    issues: [],
    dueAt: '2026-11-20T01:00:00Z',
    declaredAt: null,
    declaredBy: null,
    alreadyDeclared: false,
    pendingDays: [{ day: SWISS_DAY, stayCount: 1, dueAt: '2026-11-20T01:00:00Z' }],
    ...overrides,
  };
}

export const declaredSwissDay = (overrides: Partial<SwissNotificationDay> = {}) =>
  swissDay({ declaredAt: '2026-11-19T14:20:00Z', declaredBy: 'Luca Bianchi', alreadyDeclared: true, pendingDays: [], ...overrides });
