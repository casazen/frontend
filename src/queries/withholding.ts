import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { withholdingApi } from '@/api/withholding.api';
import { saveBlobAs } from '@/lib/file-download';
import axios from '@/lib/axios';
import type { RecordPaymentRequest } from '@/types';

const WITHHOLDING_KEY = 'withholding';

/**
 * Get withholding summary for a given month and year (ADR-018-R6, ADR-018-R7).
 * Per AC-NF18-6: summary by owner/apartment.
 */
export function useWithholdingSummary(month: number, year: number) {
  return useQuery({
    queryKey: [WITHHOLDING_KEY, 'summary', month, year],
    queryFn: () => withholdingApi.getSummary(month, year),
    refetchOnMount: 'always' as const,
  });
}

/**
 * Get F24 preview for a given month and year (ADR-018-R8, ADR-018-R9).
 * Tax code 1919, reference month/year, total amount, due date.
 */
export function useF24Preview(month: number, year: number) {
  return useQuery({
    queryKey: [WITHHOLDING_KEY, 'f24', month, year],
    queryFn: () => withholdingApi.getF24Preview(month, year),
    refetchOnMount: 'always' as const,
  });
}

/**
 * Download withholding statement as PDF or Excel.
 * Usage: await downloadWithholdingStatement(month, year, 'pdf');
 */
export async function downloadWithholdingStatement(
  month: number,
  year: number,
  format: 'pdf' | 'excel'
): Promise<void> {
  const response = await axios.get('/api/withholding/download', {
    params: { month, year, format },
    responseType: 'blob',
  });
  const extension = format === 'pdf' ? 'pdf' : 'xlsx';
  const filename = `withholding-${year}-${String(month).padStart(2, '0')}.${extension}`;
  saveBlobAs(response.data, filename);
}

/**
 * Download F24 PDF for a given month and year (ADR-018-R9).
 * Usage: await downloadF24(month, year);
 */
export async function downloadF24(month: number, year: number): Promise<void> {
  const response = await axios.get('/api/withholding/f24/download', {
    params: { month, year },
    responseType: 'blob',
  });
  const filename = `f24-${year}-${String(month).padStart(2, '0')}.pdf`;
  saveBlobAs(response.data, filename);
}

/**
 * Record F24 payment (ADR-018, AC-NF18-10).
 * Mutation to mark F24 as paid.
 */
export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: RecordPaymentRequest) => withholdingApi.recordPayment(request),
    onSuccess: (_, variables) => {
      // Invalidate F24 preview to show updated payment status
      queryClient.invalidateQueries({
        queryKey: [WITHHOLDING_KEY, 'f24', variables.month, variables.year],
      });
    },
  });
}
