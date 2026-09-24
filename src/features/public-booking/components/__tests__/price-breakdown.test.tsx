import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import i18n from '@/i18n/config';
import { PriceBreakdown } from '../price-breakdown';

const calculatedZero = { status: 'Calculated' as const, amount: 0 };

describe('PriceBreakdown', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('it');
  });

  it('PriceBreakdown_ThreeNightsItalian_ShowsNottiNotNottei', () => {
    render(<PriceBreakdown nights={3} nightlyRate={120} cleaningFee={0} touristTax={calculatedZero} totalAmount={360} />);

    const breakdown = screen.getByTestId('price-breakdown');
    expect(breakdown).toHaveTextContent(/3 notti x/);
    expect(breakdown).not.toHaveTextContent(/nottei/);
  });

  it('PriceBreakdown_OneNightItalian_ShowsSingularNotte', () => {
    render(<PriceBreakdown nights={1} nightlyRate={120} cleaningFee={0} touristTax={calculatedZero} totalAmount={120} />);

    expect(screen.getByTestId('price-breakdown')).toHaveTextContent(/1 notte x/);
  });

  it('PriceBreakdown_ThreeNightsEnglish_ShowsNightsNotNighti', async () => {
    await i18n.changeLanguage('en');
    render(<PriceBreakdown nights={3} nightlyRate={120} cleaningFee={0} touristTax={calculatedZero} totalAmount={360} />);

    const breakdown = screen.getByTestId('price-breakdown');
    expect(breakdown).toHaveTextContent(/3 nights x/);
    expect(breakdown).not.toHaveTextContent(/nighti/);
  });

  it('PriceBreakdown_CalculatedTax_ShowsTheBackendAmountAsIncluded', () => {
    render(
      <PriceBreakdown
        nights={3}
        nightlyRate={100}
        cleaningFee={50}
        touristTax={{ status: 'Calculated', amount: 36 }}
        totalAmount={386}
      />,
    );

    const line = screen.getByTestId('tourist-tax-line');
    expect(line).toHaveTextContent('Tassa di soggiorno (inclusa nel totale)');
    expect(line).toHaveTextContent('36,00 €');
    expect(screen.getByTestId('price-breakdown-total')).toHaveTextContent('386,00 €');
  });

  it('PriceBreakdown_RateUnavailable_SaysSoAndShowsNoAmount', () => {
    render(
      <PriceBreakdown
        nights={2}
        nightlyRate={100}
        cleaningFee={50}
        touristTax={{ status: 'RateUnavailable', amount: null }}
        totalAmount={250}
      />,
    );

    expect(screen.getByTestId('tourist-tax-line')).toHaveTextContent('Tariffa non disponibile');
    expect(screen.getByTestId('tourist-tax-unavailable')).toBeInTheDocument();
    expect(screen.getByTestId('tourist-tax-line')).not.toHaveTextContent('€');
  });
});
