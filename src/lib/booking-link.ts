import { createPath, parsePath } from 'react-router-dom';
import type { AppLocale } from '@/i18n/locale-storage';
import { BOOKING_QUERY_KEYS, buildOrgBookingPath, buildPropertyBookingPath } from '@/lib/booking-url';
import { sanitizeCampaign } from '@/lib/invite-links';
import { externalReferrerHost } from '@/lib/signup-attribution';
import { SITE_LANGUAGE_QUERY_KEY } from '@/lib/site-language';
import { isStayDate } from '@/lib/stay-dates';
import type { DirectBookingAttributionPayload } from '@/types/direct-booking.types';
import type { PublicUrls } from '@/types/domain.types';

/**
 * The link an agency puts on its own website to send a guest to the booking of a home (E27/F01/US02, NF-123), and what such a link carries to the checkout.
 *
 * The address is the one the org's site really has: its own host when it has one that is served (the verified custom domain, else the CasaZen subdomain),
 * otherwise the platform path `/book/{slug}`. The link says where the guest comes from in three `utm_*` parameters, which follow the stay from the page of the
 * home to the checkout and go to the booking as its attribution: `utm_source=agency-site` is what makes the host read «Sito dell'agenzia». Pure: nothing is
 * stored, and the checkout takes the values from the address.
 */

/**
 * The `utm_source` of a link copied from CasaZen: the API takes a booking made from it as a booking of the site of the agency (`BookingAttribution.AgencySiteSource`).
 * The embeddable widgets (NF-144) use it too, for the link that takes the guest from the frame to the checkout.
 */
export const AGENCY_LINK_SOURCE = 'agency-site';

/** The `utm_medium` of such a link. */
const AGENCY_LINK_MEDIUM = 'link';

/** The `utm_medium` of the link that leaves an embedded widget for the checkout (NF-144): the booking says it came through a frame in the agency's own website. */
export const EMBED_LINK_MEDIUM = 'embed';

/** What a link says about where the guest comes from, and the parameter that says it. They are the three the booking keeps. */
const ATTRIBUTION_PARAMS = { source: 'utm_source', medium: 'utm_medium', campaign: 'utm_campaign' } as const;
type AttributionField = keyof typeof ATTRIBUTION_PARAMS;
const ATTRIBUTION_FIELDS = Object.keys(ATTRIBUTION_PARAMS) as AttributionField[];

/** The longest value of each: the size of its column on the booking (`BookingAttribution.Max*Length`). A longer value is dropped there, never cut. */
const MAX_LENGTH: Record<AttributionField, number> = { source: 40, medium: 40, campaign: 80 };

// The rules of the API for a value of the attribution (`SignupAttributionRules.SanitizeToken`): applied here as well, so that what the host sees in the link is what the
// booking keeps, and no address of the guest's reaches an address of the site.
const MAX_RAW_LENGTH = 2048;
/** Letters and digits of any alphabet, and `-`, `_` and `.` inside (never first or last): a space, an `@`, a `:`, a `/` or a `?` never pass. */
const TOKEN = /^[\p{L}\p{Nd}](?:[\p{L}\p{Nd}._-]*[\p{L}\p{Nd}])?$/u;
/** More than eight digits in a row is a phone number or an identity number, which is personal data and not a marketing value. */
const LONG_DIGIT_RUN = /\p{Nd}{9,}/u;
/** An Italian fiscal code: six letters, two digits, a letter, two digits, a letter, three digits, a letter; a digit may be written as the letter of the omocode forms (l m n p q r s t u v). */
const FISCAL_CODE = /^[a-z]{6}[0-9lmnpqrstuv]{2}[a-z][0-9lmnpqrstuv]{2}[a-z][0-9lmnpqrstuv]{3}[a-z]$/;

/**
 * The value of an attribution field as the booking keeps it: trimmed, in lower case, and only when it is a token that fits `maxLength` and is not a phone number
 * or a fiscal code (the separators do not end a run of digits, so `333-123-4567` is a phone number). Anything else is dropped (`''`), never cut.
 */
export function utmToken(value: string | null | undefined, maxLength: number): string {
  if (value === null || value === undefined || value.length > MAX_RAW_LENGTH) return '';
  const token = value.trim().toLowerCase();
  if (token === '' || token.length > maxLength || !TOKEN.test(token)) return '';
  const bare = token.replace(/[._-]/g, '');
  return LONG_DIGIT_RUN.test(bare) || FISCAL_CODE.test(bare) ? '' : token;
}

