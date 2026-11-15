import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ProofArchiveTable } from '@/features/compliance/components/proof-archive-table';
import { getHttpStatus } from '@/lib/api-errors';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { useBookingCompliance, useDownloadProof } from '@/queries/compliance-archive';
import type { ComplianceSendLogLine } from '@/types';

const LONG_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
const LONG_DATE_TIME: Intl.DateTimeFormatOptions = { ...LONG_DATE, hour: '2-digit', minute: '2-digit' };

/** The kinds of the send log and the ways to send that have words of their own: any other value gets the generic ones, never its raw name. */
const LOG_KINDS: ReadonlySet<string> = new Set(['AlloggiatiGuests', 'IstatPeriod', 'TouristTaxPeriod']);
const LOG_SENDERS: ReadonlySet<string> = new Set(['CasaZen', 'ChannelManager', 'Manual']);

/** Newest first, whatever order the server sent them in (the one that was last made is the one the host looks for). */
function newestFirst<T>(items: readonly T[], when: (item: T) => string): T[] {
  return [...items].sort((left, right) => Date.parse(when(right)) - Date.parse(when(left)));
}

/** What was sent for the stay, who sent it and when: one line of the log. A line the channel manager holds says «affidato», never «inviato»: it is the channel manager that sends. */
function SendLogRow({ line }: { line: ComplianceSendLogLine }) {
  const { t, i18n } = useTranslation();
  const kind = LOG_KINDS.has(line.kind) ? line.kind : 'other';
  const sender = LOG_SENDERS.has(line.sender) ? line.sender : 'other';
  // A declaration of the host carries the day it said it sent it, not a moment: no time of the day is told for it.
  const when = formatRomeDateTime(line.sentAt, i18n.language, line.sender === 'Manual' ? LONG_DATE : LONG_DATE_TIME);

  return (
    <li className="min-w-0 space-y-0.5 p-4" data-testid={`send-log-row-${line.id}`}>
      <p className="break-words font-medium">{t(`complianceArchive.booking.log.kind.${kind}`)}</p>
      <p className="break-words text-sm">
        {sender === 'Manual' && line.sentBy
          ? t('complianceArchive.booking.log.sender.ManualBy', { name: line.sentBy })
          : t(`complianceArchive.booking.log.sender.${sender}`)}
      </p>
      <p className="break-words text-sm text-foreground/70">
        {when}
        {line.reference ? ` · ${t('complianceArchive.booking.log.reference', { reference: line.reference })}` : ''}
      </p>
    </li>
  );
}

interface BookingComplianceRecordsProps {
  bookingId: string;
  /** False while the section is not offered (the connector is off, the person cannot read bookings, the stay owes nothing): nothing is asked then. */
  enabled: boolean;
}

/**
 * What CasaZen holds for one stay (E20/F01/US02, NF-47): the proofs of its arrival day and the log of what was sent for it, newest first, with the download of each
 * proof (`GET /api/bookings/{id}/compliance`, the way the archive of the proofs lists them: one component, not a copy). It shows only what the server holds and says so
 * when there is nothing: no proof is invented and none is inferred from the log. It reads again whenever the page opens and when an event of the stay arrives, so an open
 * page shows a new receipt without a reload. A stay that is not found (404) is told so whatever the cache still holds, and a read that fails is never shown as an empty list.
 */
export function BookingComplianceRecords({ bookingId, enabled }: BookingComplianceRecordsProps) {
  const { t } = useTranslation();
  const archive = useBookingCompliance(bookingId, enabled);
  const download = useDownloadProof();
  const proofsTitleId = useId();
  const logTitleId = useId();

  if (!enabled) return null;

  // The query keeps its last data when a read fails: a 404 is «not found» whatever it still holds.
  if (archive.isError && getHttpStatus(archive.error) === 404) {
    return (
      <p className="text-sm text-foreground/70" data-testid="booking-records-not-found">
        {t('complianceArchive.booking.notFound')}
      </p>
    );
  }

  if (!archive.data) {
    return archive.isError ? (
      <div className="space-y-2" data-testid="booking-records-error">
        <p role="alert" className="text-sm text-destructive">
          {t('complianceArchive.booking.loadError')}
        </p>
        <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => void archive.refetch()}>
          {t('complianceArchive.booking.retry')}
        </Button>
      </div>
    ) : (
      <p role="status" aria-busy="true" className="text-sm text-foreground/70" data-testid="booking-records-loading">
        {t('complianceArchive.booking.loading')}
      </p>
    );
  }

  const proofs = newestFirst(archive.data.proofs ?? [], (entry) => entry.receivedAt);
  const log = newestFirst(archive.data.sendLog ?? [], (line) => line.sentAt);

  return (
    <div className="space-y-6" data-testid="booking-compliance-records">
      {archive.isError ? (
        // A later read failed: what is on the screen may be older than what the server holds, and the person is told.
        <div className="flex flex-wrap items-center gap-2" role="status" data-testid="booking-records-stale">
          <p className="text-sm text-foreground/70">{t('complianceArchive.booking.stale')}</p>
          <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => void archive.refetch()}>
            {t('complianceArchive.booking.retry')}
          </Button>
        </div>
      ) : null}

      <section aria-labelledby={proofsTitleId} className="min-w-0 space-y-2">
        <h3 id={proofsTitleId} className="text-base font-semibold">
          {t('complianceArchive.booking.proofsTitle')}
        </h3>
        {proofs.length > 0 ? (
          <ProofArchiveTable items={proofs} downloading={download.isPending} onDownload={(entry) => download.mutate(entry)} />
        ) : (
          <p className="text-sm text-foreground/70" data-testid="booking-proofs-empty">
            {t('complianceArchive.booking.proofsEmpty')}
          </p>
        )}
      </section>

      <section aria-labelledby={logTitleId} className="min-w-0 space-y-2">
        <h3 id={logTitleId} className="text-base font-semibold">
          {t('complianceArchive.booking.logTitle')}
        </h3>
        {log.length > 0 ? (
          <ul className="divide-y divide-border rounded-xl border border-border" aria-label={t('complianceArchive.booking.logLabel')} data-testid="booking-send-log">
            {log.map((line) => (
              <SendLogRow key={line.id} line={line} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-foreground/70" data-testid="booking-log-empty">
            {t('complianceArchive.booking.logEmpty')}
          </p>
        )}
      </section>
    </div>
  );
}
