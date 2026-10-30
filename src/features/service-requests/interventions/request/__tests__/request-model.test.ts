import { describe, expect, it } from 'vitest';
import { AxiosError, type AxiosResponse } from 'axios';
import { ROUTE_MANIFEST } from '@/config/route-manifest';
import i18n from '@/i18n/config';
import {
  CUSTOM_SERVICE,
  requestDefaults,
  requestProblemOf,
  requestStepSchemas,
  slotsInWindow,
  slotsOfDay,
  SUPPLIER_SEES,
  toCreateRequest,
  turnoverWindow,
  type RequestValues,
} from '../request-model';

const SERVICE_ID = '3f2a9c1e-7b1d-4c3a-9e2f-0a1b2c3d4e5f';
const PROPERTY_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const SUPPLIER_ID = '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b';

function values(overrides: Partial<RequestValues> = {}): RequestValues {
  return {
    category: 'cleaning',
    urgency: 'Normal',
    notes: '',
    propertyId: PROPERTY_ID,
    bookingId: '',
    day: '2026-11-03',
    supplierOrgId: SUPPLIER_ID,
    supplierName: 'Pulizie Rossi',
    serviceId: SERVICE_ID,
    serviceName: 'Pulizia di fine soggiorno',
    serviceMinutes: 120,
    serviceEstimateCents: 6000,
    serviceRequiresQuote: false,
    servicePriceFromCents: 6000,
    servicePriceUnit: 'PerJob',
    startTime: '10:00',
    durationChoice: '120',
    durationOther: '',
    ...overrides,
  };
}

function problem(status: number, code: string) {
  return new AxiosError('failed', AxiosError.ERR_BAD_REQUEST, undefined, undefined, { status, data: { code }, statusText: '', headers: {}, config: {} } as unknown as AxiosResponse);
}

describe('the request the wizard sends (SR-08b)', () => {
  it('toCreateRequest_CatalogService_SendsTheServiceAndTheSlotButNeverALength', () => {
    const request = toCreateRequest(values());

    // 10:00 in Rome on 3 November 2026 is 09:00 UTC (winter time): the slot the server offered.
    expect(request).toMatchObject({ serviceListingId: SERVICE_ID, scheduledStartUtc: '2026-11-03T09:00:00.000Z', supplierOrgId: SUPPLIER_ID, propertyId: PROPERTY_ID });
    // With a length the server would stop checking the slot against the agenda of the supplier.
    expect(request.durationMinutes).toBeUndefined();
  });

  it('toCreateRequest_JobOutsideTheCatalog_SendsTheLengthTheHostWroteAndNoService', () => {
    const request = toCreateRequest(values({ serviceId: CUSTOM_SERVICE, serviceMinutes: null, durationChoice: 'other', durationOther: '45', day: '2027-07-10', startTime: '08:30' }));

    expect(request.serviceListingId).toBeUndefined();
    expect(request.durationMinutes).toBe(45);
    // Summer time: 08:30 in Rome is 06:30 UTC.
    expect(request.scheduledStartUtc).toBe('2027-07-10T06:30:00.000Z');
  });

  it('toCreateRequest_HouseAloneAndBlankNotes_LeavesOutTheStayAndTheNotes', () => {
    const request = toCreateRequest(values({ bookingId: '', notes: '   ' }));

    expect(request.bookingId).toBeUndefined();
    expect(request.notes).toBeUndefined();
    expect(toCreateRequest(values({ bookingId: PROPERTY_ID, notes: ' Citofono rotto ' }))).toMatchObject({ bookingId: PROPERTY_ID, notes: 'Citofono rotto' });
  });

  it('toCreateRequest_BackupSuppliers_OnlyANoIsSent_AndTheWizardStartsWithYes', () => {
    // SP-BKP: the org's choice decides unless the host unticks the box of the last step.
    expect(toCreateRequest(values()).useBackupSuppliers).toBeUndefined();
    expect(toCreateRequest(values({ useBackups: true })).useBackupSuppliers).toBeUndefined();
    expect(toCreateRequest(values({ useBackups: false })).useBackupSuppliers).toBe(false);
    expect(requestDefaults(new URLSearchParams(), undefined, '2026-11-03').values.useBackups).toBe(true);
  });

  it('requestProblemOf_RefusalsThatSendTheHostBack_NameTheStepAndOtherAnswersAreTheServers', () => {
    expect(requestProblemOf(problem(409, 'supplier_slot_unavailable'))).toEqual({ kind: 'slotTaken', step: 'who' });
    expect(requestProblemOf(problem(409, 'supplier_commitment_conflict'))).toEqual({ kind: 'commitmentConflict', step: 'who' });
    expect(requestProblemOf(problem(422, 'service_request_supplier_outside_comune'))).toEqual({ kind: 'supplierOutsideComune', step: 'who' });
    expect(requestProblemOf(problem(422, 'service_request_supplier_inactive'))).toEqual({ kind: 'supplierInactive', step: 'who' });
    expect(requestProblemOf(problem(422, 'service_request_booking_mismatch'))).toEqual({ kind: 'stayMismatch', step: 'when' });
    expect(requestProblemOf(problem(403, 'forbidden'))).toBeNull();
    expect(requestProblemOf(new Error('network'))).toBeNull();
  });
});

