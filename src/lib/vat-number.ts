import { isValidNumericFiscalCode } from '@/lib/fiscal-code';

/**
 * The formats of the invoice data of a booking that are not the fiscal code (FIS-01, NF-81): the VAT number, the code of the recipient on the
 * SDI and the PEC. Mirror of the backend `Casazen.Core/Regulatory/InvoiceDataFormats.cs`: keep the two in step. The fiscal code is not here,
 * and never a second time: `@/lib/fiscal-code` is the one place that knows it (and an Italian VAT number is checked with the same check digit as
 * the numeric fiscal code, so this file calls it).
 */

/** The VAT number of another country: its two letters (the EU prefix, `EL` for Greece) and 2 to 12 letters or digits. By its shape only. */
const FOREIGN_VAT_NUMBER = /^[A-Z]{2}[A-Z0-9]{2,12}$/;

const RECIPIENT_CODE = /^[A-Z0-9]{7}$/;

const EMAIL_ADDRESS =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

/** The longest PEC the server keeps (`BookingInvoiceData.PecMaxLength`). */
export const PEC_MAX_LENGTH = 254;

/** The country of the data when nothing is said (`BookingInvoiceData.DefaultCountryCode`). */
export const DEFAULT_COUNTRY_CODE = 'IT';

const isAsciiDigit = (character: string) => character >= '0' && character <= '9';

/** Upper case with no white space, dot, dash or slash: the way a code is compared (the server's `Compact`). */
export function compactCode(value: string | null | undefined): string {
  return (value ?? '').replace(/[\s./-]+/g, '').toUpperCase();
}

function isValidItalianVat(digits: string): boolean {
  return digits.length === 11 && isValidNumericFiscalCode(digits);
}

/**
 * True for a valid VAT number: an Italian one is 11 digits with their check digit (the same as the numeric fiscal code), with or without the
 * `IT` prefix; the number of another country, written with its prefix, is accepted by its shape only. Spaces, dots, dashes and slashes are
 * ignored and the case does not matter.
 */
export function isValidVatNumber(vatNumber: string | null | undefined): boolean {
  const vat = compactCode(vatNumber);
  if (vat.length === 0) return false;
  if (vat.startsWith('IT')) return isValidItalianVat(vat.slice(2));
  if ([...vat].every(isAsciiDigit)) return isValidItalianVat(vat);
  return FOREIGN_VAT_NUMBER.test(vat);
}

/**
 * The VAT number written with its country prefix, upper case and without separators: `IT12345678903` for `12345678903` in Italy, the prefix of
 * `countryCode` (`EL` for Greece) for a number that starts with a digit in another country; a number that starts with letters keeps them.
 */
export function normalizeVatNumber(vatNumber: string | null | undefined, countryCode?: string | null): string {
  const vat = compactCode(vatNumber);
  if (vat.length === 0 || !isAsciiDigit(vat[0])) return vat;

  const country = (countryCode ?? '').trim() === '' ? DEFAULT_COUNTRY_CODE : compactCode(countryCode);
  return (country === 'GR' ? 'EL' : country) + vat;
}

/** The code of the recipient trimmed and in upper case. */
export function normalizeRecipientCode(code: string | null | undefined): string {
  return (code ?? '').trim().toUpperCase();
}

/** True for exactly 7 upper case letters or digits: the code of the recipient on the SDI. `normalizeRecipientCode` raises the case first. */
export function isValidRecipientCode(code: string | null | undefined): boolean {
  return code != null && RECIPIENT_CODE.test(code);
}

/** The PEC trimmed and in lower case. */
export function normalizePec(pec: string | null | undefined): string {
  return (pec ?? '').trim().toLowerCase();
}

/** True for an e-mail address of at most 254 characters: one at sign, a name before it and a domain with a dot after it. */
export function isValidPec(pec: string | null | undefined): boolean {
  if (!pec || pec.length > PEC_MAX_LENGTH || !EMAIL_ADDRESS.test(pec)) return false;

  const local = pec.slice(0, pec.indexOf('@'));
  return !local.startsWith('.') && !local.endsWith('.') && !local.includes('..');
}
