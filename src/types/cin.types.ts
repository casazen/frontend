export type CinStatus = 'valid' | 'missing' | 'invalid';

export interface CinComplianceItem {
  propertyId: string;
  propertyName: string;
  cinCode: string | null;
  cinStatus: CinStatus;
  city: string;
}

/**
 * Where today stands with respect to the configured CIN deadline (`Cin:ExposureDeadline` on the backend, CO-20):
 * `none` when no deadline is configured (only the obligation is shown, without a date).
 */
export type CinDeadlineStatus = 'none' | 'upcoming' | 'today' | 'passed';

export interface CinComplianceSummary {
  valid: number;
  missing: number;
  invalid: number;
  /** Days from today (Europe/Rome) to the deadline: 0 on the day, negative after it, null without a deadline. */
  daysUntilDeadline: number | null;
  /** Configured deadline (`YYYY-MM-DD`), null when none is set. */
  deadline: string | null;
  deadlineStatus: CinDeadlineStatus;
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
