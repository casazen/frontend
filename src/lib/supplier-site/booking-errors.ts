import { isAxiosError } from 'axios';
import { getHttpStatus, getProblemCode, getRetryAfterSeconds } from '@/lib/api-errors';
import type { BookingStep, DetailsField } from './booking-flow';

/**
 * What a refused booking means for the person, from the answer of the server. The page never shows the text of the server (it is in one
 * language and may name things): it shows its own sentence for the failure, and sends the person to the step that can fix it.
 */
export type BookingFailure =
  /** 409 `supplier_slot_unavailable`: the time went while the person typed. */
  | { kind: 'slotTaken' }
  /** 422 `supplier_booking_invalid` / `supplier_quote_invalid`: the fields at fault, and the step they live in. */
  | { kind: 'invalid'; step: BookingStep; fields: DetailsField[] }
  /** 422 `supplier_booking_outside_zone`: the comune is not one the supplier works in. */
  | { kind: 'outsideZone' }
  /** 422 `supplier_booking_consent_required` / `…_outdated`: the notice changed while the page was open. */
  | { kind: 'consent'; outdated: boolean }
  /** 422 `supplier_booking_offline`: the supplier does not take bookings now. */
  | { kind: 'offline' }
  /** 404 `supplier_service_not_found`: the service is no longer published. */
  | { kind: 'serviceGone' }
  /** 404 `not_found`: the showcase itself is gone. */
  | { kind: 'siteGone' }
  /** 429: the three limits answer the same. */
  | { kind: 'rateLimited'; retryAfterSeconds?: number }
  /** 503 `payment_provider_error`: the card could not be asked for the block. */
  | { kind: 'payment' }
  | { kind: 'other' };

const DETAILS_FIELD_NAMES: readonly string[] = ['address', 'postalCode', 'floor', 'accessNotes', 'fullName', 'email', 'phone'];

function fieldsOf(data: unknown): string[] {
  if (typeof data !== 'object' || data === null) return [];
  const fields = (data as { fields?: unknown }).fields;
  return Array.isArray(fields) ? fields.filter((field): field is string => typeof field === 'string') : [];
}

/** The step where a field the server named is typed. */
function stepOfField(field: string): BookingStep | null {
  if (field === 'startUtc') return 'when';
  if (field === 'comuneIstat' || field === 'city' || field === 'comune') return 'where';
  if (DETAILS_FIELD_NAMES.includes(field)) return 'details';
  if (field === 'service' || field === 'quantity' || field === 'surfaceSqm' || field === 'urgent' || field.startsWith('options')) return 'service';
  return null;
}

/** Reads a failed `POST …/bookings`. */
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
        // The earliest step that has a field at fault is where the person goes.
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

/** What a failed check of the e-mail link means. */
export type ConfirmFailure =
  /** 404 `supplier_booking_link_invalid`: one answer for a link that does not open, whatever the reason. */
  | { kind: 'invalid' }
  /** 409 `supplier_booking_link_expired`: the thirty minutes passed. */
  | { kind: 'expired' }
  /** 422 `supplier_booking_supplier_unavailable`: the supplier was suspended meanwhile. */
  | { kind: 'supplierUnavailable' }
  | { kind: 'rateLimited'; retryAfterSeconds?: number }
  /** No answer, or a server error: worth trying again. */
  | { kind: 'retry' };

/** Reads a failed `POST …/confirm-email`. */
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
