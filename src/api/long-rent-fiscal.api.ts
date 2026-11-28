import axios from '@/lib/axios';
import { withJsonErrorBody } from '@/lib/file-download';
import type { LeaseContractType, LeaseTaxRegime } from '@/types';
import { ApiClient } from './client';

export type LongRentFiscalTaxStatus = 'CedolareEstimated' | 'OrdinaryNotEstimated' | 'RegimeUnknown';

export type LongRentFiscalRateBasis = 'Standard' | 'ConcordatoAta';

export interface LongRentFiscalTax {
  status: LongRentFiscalTaxStatus;
  rate: number | null;
  rateBasis: LongRentFiscalRateBasis | null;
  amountEur: number | null;
}

export interface LongRentFiscalRow {
  leaseId: string;
  propertyId: string;
  propertyName: string;
  tenantFirstName: string | null;
  tenantLastName: string | null;
  tenantAnonymized: boolean;
  contractType: LeaseContractType;
  taxRegime: LeaseTaxRegime | null;
  startDate: string;
  currentTermEndDate: string;
  monthsInYear: number;
  monthlyRentEur: number;
  accrualEur: number;
  collectedEur: number | null;
  trackedFrom: string | null;
  collectedIsPartial: boolean;
  tax: LongRentFiscalTax;
  notes: string[];
}

export interface LongRentFiscalTotals {
  leases: number;
  accrualEur: number;
  collectedEur: number;
  cedolareEur: number;
  cedolareLeases: number;
  notEstimatedLeases: number;
}

export interface LongRentFiscalReport {
  year: number;
  generatedOn: string;
  rows: LongRentFiscalRow[];
  totals: LongRentFiscalTotals;
}

export function longRentFiscalFileName(year: number): string {
  return `casazen-stima-fiscale-affitti-lunghi-${year}.csv`;
}

export const longRentFiscalApi = {
  getReport: (year: number) => ApiClient.get<LongRentFiscalReport>('/long-rent/fiscal', { year }),

  downloadCsv: async (year: number): Promise<Blob> => {
    try {
      const res = await axios.get<Blob>('/long-rent/fiscal/export', { params: { year, format: 'csv' }, responseType: 'blob' });
      return res.data;
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },
};
