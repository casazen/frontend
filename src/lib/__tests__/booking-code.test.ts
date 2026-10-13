import { describe, expect, it } from 'vitest';
import { formatBookingCode, isValidBookingCode, normalizeBookingCode } from '../booking-code';

describe('booking code (BK-11)', () => {
  it.each([
    ['K7M4Q-9XP2H', 'K7M4Q9XP2H'],
    ['  k7m4q 9xp2h ', 'K7M4Q9XP2H'],
    ['K7M4Q–9XP2H', 'K7M4Q9XP2H'],
    ['O1LI0-ABCDE', '01110ABCDE'],
  ])('normalizeBookingCode_WhatAGuestTypes_StoredForm (%s)', (input, expected) => {
    expect(normalizeBookingCode(input)).toBe(expected);
  });

  it.each([null, '', '   ', 'K7M4Q-9XP2', 'K7M4Q-9XP2HH', 'K7M4Q-9XP2U', 'K7M4Q-9XP2*', '0f8fad5b-d9cb-469f-a165-70867728950e'])(
    'normalizeBookingCode_NotACode_Null (%s)',
    (input) => {
      expect(normalizeBookingCode(input)).toBeNull();
      expect(isValidBookingCode(input)).toBe(false);
    },
  );

  it('formatBookingCode_TypedCode_TwoGroupsOfFive', () => {
    expect(formatBookingCode('k7m4q9xp2h')).toBe('K7M4Q-9XP2H');
    expect(formatBookingCode('not a code')).toBeNull();
  });
});
