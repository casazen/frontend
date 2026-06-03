export interface CinComplianceStats {
  valid: number;
  missing: number;
  invalid: number;
  total: number;
}

export interface OtaSyncHealth {
  synced: number;
  failed: number;
  neverSynced: number;
}

export interface AdminStats {
  totalProperties: number;
  activeProperties: number;
  totalBookings: number;
  bookingsThisMonth: number;
  upcomingCheckIns: number;
  totalRevenue: number;
  cinCompliance: CinComplianceStats;
  otaSyncHealth: OtaSyncHealth;
}

export interface CinComplianceItem {
  propertyId: string;
  propertyName: string;
  ownerId: string;
  ownerEmail: string;
  cinCode: string | null;
  cinStatus: 'valid' | 'missing' | 'invalid';
  city: string;
}

export interface JobStatus {
  jobName: string;
  cronExpression: string;
  lastRun: string | null;
  lastStatus: 'Succeeded' | 'Failed' | 'Processing' | 'Enqueued' | 'Unknown';
  nextRun: string | null;
}
