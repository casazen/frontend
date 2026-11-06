import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ReportPeriod } from '@/api/reports.api';
import { touristTaxSummaryApi } from '@/api/tourist-tax-summary.api';
import i18n from '@/i18n/config';
import { getTouristTaxErrorMessage, getTouristTaxFieldErrors } from '@/lib/tourist-tax-summary-errors';
import type { RecordTouristTaxRemittanceInput } from '@/types';

export const TOURIST_TAX_SUMMARY_KEY = 'tourist-tax-summary';

/**
 * The tourist tax per comune for the days of `period` (NF-100): owed, paid, balance and the payments, as the server sends them.
 * `enabled` is false while the days are not a period the server accepts (the page says why, the server is not asked). The summary is
 * read again at every visit, since the bookings and the payments change it from other screens, and the previous one stays on screen
 * while the next loads.
 */
export function useTouristTaxSummary(period: ReportPeriod, enabled = true) {
  return useQuery({
    queryKey: [TOURIST_TAX_SUMMARY_KEY, period.from, period.to],
    queryFn: () => touristTaxSummaryApi.getSummary(period),
    enabled,
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}

/**
 * Records a payment of the tourist tax, with its receipt when one is sent. A failure that a field of the form explains (the comune is
 * not one of the host's, the amount, the days) is shown next to that field by the dialog, which stays open with everything typed;
 * any other failure (a missing permission, no network) has no field and is told by a toast. Every summary is read again.
 */
export function useRecordTouristTaxRemittance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RecordTouristTaxRemittanceInput) => touristTaxSummaryApi.recordRemittance(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TOURIST_TAX_SUMMARY_KEY] });
      toast.success(i18n.t('reports.touristTax.record.success'));
    },
    onError: (error) => {
      if (Object.keys(getTouristTaxFieldErrors(error)).length > 0) return;
      toast.error(getTouristTaxErrorMessage(error, i18n.t) ?? i18n.t('reports.touristTax.errors.recordFailed'));
    },
  });
}

/**
 * Deletes a wrong entry: the payment and its receipt. The summaries are read again after a failure too: the payment may be gone
 * already (deleted from another screen), and the page should show what is there.
 */
export function useDeleteTouristTaxRemittance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => touristTaxSummaryApi.deleteRemittance(id),
    onSuccess: () => {
      toast.success(i18n.t('reports.touristTax.remittances.delete.success'));
    },
    onError: (error) => {
      toast.error(getTouristTaxErrorMessage(error, i18n.t) ?? i18n.t('reports.touristTax.errors.deleteFailed'));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [TOURIST_TAX_SUMMARY_KEY] });
    },
  });
}

/** Downloads the receipt of a payment (the caller saves the blob); a failure is told by a toast. */
export function useDownloadTouristTaxReceipt() {
  return useMutation({
    mutationFn: (id: string) => touristTaxSummaryApi.downloadReceipt(id),
    onError: (error) => {
      toast.error(getTouristTaxErrorMessage(error, i18n.t) ?? i18n.t('reports.touristTax.errors.receiptDownloadFailed'));
    },
  });
}

/** Downloads the summary of the days as a CSV (the caller saves the blob); a failure is told by a toast. */
export function useDownloadTouristTaxSummaryCsv() {
  return useMutation({
    mutationFn: (period: ReportPeriod) => touristTaxSummaryApi.downloadCsv(period),
    onError: (error) => {
      toast.error(getTouristTaxErrorMessage(error, i18n.t) ?? i18n.t('reports.touristTax.errors.csvDownloadFailed'));
    },
  });
}
