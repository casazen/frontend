import { describe, expect, it } from 'vitest';
import { currentReturnTo } from '@/lib/auth-return-to';
import { readMarketplaceReturnTo, withReturnTo } from '../return-to';

const WIZARD = '/app/short-rent/marketplace/activate/channel/AIRBNB';
const SCOPRI = '/app/short-rent/marketplace?propertyId=prop-1';

/** The query string of an address, as `location.search` has it. */
const searchOf = (address: string) => new URL(address, 'http://localhost').search;

describe('readMarketplaceReturnTo', () => {
  it('readMarketplaceReturnTo_PageOfTheApp_IsReturnedAsItIs', () => {
    expect(readMarketplaceReturnTo(`?returnTo=${encodeURIComponent(SCOPRI)}`)).toBe(SCOPRI);
    // With or without the leading question mark, among other parameters.
    expect(readMarketplaceReturnTo(`step=access&returnTo=${encodeURIComponent(SCOPRI)}`)).toBe(SCOPRI);
  });

  it('readMarketplaceReturnTo_NoParameter_IsNull', () => {
    expect(readMarketplaceReturnTo('')).toBeNull();
    expect(readMarketplaceReturnTo('?step=access')).toBeNull();
    expect(readMarketplaceReturnTo('?returnTo=')).toBeNull();
  });

  // The rule that keeps a wizard from sending the person out of the app (open redirect): nothing but a page of this app is accepted.
  it.each([
    ['an absolute URL', 'https://evil.example/app/short-rent'],
    ['an absolute URL of this host name on another scheme', 'javascript:alert(1)'],
    ['a protocol-relative URL', '//evil.example/app/short-rent'],
    ['a backslash path', '/app/\\evil.example'],
    ['a backslash that opens the path', '/\\evil.example'],
    ['the login page', '/login'],
    ['a page outside the app', '/legale/privacy'],
    ['the app without a page', '/app'],
    ['an escape from the app', '/app/../login'],
    ['an escape written with encoded dots', '/app/%2e%2e/login'],
    ['a control character', '/app/short-rent\u0000'],
    ['a line break that could hide a scheme', '/app/short-rent\nhttps://evil.example'],
    ['a relative path', 'app/short-rent'],
  ])('readMarketplaceReturnTo_%s_IsIgnored', (_name, value) => {
    expect(readMarketplaceReturnTo(`?returnTo=${encodeURIComponent(value)}`)).toBeNull();
  });
});

describe('withReturnTo', () => {
  it('withReturnTo_PathWithoutQuery_AddsTheEncodedAddressAndReadsBackUnchanged', () => {
    const address = withReturnTo(WIZARD, SCOPRI);

    expect(address.startsWith(`${WIZARD}?returnTo=`)).toBe(true);
    // Encoded: the question mark and the equals sign of the address to go back to do not break the one of the wizard.
    expect(address).not.toContain('?propertyId');
    expect(readMarketplaceReturnTo(searchOf(address))).toBe(SCOPRI);
  });

  it('withReturnTo_PathWithAQueryAndAFragment_KeepsThem', () => {
    const address = withReturnTo(`${WIZARD}?propertyId=prop-1&step=access#top`, SCOPRI);

    expect(address.endsWith('#top')).toBe(true);
    const params = new URL(address, 'http://localhost').searchParams;
    expect(params.get('propertyId')).toBe('prop-1');
    expect(params.get('step')).toBe('access');
    expect(readMarketplaceReturnTo(searchOf(address))).toBe(SCOPRI);
  });

  it('withReturnTo_ReturnToAlreadyThere_IsReplacedNotRepeated', () => {
    const address = withReturnTo(withReturnTo(WIZARD, '/app/short-rent/marketplace'), SCOPRI);

    expect(new URL(address, 'http://localhost').searchParams.getAll('returnTo')).toEqual([SCOPRI]);
  });

  it('withReturnTo_TheCurrentLocation_ComesBackAsThePageTheWizardWasOpenedFrom', () => {
    const here = currentReturnTo({ pathname: '/app/short-rent/marketplace', search: '?propertyId=prop-1&q=a%26b', hash: '' });

    expect(readMarketplaceReturnTo(searchOf(withReturnTo(WIZARD, here)))).toBe('/app/short-rent/marketplace?propertyId=prop-1&q=a%26b');
  });

  // The same rule, on the way out: an address that would not be read back is not put in the wizard's address at all.
  it.each([
    'https://evil.example/app/short-rent',
    '//evil.example/app/short-rent',
    '/app/\\evil.example',
    '/login',
    '/app/../login',
    '/app/%2e%2e/login',
    '',
    null,
    undefined,
  ])('withReturnTo_%j_LeavesThePathAsItWas', (value) => {
    expect(withReturnTo(WIZARD, value)).toBe(WIZARD);
    expect(withReturnTo(`${WIZARD}?step=access`, value)).toBe(`${WIZARD}?step=access`);
  });
});
