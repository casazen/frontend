/**
 * Who the invoice of a booking is made out to (FIS-01, NF-81, E06/F02/US01 and US03): the contract of `GET` and `PUT api/bookings/{id}/invoice-data`
 * (the host, in the booking) and of the optional `invoice` block of `POST api/public/checkin/{token}` (the guest, at the check-in).
 *
 * The API writes the enums by name and leaves out what is empty (a member that is `null` on the server is not in the answer), so every optional
 * member below is `undefined` when it is not there. A booking with no data answers the empty object: its id and `invoiceRequested: false`.
 */

/** Who the invoice is for, by the member name of the backend enum `InvoiceRecipientKind`: a private person, or a company with a VAT number. */
export const INVOICE_RECIPIENT_KINDS = ['Guest', 'Company'] as const;

export type InvoiceRecipientKind = (typeof INVOICE_RECIPIENT_KINDS)[number];

/**
 * Where the data came from, by the member name of the backend enum `InvoiceDataSource`. It is also the order of precedence: what the host
 * wrote outranks what the guest typed at the check-in, which outranks what the channel manager had.
 */
export const INVOICE_DATA_SOURCES = ['Octorate', 'CheckIn', 'Host'] as const;

export type InvoiceDataSource = (typeof INVOICE_DATA_SOURCES)[number];

/** The names of the fields as the API says them (camel case): each 422 of the invoice data names one. */
export const INVOICE_DATA_FIELDS = [
  'recipientKind',
  'name',
  'fiscalCode',
  'vatNumber',
  'addressStreet',
  'addressCivic',
  'postalCode',
  'city',
  'province',
  'countryCode',
  'sdiRecipientCode',
  'pec',
] as const;

export type InvoiceDataField = (typeof INVOICE_DATA_FIELDS)[number];

/** The fields that hold text the person writes (every field but the kind of recipient). */
export type InvoiceDataTextField = Exclude<InvoiceDataField, 'recipientKind'>;

/**
 * The stable `code` of a 422 of the invoice data (`InvoiceDataErrorCodes` of the server). Each answer names the field it is about in `field`
 * and lists every failure in `errors` (`[{ field, code }]`), so a form can mark every field at once.
 */
export const INVOICE_DATA_ERROR_CODES = [
  'invoice_data_fiscal_code_invalid',
  'invoice_data_vat_number_invalid',
  'invoice_data_recipient_code_invalid',
  'invoice_data_pec_invalid',
  'invoice_data_recipient_required',
  'invoice_data_field_invalid',
] as const;

export type InvoiceDataErrorCode = (typeof INVOICE_DATA_ERROR_CODES)[number];

/** One failure of a save: the code and the field it is about. */
export interface InvoiceDataFailure {
  field: InvoiceDataField;
  code: InvoiceDataErrorCode;
}

/** The text members of the data a person writes. */
export interface InvoiceDataText {
  name?: string;
  fiscalCode?: string;
  /** With the country prefix, for example `IT12345678903`. */
  vatNumber?: string;
  addressStreet?: string;
  addressCivic?: string;
  postalCode?: string;
  city?: string;
  /** The two letters of the province. */
  province?: string;
  /** ISO 3166-1 alpha-2, `IT` when nothing is said. */
  countryCode?: string;
  /** The code of the recipient on the SDI: 7 letters or digits. */
  sdiRecipientCode?: string;
  pec?: string;
}

/** The invoice data of a booking as the host sees it (`GET`, and the answer of the `PUT`). */
export interface BookingInvoiceData extends InvoiceDataText {
  bookingId: string;
  /** The guest said «Ti serve la fattura?» yes at the check-in. */
  invoiceRequested: boolean;
  invoiceRequestedAt?: string;
  recipientKind?: InvoiceRecipientKind;
  /** The highest source that wrote the data. */
  source?: InvoiceDataSource;
  updatedAt?: string;
}

/**
 * What the host saves (`PUT`). A member that is left out keeps what is stored and one sent empty clears it; the booking, the organization and
 * the source (`Host`) are never taken from the body.
 */
export interface SaveInvoiceDataRequest extends InvoiceDataText {
  recipientKind: InvoiceRecipientKind;
}
