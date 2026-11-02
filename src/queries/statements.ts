import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { statementsApi } from '@/api/statements.api';
import type {
  StatementFilters,
  GenerateStatementRequest,
} from '@/types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs } from '@/lib/file-download';

const STATEMENTS_KEY = 'statements';

/**
 * List of owner statements, optionally filtered by property owner and/or property.
 * Ordered by year/month descending on the backend.
 */
export function useStatements(filters?: StatementFilters) {
  return useQuery({
    queryKey: [STATEMENTS_KEY, filters],
    queryFn: () => statementsApi.getAll(filters),
  });
}

/**
 * Generates a new monthly statement for the given owner, property, and period.
 * The statement is created in Draft status with line items for all bookings collected in that month.
 */
export function useGenerateStatement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: GenerateStatementRequest) => statementsApi.generate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STATEMENTS_KEY] });
      toast.success(i18n.t('statement.generate.success'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('statement.generate.error'));
    },
  });
}

/**
 * Approves a Draft statement, locking it for review.
 * The statement can no longer be edited.
 */
export function useApproveStatement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => statementsApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STATEMENTS_KEY] });
      toast.success(i18n.t('statement.approve.success'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('statement.approve.error'));
    },
  });
}

/**
 * Publishes an Approved statement, sending it to the owner.
 * The statement becomes immutable.
 */
export function usePublishStatement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => statementsApi.publish(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STATEMENTS_KEY] });
      toast.success(i18n.t('statement.publish.success'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('statement.publish.error'));
    },
  });
}

/**
 * Downloads a statement as PDF.
 */
export function useDownloadStatementPdf() {
  return useMutation({
    mutationFn: async ({ id, fileName }: { id: string; fileName: string }) => {
      const blob = await statementsApi.downloadPdf(id);
      saveBlobAs(blob, fileName);
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('statement.download.pdfError'));
    },
  });
}

/**
 * Downloads a statement as CSV.
 */
export function useDownloadStatementCsv() {
  return useMutation({
    mutationFn: async ({ id, fileName }: { id: string; fileName: string }) => {
      const blob = await statementsApi.downloadCsv(id);
      saveBlobAs(blob, fileName);
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('statement.download.csvError'));
    },
  });
}
