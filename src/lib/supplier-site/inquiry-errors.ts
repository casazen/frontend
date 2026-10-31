import { isAxiosError } from 'axios';
import { getHttpStatus, getProblemCode, getRetryAfterSeconds } from '@/lib/api-errors';
import type { InquiryField } from './inquiry-flow';

/**
 * What a refused request on measure means for the person, from the answer of the server. Like the booking, the page shows its own
 * sentence for each failure, never the text of the server (it is in one language and may name things).
 */
export type InquiryFailure =
  /** 422 `supplier_booking_invalid`: the fields at fault, as the page names them. */
  | { kind: 'invalid'; fields: InquiryField[] }
  /** 422 `supplier_booking_outside_zone`: the comune is not one the supplier works in. */
  | { kind: 'outsideZone' }
  /** 422 `supplier_booking_consent_required` / `…_outdated`: the notice changed while the page was open. */
  | { kind: 'consent'; outdated: boolean }
  /** 422 `supplier_booking_offline`: the supplier paused the showcase and takes no new request. */
  | { kind: 'offline' }
  /** 404 `supplier_service_not_found`: the service is no longer published. */
  | { kind: 'serviceGone' }
  /** 404 `not_found`: the showcase itself is gone. */
  | { kind: 'siteGone' }
  /** 429: the three limits answer the same. */
  | { kind: 'rateLimited'; retryAfterSeconds?: number }
  | { kind: 'other' };

/** The field names of the server, as the page calls them. */
const FIELD_OF: Record<string, InquiryField> = { message: 'message', city: 'comune', comuneIstat: 'comune', fullName: 'fullName', email: 'email', phone: 'phone' };

function fieldsOf(data: unknown): InquiryField[] {
  if (typeof data !== 'object' || data === null) return [];
  const fields = (data as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) return [];
  const named = fields.flatMap((field) => (typeof field === 'string' && FIELD_OF[field] ? [FIELD_OF[field]] : []));
  return [...new Set(named)];
}

/** Reads a failed `POST …/inquiries`. */
export function readInquiryFailure(error: unknown): InquiryFailure {
  if (!isAxiosError(error) || !error.response) return { kind: 'other' };
  const status = getHttpStatus(error);
  const code = getProblemCode(error.response.data);

  if (status === 429) return { kind: 'rateLimited', retryAfterSeconds: getRetryAfterSeconds(error) };
  if (status === 404) return code === 'supplier_service_not_found' ? { kind: 'serviceGone' } : { kind: 'siteGone' };
  if (status === 422) {
    switch (code) {
      case 'supplier_booking_outside_zone':
        return { kind: 'outsideZone' };
      case 'supplier_booking_consent_required':
        return { kind: 'consent', outdated: false };
      case 'supplier_booking_consent_outdated':
        return { kind: 'consent', outdated: true };
      case 'supplier_booking_offline':
        return { kind: 'offline' };
      case 'supplier_booking_invalid':
        return { kind: 'invalid', fields: fieldsOf(error.response.data) };
      default:
        return { kind: 'other' };
    }
  }
  return { kind: 'other' };
}
