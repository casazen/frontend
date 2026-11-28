export type AdaptationFrequency = 'daily' | 'weekly';

type SeasonalPriceRule = 'None' | 'HighSeason' | 'LowSeason' | 'Holiday';

type ItalianHoliday =
  | 'NewYear'
  | 'Epiphany'
  | 'EasterSunday'
  | 'EasterMonday'
  | 'Liberation'
  | 'Labour'
  | 'Republic'
  | 'Assumption'
  | 'SaintFrancis'
  | 'AllSaints'
  | 'ImmaculateConception'
  | 'Christmas'
  | 'SaintStephen';

export interface SeasonalPricingRules {
  includeSeasonality: boolean;
  highSeasonMonths: number[];
  highSeasonMultiplier: number;
  lowSeasonMonths: number[];
  lowSeasonMultiplier: number;
  includePublicHolidays: boolean;
  holidayMultiplier: number;
}

export interface PricingAdapterConfig extends SeasonalPricingRules {
  propertyId: string;
  isEnabled: boolean;
  adaptationFrequency: AdaptationFrequency;
  lastAdaptedAt: string | null;
  nextRunOn: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SavePricingAdapterConfigRequest extends SeasonalPricingRules {
  isEnabled: boolean;
  adaptationFrequency: AdaptationFrequency;
}

export interface SeasonalSuggestion {
  date: string;
  basePrice: number;
  suggestedPrice: number;
  multiplier: number;
  rule: SeasonalPriceRule;
  holiday: ItalianHoliday | null;
  appliedPrice: number | null;
  appliedAt: string | null;
}

export interface SeasonalSuggestionsResponse {
  isEnabled: boolean;
  currentBasePrice: number;
  computedAt: string | null;
  nextRunOn: string | null;
  items: SeasonalSuggestion[];
}

type SeasonalSuggestionRunStatus = 'Computed' | 'BasePriceMissing';

export interface RecalculateSuggestionsResponse {
  status: SeasonalSuggestionRunStatus;
  days: number;
  computedAt: string | null;
}
