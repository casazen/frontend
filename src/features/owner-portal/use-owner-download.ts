import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs } from '@/lib/file-download';

/**
 * The download of a file of the portal (a document, the attachment of a message): one at a time, with the failure kept for the page to say in words. The server writes the
 * download before it hands the file out; the name it is saved under is chosen by the caller (`safeDownloadName`). Nothing of the file is kept after it is saved.
 */
export function useOwnerDownload() {
  const { t } = useTranslation();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);

  const download = useCallback(
    async (key: string, read: () => Promise<Blob>, fileName: string) => {
      setFailure(null);
      setBusyKey(key);
      try {
        saveBlobAs(await read(), fileName);
      } catch (error) {
        setFailure({ key, message: getProblemMessage(error, t) ?? t('ownerPortal.documents.downloadFailed') });
      } finally {
        setBusyKey(null);
      }
    },
    [t],
  );

  return { download, busyKey, failure };
}
