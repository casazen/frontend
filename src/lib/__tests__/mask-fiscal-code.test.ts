import { describe, expect, it } from 'vitest';
import { maskFiscalCode } from '../mask-fiscal-code';

describe('maskFiscalCode', () => {
  it('masks all but the last 4 characters', () => {
    expect(maskFiscalCode('RSSMRA80A01H501U')).toBe('************501U');
  });

  it('returns empty string for blank input', () => {
    expect(maskFiscalCode('  ')).toBe('');
  });
});
