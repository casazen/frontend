import { describe, expect, it } from 'vitest';
import {
  bookingAttributionOf,
  buildAgencyBookingLink,
  campaignLabelToken,
  carryLinkAttribution,
  orgSiteUrl,
  propertySiteUrl,
  resolveBookingSite,
  utmToken,
  type BookingSite,
} from '@/lib/booking-link';
import { buildPropertyBookingPath, parseBookingSearchParams } from '@/lib/booking-url';
import { toHostPath } from '@/routes/host-site-window';
import type { PublicUrls } from '@/types/domain.types';

/**
 * The link an agency copies for a home (E27/F01/US02, NF-123). Two things cost something when they are wrong, and are held here: the address
 * (the link must start from the site the org really has: its own domain before its subdomain before the platform path, or the agency sends its
 * guests to an address that is not its own) and the data (the source of the link goes to the booking, so a campaign that a person typed must never carry
 * an e-mail address, a phone number or a fiscal code into an address or into a booking).
 */
const APP = 'https://app.example.test';
const SLUG = 'villa-rossi';
const HOME = { id: '6f1c2b8e-3a4d-4e5f-8a9b-0c1d2e3f4a5b', slug: 'casa-mare' };

const PATH_URL = `${APP}/book/${SLUG}`;
const ALL_THREE: PublicUrls = { pathUrl: PATH_URL, subdomainUrl: 'https://villa-rossi.sites.example.test', customDomainUrl: 'https://www.agenzia.it' };

const siteOf = (publicUrls?: PublicUrls | null) => resolveBookingSite({ orgSlug: SLUG, publicUrls, appOrigin: APP });
const queryOf = (url: string) => new URL(url).searchParams;

describe('resolveBookingSite', () => {
  it('resolveBookingSite_CustomDomainSubdomainAndPath_PrefersTheCustomDomain', () => {
    expect(siteOf(ALL_THREE)).toEqual({ orgSlug: SLUG, baseUrl: 'https://www.agenzia.it', ownHost: true });
  });

  it('resolveBookingSite_SubdomainAndPath_PrefersTheSubdomain', () => {
    expect(siteOf({ ...ALL_THREE, customDomainUrl: null })).toMatchObject({ baseUrl: 'https://villa-rossi.sites.example.test', ownHost: true });
    expect(siteOf({ pathUrl: PATH_URL, subdomainUrl: 'https://villa-rossi.sites.example.test' })).toMatchObject({ ownHost: true });
  });

  it('resolveBookingSite_OnlyThePath_IsTheSiteOfThePlatform', () => {
    expect(siteOf({ pathUrl: PATH_URL, subdomainUrl: null, customDomainUrl: null })).toEqual({ orgSlug: SLUG, baseUrl: PATH_URL, ownHost: false });
  });

  it('resolveBookingSite_PathWithNoHost_IsReadAgainstTheAddressOfTheApp', () => {
    // Where the public site is not configured (development, test) the API gives a path, not an address.
    const site = resolveBookingSite({ orgSlug: SLUG, publicUrls: { pathUrl: `/book/${SLUG}` }, appOrigin: 'http://localhost:5173' });

    expect(site).toEqual({ orgSlug: SLUG, baseUrl: `http://localhost:5173/book/${SLUG}`, ownHost: false });
  });

  it.each([[undefined], [null]])('resolveBookingSite_SettingsNotRead_IsThePlatformPathOfTheSlug (%s)', (publicUrls) => {
    expect(siteOf(publicUrls)).toEqual({ orgSlug: SLUG, baseUrl: PATH_URL, ownHost: false });
  });

  it.each([['/somewhere'], ['ftp://www.agenzia.it'], ['not an address'], ['']])(
    'resolveBookingSite_OwnHostThatIsNotAnAddressOfASite_IsNeverTheSite (%s)',
    (customDomainUrl) => {
      // A host of its own is an address with a host: anything else would send the agency's guests to the address of the app, said to be the agency's.
      expect(siteOf({ pathUrl: PATH_URL, subdomainUrl: null, customDomainUrl })).toMatchObject({ baseUrl: PATH_URL, ownHost: false });
    },
  );

  it('resolveBookingSite_SlashesAtTheEndAndAQuery_AreDropped', () => {
    expect(siteOf({ pathUrl: `${PATH_URL}/`, customDomainUrl: 'https://www.agenzia.it/?x=1' })).toMatchObject({ baseUrl: 'https://www.agenzia.it' });
    expect(siteOf({ pathUrl: `${PATH_URL}///` })).toMatchObject({ baseUrl: PATH_URL });
  });
});

