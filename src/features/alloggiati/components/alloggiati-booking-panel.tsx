import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAlloggiatiStatus } from '@/queries/use-alloggiati';
import { useWorkspace } from '@/hooks/use-workspace';
import { AlloggiatiStatusBadge } from './alloggiati-status-badge';
import { AlloggiatiGuestSummary } from './alloggiati-guest-summary';
import { MarkSentManuallyButton } from './resend-button';
import { formatRomeDateTime, isAlloggiatiSent } from '../alloggiati-status.utils';

interface AlloggiatiBookingPanelProps {
  bookingId: string;
  checkInDate: string;
}

/**
 * Alloggiati part of the booking detail (CO-11): honest status, legal deadline in Europe/Rome, per-guest data to
 * copy on the Questura portal (one card per guest of the stay with its completeness, CO-12), the record file to upload
 * on the portal (CO-13) and the manual-submission declaration. It has no box and no title of its own: the page puts it in a
 * section named "Alloggiati Web" (SR-05).
 */
export function AlloggiatiBookingPanel({ bookingId, checkInDate }: AlloggiatiBookingPanelProps) {
  const { t, i18n } = useTranslation();
  const { data: status, isLoading, isError, refetch } = useAlloggiatiStatus(bookingId);
  const { hasPermission } = useWorkspace();

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
            <AlloggiatiStatusBadge status={status.status} isOverdue={status.isOverdue} />
          </div>

          {!isAlloggiatiSent(status.status) && (
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
          {!status.dataComplete && (
            <p className="text-sm text-destructive">{t('booking.detailPage.incompleteGuestData')}</p>
          )}

          <MarkSentManuallyButton
            bookingId={bookingId}
            status={status.status}
            checkInDate={checkInDate}
            reportedAt={status.reportedAt}
          />
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
