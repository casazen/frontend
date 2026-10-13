import { describe, expect, it } from 'vitest';
import { isRentInConcordatoRange } from '../concordato-rent-range';

describe('isRentInConcordatoRange', () => {
  it('rejects missing range', () => {
    expect(isRentInConcordatoRange(800, undefined, 900)).toBe(false);
    expect(isRentInConcordatoRange(800, 700, undefined)).toBe(false);
  });

  it('accepts rent inside min/max', () => {
    expect(isRentInConcordatoRange(800, 700, 900)).toBe(true);
    expect(isRentInConcordatoRange(700, 700, 900)).toBe(true);
    expect(isRentInConcordatoRange(900, 700, 900)).toBe(true);
  });

  it('rejects rent outside min/max', () => {
    expect(isRentInConcordatoRange(699, 700, 900)).toBe(false);
    expect(isRentInConcordatoRange(901, 700, 900)).toBe(false);
  });
});
