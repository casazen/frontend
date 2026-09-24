// Tourist Tax Rate types matching the backend (TouristTaxRate entity, TouristTaxRateRequest body)

/** How the amount was checked against its source: U (official) / D (deduced) / T (third party), RS-7 legend. */
export const TOURIST_TAX_RATE_VERIFICATIONS = ['Official', 'Deduced', 'ThirdParty'] as const;

export type TouristTaxRateVerification = (typeof TOURIST_TAX_RATE_VERIFICATIONS)[number];

export interface TouristTaxRate {
  id: string;
  city: string;
  regionCode: string;
  ratePerPersonPerNight: number;
  maxNights: number | null;
  minimumAge: number;
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
  ratePerPersonPerNight: number;
  maxNights?: number | null;
  minimumAge: number;
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

export interface TouristTaxCalculationRequest {
  city: string;
  numberOfAdults: number;
  numberOfChildren: number;
  checkInDate: Date | string;
  checkOutDate: Date | string;
}

export interface TouristTaxCalculationResponse {
  city: string;
  taxAmount: number;
  numberOfAdults: number;
  numberOfChildren: number;
  nights: number;
  checkInDate: Date | string;
  checkOutDate: Date | string;
}
