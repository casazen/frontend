/**
 * Withholding tax summary for a given month and year (ADR-018).
 * Per requirement AC-NF18-6: statement per owner/apartment.
 */
export interface WithholdingSummary {
  month: number;
  year: number;
  totalWithheld: number;
  owners: WithholdingOwnerSummary[];
}

/**
 * Withholding summary per owner (ADR-018-R3).
 */
export interface WithholdingOwnerSummary {
  ownerId: string;
  ownerName: string;
  apartments: WithholdingApartmentSummary[];
  totalWithheld: number;
}

/**
 * Withholding summary per apartment.
 */
export interface WithholdingApartmentSummary {
  propertyId: string;
  propertyName: string;
  grossBase: number;
  commission: number;
  withholdingAmount: number;
  cashYear: number;
  stayYear: number;
}

/**
 * F24 form preview data (ADR-018-R8, ADR-018-R9).
 * Tax code 1919, reference month/year, total amount, due date 16th of following month.
 */
export interface F24Preview {
  referenceMonth: number;
  referenceYear: number;
  taxCode: string; // "1919"
  totalAmount: number;
  dueDate: string; // ISO date string
  isPastDue: boolean;
}

/**
 * Payment reconciliation request.
 */
export interface RecordPaymentRequest {
  month: number;
  year: number;
  paidAt: string; // ISO date string
}
