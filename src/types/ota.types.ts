export type OtaPlatform =
  | 'AIRBNB'
  | 'BOOKING_COM'
  | 'EXPEDIA'
  | 'VRBO'
  | 'TRIPADVISOR'
  | 'AGODA';

export type SyncStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED';

export interface OtaCredentials {
  apiKey?: string;
  apiSecret?: string;
  username?: string;
  password?: string;
  propertyId?: string;
}

export interface OtaIntegration {
  id: string;
  platform: OtaPlatform;
  propertyId: string;
  credentials: OtaCredentials;
  isActive: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: SyncStatus;
  syncError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOtaIntegrationDto {
  platform: OtaPlatform;
  propertyId: string;
  credentials: OtaCredentials;
  isActive?: boolean;
}

export interface UpdateOtaIntegrationDto extends Partial<CreateOtaIntegrationDto> {}

export interface SyncResult {
  platform: OtaPlatform;
  status: SyncStatus;
  syncedAt: string;
  bookingsSynced?: number;
  error?: string;
}

export interface SyncAllResult {
  totalSynced: number;
  successful: number;
  failed: number;
  results: SyncResult[];
}

export interface OtaPricingUpdate {
  propertyId: string;
  pricePerNight: number;
  startDate?: string;
  endDate?: string;
  platforms?: OtaPlatform[];
}

export interface ValidationResult {
  platform: OtaPlatform;
  isValid: boolean;
  errors?: string[];
}
