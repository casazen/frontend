import type { ServiceRequest, ServiceRequestStatus } from '@/types/service-request';

export const WAITING_HINT_KEYS: Partial<Record<ServiceRequestStatus, string>> = {
  Richiesto: 'serviceRequest.timeline.waiting.Richiesto',
  PresoInCarico: 'serviceRequest.timeline.waiting.PresoInCarico',
  InCorso: 'serviceRequest.timeline.waiting.PresoInCarico',
  Completato: 'serviceRequest.timeline.waiting.Completato',
};

function jobKey(request: ServiceRequest): string {
  return `${request.propertyId}:${request.bookingId ?? ''}:${request.category}`;
}

export function suppliersThatRejected(request: ServiceRequest, requests: readonly ServiceRequest[]): string[] {
  const key = jobKey(request);
  const ids = new Set<string>([request.supplierOrgId]);
  for (const other of requests) {
    if (other.status === 'Rifiutato' && jobKey(other) === key) ids.add(other.supplierOrgId);
  }
  return [...ids];
}

export function hasReplacement(request: ServiceRequest, requests: readonly ServiceRequest[]): boolean {
  const key = jobKey(request);
  return requests.some(
    (other) =>
      other.id !== request.id &&
      other.status !== 'Rifiutato' &&
      jobKey(other) === key &&
      Date.parse(other.createdAt) > Date.parse(request.createdAt),
  );
}
