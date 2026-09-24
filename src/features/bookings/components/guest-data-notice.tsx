import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAlloggiatiStatus } from '@/queries/use-alloggiati';
import { guestDataCompletionPath } from '../lib/stay-actions';

interface GuestDataNoticeProps {
  bookingId: string;
  /** False while the notice is not shown (closed dialog): no request is sent. */
  enabled?: boolean;
  /** Called when the host follows the link to complete the data (e.g. to close a dialog). */
  onNavigate?: () => void;
}

/**
 * Whether the guest data of the stay are complete for Alloggiati Web (CO-08, CO-12). Never blocking: when data are
 * missing the arrival and the check-out go on, and the host gets the link to the Alloggiati tab to complete them.
 */
export function GuestDataNotice({ bookingId, enabled = true, onNavigate }: GuestDataNoticeProps) {
  const { t } = useTranslation();
  const { data: status, isLoading, isError } = useAlloggiatiStatus(bookingId, enabled);

  const completeLink = (
    <Link
      to={guestDataCompletionPath(bookingId)}
      onClick={onNavigate}
      className="font-medium text-primary hover:underline"
      data-testid="guest-data-complete-link"
    >
      {t('booking.arrival.completeGuestData')}
    </Link>
  );

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="guest-data-checking">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('booking.arrival.guestDataChecking')}
      </p>
    );
  }

  if (isError || !status) {
    return (
      <div className="space-y-1 text-sm text-muted-foreground" data-testid="guest-data-unknown">
        <p>{t('booking.arrival.guestDataUnknown')}</p>
        {completeLink}
      </div>
    );
  }

  if (status.dataComplete) {
    return (
      <p className="flex items-center gap-2 text-sm text-green-700" data-testid="guest-data-complete">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        {t('booking.arrival.guestDataComplete')}
      </p>
    );
  }

  return (
    <div
      role="status"
      className="space-y-2 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900"
      data-testid="guest-data-incomplete"
    >
      <p className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        {t('booking.arrival.guestDataIncomplete')}
      </p>
      {completeLink}
    </div>
  );
}
