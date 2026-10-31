import { isAxiosError } from 'axios';
import { getHttpStatus, getProblemCode, getRetryAfterSeconds } from '@/lib/api-errors';

/**
 * What a refused call of the customer's own area means, from the answer of the server. Like the booking, the page shows its own sentence
 * for each failure, never the text of the server.
 */
export type RequestRefusal =
  | 'cannotCancel'
  | 'cannotReschedule'
  | 'noProposal'
  | 'proposalExpired'
  | 'supplierUnavailable'
  | 'noQuote'
  | 'quoteExpired'
  | 'invalid'
  | 'notConfirmable'
  | 'windowClosed'
  | 'tooEarly'
  | 'notReportable'
  | 'captureFailed'
  | 'authorizationExpired';

export type RequestFailure =
  /** 404 `supplier_booking_not_found`: one answer for a code, a supplier or an address that does not match. */
  | { kind: 'notFound' }
  /** 429: the wait is the whole window of the limit, never the time that is left. */
  | { kind: 'rateLimited'; retryAfterSeconds?: number }
  /** 409 `service_request_state_changed` / `service_request_quote_changed`: somebody else moved first; the page reads it again. */
  | { kind: 'changed' }
  /** 409 `supplier_slot_unavailable`: the time asked for went. */
  | { kind: 'slotTaken' }
  /** 422: the rules of the area said no; the page reads it again to show what is true now. */
  | { kind: 'refused'; reason: RequestRefusal }
  | { kind: 'other' };

const REFUSALS: Record<string, RequestRefusal> = {
  supplier_booking_cannot_cancel: 'cannotCancel',
  supplier_booking_cannot_reschedule: 'cannotReschedule',
  supplier_booking_no_proposal: 'noProposal',
  supplier_booking_proposal_expired: 'proposalExpired',
  supplier_booking_supplier_unavailable: 'supplierUnavailable',
  supplier_booking_no_quote: 'noQuote',
  supplier_booking_quote_expired: 'quoteExpired',
  supplier_booking_invalid: 'invalid',
  service_payment_not_confirmable: 'notConfirmable',
  service_dispute_window_closed: 'windowClosed',
  service_dispute_too_early: 'tooEarly',
  service_dispute_not_reportable: 'notReportable',
  service_dispute_invalid: 'invalid',
  // Accepting a time for a booking paid inside CasaZen charges the blocked card first (409): the money says no, the request stays as it is.
  service_payment_capture_failed: 'captureFailed',
  service_payment_authorization_expired: 'authorizationExpired',
};

export function readRequestFailure(error: unknown): RequestFailure {
  if (!isAxiosError(error) || !error.response) return { kind: 'other' };
  const status = getHttpStatus(error);
  const code = getProblemCode(error.response.data);
  if (status === 429) return { kind: 'rateLimited', retryAfterSeconds: getRetryAfterSeconds(error) };
  if (status === 404) return { kind: 'notFound' };
  if (code && REFUSALS[code] && (status === 422 || status === 409)) return { kind: 'refused', reason: REFUSALS[code] };
  if (status === 409) return code === 'supplier_slot_unavailable' ? { kind: 'slotTaken' } : { kind: 'changed' };
  return { kind: 'other' };
}
