import { useTranslation } from 'react-i18next';
import { Info, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
 * Alloggiati tab of the booking detail (CO-11): honest status, legal deadline in Europe/Rome, per-guest data to
 * copy on the Questura portal (one card per guest of the stay with its completeness, CO-12) and the
 * manual-submission declaration.
 */
export function AlloggiatiBookingPanel({ bookingId, checkInDate }: AlloggiatiBookingPanelProps) {
  const { t, i18n } = useTranslation();
  const { data: status, isLoading, isError, refetch } = useAlloggiatiStatus(bookingId);
  const { hasPermission } = useWorkspace();

  return (
    <Card data-testid="booking-alloggiati-section">
      <CardHeader>
        <CardTitle>{t('booking.detailPage.alloggiatiWeb')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
              <p className="flex items-start gap-2 rounded-md bg-orange-50 p-3 text-sm text-orange-800" data-testid="alloggiati-manual-notice">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                {t('alloggiati.manualNotice')}
              </p>
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

        <div className="border-t pt-4">
          <AlloggiatiGuestSummary
            bookingId={bookingId}
            canEdit={hasPermission('short-rent', 'booking.write')}
            canRevealDocuments={hasPermission('short-rent', 'guest.read')}
          />
        </div>
      </CardContent>
    </Card>
  );
}
