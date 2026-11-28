import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs } from '@/lib/file-download';

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
