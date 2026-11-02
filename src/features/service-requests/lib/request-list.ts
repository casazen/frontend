import type { ServiceRequest } from '@/types/service-request';
import { isClosedRequest } from '../long-rent/long-rent-request-model';
import { hasReplacement } from './request-history';

/** How many of the closed requests are shown when they are opened. */
export const CLOSED_FIRST = 5;

/** How many more each press of «Mostra altre» adds. */
export const CLOSED_STEP = 10;

export interface RequestGroups {
  /** What the host still follows: the open requests and the refused ones nobody asked again, the nearest job first. */
  toFollow: ServiceRequest[];
  /** What is over: paid, cancelled, or refused and already asked of another supplier. The latest first. */
  closed: ServiceRequest[];
}

export interface LastStep {
  /** When it happened, an ISO instant; `null` when the request carries no date for it. */
  at: string | null;
  /** Who made it: `Host`, `Supplier`, `System`… A word this version does not know is kept as it came. */
  actor: string | null;
}

function timeOf(instant: string | null | undefined): number | null {
  if (!instant) return null;
  const time = Date.parse(instant);
  return Number.isFinite(time) ? time : null;
}

/**
 * The last step a request went through, when and by whom. The history is the server's (oldest first); an answer without it falls back on the
 * dates the request keeps, and the author of a cancellation is the one it names.
 */
export function lastStep(request: ServiceRequest): LastStep {
  const history = request.history ?? [];
  const last = history[history.length - 1];
  if (last) return { at: last.at, actor: last.actor };

  switch (request.status) {
    case 'Annullato':
      return { at: request.cancelledAt ?? request.updatedAt, actor: request.cancelledBy ?? null };
    case 'Pagato':
      return { at: request.paidAt ?? request.updatedAt, actor: null };
    default:
      return { at: request.updatedAt, actor: null };
  }
}

/**
 * A request the host still has something to do or wait for: one that is not over, and a refused one nobody replaced (the host decides what
 * comes next: ask another supplier).
 */
export function isToFollow(request: ServiceRequest, requests: readonly ServiceRequest[]): boolean {
  if (!isClosedRequest(request.status)) return true;
  return request.status === 'Rifiutato' && !hasReplacement(request, requests);
}

/** The job that comes first goes first; a request with no time goes after the ones that have it, the newest of them first. */
function byJob(a: ServiceRequest, b: ServiceRequest): number {
  const startA = timeOf(a.scheduledStart);
  const startB = timeOf(b.scheduledStart);
  if (startA !== null && startB !== null && startA !== startB) return startA - startB;
  if ((startA === null) !== (startB === null)) return startA === null ? 1 : -1;
  return (timeOf(b.createdAt) ?? 0) - (timeOf(a.createdAt) ?? 0);
}

/** The one closed last goes first. */
function byClosing(a: ServiceRequest, b: ServiceRequest): number {
  return (timeOf(lastStep(b).at) ?? 0) - (timeOf(lastStep(a).at) ?? 0);
}

/**
 * The requests of a stay or of a property in two parts: the ones to follow, which are the list, and the ones that are over, which are kept
 * out of the way (a stay that went through many requests would otherwise bury the one that is open). The order is decided here, not by the
 * order of the answer.
 */
export function groupRequests(requests: readonly ServiceRequest[]): RequestGroups {
  const toFollow: ServiceRequest[] = [];
  const closed: ServiceRequest[] = [];
  for (const request of requests) (isToFollow(request, requests) ? toFollow : closed).push(request);
  return { toFollow: toFollow.sort(byJob), closed: closed.sort(byClosing) };
}
