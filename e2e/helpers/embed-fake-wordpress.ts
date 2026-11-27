import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';
import type { GuestBookingDetails, GuestSession } from '../../src/types';
import type { ResolveHostResponse } from '../../src/types/domain.types';
import { DEMO_ORG_SLUG, mockBrandedBookingApi, mockOrgPropertyId, mockOrgPropertySlug } from './branded-booking-mock';
import { futureStay, mockDirectCheckoutApi } from './direct-checkout-mock';

/**
 * The world of the cross-origin proof of the embeddable widgets (E43/F01/US01, NF-150): two fictitious https origins that exist only inside Playwright, so that
 * nothing here needs a real network, a certificate or a DNS record.
 *
 * - `https://sito-wordpress.test` stands for the agency's WordPress site: small pages that print exactly what the plugin prints (the element of the widget and
 *   the loader script, contract v1 of the analysis, §6);
 * - `https://prenota.quokka-test.test` is the agency's own booking domain: every request of it is answered by the build that Playwright serves on
 *   localhost, with the headers `vercel.json` gives that path (the dev server never applies them).
 *
 * Page routes win over context routes, so the API mocks of a page (`mockAgencyApi`) answer first and what they leave out reaches the proxy.
 */

/** The stand-in for the agency's WordPress site: another origin than the booking domain, and https, the only scheme `frame-ancestors https:` lets frame a page. */
export const WORDPRESS_ORIGIN = 'https://sito-wordpress.test';

/** The agency's own domain (a verified custom domain, NF-140): the host `resolve-host` knows, and the one the widgets and the checkout are served from. */
export const AGENCY_HOST = 'prenota.quokka-test.test';
export const AGENCY_ORIGIN = `https://${AGENCY_HOST}`;

/** Where Playwright serves the built app (`playwright.config.ts`, mode `E2E_EMBED`): only the proxy calls it, the browser never does. */
const LOCAL_APP_ORIGIN = 'http://localhost:4173';

/** The booking of the guest area: the code the guest-access widget takes, and the two proofs the page of the guest area accepts for it (NF-143). */
export const GUEST_BOOKING_CODE = 'K7M4Q-9XP2H';
export const GUEST_EMAIL = 'giulia@example.com';
export const GUEST_PHONE_LAST4 = '4567';

/** The session the mocked guest area hands out, and the pages of the agency domain that must refuse to be framed by another website (AC-NF144-1). */
const GUEST_ACCESS_TOKEN = 'gs1.e2e-guest-session';
export const REFUSED_PATHS = [
  '/login',
  '/checkin/test-token',
  '/portale-proprietari/accedi',
  '/property/trastevere-suite/checkout',
  '/',
  '/app/short-rent/bookings',
] as const;

/** The page of the booking widget as a frame asks for it: the one page of the domain another website may frame. */
const FRAMABLE_WIDGET_PATH = `/embed/booking?lang=it&parent=${encodeURIComponent(WORDPRESS_ORIGIN)}&v=1`;

/** A transparent pixel: what the picture of a home, or the logo of the agency, is in a world with no network. */
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
// The stand-in for the WordPress site.
// ---------------------------------------------------------------------------------------------------------------------------------------------------------

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** The element the plugin prints for a widget (`Renderer::element`): one `<div>` with the attributes the loader reads, in the plugin's order. */
function widgetElement(widget: string, attributes: Record<string, string> = {}): string {
  const all: Record<string, string> = { 'data-casazen-widget': widget, 'data-casazen-base': AGENCY_ORIGIN, 'data-casazen-lang': 'it', ...attributes };
  const pairs = Object.entries(all).map(([name, value]) => `${name}="${escapeAttribute(value)}"`);
  return `<div class="casazen-widget casazen-widget--${widget}" ${pairs.join(' ')}></div>`;
}

/**
 * A page of the stand-in site. Every page keeps the events the loader hands to the page (`casazen:event`, a DOM event on the element of the widget that bubbles) in
 * `window.__czEvents`, the way the agency's own script would listen to them; the page of the booking widget also holds the `dataLayer` that Tag Manager reads, created
 * BEFORE the loader runs, as a page with the container in its head has it.
 */