describe('the pages of the site', () => {
  it('propertySiteUrl_HostOfItsOwn_HasNoBookPrefixAndIsTheAddressTheRouterShows', () => {
    const url = propertySiteUrl(siteOf(ALL_THREE), HOME);

    expect(url).toBe('https://www.agenzia.it/property/casa-mare');
    // The same clean address the router shows on an own host (`host-site-window.ts`), so a link and a page never disagree.
    expect(new URL(url).pathname).toBe(toHostPath(buildPropertyBookingPath(SLUG, HOME), SLUG));
  });

  it('propertySiteUrl_Platform_IsThePageUnderTheBookPath', () => {
    expect(propertySiteUrl(siteOf({ pathUrl: PATH_URL }), HOME)).toBe(`${PATH_URL}/property/casa-mare`);
  });

  it('propertySiteUrl_HomeWithoutASlug_UsesItsId', () => {
    expect(propertySiteUrl(siteOf(ALL_THREE), { id: HOME.id, slug: null })).toBe(`https://www.agenzia.it/property/${HOME.id}`);
    expect(propertySiteUrl(siteOf(ALL_THREE), { id: HOME.id, slug: '  ' })).toBe(`https://www.agenzia.it/property/${HOME.id}`);
  });

  it('orgSiteUrl_HostOfItsOwnAndPlatform_AreTheLandingPageOfEach', () => {
    expect(orgSiteUrl(siteOf(ALL_THREE))).toBe('https://www.agenzia.it/');
    expect(orgSiteUrl(siteOf({ pathUrl: PATH_URL }))).toBe(PATH_URL);
  });
});

describe('buildAgencyBookingLink', () => {
  const site: BookingSite = siteOf(ALL_THREE);

  it('buildAgencyBookingLink_EverythingChosen_IsThePageWithTheStayTheLanguageAndTheSource', () => {
    const link = buildAgencyBookingLink(site, HOME, {
      checkIn: '2026-12-01',
      checkOut: '2026-12-05',
      guests: 3,
      language: 'en',
      campaign: 'Estate 2026',
    });

    expect(link).toBe(
      'https://www.agenzia.it/property/casa-mare?checkin=2026-12-01&checkout=2026-12-05&guests=3&lang=en&utm_source=agency-site&utm_medium=link&utm_campaign=estate-2026',
    );
  });

  it('buildAgencyBookingLink_NothingChosen_StillSaysItComesFromTheAgencySite', () => {
    // `utm_source=agency-site` is what makes the host read «Sito dell'agenzia»: it is in every link.
    expect(buildAgencyBookingLink(site, HOME)).toBe('https://www.agenzia.it/property/casa-mare?utm_source=agency-site&utm_medium=link');
    expect(buildAgencyBookingLink(site, HOME, { campaign: '   ' })).toBe('https://www.agenzia.it/property/casa-mare?utm_source=agency-site&utm_medium=link');
  });

  it('buildAgencyBookingLink_OnThePlatform_StartsFromTheBookPath', () => {
    const link = buildAgencyBookingLink(siteOf({ pathUrl: PATH_URL }), HOME, { guests: 2 });

    expect(link).toBe(`${PATH_URL}/property/casa-mare?guests=2&utm_source=agency-site&utm_medium=link`);
  });

  it.each([
    ['only the arrival', { checkIn: '2026-12-01' }],
    ['only the departure', { checkOut: '2026-12-05' }],
    ['a departure that is not after the arrival', { checkIn: '2026-12-05', checkOut: '2026-12-05' }],
    ['a departure before the arrival', { checkIn: '2026-12-05', checkOut: '2026-12-01' }],
    ['dates that do not exist', { checkIn: '2026-02-30', checkOut: '2026-03-05' }],
    ['dates that are not dates', { checkIn: 'tomorrow', checkOut: 'next week' }],
  ])('buildAgencyBookingLink_%s_LeavesTheDatesOut', (_case, dates) => {
    const query = queryOf(buildAgencyBookingLink(site, HOME, dates));

    expect(query.has('checkin')).toBe(false);
    expect(query.has('checkout')).toBe(false);
  });

  it.each([[0], [-1], [2.5], [100], [Number.NaN]])('buildAgencyBookingLink_GuestsThatAreNotFrom1To99_AreLeftOut (%s)', (guests) => {
    expect(queryOf(buildAgencyBookingLink(site, HOME, { guests })).has('guests')).toBe(false);
  });

  it('buildAgencyBookingLink_StayOfTheLink_IsWhatThePageOfTheHomeReads', () => {
    const link = buildAgencyBookingLink(site, HOME, { checkIn: '2026-12-01', checkOut: '2026-12-05', guests: 4, language: 'it' });

    expect(parseBookingSearchParams(queryOf(link))).toEqual({ checkIn: '2026-12-01', checkOut: '2026-12-05', guests: 4, children: 0 });
    expect(queryOf(link).get('lang')).toBe('it');
  });

  it('buildAgencyBookingLink_CampaignWithPersonalData_NeverReachesTheAddress', () => {
    const typed = ['mario.rossi@example.com', 'scrivi a mario.rossi@example.com', '333 123 4567', '+39 333 1234567', 'RSSMRA80A01H501U', 'rss mra 80a01 h501u', '!!!'];

    for (const campaign of typed) {
      const query = queryOf(buildAgencyBookingLink(site, HOME, { campaign }));
      expect(query.has('utm_campaign'), campaign).toBe(false);
      // The source and the medium do not depend on what was typed.
      expect(query.get('utm_source')).toBe('agency-site');
      expect(query.get('utm_medium')).toBe('link');
    }
  });
});

