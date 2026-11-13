import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import {
  COMPLIANCE_PAGE_PATH,
  UnknownPropertyError,
  UnusableDestinationError,
  describeFailure,
  drawerTargetOf,
  handoffRequestOf,
  isRelativeAppRoute,
  originKeyOf,
  returnRouteOf,
} from '../compliance-drawer-model';

const t = i18n.getFixedT('it');

const BOOKING = '11111111-1111-1111-1111-111111111111';
const PROPERTY = '22222222-2222-2222-2222-222222222222';

/** A failed call as axios builds it: the status and the body of the answer, and the request that was sent. */
function answered(status: number, data?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('failed', 'ERR_BAD_RESPONSE', config, undefined, { status, statusText: '', headers: {}, config, data });
}

describe('isRelativeAppRoute', () => {
  it.each([
    '/app/short-rent/compliance',
    '/app/short-rent/bookings/b1?tab=guest',
    '/app/short-rent/alloggiati?from=2026-10-01&to=2026-10-31',
  ])('isRelativeAppRoute_PageOfTheApp_Accepts %s', (route) => {
    expect(isRelativeAppRoute(route)).toBe(true);
  });

  it.each([
    ['an address with a scheme', 'https://octorate.example/panel'],
    ['a protocol-relative address', '//octorate.example/panel'],
    ['a backslash that a browser reads as a slash', '/\\octorate.example'],
    ['a script', 'javascript:alert(1)'],
    ['a page outside the app', '/login'],
    ['a path that climbs out of the app', '/app/../login'],
    ['a space', '/app/short-rent/compliance?q=a b'],
    ['an address hidden in the query', '/app/short-rent/compliance?next=https://octorate.example'],
    ['a control character', '/app/short-rent/compliance\n'],
    ['nothing', ''],
    ['a number', 42],
    ['null', null],
  ])('isRelativeAppRoute_%s_Refuses', (_name, route) => {
    expect(isRelativeAppRoute(route)).toBe(false);
  });

  it('isRelativeAppRoute_RouteLongerThanTheServerAccepts_Refuses', () => {
    expect(isRelativeAppRoute(`/app/short-rent/compliance?q=${'a'.repeat(1010)}`)).toBe(false);
    expect(isRelativeAppRoute(`/app/short-rent/compliance?q=${'a'.repeat(900)}`)).toBe(true);
  });
});

describe('returnRouteOf', () => {
  it('returnRouteOf_PageWithFilters_SplitsThePathFromItsFilters', () => {
    expect(returnRouteOf({ pathname: '/app/short-rent/alloggiati', search: '?from=2026-10-01' })).toEqual({
      route: '/app/short-rent/alloggiati',
      filters: '?from=2026-10-01',
    });
    expect(returnRouteOf({ pathname: '/app/short-rent/compliance', search: '' })).toEqual({ route: '/app/short-rent/compliance', filters: '' });
  });

  it('returnRouteOf_FiltersTheServerWouldRefuse_KeepsThePageAndDropsTheFilters', () => {
    expect(returnRouteOf({ pathname: '/app/short-rent/alloggiati', search: '?q=a\\b' })).toEqual({ route: '/app/short-rent/alloggiati', filters: '' });
    expect(returnRouteOf({ pathname: '/app/short-rent/alloggiati', search: `?q=${'a'.repeat(1100)}` })).toEqual({
      route: '/app/short-rent/alloggiati',
      filters: '',
    });
  });

  it('returnRouteOf_PageOutsideTheApp_FallsBackToTheAdempimenti', () => {
    expect(returnRouteOf({ pathname: '/login', search: '' })).toEqual({ route: COMPLIANCE_PAGE_PATH, filters: '' });
  });
});

