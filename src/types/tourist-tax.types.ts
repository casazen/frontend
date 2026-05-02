// ✅ Tourist Tax Rate types matching backend

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
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateTouristTaxRateDto {
  city: string;
  regionCode: string;
  ratePerPersonPerNight: number;
  maxNights?: number;
  minimumAge?: number;
  isActive?: boolean;
  effectiveFrom: Date | string;
  effectiveTo?: Date | string;
  notes?: string;
}

export interface UpdateTouristTaxRateDto extends Partial<CreateTouristTaxRateDto> {}

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