function standInPage(title: string, main: string, { dataLayer = false }: { dataLayer?: boolean } = {}): string {
  return `<!doctype html>
<html lang="it-IT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>body{margin:0;font-family:Georgia,serif;color:#222}header,main{max-width:1100px;margin:0 auto;padding:16px}nav a{margin-right:16px}</style>
</head>
<body>
<header><nav><a href="/">Home</a><a href="/prenota/">Prenota</a><a href="/check-in-online/">Check-in online</a><a href="/area-proprietari/">Area proprietari</a></nav></header>
<main>
<h1>${title}</h1>
${main}
</main>
<script>window.__czEvents = []; document.addEventListener('casazen:event', function (event) { window.__czEvents.push(event.detail); });</script>
${dataLayer ? '<script>window.dataLayer = [];</script>' : ''}
<script id="casazen-embed-js" src="${AGENCY_ORIGIN}/embed/v1/embed.js" defer></script>
</body>
</html>`;
}

/**
 * The page that tries to frame the pages of the agency domain that must refuse it, and one that must not (the page of the booking widget, as a positive control).
 * Its frames are named, so that the test finds each one.
 */
function framingPage(): string {
  const refused = REFUSED_PATHS.map(
    (path, index) => `<iframe name="refused-${index}" title="${escapeAttribute(path)}" src="${AGENCY_ORIGIN}${path}" width="480" height="140"></iframe>`,
  );
  const control = `<iframe name="widget" title="widget" src="${AGENCY_ORIGIN}${FRAMABLE_WIDGET_PATH}" width="1000" height="700"></iframe>`;
  return standInPage('Tentativi di incorniciatura', `<p>Pagine che nessun altro sito può incorniciare, e una che sì.</p>${[...refused, control].join('\n')}`);
}

const WORDPRESS_PAGES: Record<string, string> = {
  // The home: the search bar of the hero, drawn in the page itself (no frame), with the places the plugin printed.
  '/': standInPage(
    'Quokka',
    widgetElement('search', {
      'data-casazen-target': '/prenota/',
      'data-casazen-destinations': JSON.stringify([{ id: 'roma', label: 'Roma' }]),
    }),
  ),
  // The booking engine: the plugin prints the events for the `dataLayer` by default.
  '/prenota/': standInPage('Prenota', widgetElement('booking', { 'data-casazen-datalayer': 'true', 'data-casazen-sync-url': 'false' }), { dataLayer: true }),
  '/check-in-online/': standInPage('Check-in online', widgetElement('guest-access', { 'data-casazen-datalayer': 'true' })),
  // The owner link is never a frame: a link to the sign-in of the portal, on the address of the agency.
  '/area-proprietari/': standInPage(
    'Area proprietari',
    `<p class="casazen-owner-login"><a class="casazen-owner-login__link" href="${AGENCY_ORIGIN}/portale-proprietari/accedi" rel="noopener">Area proprietari</a></p>`,
  ),
  '/tentativi-di-incorniciatura/': framingPage(),
};

