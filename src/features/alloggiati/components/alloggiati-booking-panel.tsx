import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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

/** The page is read again every time it opens, and a read older than half a minute is not fresh: the guests are written to the channel manager meanwhile (E20/F01). */
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
  const { data: status, isLoading, isError, refetch } = useAlloggiatiStatus(bookingId, true, STATUS_READ);
  const { hasPermission } = useWorkspace();
  const channelView = status ? stayChannelViewOf(status) : null;
  const receiptArchived = channelView === 'receiptArchived';

  return (
    <div className="space-y-4" data-testid="booking-alloggiati-section">
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('alloggiati.loading')}
        </div>
      )}

      {!isLoading && (isError || !status) && (
        <div className="space-y-2" data-testid="booking-alloggiati-error">
          <p className="text-sm text-destructive">{t('alloggiati.statusError')}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            {t('alloggiati.guestSummary.retry')}
          </Button>
        </div>
      )}

      {status && (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">{t('booking.detailPage.communicationStatus')}</span>
            {/* A stay with its receipt archived is not late: whatever the term says, the server holds the proof. */}
            <AlloggiatiStatusBadge status={status.status} isOverdue={receiptArchived ? false : status.isOverdue} receiptArchived={receiptArchived} />
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

              {status.status === 'DaInviareManualmente' && (
                <Alert variant="warning" data-testid="alloggiati-manual-notice">
                  {t('alloggiati.manualNotice')}
                </Alert>
              )}
              {status.status === 'DaInviare' && (
                <p className="text-sm text-muted-foreground">{t('alloggiati.waitingArrivalNotice')}</p>
              )}
              {status.status === 'InviatoManualmente' && (
                <p className="text-sm text-muted-foreground">{t('alloggiati.declaredNotice')}</p>
              )}
              {status.status === 'Inviato' && status.confirmationNumber && (
                <div className="text-sm">
                  <span className="text-muted-foreground">{t('booking.detailPage.confirmation')}</span>
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

              {channelView === null && (
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

      <div className="pt-2">
        <AlloggiatiGuestSummary
          bookingId={bookingId}
          canEdit={hasPermission('short-rent', 'booking.write')}
          canRevealDocuments={hasPermission('short-rent', 'guest.read')}
          canDownloadRecordFile={hasPermission('short-rent', 'guest.read')}
        />
      </div>
    </div>
  );
}
