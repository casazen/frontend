import { describe, expect, it } from 'vitest';
import {
  CONSENT_STEP_ID,
  OCTORATE_CONNECT_PATH,
  isOctorateCallbackPath,
  readOctorateCallback,
  searchWithoutOctorateCallback,
  withoutOctorateCallback,
} from '../octorate-callback';

const params = (search: string) => new URLSearchParams(search);

describe('readOctorateCallback (what the channel manager sends the host back with)', () => {
  it('readOctorateCallback_CodeAndState_IsTheConsent', () => {
    expect(readOctorateCallback(params('?code=the-code&state=the-state'))).toEqual({
      kind: 'granted',
      code: 'the-code',
      state: 'the-state',
    });
  });

  it('readOctorateCallback_AnErrorOfTheChannelManager_IsARefusal', () => {
    expect(readOctorateCallback(params('?error=access_denied&state=the-state'))).toEqual({ kind: 'refused' });
    // An error wins over a code that comes with it: nothing is exchanged.
    expect(readOctorateCallback(params('?error=server_error&code=the-code&state=the-state'))).toEqual({ kind: 'refused' });
  });

  it('readOctorateCallback_ACodeWithoutItsState_IsARefusalAndNeverASendableConsent', () => {
    expect(readOctorateCallback(params('?code=the-code'))).toEqual({ kind: 'refused' });
    expect(readOctorateCallback(params('?code=the-code&state='))).toEqual({ kind: 'refused' });
    expect(readOctorateCallback(params('?code=%20&state=the-state'))).toBeNull();
  });

  it('readOctorateCallback_AnAddressThatIsNotACallback_IsNothing', () => {
    expect(readOctorateCallback(params(''))).toBeNull();
    expect(readOctorateCallback(params('?step=why'))).toBeNull();
    expect(readOctorateCallback(params('?state=the-state'))).toBeNull();
  });
});

describe('withoutOctorateCallback (the secrets leave the address)', () => {
  it('withoutOctorateCallback_TheCallbackParts_AreDroppedAndTheStepIsNamed', () => {
    const next = withoutOctorateCallback(params('?code=the-code&state=the-state&other=1'));

    expect(next.toString()).toBe(`other=1&step=${CONSENT_STEP_ID}`);
    expect(next.has('code')).toBe(false);
    expect(next.has('state')).toBe(false);
  });

  it('withoutOctorateCallback_ARefusal_DropsTheErrorToo', () => {
    const next = withoutOctorateCallback(params('?error=access_denied&error_description=No&error_uri=https%3A%2F%2Fx.test&state=the-state'));

    expect(next.toString()).toBe(`step=${CONSENT_STEP_ID}`);
  });

  it('withoutOctorateCallback_AStepAlreadyNamed_IsReplacedByTheConsentStep', () => {
    expect(withoutOctorateCallback(params('?step=why&code=the-code&state=the-state')).toString()).toBe(`step=${CONSENT_STEP_ID}`);
  });

  it('withoutOctorateCallback_TheAddressItWasGiven_IsNotChanged', () => {
    const original = params('?code=the-code&state=the-state');

    withoutOctorateCallback(original);

    expect(original.toString()).toBe('code=the-code&state=the-state');
  });
});

describe('searchWithoutOctorateCallback (the secrets do not go into an address that lasts)', () => {
  it('searchWithoutOctorateCallback_CallbackPage_DropsTheCodeTheStateAndTheError', () => {
    expect(searchWithoutOctorateCallback(OCTORATE_CONNECT_PATH, '?code=the-code&state=the-state')).toBe('');
    expect(
      searchWithoutOctorateCallback(
        OCTORATE_CONNECT_PATH,
        '?error=access_denied&error_description=No&error_uri=https%3A%2F%2Fx.test&state=the-state',
      ),
    ).toBe('');
    // What else the address says stays; the page is the callback page whatever its case and trailing slash.
    expect(searchWithoutOctorateCallback('/App/Short-Rent/Integrations/Octorate/', '?step=why&code=the-code&state=the-state')).toBe(
      '?step=why',
    );
  });

  it('searchWithoutOctorateCallback_AnyOtherPage_KeepsEveryParameter', () => {
    // `code` and `state` are ordinary names elsewhere (a filter, a coupon): only the page of the callback is cleaned.
    expect(searchWithoutOctorateCallback('/app/short-rent/bookings', '?state=confirmed&code=A1')).toBe('?state=confirmed&code=A1');
    expect(searchWithoutOctorateCallback('/app/long-rent/integrations/octorate', '?code=the-code&state=the-state')).toBe(
      '?code=the-code&state=the-state',
    );
    expect(searchWithoutOctorateCallback(`${OCTORATE_CONNECT_PATH}/more`, '?code=the-code&state=the-state')).toBe(
      '?code=the-code&state=the-state',
    );
  });

  it('searchWithoutOctorateCallback_CallbackPageWithoutAnAnswer_IsNotChanged', () => {
    expect(searchWithoutOctorateCallback(OCTORATE_CONNECT_PATH, '')).toBe('');
    expect(searchWithoutOctorateCallback(OCTORATE_CONNECT_PATH, '?step=why&note=a%20b')).toBe('?step=why&note=a%20b');
  });
});

describe('isOctorateCallbackPath (the page the Auth0 SDK must leave alone)', () => {
  it.each([
    OCTORATE_CONNECT_PATH,
    `${OCTORATE_CONNECT_PATH}/`,
    '/App/Short-Rent/Integrations/Octorate',
  ])('isOctorateCallbackPath_%s_IsTheCallbackPage', (pathname) => {
    expect(isOctorateCallbackPath(pathname)).toBe(true);
  });

  it.each([
    '/',
    '/app/short-rent',
    '/app/short-rent/integrations',
    `${OCTORATE_CONNECT_PATH}/more`,
    '/app/long-rent/integrations/octorate',
  ])('isOctorateCallbackPath_%s_IsAnotherPage', (pathname) => {
    expect(isOctorateCallbackPath(pathname)).toBe(false);
  });
});
