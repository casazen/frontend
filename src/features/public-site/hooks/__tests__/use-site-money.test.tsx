import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import i18n from '@/i18n/config';
import { useSiteMoney } from '../use-site-money';

/**
 * The amounts of the booking site that are not in cents (the confirmation, the receipt of the home, the hearts, the bookings of the guest) are written by this
 * hook (CHF-MONEY): the currency is the one of the object the amount belongs to, never a euro that nobody said.
 */
describe('useSiteMoney', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('it');
  });

  it('UseSiteMoney_CurrencyOfTheObject_IsWrittenInIt', () => {
    const { result } = renderHook(() => useSiteMoney());

    expect(result.current(519.5, 'CHF')).toContain('CHF');
    expect(result.current(519.5, 'CHF')).not.toContain('€');
    expect(result.current(519.5, 'EUR')).toBe(new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(519.5));
  });

  it.each([
    ['empty', ''],
    ['undefined', undefined],
    ['null', null],
    ['not a code (XX1)', 'XX1'],
  ] as const)('UseSiteMoney_Currency%s_NeverThrowsAndWritesNoCurrency', async (_name, currency) => {
    const { result, rerender } = renderHook(() => useSiteMoney());

    expect(result.current(519.5, currency)).toBe('519,50 (valuta non disponibile)');

    // The function follows the language of the guest: the phrase is said in English when the site is.
    await act(async () => {
      await i18n.changeLanguage('en');
    });
    rerender();
    expect(result.current(519.5, currency)).toBe('519.50 (currency not available)');
  });
});
