import { isAxiosError } from 'axios';
import { UsersApi } from '@/api/users.api';
import { AuthTokenUnavailableError, isTransientRequestError } from '@/lib/api-errors';
import { hasConsent } from '@/lib/cookie-consent';
import { FISCAL_DOCUMENT_VIEW_PATH_PREFIX } from '@/lib/fiscal-document-link';
import { HOST_INVITE_PATH_PREFIX } from '@/lib/host-invite';
import { isMarketingLinkPath } from '@/lib/marketing-link-paths';
import type { SignupAttribution } from '@/types';

/**
 * Signup attribution (SE-03, A8-03): where a host signup came from, measured per comune.
 *
 * It is a statistic about the visitor, so **nothing of it is stored or sent until the visitor allows statistics** (DB-02b,
 * `hasConsent('statistics')`): without the consent the touch of the first page is only held in memory, `/signup` stores nothing and
 * a waiting attribution is forgotten instead of sent; withdrawing the consent forgets what was kept.
 *
 * 1. The first public page of a visit records a landing "touch" (path, referrer host, UTM parameters) for this tab.
 * 2. The CTA of the SEO pages opens `/signup` with the comune and the UTM parameters of the visit.
 * 3. `/signup` stores the attribution (localStorage, 30 days: it must survive the Auth0 signup, the email check and a
 *    later return) and opens the Auth0 signup screen.
 * 4. After the first onboarding (the org is created) the attribution is sent to the backend, which keeps only the
 *    first one per org. An account that was already onboarded when it came through `/signup` sends nothing.
 *
 * Only marketing values, never personal data. The rules are the backend's (`SignupAttributionRules`): a value outside
 * them is dropped here, so the backend refuses nothing in practice.
 */

export const SIGNUP_PATH = '/signup';

export const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
export type UtmParam = (typeof UTM_PARAMS)[number];
export type UtmValues = Partial<Record<UtmParam, string>>;

interface LandingTouch {
  landingPath?: string;
  referrerHost?: string;
  utm: UtmValues;
}

interface PendingAttribution {
  attribution: SignupAttribution;
  capturedAt: number;
  ready: boolean;
}

export const LANDING_TOUCH_STORAGE_KEY = 'cz-landing-touch';
export const PENDING_ATTRIBUTION_STORAGE_KEY = 'cz-signup-attribution';

export const PENDING_ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const MAX_UTM_LENGTH = 100;
const UTM_PATTERN = /^[\p{L}\p{N} ._~+|:,/()!-]+$/u;
const MAX_COMUNE_LENGTH = 100;
const COMUNE_PATTERN = /^(?:[0-9]{6}|[a-z0-9]+(?:-[a-z0-9]+)*)$/;
const MAX_LANDING_PATH_LENGTH = 200;
const LANDING_PATH_PATTERN = /^\/[A-Za-z0-9/._~-]*$/;
const MAX_REFERRER_HOST_LENGTH = 253;
const REFERRER_HOST_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/;

const UTM_FIELDS: Record<UtmParam, keyof SignupAttribution> = {
  utm_source: 'utmSource',
  utm_medium: 'utmMedium',
  utm_campaign: 'utmCampaign',
  utm_term: 'utmTerm',
  utm_content: 'utmContent',
};

function valid(value: string | null | undefined, pattern: RegExp, maxLength: number): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length <= maxLength && pattern.test(trimmed) ? trimmed : undefined;
}

export function readUtm(search: string): UtmValues {
  const params = new URLSearchParams(search);
  const utm: UtmValues = {};
  for (const name of UTM_PARAMS) {
    const value = valid(params.get(name), UTM_PATTERN, MAX_UTM_LENGTH);
    if (value) utm[name] = value;
  }
  return utm;
}

function hasUtm(utm: UtmValues): boolean {
  return UTM_PARAMS.some((name) => utm[name] !== undefined);
}

export function validComune(value: string | null | undefined): string | undefined {
  return valid(value?.toLowerCase(), COMUNE_PATTERN, MAX_COMUNE_LENGTH);
}

function isStayLinkPath(pathname: string | null | undefined): boolean {
  return Boolean(pathname?.startsWith('/s/') || pathname?.startsWith('/checkin/stay_'));
}

