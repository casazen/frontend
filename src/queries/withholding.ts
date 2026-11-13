import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { withholdingApi } from '@/api/withholding.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { saveDownload } from './save-download';
import type { RecordPaymentRequest } from '@/types';

const WITHHOLDING_KEY = 'withholding';

/**
 * The withholding of a month by owner (ADR-018). Read again every time the page opens and soon after: a payout confirmed in the month-end close changes it.
 */
export function useWithholdingSummary(month: number, year: number) {
  return useQuery({
    queryKey: [WITHHOLDING_KEY, 'summary', month, year],
    queryFn: () => withholdingApi.getSummary(month, year),
    refetchOnMount: 'always' as const,
    staleTime: 30_000,
  });
}

/**
 * Saves the stored F24 data of a month as a PDF, under the name the server gave it (`f24-<year>-<month>.pdf`); `fallbackName` when the page cannot read it.
 * The bytes are not kept (the mutation returns nothing and is dropped when nothing watches it).
 */
export function useDownloadF24() {
  return useMutation({
    mutationFn: ({ month, year, fallbackName }: { month: number; year: number; fallbackName: string }) =>
      saveDownload(withholdingApi.downloadF24Pdf(month, year), fallbackName),
    gcTime: 0,
  });
}

/**
 * Records that an F24 was paid. It cannot be undone and it is the administrator's word, so the mutation is dropped as soon as nothing watches it
 * (`gcTime: 0`) and keeps of a failure only the server's answer. The F24 and the reconciliation of the year are read again after it, as the server now has them.
 */
export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: RecordPaymentRequest) => {
      try {
        return await withholdingApi.recordPayment(request);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSettled: () => queryClient.invalidateQueries({ queryKey: [WITHHOLDING_KEY] }),
  });
}