describe('campaignLabelToken', () => {
  it.each([
    ['Estate 2026', 'estate-2026'],
    ['  Volantino  Roma  ', 'volantino-roma'],
    ['Città d’Arte: Natale!', 'citta-d-arte-natale'],
    ['home-page_agenzia', 'home-page-agenzia'],
    ['PRIMAVERA', 'primavera'],
  ])('campaignLabelToken_%s_Is%s', (label, token) => {
    expect(campaignLabelToken(label)).toBe(token);
  });

  it('campaignLabelToken_NothingToKeep_IsEmpty', () => {
    expect(campaignLabelToken('')).toBe('');
    expect(campaignLabelToken('   ')).toBe('');
    expect(campaignLabelToken('???')).toBe('');
  });

  it('campaignLabelToken_AddressOfEmail_IsEmptyWhateverIsAroundIt', () => {
    // In the token the `@` would already be a dash, and the address would pass as a name: it is looked for in what was typed.
    expect(campaignLabelToken('mario.rossi@example.com')).toBe('');
    expect(campaignLabelToken('@estate')).toBe('');
  });

  it('campaignLabelToken_PhoneNumberAndFiscalCode_AreEmptyHoweverTheyAreWritten', () => {
    for (const label of ['3331234567', '333-123-4567', '333.123.4567', '+39 333 123 4567', 'RSSMRA80A01H501U', 'rssmra80a01h501u', 'RSS-MRA-80A01-H501U', 'RSSMRA80A01H50LU']) {
      expect(campaignLabelToken(label), label).toBe('');
    }
    // A year, a number of a flyer or a short code is not a phone number.
    expect(campaignLabelToken('volantino 2026')).toBe('volantino-2026');
    expect(campaignLabelToken('flyer 12345678')).toBe('flyer-12345678');
  });

  it('campaignLabelToken_VeryLongName_IsCutAtTheSizeOfTheCampaignAndNeverEndsWithADash', () => {
    const token = campaignLabelToken(`${'a'.repeat(59)} bbbbbbbbbb`);

    expect(token.length).toBeLessThanOrEqual(80);
    expect(token).toBe('a'.repeat(59));
    expect(token.endsWith('-')).toBe(false);
  });
});

describe('utmToken', () => {
  it.each([
    ['agency-site', 40, 'agency-site'],
    ['  Newsletter ', 40, 'newsletter'],
    ['summer.2026_home', 80, 'summer.2026_home'],
    ['été', 40, 'été'],
  ])('utmToken_%s_IsKeptAs%s', (value, max, token) => {
    expect(utmToken(value, max)).toBe(token);
  });

  it.each([
    ['a b'],
    ['a@b.it'],
    ['https://www.agenzia.it/case'],
    ['a/b'],
    ['a:b'],
    ['a?b=1'],
    ['-start'],
    ['end-'],
    ['.start'],
    ['123456789'],
    ['12-34-56-78-90'],
    ['rssmra80a01h501u'],
    [''],
  ])('utmToken_%s_IsDropped', (value) => {
    expect(utmToken(value, 80)).toBe('');
  });

  it('utmToken_TooLongForTheColumn_IsDroppedAndNeverCut', () => {
    expect(utmToken('a'.repeat(40), 40)).toBe('a'.repeat(40));
    expect(utmToken('a'.repeat(41), 40)).toBe('');
    expect(utmToken('a'.repeat(5000), 80)).toBe('');
  });

  it('utmToken_NothingAtAll_IsEmpty', () => {
    expect(utmToken(null, 40)).toBe('');
    expect(utmToken(undefined, 40)).toBe('');
  });
});

