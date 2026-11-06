import { describe, expect, it } from 'vitest';
import {
  CONSENT_STEP_ID,
  OCTORATE_CONNECT_PATH,
  isOctorateCallbackPath,
  readOctorateCallback,
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
