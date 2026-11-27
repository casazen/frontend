import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { swissComplianceApi } from '@/api/swissCompliance.api';
import { COMPLIANCE_KEY } from '@/features/compliance/use-compliance';
import { contentDispositionFileName } from '@/features/document-archive/document-file';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import i18n from '@/i18n/config';
import { getHttpStatus, getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs } from '@/lib/file-download';
import type { DeclareSwissDayRequest, DeclareTicinoDayRequest, TicinoNotificationRequest, UploadSwissReceiptForm } from '@/types/swissCompliance.types';

export const TICINO_POLICE_KEY = 'ticino-police';

export const ticinoDayKey = (propertyId: string, date?: string) => [TICINO_POLICE_KEY, propertyId, date ?? ''] as const;

const ALREADY_DECLARED_CODE = 'ticino_day_already_declared';

export function isAlreadyDeclaredConflict(error: unknown): boolean {
  return isAxiosError(error) && getHttpStatus(error) === 409 && getProblemCode(error.response?.data) === ALREADY_DECLARED_CODE;
}

export function useTicinoDay(propertyId: string, date?: string) {
  return useQuery({
    queryKey: ticinoDayKey(propertyId, date),
    queryFn: () => swissComplianceApi.getTicinoDay(propertyId, date),
    enabled: Boolean(propertyId),
    staleTime: 15_000,
    refetchOnMount: 'always',
  });
}

function refreshAfterChange(queryClient: QueryClient, propertyId: string): void {
  void queryClient.invalidateQueries({ queryKey: [TICINO_POLICE_KEY, propertyId] });
  void queryClient.invalidateQueries({ queryKey: [COMPLIANCE_KEY] });
}

/**
 * Downloads the file of the day for notifiche.ti.ch (the server names it; the name here is the same). It holds the guests of the day: it is saved and let go, never
 * kept (the mutation returns nothing), and a refusal is kept without the request. A day that is closed answers 409 until the person confirms: that failure is the
 * layer's to ask about (no toast), and the days are read again so that it can say who declared the day and when.
 */
export function useDownloadTicinoFile(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: async (request: TicinoNotificationRequest) => {
      try {
        const blob = await swissComplianceApi.downloadTicinoFile(propertyId, request);
        saveBlobAs(blob, `notifiche-ti-${request.reportDate}.${request.format}`);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TICINO_POLICE_KEY, propertyId] });
      toast.success(i18n.t('swiss.file.downloaded'));
    },
    onError: (error) => {
      if (isAlreadyDeclaredConflict(error)) {
        void queryClient.invalidateQueries({ queryKey: [TICINO_POLICE_KEY, propertyId] });
        return;
      }
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('swiss.file.downloadFailed'));
    },
  });
}

