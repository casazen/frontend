import { describe, expect, it } from 'vitest';
import { bookingAttributionOf } from '@/lib/booking-link';
import { buildEmbedCheckoutUrl, embedHref } from '../embed-urls';

/**
 * The addresses a widget writes (E41/F01/US01/T02, NF-144, NF-145): the links inside the frame, which keep what a reload needs, and the link out of
 * it to the checkout, which carries the stay and where the guest comes from. What costs something when it is wrong is the attribution: the booking
 * says it was made through the widget of the agency's website, and from which page, only through this address and the referrer of the checkout.
 */
const PARENT = 'https://quokka360.com';
const PLATFORM = { embedBase: '/embed/villa-rossi', parentOrigin: PARENT, lang: 'it' } as const;
const HOST = { embedBase: '/embed', parentOrigin: PARENT, lang: 'en' } as const;

const HOME = { id: '6f1c2b8e-3a4d-4e5f-8a9b-0c1d2e3f4a5b', slug: 'casa-mare' };
const STAY = { checkIn: '2026-12-01', checkOut: '2026-12-05', adults: 2, children: 1, pets: true } as const;

const queryOf = (url: string) => new URL(url).searchParams;

describe('embedHref (links inside the frame)', () => {
  it('embedHref_AtPathAndQuery_KeepsTheLanguageTheParentAndTheVersion', () => {
    const href = embedHref(PLATFORM, '/property/casa-mare', { checkin: '2026-12-01', guests: 2, from: 'booking' });
    const url = new URL(href, 'https://x.example');

    expect(url.pathname).toBe('/embed/villa-rossi/property/casa-mare');
    expect(Object.fromEntries(url.searchParams)).toEqual({ checkin: '2026-12-01', guests: '2', from: 'booking', lang: 'it', parent: PARENT, v: '1' });
  });

  it('embedHref_OnAnAgencyDomain_StartsAtEmbed', () => {
    const href = embedHref(HOST, '/booking');

    expect(href.startsWith('/embed/booking?')).toBe(true);
    expect(Object.fromEntries(new URL(href, 'https://x.example').searchParams)).toEqual({ lang: 'en', parent: PARENT, v: '1' });
  });

  it('embedHref_AQueryThatNamesTheFramesOwnParameters_IsOverriddenByTheFrame', () => {
    // The address of the frame itself is a good source of the query of a link: its own parameters are written again from what the frame knows.
    const here = new URLSearchParams(`checkin=2026-12-01&lang=de&parent=${encodeURIComponent('https://evil.example')}&v=9`);

    const href = embedHref(PLATFORM, '/booking', here);

    expect(Object.fromEntries(new URL(href, 'https://x.example').searchParams)).toEqual({ checkin: '2026-12-01', lang: 'it', parent: PARENT, v: '1' });
  });

  it('embedHref_AFrameOpenedOnItsOwn_NamesNoParent', () => {
    const href = embedHref({ ...PLATFORM, parentOrigin: null }, '/booking');

    expect(new URL(href, 'https://x.example').searchParams.has('parent')).toBe(false);
    expect(new URL(href, 'https://x.example').searchParams.get('v')).toBe('1');
  });

  it('embedHref_ValuesThatAreNothing_AreLeftOut_AndOthersAreWrittenAsText', () => {
    const href = embedHref(PLATFORM, 'booking', { a: undefined, b: null, c: false, d: 0, e: 'x y' });

    expect(href.startsWith('/embed/villa-rossi/booking?')).toBe(true);
    const query = new URL(href, 'https://x.example').searchParams;
    expect(query.has('a')).toBe(false);
    expect(query.has('b')).toBe(false);
    expect(query.get('c')).toBe('false');
    expect(query.get('d')).toBe('0');
    expect(query.get('e')).toBe('x y');
  });
});

