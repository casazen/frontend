import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import i18n from '@/i18n/config';
import type { TouristTaxRate } from '@/types';
import { LATE_EVENING_UTC, NOON_UTC, freezeClock, withBrowserTimeZone } from '@/test/clock';
import { TaxRateForm } from '../components/tax-rate-form';

const rate: TouristTaxRate = {
  id: 'rate-milano',
  city: 'Milano',
  istatCode: '015146',
  regionCode: 'LOM',
  accommodationCategory: null,
  seasonStart: null,
  seasonEnd: null,
  calculationMethod: 'PerPersonPerNight',
  ratePerPersonPerNight: 9.5,
  percentOfNightlyPrice: null,
  capPerPersonPerNight: null,
  maxNights: 14,
  minimumAge: 18,
  reducedRateMaxAge: null,
  reducedRatePerPersonPerNight: null,
  isActive: true,
  effectiveFrom: '2026-01-01T00:00:00Z',
  effectiveTo: null,
  notes: '',
  sourceUrl: null,
  verificationLevel: null,
  createdAt: '2026-09-23T00:00:00Z',
  updatedAt: '2026-09-23T00:00:00Z',
};

function renderForm(existing: TouristTaxRate | null = null) {
  render(<TaxRateForm open onOpenChange={vi.fn()} onSubmit={vi.fn()} existing={existing} />);
}

function dateInput(labelKey: string): HTMLInputElement {
  return screen.getByLabelText(new RegExp(`^${i18n.t(labelKey)}`)) as HTMLInputElement;
}

describe('TaxRateForm dates (QA-CLOCK-FE)', () => {
  withBrowserTimeZone('Europe/Rome');

  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('TaxRateForm_NewRateAt2330UtcOf24September_DefaultsToTodayInRome', () => {
    freezeClock(LATE_EVENING_UTC);

    renderForm();

    expect(dateInput('taxRates.effectiveFrom')).toHaveValue('2026-09-25');
  });

  it('TaxRateForm_NewRateAtNoonUtc_DefaultsToTheSameDate', () => {
    freezeClock(NOON_UTC);

    renderForm();

    expect(dateInput('taxRates.effectiveFrom')).toHaveValue('2026-09-24');
  });

  it('TaxRateForm_ExistingRateWithUtcMidnightDates_ShowsTheCalendarDates', () => {
    renderForm({ ...rate, effectiveFrom: new Date('2026-01-01T00:00:00Z'), effectiveTo: '2026-12-31T00:00:00Z' });

    expect(dateInput('taxRates.effectiveFrom')).toHaveValue('2026-01-01');
    expect(dateInput('taxRates.effectiveTo')).toHaveValue('2026-12-31');
  });
});
