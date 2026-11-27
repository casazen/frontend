import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountantPackageApi, accountantPackageFileName } from '@/api/accountant-package.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import type { SaveAccountantPackageSettingsRequest } from '@/types';
import { saveDownload } from './save-download';

/** Root of the query keys of the accountant package: the summary of every period lives under it. */
export const ACCOUNTANT_PACKAGE_KEY = 'accountant-package';

export const accountantPackageKeys = {
  summary: (period: string) => [ACCOUNTANT_PACKAGE_KEY, 'agency-summary', period] as const,
};

/**
 * How the package is sent to the accountant. Not under {@link ACCOUNTANT_PACKAGE_KEY}: the summary is read again whenever a document is issued (`use-notifications-realtime.ts`), and that must
 * not read the settings of the send again while the person is typing them.
 */
const ACCOUNTANT_SETTINGS_KEY = ['accountant-package-settings'] as const;

/**
 * The summary of the agency for a month (`2026-10`) or a year (`2026`). Its figures change on other screens and by other hands (a document issued, a payment recorded, an invoice made out to
 * an owner), none of which knows this page, and the query client does not read again on mount: so every visit reads again (`'always'`), a read more than half a minute old is stale, and an
 * issued document told by the notification channel reads it again at once (`use-notifications-realtime.ts`). The summary of one period is never shown for another: nothing of the last
 * period is kept while the next one comes. `null` when the server refuses it to the caller (403); a 404 is the module being off at the server, whatever the cache still holds.
 */
export function useAgencySummary(period: string, enabled = true) {
  return useQuery({
    queryKey: accountantPackageKeys.summary(period),
    queryFn: () => accountantPackageApi.getAgencySummary(period),
    enabled,
    refetchOnMount: 'always' as const,
    staleTime: 30_000,
  });
}

/** What the download needs besides the period: a way to stop it, and to hear how many bytes of the ZIP came so far. */
interface DownloadRequest {
  period: string;
  signal?: AbortSignal;
  onProgress?: (bytes: number) => void;
}

/**
 * Downloads the package of a period and saves it under the name the server gave it, or `casazen-commercialista-<period>.zip` when the page cannot read the header. The package holds money and
 * personal data, so nothing of it is kept: the mutation is dropped as soon as nothing watches it (`gcTime: 0`), the file goes to the disk inside its function (never into the cache of the
 * mutations) and a failure keeps only the answer of the server, without the request that carried the access token (`saveDownload`). It says nothing itself: the page tells the refusals (422
 * `accountant_package_too_large` with the number of files, 403, 404) next to the button, and a call the person stopped is not a failure.
 */
export function useDownloadAccountantPackage() {
  return useMutation({
    mutationFn: ({ period, signal, onProgress }: DownloadRequest): Promise<void> =>
      saveDownload(accountantPackageApi.download(period, { signal, onProgress }), accountantPackageFileName(period)),
    gcTime: 0,
  });
}

/**
 * How the package is sent to the accountant (E15/F02/US02/T01): the address, the monthly send, its day and its folders, and what the last send ended in. It holds the address of a third party, so
 * nothing of it is kept once the page is left (`gcTime: 0`); it is read again whenever a page opens and a read more than a moment old is stale, because the last send changes by itself (the
 * monthly run) and by another hand (a test send, a save on another device). The wizard keeps what the person typed in its own form and never lays the server's answer over it, so a read that comes
 * while they type changes nothing under their hands. `null` when the server refuses it to the caller (403: its reach is only some of the properties); a 404 is the module being off at the server.
 */
export function useAccountantPackageSettings(enabled: boolean) {
  return useQuery({
    queryKey: ACCOUNTANT_SETTINGS_KEY,
    queryFn: () => accountantPackageApi.getSettings(),
    enabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always' as const,
  });
}

/**
 * Saves the settings of the send as a whole (`PUT api/accountant-package/settings`). They hold the address of a third party, so the mutation is dropped as soon as nothing observes it (`gcTime: 0`,
 * the cache of the mutations keeps results for five minutes otherwise) and a refusal is kept without the request that was sent (`withoutRequest`): the status and the body of the answer stay, which
 * is what the wizard turns into words and into the fields to fix. The answer is what the settings are now.
 */
export function useSaveAccountantPackageSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: async (body: SaveAccountantPackageSettingsRequest) => {
      try {
        return await accountantPackageApi.updateSettings(body);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(ACCOUNTANT_SETTINGS_KEY, saved);
    },
  });
}

/**
 * «Send a test» (`POST api/accountant-package/send`): the package of the last month goes to the saved address of the accountant. The answer says «queued» and nothing more (never that it arrived);
 * a send is recorded in the settings (the month it was for), so they are read again whether it worked or not. Nothing is kept once nothing observes the mutation (`gcTime: 0`), and a failure is
 * kept without its request (`withoutRequest`).
 */
export function useSendAccountantPackageTest() {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: async () => {
      try {
        return await accountantPackageApi.sendTest();
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ACCOUNTANT_SETTINGS_KEY });
    },
  });
}
