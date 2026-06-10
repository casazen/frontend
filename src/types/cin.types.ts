export type CinStatus = 'valid' | 'missing' | 'invalid';

export interface CinComplianceItem {
  propertyId: string;
  propertyName: string;
  cinCode: string | null;
  cinStatus: CinStatus;
  city: string;
}

export interface CinComplianceSummary {
  valid: number;
  missing: number;
  invalid: number;
  daysUntilDeadline: number;
  deadline: string;
  hasNonCompliant: boolean;
}

export interface CinComplianceResponse {
  items: CinComplianceItem[];
  totalCount: number;
  summary: CinComplianceSummary;
}

export interface UpdatePropertyCinRequest {
  cinCode: string | null;
}
