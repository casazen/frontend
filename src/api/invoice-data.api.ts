import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { BookingInvoiceData, SaveInvoiceDataRequest } from '@/types';
import { ApiClient } from './client';

const pathOf = (bookingId: string) => `/bookings/${bookingId}/invoice-data`;

function ensureInvoiceData(data: BookingInvoiceData | undefined, path: string): BookingInvoiceData {
  if (!data || typeof data !== 'object' || typeof data.bookingId !== 'string') throw new UnexpectedApiResponseError(path);
  return data;
}

/**
 * Who the invoice of a booking is made out to (FIS-01, NF-81): the kind of recipient, the name, the fiscal code, the VAT number, the address, the
 * code of the recipient on the SDI, the PEC, where the data came from (`source`) and whether the guest asked for the invoice at the check-in. A booking
 * with no data answers the empty object. Needs `payment.read`: 404 for a booking of another organization, 403 for one the caller may not read.
 */
export async function getInvoiceData(bookingId: string): Promise<BookingInvoiceData> {
  const path = pathOf(bookingId);
  return ensureInvoiceData(await ApiClient.get<BookingInvoiceData | undefined>(path), path);
}

export async function saveInvoiceData(bookingId: string, data: SaveInvoiceDataRequest): Promise<BookingInvoiceData> {
  const path = pathOf(bookingId);
  return ensureInvoiceData(await ApiClient.put<BookingInvoiceData | undefined>(path, data), path);
}