/**
 * The campaign an agency typed ("Estate 2026") as the token the link and the booking carry (`estate-2026`): accents go, anything that is not a letter or a digit
 * becomes a dash. `''` when nothing is left, and when it is not a name: an address of e-mail is looked for in what was typed (in the token its `@` is already a dash, and
 * it would pass as a name), a phone number or a fiscal code is looked for in the token.
 */
export function campaignLabelToken(label: string): string {
  if (label.includes('@')) return '';
  return utmToken(sanitizeCampaign(label).replace(/-+$/, ''), MAX_LENGTH.campaign);
}

/** Where the pages of an org's booking site are. */
export interface BookingSite {
  /** The slug of the org: the `/book/{slug}` of the platform. */
  orgSlug: string;
  /**
   * The address of the site with no slash at the end: `https://www.agenzia.it` on a host of its own, `https://app.example.it/book/villa-rossi` on the platform. The pages
   * of the site are under it.
   */
  baseUrl: string;
  /** The site has a host of its own (custom domain or subdomain): its landing page is `/` and its pages have no `/book/{slug}` in front (`routes/host-site-window.ts`). */
  ownHost: boolean;
}

interface BookingSiteInput {
  orgSlug: string;
  /** `publicUrls` of the domain settings of the org; missing while they are not read, or when they cannot be: the site is then on the platform. */
  publicUrls?: PublicUrls | null;
  /** The address of the app (`window.location.origin`): the platform path of the org is on it when the settings give a path with no host, or nothing. */
  appOrigin: string;
}

