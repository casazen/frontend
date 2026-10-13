import type { ServiceRequest, ServiceRequestStatus } from '@/types/service-request';

/** Key of the line that says what a request in this status is waiting for; closed statuses wait for nothing. */
export const WAITING_HINT_KEYS: Partial<Record<ServiceRequestStatus, string>> = {
  Richiesto: 'serviceRequest.timeline.waiting.Richiesto',
  PresoInCarico: 'serviceRequest.timeline.waiting.PresoInCarico',
  InCorso: 'serviceRequest.timeline.waiting.PresoInCarico',
  Completato: 'serviceRequest.timeline.waiting.Completato',
};

/** What a request is tied to: its stay (short-rent, D2), or the property when it has none (long-rent, older requests). */
function jobKey(request: ServiceRequest): string {
  return `${request.propertyId}:${request.bookingId ?? ''}:${request.category}`;
}

/**
 * Suppliers that already rejected this job (same property, stay and category) among `requests`, including the one of
 * `request` itself: they are left out of the list when the host asks another supplier (SU-09).
 */
export function suppliersThatRejected(request: ServiceRequest, requests: ServiceRequest[]): string[] {
  const key = jobKey(request);
  const ids = new Set<string>([request.supplierOrgId]);
  for (const other of requests) {
    if (other.status === 'Rifiutato' && jobKey(other) === key) ids.add(other.supplierOrgId);
  }
  return [...ids];
}

/**
 * True when a newer request for the same job is not rejected: the host already asked another supplier, so the rejected
 * one does not offer "ask another supplier" again (it would create a duplicate).
 */
export function hasReplacement(request: ServiceRequest, requests: ServiceRequest[]): boolean {
  const key = jobKey(request);
  return requests.some(
    (other) =>
      other.id !== request.id &&
      other.status !== 'Rifiutato' &&
      jobKey(other) === key &&
      Date.parse(other.createdAt) > Date.parse(request.createdAt),
  );
}
