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

export const AGENCY_LINK_SOURCE = 'agency-site';

const AGENCY_LINK_MEDIUM = 'link';

export const EMBED_LINK_MEDIUM = 'embed';

const ATTRIBUTION_PARAMS = { source: 'utm_source', medium: 'utm_medium', campaign: 'utm_campaign' } as const;
type AttributionField = keyof typeof ATTRIBUTION_PARAMS;
const ATTRIBUTION_FIELDS = Object.keys(ATTRIBUTION_PARAMS) as AttributionField[];

const MAX_LENGTH: Record<AttributionField, number> = { source: 40, medium: 40, campaign: 80 };

// The rules of the API for a value of the attribution (`SignupAttributionRules.SanitizeToken`): applied here as well, so that what the host sees in the link is what the
// booking keeps, and no address of the guest's reaches an address of the site.
const MAX_RAW_LENGTH = 2048;
const TOKEN = /^[\p{L}\p{Nd}](?:[\p{L}\p{Nd}._-]*[\p{L}\p{Nd}])?$/u;
const LONG_DIGIT_RUN = /\p{Nd}{9,}/u;
const FISCAL_CODE = /^[a-z]{6}[0-9lmnpqrstuv]{2}[a-z][0-9lmnpqrstuv]{2}[a-z][0-9lmnpqrstuv]{3}[a-z]$/;

export function utmToken(value: string | null | undefined, maxLength: number): string {
  if (value === null || value === undefined || value.length > MAX_RAW_LENGTH) return '';
  const token = value.trim().toLowerCase();
  if (token === '' || token.length > maxLength || !TOKEN.test(token)) return '';
  const bare = token.replace(/[._-]/g, '');
  return LONG_DIGIT_RUN.test(bare) || FISCAL_CODE.test(bare) ? '' : token;
}

export function campaignLabelToken(label: string): string {
  if (label.includes('@')) return '';
  return utmToken(sanitizeCampaign(label).replace(/-+$/, ''), MAX_LENGTH.campaign);
}

export interface BookingSite {
  orgSlug: string;
  baseUrl: string;
  ownHost: boolean;
}

interface BookingSiteInput {
  orgSlug: string;
  publicUrls?: PublicUrls | null;
  appOrigin: string;
}

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

export function resolveBookingSite({ orgSlug, publicUrls, appOrigin }: BookingSiteInput): BookingSite {
  const own = addressOf(publicUrls?.customDomainUrl) ?? addressOf(publicUrls?.subdomainUrl);
  if (own) return { orgSlug, baseUrl: own, ownHost: true };

  const platform = addressOf(publicUrls?.pathUrl, appOrigin) ?? addressOf(buildOrgBookingPath(orgSlug), appOrigin);
  return { orgSlug, baseUrl: platform ?? `${appOrigin}${buildOrgBookingPath(orgSlug)}`, ownHost: false };
}

export function orgSiteUrl(site: BookingSite): string {
  return site.ownHost ? `${site.baseUrl}/` : site.baseUrl;
}

type PropertyRef = { id: string; slug?: string | null };

export function propertySiteUrl(site: BookingSite, property: PropertyRef): string {
  const pagePath = buildPropertyBookingPath(site.orgSlug, property).slice(buildOrgBookingPath(site.orgSlug).length);
  return `${site.baseUrl}${pagePath}`;
}

export interface BookingLinkOptions {
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  language?: AppLocale;
  campaign?: string;
}

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

function readLinkAttribution(search: URLSearchParams): [AttributionField, string][] {
  return ATTRIBUTION_FIELDS.flatMap((field): [AttributionField, string][] => {
    const token = utmToken(search.get(ATTRIBUTION_PARAMS[field]), MAX_LENGTH[field]);
    return token ? [[field, token]] : [];
  });
}

export function carryLinkAttribution(href: string, search: URLSearchParams): string {
  const found = readLinkAttribution(search);
  if (found.length === 0) return href;

  const path = parsePath(href);
  const query = new URLSearchParams(path.search);
  for (const [field, token] of found) query.set(ATTRIBUTION_PARAMS[field], token);
  return createPath({ ...path, search: query.toString() });
}

const IPV4_HOST = /^\d{1,3}(?:\.\d{1,3}){3}$/;

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
