import type { ServiceRequest } from '@/types/service-request';
import { isClosedRequest } from '../long-rent/long-rent-request-model';
import { hasReplacement } from './request-history';

export const CLOSED_FIRST = 5;

export const CLOSED_STEP = 10;

export interface RequestGroups {
  toFollow: ServiceRequest[];
  closed: ServiceRequest[];
}

export interface LastStep {
  at: string | null;
  actor: string | null;
}

function timeOf(instant: string | null | undefined): number | null {
  if (!instant) return null;
  const time = Date.parse(instant);
  return Number.isFinite(time) ? time : null;
}

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

export function isToFollow(request: ServiceRequest, requests: readonly ServiceRequest[]): boolean {
  if (!isClosedRequest(request.status)) return true;
  return request.status === 'Rifiutato' && !hasReplacement(request, requests);
}

function byJob(a: ServiceRequest, b: ServiceRequest): number {
  const startA = timeOf(a.scheduledStart);
  const startB = timeOf(b.scheduledStart);
  if (startA !== null && startB !== null && startA !== startB) return startA - startB;
  if ((startA === null) !== (startB === null)) return startA === null ? 1 : -1;
  return (timeOf(b.createdAt) ?? 0) - (timeOf(a.createdAt) ?? 0);
}

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
