import type { ReactNode } from 'react';
import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Loader2, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfirmOnSiteRequestEmail } from '@/queries/use-public-booking';
import { getProblemMessage } from '@/lib/api-errors';
import { buildOrgBookingPath } from '@/lib/booking-url';
import { formatRomeDateTime } from '@/lib/stay-dates';
import type { OnSiteRequestConfirmation, PublicOrgDto } from '@/types';

interface PublicBookingContext {
  org: PublicOrgDto;
}

/**
 * Page of the link in the "request received" email of a "pay at the property" request (BK-06, decision D5, A3-06). The
 * guest confirms the address with a click (never on page load, so a mail scanner opening the link confirms nothing);
 * only then the request goes to the host, who accepts or declines it.
 */
export function OnSiteRequestConfirmPage() {
  const { t } = useTranslation();
  const { orgSlug = '', bookingId = '' } = useParams<{ orgSlug: string; bookingId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { org } = useOutletContext<PublicBookingContext>();
  const confirm = useConfirmOnSiteRequestEmail();

  const backLink = (
    <Button asChild variant="outline" className="w-full">
      <Link to={buildOrgBookingPath(orgSlug)}>{t('publicBooking.backToProperties')}</Link>
    </Button>
  );

  if (!bookingId || !token) {
    return (
      <div className="mx-auto max-w-lg space-y-4 text-center" data-testid="onsite-confirm-invalid">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
        <p role="alert">{t('publicBooking.onSiteRequest.linkIncomplete')}</p>
        {backLink}
      </div>
    );
  }

  if (confirm.isSuccess) {
    return <ConfirmedRequest result={confirm.data} backLink={backLink} />;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 text-center" data-testid="onsite-confirm-page">
      <MailCheck className="mx-auto h-12 w-12 text-amber-700" />
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">{t('publicBooking.onSiteRequest.confirmTitle')}</h2>
        <p className="text-muted-foreground">
          {t('publicBooking.onSiteRequest.confirmDescription', { orgName: org.displayName })}
        </p>
      </div>
      {confirm.isError && (
        <p className="text-sm text-destructive" role="alert" data-testid="onsite-confirm-error">
          {getProblemMessage(confirm.error, t) ?? t('publicBooking.onSiteRequest.confirmError')}
        </p>
      )}
      <Button
        className="w-full"
        disabled={confirm.isPending}
        onClick={() => confirm.mutate({ bookingId, token })}
      >
        {confirm.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('publicBooking.onSiteRequest.confirming')}
          </>
        ) : (
          t('publicBooking.onSiteRequest.confirmAction')
        )}
      </Button>
      {backLink}
    </div>
  );
}

function ConfirmedRequest({
  result,
  backLink,
}: {
  result: OnSiteRequestConfirmation;
  backLink: ReactNode;
}) {
  const { t, i18n } = useTranslation();

  const message = (() => {
    if (result.status === 'Confirmed') return t('publicBooking.onSiteRequest.alreadyAccepted');
    if (result.status === 'Cancelled') return t('publicBooking.onSiteRequest.closed');
    return result.requestExpiresAt
      ? t('publicBooking.onSiteRequest.sentToHost', {
          date: formatRomeDateTime(result.requestExpiresAt, i18n.language),
        })
      : t('publicBooking.onSiteRequest.sentToHostNoDate');
  })();

  return (
    <div className="mx-auto max-w-lg space-y-6 text-center" data-testid="onsite-confirm-done">
      <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">{t('publicBooking.onSiteRequest.confirmedTitle')}</h2>
        <p className="text-muted-foreground">{message}</p>
      </div>
      <div className="bg-card rounded-lg p-4 space-y-2 text-left">
        <p className="text-xs font-medium text-muted-foreground">{t('publicBooking.bookingReference')}</p>
        <p className="font-mono text-lg font-semibold">{result.bookingId}</p>
      </div>
      {backLink}
    </div>
  );
}
