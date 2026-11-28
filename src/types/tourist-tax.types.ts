export const TOURIST_TAX_RATE_VERIFICATIONS = ['Official', 'Deduced', 'ThirdParty'] as const;

export type TouristTaxRateVerification = (typeof TOURIST_TAX_RATE_VERIFICATIONS)[number];

export const TOURIST_TAX_CALCULATION_METHODS = ['PerPersonPerNight', 'PercentOfNightlyPrice'] as const;

type TouristTaxCalculationMethod = (typeof TOURIST_TAX_CALCULATION_METHODS)[number];

/**
 * Outcome of a tourist tax quote (backend `TouristTaxQuoteStatus`). Only `Calculated` has an amount:
 * `RateUnavailable` / `CategoryRequired` mean CasaZen cannot compute it (not included in the total, never 0),
 * the others ask for a missing input.
 */
export type TouristTaxQuoteStatus =
  | 'Calculated'
  | 'RateUnavailable'
  | 'CategoryRequired'
  | 'ChildAgesRequired'
  | 'NightlyPriceRequired';

export interface TouristTaxRateRule {
  calculationMethod: TouristTaxCalculationMethod;
  ratePerPersonPerNight: number;
  percentOfNightlyPrice: number | null;
  capPerPersonPerNight: number | null;
  maxNights: number | null;
  minimumAge: number;
  reducedRateMaxAge: number | null;
  reducedRatePerPersonPerNight: number | null;
  seasonStart: string | null;
  seasonEnd: string | null;
}

export interface TouristTaxRate extends TouristTaxRateRule {
  id: string;
  city: string;
  istatCode: string | null;
  regionCode: string;
  accommodationCategory: string | null;
  isActive: boolean;
  effectiveFrom: Date | string;
  effectiveTo: Date | string | null;
  notes: string;
  sourceUrl: string | null;
  verificationLevel: TouristTaxRateVerification | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateTouristTaxRateDto {
  city: string;
  regionCode: string;
  istatCode?: string | null;
  accommodationCategory?: string | null;
  seasonStart?: string | null;
  seasonEnd?: string | null;
  calculationMethod?: TouristTaxCalculationMethod;
  ratePerPersonPerNight: number;
  percentOfNightlyPrice?: number | null;
  capPerPersonPerNight?: number | null;
  maxNights?: number | null;
  minimumAge: number;
  reducedRateMaxAge?: number | null;
  reducedRatePerPersonPerNight?: number | null;
  isActive?: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string | null;
  sourceUrl?: string | null;
  verificationLevel?: TouristTaxRateVerification | null;
}

export type UpdateTouristTaxRateDto = CreateTouristTaxRateDto;
