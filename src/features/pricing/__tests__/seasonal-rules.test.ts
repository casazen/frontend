import { describe, it, expect } from 'vitest';
import i18n from '@/i18n/config';
import { formatMultiplier, parseMultiplier, percentChange, ruleLabel } from '../seasonal-rules';

describe('seasonal-rules', () => {
  it('parseMultiplier_CommaOrDot_ParsesWithinBounds', () => {
    expect(parseMultiplier('1,3')).toBe(1.3);
    expect(parseMultiplier(' 0.8 ')).toBe(0.8);
    expect(parseMultiplier('5')).toBe(5);
  });

  it('parseMultiplier_EmptyNotANumberOrOutOfBounds_IsNull', () => {
    expect(parseMultiplier('')).toBeNull();
    expect(parseMultiplier('abc')).toBeNull();
    expect(parseMultiplier('0')).toBeNull();
    expect(parseMultiplier('5.5')).toBeNull();
  });

  it('percentChange_Multiplier_ShowsSignedPercent', () => {
    expect(percentChange(1.3, 'it')).toBe('+30%');
    expect(percentChange(0.8, 'it')).toBe('-20%');
    expect(percentChange(1, 'it')).toBe('0%');
  });

  it('formatMultiplier_ItalianLocale_UsesCommaAndTwoDecimals', () => {
    expect(formatMultiplier(1.5, 'it')).toBe('×1,50');
  });

  it('ruleLabel_Holiday_NamesTheHolidayAndMultiplier', () => {
    const t = i18n.getFixedT('it');

    expect(ruleLabel({ date: '2027-03-29', basePrice: 180, suggestedPrice: 270, multiplier: 1.5, rule: 'Holiday', holiday: 'EasterMonday' }, t, 'it'))
      .toBe("Festività: Lunedì dell'Angelo (Pasquetta) ×1,50");
    expect(ruleLabel({ date: '2027-03-30', basePrice: 180, suggestedPrice: 180, multiplier: 1, rule: 'None', holiday: null }, t, 'it'))
      .toBe('Nessuna regola (prezzo base)');
  });
});
