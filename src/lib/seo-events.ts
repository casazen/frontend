import { analyticsConfig } from '@/config/analytics.config';
import { env } from '@/config/env.config';
import { PublicSeoApi } from '@/api/public-seo.api';
import { readVisitMarketing, validComune } from '@/lib/signup-attribution';
import type { SeoEventName, SeoEventPayload } from '@/types/seo.types';

declare global {
  interface Window {
    /** Plausible's tracking function, present only when its script was added to the site. */
    plausible?: (event: string, options?: { props?: Record<string, string> }) => void;
  }
}

/** Where the events go: the API of the app (the same base URL as every request). */
const EVENTS_PATH = '/public/seo/events';

/**
 * Body of a funnel event, or `null` when the comune is not a valid one (the event is then not sent): the event, the
 * comune of the page and the marketing values of the visit. No personal data: the rules are those of the signup
 * attribution, and the backend stores nothing else (no IP, no user, no visitor id).
 */
export function buildSeoEventPayload(
  event: SeoEventName,
  comune: string | null | undefined,
  location: Pick<Location, 'search' | 'origin'> = window.location,
  referrer = document.referrer,
): SeoEventPayload | null {
  const comuneSlug = validComune(comune);
  if (!comuneSlug) return null;

  const { utm, referrerHost } = readVisitMarketing(location, referrer);
  return {
    event,
    comuneSlug,
    ...(utm.utm_source ? { utmSource: utm.utm_source } : {}),
    ...(utm.utm_medium ? { utmMedium: utm.utm_medium } : {}),
    ...(utm.utm_campaign ? { utmCampaign: utm.utm_campaign } : {}),
    ...(referrerHost ? { referrerHost } : {}),
  };
}

function sendWithBeacon(payload: SeoEventPayload): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return false;
  try {
    // A beacon survives the page unload: the CTA link opens another page right after the click.
    const body = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    return navigator.sendBeacon(`${env.api.baseUrl}${EVENTS_PATH}`, body);
  } catch {
    return false;
  }
}

function sendToPlausible(payload: SeoEventPayload): void {
  if (!analyticsConfig.plausibleDomain || typeof window.plausible !== 'function') return;
  try {
    window.plausible(payload.event, { props: { comune: payload.comuneSlug } });
  } catch {
    // A failing third-party script never breaks the page.
  }
}

/**
 * Sends one event of the SEO funnel (#300 AC3, AC8). Fire and forget: analytics never delays or breaks the click, so a
 * failure (offline, blocked, refused by the rate limit) is not shown to the visitor; the call returns whether an event
 * was sent. `navigator.sendBeacon` first, a plain public request when the browser has none or refuses the beacon.
 */
export function trackSeoEvent(
  event: SeoEventName,
  comune: string | null | undefined,
  location?: Pick<Location, 'search' | 'origin'>,
  referrer?: string,
): boolean {
  const payload = buildSeoEventPayload(event, comune, location, referrer);
  if (!payload) return false;

  if (!sendWithBeacon(payload)) void PublicSeoApi.trackEvent(payload).catch(() => undefined);
  sendToPlausible(payload);
  return true;
}
