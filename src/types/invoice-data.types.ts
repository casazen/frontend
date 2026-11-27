/** Who the invoice is for, by the member name of the backend enum `InvoiceRecipientKind`: a private person, or a company with a VAT number. */
export const INVOICE_RECIPIENT_KINDS = ['Guest', 'Company'] as const;

export type InvoiceRecipientKind = (typeof INVOICE_RECIPIENT_KINDS)[number];

export const INVOICE_DATA_SOURCES = ['Octorate', 'CheckIn', 'Host'] as const;

type InvoiceDataSource = (typeof INVOICE_DATA_SOURCES)[number];

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

export type InvoiceDataTextField = Exclude<InvoiceDataField, 'recipientKind'>;

export const INVOICE_DATA_ERROR_CODES = [
  'invoice_data_fiscal_code_invalid',
  'invoice_data_vat_number_invalid',
  'invoice_data_recipient_code_invalid',
  'invoice_data_pec_invalid',
  'invoice_data_recipient_required',
  'invoice_data_field_invalid',
] as const;

export type InvoiceDataErrorCode = (typeof INVOICE_DATA_ERROR_CODES)[number];

export interface InvoiceDataFailure {
  field: InvoiceDataField;
  code: InvoiceDataErrorCode;
}

export interface InvoiceDataText {
  name?: string;
  fiscalCode?: string;
  vatNumber?: string;
  addressStreet?: string;
  addressCivic?: string;
  postalCode?: string;
  city?: string;
  province?: string;
  countryCode?: string;
  sdiRecipientCode?: string;
  pec?: string;
}

export interface BookingInvoiceData extends InvoiceDataText {
  bookingId: string;
  /** The guest said «Ti serve la fattura?» yes at the check-in. */
  invoiceRequested: boolean;
  invoiceRequestedAt?: string;
  recipientKind?: InvoiceRecipientKind;
  source?: InvoiceDataSource;
  updatedAt?: string;
}

export interface SaveInvoiceDataRequest extends InvoiceDataText {
  recipientKind: InvoiceRecipientKind;
}
