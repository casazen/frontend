import { Download, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { formatRomeDateTime, formatStayDate } from '@/lib/stay-dates';
import { COMPLIANCE_PROOF_KINDS, type ComplianceArchiveEntry } from '@/types';
import { formatPeriod } from '../lib/archive-model';

const LONG_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

const SOURCES: ReadonlySet<string> = new Set(['manual_upload', 'casazen_receipt']);

/** What a proof is, in words: a kind this version does not know is just «Prova», never its raw name. */
function kindKey(kind: string): string {
  return COMPLIANCE_PROOF_KINDS.some((candidate) => candidate === kind) ? kind : 'other';
}

interface ProofArchiveTableProps {
  items: readonly ComplianceArchiveEntry[];
  /** A download is under way: every button of the list waits, so a second click cannot start another one. */
  downloading: boolean;
  onDownload: (entry: ComplianceArchiveEntry) => void;
}

/**
 * The files CasaZen actually holds (NF-47): the receipts of the Alloggiati communications, the proofs of ISTAT, the tax receipts and the files of the
 * municipality, newest first. A row says what it proves, for which property and which day or month, where it comes from and until when it is kept, and
 * has one button: «Scarica». It lists only files: nothing that was seen on another screen, said by a person or opened in the area of the channel
 * manager is here. The file comes through the API (a short-lived signed address of the private bucket): the page never builds a storage address.
 */
export function ProofArchiveTable({ items, downloading, onDownload }: ProofArchiveTableProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  return (
    <ul className="divide-y divide-border rounded-xl border border-border" aria-label={t('complianceArchive.proofs.listLabel')} data-testid="proof-archive-table">
      {items.map((entry) => {
        const when = entry.period ? formatPeriod(entry.period, language) : formatStayDate(entry.day, language);
        const kind = t(`complianceArchive.kind.${kindKey(entry.kind)}`);

        return (
          <li key={entry.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 p-4" data-testid={`proof-row-${entry.id}`}>
            <div className="flex min-w-0 grow basis-64 items-start gap-3">
              <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 space-y-0.5">
                <p className="break-words font-medium">{kind}</p>
                <p className="break-words text-sm">
                  {entry.propertyName} · {when}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t(`complianceArchive.source.${SOURCES.has(entry.source) ? entry.source : 'other'}`)} ·{' '}
                  {t('complianceArchive.proofs.receivedOn', { date: formatRomeDateTime(entry.receivedAt, language, LONG_DATE) })}
                </p>
                <p className="text-sm text-muted-foreground">{t('complianceArchive.proofs.keptUntil', { date: formatRomeDateTime(entry.retainUntil, language, LONG_DATE) })}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              disabled={downloading}
              onClick={() => onDownload(entry)}
              aria-label={t('complianceArchive.proofs.downloadLabel', { kind, when })}
              data-testid={`proof-download-${entry.id}`}
            >
              <Download className="size-4" aria-hidden="true" />
              {t('complianceArchive.proofs.download')}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
