import { EMBED_PROTOCOL_VERSION } from '@/embed/protocol';
import { writeStay, type StayState } from '@/features/public-site/stay/stay-state';
import type { AppLocale } from '@/i18n/locale-storage';
import { AGENCY_LINK_SOURCE, EMBED_LINK_MEDIUM, utmToken } from '@/lib/booking-link';
import { buildPropertyCheckoutPath } from '@/lib/booking-url';
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

/** The parameters that belong to the frame itself: written by `embedHref`, never taken from the query it is given. */
const FRAME_PARAMS: readonly string[] = [SITE_LANGUAGE_QUERY_KEY, EMBED_PARENT_QUERY_KEY, EMBED_VERSION_QUERY_KEY];

/**
 * The address of a page of the frame, for the links inside it. `path` is relative to the base of the widgets (`/property/casa-mare`, the same
 * path the `url` message reports) and `query` is what the guest chose (the stay, filters). The language, the parent and the version are always
 * kept (a reload of the frame still knows its page, and a page opened on its own still names the one that framed it): they are written from `embed`,
 * whatever the query says. `undefined` and `null` values are left out.
 */
export function embedHref(embed: Pick<EmbedContextValue, 'embedBase' | 'parentOrigin' | 'lang'>, path: string, query: EmbedQuery = {}): string {
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

interface EmbedCheckoutInput {
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
 * The address of the checkout the guest is taken to when they choose «Book»: the whole page navigates there, never the frame (a payment is not
 * made inside a frame). On the agency's own domain it is `/property/<slug>/checkout`, on the CasaZen domain `/book/<org>/property/<slug>/checkout`,
 * with the stay (`checkin`, `checkout`, `guests`, `children`, `pets`), the language and where the guest comes from: `utm_source=agency-site`,
 * `utm_medium=embed` and, when the page had one that is a plain token, `utm_campaign`. Nothing else of the page is copied, and no address of
 * the guest's can get in through the campaign (`utmToken` drops an e-mail, a phone number, a fiscal code). The site the guest comes from is not
 * written here: the top window leaves that page for this one, so the referrer of the checkout is the page, and the booking keeps its host.
 */
export function buildEmbedCheckoutUrl({ origin, hostMode, orgSlug, property, stay, lang, campaign }: EmbedCheckoutInput): string {
  // The segments are encoded: a slug that came from an address must not be able to add a segment of its own.
  const slug = property.slug?.trim();
  const encodedProperty = { id: encodeURIComponent(property.id), slug: slug ? encodeURIComponent(slug) : null };
  const appPath = buildPropertyCheckoutPath(encodeURIComponent(orgSlug), encodedProperty);
  const path = hostMode === 'host' ? toHostPath(appPath, orgSlug) : appPath;

  const query = writeStay(new URLSearchParams(), stay);
  query.set(SITE_LANGUAGE_QUERY_KEY, lang);
  query.set('utm_source', AGENCY_LINK_SOURCE);
  query.set('utm_medium', EMBED_LINK_MEDIUM);
  const token = utmToken(campaign, MAX_CAMPAIGN_LENGTH);
  if (token) query.set('utm_campaign', token);

  return new URL(`${path}?${query.toString()}`, origin).toString();
}
