export type AdaptationFrequency = 'daily' | 'weekly';

export type PricingOtaSyncStatus = 'synced' | 'partial' | 'failed';

export interface PricingAdapterConfig {
  propertyId: string;
  isEnabled: boolean;
  adaptationFrequency: AdaptationFrequency;
  includeSeasonality: boolean;
  includePublicHolidays: boolean;
  lastAdaptedAt: string | null;
  nextScheduledRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SavePricingAdapterConfigRequest {
  isEnabled: boolean;
  adaptationFrequency: AdaptationFrequency;
  includeSeasonality: boolean;
  includePublicHolidays: boolean;
}

export interface PricingHistoryEntry {
  id: string;
  propertyId: string;
  adaptationDate: string;
  previousPrice: number;
  newPrice: number;
  changeReason: string;
  aiConfidence: number;
  otasSynced: string;
  syncStatus: PricingOtaSyncStatus;
  createdAt: string;
}

export interface PricingHistoryPagedResponse {
  items: PricingHistoryEntry[];
  total: number;
  page: number;
}

export interface PricingHistoryQueryParams {
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface PricingPreviewDay {
  date: string;
  suggestedPrice: number;
  basePrice: number;
  reason: string;
}

export interface PricingPreviewResponse {
  prices: PricingPreviewDay[];
}

export interface TriggerSyncResponse {
  jobId: string;
}
