import { describe, expect, it } from 'vitest';
import { readConnectRequest, safeRedirectTarget, toAuthorizeRequest } from '../connect-params';

// Made-up values: none of them is a code, a state or a credential of anyone.
const SITE = 'https://www.quokka360.test';
const RETURN = 'https://www.quokka360.test/wp-admin/options-general.php?page=casazen';
const STATE = 'test-state-0123456789';
const CHALLENGE = 'A'.repeat(43);

const params = (overrides: Record<string, string | null> = {}) => {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries({ site: SITE, return: RETURN, state: STATE, challenge: CHALLENGE, method: 'S256', ...overrides })) {
    if (value !== null) search.set(name, value);
  }
  return search;
};

describe('readConnectRequest (PLG-FE-CONSOLE, NF-201)', () => {
  it('readConnectRequest_EveryParameter_IsTheRequestForTheServer', () => {
    expect(readConnectRequest(params())).toEqual({
      siteUrl: SITE,
      siteHost: 'www.quokka360.test',
      returnUrl: RETURN,
      state: STATE,
      codeChallenge: CHALLENGE,
      codeChallengeMethod: 'S256',
    });
  });

  it.each(['site', 'return', 'state', 'challenge', 'method'])('readConnectRequest_%sMissing_IsNotARequest', (name) => {
    expect(readConnectRequest(params({ [name]: null }))).toBeNull();
  });

  it.each(['site', 'return', 'state', 'challenge', 'method'])('readConnectRequest_%sEmptyOrBlank_IsNotARequest', (name) => {
    expect(readConnectRequest(params({ [name]: '' }))).toBeNull();
    expect(readConnectRequest(params({ [name]: '   ' }))).toBeNull();
  });

  it.each(['plain', 's256', 'S512', 'S256 ', ''])('readConnectRequest_Method_%s_IsNotS256', (method) => {
    expect(readConnectRequest(params({ method }))).toBeNull();
  });

  it.each([
    'www.quokka360.test',
    '//www.quokka360.test',
    '/wp-admin',
    'javascript:alert(1)',
    'data:text/html,hello',
    'ftp://www.quokka360.test',
    'https://',
    'https://user:secret@www.quokka360.test',
    ' https://www.quokka360.test',
    'https://www.quokka360.test ',
    'not an address',
  ])('readConnectRequest_Site_%s_IsNotAnAddressTheHostCanBeReadFrom', (site) => {
    expect(readConnectRequest(params({ site }))).toBeNull();
  });

  it.each(['/wp-admin/options-general.php', 'javascript:alert(1)', 'https://user:secret@www.quokka360.test/wp-admin', 'not an address'])(
    'readConnectRequest_Return_%s_IsNotAnAddressOfTheWeb',
    (returnUrl) => {
      expect(readConnectRequest(params({ return: returnUrl }))).toBeNull();
    },
  );

  it('readConnectRequest_ValuesLongerThanTheServerAccepts_AreNotARequest', () => {
    expect(readConnectRequest(params({ site: `https://${'a'.repeat(300)}.test` }))).toBeNull();
    expect(readConnectRequest(params({ return: `${RETURN}&x=${'a'.repeat(2100)}` }))).toBeNull();
    expect(readConnectRequest(params({ state: 'a'.repeat(129) }))).toBeNull();
    expect(readConnectRequest(params({ challenge: 'a'.repeat(129) }))).toBeNull();
  });

  it('readConnectRequest_TheHostIsShownInFull_SubdomainsAndPortIncluded', () => {
    // The part of the address that decides who the site is: «quokka360.test» at the front of a longer name is another site.
    expect(readConnectRequest(params({ site: 'https://www.quokka360.test.evil.example' }))?.siteHost).toBe('www.quokka360.test.evil.example');
    expect(readConnectRequest(params({ site: 'http://localhost:8080', return: 'http://localhost:8080/wp-admin' }))?.siteHost).toBe('localhost:8080');
  });

  it('readConnectRequest_ANameWithLettersOfAnotherAlphabet_ShowsItsPunycodeForm', () => {
    // A look-alike name does not pass for another site: the page shows the form the name has on the network.
    expect(readConnectRequest(params({ site: 'https://münchen.example', return: 'https://münchen.example/wp-admin' }))?.siteHost).toBe('xn--mnchen-3ya.example');
  });

  it('readConnectRequest_TheValuesGoToTheServerAsTheyCame', () => {
    const request = readConnectRequest(params({ site: 'https://www.quokka360.test/', state: 'a_b-C' }));

    // The server normalizes the origin and judges the rest: the page does not rewrite what the plugin wrote.
    expect(request?.siteUrl).toBe('https://www.quokka360.test/');
    expect(request?.state).toBe('a_b-C');
  });
});

describe('toAuthorizeRequest', () => {
  it('toAuthorizeRequest_SendsTheFiveFieldsOfTheContract_NotTheHostOnlyThePageShows', () => {
    const request = readConnectRequest(params());
    if (!request) throw new Error('the request is valid');

    expect(toAuthorizeRequest(request)).toEqual({ siteUrl: SITE, returnUrl: RETURN, state: STATE, codeChallenge: CHALLENGE, codeChallengeMethod: 'S256' });
    expect(Object.keys(toAuthorizeRequest(request))).not.toContain('siteHost');
  });
});

describe('safeRedirectTarget', () => {
  it('safeRedirectTarget_TheReturnAddressWithTheCodeAndTheState_OnTheOriginOfTheSite_IsTheTarget', () => {
    const redirect = `${RETURN}&casazen_code=test-code&state=${STATE}`;

    expect(safeRedirectTarget(redirect, SITE)).toBe(redirect);
  });

  it('safeRedirectTarget_ThePortOfTheSiteIsPartOfItsOrigin', () => {
    expect(safeRedirectTarget('http://localhost:8080/wp-admin?casazen_code=test-code', 'http://localhost:8080')).toBe('http://localhost:8080/wp-admin?casazen_code=test-code');
    expect(safeRedirectTarget('http://localhost:9090/wp-admin?casazen_code=test-code', 'http://localhost:8080')).toBeNull();
  });

  it.each([
    'https://evil.example/wp-admin?casazen_code=test-code',
    'https://www.quokka360.test.evil.example/wp-admin?casazen_code=test-code',
    'http://www.quokka360.test/wp-admin?casazen_code=test-code',
    'https://user:secret@www.quokka360.test/wp-admin?casazen_code=test-code',
    '//www.quokka360.test/wp-admin?casazen_code=test-code',
    '/wp-admin?casazen_code=test-code',
    'javascript:alert(1)',
    'data:text/html,hello',
    '',
    'not an address',
  ])('safeRedirectTarget_%s_IsNeverFollowed', (redirect) => {
    expect(safeRedirectTarget(redirect, SITE)).toBeNull();
  });

  it('safeRedirectTarget_TheSiteThatAskedIsNotAnAddress_NothingIsFollowed', () => {
    expect(safeRedirectTarget(`${RETURN}&casazen_code=test-code`, 'not an address')).toBeNull();
  });
});
