import { useEffect, useState, type ReactNode } from 'react';
import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { buildGuestBookingsPath, buildOrgBookingPath } from '@/lib/booking-url';
import { useSeoMeta } from '@/lib/seo-meta';
import { formatStayDate } from '@/lib/stay-dates';
import { useCancelWithLink, useLinkCancellationPreview } from '@/queries/use-guest-cancellation';
import type { PublicOrgDto } from '@/types';
import { CancellationClosed, CancellationPanel } from './components/cancellation-panel';

interface PublicBookingContext {
  org: PublicOrgDto;
}

/** The answers that say the link does not work (a token that is missing, wrong, expired or already spent; a booking that is not there). */
const LINK_REFUSED_STATUSES: readonly number[] = [400, 404, 422];

/**
 * The page of the link in the email the host sends to cancel a booking, `/book/:orgSlug/bookings/:bookingId/cancel?token=…` (DB-08a,
 * DB-08b): the guest sees what they get back if they cancel today and cancels, with the signed token of the link as the only key. The
 * token is the secret of the link: the page reads it once, takes it out of the address bar (it must not stay in a bookmark, a shared
 * address or the history) and keeps it in memory only, so opening the page again asks for the link of the email again. Never indexed.
 */
export function GuestCancelLinkPage() {
  const { t, i18n } = useTranslation();
  const { orgSlug = '', bookingId = '' } = useParams<{ orgSlug: string; bookingId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { org } = useOutletContext<PublicBookingContext>();
  useSeoMeta({ title: t('guestCancellation.link.pageTitle'), noindex: true });

  const [token] = useState(() => searchParams.get('token')?.trim() ?? '');
  useEffect(() => {
    if (!searchParams.has('token')) return;
    const rest = new URLSearchParams(searchParams);
    rest.delete('token');
    setSearchParams(rest, { replace: true });
  }, [searchParams, setSearchParams]);

  const preview = useLinkCancellationPreview(bookingId, token);
  const cancel = useCancelWithLink(bookingId, token);

  const sitePath = buildOrgBookingPath(orgSlug || org.slug);
  const backToSite = (
    <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
      <Link to={sitePath}>{t('guestCancellation.link.backToSite', { name: org.displayName })}</Link>
    </Button>
  );
  const myBookings = (
    <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
      <Link to={buildGuestBookingsPath(orgSlug || org.slug)}>{t('guestCancellation.link.myBookings')}</Link>
    </Button>
  );

  if (!bookingId || !token) return <LinkProblem message={t('guestCancellation.link.invalid')} action={myBookings} testId="guest-cancel-link-invalid" />;

  // What is on screen stays when a later read fails (a network blip on returning to the tab): a refused cancellation says why on its own.
  const data = preview.data;
  if (!data && !preview.isError) {
    return (
      <div role="status" aria-busy="true" className="mx-auto max-w-xl space-y-4" data-testid="guest-cancel-link-loading">
        <span className="sr-only">{t('guestCancellation.link.loading')}</span>
        <Skeleton className="h-8 w-2/3 motion-reduce:animate-none" aria-hidden="true" />
        <Skeleton className="h-64 w-full rounded-[var(--cz-public-radius)] motion-reduce:animate-none" aria-hidden="true" />
      </div>
    );
  }

  if (!data) {
    if (LINK_REFUSED_STATUSES.includes(getHttpStatus(preview.error) ?? 0)) {
      return <LinkProblem message={t('guestCancellation.link.invalid')} action={myBookings} testId="guest-cancel-link-invalid" />;
    }
    return (
      <LinkProblem
        message={getProblemMessage(preview.error, t) ?? t('guestCancellation.link.loadError')}
        action={
          <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => void preview.refetch()}>
            {t('guestCancellation.link.retry')}
          </Button>
        }
        testId="guest-cancel-link-error"
      />
    );
  }

  const day = (value: string) => formatStayDate(value, i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });
  const stay = `${data.stay.propertyName} · ${day(data.stay.checkInDate)} → ${day(data.stay.checkOutDate)}`;
  const open = data.cancellable || cancel.isSuccess;

  return (
    <div className="mx-auto max-w-xl space-y-6" data-testid="guest-cancel-link-page">
      <header className="space-y-1">
        <h1 className="public-display text-balance text-3xl font-semibold leading-tight">{t('guestCancellation.link.title')}</h1>
        <p className="break-words text-[var(--cz-public-muted)]" data-testid="guest-cancel-link-stay">
          {stay}
        </p>
      </header>

      <div className="public-site-card p-5 sm:p-6">
        {open ? (
          <CancellationPanel
            preview={data}
            result={cancel.data ?? null}
            onCancel={(request) => cancel.mutateAsync({ expectedRefundAmount: request.expectedRefundAmount })}
          />
        ) : (
          <CancellationClosed preview={data} />
        )}
      </div>

      {!data.cancellable && <div className="flex justify-center">{backToSite}</div>}
    </div>
  );
}

function LinkProblem({ message, action, testId }: { message: string; action: ReactNode; testId: string }) {
  return (
    <div className="mx-auto max-w-lg space-y-4 text-center" data-testid={testId}>
      <AlertCircle className="mx-auto size-10 text-destructive" aria-hidden="true" />
      <p role="alert">{message}</p>
      <div className="flex justify-center">{action}</div>
    </div>
  );
}
