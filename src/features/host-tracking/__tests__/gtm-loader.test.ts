import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { gtmContainerOf, loadGtm, normalizeGtmContainerId, type DataLayerWindow } from '../gtm-loader';

/**
 * The loader of the agency's Tag Manager (E41/F04/US01/T01, NF-149). Two things in it cost something when they are wrong: the id of the container reaches
 * the address of a script that runs on the booking pages (security), and nothing may be inserted, pushed or written before the page is allowed to measure
 * (privacy: the caller checks the consent, this file never writes a cookie).
 */
const GTM_SCRIPTS = 'script[src^="https://www.googletagmanager.com/gtm.js"]';

const layer = () => (window as DataLayerWindow).dataLayer;

function clean() {
  document.head.querySelectorAll(GTM_SCRIPTS).forEach((script) => script.remove());
  delete (window as DataLayerWindow).dataLayer;
}

describe('loadGtm', () => {
  beforeEach(clean);
  afterEach(clean);

  it.each([
    ['nothing', ''],
    ['spaces', '   '],
    ['only the prefix', 'GTM-'],
    ['too short', 'GTM-ABC'],
    ['too long', 'GTM-ABCDEFGHIJKLM'],
    ['a GA4 measurement id', 'G-ABCDE12345'],
    ['a Universal Analytics id', 'UA-12345-1'],
    ['an address', 'https://evil.example/gtm.js'],
    ['a script tag', '<script>alert(1)</script>'],
    ['a parameter that would end the address', 'GTM-ABC123&l=x'],
    ['a space inside', 'GTM-ABC 123'],
    ['a path inside', 'GTM-ABC/../x'],
    ['a letter of another alphabet that upper-cases into a Latin one', 'GTM-ABCı23'],
  ])('gtmLoader_rejectsInvalidContainerId_%s', (_label, id) => {
    expect(() => loadGtm(id)).not.toThrow();

    expect(loadGtm(id)).toBe(false);
    expect(document.head.querySelector(GTM_SCRIPTS)).toBeNull();
    expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
    // Not even the queue of the tag manager is created by an id that is not one.
    expect(layer()).toBeUndefined();
  });

  it('loadGtm_NotAString_InsertsNothing', () => {
    expect(loadGtm(undefined as unknown as string)).toBe(false);
    expect(loadGtm(null as unknown as string)).toBe(false);
    expect(loadGtm(42 as unknown as string)).toBe(false);
    expect(document.head.querySelector(GTM_SCRIPTS)).toBeNull();
  });

  it('loadGtm_ValidId_InsertsOneAsyncScriptAndPushesGtmStartFirst', () => {
    const before = Date.now();

    expect(loadGtm('GTM-ABC123')).toBe(true);

    const scripts = document.head.querySelectorAll<HTMLScriptElement>(GTM_SCRIPTS);
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe('https://www.googletagmanager.com/gtm.js?id=GTM-ABC123');
    expect(scripts[0].async).toBe(true);
    expect(layer()).toEqual([{ 'gtm.start': expect.any(Number), event: 'gtm.js' }]);
    expect((layer()?.[0] as { 'gtm.start': number })['gtm.start']).toBeGreaterThanOrEqual(before);
  });

  it('loadGtm_SecondCall_DoesNothing', () => {
    expect(loadGtm('GTM-ABC123')).toBe(true);

    // The same id again (a re-render, a route change, another page of the site mounting the same component) and another one: a page has one container.
    expect(loadGtm('GTM-ABC123')).toBe(false);
    expect(loadGtm('GTM-OTHER99')).toBe(false);

    expect(document.head.querySelectorAll(GTM_SCRIPTS)).toHaveLength(1);
    expect(layer()).toHaveLength(1);
  });

  it('loadGtm_ExistingDataLayer_IsKeptAndExtended', () => {
    (window as DataLayerWindow).dataLayer = [{ page_language: 'it' }];

    loadGtm('GTM-ABC123');

    expect(layer()).toEqual([{ page_language: 'it' }, { 'gtm.start': expect.any(Number), event: 'gtm.js' }]);
  });

  it('loadGtm_IdInLowerCaseWithSpaces_LoadsTheIdTheBackendWouldHaveStored', () => {
    expect(loadGtm('  gtm-abc123 ')).toBe(true);

    expect(document.head.querySelector<HTMLScriptElement>(GTM_SCRIPTS)?.src).toBe('https://www.googletagmanager.com/gtm.js?id=GTM-ABC123');
  });

  it('loadGtm_WritesNoCookieAndNoStorage', () => {
    window.localStorage.clear();
    window.sessionStorage.clear();

    loadGtm('GTM-ABC123');

    expect(document.cookie).toBe('');
    expect(window.localStorage).toHaveLength(0);
    expect(window.sessionStorage).toHaveLength(0);
  });
});

describe('normalizeGtmContainerId', () => {
  it.each([
    ['GTM-ABCD', 'GTM-ABCD'],
    ['GTM-ABCDEFGHIJKL', 'GTM-ABCDEFGHIJKL'],
    ['GTM-5K9T2MX', 'GTM-5K9T2MX'],
    ['  gtm-abcd12 ', 'GTM-ABCD12'],
  ])('normalizeGtmContainerId_%s_Is_%s', (value, expected) => {
    expect(normalizeGtmContainerId(value)).toBe(expected);
  });

  it.each([[undefined], [null], [42], [{}], ['']])('normalizeGtmContainerId_%j_IsNotAnId', (value) => {
    expect(normalizeGtmContainerId(value)).toBeNull();
  });
});

describe('gtmContainerOf', () => {
  const site = { embedEnabled: true, tracking: { gtmContainerId: 'GTM-ABC123' } };

  it('gtmContainerOf_AgencySiteWithAnIdOnABookingPage_IsTheContainer', () => {
    expect(gtmContainerOf(site, '/book/villa-mare')).toBe('GTM-ABC123');
    expect(gtmContainerOf(site, '/book/villa-mare/property/casa-mare/checkout')).toBe('GTM-ABC123');
  });

  it('gtmContainerOf_OnTheCasazenDomain_IsNothing', () => {
    expect(gtmContainerOf(null, '/book/villa-mare')).toBeNull();
  });

  it.each([
    ['the widgets are off (flag or plan)', { ...site, embedEnabled: false }],
    ['the answer does not say', { tracking: site.tracking }],
    ['the agency set no container', { embedEnabled: true, tracking: { gtmContainerId: null } }],
    ['the answer has no tracking block', { embedEnabled: true }],
    ['the id is not a container id', { embedEnabled: true, tracking: { gtmContainerId: 'G-ABCDE12345' } }],
  ])('gtmContainerOf_When_%s_IsNothing', (_label, candidate) => {
    expect(gtmContainerOf(candidate, '/book/villa-mare')).toBeNull();
  });

  it.each([['/embed'], ['/embed/booking'], ['/embed/property/casa-mare'], ['/embed/villa-mare/booking'], ['/EMBED/Booking'], ['/embed/booking?lang=it#top']])(
    'gtmContainerOf_InTheWidgetPage_%s_IsNothing',
    (pathname) => {
      expect(gtmContainerOf(site, pathname)).toBeNull();
    },
  );
});
