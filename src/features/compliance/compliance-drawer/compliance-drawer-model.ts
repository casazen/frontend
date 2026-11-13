import type { TFunction } from 'i18next';
import { isAxiosError } from 'axios';
import { getHttpStatus, getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { safeReturnTo } from '@/lib/auth-return-to';
import type { ComplianceSummaryItem } from '@/types/compliance.types';
import type { ComplianceHandoffRequest, ComplianceHandoffTopic } from '@/types/compliance-handoff.types';

/** The page of the adempimenti: where a route that cannot be said to the server falls back to. */
export const COMPLIANCE_PAGE_PATH = '/app/short-rent/compliance';

/** The longest route (path and query) the server accepts; a longer one is cut down to its path. */
const MAX_RETURN_PATH_LENGTH = 1024;

const APP_PATH_PREFIX = '/app/';

/**
 * What a «Verifica nel tuo Cassetto Compliance» button is about: the property, the stay when it starts from a booking, the period when it
 * is about one. The names the dialog shows come from the server's answer, never from here.
 */
export interface ComplianceDrawerTarget {
  topic: ComplianceHandoffTopic;
  propertyId: string;
  bookingId?: string | null;
  /** `yyyy-MM` or `yyyy-MM-dd`. */
  period?: string | null;
}

/**
 * True for a page of this app, written as a relative route: a single leading `/`, under `/app/` once the path is normalised (`/app/../login`
 * is outside the app), no backslash, no space or control character, no `://`, at most 1024 long. It is the rule the server holds the route
 * to, plus «only a page of the app»: an address with a scheme or a host is never a route.
 */
export function isRelativeAppRoute(value: unknown): value is string {
  const route = safeReturnTo(value);
  if (route === null || !route.startsWith(APP_PATH_PREFIX) || route.length > MAX_RETURN_PATH_LENGTH) return false;
  if (/\s/.test(route) || route.includes('://')) return false;
  try {
    return new URL(route, window.location.origin).pathname.startsWith(APP_PATH_PREFIX);
  } catch {
    return false;
  }
}

/**
 * The route the host comes from, split into the page and its filters (the query string), as the server and the tab keep it. A route that is
 * too long, or holds a character the server refuses, is cut down to the page; one that is not a page of the app falls back to the adempimenti.
 */
export function returnRouteOf(location: { pathname: string; search: string }): { route: string; filters: string } {
  if (isRelativeAppRoute(`${location.pathname}${location.search}`)) return { route: location.pathname, filters: location.search };
  if (isRelativeAppRoute(location.pathname)) return { route: location.pathname, filters: '' };
  return { route: COMPLIANCE_PAGE_PATH, filters: '' };
}

/** The request for the server: what the button is about and the route to come back to. There is no address in it. */
export function handoffRequestOf(target: ComplianceDrawerTarget, returnRoute: { route: string; filters: string }): ComplianceHandoffRequest {
  return {
    topic: target.topic,
    propertyId: target.propertyId,
    bookingId: target.bookingId ?? null,
    period: target.period ?? null,
    returnPath: `${returnRoute.route}${returnRoute.filters}`,
  };
}

/**
 * Which control started the handoff, so that the one that did can take the focus back (ids and the topic only: no name, no outcome).
 * The same target is the same key, on whatever page it is asked from.
 */
export function originKeyOf(target: ComplianceDrawerTarget): string {
  return [target.topic, target.propertyId, target.bookingId ?? '', target.period ?? ''].join(':');
}

/** The actions of the cockpit that are an Alloggiati Web communication of a stay: the ones whose outcome the host goes to check. */
const ALLOGGIATI_ACTIONS: readonly string[] = ['SendAlloggiati', 'ResolveAlloggiatiFailure'];

/**
 * The target of the button of a row of the cockpit, or `undefined` when the row has none: not an Alloggiati communication, or the
 * property is not known (the summary names the stay, and the property only for the properties to activate; the Home's «Da fare» names it for the
 * first stays). The button is never offered for a target the server could not check; the row's own button leads to the stay, where it is.
 */
export function drawerTargetOf(
  item: Pick<ComplianceSummaryItem, 'action' | 'bookingId' | 'propertyId'>,
  stayPropertyId?: string | null,
): ComplianceDrawerTarget | undefined {
  if (!ALLOGGIATI_ACTIONS.includes(item.action) || !item.bookingId) return undefined;
  const propertyId = item.propertyId ?? stayPropertyId;
  return propertyId ? { topic: 'Alloggiati', propertyId, bookingId: item.bookingId } : undefined;
}

/** The address the server gave cannot be opened (it is not an https address): the user stays in CasaZen. */
export class UnusableDestinationError extends Error {
  constructor() {
    super('The destination of the handoff is not an https address');
    this.name = 'UnusableDestinationError';
  }
}

export interface DrawerFailure {
  message: string;
  /** Asking again can change the answer (the connection dropped, the area has no address configured yet). */
  retryable: boolean;
}

/**
 * What the dialog says when the handoff cannot start. A 404 is «not found», whatever the answer carries (the property or the stay is not the
 * caller's, is out of its reach, or the endpoint is off) and asking again does not change it; a property that is not connected is said as that;
 * everything else (the network, the server, an area with no address) is a failure that can be tried again. The code of the answer is translated
 * (`apiErrors.codes.*`); without one a 5xx or a dropped connection gets a sentence of ours, and any other refusal the server's own, as everywhere.
 */
export function describeFailure(error: unknown, t: TFunction): DrawerFailure {
  if (error instanceof UnusableDestinationError) return { message: t('compliance.drawer.error.destination'), retryable: true };

  const status = getHttpStatus(error);
  if (status === 404) return { message: t('compliance.drawer.error.notFound'), retryable: false };

  const code = isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
  const message = getProblemMessage(error, t) ?? t('compliance.drawer.error.generic');
  return { message, retryable: status !== 403 && code !== 'octorate_handoff_property_not_mapped' };
}