/** `url` as an address with no slash at the end and no query, or `null` when it is not an http(s) address (a relative one is read against `base`). */
function addressOf(url: string | null | undefined, base?: string): string | null {
  const text = url?.trim();
  if (!text) return null;
  try {
    const parsed = new URL(text, base);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}` : null;
  } catch {
    return null;
  }
}

/**
 * The booking site of an org: the verified custom domain, else the CasaZen subdomain, else the `/book/{slug}` path of the platform. The domain settings only give
 * `customDomainUrl` for a domain that is served, and `subdomainUrl` for an org on its subdomain, so the first one that exists is the address of the site.
 */
export function resolveBookingSite({ orgSlug, publicUrls, appOrigin }: BookingSiteInput): BookingSite {
  // A host of its own is an absolute address: a path with no host is never one.
  const own = addressOf(publicUrls?.customDomainUrl) ?? addressOf(publicUrls?.subdomainUrl);
  if (own) return { orgSlug, baseUrl: own, ownHost: true };

  const platform = addressOf(publicUrls?.pathUrl, appOrigin) ?? addressOf(buildOrgBookingPath(orgSlug), appOrigin);
  return { orgSlug, baseUrl: platform ?? `${appOrigin}${buildOrgBookingPath(orgSlug)}`, ownHost: false };
}

/** The address of the landing page of the site. */
export function orgSiteUrl(site: BookingSite): string {
  return site.ownHost ? `${site.baseUrl}/` : site.baseUrl;
}

type PropertyRef = { id: string; slug?: string | null };

/** The address of the page of a home: its slug (its id when it has none) under the address of the site, with no stay and no parameter. */
export function propertySiteUrl(site: BookingSite, property: PropertyRef): string {
  // The page of a home is `/property/{slug}` under the site, on the platform (`/book/{slug}/property/{slug}`) and on a host of its own alike.
  const pagePath = buildPropertyBookingPath(site.orgSlug, property).slice(buildOrgBookingPath(site.orgSlug).length);
  return `${site.baseUrl}${pagePath}`;
}

export interface BookingLinkOptions {
  /** First night, `YYYY-MM-DD`. The dates go in the link only as a pair: both, and the departure after the arrival. */
  checkIn?: string;
  /** Day of the departure, `YYYY-MM-DD`. */
  checkOut?: string;
  /** All the people, children included; left out of the link when it is missing or is not a number from 1 to 99. */
  guests?: number;
  /** The language the page opens in (`?lang=`); left out, the page keeps the guest's own. */
  language?: AppLocale;
  /** What the agency calls the campaign, as typed: it goes in as `campaignLabelToken` of it, and not at all when nothing is left. */
  campaign?: string;
}

/**
 * The link an agency copies for a home: the page of the home on the address of the site, with the stay it chose (dates, guests), the language and where the guest
 * comes from (`utm_source=agency-site&utm_medium=link`, and `utm_campaign` when it named one). No personal data in it, whatever was typed.
 */
export function buildAgencyBookingLink(site: BookingSite, property: PropertyRef, options: BookingLinkOptions = {}): string {
  const query = new URLSearchParams();

  const { checkIn = '', checkOut = '', guests, language, campaign = '' } = options;
  if (isStayDate(checkIn) && isStayDate(checkOut) && checkOut > checkIn) {
    query.set(BOOKING_QUERY_KEYS.checkIn, checkIn);
    query.set(BOOKING_QUERY_KEYS.checkOut, checkOut);
  }
  if (guests !== undefined && Number.isInteger(guests) && guests >= 1 && guests <= 99) query.set(BOOKING_QUERY_KEYS.guests, String(guests));
  if (language) query.set(SITE_LANGUAGE_QUERY_KEY, language);

  query.set(ATTRIBUTION_PARAMS.source, AGENCY_LINK_SOURCE);
  query.set(ATTRIBUTION_PARAMS.medium, AGENCY_LINK_MEDIUM);
  const token = campaignLabelToken(campaign);
  if (token) query.set(ATTRIBUTION_PARAMS.campaign, token);

  return `${propertySiteUrl(site, property)}?${query.toString()}`;
}

/** The `utm_*` of an address that are values the booking keeps, as `[field, value]`; the others are left out, as the API leaves them out. */
function readLinkAttribution(search: URLSearchParams): [AttributionField, string][] {
  return ATTRIBUTION_FIELDS.flatMap((field): [AttributionField, string][] => {
    const token = utmToken(search.get(ATTRIBUTION_PARAMS[field]), MAX_LENGTH[field]);
    return token ? [[field, token]] : [];
  });
}

/**
 * `href` (a path, with or without a query) with where the guest comes from, as the address `search` says it, written in it: how the source of a link follows a stay
 * from the page of a home to its checkout. Only the three `utm_*` that pass `utmToken` go, whatever else the address has; nothing is stored on the device.
 */
export function carryLinkAttribution(href: string, search: URLSearchParams): string {
  const found = readLinkAttribution(search);
  if (found.length === 0) return href;

  const path = parsePath(href);
  const query = new URLSearchParams(path.search);
  for (const [field, token] of found) query.set(ATTRIBUTION_PARAMS[field], token);
  return createPath({ ...path, search: query.toString() });
}

/** What the URL parser writes for any address of an IPv4 host (`192.168.1.5`). */
const IPV4_HOST = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/**
 * The host of a referrer the API keeps (`SignupAttributionRules.ReferrerHostOf`): the name of a site on the internet, so with a dot in it and not an IP address. A machine of a
 * private network (`mario-pc`, `192.168.1.5`, `localhost`) may be named after a person: the API drops it, so it is not even sent.
 */
function isReferrerHostOnTheInternet(host: string): boolean {
  return host.includes('.') && !IPV4_HOST.test(host);
}

/**
 * The attribution a checkout sends with its booking: the `utm_*` of the address (`carryLinkAttribution`) and the host name of the site the guest came from, from the
 * `referrer` of the page (the host only: never the page, its path or its query, and only a host the API keeps). `undefined` when there is none of either, and a referrer of the
 * site itself is none.
 *
 * The site a visitor came from is a fact about the visitor, which the rest of the site keeps only with the consent to statistics (DB-02b, `recordLandingTouch`). So it goes
 * with the booking when the link says where the guest comes from (at least one of the `utm_*` the booking keeps: the agency's link, whose own site is what the host wants to read),
 * or when the visitor allows statistics (`statisticsAllowed`); a visitor who came from a search engine or a social network and refused them sends no referrer.
 */
export function bookingAttributionOf(search: URLSearchParams, referrer: string, appOrigin: string, statisticsAllowed: boolean): DirectBookingAttributionPayload | undefined {
  const attribution: DirectBookingAttributionPayload = {};
  const fromLink = readLinkAttribution(search);
  for (const [field, token] of fromLink) attribution[field] = token;
  if (fromLink.length > 0 || statisticsAllowed) {
    const host = externalReferrerHost(referrer, appOrigin);
    if (host && isReferrerHostOnTheInternet(host)) attribution.referrer = host;
  }
  return Object.keys(attribution).length > 0 ? attribution : undefined;
}
