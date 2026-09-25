import type {
  PricingAdapterConfig,
  SeasonalSuggestion,
  SeasonalSuggestionsResponse,
} from '../../src/types';

export const PROPERTY_ID = 'prop-e2e-001';

export const configEnabled: PricingAdapterConfig = {
  propertyId: PROPERTY_ID,
  isEnabled: true,
  adaptationFrequency: 'daily',
  includeSeasonality: true,
  highSeasonMonths: [6, 7, 8],
  highSeasonMultiplier: 1.3,
  lowSeasonMonths: [1, 2, 11, 12],
  lowSeasonMultiplier: 0.8,
  includePublicHolidays: true,
  holidayMultiplier: 1.5,
  lastAdaptedAt: '2026-05-10T02:00:00Z',
  nextRunOn: '2026-05-11',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-10T02:00:00Z',
};

export const configDisabled: PricingAdapterConfig = {
  ...configEnabled,
  isEnabled: false,
  lastAdaptedAt: null,
  nextRunOn: null,
};

/** Suggestions of a property at 180 EUR a night with the example rule, from 2026-05-30. */
function buildSuggestions(count: number): SeasonalSuggestion[] {
  const start = Date.UTC(2026, 4, 30);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start + index * 86_400_000).toISOString().slice(0, 10);
    const month = Number(date.slice(5, 7));
    if (date === '2026-06-02') {
      return { date, basePrice: 180, suggestedPrice: 270, multiplier: 1.5, rule: 'Holiday', holiday: 'Republic' };
    }
    if (month >= 6 && month <= 8) {
      return { date, basePrice: 180, suggestedPrice: 234, multiplier: 1.3, rule: 'HighSeason', holiday: null };
    }
    return { date, basePrice: 180, suggestedPrice: 180, multiplier: 1, rule: 'None', holiday: null };
  });
}

export const suggestionsData: SeasonalSuggestionsResponse = {
  isEnabled: true,
  currentBasePrice: 180,
  computedAt: '2026-05-30T02:00:00Z',
  nextRunOn: '2026-05-31',
  items: buildSuggestions(90),
};

/** Subset used when tests only need a few rows. */
export const suggestionsDataMinimal: SeasonalSuggestionsResponse = {
  ...suggestionsData,
  items: buildSuggestions(7),
};

export const recalculateResponse = { status: 'Computed', days: 90, computedAt: '2026-05-30T10:00:00Z' };
