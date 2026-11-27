import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs } from '@/lib/file-download';

/**
 * The download of a file of the portal (a document, the attachment of a message): one at a time. The server writes the download before it hands the file out; the name it is
 * saved under is chosen by the caller (`safeDownloadName`). Nothing of the file is kept after it is saved. A failure is said in words in a toast, as the downloads of the app
 * do (UX round 2026-11): it is news about a click, not a red box that stays in the list.
 */
export function useOwnerDownload() {
  const { t } = useTranslation();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const download = useCallback(
    async (key: string, read: () => Promise<Blob>, fileName: string) => {
      setBusyKey(key);
      try {
        saveBlobAs(await read(), fileName);
      } catch (error) {
        toast.error(getProblemMessage(error, t) ?? t('ownerPortal.documents.downloadFailed'));
      } finally {
        setBusyKey(null);
      }
    },
    [t],
  );

  return { download, busyKey };
}
