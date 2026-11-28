import { isAxiosError } from 'axios';
import { getHttpStatus, getProblemCode, getRetryAfterSeconds } from '@/lib/api-errors';

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
  | 'authorizationExpired'
  | 'noOffer'
  | 'offerExpired'
  | 'messageInvalid'
  | 'threadFull'
  | 'threadClosed'
  | 'inFlight'
  | 'providerError';

export type RequestFailure =
  | { kind: 'notFound' }
  | { kind: 'rateLimited'; retryAfterSeconds?: number }
  | { kind: 'changed' }
  | { kind: 'slotTaken' }
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
  service_payment_capture_failed: 'captureFailed',
  service_payment_authorization_expired: 'authorizationExpired',
  payment_capture_failed: 'captureFailed',
  payment_authorization_expired: 'authorizationExpired',
  supplier_booking_no_offer: 'noOffer',
  supplier_booking_offer_expired: 'offerExpired',
  service_request_message_invalid: 'messageInvalid',
  service_request_thread_full: 'threadFull',
  service_request_thread_closed: 'threadClosed',
  service_payment_in_flight: 'inFlight',
  payment_provider_error: 'providerError',
};

export function readRequestFailure(error: unknown): RequestFailure {
  if (!isAxiosError(error) || !error.response) return { kind: 'other' };
  const status = getHttpStatus(error);
  const code = getProblemCode(error.response.data);
  if (status === 429) return { kind: 'rateLimited', retryAfterSeconds: getRetryAfterSeconds(error) };
  if (status === 404) return { kind: 'notFound' };
  if (code && REFUSALS[code] && (status === 422 || status === 409 || status === 503)) return { kind: 'refused', reason: REFUSALS[code] };
  if (status === 409) return code === 'supplier_slot_unavailable' || code === 'supplier_commitment_conflict' ? { kind: 'slotTaken' } : { kind: 'changed' };
  return { kind: 'other' };
}
