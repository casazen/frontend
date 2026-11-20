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
import type { DeclareTicinoDayRequest, TicinoNotificationRequest, UploadSwissReceiptForm } from '@/types/swissCompliance.types';

/** The root of the days of the Ticino police notification (`GET …/swiss/ticino-notification`): an event about the property reads them again (`use-notifications-realtime.ts`). */
export const TICINO_POLICE_KEY = 'ticino-police';

/** The key of one arrival day of a property (`date` empty: the one the server picks, the oldest still to notify). */
export const ticinoDayKey = (propertyId: string, date?: string) => [TICINO_POLICE_KEY, propertyId, date ?? ''] as const;

/** The code of the 409 of a file of a day that is declared uploaded (or has a receipt) and was asked without the person's confirmation. */
const ALREADY_DECLARED_CODE = 'ticino_day_already_declared';

/** Whether a failure is the 409 that asks the person to confirm a new file of a closed day (another host closed the day while the layer was open). */
export function isAlreadyDeclaredConflict(error: unknown): boolean {
  return isAxiosError(error) && getHttpStatus(error) === 409 && getProblemCode(error.response?.data) === ALREADY_DECLARED_CODE;
}

/**
 * One arrival day of the Ticino police notification of a property (casazen/backend#979); `date` empty = the oldest day still to notify. The guests of a day change
 * from other screens (a check-in, a booking edited, a co-host declaring it), where this one is not watched: it is read again every time it opens, and what was read a
 * moment ago is not asked twice. The reader looks at `isError` before `data`: TanStack Query keeps the old data of a read that fails, and a 404 is «not found» with it too.
 */
export function useTicinoDay(propertyId: string, date?: string) {
  return useQuery({
    queryKey: ticinoDayKey(propertyId, date),
    queryFn: () => swissComplianceApi.getTicinoDay(propertyId, date),
    enabled: Boolean(propertyId),
    staleTime: 15_000,
    refetchOnMount: 'always',
  });
}

/** What changed when the day moved on: the days of the property and the cockpit with the counter of the menu (the days still to notify are a section of its summary). */
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
      // How many times the file of the day was generated is on the day: a file asked for again later is known to be another one.
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

/** Downloads the sheet of a group of six or more persons (decision D11): the personal data of its members, saved and let go. */
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

/**
 * The host says the file of the day was uploaded to the portal (E30/F02/US02/T01, NF-128): the day leaves the days to notify, the cockpit and the counter of the
 * menu read again, and the other hosts of the property are told by the server. A day declared already (by a co-host) is not an error: the answer says `created: false`.
 */
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
          // The receipt is filed and it closes the day by itself: only who declared it, and when, is missing. The person is told so.
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
