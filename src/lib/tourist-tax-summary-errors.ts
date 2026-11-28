import { isAxiosError } from 'axios';
import { getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { getServerFieldErrorsByPath } from '@/lib/server-validation-errors';

type Translate = (key: string) => string;

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

export type TouristTaxField = 'comune' | 'amount' | 'paidOn' | 'periodFrom' | 'periodTo' | 'receipt' | 'reference' | 'notes';

const FIELD_OF_CODE: Readonly<Record<string, TouristTaxField>> = {
  tourist_tax_comune_unknown: 'comune',
  tourist_tax_amount_invalid: 'amount',
  tourist_tax_date_in_future: 'paidOn',
  tourist_tax_period_invalid: 'periodTo',
  tourist_tax_receipt_invalid: 'receipt',
  tourist_tax_text_too_long: 'reference',
};

const DATE_FIELDS: readonly TouristTaxField[] = ['periodFrom', 'periodTo', 'paidOn'];

function errorCode(error: unknown): string | undefined {
  return isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
}

export function isYearEndJsonUnavailable(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 400 && errorCode(error) === 'report_invalid_format';
}

export function getTouristTaxErrorMessage(error: unknown, t: Translate): string | undefined {
  const code = errorCode(error);
  return code !== undefined && Object.hasOwn(ERROR_KEYS, code) ? t(ERROR_KEYS[code]) : getProblemMessage(error, t);
}

export function getTouristTaxFieldErrors(error: unknown): Partial<Record<TouristTaxField, string>> {
  const found: Partial<Record<TouristTaxField, string>> = {};

  const code = errorCode(error);
  if (code !== undefined && Object.hasOwn(FIELD_OF_CODE, code)) {
    found[FIELD_OF_CODE[code]] = ERROR_KEYS[code];
    return found;
  }

  const serverPaths = getServerFieldErrorsByPath(error, 'invalid');
  for (const field of DATE_FIELDS) {
    if (Object.hasOwn(serverPaths, field)) found[field] = 'reports.touristTax.errors.dateInvalid';
  }
  return found;
}
