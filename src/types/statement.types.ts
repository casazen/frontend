export interface OwnerStatement {
  id: string;
  propertyOwnerId: string;
  ownerName: string;
  propertyId: string;
  propertyName: string;
  month: number;
  year: number;
  currency: string;
  status: StatementStatus;
  totalRevenue: number;
  commission: number;
  expenses: number;
  withholdingTax: number;
  netPayable: number;
  ownershipPercent: number;
  publishedAt: string | null;
  createdAt: string;
}

export type StatementStatus = 'Draft' | 'Approved' | 'Published';

export interface StatementLine {
  id: string;
  statementId: string;
  type: StatementLineType;
  bookingId: string | null;
  label: string | null;
  description: string | null;
  grossRevenue: number;
  commission: number;
  expenses: number;
  withholding: number;
  cashYear: number;
  stayYear: number | null;
  attachmentUrl: string | null;
  createdAt: string;
}

export type StatementLineType = 'Booking' | 'OtaRevenue' | 'Expense' | 'Adjustment';

export interface StatementFilters {
  propertyOwnerId?: string;
  propertyId?: string;
  status?: StatementStatus;
}

export interface GenerateStatementRequest {
  propertyOwnerId: string;
  propertyId: string;
  month: number;
  year: number;
}