describe('where the wizard starts (SR-08b)', () => {
  it('requestDefaults_AddressOfAnEntryPoint_IsTakenOnlyAsFarAsItIsValid', () => {
    const search = new URLSearchParams(`propertyId=${PROPERTY_ID}&bookingId=not-an-id&type=cleaning&date=2020-01-01&supplierOrgId=${SUPPLIER_ID}`);

    const { values: start, prefilled } = requestDefaults(search, ['cleaning', 'plumbing'], '2026-11-03');

    expect(start).toMatchObject({ propertyId: PROPERTY_ID, bookingId: '', category: 'cleaning', supplierOrgId: SUPPLIER_ID, day: '2026-11-03' });
    expect(prefilled).toBe(true);
    // A category the catalog does not have is not taken.
    expect(requestDefaults(new URLSearchParams('type=gardening'), ['cleaning'], '2026-11-03').values.category).toBe('');
    expect(requestDefaults(new URLSearchParams(''), ['cleaning'], '2026-11-03').prefilled).toBe(false);
  });
});

describe('the turnover and the slots (SR-08b)', () => {
  const stay = (checkIn: string, checkOut: string, status = 'Confirmed') => ({ checkInDate: `${checkIn}T00:00:00Z`, checkOutDate: `${checkOut}T00:00:00Z`, status }) as never;

  it('turnoverWindow_GuestsLeaveAndOthersArriveTheSameDay_IsBetweenTheTwoHours', () => {
    const stays = [stay('2026-11-01', '2026-11-03'), stay('2026-11-03', '2026-11-06')];

    expect(turnoverWindow('2026-11-03', stays)).toEqual({ from: '10:00', to: '15:00' });
    expect(turnoverWindow('2026-11-03', stays, { checkOutBy: '11:00', checkInFrom: '16:30' })).toEqual({ from: '11:00', to: '16:30' });
  });

  it('turnoverWindow_NobodyArrivesOrNobodyLeaves_IsOpenEndedOrNothing', () => {
    expect(turnoverWindow('2026-11-03', [stay('2026-11-01', '2026-11-03')])).toEqual({ from: '10:00', to: null });
    expect(turnoverWindow('2026-11-04', [stay('2026-11-01', '2026-11-03')])).toBeNull();
    // A cancelled stay leaves nobody.
    expect(turnoverWindow('2026-11-03', [stay('2026-11-01', '2026-11-03', 'Cancelled')])).toBeNull();
  });

  it('slotsOfDay_And_slotsInWindow_KeepTheSlotsOfTheDayInsideTheAdvisedHours', () => {
    // Winter time: 09:00Z is 10:00 in Rome.
    const slots = [
      { startUtc: '2026-11-03T08:00:00Z', endUtc: '2026-11-03T10:00:00Z' },
      { startUtc: '2026-11-03T09:00:00Z', endUtc: '2026-11-03T11:00:00Z' },
      { startUtc: '2026-11-03T13:00:00Z', endUtc: '2026-11-03T15:00:00Z' },
      { startUtc: '2026-11-04T09:00:00Z', endUtc: '2026-11-04T11:00:00Z' },
    ];

    const day = slotsOfDay(slots, '2026-11-03');
    expect(day.map((slot) => slot.time)).toEqual(['09:00', '10:00', '14:00']);
    // 09:00 is before the guests leave; 14:00–16:00 ends after the next ones may arrive.
    expect(slotsInWindow(day, { from: '10:00', to: '15:00' }).map((slot) => slot.time)).toEqual(['10:00']);
    expect(slotsInWindow(day, { from: '10:00', to: null }).map((slot) => slot.time)).toEqual(['10:00', '14:00']);
    expect(slotsInWindow(day, null)).toHaveLength(3);
  });
});

