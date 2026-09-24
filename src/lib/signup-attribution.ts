import { isAxiosError } from 'axios';
import { UsersApi } from '@/api/users.api';
import { AuthTokenUnavailableError, isTransientRequestError } from '@/lib/api-errors';
import type { SignupAttribution } from '@/types';

/**
 * Signup attribution (SE-03, A8-03): where a host signup came from, measured per comune.
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

/** Route of the signup entry point (public, opens the Auth0 signup screen). */
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
  /** Set when the first onboarding created the org: only then is the attribution sent. */
  ready: boolean;
}

export const LANDING_TOUCH_STORAGE_KEY = 'cz-landing-touch';
export const PENDING_ATTRIBUTION_STORAGE_KEY = 'cz-signup-attribution';

/** An attribution not sent within 30 days (signup abandoned) is forgotten. */
export const PENDING_ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Same rules as the backend (Casazen.Core/Validation/SignupAttributionRules.cs).
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

/** UTM parameters of a query string; values outside the rules are dropped. */
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

export function validLandingPath(pathname: string | null | undefined): string | undefined {
  return valid(pathname, LANDING_PATH_PATTERN, MAX_LANDING_PATH_LENGTH);
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** Host of a referrer on another site; `undefined` for this site, no referrer or anything else than http(s). */
export function externalReferrerHost(referrer: string, origin: string): string | undefined {
  const url = referrer ? parseUrl(referrer) : null;
  if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:') || url.origin === origin) return undefined;
  return valid(url.hostname.toLowerCase(), REFERRER_HOST_PATTERN, MAX_REFERRER_HOST_LENGTH);
}

/** Path of a referrer on this site (e.g. the SEO page whose CTA was clicked). */
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

/**
 * Records the first page of the visit in this tab (landing path, referrer host, UTM parameters). Called once when the
 * app starts on a public page; later pages of the same visit keep the first touch.
 */
export function recordLandingTouch(location: PageLocation = window.location, referrer = document.referrer): void {
  if (readJson<LandingTouch>(session, LANDING_TOUCH_STORAGE_KEY)) return;
  const touch: LandingTouch = {
    landingPath: validLandingPath(location.pathname),
    referrerHost: externalReferrerHost(referrer, location.origin),
    utm: readUtm(location.search),
  };
  writeJson(session, LANDING_TOUCH_STORAGE_KEY, touch);
}

function readLandingTouch(): LandingTouch | null {
  const touch = readJson<LandingTouch>(session, LANDING_TOUCH_STORAGE_KEY);
  return touch && typeof touch === 'object' ? { ...touch, utm: touch.utm ?? {} } : null;
}

/**
 * Link of the signup CTA of an SEO page: the URL built by the backend (public domain, comune, default UTM
 * parameters) with the UTM parameters of the visit when it has some (the whole set replaces the defaults, so the
 * values stay coherent). A relative URL stays relative.
 */
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

/** The attribution waiting to be sent, if any (expired ones are forgotten). */
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

/** The first onboarding created the org: the attribution may now be sent. */
export function markSignupAttributionReady(now = Date.now()): void {
  const pending = readPending(now);
  if (pending && !pending.ready) {
    writeJson(local, PENDING_ATTRIBUTION_STORAGE_KEY, { ...pending, ready: true } satisfies PendingAttribution);
  }
}

export function discardSignupAttribution(): void {
  remove(local, PENDING_ATTRIBUTION_STORAGE_KEY);
}

/** Only a failure worth retrying keeps the attribution: a refused one (4xx) would be refused again. */
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
 * and signed in), so it is discarded. Never throws.
 */
export async function syncSignupAttribution(now = Date.now()): Promise<SignupAttributionSyncResult> {
  const pending = readPending(now);
  if (!pending) return 'none';
  if (!pending.ready) {
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
