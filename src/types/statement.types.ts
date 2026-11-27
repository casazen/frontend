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
