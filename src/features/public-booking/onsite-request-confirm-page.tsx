import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ArrowRight, Loader2, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicSiteState } from '@/features/public-site/components/public-site-state';
import { BookingCode } from '@/features/public-booking/confirmation/booking-code';
import { ConfirmationHero } from '@/features/public-booking/confirmation/confirmation-hero';
import { useConfirmOnSiteRequestEmail } from '@/queries/use-public-booking';
import { getProblemMessage } from '@/lib/api-errors';
import { buildGuestBookingsPath, buildOrgBookingPath } from '@/lib/booking-url';
import { useSeoMeta } from '@/lib/seo-meta';
import { formatRomeDateTime } from '@/lib/stay-dates';
import type { OnSiteRequestConfirmation, PublicOrgDto } from '@/types';
import '@/features/public-booking/confirmation/confirmation.css';

interface PublicBookingContext {
  org: PublicOrgDto;
}

/**
 * Page of the link in the "request received" email of a "pay at the property" request (BK-06, decision D5, A3-06). The
 * guest confirms the address with a click (never on page load, so a mail scanner opening the link confirms nothing);
 * only then the request goes to the host, who accepts or declines it. It has the look of the confirmation page (DB-06b): one title,
 * one action, and once it is done the code of the booking with «Copia».
 */
export function OnSiteRequestConfirmPage() {
  const { t } = useTranslation();
  const { orgSlug = '', bookingId = '' } = useParams<{ orgSlug: string; bookingId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { org } = useOutletContext<PublicBookingContext>();
  const confirm = useConfirmOnSiteRequestEmail();
  const titleRef = useRef<HTMLHeadingElement>(null);

  useSeoMeta({ title: t('siteConfirm.pageTitle', { org: org.displayName }), noindex: true });

  // The page changed from the question to the answer: the title takes the focus, so a screen reader reads it.
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, [confirm.isSuccess]);

  const back = (
    <Link to={buildOrgBookingPath(orgSlug)} className="bc-link">
      {t('publicBooking.backToProperties')}
      <ArrowRight aria-hidden />
    </Link>
  );

  if (!bookingId || !token) {
    return (
      <PublicSiteState
        icon={AlertCircle}
        role="alert"
        testId="onsite-confirm-invalid"
        title={t('siteConfirm.invalid.title')}
        description={t('publicBooking.onSiteRequest.linkIncomplete')}
      >
        <Button asChild variant="outline">
          <Link to={buildOrgBookingPath(orgSlug)}>{t('publicBooking.backToProperties')}</Link>
        </Button>
      </PublicSiteState>
    );
  }

  if (confirm.isSuccess) {
    return <ConfirmedRequest result={confirm.data} orgSlug={orgSlug} titleRef={titleRef} back={back} />;
  }

  return (
    <div className="bc" data-testid="onsite-confirm-page">
      <ConfirmationHero
        seal="mail"
        title={t('publicBooking.onSiteRequest.confirmTitle')}
        titleRef={titleRef}
        lead={t('publicBooking.onSiteRequest.confirmDescription', { orgName: org.displayName })}
        actions={
          <>
            <button
              type="button"
              className="public-site-cta bc-cta border-0"
              aria-disabled={confirm.isPending ? true : undefined}
              onClick={() => {
                if (!confirm.isPending) confirm.mutate({ bookingId, token });
              }}
              data-testid="onsite-confirm-action"
            >
              {confirm.isPending ? (
                <>
                  <Loader2 className="bc-spin" aria-hidden />
                  {t('publicBooking.onSiteRequest.confirming')}
                </>
              ) : (
                t('publicBooking.onSiteRequest.confirmAction')
              )}
            </button>
            {back}
          </>
        }
      />
      {confirm.isError ? (
        <p className="bc-pay__error" role="alert" data-testid="onsite-confirm-error">
          {getProblemMessage(confirm.error, t) ?? t('publicBooking.onSiteRequest.confirmError')}
        </p>
      ) : null}
    </div>
  );
}

function ConfirmedRequest({
  result,
  orgSlug,
  titleRef,
  back,
}: {
  result: OnSiteRequestConfirmation;
  orgSlug: string;
  titleRef: RefObject<HTMLHeadingElement | null>;
  back: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const code = result.bookingCode?.trim() ?? '';

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
    <div className="bc" data-testid="onsite-confirm-done">
      <ConfirmationHero
        seal="mail"
        title={t('publicBooking.onSiteRequest.confirmedTitle')}
        titleRef={titleRef}
        lead={message}
        actions={
          code ? (
            <Link to={buildGuestBookingsPath(orgSlug, code)} className="bc-link" data-testid="onsite-confirm-manage">
              {t('siteConfirm.action.manage')}
              <ArrowRight aria-hidden />
            </Link>
          ) : (
            back
          )
        }
        aside={
          <div className="bc-codecard">
            {code ? (
              <BookingCode code={code} />
            ) : (
              <p className="bc-codecard__ref">
                <MailCheck aria-hidden />
                <span>
                  <span className="bc-k">{t('publicBooking.bookingReference')}</span>
                  <strong>{result.bookingId}</strong>
                </span>
              </p>
            )}
          </div>
        }
      />
    </div>
  );
}
