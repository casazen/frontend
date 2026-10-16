import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Download, Loader2 } from 'lucide-react';
import { PlainSection } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { Fact, Facts } from '@/features/bookings/components/booking-facts';
import { guestsApi } from '@/api/guests.api';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs } from '@/lib/file-download';
import { getDocumentTypeLabel } from '@/lib/i18n-labels';
import { formatDate } from '@/lib/utils';
import type { Guest } from '@/types';
import { GuestDocumentNumberRow } from './guest-document-number-row';

const SCAN_EXTENSIONS: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

/** Download of the identity document scan uploaded by the guest (private storage, authenticated and audited). */
function DocumentScanDownload({ guestId }: { guestId: string }) {
  const { t } = useTranslation();
  const download = useMutation({
    mutationFn: () => guestsApi.downloadDocumentScan(guestId),
    onSuccess: (blob) => saveBlobAs(blob, `${t('guests.documentScanFileName')}${SCAN_EXTENSIONS[blob.type] ?? ''}`),
    onError: (error) => {
      toast.error(getProblemMessage(error, t) ?? t('guests.documentScanDownloadFailed'));
    },
  });

  return (
    <div className="pt-4">
      <Button variant="outline" size="sm" onClick={() => download.mutate()} disabled={download.isPending} data-testid="guest-document-scan-download">
        {download.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        {t('guests.downloadDocumentScan')}
      </Button>
    </div>
  );
}

interface GuestDocumentsTabProps {
  guest: Guest;
}

/**
 * The tab Documenti: the identity document of the guest as the API gives it. The number is masked (CO-14) and the full one is
 * asked, audited, only when the host presses "Mostra"; the scan is downloaded through the authenticated endpoint. Nothing here
 * is shown that the page did not show before.
 */
export function GuestDocumentsTab({ guest }: GuestDocumentsTabProps) {
  const { t } = useTranslation();

  return (
    <PlainSection title={t('guests.documents')}>
      {guest.documentNumberMasked ? (
        <Facts>
          <Fact label={t('guests.documentType')}>{guest.documentType ? getDocumentTypeLabel(guest.documentType, t) : '—'}</Fact>
          <GuestDocumentNumberRow guestId={guest.id} masked={guest.documentNumberMasked} />
          <Fact label={t('guests.documentIssueDate')}>{guest.documentIssueDate ? formatDate(guest.documentIssueDate) : '—'}</Fact>
          <Fact label={t('guests.documentExpiryDate')}>{guest.documentExpiryDate ? formatDate(guest.documentExpiryDate) : '—'}</Fact>
          <Fact label={t('guests.documentIssuingCountry')}>{guest.documentIssuingCountry || '—'}</Fact>
        </Facts>
      ) : (
        <p className="text-foreground/70">{t('guests.noDocument')}</p>
      )}
      {guest.hasDocumentScan ? <DocumentScanDownload guestId={guest.id} /> : null}
    </PlainSection>
  );
}