/** Answers the pages of the stand-in WordPress site (`https://sito-wordpress.test/…`); any other path of it is a 404, like on a real site. */
export async function fulfillWordpressSite(context: BrowserContext): Promise<void> {
  await context.route(
    (url) => url.origin === WORDPRESS_ORIGIN,
    async (route) => {
      const html = WORDPRESS_PAGES[new URL(route.request().url()).pathname];
      if (html === undefined) {
        await route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not a page of the stand-in site.' });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
    },
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
// The agency domain: the built app with the headers of vercel.json.
// ---------------------------------------------------------------------------------------------------------------------------------------------------------

interface VercelHeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

let vercelRules: VercelHeaderRule[] | undefined;

/** The header rules of the real `vercel.json` (read once, from the root of the repository: Playwright runs from there). */
function readVercelRules(): VercelHeaderRule[] {
  vercelRules ??= (JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')) as { headers: VercelHeaderRule[] }).headers;
  return vercelRules;
}

/**
 * The headers `vercel.json` gives `path`, with lower case names. The sources only use groups, so they are read as anchored regular expressions, exactly as
 * `src/test/vercel-headers.test.ts` reads them; and, like that test, exactly one rule must apply to a path (the rules are disjoint: a path never gets two values
 * of the same header), or this throws.
 */
export function vercelHeadersFor(path: string): { source: string; headers: Record<string, string> } {
  const matching = readVercelRules().filter((rule) => new RegExp(`^${rule.source}$`).test(path));
  if (matching.length !== 1) {
    throw new Error(`vercel.json: ${matching.length} header rules apply to ${path} (${matching.map((rule) => rule.source).join(' | ') || 'none'}), exactly one must.`);
  }
  const [{ source, headers: given }] = matching;
  const headers: Record<string, string> = {};
  for (const { key, value } of given) {
    const name = key.toLowerCase();
    if (name in headers) throw new Error(`vercel.json: the rule ${source} gives ${key} twice.`);
    headers[name] = value;
  }
  return { source, headers };
}

/** A page of the agency domain the browser asked for, with the headers the proxy answered it with. */
interface ProxiedDocument {
  path: string;
  headers: Record<string, string>;
}

export interface AgencyProxy {
  /** The documents (pages and frames, not scripts or pictures) the browser asked of the agency domain, in the order it asked. */
  documents: ProxiedDocument[];
}

/** What belongs to one hop between two servers: the answer below is whole and plain, so none of it is passed on. */
const HOP_HEADERS = new Set(['connection', 'keep-alive', 'transfer-encoding', 'content-encoding', 'content-length']);

/** What the browser says about itself and about the page it came from: not for the local server, which would refuse a `Host` it does not know (403) and answer `304` to a validator. */
const NOT_FORWARDED = ['host', 'origin', 'referer', 'if-none-match', 'if-modified-since'];

/**
 * Serves the agency domain from the built app, and keeps the browser away from everything else. On the context, so that it also answers the frames and the page that
 * leaves the stand-in site for the checkout.
 *
 * Every request of `https://prenota.quokka-test.test` is fetched from the local server (`route.fetch({ url })`) and answered with the headers `vercel.json` defines for
 * that path (`vercelHeadersFor`), over the ones of the server. The API is the mocks of the page (`mockAgencyApi`): what they leave out is a 404, never the page of the
 * app. Any other origin is out of reach: a picture is a transparent pixel, anything else fails at once.
 */
export async function proxyAgencyDomain(context: BrowserContext): Promise<AgencyProxy> {
  const documents: ProxiedDocument[] = [];

  await context.route(
    (url) => /^https?:$/.test(url.protocol) && url.origin !== AGENCY_ORIGIN && url.origin !== WORDPRESS_ORIGIN,
    async (route) => {
      if (route.request().resourceType() === 'image') {
        await route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL });
        return;
      }
      await route.abort('blockedbyclient');
    },
  );

  await context.route(
    (url) => url.origin === AGENCY_ORIGIN,
    async (route) => {
      const request = route.request();
      const { pathname, search } = new URL(request.url());

      if (pathname.startsWith('/api/')) {
        await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'not_mocked', path: pathname }) });
        return;
      }

      const forwarded: Record<string, string> = { ...request.headers(), 'accept-encoding': 'identity' };
      for (const name of Object.keys(forwarded)) {
        // The pseudo-headers of HTTP/2 (`:authority`) are no header of a request to the local server.
        if (NOT_FORWARDED.includes(name) || name.startsWith(':')) delete forwarded[name];
      }

      try {
        const response = await route.fetch({ url: `${LOCAL_APP_ORIGIN}${pathname}${search}`, headers: forwarded, maxRedirects: 0 });
        const fromServer = Object.fromEntries(Object.entries(response.headers()).filter(([name]) => !HOP_HEADERS.has(name)));
        const headers = { ...fromServer, ...vercelHeadersFor(pathname).headers };
        if (request.resourceType() === 'document') documents.push({ path: pathname, headers });
        await route.fulfill({ status: response.status(), headers, body: await response.body() });
      } catch (error) {
        await route.fulfill({ status: 502, contentType: 'text/plain', body: `The local server did not answer ${pathname}: ${error instanceof Error ? error.message : String(error)}` });
      }
    },
  );

  return { documents };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
// The API of the agency domain.
// ---------------------------------------------------------------------------------------------------------------------------------------------------------

/** What `resolve-host` says about the agency's domain (analysis §6): verified custom domain, guest area and owner portal on, the widgets on, no tracking container. */
const RESOLVE_HOST_ANSWER: ResolveHostResponse = {
  orgId: '11111111-1111-1111-1111-111111111101',
  slug: DEMO_ORG_SLUG,
  publicHostMode: 'CustomDomain',
  planTier: 'Scale',
  surfaces: { guestArea: true, ownerPortal: true },
  ownerLoginReady: true,
  embedEnabled: true,
  tracking: { gtmContainerId: null },
  branding: { displayName: 'Demo Casazen Stays', slug: DEMO_ORG_SLUG, showPoweredBy: false },
};

