import { useMutation } from '@tanstack/react-query';
import { alloggiatiApi } from '@/api/alloggiati.api';
import { saveBlobAs } from '@/lib/file-download';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getHttpStatus } from '@/lib/api-errors';
import { useAlloggiatiStatus } from '@/queries/use-alloggiati';
import { useWorkspace } from '@/hooks/use-workspace';
import { AlloggiatiStatusBadge } from './alloggiati-status-badge';
import { AlloggiatiChannelManagerStatus } from './alloggiati-channel-manager-status';
import { AlloggiatiGuestSummary } from './alloggiati-guest-summary';
import { MarkSentManuallyButton } from './resend-button';
import { stayChannelViewOf } from '../alloggiati-channel-manager';
import { formatRomeDateTime, isAlloggiatiNotDue, isAlloggiatiSent } from '../alloggiati-status.utils';

interface AlloggiatiBookingPanelProps {
  bookingId: string;
  checkInDate: string;
}

const STATUS_READ = { refetchOnMount: 'always', staleTime: 30_000 } as const;

/**
 * Alloggiati part of the booking detail (CO-11): honest status, legal deadline in Europe/Rome, per-guest data to
 * copy on the Questura portal (one card per guest of the stay with its completeness, CO-12), the record file to upload
 * on the portal (CO-13) and the manual-submission declaration. It has no box and no title of its own: the page puts it in a
 * section named "Alloggiati Web" (SR-05).
 *
 * A stay whose guests are on the channel manager (E20/F01/US02) is told as the server says it: «Affidato al channel manager» (yellow) until a receipt is archived,
 * «Ricevuta archiviata» (green) once it is, «Da correggere» when a guest could not be written, each with what the host can do (`AlloggiatiChannelManagerStatus`).
 * The host does not declare a manual send for such a stay: the channel manager is the sender, and two senders send twice. Any other status reads as it always did.
 */
export function AlloggiatiBookingPanel({ bookingId, checkInDate }: AlloggiatiBookingPanelProps) {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError, error, refetch } = useAlloggiatiStatus(bookingId, true, STATUS_READ);
  const { hasPermission } = useWorkspace();
  const notFound = isError && getHttpStatus(error) === 404;
  const status = notFound ? undefined : data;
  const channelView = status && !status.directSubmission ? stayChannelViewOf(status) : null;
  const queued = status?.directSubmission && (status.status === 'DaInviareManualmente' || status.status === 'DaInviare');
  const receiptArchived = channelView === 'receiptArchived';

  return (
    <div className="space-y-4" data-testid="booking-alloggiati-section">
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('alloggiati.loading')}
        </div>
      )}

      {!isLoading && notFound && (
        <p className="text-sm text-muted-foreground" data-testid="booking-alloggiati-not-found">
          {t('alloggiati.statusNotFound')}
        </p>
      )}

      {!isLoading && !notFound && (isError || !status) && (
        <div className="space-y-2" data-testid="booking-alloggiati-error">
          <p className="text-sm text-destructive">{t('alloggiati.statusError')}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            {t('alloggiati.guestSummary.retry')}
          </Button>
        </div>
      )}

      {status && (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm text-muted-foreground">{t('booking.detailPage.communicationStatus')}</span>
            {queued && <span className="font-medium">{t('institutionalPortals.directQueue')}</span>}
            {!queued && <AlloggiatiStatusBadge status={status.status} isOverdue={receiptArchived ? false : status.isOverdue} receiptArchived={receiptArchived} />}
          </div>

          {isAlloggiatiNotDue(status.status) ? (
            <p className="text-sm text-muted-foreground" data-testid="booking-alloggiati-not-due">
              {t('alloggiati.notDueNotice')}
            </p>
          ) : (
            <>
              {!isAlloggiatiSent(status.status) && !receiptArchived && (
                <div className="text-sm" data-testid="booking-alloggiati-deadline">
                  <span className="text-muted-foreground">{t('alloggiati.deadline')}: </span>
                  {formatRomeDateTime(status.deadlineAt, i18n.language)}
                  <span className="text-muted-foreground">
                    {' '}
                    ({t(status.isShortStay ? 'alloggiati.shortStayTerm' : 'alloggiati.ordinaryTerm')})
                  </span>
                </div>
              )}

              {status.status === 'DaInviareManualmente' && !status.directSubmission && !receiptArchived && (
                <Alert variant="warning" data-testid="alloggiati-manual-notice">
                  {t('alloggiati.manualNotice')}
                </Alert>
              )}
              {status.status === 'DaInviare' && !receiptArchived && (
                <p className="text-sm text-muted-foreground">{t('alloggiati.waitingArrivalNotice')}</p>
              )}
              {status.status === 'InviatoManualmente' && !receiptArchived && (
                <p className="text-sm text-muted-foreground">{t('alloggiati.declaredNotice')}</p>
              )}
              {status.status === 'Inviato' && status.confirmationNumber && (
                <div className="text-sm">
                  <span className="text-muted-foreground">{t(status.directSubmission ? 'institutionalPortals.receiptHash' : 'booking.detailPage.confirmation')}</span>
                  {status.confirmationNumber}
                </div>
              )}
              {(status.status === 'Errore' || status.status === 'Rifiutato') && (
                <p className="text-sm text-destructive">{t(`alloggiati.failureNotice.${status.status}`)}</p>
              )}
              {channelView !== null && <AlloggiatiChannelManagerStatus bookingId={bookingId} status={status} view={channelView} />}
              {!status.dataComplete && (
                <p className="text-sm text-destructive">{t('booking.detailPage.incompleteGuestData')}</p>
              )}

              {status.directAttempt === 'TestRejected' && <p role="status">{t('institutionalPortals.testRejected')}</p>}
              {(status.directAttempt === 'PartiallyAccepted' || status.directAttempt === 'TestRejected' || status.directAttempt === 'Rejected') && (
                <ul className="list-disc pl-5 text-sm">
                  {status.directGuests?.map((guest) => (
                    <li key={guest.position}>{t('institutionalPortals.guestOutcome', {
                      number: guest.position + 1, outcome: t(`institutionalPortals.outcomes.${guest.outcome}`),
                    })}</li>
                  ))}
                </ul>
              )}
              {status.canDownloadDirectReceipt && <DirectReceiptDownload key={bookingId} bookingId={bookingId} />}
              {channelView === null && !status.directSubmission && (
                <MarkSentManuallyButton
                  bookingId={bookingId}
                  status={status.status}
                  checkInDate={checkInDate}
                  reportedAt={status.reportedAt}
                />
              )}
            </>
          )}
        </>
      )}

      {status && !isAlloggiatiNotDue(status.status) && (
        <div className="pt-2">
          <AlloggiatiGuestSummary
            bookingId={bookingId}
            canEdit={hasPermission('short-rent', 'booking.write')}
            canRevealDocuments={hasPermission('short-rent', 'guest.read')}
            canDownloadRecordFile={!status.directSubmission && hasPermission('short-rent', 'guest.read')}
          />
        </div>
      )}
    </div>
  );
}

function DirectReceiptDownload({ bookingId }: { bookingId: string }) {
  const { t } = useTranslation();
  const download = useMutation({
    mutationFn: () => alloggiatiApi.downloadDirectReceipt(bookingId),
    onSuccess: (blob) => saveBlobAs(blob, `alloggiati-${bookingId}.pdf`),
  });
  return (
    <>
      <Button disabled={download.isPending} variant="outline" onClick={() => download.mutate()}>{t('institutionalPortals.receipt')}</Button>
      {download.isError && <p role="alert">{t('institutionalPortals.downloadError')}</p>}
    </>
  );
}
