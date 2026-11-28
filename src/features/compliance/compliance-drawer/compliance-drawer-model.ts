import type { TFunction } from 'i18next';
import { isAxiosError } from 'axios';
import { getHttpStatus, getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { safeReturnTo } from '@/lib/auth-return-to';
import type { ComplianceSummaryItem } from '@/types/compliance.types';
import type { ComplianceHandoffRequest, ComplianceHandoffTopic } from '@/types/compliance-handoff.types';

export const COMPLIANCE_PAGE_PATH = '/app/short-rent/compliance';

const MAX_RETURN_PATH_LENGTH = 1024;

const APP_PATH_PREFIX = '/app/';

export interface ComplianceDrawerTarget {
  topic: ComplianceHandoffTopic;
  propertyId?: string | null;
  bookingId?: string | null;
  period?: string | null;
}

export type ResolvedComplianceDrawerTarget = ComplianceDrawerTarget & { propertyId: string };

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

export function returnRouteOf(location: { pathname: string; search: string }): { route: string; filters: string } {
  if (isRelativeAppRoute(`${location.pathname}${location.search}`)) return { route: location.pathname, filters: location.search };
  if (isRelativeAppRoute(location.pathname)) return { route: location.pathname, filters: '' };
  return { route: COMPLIANCE_PAGE_PATH, filters: '' };
}

export function handoffRequestOf(target: ResolvedComplianceDrawerTarget, returnRoute: { route: string; filters: string }): ComplianceHandoffRequest {
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
  return [target.topic, target.propertyId ?? '', target.bookingId ?? '', target.period ?? ''].join(':');
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * The target of the button of a row of the cockpit, or `undefined` when the row has none. The server decides which rows offer the check: it sends
 * the topic (`handoffTopic`) only where the outcome is held by the connected area and CasaZen has no proof of it, so a row without one (a
 * communication never sent, a failure CasaZen knows, a month the host sends by hand) has no button, and the client never works the topic out from the
 * name of the action. An Alloggiati item names the stay, and its property only if the summary says it (it names none on a stay: the button reads it
 * from the booking when it is pressed); an ISTAT item is the property's own (its id is the property) with its month. The row's own button still
 * leads to its page, where the host can do the check by hand.
 */
export function drawerTargetOf(item: Pick<ComplianceSummaryItem, 'id' | 'bookingId' | 'propertyId' | 'period' | 'handoffTopic'>): ComplianceDrawerTarget | undefined {
  if (item.handoffTopic === 'Alloggiati') {
    return item.bookingId ? { topic: 'Alloggiati', propertyId: item.propertyId, bookingId: item.bookingId } : undefined;
  }
  if (item.handoffTopic === 'Istat') {
    const propertyId = item.propertyId ?? item.id;
    return propertyId && item.period && MONTH.test(item.period) ? { topic: 'Istat', propertyId, period: item.period } : undefined;
  }
  return undefined;
}

export class UnusableDestinationError extends Error {
  constructor() {
    super('The destination of the handoff is not an https address');
    this.name = 'UnusableDestinationError';
  }
}

export class UnknownPropertyError extends Error {
  constructor() {
    super('The property of the stay is not known');
    this.name = 'UnknownPropertyError';
  }
}

export interface DrawerFailure {
  message: string;
  retryable: boolean;
}

export function describeFailure(error: unknown, t: TFunction): DrawerFailure {
  if (error instanceof UnusableDestinationError) return { message: t('compliance.drawer.error.destination'), retryable: true };
  if (error instanceof UnknownPropertyError) return { message: t('compliance.drawer.error.notFound'), retryable: false };

  const status = getHttpStatus(error);
  if (status === 404) return { message: t('compliance.drawer.error.notFound'), retryable: false };

  const code = isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
  const message = getProblemMessage(error, t) ?? t('compliance.drawer.error.generic');
  return { message, retryable: status !== 403 && code !== 'octorate_handoff_property_not_mapped' };
}