describe('the rules of the third step (SR-08b)', () => {
  // 3 November 2026, 07:30 UTC = 08:30 in Rome.
  const schemas = requestStepSchemas(() => new Date('2026-11-03T07:30:00Z'));
  const issues = (candidate: RequestValues) => {
    const result = schemas.who.safeParse(candidate);
    return result.success ? [] : result.error.issues.map((issue) => [issue.path.join('.'), issue.message]);
  };

  it('whoSchema_CatalogServiceWithoutASlot_AsksForOne', () => {
    expect(issues(values({ startTime: '' }))).toEqual([['startTime', 'requestWizard.errors.slotRequired']]);
    expect(issues(values())).toEqual([]);
  });

  it('whoSchema_TimeAlreadyGoneByToday_IsRefused', () => {
    expect(issues(values({ serviceId: CUSTOM_SERVICE, serviceMinutes: null, startTime: '08:00' }))).toEqual([['startTime', 'requestWizard.errors.timePast']]);
    expect(issues(values({ serviceId: CUSTOM_SERVICE, serviceMinutes: null, startTime: '11:00' }))).toEqual([]);
  });

  it('whoSchema_JobTimedByTheHost_NeedsALengthTheApiTakes', () => {
    const custom = { serviceId: CUSTOM_SERVICE, serviceMinutes: null, startTime: '11:00' };

    expect(issues(values({ ...custom, durationChoice: 'other', durationOther: '3' }))).toEqual([['durationOther', 'requestWizard.errors.durationInvalid']]);
    expect(issues(values({ ...custom, durationChoice: 'other', durationOther: '1441' }))).toEqual([['durationOther', 'requestWizard.errors.durationInvalid']]);
    expect(issues(values({ ...custom, durationChoice: 'other', durationOther: '45' }))).toEqual([]);
  });

  it('whenSchema_DayThatHasPassed_IsRefused', () => {
    expect(schemas.when.safeParse({ propertyId: PROPERTY_ID, bookingId: '', day: '2026-11-02' }).success).toBe(false);
    expect(schemas.when.safeParse({ propertyId: PROPERTY_ID, bookingId: '', day: '2026-11-03' }).success).toBe(true);
  });
});

describe('what the summary says (SR-08b, decision D9)', () => {
  it('SUPPLIER_SEES_Sentences_ExistAndNeverPromiseGuestData', async () => {
    await i18n.changeLanguage('it');

    for (const key of [...SUPPLIER_SEES.before, ...SUPPLIER_SEES.after, SUPPLIER_SEES.never]) expect(i18n.t(key), key).not.toBe(key);
    // The notes and the contacts come only with the take.
    expect(SUPPLIER_SEES.before.join()).not.toMatch(/notes|contact/);
    expect(SUPPLIER_SEES.after.join()).toMatch(/notes/);
    expect(i18n.t(SUPPLIER_SEES.never)).toContain('ospiti');
  });

  it('manifest_RequestRoute_AsksForTheRightToAskForAnIntervention', () => {
    const entry = ROUTE_MANIFEST.find((candidate) => candidate.path === '/app/short-rent/interventions/request');

    expect(entry?.requiredPermissions).toEqual(['servicerequest.write']);
  });
});