describe('buildEmbedCheckoutUrl (the exit to the checkout, AC4)', () => {
  const agency = (overrides = {}) =>
    buildEmbedCheckoutUrl({ origin: 'https://prenota.quokka360.com', hostMode: 'host', orgSlug: 'villa-rossi', property: HOME, stay: STAY, lang: 'en', ...overrides });
  const platform = (overrides = {}) =>
    buildEmbedCheckoutUrl({ origin: 'https://app.example.test', hostMode: 'platform', orgSlug: 'villa-rossi', property: HOME, stay: STAY, lang: 'it', ...overrides });

  it('buildEmbedCheckoutUrl_OnTheAgencyDomain_IsTheCheckoutAtTheRootOfTheSite', () => {
    const url = new URL(agency());

    expect(url.origin).toBe('https://prenota.quokka360.com');
    expect(url.pathname).toBe('/property/casa-mare/checkout');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      checkin: '2026-12-01',
      checkout: '2026-12-05',
      guests: '3',
      children: '1',
      pets: '1',
      lang: 'en',
      utm_source: 'agency-site',
      utm_medium: 'embed',
    });
  });

  it('buildEmbedCheckoutUrl_OnTheCasazenDomain_IsTheCheckoutUnderTheOrg', () => {
    const url = new URL(platform());

    expect(url.origin).toBe('https://app.example.test');
    expect(url.pathname).toBe('/book/villa-rossi/property/casa-mare/checkout');
    expect(url.searchParams.get('lang')).toBe('it');
    expect(url.searchParams.get('checkin')).toBe('2026-12-01');
    expect(url.searchParams.get('utm_source')).toBe('agency-site');
    expect(url.searchParams.get('utm_medium')).toBe('embed');
  });

  it('buildEmbedCheckoutUrl_AHomeWithoutASlug_UsesItsId', () => {
    expect(new URL(agency({ property: { id: HOME.id, slug: null } })).pathname).toBe(`/property/${HOME.id}/checkout`);
    expect(new URL(platform({ property: { id: HOME.id, slug: '  ' } })).pathname).toBe(`/book/villa-rossi/property/${HOME.id}/checkout`);
  });

  it('buildEmbedCheckoutUrl_NoDatesChosen_CarriesTheGuestsAndNoDates', () => {
    const url = new URL(agency({ stay: { adults: 2, children: 0, pets: false } }));

    expect(url.searchParams.has('checkin')).toBe(false);
    expect(url.searchParams.has('checkout')).toBe(false);
    expect(url.searchParams.get('guests')).toBe('2');
    expect(url.searchParams.has('children')).toBe(false);
    expect(url.searchParams.has('pets')).toBe(false);
  });

  it('buildEmbedCheckoutUrl_ASlugFromTheAddress_CannotAddASegmentOfItsOwn', () => {
    const url = new URL(agency({ property: { id: HOME.id, slug: 'casa/../../login?x=1#y' } }));

    expect(url.pathname.split('/').filter(Boolean)).toHaveLength(3);
    expect(url.pathname.endsWith('/checkout')).toBe(true);
    // The slash of the slug is written as `%2F`, so that `/login` is nowhere in the path.
    expect(url.pathname).not.toMatch(/\/login/);
    expect(url.hash).toBe('');
    expect(url.searchParams.has('x')).toBe(false);
  });

  it('embedCheckoutUrl_carriesEmbedAttribution', () => {
    // The booking reads the source of the link: `agency-site` is what makes the host read «Sito dell'agenzia», `embed` says it came through a frame.
    for (const url of [agency(), platform()]) {
      expect(queryOf(url).get('utm_source')).toBe('agency-site');
      expect(queryOf(url).get('utm_medium')).toBe('embed');
    }
  });

  it.each([
    ['a plain name', 'estate-2026', 'estate-2026'],
    ['a name in capitals', 'Estate_2026', 'estate_2026'],
    ['a name with spaces around it', '  primavera.2027  ', 'primavera.2027'],
  ])('buildEmbedCheckoutUrl_Campaign_%s_IsKept', (_label, campaign, token) => {
    expect(queryOf(agency({ campaign })).get('utm_campaign')).toBe(token);
  });

  it.each([
    ['an address of e-mail', 'mario.rossi@example.com'],
    ['a phone number', '333-123-4567'],
    ['a phone number in plain digits', '3331234567'],
    ['a fiscal code', 'RSSMRA80A01H501U'],
    ['a name with a slash', 'estate/2026'],
    ['a name with spaces inside', 'estate 2026'],
    ['a name over 80 characters', 'a'.repeat(81)],
    ['an empty name', ''],
    ['spaces', '   '],
    ['nothing', null],
    ['nothing at all', undefined],
  ])('buildEmbedCheckoutUrl_Campaign_%s_IsDropped', (_label, campaign) => {
    const url = agency({ campaign });

    expect(queryOf(url).has('utm_campaign')).toBe(false);
    // The rest of the attribution is there, and nothing of what was refused is anywhere in the address.
    expect(queryOf(url).get('utm_source')).toBe('agency-site');
    expect(url).not.toContain('example.com');
    expect(url).not.toContain('3331234567');
  });

  it('buildEmbedCheckoutUrl_NothingElseOfThePage_IsCopied', () => {
    // The frame is given what it needs and builds the address from it: the parent, the version and the rest of the address of the page do not follow.
    const url = new URL(agency({ campaign: 'estate-2026' }));

    expect([...url.searchParams.keys()].sort()).toEqual(['checkin', 'checkout', 'children', 'guests', 'lang', 'pets', 'utm_campaign', 'utm_medium', 'utm_source']);
    expect(url.hash).toBe('');
  });

  it('buildEmbedCheckoutUrl_OriginWithAPath_IsOnlyTheOrigin', () => {
    expect(new URL(agency({ origin: 'https://prenota.quokka360.com/anything?x=1' })).pathname).toBe('/property/casa-mare/checkout');
  });

  it('bookingAttribution_fromEmbedCheckout_keepsPageHost', () => {
    // The top window leaves the page of the agency's site for the checkout: the referrer of the checkout is that page, and the booking keeps its host.
    const url = agency({ campaign: 'estate-2026' });

    const attribution = bookingAttributionOf(queryOf(url), 'https://quokka360.com/prenota/', new URL(url).origin, false);

    expect(attribution).toEqual({ source: 'agency-site', medium: 'embed', campaign: 'estate-2026', referrer: 'quokka360.com' });
  });

  it('bookingAttribution_fromEmbedCheckout_APageThatSendsNoReferrer_LosesOnlyTheHost', () => {
    const url = agency();

    expect(bookingAttributionOf(queryOf(url), '', new URL(url).origin, false)).toEqual({ source: 'agency-site', medium: 'embed' });
  });

  it('bookingAttribution_fromEmbedCheckout_OnTheCasazenDomain_KeepsTheHostOfThePageToo', () => {
    const url = platform();

    expect(bookingAttributionOf(queryOf(url), 'https://quokka360.com/prenota/?x=1#y', new URL(url).origin, false)).toEqual({
      source: 'agency-site',
      medium: 'embed',
      referrer: 'quokka360.com',
    });
  });
});
