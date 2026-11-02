import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { leasesApi } from '@/api/leases.api';
import { PlainSection } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs, withJsonErrorBody } from '@/lib/file-download';
import { useLeaseDocuments } from '@/queries/use-lease-documents';
import { useRliChecklist } from '@/queries/use-leases';
import type { LeaseDetail } from '@/types';
import { longDay } from '../lifecycle/lifecycle-format';

type FileKind = 'signed' | 'registration' | 'questura';

interface FileRow {
  kind: FileKind;
  label: string;
  /** When it happened ("firmato il 12 marzo 2026"), when the lease says it. */
  detail: string | null;
  fileName: string;
  fetch: () => Promise<Blob>;
}

/**
 * The files the lease itself keeps, in one place (LR-03c): the contract signed by every party, the receipt of the registration and the
 * receipt of the Questura communication, each one only when it exists, each with its download. They are the three files of the detail
 * of the lease, which used to be found in three places (the signature, the registration and the Questura panels, which keep doing their
 * own work). The papers of the archive are under it, in their own panel, and are not repeated here: a contract or a receipt that was
 * uploaded there stands in the archive and this list leaves it to it. Never an identity document: CasaZen does not keep them (decision
 * LR-D3). Nothing is shown while the lease has none of the three.
 */
export function LeaseFiles({ lease }: { lease: LeaseDetail }) {
  const { t, i18n } = useTranslation();
  const [downloading, setDownloading] = useState<FileKind | null>(null);
  // The same read as the archive panel below (same key): one request, shared.
  const archive = useLeaseDocuments(lease.id);
  // Only a lease with an extra-EU tenant has a Questura communication, so only then is its status asked (the deadlines tab reads it too).
  const checklist = useRliChecklist(lease.id, { enabled: lease.hasExtraEUTenant });

  const archived = new Set((archive.data ?? []).map((document) => document.kind));
  const day = (value: string | null | undefined) => longDay(value, i18n.language);
  const rows: FileRow[] = [];

  if (lease.hasSignedPdf && !archived.has('Contract')) {
    rows.push({
      kind: 'signed',
      label: t('leaseSheet.files.signed'),
      detail: day(lease.stipulaDate) ? t('leaseSheet.files.signedOn', { date: day(lease.stipulaDate) }) : null,
      fileName: `contratto-firmato-${lease.id}.pdf`,
      fetch: () => leasesApi.downloadSignedContract(lease.id),
    });
  }
  if (lease.registration?.hasReceipt && !archived.has('Registration')) {
    rows.push({
      kind: 'registration',
      label: t('leaseSheet.files.registration'),
      detail: day(lease.registration.registrationDate) ? t('leaseSheet.files.registeredOn', { date: day(lease.registration.registrationDate) }) : null,
      fileName: `ricevuta-rli-${lease.id}.pdf`,
      fetch: () => leasesApi.downloadReceipt(lease.id),
    });
  }
  if (checklist.data?.questura?.hasReceipt) {
    rows.push({
      kind: 'questura',
      label: t('leaseSheet.files.questura'),
      detail: day(checklist.data.questura.communicationDate) ? t('leaseSheet.files.sentOn', { date: day(checklist.data.questura.communicationDate) }) : null,
      fileName: `ricevuta-questura-${lease.id}.pdf`,
      fetch: () => leasesApi.downloadQuesturaReceipt(lease.id),
    });
  }

  if (rows.length === 0) return null;

  const download = async (row: FileRow) => {
    setDownloading(row.kind);
    try {
      saveBlobAs(await row.fetch(), row.fileName);
    } catch (error) {
      toast.error(getProblemMessage(await withJsonErrorBody(error), t) ?? t('leaseSheet.files.downloadFailed'));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <PlainSection title={t('leaseSheet.files.title')} data-testid="lease-files">
      <ul role="list" className="divide-y divide-border border-y border-border">
        {rows.map((row) => (
          <li key={row.kind} data-testid={`lease-file-${row.kind}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
            <div className="min-w-0">
              <p className="break-words font-medium">{row.label}</p>
              {row.detail ? <p className="text-sm text-foreground/70">{row.detail}</p> : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={downloading === row.kind}
              disabled={downloading !== null}
              onClick={() => void download(row)}
              aria-label={`${t('leaseSheet.files.download')}: ${row.label}`}
              data-testid={`lease-file-download-${row.kind}`}
            >
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('leaseSheet.files.download')}
            </Button>
          </li>
        ))}
      </ul>
    </PlainSection>
  );
}
