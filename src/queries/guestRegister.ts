import { skipToken, useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { guestRegisterApi } from '@/api/guest-register.api';
import { contentDispositionFileName } from '@/features/document-archive/document-file';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { guestRegisterFileName, parseGuestRegisterCsv, type GuestRegisterTable } from '@/features/properties/lib/guest-register-model';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs } from '@/lib/file-download';
import type { GuestRegisterPeriod } from '@/types/guest-register.types';

/** The root of the reads of the guest register (`GET …/swiss/guest-register/info`): a completed check-in changes who is in a period, so an event of a guest reads them again (`use-notifications-realtime.ts`). */
export const GUEST_REGISTER_KEY = 'guest-register';

/** The key of the count of a period of a property (`from` and `to` empty while the period is not one the server can make). */
const guestRegisterInfoKey = (propertyId: string, period: GuestRegisterPeriod | null) =>
  [GUEST_REGISTER_KEY, propertyId, 'info', period?.from ?? '', period?.to ?? ''] as const;

/**
 * What the register of a period holds, before it is downloaded (E31/F02/US02/T01, NF-130): how many lines and how long the host keeps it. Nothing is asked for a period that is not one
 * (`period` null: the screen says what is wrong with it) nor while the person is not meant to see the guests. The guests come and go with the check-ins, and nothing else watches this
 * count, so it is read again every time the layer opens, and what was read a moment ago is not asked twice. The reader looks at `isError` before `data`: TanStack Query keeps the old data
 * of a read that fails, and a 404 or a 403 is told as such with it too.
 */
export function useGuestRegisterInfo(propertyId: string, period: GuestRegisterPeriod | null, options: { enabled?: boolean } = {}) {
  const enabled = propertyId !== '' && period !== null && (options.enabled ?? true);
  return useQuery({
    queryKey: guestRegisterInfoKey(propertyId, period),
    queryFn: enabled && period !== null ? () => guestRegisterApi.getInfo(propertyId, period) : skipToken,
    staleTime: 15_000,
    refetchOnMount: 'always',
  });
}

/**
 * Downloads the CSV of the register of a period and saves it under the name the server gave it. It holds the personal data of the guests: it is saved and let go, never kept (the
 * mutation returns nothing), and a refusal is kept without the request. The file is in the language of the page.
 */
export function useDownloadGuestRegister(propertyId: string) {
  return useMutation({
    gcTime: 0,
    mutationFn: async (period: GuestRegisterPeriod) => {
      try {
        const { blob, contentDisposition } = await guestRegisterApi.download(propertyId, period, i18n.language);
        saveBlobAs(blob, contentDispositionFileName(contentDisposition) ?? guestRegisterFileName(period));
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: () => {
      toast.success(i18n.t('guestRegister.download.done'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('guestRegister.download.failed'));
    },
  });
}

/**
 * Reads the register of a period for the printed sheet: the same file as the download, parsed into the table the sheet draws. The table holds the personal data of the guests, so the
 * mutation never keeps it (it returns nothing, and is dropped as soon as nothing watches it): `onTable` is handed the table and the period it was made for, and it is the caller's to
 * draw it, print it and let it go. A mutation is not cancelled when the screen that started it is gone: `onTable` may be called after the layer was closed, and the caller then ignores it.
 */
export function usePrintGuestRegister(propertyId: string, onTable: (table: GuestRegisterTable, period: GuestRegisterPeriod) => void) {
  return useMutation({
    gcTime: 0,
    mutationFn: async (period: GuestRegisterPeriod) => {
      try {
        const { blob } = await guestRegisterApi.download(propertyId, period, i18n.language);
        onTable(parseGuestRegisterCsv(await blob.text()), period);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('guestRegister.print.failed'));
    },
  });
}
