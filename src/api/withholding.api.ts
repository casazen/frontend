import { ApiClient } from './client';
import type {
  WithholdingSummary,
  F24Preview,
  RecordPaymentRequest,
} from '@/types';

/**
 * Withholding tax API (ADR-018).
 * Agency withholding tax calculation, F24 generation, and payment reconciliation.
 */
export const withholdingApi = {
  /**
   * Get withholding summary by month and year (ADR-018-R6, ADR-018-R7).
   * Per AC-NF18-6: summary by owner/apartment.
   * Per AC-NF18-7: downloadable as PDF/Excel.
   */
  getSummary: (month: number, year: number) =>
    ApiClient.get<WithholdingSummary>('/api/withholding/summary', { month, year }),

  /**
   * Get F24 preview for a given month and year (ADR-018-R8, ADR-018-R9).
   * Tax code 1919, reference month/year, total amount, due date 16th of following month.
   */
  getF24Preview: (month: number, year: number) =>
    ApiClient.get<F24Preview>('/api/withholding/f24', { month, year }),

  /**
   * Record F24 payment (ADR-018, AC-NF18-10).
   * Reconciliation: marks the F24 as paid.
   */
  recordPayment: (request: RecordPaymentRequest) =>
    ApiClient.post<void>('/api/withholding/reconcile', request),
};
