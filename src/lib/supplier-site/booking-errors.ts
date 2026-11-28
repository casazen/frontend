import { isAxiosError } from 'axios';
import { getHttpStatus, getProblemCode, getRetryAfterSeconds } from '@/lib/api-errors';
import type { BookingStep, DetailsField } from './booking-flow';

export type BookingFailure =
  | { kind: 'slotTaken' }
  | { kind: 'invalid'; step: BookingStep; fields: DetailsField[] }
  | { kind: 'outsideZone' }
  | { kind: 'consent'; outdated: boolean }
  | { kind: 'offline' }
  | { kind: 'serviceGone' }
  | { kind: 'siteGone' }
  | { kind: 'rateLimited'; retryAfterSeconds?: number }
  | { kind: 'payment' }
  | { kind: 'other' };

const DETAILS_FIELD_NAMES: readonly string[] = ['address', 'postalCode', 'floor', 'accessNotes', 'fullName', 'email', 'phone'];

function fieldsOf(data: unknown): string[] {
  if (typeof data !== 'object' || data === null) return [];
  const fields = (data as { fields?: unknown }).fields;
  return Array.isArray(fields) ? fields.filter((field): field is string => typeof field === 'string') : [];
}

function stepOfField(field: string): BookingStep | null {
  if (field === 'startUtc') return 'when';
  if (field === 'comuneIstat' || field === 'city' || field === 'comune') return 'where';
  if (DETAILS_FIELD_NAMES.includes(field)) return 'details';
  if (field === 'service' || field === 'quantity' || field === 'surfaceSqm' || field === 'urgent' || field.startsWith('options')) return 'service';
  return null;
}

export function readBookingFailure(error: unknown): BookingFailure {
  if (!isAxiosError(error) || !error.response) return { kind: 'other' };
  const status = getHttpStatus(error);
  const code = getProblemCode(error.response.data);

  if (status === 429) return { kind: 'rateLimited', retryAfterSeconds: getRetryAfterSeconds(error) };
  if (status === 409 && code === 'supplier_slot_unavailable') return { kind: 'slotTaken' };
  if (status === 404) return code === 'supplier_service_not_found' ? { kind: 'serviceGone' } : { kind: 'siteGone' };
  if (status === 503) return { kind: 'payment' };
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
      case 'supplier_quote_invalid': {
        const named = fieldsOf(error.response.data);
        const steps = named.map(stepOfField).filter((step): step is BookingStep => step !== null);
        const order: BookingStep[] = ['service', 'where', 'when', 'details'];
        const step = order.find((candidate) => steps.includes(candidate)) ?? 'details';
        return { kind: 'invalid', step, fields: named.filter((field): field is DetailsField => DETAILS_FIELD_NAMES.includes(field)) };
      }
      default:
        return { kind: 'other' };
    }
  }
  return { kind: 'other' };
}

export type ConfirmFailure =
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'supplierUnavailable' }
  | { kind: 'rateLimited'; retryAfterSeconds?: number }
  | { kind: 'retry' };

export function readConfirmFailure(error: unknown): ConfirmFailure {
  if (!isAxiosError(error) || !error.response) return { kind: 'retry' };
  const status = error.response.status;
  const code = getProblemCode(error.response.data);
  if (status === 429) return { kind: 'rateLimited', retryAfterSeconds: getRetryAfterSeconds(error) };
  if (status === 409 && code === 'supplier_booking_link_expired') return { kind: 'expired' };
  if (status === 422 && code === 'supplier_booking_supplier_unavailable') return { kind: 'supplierUnavailable' };
  if (status === 404 || status === 400) return { kind: 'invalid' };
  return { kind: 'retry' };
}
