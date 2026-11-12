import { INVOICE_ERROR_MESSAGES } from '@/lib/invoice-data-schema';

/**
 * Where the texts of the invoice data fields are, one set for each place that asks for the data: the host in the sub-step of the booking
 * (`invoiceData.fields`, the app in Italian or English) and the guest in the check-in page (`checkin.invoice.fields`, which the page has in five
 * languages, so its texts are also in the subset files of the guest page). The words differ («the guest» for the host, «you» for the guest): the
 * fields are the same.
 */
export const INVOICE_FIELDS_COPY = { host: 'invoiceData.fields', guest: 'checkin.invoice.fields' } as const;

export type InvoiceFieldsCopy = (typeof INVOICE_FIELDS_COPY)[keyof typeof INVOICE_FIELDS_COPY];

/**
 * The texts the fields read under their set, by the end of the key. They are written out so that a test finds a text that a set lacks in any of
 * its languages: the keys are built from the set, so the scanner of the i18n test does not see them.
 */
export const INVOICE_FIELDS_COPY_SUFFIXES = [
  'kind.legend',
  'kind.Guest.title',
  'kind.Guest.description',
  'kind.Company.title',
  'kind.Company.description',
  'name.Guest',
  'name.Company',
  'fiscalCode.label',
  'fiscalCode.why',
  'vatNumber.label',
  'vatNumber.why',
  'address.legend',
  'address.street',
  'address.civic',
  'address.postalCode',
  'address.city',
  'address.province',
  'more.label',
  'more.hint',
  'country.label',
  'country.why',
  'sdiRecipientCode.label',
  'sdiRecipientCode.why',
  'pec.label',
  'pec.why',
  'example',
  ...INVOICE_ERROR_MESSAGES.map((message) => `errors.${message}` as const),
] as const;

export type InvoiceFieldsCopySuffix = (typeof INVOICE_FIELDS_COPY_SUFFIXES)[number];
