import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { BookingInvoiceData, SaveInvoiceDataRequest } from '@/types';
import { ApiClient } from './client';

const pathOf = (bookingId: string) => `/bookings/${bookingId}/invoice-data`;

/** A body that is not the invoice data of a booking (the SPA's `index.html` behind a wrong rewrite) is a load error, never an empty form. */
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

/**
 * Saves who the invoice is for, as the host: what is sent replaces what is stored (a member left out keeps its value, one sent empty clears it) and
 * no import and no guest overwrites it afterwards. Answers the data as saved. Needs `payment.write`. 422 `invoice_data_fiscal_code_invalid`,
 * `invoice_data_vat_number_invalid`, `invoice_data_recipient_code_invalid`, `invoice_data_pec_invalid`, `invoice_data_recipient_required` or
 * `invoice_data_field_invalid`, each with the `field` and the list of `errors` (`[{ field, code }]`); 404 and 403 as above.
 */
export async function saveInvoiceData(bookingId: string, data: SaveInvoiceDataRequest): Promise<BookingInvoiceData> {
  const path = pathOf(bookingId);
  return ensureInvoiceData(await ApiClient.put<BookingInvoiceData | undefined>(path, data), path);
}