export function useDownloadGroupSheet(propertyId: string) {
  return useMutation({
    gcTime: 0,
    mutationFn: async ({ bookingId, day }: { bookingId: string; day: string }) => {
      try {
        const { blob, contentDisposition } = await swissComplianceApi.downloadGroupSheet(propertyId, bookingId);
        saveBlobAs(blob, contentDispositionFileName(contentDisposition) ?? `scheda-gruppo-ti-${day}.csv`);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: () => {
      toast.success(i18n.t('swiss.file.groupSheetDownloaded'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('swiss.file.groupSheetFailed'));
    },
  });
}

export function useDeclareTicinoDay(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: async (request: DeclareTicinoDayRequest) => {
      try {
        return await swissComplianceApi.declareTicinoDay(propertyId, request);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (declaration) => {
      refreshAfterChange(queryClient, propertyId);
      toast.success(i18n.t(declaration.created ? 'swiss.declare.done' : 'swiss.declare.alreadyDone'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('swiss.declare.failed'));
    },
  });
}

/** The host takes the declaration back (it was not uploaded after all): the day is to notify again, unless a receipt of the portal closes it. */
export function useUndeclareTicinoDay(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: async (arrivalDay: string) => {
      try {
        await swissComplianceApi.undeclareTicinoDay(propertyId, arrivalDay);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: () => {
      refreshAfterChange(queryClient, propertyId);
      toast.success(i18n.t('swiss.declare.undone'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('swiss.declare.undoFailed'));
    },
  });
}

export const SWISS_NOTIFICATION_KEY = 'swiss-notification';

export const swissDayKey = (propertyId: string, date?: string) => [SWISS_NOTIFICATION_KEY, propertyId, date ?? ''] as const;

/**
 * One arrival day of the assisted notification of a property in a canton other than Ticino (E31/F02/US02/T02, NF-131): the guests as data ready to copy, with what they lack, the
 * portal and the deadline. `date` empty = the oldest day still to notify. The guests of a day change from other screens (a check-in, a booking edited, a co-host declaring it), where this
 * one is not watched: it is read again every time it opens, and what was read a moment ago is not asked twice. The reader looks at a refusal (404, 403, 422) before `data`: TanStack Query
 * keeps the old data of a read that fails, and a 404 is «not found» with it too. A read that fails for another reason (the line, a 5xx) with the day on screen leaves the day where it
 * is, with a line to read it again. `enabled` is false for a screen that must not ask (the module is off, the person may not read the guests): nothing is sent.
 */
export function useSwissDay(propertyId: string, date?: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: swissDayKey(propertyId, date),
    queryFn: () => swissComplianceApi.getSwissDay(propertyId, date),
    enabled: Boolean(propertyId) && (options.enabled ?? true),
    staleTime: 15_000,
    refetchOnMount: 'always',
  });
}

function refreshSwissAfterChange(queryClient: QueryClient, propertyId: string): void {
  void queryClient.invalidateQueries({ queryKey: [SWISS_NOTIFICATION_KEY, propertyId] });
  void queryClient.invalidateQueries({ queryKey: [COMPLIANCE_KEY] });
}

export function useDeclareSwissDay(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: async (request: DeclareSwissDayRequest) => {
      try {
        return await swissComplianceApi.declareSwissDay(propertyId, request);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (declaration) => {
      refreshSwissAfterChange(queryClient, propertyId);
      toast.success(i18n.t(declaration.created ? 'swissNotification.declare.done' : 'swissNotification.declare.alreadyDone'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('swissNotification.declare.failed'));
    },
  });
}

export function useUndeclareSwissDay(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: async (arrivalDay: string) => {
      try {
        await swissComplianceApi.undeclareSwissDay(propertyId, arrivalDay);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: () => {
      refreshSwissAfterChange(queryClient, propertyId);
      toast.success(i18n.t('swissNotification.declare.undone'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('swissNotification.declare.undoFailed'));
    },
  });
}

/**
 * Files a document of the Swiss archive for the day: the receipt of the portal (it closes the day by itself, and is then declared with the receipt, so that who did it
 * and when are on the day and the other hosts are told), the authorization of the parents or the sheet of a group. The file holds the personal data of guests: the
 * mutation is dropped as soon as nothing watches it (`gcTime: 0`) and a refusal is kept without the request, which carries the file.
 */
export function useRecordTicinoDocument(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: async (form: UploadSwissReceiptForm) => {
      try {
        const receipt = await swissComplianceApi.uploadReceipt(propertyId, form);
        if (form.type !== 'Police') return { type: form.type, declared: null };
        try {
          await swissComplianceApi.declareTicinoDay(propertyId, { arrivalDay: form.reportDate, receiptId: receipt.id });
          return { type: form.type, declared: true };
        } catch {
          return { type: form.type, declared: false };
        }
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (outcome) => {
      refreshAfterChange(queryClient, propertyId);
      if (outcome.type === 'ParentalAuthorization') toast.success(i18n.t('swiss.receipt.parental.success'));
      else if (outcome.type === 'GroupSheet') toast.success(i18n.t('swiss.receipt.group.success'));
      else if (outcome.declared === false) toast.warning(i18n.t('swiss.receipt.uploadSuccessNotDeclared'));
      else toast.success(i18n.t('swiss.receipt.uploadSuccess'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('swiss.receipt.uploadFailed'));
    },
  });
}