describe('carryLinkAttribution', () => {
  const address = (query: string) => new URLSearchParams(query);

  it('carryLinkAttribution_AddressWithTheSource_WritesItAfterTheStayOfTheLink', () => {
    const href = carryLinkAttribution(
      '/book/villa-rossi/property/casa-mare/checkout?checkin=2026-12-01&checkout=2026-12-05&guests=3',
      address('checkin=2026-11-01&utm_source=agency-site&utm_medium=link&utm_campaign=estate-2026'),
    );

    expect(href).toBe(
      '/book/villa-rossi/property/casa-mare/checkout?checkin=2026-12-01&checkout=2026-12-05&guests=3&utm_source=agency-site&utm_medium=link&utm_campaign=estate-2026',
    );
  });

  it('carryLinkAttribution_AddressWithNoSource_LeavesTheLinkAsItIs', () => {
    expect(carryLinkAttribution('/book/villa-rossi/property/casa-mare/checkout?guests=2', address('checkin=2026-12-01&guests=3'))).toBe(
      '/book/villa-rossi/property/casa-mare/checkout?guests=2',
    );
    expect(carryLinkAttribution('/book/villa-rossi', address(''))).toBe('/book/villa-rossi');
  });

  it('carryLinkAttribution_OnlyTheThreeValuesTheBookingKeeps_Travel', () => {
    const href = carryLinkAttribution(
      '/checkout?guests=2#prezzi',
      address('utm_source=agency-site&utm_term=casa&utm_content=banner&lang=en&step=2&utm_campaign=mario.rossi%40example.com&utm_medium=Link'),
    );

    // The term, the content, the language and the step of the address stay where they are; an address of e-mail is not a campaign; the hash is kept.
    expect(href).toBe('/checkout?guests=2&utm_source=agency-site&utm_medium=link#prezzi');
  });

  it('carryLinkAttribution_LinkThatAlreadyHasASource_TakesTheOneOfTheAddress', () => {
    expect(carryLinkAttribution('/checkout?utm_source=old&guests=2', address('utm_source=agency-site'))).toBe('/checkout?utm_source=agency-site&guests=2');
  });
});

describe('bookingAttributionOf', () => {
  const APP_ORIGIN = 'https://www.agenzia.it';

  it('bookingAttributionOf_LinkOfTheAgencyFromItsOwnPage_IsTheSourceAndTheHostOnly', () => {
    const attribution = bookingAttributionOf(
      new URLSearchParams('checkin=2026-12-01&utm_source=agency-site&utm_medium=link&utm_campaign=estate-2026'),
      'https://www.agenzia.it/case/casa-mare?token=abc&email=mario@example.com',
      'https://prenota.example.test',
    );

    // The host of the page the guest came from, never the page, its path or its query.
    expect(attribution).toEqual({ source: 'agency-site', medium: 'link', campaign: 'estate-2026', referrer: 'www.agenzia.it' });
  });

  it('bookingAttributionOf_NoSourceAndNoReferrer_IsNothing', () => {
    expect(bookingAttributionOf(new URLSearchParams('checkin=2026-12-01&guests=2'), '', APP_ORIGIN)).toBeUndefined();
  });

  it('bookingAttributionOf_ReferrerOfTheSiteItself_IsNotAReferrer', () => {
    expect(bookingAttributionOf(new URLSearchParams(''), 'https://www.agenzia.it/property/casa-mare', APP_ORIGIN)).toBeUndefined();
  });

  it('bookingAttributionOf_OnlyTheReferrer_IsJustTheHost', () => {
    expect(bookingAttributionOf(new URLSearchParams(''), 'https://www.google.com/search?q=casa+mare', APP_ORIGIN)).toEqual({ referrer: 'www.google.com' });
  });

  it('bookingAttributionOf_ValuesThatAreNotTokens_AreLeftOutAndNeverSent', () => {
    const attribution = bookingAttributionOf(
      new URLSearchParams('utm_source=agency-site&utm_medium=a%20b&utm_campaign=3331234567'),
      'mailto:mario@example.com',
      APP_ORIGIN,
    );

    expect(attribution).toEqual({ source: 'agency-site' });
  });
});
