import type { ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { isAxiosError } from 'axios';
import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getHttpStatus, getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { buildOrgBookingPath } from '@/lib/booking-url';
import { useSeoMeta } from '@/lib/seo-meta';
import { formatStayDate } from '@/lib/stay-dates';
import { useReviewLink, useSubmitReview } from '@/queries/use-reviews';
import type { PublicOrgDto, PublicReview } from '@/types';
import { ReviewCard } from './components/review-card';
import { ReviewForm, type ReviewFormValues } from './components/review-form';

interface PublicBookingContext {
  org: PublicOrgDto;
}

/** 422 of the lookup and of the submission: the link is not ours, is expired or is for another booking (all the same answer). */
const LINK_INVALID_CODE = 'review_link_invalid';
/** 409: the stay can no longer be reviewed (cancelled, or the days to write it are over). */
const NOT_AVAILABLE_CODE = 'review_not_available';
/** 409 of the submission: the stay was already reviewed (the other tab, or the same click twice). */
const ALREADY_SUBMITTED_CODE = 'review_already_submitted';

function errorCodeOf(error: unknown): string | undefined {
  return isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
}

/**
 * The page of the link in the email the host sends after a stay, `/book/:orgSlug/booking/:bookingId/review?token=…` (DB-12b): the
 * guest writes the review of the stay without an account, with the signed token of the link as the only key. The page shows the name
 * of the property and the dates of the stay and nothing else of the booking. Never indexed.
 */
export function ReviewLinkPage() {
  const { t, i18n } = useTranslation();
  const { orgSlug = '', bookingId = '' } = useParams<{ orgSlug: string; bookingId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { org } = useOutletContext<PublicBookingContext>();
  useSeoMeta({ title: t('siteReviews.link.pageTitle'), noindex: true });

  const link = useReviewLink(bookingId, token);
  const submit = useSubmitReview(bookingId);

  const backPath = buildOrgBookingPath(orgSlug || org.slug);
  const back = (
    <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
      <Link to={backPath}>{t('siteReviews.link.backToSite', { name: org.displayName })}</Link>
    </Button>
  );

  if (!bookingId || !token) return <LinkProblem message={t('siteReviews.link.invalid')} action={back} testId="review-link-invalid" />;

  if (link.isLoading) {
    return (
      <div role="status" aria-busy="true" className="mx-auto max-w-xl space-y-4" data-testid="review-link-loading">
        <span className="sr-only">{t('siteReviews.link.loading')}</span>
        <Skeleton className="h-8 w-2/3 motion-reduce:animate-none" aria-hidden="true" />
        <Skeleton className="h-64 w-full rounded-[var(--cz-public-radius)] motion-reduce:animate-none" aria-hidden="true" />
      </div>
    );
  }

  if (link.isError || !link.data) {
    const code = errorCodeOf(link.error);
    if (code === LINK_INVALID_CODE) return <LinkProblem message={t('siteReviews.link.invalid')} action={back} testId="review-link-invalid" />;
    if (code === NOT_AVAILABLE_CODE) return <LinkProblem message={t('siteReviews.link.notAvailable')} action={back} testId="review-link-unavailable" />;
    return (
      <LinkProblem
        message={getHttpStatus(link.error) === 429 ? t('apiErrors.tooManyRequests') : t('siteReviews.link.loadError')}
        action={
          <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => void link.refetch()}>
            {t('siteReviews.retry')}
          </Button>
        }
        testId="review-link-error"
      />
    );
  }

  const info = link.data;
  const day = (value: string) => formatStayDate(value.slice(0, 10), i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });
  const stay = `${info.propertyName} · ${day(info.checkInDate)} → ${day(info.checkOutDate)}`;

  // The review the guest just sent, or the one it sent before: read-only, never a second form.
  const written: PublicReview | null = submit.data ?? info.review ?? null;
  if (written) {
    return (
      <div className="mx-auto max-w-xl space-y-6" data-testid={submit.isSuccess ? 'review-link-thanks' : 'review-link-done'}>
        <div className="space-y-2 text-center">
          <CheckCircle2 className="mx-auto size-12 text-[var(--cz-public-primary-text)]" aria-hidden="true" />
          <h1 className="public-display text-2xl font-semibold">
            {submit.isSuccess ? t('siteReviews.link.thanksTitle') : t('siteReviews.link.alreadyTitle')}
          </h1>
          <p className="text-[var(--cz-public-muted)]">{submit.isSuccess ? t('siteReviews.link.thanksText') : t('siteReviews.link.alreadyText')}</p>
        </div>
        <ReviewCard review={written} />
        <div className="flex justify-center">{back}</div>
      </div>
    );
  }

  const onSubmit = (values: ReviewFormValues) =>
    submit.mutate(
      { token, rating: values.rating, text: values.text.trim() || undefined, showName: values.showName },
      {
        // The same stay was reviewed meanwhile: the page then shows that review instead of a form that can no longer work.
        onError: (error) => {
          if (errorCodeOf(error) === ALREADY_SUBMITTED_CODE) void link.refetch();
        },
      },
    );

  const submitError = submit.isError && errorCodeOf(submit.error) !== ALREADY_SUBMITTED_CODE
    ? errorMessageOf(submit.error, t)
    : undefined;

  return (
    <div className="mx-auto max-w-xl space-y-6" data-testid="review-link-page">
      <header className="space-y-1">
        <h1 className="public-display text-balance text-3xl font-semibold leading-tight">{t('siteReviews.link.title')}</h1>
        <p className="break-words text-[var(--cz-public-muted)]" data-testid="review-link-stay">
          {stay}
        </p>
      </header>
      <div className="public-site-card p-5 sm:p-6">
        <ReviewForm onSubmit={onSubmit} isPending={submit.isPending} errorMessage={submitError} />
      </div>
    </div>
  );
}

function errorMessageOf(error: unknown, t: TFunction): string {
  const code = errorCodeOf(error);
  if (code === LINK_INVALID_CODE) return t('siteReviews.link.invalid');
  if (code === NOT_AVAILABLE_CODE) return t('siteReviews.link.notAvailable');
  return getProblemMessage(error, t) ?? t('siteReviews.form.error');
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
