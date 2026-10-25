import type { BookingStatus } from './booking.types';

/**
 * Property summary for owner portal (ADR-011-R8): basic property info with occupancy and revenue.
 * Guest data is masked per ADR-011-R3.
 */
export interface OwnerPortalProperty {
  propertyId: string;
  propertyName: string;
  address: string;
  totalBookings: number;
  totalRevenue: number;
  occupancyRate: number;
  recentBookings: OwnerPortalBookingSummary[];
}

/**
 * Booking summary with guest data masked (ADR-011-R3): names NULL, emails NULL, phones NULL.
 * Only dates, channel, and amounts visible.
 */
export interface OwnerPortalBookingSummary {
  bookingId: string;
  checkInDate: string;
  checkOutDate: string;
  channel: string;
  totalAmount: number;
  status: BookingStatus;
}

/**
 * Monthly statement summary for owner portal (ADR-011-R2).
 * Only published statements are visible.
 */
export interface OwnerPortalStatement {
  statementId: string;
  propertyId: string;
  propertyName: string;
  month: number;
  year: number;
  totalRevenue: number;
  agencyCommission: number;
  netAmount: number;
  publishedAt: string;
}

/**
 * Invoice summary for owner portal (ADR-011-R2).
 * Invoices received by the owner from the agency.
 */
export interface OwnerPortalInvoice {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  amount: number;
  description: string;
  isPaid: boolean;
}

/**
 * Withholding tax summary for owner portal (ADR-011-R2).
 * Aggregated withholding information for tax purposes.
 */
export interface OwnerPortalWithholding {
  year: number;
  totalWithheld: number;
  details: OwnerPortalWithholdingDetail[];
}

/**
 * Detailed withholding entry.
 */
export interface OwnerPortalWithholdingDetail {
  propertyId: string;
  propertyName: string;
  month: number;
  amountWithheld: number;
}