export function validLandingPath(pathname: string | null | undefined): string | undefined {
  // The address of an invite link carries its secret token: never part of an attribution.
  if (isStayLinkPath(pathname) || pathname?.startsWith(HOST_INVITE_PATH_PREFIX)) return undefined;
  if (pathname?.startsWith(FISCAL_DOCUMENT_VIEW_PATH_PREFIX)) return undefined;
  return valid(pathname, LANDING_PATH_PATTERN, MAX_LANDING_PATH_LENGTH);
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function externalReferrerHost(referrer: string, origin: string): string | undefined {
  const url = referrer ? parseUrl(referrer) : null;
  if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:') || url.origin === origin) return undefined;
  return valid(url.hostname.toLowerCase(), REFERRER_HOST_PATTERN, MAX_REFERRER_HOST_LENGTH);
}

function sameSiteReferrerPath(referrer: string, origin: string): string | undefined {
  const url = referrer ? parseUrl(referrer) : null;
  return url && url.origin === origin ? validLandingPath(url.pathname) : undefined;
}

function readJson<T>(storage: () => Storage, key: string): T | null {
  try {
    const raw = storage().getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(storage: () => Storage, key: string, value: unknown): void {
  try {
    storage().setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode, quota): the attribution is lost, the signup is not.
  }
}

function remove(storage: () => Storage, key: string): void {
  try {
    storage().removeItem(key);
  } catch {
    // Nothing stored.
  }
}

const session = () => window.sessionStorage;
const local = () => window.localStorage;

interface PageLocation {
  pathname: string;
  search: string;
  origin: string;
}

let deferredTouch: LandingTouch | null = null;

/**
 * Records the first page of the visit in this tab (landing path, referrer host, UTM parameters). Called once when the
 * app starts on a public page; later pages of the same visit keep the first touch. Stored only when the visitor allows
 * statistics; before that it is held in memory (`keepDeferredLandingTouch` stores it the moment they do, so that a visitor who
 * accepts on the second page still counts for the page they came in by).
 */
export function recordLandingTouch(location: PageLocation = window.location, referrer = document.referrer): void {
  if (isStayLinkPath(location.pathname) || isMarketingLinkPath(location.pathname)) return;
  if (location.pathname.startsWith(FISCAL_DOCUMENT_VIEW_PATH_PREFIX)) return;
  if (readJson<LandingTouch>(session, LANDING_TOUCH_STORAGE_KEY)) return;
  const touch: LandingTouch = {
    landingPath: validLandingPath(location.pathname),
    referrerHost: externalReferrerHost(referrer, location.origin),
    utm: readUtm(location.search),
  };
  if (hasConsent('statistics')) writeJson(session, LANDING_TOUCH_STORAGE_KEY, touch);
  else deferredTouch ??= touch;
}

export function keepDeferredLandingTouch(): void {
  if (deferredTouch && !readJson<LandingTouch>(session, LANDING_TOUCH_STORAGE_KEY)) {
    writeJson(session, LANDING_TOUCH_STORAGE_KEY, deferredTouch);
  }
  deferredTouch = null;
}

export function forgetVisitMarketing(): void {
  deferredTouch = null;
  remove(session, LANDING_TOUCH_STORAGE_KEY);
  discardSignupAttribution();
}

/**
 * The marketing values of the current visit, for the SEO funnel events (SE-04): the UTM parameters of the page when it
 * has some, else those of the first page of the visit; the host of the site the visitor came from (the first page's,
 * or this page's when it is the first). Only values that pass the rules, never a URL or a path.
 */
export function readVisitMarketing(
  location: Pick<PageLocation, 'search' | 'origin'> = window.location,
  referrer = document.referrer,
): { utm: UtmValues; referrerHost?: string } {
  const current = readUtm(location.search);
  const touch = readLandingTouch();
  const utm = hasUtm(current) ? current : (touch?.utm ?? {});
  const referrerHost = touch?.referrerHost ?? externalReferrerHost(referrer, location.origin);
  return referrerHost ? { utm, referrerHost } : { utm };
}

function readLandingTouch(): LandingTouch | null {
  const touch = readJson<LandingTouch>(session, LANDING_TOUCH_STORAGE_KEY);
  return touch && typeof touch === 'object' ? { ...touch, utm: touch.utm ?? {} } : null;
}

export function buildSignupCtaHref(signupUrl: string, location: Pick<PageLocation, 'search' | 'origin'> = window.location): string {
  let url: URL;
  try {
    url = new URL(signupUrl, location.origin);
  } catch {
    return signupUrl;
  }

  const current = readUtm(location.search);
  const visitUtm = hasUtm(current) ? current : (readLandingTouch()?.utm ?? {});
  if (hasUtm(visitUtm)) {
    for (const name of UTM_PARAMS) {
      url.searchParams.delete(name);
      const value = visitUtm[name];
      if (value) url.searchParams.set(name, value);
    }
  }

  const absolute = /^https?:\/\//i.test(signupUrl);
  return absolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
}

function readPending(now: number): PendingAttribution | null {
  const pending = readJson<PendingAttribution>(local, PENDING_ATTRIBUTION_STORAGE_KEY);
  if (!pending || typeof pending !== 'object' || typeof pending.capturedAt !== 'number' || !pending.attribution) {
    if (pending) remove(local, PENDING_ATTRIBUTION_STORAGE_KEY);
    return null;
  }
  if (now - pending.capturedAt > PENDING_ATTRIBUTION_TTL_MS || now < pending.capturedAt) {
    remove(local, PENDING_ATTRIBUTION_STORAGE_KEY);
    return null;
  }
  return pending;
}

export function readPendingSignupAttribution(now = Date.now()): SignupAttribution | null {
  return readPending(now)?.attribution ?? null;
}

/**
 * Stores the attribution of a `/signup` visit: UTM parameters and comune of its URL, landing path and referrer host of
 * the first page of the visit (or of the page that linked `/signup`). A newer signup visit replaces one not sent yet,
 * never one already waiting to be sent after the onboarding.
 */
export function captureSignupAttribution(
  location: PageLocation = window.location,
  referrer = document.referrer,
  now = Date.now(),
): SignupAttribution {
  if (!hasConsent('statistics')) return {};

  const params = new URLSearchParams(location.search);
  const touch = readLandingTouch();
  const utm = readUtm(location.search);

  const attribution: SignupAttribution = {};
  for (const name of UTM_PARAMS) {
    const value = utm[name];
    if (value) attribution[UTM_FIELDS[name]] = value;
  }
  const comune = validComune(params.get('comune'));
  if (comune) attribution.comune = comune;

  const landingPath =
    touch?.landingPath ?? sameSiteReferrerPath(referrer, location.origin) ?? validLandingPath(location.pathname);
  if (landingPath) attribution.landingPath = landingPath;
  const referrerHost = touch?.referrerHost ?? externalReferrerHost(referrer, location.origin);
  if (referrerHost) attribution.referrerHost = referrerHost;

  const existing = readPending(now);
  if (existing?.ready) return existing.attribution;

  writeJson(local, PENDING_ATTRIBUTION_STORAGE_KEY, { attribution, capturedAt: now, ready: false } satisfies PendingAttribution);
  return attribution;
}

export function markSignupAttributionReady(now = Date.now()): void {
  const pending = readPending(now);
  if (pending && !pending.ready) {
    writeJson(local, PENDING_ATTRIBUTION_STORAGE_KEY, { ...pending, ready: true } satisfies PendingAttribution);
  }
}

export function discardSignupAttribution(): void {
  remove(local, PENDING_ATTRIBUTION_STORAGE_KEY);
}

function keepForRetry(error: unknown): boolean {
  if (error instanceof AuthTokenUnavailableError) return true;
  if (isAxiosError(error) && error.response) {
    const { status } = error.response;
    return status === 401 || status === 429 || isTransientRequestError(error);
  }
  return true;
}

export type SignupAttributionSyncResult = 'none' | 'sent' | 'discarded' | 'kept';

/**
 * Sends the attribution once the first onboarding created the org. `onboarded`: the user passed the onboarding guard;
 * a pending attribution that is not ready then belongs to an account that already existed (it came through `/signup`
 * and signed in), so it is discarded; so is one that waits while the visitor does not allow statistics (it is never sent
 * without that). Never throws.
 */
export async function syncSignupAttribution(now = Date.now()): Promise<SignupAttributionSyncResult> {
  const pending = readPending(now);
  if (!pending) return 'none';
  if (!pending.ready || !hasConsent('statistics')) {
    discardSignupAttribution();
    return 'discarded';
  }

  try {
    await UsersApi.recordSignupAttribution(pending.attribution);
  } catch (error) {
    if (keepForRetry(error)) return 'kept';
    discardSignupAttribution();
    return 'discarded';
  }
  discardSignupAttribution();
  return 'sent';
}
