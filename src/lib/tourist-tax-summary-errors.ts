import { isAxiosError } from 'axios';
import { getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { getServerFieldErrorsByPath } from '@/lib/server-validation-errors';

type Translate = (key: string) => string;

/**
 * The error codes of the tourist tax summary (backend `TouristTaxErrorCodes`, `GET summary`) and the key of the text that explains
 * each one.
 */
const ERROR_KEYS: Readonly<Record<string, string>> = {
  tourist_tax_comune_unknown: 'reports.touristTax.errors.comuneUnknown',
  tourist_tax_amount_invalid: 'reports.touristTax.errors.amountInvalid',
  tourist_tax_date_in_future: 'reports.touristTax.errors.dateInFuture',
  tourist_tax_period_invalid: 'reports.touristTax.errors.periodInvalid',
  tourist_tax_receipt_invalid: 'reports.touristTax.errors.receiptInvalid',
  tourist_tax_text_too_long: 'reports.touristTax.errors.textTooLong',
  tourist_tax_remittance_not_found: 'reports.touristTax.errors.remittanceNotFound',
  tourist_tax_receipt_not_found: 'reports.touristTax.errors.receiptNotFound',
  tourist_tax_payments_need_whole_org: 'reports.touristTax.errors.paymentsNeedWholeOrg',
  fiscal_report_period_invalid: 'reports.touristTax.errors.reportPeriodInvalid',
  report_invalid_format: 'reports.touristTax.errors.reportInvalidFormat',
};

/** The fields of the form that records a payment. */
export type TouristTaxField = 'comune' | 'amount' | 'paidOn' | 'periodFrom' | 'periodTo' | 'receipt' | 'reference' | 'notes';

/** The field that explains each 422 of recording a payment (a text too long is the reference, the first of the two texts). */
const FIELD_OF_CODE: Readonly<Record<string, TouristTaxField>> = {
  tourist_tax_comune_unknown: 'comune',
  tourist_tax_amount_invalid: 'amount',
  tourist_tax_date_in_future: 'paidOn',
  tourist_tax_period_invalid: 'periodTo',
  tourist_tax_receipt_invalid: 'receipt',
  tourist_tax_text_too_long: 'reference',
};

/** The days of the form: a day that is missing or malformed is a 400 of the model binding, with the name of the field. */
const DATE_FIELDS: readonly TouristTaxField[] = ['periodFrom', 'periodTo', 'paidOn'];

/** The `code` of the problem body of a failed call, or undefined when there is none. */
function errorCode(error: unknown): string | undefined {
  return isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
}

/**
 * The text that explains a failed call of the tourist tax summary: the one of its server code (`reports.touristTax.errors.*`), else
 * the generic reading of the error (a session that ended, a missing permission, no network). Undefined when the error says nothing
 * more useful than the caller's own sentence.
 */
export function getTouristTaxErrorMessage(error: unknown, t: Translate): string | undefined {
  const code = errorCode(error);
  return code !== undefined && Object.hasOwn(ERROR_KEYS, code) ? t(ERROR_KEYS[code]) : getProblemMessage(error, t);
}

/**
 * The fields of the form that a failed `POST remittances` answers for, each with the key of its text: a 422 that names the value that
 * is wrong, and the 400 of a day that is missing or malformed. Empty for every other failure (a missing permission, no network): those
 * belong to the toast, not to a field.
 */
export function getTouristTaxFieldErrors(error: unknown): Partial<Record<TouristTaxField, string>> {
  const found: Partial<Record<TouristTaxField, string>> = {};

  const code = errorCode(error);
  if (code !== undefined && Object.hasOwn(FIELD_OF_CODE, code)) {
    found[FIELD_OF_CODE[code]] = ERROR_KEYS[code];
    return found;
  }

  // Only the names of the fields matter here: the texts of a model binding are the server's own, in English.
  const serverPaths = getServerFieldErrorsByPath(error, 'invalid');
  for (const field of DATE_FIELDS) {
    if (Object.hasOwn(serverPaths, field)) found[field] = 'reports.touristTax.errors.dateInvalid';
  }
  return found;
}
