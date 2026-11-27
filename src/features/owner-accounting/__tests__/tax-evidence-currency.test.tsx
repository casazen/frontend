import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { TaxObligationEvidence } from '@/types';
import { TaxEvidenceView } from '../components/tax-evidence';
import { payoutFacts } from './owner-accounting-fixtures';

/**
 * The currency of a withholding decision (money): a decision that carries its facts says its own (the euro of the F24, whatever the currency of the payout); one of before the facts were read from the ledger
 * does not, and is written in the currency of its payout (the one the service of the time recorded it in); with neither, the figures have no symbol and the page says so. Never a euro the code made up.
 */

const evidence = (overrides: Partial<TaxObligationEvidence> = {}): TaxObligationEvidence => ({
  id: 'ev-1',
  decision: 'Applicable',
  reasonCode: 'applicable',
  jurisdiction: 'IT',
  ruleCode: 'IT-RULE',
  ruleVersion: '2025.1',
  grossBase: 800,
  ratePercent: 21,
  rounding: 'half_up',
  amount: 168,
  taxCode: '1919',
  paidOn: '2025-02-05',
  periodYear: 2025,
  periodMonth: 2,
  reversesEvidenceId: null,
  createdAt: '2025-02-05T09:00:00Z',
  ...overrides,
});

const renderEvidence = (props: Partial<Parameters<typeof TaxEvidenceView>[0]> & { evidence: TaxObligationEvidence }) => render(createElement(MemoryRouter, null, createElement(TaxEvidenceView, props)));

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

afterEach(() => cleanup());

describe('the currency of the evidence of a withholding decision (money)', () => {
  it('TaxEvidence_WithItsFacts_IsInTheEuroOfTheF24_WhateverTheCurrencyOfThePayout', () => {
    renderEvidence({ evidence: evidence({ facts: payoutFacts() }), payoutCurrency: 'CHF' });

    expect(screen.getByTestId('tax-evidence-amount').textContent).toMatch(/168,00\s*€/);
    expect(screen.queryByTestId('tax-evidence-currency-missing')).toBeNull();
  });

  it('TaxEvidence_OfBeforeTheFacts_IsInTheCurrencyOfItsPayout_NeverInAEuroTheCodeMadeUp', () => {
    renderEvidence({ evidence: evidence(), payoutCurrency: 'CHF' });

    const text = screen.getByTestId('tax-evidence').textContent ?? '';
    expect(screen.getByTestId('tax-evidence-amount').textContent).toMatch(/168,00\s*CHF/);
    expect(text).toMatch(/800,00\s*CHF/);
    expect(text).not.toMatch(/€/);
    expect(screen.queryByTestId('tax-evidence-currency-missing')).toBeNull();
  });

  it('TaxEvidence_WithNoCurrencyAtAll_IsWrittenWithoutASymbol_AndSaysSo', () => {
    renderEvidence({ evidence: evidence() });

    expect(screen.getByTestId('tax-evidence-amount').textContent?.trim()).toBe('168,00');
    expect(screen.getByTestId('tax-evidence').textContent).not.toMatch(/€|EUR|CHF/);
    expect(screen.getByTestId('tax-evidence-currency-missing')).toHaveTextContent(i18n.t('ownerAccounting.tax.currencyMissing'));
  });

  it('TaxEvidence_ADecisionThatDoesNotApply_ShowsNoAmountAndNeedsNoSentenceAboutTheCurrency', () => {
    renderEvidence({ evidence: evidence({ decision: 'NotApplicable', reasonCode: 'rule_without_withholding', grossBase: null, ratePercent: null, rounding: null, amount: null, taxCode: null }) });

    expect(screen.queryByTestId('tax-evidence-amount')).toBeNull();
    expect(screen.queryByTestId('tax-evidence-currency-missing')).toBeNull();
  });
});
