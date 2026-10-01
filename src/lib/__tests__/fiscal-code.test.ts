import { describe, expect, it } from 'vitest';
import {
  classifyFiscalCode,
  fiscalCodeCheckCharacter,
  isValidFiscalCode,
  normalizeFiscalCode,
} from '../fiscal-code';

// Same vectors as the backend ItalianFiscalCodeTests (LT-14): keep the two in step.
describe('fiscal-code', () => {
  it.each([
    ['RSSMRA85T10A562S', 'person'],
    ['RSSMRA80A01H501U', 'person'],
    // Woman (day + 40).
    ['VRDGLI85B42F205E', 'person'],
    // Omocodia: the last digit of the place code (2) written as N.
    ['RSSMRA85T10A56NH', 'person'],
    // 11 digits with the check digit (companies, provisional codes).
    ['12345678903', 'numeric'],
    ['00123456782', 'numeric'],
  ] as const)('classifyFiscalCode_Valid_%s_Is%s', (code, kind) => {
    expect(classifyFiscalCode(code)).toBe(kind);
  });

  it.each([
    ['RSSMRA85T10A562X', 'wrong check character'],
    ['RSSMRA85Z10A562S', 'month letter Z'],
    ['RSSMRA85T32A562S', 'day 32'],
    ['RSSMRA85T00A562S', 'day 0'],
    ['RSSMRA85T10A56KS', 'K is not an omocodia letter'],
    ['RSSMRA85T10A562', '15 characters'],
    ['12345678901', 'wrong check digit'],
    ['1234567890A', 'letter in a numeric code'],
    ['', 'empty'],
  ])('isValidFiscalCode_Invalid_%s_IsFalse (%s)', (code) => {
    expect(isValidFiscalCode(code)).toBe(false);
  });

  it('normalizeFiscalCode_LowerCaseWithSpaces_UpperCaseWithoutSpaces', () => {
    expect(normalizeFiscalCode(' rssmra 85t10 a562s ')).toBe('RSSMRA85T10A562S');
    expect(isValidFiscalCode(' rssmra 85t10 a562s ')).toBe(true);
  });

  it('fiscalCodeCheckCharacter_KnownCode_ReturnsItsCheckCharacter', () => {
    expect(fiscalCodeCheckCharacter('RSSMRA85T10A562')).toBe('S');
  });
});
