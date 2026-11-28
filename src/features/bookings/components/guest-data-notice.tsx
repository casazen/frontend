import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAlloggiatiStatus } from '@/queries/use-alloggiati';
import { guestDataCompletionPath } from '../lib/stay-actions';

interface GuestDataNoticeBaseProps {
  bookingId: string;
  enabled?: boolean;
}

interface GuestDataNoticeLinkProps extends GuestDataNoticeBaseProps {
  inline?: false;
  onNavigate?: () => void;
}

interface GuestDataNoticeInlineProps extends GuestDataNoticeBaseProps {
  inline: true;
  onComplete: () => void;
  busy?: boolean;
}

type GuestDataNoticeProps = GuestDataNoticeLinkProps | GuestDataNoticeInlineProps;

/**
 * Whether the guest data of the stay are complete for Alloggiati Web (CO-08, CO-12). Never blocking: when data are
 * missing the arrival and the check-out go on. Where to complete them depends on the caller: a link to the Alloggiati tab of the booking
 * (the default, for a dialog that is left behind), or, with `inline`, a button that opens the panel of the data over the wizard the host is in
 * (E08/F04/US01): the notice leads nowhere, and it reads the status again each time it opens, so it shows what the panel saved.
 */
export function GuestDataNotice(props: GuestDataNoticeProps) {
  const { bookingId, enabled = true } = props;
  const { t } = useTranslation();
  const { data: status, isLoading, isError } = useAlloggiatiStatus(bookingId, enabled, props.inline ? { refetchOnMount: 'always' } : {});

  const completeLabel = t('booking.arrival.completeGuestData');
  const completeAction = props.inline ? (
    <Button
      type="button"
      variant="link"
      className="h-auto p-0 font-medium"
      disabled={props.busy}
      onClick={props.onComplete}
      data-testid="guest-data-complete-open"
    >
      {completeLabel}
    </Button>
  ) : (
    <Link
      to={guestDataCompletionPath(bookingId)}
      onClick={props.onNavigate}
      className="font-medium text-primary hover:underline"
      data-testid="guest-data-complete-link"
    >
      {completeLabel}
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
        {completeAction}
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
      {completeAction}
    </div>
  );
}
