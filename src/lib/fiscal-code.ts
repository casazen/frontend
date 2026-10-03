/**
 * Italian fiscal code (codice fiscale) of a lease party (LT-14, A7-28). Mirror of the backend
 * `Casazen.Core/Regulatory/ItalianFiscalCode.cs`: keep the two in step.
 *
 * - Natural person, 16 characters (D.M. 23/12/1976; omocodia D.M. 12/03/1974): 6 letters, 2 digits (year), the month
 *   letter (`ABCDEHLMPRST`), 2 digits (day, +40 for women), the cadastral code of the place of birth (a letter and 3
 *   digits) and the check character. In an omocodia the digits are replaced by `LMNPQRSTUV` (0-9).
 * - 11 digits (companies and other non-natural persons, provisional codes): the last digit is the check digit.
 *
 * Only the format and the check character are verified, not that the code was issued.
 */
export type FiscalCodeKind = 'person' | 'numeric';

const OMOCODIA_LETTERS = 'LMNPQRSTUV';
const MONTH_LETTERS = 'ABCDEHLMPRST';
const DIGIT_POSITIONS = new Set([6, 7, 9, 10, 12, 13, 14]);
// Values of A..Z (and of the digits 0..9, as the letter of the same index) in odd positions.
const ODD_VALUES = [1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23];

const isDigit = (c: string) => c >= '0' && c <= '9';
const isLetter = (c: string) => c >= 'A' && c <= 'Z';

/** Upper case, without whitespace. */
export function normalizeFiscalCode(code: string | null | undefined): string {
  return (code ?? '').replace(/\s+/g, '').toUpperCase();
}

/** Check character of the first 15 characters of a 16-character code. */
export function fiscalCodeCheckCharacter(first15: string): string {
  let sum = 0;
  for (let i = 0; i < first15.length; i++) {
    const c = first15[i];
    const index = isDigit(c) ? c.charCodeAt(0) - 48 : c.charCodeAt(0) - 65;
    sum += i % 2 === 0 ? ODD_VALUES[index] : index;
  }
  return String.fromCharCode(65 + (sum % 26));
}

function digitValue(c: string): number {
  return isDigit(c) ? c.charCodeAt(0) - 48 : OMOCODIA_LETTERS.indexOf(c);
}

/** 16-character code of a natural person, already normalized. */
export function isValidPersonFiscalCode(code: string): boolean {
  if (code.length !== 16) return false;
  for (let i = 0; i < 16; i++) {
    const c = code[i];
    const valid = DIGIT_POSITIONS.has(i) ? isDigit(c) || OMOCODIA_LETTERS.includes(c) : isLetter(c);
    if (!valid) return false;
  }
  if (!MONTH_LETTERS.includes(code[8])) return false;
  const day = digitValue(code[9]) * 10 + digitValue(code[10]);
  if (day < 1 || (day > 31 && day < 41) || day > 71) return false;
  return code[15] === fiscalCodeCheckCharacter(code.slice(0, 15));
}

/** 11-digit code, already normalized. */
export function isValidNumericFiscalCode(code: string): boolean {
  if (!/^[0-9]{11}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let digit = code.charCodeAt(i) - 48;
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return code.charCodeAt(10) - 48 === (10 - (sum % 10)) % 10;
}

/** Kind of the code once normalized, or null when it is not a valid fiscal code. */
export function classifyFiscalCode(code: string | null | undefined): FiscalCodeKind | null {
  const normalized = normalizeFiscalCode(code);
  if (isValidPersonFiscalCode(normalized)) return 'person';
  if (isValidNumericFiscalCode(normalized)) return 'numeric';
  return null;
}

export function isValidFiscalCode(code: string | null | undefined): boolean {
  return classifyFiscalCode(code) !== null;
}
