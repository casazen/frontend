import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '@/i18n/config';
import * as publicSeoQueries from '@/queries/use-public-seo';
import type { PublicTouristTaxCalculateResponse, PublicTouristTaxRateSummary } from '@/types/seo.types';
import { TouristTaxCalculatorWidget } from './tourist-tax-calculator-widget';

vi.mock('@/queries/use-public-seo');

const mutateAsync = vi.fn();

/** Firenze as seeded from the RS-7 research: 6,00 €, max 7 nights, exempt under 12. */
const firenze: PublicTouristTaxRateSummary = {
  city: 'Firenze',
  accommodationCategory: null,
  calculationMethod: 'PerPersonPerNight',
  ratePerPersonPerNight: 6,
  percentOfNightlyPrice: null,
  capPerPersonPerNight: null,
  maxNights: 7,
  minimumAge: 12,
  reducedRateMaxAge: null,
  reducedRatePerPersonPerNight: null,
  seasonStart: null,
  seasonEnd: null,
  effectiveFrom: '2025-02-01T00:00:00Z',
  effectiveTo: null,
  sourceUrl: 'https://servizi.comune.fi.it/delibera.pdf',
};

function mockMutation(data?: PublicTouristTaxCalculateResponse) {
  vi.mocked(publicSeoQueries.useCalculateTouristTax).mockReturnValue({
    mutateAsync,
    data,
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof publicSeoQueries.useCalculateTouristTax>);
}

function response(overrides: Partial<PublicTouristTaxCalculateResponse>): PublicTouristTaxCalculateResponse {
  return {
    comuneSlug: 'firenze',
    city: 'Firenze',
    status: 'Calculated',
    taxAmount: 36,
    numberOfAdults: 2,
    numberOfChildren: 1,
    nights: 3,
    taxableNights: 3,
    ageRulesApply: true,
    categories: [],
    checkInDate: '2026-10-10',
    checkOutDate: '2026-10-13',
    ...overrides,
  };
}

describe('TouristTaxCalculatorWidget', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    mutateAsync.mockReset();
    mockMutation();
  });

  afterEach(() => {
    cleanup();
  });

  it('TouristTaxCalculatorWidget_ComuneWithoutRate_ShowsRateUnavailableInsteadOfTheCalculator', () => {
    render(<TouristTaxCalculatorWidget comuneSlug="palermo" comuneName="Palermo" rates={[]} />);

    expect(screen.getByTestId('tourist-tax-rate-unavailable')).toHaveTextContent(
      'Tariffa non ancora disponibile per Palermo',
    );
    expect(screen.queryByTestId('tax-calculate-button')).not.toBeInTheDocument();
  });

  it('TouristTaxCalculatorWidget_ExemptionByAge_AsksTheAgesAndShowsTheBackendAmount', async () => {
    mutateAsync.mockResolvedValue(response({}));
    const { rerender } = render(<TouristTaxCalculatorWidget comuneSlug="firenze" comuneName="Firenze" rates={[firenze]} />);

    expect(screen.getByTestId('tourist-tax-rate-summary')).toHaveTextContent(
      '6,00 € a persona per notte · massimo 7 notti tassate · esenti sotto i 12 anni',
    );
    fireEvent.change(screen.getByTestId('tax-children-input'), { target: { value: '1' } });
    fireEvent.change(await screen.findByLabelText('Minore 1'), { target: { value: '10' } });
    fireEvent.click(screen.getByTestId('tax-calculate-button'));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ comuneSlug: 'firenze', numberOfAdults: 2, numberOfChildren: 1, childrenAges: [10] }),
    );

    mockMutation(response({}));
    rerender(<TouristTaxCalculatorWidget comuneSlug="firenze" comuneName="Firenze" rates={[firenze]} />);
    expect(screen.getByTestId('tax-calculation-result')).toHaveTextContent('Tassa stimata: 36,00 €');
  });

  it('TouristTaxCalculatorWidget_RateUnavailableForTheDates_ShowsTheStatusNotAGenericError', () => {
    mockMutation(response({ status: 'RateUnavailable', taxAmount: null, taxableNights: 0 }));

    render(<TouristTaxCalculatorWidget comuneSlug="firenze" comuneName="Firenze" rates={[firenze]} />);

    expect(screen.getByTestId('tax-calculation-status')).toHaveTextContent(
      'Tariffa non disponibile per queste date',
    );
    expect(screen.queryByTestId('tax-calculation-error')).not.toBeInTheDocument();
  });
});
