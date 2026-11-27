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

/** What a link inside the frame needs to know about it: where the widgets start, the page that frames them and the language. */
type EmbedLinkContext = Pick<EmbedContextValue, 'embedBase' | 'parentOrigin' | 'lang'>;

/** The parameters that belong to the frame itself: written by `embedHref`, never taken from the query it is given. */
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

/** The longest campaign the booking keeps (`BookingAttribution.MaxCampaignLength`). */
const MAX_CAMPAIGN_LENGTH = 80;

/** The parameter the page of a home reads to know where the guest came from inside the frame, and the value the cards of the booking widget write. */
export const EMBED_FROM_QUERY_KEY = 'from';
export const EMBED_FROM_BOOKING = 'booking';

/** The parameter that names the campaign of the page that framed the widget (the loader copies the `utm_*` of its page into the address of the frame). */
const CAMPAIGN_QUERY_KEY = 'utm_campaign';

/**
 * The campaign of the address of a frame as the booking keeps it: a plain token or nothing (`utmToken` drops an e-mail, a phone number, a fiscal
 * code and anything longer than the booking keeps). It is the one parameter of the page that goes on from widget to widget and to the checkout.
 */
export function embedCampaignOf(address: string | URLSearchParams): string {
  const search = typeof address === 'string' ? new URLSearchParams(address) : address;
  return utmToken(search.get(CAMPAIGN_QUERY_KEY), MAX_CAMPAIGN_LENGTH);
}

/** The stay as the address of the frame writes it: only when both dates are chosen (the guest never chooses them twice, but a half stay is no stay). */
function stayQuery(stay: Partial<StayState> | null | undefined): URLSearchParams {
  return stay?.checkIn && stay.checkOut ? writeStay(new URLSearchParams(), stay) : new URLSearchParams();
}

interface EmbedLinkOptions {
  /** The stay the guest chose: it goes in the address only when both dates are chosen. */
  stay?: Partial<StayState> | null;
  /** The campaign of the address of the frame, as found (see `embedCampaignOf`): checked again here. */
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

  // The segment is encoded: a slug that came from the server must not be able to add a segment of its own.
  const segment = encodeURIComponent(property.slug?.trim() || property.id);
  return embedHref(embed, `/property/${segment}`, query);
}

/** Where «Back to results» of the property widget leads when the guest did not come from inside the frame: the booking widget with the same stay. */
export function embedBookingHref(embed: EmbedLinkContext, { stay, campaign }: EmbedLinkOptions = {}): string {
  const query = stayQuery(stay);
  const token = utmToken(campaign, MAX_CAMPAIGN_LENGTH);
  if (token) query.set(CAMPAIGN_QUERY_KEY, token);
  return embedHref(embed, '/booking', query);
}

interface EmbedSiteUrlInput {
  /** The origin of the site that takes the booking: the one of the frame (`window.location.origin`), the agency's own domain or CasaZen's. */
  origin: string;
  hostMode: EmbedHostMode;
  orgSlug: string;
  property: { id: string; slug?: string | null };
  /** The stay the guest chose: dates, adults, children, pets. */
  stay: Partial<StayState>;
  lang: AppLocale;
  /** The campaign of the page that framed the widget (`utm_campaign` of the address of the frame), as found: it is checked here and dropped when it is not a plain name. */
  campaign?: string | null;
}

/**
 * A page of the booking site of the org about one home, as the whole page opens it: the property page or its checkout. On the agency's own domain it
 * is `/property/<slug>[/checkout]`, on the CasaZen domain `/book/<org>/property/<slug>[/checkout]`, with the stay (`checkin`, `checkout`, `guests`,
 * `children`, `pets`), the language and where the guest comes from: `utm_source=agency-site`, `utm_medium=embed` and, when the page had one that is
 * a plain token, `utm_campaign`. Nothing else of the page is copied, and no address of the guest's can get in through the campaign (`utmToken` drops
 * an e-mail, a phone number, a fiscal code).
 */
function buildEmbedSiteUrl({ origin, hostMode, orgSlug, property, stay, lang, campaign }: EmbedSiteUrlInput, page: 'property' | 'checkout'): string {
  // The segments are encoded: a slug that came from an address must not be able to add a segment of its own.
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

/**
 * The page of the home on the booking site, for what the frame does not do («Open on the site»): the whole page opens it, with the same stay,
 * language and attribution as the checkout.
 */
export function buildEmbedPropertyUrl(input: EmbedSiteUrlInput): string {
  return buildEmbedSiteUrl(input, 'property');
}

interface EmbedGuestAreaInput {
  /** The origin of the frame: the agency's own domain or CasaZen's. */
  origin: string;
  hostMode: EmbedHostMode;
  orgSlug: string;
}

/** The page where a guest manages a booking (`/my-bookings` on the agency's own domain, `/book/<org>/my-bookings` on the CasaZen one), with nothing in its query. */
export function buildEmbedGuestAreaAddress({ origin, hostMode, orgSlug }: EmbedGuestAreaInput): string {
  // The page is written first, with no query: `toHostPath` only knows a path.
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
