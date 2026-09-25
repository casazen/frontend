/** Seasonal price suggestions ("Suggerimenti stagionali", D4): rules applied to the property's real nightly rate. */
export type AdaptationFrequency = 'daily' | 'weekly';

/** Rule that produced a suggestion (backend `SeasonalPriceRule`). */
export type SeasonalPriceRule = 'None' | 'HighSeason' | 'LowSeason' | 'Holiday';

/** Italian national public holiday (backend `ItalianHoliday`). */
export type ItalianHoliday =
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

/** The host's explicit rules: months or national holidays with a multiplier of the nightly rate. */
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
  /** Last computation of the suggestions (UTC instant), null if never computed. */
  lastAdaptedAt: string | null;
  /** Europe/Rome date (yyyy-MM-dd) of the next automatic computation, null when disabled or never computed. */
  nextRunOn: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SavePricingAdapterConfigRequest extends SeasonalPricingRules {
  isEnabled: boolean;
  adaptationFrequency: AdaptationFrequency;
}

export interface SeasonalSuggestion {
  /** Stay date, yyyy-MM-dd. */
  date: string;
  /** The property's nightly rate used as base. */
  basePrice: number;
  suggestedPrice: number;
  multiplier: number;
  rule: SeasonalPriceRule;
  holiday: ItalianHoliday | null;
}

export interface SeasonalSuggestionsResponse {
  isEnabled: boolean;
  /** The property's nightly rate now: the price quotes and bookings use. */
  currentBasePrice: number;
  computedAt: string | null;
  nextRunOn: string | null;
  items: SeasonalSuggestion[];
}

export type SeasonalSuggestionRunStatus = 'Computed' | 'BasePriceMissing';

export interface RecalculateSuggestionsResponse {
  status: SeasonalSuggestionRunStatus;
  days: number;
  computedAt: string | null;
}
