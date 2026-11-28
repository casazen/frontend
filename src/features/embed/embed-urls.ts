import { EMBED_PROTOCOL_VERSION } from '@/embed/protocol';
import { writeStay, type StayState } from '@/features/public-site/stay/stay-state';
import type { AppLocale } from '@/i18n/locale-storage';
import { AGENCY_LINK_SOURCE, EMBED_LINK_MEDIUM, utmToken } from '@/lib/booking-link';
import { buildGuestBookingsPath, buildPropertyBookingPath, buildPropertyCheckoutPath } from '@/lib/booking-url';
import { SITE_LANGUAGE_QUERY_KEY } from '@/lib/site-language';
import { toHostPath } from '@/routes/host-site-window';
import { EMBED_PARENT_QUERY_KEY, EMBED_VERSION_QUERY_KEY, type EmbedContextValue, type EmbedHostMode } from '@/features/embed/embed-context';

/**
 * The addresses a widget writes (NF-144, NF-145): the links inside the frame, which must still know their page when the frame is reloaded, and the
 * link out of it, to the checkout, which takes the whole page and carries where the guest came from. Pure: nothing is read from the page and
 * nothing is stored.
 */

type QueryValue = string | number | boolean | null | undefined;
type EmbedQuery = URLSearchParams | Record<string, QueryValue>;

type EmbedLinkContext = Pick<EmbedContextValue, 'embedBase' | 'parentOrigin' | 'lang'>;

const FRAME_PARAMS: readonly string[] = [SITE_LANGUAGE_QUERY_KEY, EMBED_PARENT_QUERY_KEY, EMBED_VERSION_QUERY_KEY];

/**
 * The address of a page of the frame, for the links inside it. `path` is relative to the base of the widgets (`/property/casa-mare`, the same
 * path the `url` message reports) and `query` is what the guest chose (the stay, filters). The language, the parent and the version are always
 * kept (a reload of the frame still knows its page, and a page opened on its own still names the one that framed it): they are written from `embed`,
 * whatever the query says. `undefined` and `null` values are left out.
 */
export function embedHref(embed: EmbedLinkContext, path: string, query: EmbedQuery = {}): string {
  const params = new URLSearchParams();
  const entries: [string, QueryValue][] = query instanceof URLSearchParams ? [...query.entries()] : Object.entries(query);
  for (const [key, value] of entries) {
    if (value === null || value === undefined || FRAME_PARAMS.includes(key)) continue;
    params.append(key, String(value));
  }
  params.set(SITE_LANGUAGE_QUERY_KEY, embed.lang);
  if (embed.parentOrigin) params.set(EMBED_PARENT_QUERY_KEY, embed.parentOrigin);
  params.set(EMBED_VERSION_QUERY_KEY, String(EMBED_PROTOCOL_VERSION));

  return `${embed.embedBase}${path.startsWith('/') ? path : `/${path}`}?${params.toString()}`;
}

const MAX_CAMPAIGN_LENGTH = 80;

export const EMBED_FROM_QUERY_KEY = 'from';
export const EMBED_FROM_BOOKING = 'booking';

const CAMPAIGN_QUERY_KEY = 'utm_campaign';

export function embedCampaignOf(address: string | URLSearchParams): string {
  const search = typeof address === 'string' ? new URLSearchParams(address) : address;
  return utmToken(search.get(CAMPAIGN_QUERY_KEY), MAX_CAMPAIGN_LENGTH);
}

function stayQuery(stay: Partial<StayState> | null | undefined): URLSearchParams {
  return stay?.checkIn && stay.checkOut ? writeStay(new URLSearchParams(), stay) : new URLSearchParams();
}

interface EmbedLinkOptions {
  stay?: Partial<StayState> | null;
  campaign?: string | null;
}

/**
 * Where a card or a pin of the booking widget leads: the property widget, in the same frame (`<embedBase>/property/<slug>`), with the stay when
 * dates are chosen, `from=booking` (so the page of the home can offer «Back to results») and the campaign of the page when it is a plain token. It
 * never leads to the booking site: the frame has no other page than the widgets (`embedHref` keeps the language, the parent and the version).
 */
