// The cleaner of a property at the check-out of its stays (E24/F01/US01, NF-120, decision O11): mirrors `PropertyCleaningSetupDtos.cs` and
// `PropertyCleaningSetupController` of the backend (`GET` and `PUT api/properties/{id}/cleaning-setup`, `PUT api/properties/cleaning-setup/bulk`).
// Enums travel as member names; a price is a number of cents of the currency of the property, and never travels without it.

export type PropertyCleanerKind = 'Supplier' | 'Staff';

export interface PropertyCleaningSetup {
  propertyId: string;
  configured: boolean;
  cleanerKind: PropertyCleanerKind | null;
  supplierOrgId: string | null;
  supplierName: string | null;
  supplierIsTrusted: boolean;
  staffUserId: string | null;
  priceCents: number | null;
  currency: string;
  startTime: string | null;
  effectiveStartTime: string;
  durationMinutes: number | null;
  effectiveDurationMinutes: number;
  active: boolean;
  updatedAt: string | null;
}

export interface SaveCleaningSetupDto {
  cleanerKind: PropertyCleanerKind;
  supplierOrgId?: string | null;
  staffUserId?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  startTime?: string | null;
  durationMinutes?: number | null;
  active: boolean;
}

export interface BulkSaveCleaningSetupDto extends SaveCleaningSetupDto {
  propertyIds: string[];
}

interface CleaningSetupBulkResult {
  propertyId: string;
  saved: boolean;
  code: string | null;
  message: string | null;
}

export interface CleaningSetupBulkResponse {
  results: CleaningSetupBulkResult[];
  saved: number;
  failed: number;
}
