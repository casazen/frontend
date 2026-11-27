import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs, withJsonErrorBody } from '@/lib/file-download';

export function useLetterDownload() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  async function download(fetchPdf: () => Promise<Blob>, fileName: string) {
    if (busy) return;
    setBusy(true);
    try {
      saveBlobAs(await fetchPdf(), fileName);
    } catch (error) {
      toast.error(getProblemMessage(await withJsonErrorBody(error), t) ?? t('leaseOperations.download.failed'));
    } finally {
      setBusy(false);
    }
  }

  return { busy, download };
}
