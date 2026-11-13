import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { statementsApi } from '@/api/statements.api';
import type {
  StatementFilters,
  GenerateStatementRequest,
} from '@/types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { failureMessage } from '@/lib/agency-finance';
import { getProblemMessage } from '@/lib/api-errors';
import { saveDownload } from './save-download';

const STATEMENTS_KEY = 'statements';

/**
 * List of owner statements, optionally filtered by property owner and/or property.
 * Ordered by year/month descending on the backend. Read again every time a page opens and soon after (`staleTime`): other people of the agency approve and
 * publish too, and a page that is already open must not keep offering a step that is done.
 */
export function useStatements(filters?: StatementFilters) {
  return useQuery({
    queryKey: [STATEMENTS_KEY, filters],
    queryFn: () => statementsApi.getAll(filters),
    refetchOnMount: 'always' as const,
    staleTime: 30_000,
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
 * Approves a Draft statement, locking it for review: the statement can no longer be edited. The mutation is dropped as soon as nothing watches it
 * (`gcTime: 0`) and keeps of a failure the answer of the server without the request (`withoutRequest`). Whatever the answer, the list is read again: the
 * server says what the statement is now (someone else may have approved it), and the page shows that.
 */
export function useApproveStatement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        return await statementsApi.approve(id);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSuccess: () => {
      toast.success(i18n.t('statement.approve.success'));
    },
    onError: (error) => {
      toast.error(failureMessage(error, i18n.t, i18n.t('statement.approve.error'), i18n.t('statement.notFound')));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [STATEMENTS_KEY] }),
  });
}

/**
 * Publishes an Approved statement, sending it to the owner: the statement becomes immutable and a correction goes in the next month's statement. Same
 * rules as the approval.
 */
export function usePublishStatement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        return await statementsApi.publish(id);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSuccess: () => {
      toast.success(i18n.t('statement.publish.success'));
    },
    onError: (error) => {
      toast.error(failureMessage(error, i18n.t, i18n.t('statement.publish.error'), i18n.t('statement.notFound')));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [STATEMENTS_KEY] }),
  });
}

interface StatementFile {
  id: string;
  /** The name the file is saved under when the server does not give one (`Content-Disposition` unreadable or empty). */
  fallbackName: string;
}

/** Downloads a statement as PDF: saved under the name the server gave it, the bytes not kept (the mutation returns nothing and is dropped when nothing watches it). */
export function useDownloadStatementPdf() {
  return useMutation({
    mutationFn: ({ id, fallbackName }: StatementFile) => saveDownload(statementsApi.downloadPdf(id), fallbackName),
    gcTime: 0,
    onError: (error) => {
      toast.error(failureMessage(error, i18n.t, i18n.t('statement.download.pdfError'), i18n.t('statement.notFound')));
    },
  });
}

/** Downloads a statement as CSV. */
export function useDownloadStatementCsv() {
  return useMutation({
    mutationFn: ({ id, fallbackName }: StatementFile) => saveDownload(statementsApi.downloadCsv(id), fallbackName),
    gcTime: 0,
    onError: (error) => {
      toast.error(failureMessage(error, i18n.t, i18n.t('statement.download.csvError'), i18n.t('statement.notFound')));
    },
  });
}
