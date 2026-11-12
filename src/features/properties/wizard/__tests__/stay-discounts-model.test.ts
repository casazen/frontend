import { describe, expect, it } from 'vitest';
import { NEW_PROPERTY_DEFAULTS, pricesStepSchema } from '../property-wizard-model';
import {
  isBlankTier,
  parseNights,
  parsePercent,
  stayDiscountDraftsFromServer,
  stayDiscountProblem,
  stayDiscountTiers,
} from '../stay-discounts-model';

describe('the length-of-stay discounts of the prices step (money rule, NF-35)', () => {
  it('parseNights_WholeNightsFromTwoTo365_ElseNull', () => {
    expect(parseNights('2')).toBe(2);
    expect(parseNights(' 365 ')).toBe(365);
    expect(parseNights('1')).toBeNull();
    expect(parseNights('366')).toBeNull();
    expect(parseNights('7.5')).toBeNull();
    expect(parseNights('')).toBeNull();
  });

  it('parsePercent_AboveZeroUpToAHundred_WithACommaOrAPointAndTwoDecimals', () => {
    expect(parsePercent('10')).toBe(10);
    expect(parsePercent('12,5')).toBe(12.5);
    expect(parsePercent('7.25')).toBe(7.25);
    expect(parsePercent('100')).toBe(100);
    expect(parsePercent('0')).toBeNull();
    expect(parsePercent('100,01')).toBeNull();
    expect(parsePercent('101')).toBeNull();
    expect(parsePercent('5,555')).toBeNull();
    expect(parsePercent('-5')).toBeNull();
    expect(parsePercent('')).toBeNull();
  });

  it('stayDiscountTiers_OnlyValidFilledRows_InOrderOfNights', () => {
    const tiers = stayDiscountTiers([
      { minNights: '14', percentOff: '15' },
      { minNights: '7', percentOff: '10,5' },
      { minNights: '', percentOff: '' },
      // Half typed: never reaches the server as a discount of 0.
      { minNights: '30', percentOff: '' },
      { minNights: '', percentOff: '20' },
    ]);

    expect(tiers).toEqual([
      { minNights: 7, percentOff: 10.5 },
      { minNights: 14, percentOff: 15 },
    ]);
  });

  it('stayDiscountDraftsFromServer_ThenBack_IsTheSameTiers', () => {
    const server = [
      { minNights: 7, percentOff: 10 },
      { minNights: 28, percentOff: 22.5 },
    ];

    expect(stayDiscountTiers(stayDiscountDraftsFromServer(server))).toEqual(server);
  });

  it('stayDiscountProblem_SaysWhichFieldOfWhichRowIsWrong', () => {
    const rows = [
      { minNights: '7', percentOff: '10' },
      { minNights: '7', percentOff: '15' },
      { minNights: '1', percentOff: '10' },
      { minNights: '10', percentOff: '0' },
      { minNights: '', percentOff: '' },
    ];

    expect(stayDiscountProblem(rows, 0)).toBeNull();
    expect(stayDiscountProblem(rows, 1)).toEqual({ field: 'minNights', message: 'propertyWizard.validation.stayDiscounts.duplicate' });
    expect(stayDiscountProblem(rows, 2)).toEqual({ field: 'minNights', message: 'propertyWizard.validation.stayDiscounts.minNights' });
    expect(stayDiscountProblem(rows, 3)).toEqual({ field: 'percentOff', message: 'propertyWizard.validation.stayDiscounts.percentOff' });
    expect(isBlankTier(rows[4]!)).toBe(true);
    expect(stayDiscountProblem(rows, 4)).toBeNull();
  });

  it('pricesStepSchema_AtMostFiveTiersAndNoneWrong', () => {
    const tier = (minNights: number) => ({ minNights: String(minNights), percentOff: '10' });
    const answers = { ...NEW_PROPERTY_DEFAULTS };

    expect(pricesStepSchema.safeParse({ ...answers, stayDiscounts: [tier(3), tier(7), tier(14), tier(21), tier(28)] }).success).toBe(true);
    expect(pricesStepSchema.safeParse({ ...answers, stayDiscounts: [tier(3), tier(7), tier(14), tier(21), tier(28), tier(30)] }).success).toBe(false);

    const wrong = pricesStepSchema.safeParse({ ...answers, stayDiscounts: [tier(3), { minNights: '7', percentOff: '120' }] });
    expect(wrong.success).toBe(false);
    expect(wrong.error?.issues[0]?.path).toEqual(['stayDiscounts', 1, 'percentOff']);
  });
});
