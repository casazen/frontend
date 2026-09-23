import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import i18n from '@/i18n/config';
import { PriceBreakdown } from '../price-breakdown';

describe('PriceBreakdown', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('it');
  });

  it('PriceBreakdown_ThreeNightsItalian_ShowsNottiNotNottei', () => {
    render(<PriceBreakdown nights={3} nightlyRate={120} cleaningFee={0} touristTaxAmount={0} totalAmount={360} />);

    const breakdown = screen.getByTestId('price-breakdown');
    expect(breakdown).toHaveTextContent(/3 notti x/);
    expect(breakdown).not.toHaveTextContent(/nottei/);
  });

  it('PriceBreakdown_OneNightItalian_ShowsSingularNotte', () => {
    render(<PriceBreakdown nights={1} nightlyRate={120} cleaningFee={0} touristTaxAmount={0} totalAmount={120} />);

    expect(screen.getByTestId('price-breakdown')).toHaveTextContent(/1 notte x/);
  });

  it('PriceBreakdown_ThreeNightsEnglish_ShowsNightsNotNighti', async () => {
    await i18n.changeLanguage('en');
    render(<PriceBreakdown nights={3} nightlyRate={120} cleaningFee={0} touristTaxAmount={0} totalAmount={360} />);

    const breakdown = screen.getByTestId('price-breakdown');
    expect(breakdown).toHaveTextContent(/3 nights x/);
    expect(breakdown).not.toHaveTextContent(/nighti/);
  });
});
