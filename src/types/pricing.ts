export interface PricingAdapterConfigDto {
  propertyId: string;
  isEnabled: boolean;
  adaptationFrequency: 'daily' | 'weekly';
  includeSeasonality: boolean;
  includePublicHolidays: boolean;
  lastAdaptedAt: string | null;
  nextScheduledRunAt: string;
}

export interface PricingHistoryItemDto {
  id: string;
  adaptationDate: string;
  previousPrice: number;
  newPrice: number;
  changeReason: string;
  aiConfidence: number;
  syncStatus: 'pending' | 'synced' | 'failed';
}

export interface PricingHistoryPageDto {
  items: PricingHistoryItemDto[];
  total: number;
  page: number;
}

export interface PricingPreviewItemDto {
  date: string;
  suggestedPrice: number;
  basePrice: number;
  reason: string;
}

export interface PricingPreviewDto {
  prices: PricingPreviewItemDto[];
}

export interface CreateOrUpdatePricingAdapterConfigRequest {
  isEnabled: boolean;
  adaptationFrequency: 'daily' | 'weekly';
  includeSeasonality: boolean;
  includePublicHolidays: boolean;
}

export interface PricingHistoryFilters {
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}
