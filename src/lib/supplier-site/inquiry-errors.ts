import { isAxiosError } from 'axios';
import { getHttpStatus, getProblemCode, getRetryAfterSeconds } from '@/lib/api-errors';
import type { InquiryField } from './inquiry-flow';

export type InquiryFailure =
  | { kind: 'invalid'; fields: InquiryField[] }
  | { kind: 'outsideZone' }
  | { kind: 'consent'; outdated: boolean }
  | { kind: 'offline' }
  | { kind: 'serviceGone' }
  | { kind: 'siteGone' }
  | { kind: 'rateLimited'; retryAfterSeconds?: number }
  | { kind: 'other' };

const FIELD_OF: Record<string, InquiryField> = { message: 'message', city: 'comune', comuneIstat: 'comune', fullName: 'fullName', email: 'email', phone: 'phone' };

function fieldsOf(data: unknown): InquiryField[] {
  if (typeof data !== 'object' || data === null) return [];
  const fields = (data as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) return [];
  const named = fields.flatMap((field) => (typeof field === 'string' && FIELD_OF[field] ? [FIELD_OF[field]] : []));
  return [...new Set(named)];
}

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
