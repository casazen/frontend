import { describe, expect, it } from 'vitest';
import { CIN_PATTERN, isEmptyOrValidCin, isValidCin, normalizeCin } from '../cin-format';

// Real CINs from backend .claude/context/regulations/cin.md, section "Formato verificato (2026-09)".
const REAL_CINS = [
  'IT058091C27G5FFZDZ',
  'IT027042C2IT3TRNHJ',
  'IT058091A1K2XKTJ9H',
  'IT015146A12HOLV2MZ',
  'IT048017A1O9HCDONC',
  'IT048017A1FOG7WU8P',
  'IT048017B42742QNBZ',
];

describe('cin-format (mirror of backend CinFormat)', () => {
  it.each(REAL_CINS)('isValidCin_RealEighteenCharacterCin_ReturnsTrue (%s)', (cin) => {
    expect(cin).toHaveLength(18);
    expect(isValidCin(cin)).toBe(true);
    expect(CIN_PATTERN.test(cin)).toBe(true);
  });

  it.each([
    'IT-058091-C2-7G5FFZDZ',
    'it 058091 c2 7g5ffzdz',
    '  IT058091C27G5FFZDZ  ',
    'IT058091\u00A0C27G5FFZDZ',
    'IT058091\u2013C2\u20147G5FFZDZ',
  ])('normalizeCin_WithSpacesHyphensOrLowerCase_ReturnsCompactUpperCase (%s)', (input) => {
    expect(normalizeCin(input)).toBe('IT058091C27G5FFZDZ');
    expect(isValidCin(input)).toBe(true);
  });

  it.each(['IT-12345-1234567890', 'IT-12345-0123456789', 'IT123451234567890'])(
    'isValidCin_OldInventedFormat_ReturnsFalse (%s)',
    (legacy) => {
      expect(isValidCin(legacy)).toBe(false);
    },
  );

  it.each([
    '015146-CNI-01894', // Lombardy CIR, not a CIN
    'IT058091C27G5FFZDZX', // 19 characters
    'IT058091C2', // no random part
    'CIN: IT058091C27G5FFZDZ', // prefix is not stripped
    'IT058091C2.7G5FFZDZ',
    'BAD',
  ])('isValidCin_NotOfficialFormat_ReturnsFalse (%s)', (value) => {
    expect(isValidCin(value)).toBe(false);
  });

  it('isValidCin_ShorterRandomPartOrDigitCategory_ReturnsTrue', () => {
    expect(isValidCin('IT039007B100000')).toBe(true);
    expect(isValidCin('IT0580911A7G5FFZDZ')).toBe(true);
  });

  it('normalizeCin_NothingLeft_ReturnsNull', () => {
    expect(normalizeCin(null)).toBeNull();
    expect(normalizeCin('')).toBeNull();
    expect(normalizeCin('  - ')).toBeNull();
    expect(isEmptyOrValidCin('  ')).toBe(true);
    expect(isEmptyOrValidCin('IT-12345-0123456789')).toBe(false);
  });
});