export function embedPropertyHref(embed: EmbedLinkContext, property: { id: string; slug?: string | null }, { stay, campaign }: EmbedLinkOptions = {}): string {
  const query = stayQuery(stay);
  query.set(EMBED_FROM_QUERY_KEY, EMBED_FROM_BOOKING);
  const token = utmToken(campaign, MAX_CAMPAIGN_LENGTH);
  if (token) query.set(CAMPAIGN_QUERY_KEY, token);

  const segment = encodeURIComponent(property.slug?.trim() || property.id);
  return embedHref(embed, `/property/${segment}`, query);
}

export function embedBookingHref(embed: EmbedLinkContext, { stay, campaign }: EmbedLinkOptions = {}): string {
  const query = stayQuery(stay);
  const token = utmToken(campaign, MAX_CAMPAIGN_LENGTH);
  if (token) query.set(CAMPAIGN_QUERY_KEY, token);
  return embedHref(embed, '/booking', query);
}

interface EmbedSiteUrlInput {
  origin: string;
  hostMode: EmbedHostMode;
  orgSlug: string;
  property: { id: string; slug?: string | null };
  stay: Partial<StayState>;
  lang: AppLocale;
  campaign?: string | null;
}

function buildEmbedSiteUrl({ origin, hostMode, orgSlug, property, stay, lang, campaign }: EmbedSiteUrlInput, page: 'property' | 'checkout'): string {
  const slug = property.slug?.trim();
  const encodedProperty = { id: encodeURIComponent(property.id), slug: slug ? encodeURIComponent(slug) : null };
  const buildPath = page === 'checkout' ? buildPropertyCheckoutPath : buildPropertyBookingPath;
  const appPath = buildPath(encodeURIComponent(orgSlug), encodedProperty);
  const path = hostMode === 'host' ? toHostPath(appPath, orgSlug) : appPath;

  const query = writeStay(new URLSearchParams(), stay);
  query.set(SITE_LANGUAGE_QUERY_KEY, lang);
  query.set('utm_source', AGENCY_LINK_SOURCE);
  query.set('utm_medium', EMBED_LINK_MEDIUM);
  const token = utmToken(campaign, MAX_CAMPAIGN_LENGTH);
  if (token) query.set(CAMPAIGN_QUERY_KEY, token);

  return new URL(`${path}?${query.toString()}`, origin).toString();
}

/**
 * The address of the checkout the guest is taken to when they choose «Book»: the whole page navigates there, never the frame (a payment is not
 * made inside a frame). See `buildEmbedSiteUrl` for what it carries. The site the guest comes from is not written here: the top window leaves that
 * page for this one, so the referrer of the checkout is the page, and the booking keeps its host.
 */
export function buildEmbedCheckoutUrl(input: EmbedSiteUrlInput): string {
  return buildEmbedSiteUrl(input, 'checkout');
}

export function buildEmbedPropertyUrl(input: EmbedSiteUrlInput): string {
  return buildEmbedSiteUrl(input, 'property');
}

interface EmbedGuestAreaInput {
  origin: string;
  hostMode: EmbedHostMode;
  orgSlug: string;
}

export function buildEmbedGuestAreaAddress({ origin, hostMode, orgSlug }: EmbedGuestAreaInput): string {
  const appPath = buildGuestBookingsPath(orgSlug);
  const path = hostMode === 'host' ? toHostPath(appPath, orgSlug) : appPath;
  return new URL(path, origin).toString();
}

/**
 * Where the guest is taken to manage a booking: the page of the guest area of the frame's own origin with the booking code and the language, and
 * NOTHING else. The page that opens asks the second proof (the e-mail or the last four digits of the phone) itself, so no credential and no session
 * ever travels through a frame, a message or an address. `code` is the code as the guest area writes it (`XXXXX-XXXXX`).
 */
export function buildEmbedGuestAreaUrl(input: EmbedGuestAreaInput & { code: string; lang: AppLocale }): string {
  const url = new URL(buildEmbedGuestAreaAddress(input));
  url.searchParams.set('code', input.code);
  url.searchParams.set(SITE_LANGUAGE_QUERY_KEY, input.lang);
  return url.toString();
}
