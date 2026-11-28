import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import i18n from '@/i18n/config';
import type { GuestCancellationPreview } from '@/types';
import { CancellationOutcome } from '../components/cancellation-outcome';
import { RefundSummary } from '../components/refund-summary';

/**
 * CHF-MONEY, the cancellation of the guest: what comes back is written in the currency of the preview (francs for a home in Switzerland), and a preview whose
 * data says none (an empty currency, or a code that is not one) has its amounts written with no symbol and the phrase that says the currency is not available:
 * never a euro nobody said, and the page still draws (`Intl` throws for a code that is not three letters, and a render that throws blanks the page).
 * Written as these pages always were: the Italian number format, whatever the language.
 */
function preview(currency: string | undefined): GuestCancellationPreview {
  return {
    cancellable: true,
    reason: null,
    kind: 'cancel',
    currency: currency as string,
    paidAmount: 362,
    alreadyRefundedAmount: 0,
    refundPercent: 50,
    refundAmount: 190.5,
    retainedAmount: 171.5,
    retainedBecause: 'policy',
    policy: { slug: 'moderate', name: 'Moderata', description: null },
    fullRefundUntil: '2026-10-17',
    partialRefundPercent: 50,
    partialRefundUntil: '2026-10-22',
    stay: { propertyName: 'Trastevere Suite', checkInDate: '2026-10-24', checkOutDate: '2026-10-27' },
    outcome: null,
    generatedAt: '2026-10-18T10:00:00Z',
  };
}

describe('the refund of the cancellation with no currency in the data', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('it');
  });

  it.each([
    ['empty', ''],
    ['missing', undefined],
    ['not a code (XX1)', 'XX1'],
  ] as const)('RefundSummary_Currency%s_WritesEveryAmountWithNoSymbolAndThePhrase', (_name, currency) => {
    render(<RefundSummary preview={preview(currency)} />);

    expect(screen.getByTestId('guest-cancellation-headline')).toHaveTextContent('Ti rimborsiamo 190,50 (valuta non disponibile)');
    expect(screen.getByTestId('guest-cancellation-details')).toHaveTextContent('Hai pagato 362,00 (valuta non disponibile)');
    expect(screen.getByTestId('guest-cancellation-retained')).toHaveTextContent('171,50 (valuta non disponibile)');
    expect(screen.getByTestId('guest-cancellation-summary')).not.toHaveTextContent(/EUR|€/);
  });

  it.each([
    ['empty', ''],
    ['missing', undefined],
  ] as const)('CancellationOutcome_Currency%s_SaysTheRefundWithNoSymbolAndThePhrase', (_name, currency) => {
    render(<CancellationOutcome refundAmount={190.5} refundStatus="pending" currency={currency as string} />);

    expect(screen.getByTestId('guest-cancellation-outcome-detail')).toHaveTextContent('Ti stiamo rimborsando 190,50 (valuta non disponibile).');
    expect(screen.getByTestId('guest-cancellation-outcome')).not.toHaveTextContent(/EUR|€/);
  });

  it('RefundSummary_NoCurrencyInEnglish_SaysItInEnglish', async () => {
    await i18n.changeLanguage('en');
    render(<RefundSummary preview={preview('')} />);

    expect(screen.getByTestId('guest-cancellation-headline')).toHaveTextContent(/^We refund 190\D50 \(currency not available\)$/);
    expect(screen.getByTestId('guest-cancellation-summary')).not.toHaveTextContent(/EUR|€/);
  });

  it('RefundSummary_CurrencyOfThePreview_IsTheOneWritten', () => {
    const { unmount } = render(<RefundSummary preview={preview('CHF')} />);
    expect(screen.getByTestId('guest-cancellation-headline')).toHaveTextContent('190,50 CHF');
    expect(screen.getByTestId('guest-cancellation-summary')).not.toHaveTextContent('€');
    expect(screen.getByTestId('guest-cancellation-summary')).not.toHaveTextContent('valuta non disponibile');
    unmount();

    render(<RefundSummary preview={preview('EUR')} />);
    expect(screen.getByTestId('guest-cancellation-headline').textContent).toBe(`Ti rimborsiamo ${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(190.5)}`);
  });
});