/** What the page of the guest area posts to open a session: the booking code and ONE proof, the e-mail or the last four digits of the phone (NF-143). */
interface GuestLookupBody {
  orgSlug?: string;
  bookingCode?: string;
  email?: string;
  phoneLast4?: string;
}

export interface AgencyApi {
  /** The bodies of the guest-area lookups (`POST /api/public/guest/session`), as the page sent them, in order. */
  guestLookups: GuestLookupBody[];
}

/** Whether the lookup proves the booking: its code and exactly one of the two proofs, the right one. */
function provesTheBooking(body: GuestLookupBody): boolean {
  if (body.orgSlug !== DEMO_ORG_SLUG || body.bookingCode !== GUEST_BOOKING_CODE) return false;
  return (body.email === GUEST_EMAIL && body.phoneLast4 === undefined) || (body.phoneLast4 === GUEST_PHONE_LAST4 && body.email === undefined);
}

function guestBooking(): GuestBookingDetails {
  const { checkIn, checkOut } = futureStay(30, 3);
  return {
    bookingCode: GUEST_BOOKING_CODE,
    status: 'Confirmed',
    paymentOption: 'Immediate',
    propertyId: mockOrgPropertyId,
    propertySlug: mockOrgPropertySlug,
    propertyName: 'Trastevere Suite',
    propertyCity: 'Roma',
    checkInDate: checkIn,
    checkOutDate: checkOut,
    numberOfAdults: 2,
    numberOfChildren: 0,
    lodging: 495,
    cleaningFee: 55,
    touristTax: 8,
    totalPrice: 558,
    paidAmount: 558,
    refundedAmount: 0,
    currency: 'EUR',
    expiresAt: null,
    deferredChargeDate: null,
    host: { name: 'Demo Casazen Stays', email: 'prenotazioni@demo.example' },
    checkIn: { status: 'NotYetOpen', opensOn: checkIn, linkSentAt: null },
  };
}

/**
 * The API behind the agency domain, for one page: the org with its homes and the search of the site (`mockBrandedBookingApi`), the quote and the checkout
 * (`mockDirectCheckoutApi`), what `resolve-host` says about the host, the flags, and the guest area. The guest-area lookup answers 200 for the right pair only, and the
 * same 404 `guest_booking_not_found` for everything else (a wrong code, a wrong e-mail, wrong digits): the page must not be able to tell them apart.
 *
 * The consent to cookies is already given on the top window of the domain, so that the banner is not over the form; a frame never gets it (a widget keeps nothing).
 */
export async function mockAgencyApi(page: Page): Promise<AgencyApi> {
  await mockBrandedBookingApi(page);
  await mockDirectCheckoutApi(page);

  const guestLookups: GuestLookupBody[] = [];
  const api = (path: RegExp) => (url: URL) => url.origin === AGENCY_ORIGIN && path.test(url.pathname);

  await page.route(api(/^\/api\/public\/resolve-host$/), async (route) => {
    const host = new URL(route.request().url()).searchParams.get('host');
    if (host !== AGENCY_HOST) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RESOLVE_HOST_ANSWER) });
  });

  // `whiteLabelHost` gives the page of the guest area its second proof (the last four digits of the phone); `siteEmbed` is the flag of the widgets.
  await page.route(api(/^\/api\/public\/features$/), async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ otaPartnerApi: false, whiteLabelHost: true, siteEmbed: true }) });
  });

  await page.route(api(/^\/api\/public\/guest\/session$/), async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    const body = route.request().postDataJSON() as GuestLookupBody;
    guestLookups.push(body);
    if (!provesTheBooking(body)) {
      await route.fulfill({ status: 404, contentType: 'application/problem+json', body: JSON.stringify({ status: 404, code: 'guest_booking_not_found' }) });
      return;
    }
    const session: GuestSession = { accessToken: GUEST_ACCESS_TOKEN, expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), bookingCode: GUEST_BOOKING_CODE };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) });
  });

  await page.route(api(/^\/api\/public\/guest\/bookings\/[^/]+$/), async (route) => {
    const bearer = route.request().headers()['authorization'];
    if (bearer !== undefined && bearer !== `Bearer ${GUEST_ACCESS_TOKEN}`) {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(guestBooking()) });
  });

  await page.addInitScript((host: string) => {
    if (location.hostname === host && window.self === window.top) localStorage.setItem('casazen_cookie_consent', 'rejected');
  }, AGENCY_HOST);

  return { guestLookups };
}
