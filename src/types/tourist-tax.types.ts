// Tourist Tax Rate types matching the backend (TouristTaxRate entity, TouristTaxRateRequest body)

/** How the amount was checked against its source: U (official) / D (deduced) / T (third party), RS-7 legend. */
export const TOURIST_TAX_RATE_VERIFICATIONS = ['Official', 'Deduced', 'ThirdParty'] as const;

export type TouristTaxRateVerification = (typeof TOURIST_TAX_RATE_VERIFICATIONS)[number];

/** Fixed amount per person per night, or percentage of the night price per person with an optional cap (BK-03). */
export const TOURIST_TAX_CALCULATION_METHODS = ['PerPersonPerNight', 'PercentOfNightlyPrice'] as const;

export type TouristTaxCalculationMethod = (typeof TOURIST_TAX_CALCULATION_METHODS)[number];

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

/** The fields of a rate the amount depends on (shared by the admin rate, the public page and the wizard). */
export interface TouristTaxRateRule {
  calculationMethod: TouristTaxCalculationMethod;
  ratePerPersonPerNight: number;
  percentOfNightlyPrice: number | null;
  capPerPersonPerNight: number | null;
  maxNights: number | null;
  minimumAge: number;
  /** Guests from `minimumAge` up to this age included pay `reducedRatePerPersonPerNight`. */
  reducedRateMaxAge: number | null;
  reducedRatePerPersonPerNight: number | null;
  /** Yearly season `MM-dd`..`MM-dd`, both null for the whole year. */
  seasonStart: string | null;
  seasonEnd: string | null;
}

export interface TouristTaxRate extends TouristTaxRateRule {
  id: string;
  city: string;
  /** ISTAT code of the comune (6 digits). */
  istatCode: string | null;
  regionCode: string;
  /** Accommodation category as named by the comune; null for every accommodation. */
  accommodationCategory: string | null;
  isActive: boolean;
  effectiveFrom: Date | string;
  effectiveTo: Date | string | null;
  notes: string;
  /** URL of the page or act of the comune the rate comes from. */
  sourceUrl: string | null;
  verificationLevel: TouristTaxRateVerification | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/** Body of both create (POST) and update (PUT): the id is never sent, the server generates it. */
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
  /** Date only, `YYYY-MM-DD`. */
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string | null;
  sourceUrl?: string | null;
  verificationLevel?: TouristTaxRateVerification | null;
}

/** PUT replaces every field of the rate. */
export type UpdateTouristTaxRateDto = CreateTouristTaxRateDto;
