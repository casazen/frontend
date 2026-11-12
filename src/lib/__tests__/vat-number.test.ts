import { describe, expect, it } from 'vitest';
import {
  compactCode,
  isValidPec,
  isValidRecipientCode,
  isValidVatNumber,
  normalizePec,
  normalizeRecipientCode,
  normalizeVatNumber,
} from '../vat-number';

/**
 * Mirror of the backend `InvoiceDataFormats` (FIS-01, NF-81): the VAT number with its check digit, the code of the recipient on the SDI and the
 * PEC. The numbers below are the ones of the backend tests of the same formats.
 */
describe('isValidVatNumber', () => {
  it.each(['12345678903', 'IT12345678903', 'it 123 456 789 03', 'IT-123.456.789/03', '01234567897'])(
    'isValidVatNumber_ItalianNumberWithItsCheckDigit_%s_IsValid',
    (vat) => {
      expect(isValidVatNumber(vat)).toBe(true);
    },
  );

  it.each(['12345678901', 'IT12345678901', 'IT1234567890', '1234567890', 'IT123456789033', 'IT12345678A03', '', '   ', null, undefined])(
    'isValidVatNumber_ItalianNumberWithAWrongCheckDigitOrLength_%s_IsInvalid',
    (vat) => {
      expect(isValidVatNumber(vat)).toBe(false);
    },
  );

  it.each(['DE123456789', 'FR12345678901', 'EL123456789', 'ATU12345678', 'de 123 456 789'])(
    'isValidVatNumber_NumberOfAnotherCountryWithItsPrefix_%s_IsAcceptedByItsShape',
    (vat) => {
      expect(isValidVatNumber(vat)).toBe(true);
    },
  );

  it.each(['D1', 'DE1', 'DE1234567890123', 'X', '12-AB'])('isValidVatNumber_ShapeOfNoCountry_%s_IsInvalid', (vat) => {
    expect(isValidVatNumber(vat)).toBe(false);
  });
});

describe('normalizeVatNumber', () => {
  it('normalizeVatNumber_DigitsInItaly_GetTheItalianPrefixAndLoseTheSeparators', () => {
    expect(normalizeVatNumber('123 456.789-03', 'IT')).toBe('IT12345678903');
    expect(normalizeVatNumber('12345678903')).toBe('IT12345678903');
    expect(normalizeVatNumber('12345678903', '  ')).toBe('IT12345678903');
  });

  it('normalizeVatNumber_DigitsInAnotherCountry_GetThePrefixOfThatCountryAndGreeceIsEl', () => {
    expect(normalizeVatNumber('123456789', 'de')).toBe('DE123456789');
    expect(normalizeVatNumber('123456789', 'GR')).toBe('EL123456789');
  });

  it('normalizeVatNumber_NumberThatStartsWithLetters_KeepsThemInUpperCase', () => {
    expect(normalizeVatNumber('fr 12345678901', 'IT')).toBe('FR12345678901');
    expect(normalizeVatNumber('', 'IT')).toBe('');
  });
});

describe('recipient code', () => {
  it.each(['ABC1234', '0000000', 'A1B2C3D'])('isValidRecipientCode_SevenUpperCaseLettersOrDigits_%s_IsValid', (code) => {
    expect(isValidRecipientCode(code)).toBe(true);
  });

  it.each(['ABC123', 'ABC12345', 'abc1234', 'ABC-123', '', null])('isValidRecipientCode_AnythingElse_%s_IsInvalid', (code) => {
    expect(isValidRecipientCode(code)).toBe(false);
  });

  it('normalizeRecipientCode_TrimsAndRaisesTheCaseSoALowerCaseCodeIsAccepted', () => {
    expect(normalizeRecipientCode('  abc1234 ')).toBe('ABC1234');
    expect(isValidRecipientCode(normalizeRecipientCode('abc1234'))).toBe(true);
  });
});

describe('PEC', () => {
  it.each(['nome@pec.it', 'mario.rossi@studio-rossi.pec.it', 'a+b@example.com'])('isValidPec_AddressWithADomain_%s_IsValid', (pec) => {
    expect(isValidPec(pec)).toBe(true);
  });

  it.each(['', null, 'nome', 'nome@', '@pec.it', 'nome@pec', 'nome@@pec.it', '.nome@pec.it', 'nome.@pec.it', 'no..me@pec.it', 'no me@pec.it'])(
    'isValidPec_NotAnAddress_%s_IsInvalid',
    (pec) => {
      expect(isValidPec(pec)).toBe(false);
    },
  );

  it('isValidPec_LongerThanTheServerKeeps_IsInvalid', () => {
    const local = 'a'.repeat(64);
    expect(isValidPec(`${local}@${'b'.repeat(60)}.${'c'.repeat(60)}.${'d'.repeat(60)}.it`)).toBe(true);
    expect(isValidPec(`${local}@${'b'.repeat(60)}.${'c'.repeat(60)}.${'d'.repeat(60)}.${'e'.repeat(10)}.it`)).toBe(false);
  });

  it('normalizePec_TrimsAndLowersTheCase', () => {
    expect(normalizePec('  Nome@PEC.it ')).toBe('nome@pec.it');
  });
});

describe('compactCode', () => {
  it('compactCode_DropsWhiteSpaceDotsDashesAndSlashesAndRaisesTheCase', () => {
    expect(compactCode(' it 12.3/4-5 ')).toBe('IT12345');
    expect(compactCode(null)).toBe('');
  });
});
