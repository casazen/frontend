import axios from '@/lib/axios';
import { withJsonErrorBody } from '@/lib/file-download';
import type { LeaseContractType, LeaseTaxRegime } from '@/types';
import { ApiClient } from './client';

/** How the tax of a lease is estimated (backend `LongRentFiscalTaxStatus`). */
export type LongRentFiscalTaxStatus = 'CedolareEstimated' | 'OrdinaryNotEstimated' | 'RegimeUnknown';

/** Why a cedolare rate is the one it is (backend `CedolareRateBasis`). */
export type LongRentFiscalRateBasis = 'Standard' | 'ConcordatoAta';

/**
 * The tax estimated for a lease. Rate, basis and amount only with `CedolareEstimated`: the rate is the one of the tax advisory of
 * the lease (the server holds every figure, none is written here) and the amount is the rent accrued in the year times that rate.
 * An ordinary-regime lease has no figure (it depends on the total income of the landlord), nor has one with no recorded regime.
 */
export interface LongRentFiscalTax {
  status: LongRentFiscalTaxStatus;
  /** A fraction (0.21). */
  rate: number | null;
  rateBasis: LongRentFiscalRateBasis | null;
  amountEur: number | null;
}

/**
 * A lease of the fiscal report. `accrualEur` is by accrual (whole months of the year in force, times the monthly rent, up to the end
 * of the period the lease is in now); `collectedEur` is by cash (the rent paid in the year according to the rent register of CasaZen),
 * `null` when the register holds nothing of the lease. `trackedFrom` is the day the register starts for it; `collectedIsPartial`:
 * that is after the first month of the lease in the year, so the collected rent is only part of what was paid.
 */
export interface LongRentFiscalRow {
  leaseId: string;
  propertyId: string;
  propertyName: string;
  tenantFirstName: string | null;
  tenantLastName: string | null;
  tenantAnonymized: boolean;
  contractType: LeaseContractType;
  /** `null` for an older canone concordato lease that has none recorded. */
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
  /** Codes of the tax advisory of the lease that make the figure uncertain (`leases.rli.advisory.note.<code>`). */
  notes: string[];
}

/** The sums of the rows as the rows show them. */
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
  /** Today in Europe/Rome when the report was made. */
  generatedOn: string;
  rows: LongRentFiscalRow[];
  totals: LongRentFiscalTotals;
}

/** Name of the downloaded file: the estimate and the year, nothing about a person (the one the backend gives it). */
export function longRentFiscalFileName(year: number): string {
  return `casazen-stima-fiscale-affitti-lunghi-${year}.csv`;
}

/** The fiscal report of the long-term area (LR-11b): an estimate per lease, for the accountant. */
export const longRentFiscalApi = {
  getReport: (year: number) => ApiClient.get<LongRentFiscalReport>('/long-rent/fiscal', { year }),

  /** The CSV of the report (`;`, decimal comma, BOM); a problem body (JSON Blob) is parsed so `getProblemMessage` can read it. */
  downloadCsv: async (year: number): Promise<Blob> => {
    try {
      const res = await axios.get<Blob>('/long-rent/fiscal/export', { params: { year, format: 'csv' }, responseType: 'blob' });
      return res.data;
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },
};