describe('handoffRequestOf', () => {
  it('handoffRequestOf_Target_CarriesWhatIsCheckedAndTheRouteAndNeverAnAddress', () => {
    const request = handoffRequestOf(
      { topic: 'Alloggiati', propertyId: PROPERTY, bookingId: BOOKING },
      { route: '/app/short-rent/bookings/b1', filters: '?tab=guest' },
    );

    expect(request).toEqual({ topic: 'Alloggiati', propertyId: PROPERTY, bookingId: BOOKING, period: null, returnPath: '/app/short-rent/bookings/b1?tab=guest' });
    // The server decides where the host goes: nothing in the request names a destination.
    expect(Object.keys(request).sort()).toEqual(['bookingId', 'period', 'propertyId', 'returnPath', 'topic']);
  });

  it('handoffRequestOf_PeriodOfIstat_CarriesThePeriodWithoutABooking', () => {
    expect(handoffRequestOf({ topic: 'Istat', propertyId: PROPERTY, period: '2026-10' }, { route: '/app/short-rent/compliance', filters: '' })).toEqual({
      topic: 'Istat',
      propertyId: PROPERTY,
      bookingId: null,
      period: '2026-10',
      returnPath: '/app/short-rent/compliance',
    });
  });
});

describe('originKeyOf', () => {
  it('originKeyOf_SameTarget_IsTheSameKeyAndHoldsNoNameOrOutcome', () => {
    const key = originKeyOf({ topic: 'Alloggiati', propertyId: PROPERTY, bookingId: BOOKING });
    expect(key).toBe(originKeyOf({ topic: 'Alloggiati', propertyId: PROPERTY, bookingId: BOOKING }));
    expect(key).toBe(`Alloggiati:${PROPERTY}:${BOOKING}:`);
    expect(key).not.toBe(originKeyOf({ topic: 'Istat', propertyId: PROPERTY, period: '2026-10' }));
  });

  it('originKeyOf_StayThatNamesNoProperty_IsTheKeyOfTheStayAlone', () => {
    expect(originKeyOf({ topic: 'Alloggiati', propertyId: null, bookingId: BOOKING })).toBe(`Alloggiati::${BOOKING}:`);
  });
});

describe('drawerTargetOf', () => {
  // The items as the server sends them: a stay names only its booking (`propertyId: null`), a month of ISTAT is its property's own; `handoffTopic` is the server's.
  const item = (over: Partial<Parameters<typeof drawerTargetOf>[0]>): Parameters<typeof drawerTargetOf>[0] => ({
    id: BOOKING,
    bookingId: BOOKING,
    propertyId: null,
    period: null,
    handoffTopic: 'Alloggiati',
    ...over,
  });

  it('drawerTargetOf_StayWithTheTopicOfTheServer_IsAnAlloggiatiTargetThatNamesNoPropertyYet', () => {
    // The summary names no property on a stay: the button reads it from the booking when it is pressed.
    expect(drawerTargetOf(item({}))).toEqual({ topic: 'Alloggiati', propertyId: null, bookingId: BOOKING });
  });

  it('drawerTargetOf_PropertyOfTheItem_IsKeptSoTheButtonNeedsNoReading', () => {
    expect(drawerTargetOf(item({ propertyId: PROPERTY }))).toEqual({ topic: 'Alloggiati', propertyId: PROPERTY, bookingId: BOOKING });
  });

  it.each([null, undefined])('drawerTargetOf_TopicOfTheServer_%s_HasNoTargetWhateverTheRowIs', (handoffTopic) => {
    // A communication never sent, a failure CasaZen knows, a month the host sends by hand: the outcome is not only in the connected area.
    expect(drawerTargetOf(item({ handoffTopic }))).toBeUndefined();
    expect(drawerTargetOf(item({ id: PROPERTY, bookingId: null, propertyId: PROPERTY, period: '2026-10', handoffTopic }))).toBeUndefined();
  });

  it('drawerTargetOf_TopicThisVersionDoesNotKnow_HasNoTarget', () => {
    expect(drawerTargetOf(item({ handoffTopic: 'Police' as never }))).toBeUndefined();
  });

  it('drawerTargetOf_AlloggiatiTopicWithoutAStay_HasNoTarget', () => {
    expect(drawerTargetOf(item({ bookingId: null, propertyId: PROPERTY }))).toBeUndefined();
  });

  it('drawerTargetOf_IstatMonthOfAProperty_IsAnIstatTargetWithItsPeriodAndNoStay', () => {
    expect(drawerTargetOf(item({ id: PROPERTY, bookingId: null, propertyId: PROPERTY, period: '2026-10', handoffTopic: 'Istat' }))).toEqual({
      topic: 'Istat',
      propertyId: PROPERTY,
      period: '2026-10',
    });
    // The item of a property is the property's own: its id is the property when the summary names none.
    expect(drawerTargetOf(item({ id: PROPERTY, bookingId: null, period: '2026-10', handoffTopic: 'Istat' }))?.propertyId).toBe(PROPERTY);
  });

  it.each([null, undefined, '', '2026-13', '2026-1', 'ottobre', '2026-10-01'])('drawerTargetOf_IstatItemWithPeriod_%s_HasNoTarget', (period) => {
    expect(drawerTargetOf(item({ id: PROPERTY, bookingId: null, propertyId: PROPERTY, period, handoffTopic: 'Istat' }))).toBeUndefined();
  });
});

