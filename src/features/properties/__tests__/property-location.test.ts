import { describe, expect, it } from 'vitest';
import { formatPropertyLocation } from '../property-location';

describe('formatPropertyLocation (PC-06)', () => {
  it('formatPropertyLocation_WithUnit_PutsTheUnitAfterTheStreet', () => {
    expect(
      formatPropertyLocation({ address: 'Via Roma 1', unit: 'Scala B int. 5', postalCode: '20100', city: 'Milano' }),
    ).toBe('Via Roma 1, Scala B int. 5, 20100 Milano');
  });

  it.each([null, undefined, '', '   '])('formatPropertyLocation_UnitIs_%j_DoesNotShowAnythingForIt', (unit) => {
    expect(formatPropertyLocation({ address: 'Via Roma 1', unit, postalCode: '20100', city: 'Milano' })).toBe(
      'Via Roma 1, 20100 Milano',
    );
  });

  it('formatPropertyLocation_MissingParts_NeverShowsUndefined', () => {
    expect(formatPropertyLocation({ address: 'Via Roma 1', postalCode: '', city: 'Milano' })).toBe('Via Roma 1, Milano');
  });
});
