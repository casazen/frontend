import { describe, it, expect } from 'vitest';
import { currentReturnTo, safeReturnTo } from '../auth-return-to';

describe('safeReturnTo', () => {
  it('pathOfThisOrigin_IsKept', () => {
    expect(safeReturnTo('/register?inviteToken=abc')).toBe('/register?inviteToken=abc');
    expect(safeReturnTo('/app/supplier/activation')).toBe('/app/supplier/activation');
  });

  it.each([
    'https://evil.example/register',
    '//evil.example/register',
    '/\\evil.example',
    'javascript:alert(1)',
    'register',
    '/app\u0000',
    '',
  ])('unsafeOrForeign_%s_IsRejected', (value) => {
    expect(safeReturnTo(value)).toBeNull();
  });

  it('nonString_IsRejected', () => {
    expect(safeReturnTo(undefined)).toBeNull();
    expect(safeReturnTo(42)).toBeNull();
  });
});

describe('currentReturnTo', () => {
  it('location_JoinsPathQueryAndHash', () => {
    expect(currentReturnTo({ pathname: '/register', search: '?inviteToken=abc', hash: '#top' })).toBe(
      '/register?inviteToken=abc#top',
    );
  });

  it('currentReturnTo_CallbackPageOfTheChannelManager_LeavesTheCodeAndTheStateOut', () => {
    // A `returnTo` lasts (a history entry, the state Auth0 keeps while the user signs in): the single-use secrets do not go into it.
    expect(
      currentReturnTo({ pathname: '/app/short-rent/integrations/octorate', search: '?code=the-code&state=the-state', hash: '' }),
    ).toBe('/app/short-rent/integrations/octorate');
    expect(
      currentReturnTo({
        pathname: '/app/short-rent/integrations/octorate',
        search: '?step=why&error=access_denied&state=the-state',
        hash: '#top',
      }),
    ).toBe('/app/short-rent/integrations/octorate?step=why#top');
  });
});