describe('describeFailure', () => {
  it('describeFailure_404WithItsCode_IsNotFoundAndAskingAgainDoesNotChangeIt', () => {
    const failure = describeFailure(answered(404, { code: 'octorate_handoff_target_not_found' }), t);
    expect(failure).toEqual({ message: t('compliance.drawer.error.notFound'), retryable: false });
  });

  it('describeFailure_404WithNoBody_IsStillNotFound_TheEndpointIsOffOrTheTargetIsNotTheirs', () => {
    expect(describeFailure(answered(404), t)).toEqual({ message: t('compliance.drawer.error.notFound'), retryable: false });
  });

  it('describeFailure_PropertyNotConnected_IsSaidAsThatAndHasNoRetry', () => {
    const failure = describeFailure(answered(409, { code: 'octorate_handoff_property_not_mapped' }), t);
    expect(failure.message).toBe(t('apiErrors.codes.octorateHandoffPropertyNotMapped'));
    expect(failure.retryable).toBe(false);
  });

  it('describeFailure_NoDestinationConfigured_IsSaidAsThatAndCanBeTriedAgain', () => {
    const failure = describeFailure(answered(409, { code: 'octorate_handoff_destination_unavailable' }), t);
    expect(failure.message).toBe(t('apiErrors.codes.octorateHandoffDestinationUnavailable'));
    expect(failure.retryable).toBe(true);
  });

  it('describeFailure_ServerError_IsAOurSentenceNotTheServersAndCanBeTriedAgain', () => {
    const failure = describeFailure(answered(503, { detail: 'java.lang.NullPointerException at Octorate' }), t);
    expect(failure).toEqual({ message: t('compliance.drawer.error.generic'), retryable: true });
  });

  it('describeFailure_NoAnswer_IsTheNetworkAndCanBeTriedAgain', () => {
    const failure = describeFailure(new AxiosError('Network Error', AxiosError.ERR_NETWORK), t);
    expect(failure).toEqual({ message: t('apiErrors.network'), retryable: true });
  });

  it('describeFailure_Forbidden_HasNoRetry', () => {
    expect(describeFailure(answered(403), t).retryable).toBe(false);
  });

  it('describeFailure_AddressThatCannotBeOpened_KeepsTheHostHereAndCanBeTriedAgain', () => {
    expect(describeFailure(new UnusableDestinationError(), t)).toEqual({ message: t('compliance.drawer.error.destination'), retryable: true });
  });

  it('describeFailure_StayThatNamesNoProperty_IsNotFoundAndAskingAgainDoesNotChangeIt', () => {
    expect(describeFailure(new UnknownPropertyError(), t)).toEqual({ message: t('compliance.drawer.error.notFound'), retryable: false });
  });
});
