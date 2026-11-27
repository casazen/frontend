import { CalendarDays, House } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { FIELD_COLUMNS, FOCUS_COLUMN } from '@/components/layout/page-columns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookingForm, type BookingFormSubmit } from './components/booking-form';
import { BookingEditSettlement, BookingEditSettlementResult } from './components/booking-edit-settlement';
import { BookingEditSync } from './components/booking-edit-sync';
import { OtaChangeGuidance } from './components/ota-change-guidance';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useWorkspace } from '@/hooks/use-workspace';
import { useBooking, useBookingEditQuote, useRetryOctorateSync, useUpdateBooking } from '@/queries/use-bookings';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { formatStayDate } from '@/lib/stay-dates';
import { cn, formatCurrency } from '@/lib/utils';
import type { BookingEditQuote, BookingEditSettlement as SavedSettlement, UpdateBookingDto } from '@/types';
import { channelGuidanceOf, channelVersionChange, settlementHasMoney, stayChanged, stayLockOf } from './lib/booking-change';
import { useSyncWatch } from './lib/use-sync-watch';

type Step =
  | { name: 'form' }
  | { name: 'review'; change: UpdateBookingDto; quote: BookingEditQuote }
  | { name: 'saved'; settlement: SavedSettlement | undefined };

function changeOf(data: BookingFormSubmit): UpdateBookingDto {
  return {
    checkInDate: data.checkInDate,
    checkOutDate: data.checkOutDate,
    numberOfGuests: data.numberOfGuests,
    numberOfChildren: data.numberOfChildren,
    ...(data.childrenAges ? { childrenAges: data.childrenAges } : {}),
    specialRequests: data.specialRequests,
  };
}

/**
 * `/app/short-rent/bookings/:id/edit` (PC-07, E08/F03/US02): dates, guests and notes of a booking. Only a booking the API says may be changed shows the form; one of a
 * channel that is closed for the change shows the one sentence that says how to ask the guest or the channel, and no form. For a confirmed booking of the booking site the
 * money follows the price: the host reads what the change does with it (`edit-quote`) before confirming. After the save the page says where the channel manager stands:
 * being sent, failed with "Retry now", or in conflict with both versions and the two choices; it asks again by itself while the answer is to come.
 */
export function BookingEditPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useWorkspace();
  const watch = useSyncWatch();
  const query = useBooking(id!, { fresh: true, refetchInterval: (current) => watch.interval(current?.octorateSync) });
  const { data: booking, isLoading, isError, error, refetch } = query;
  const updateBooking = useUpdateBooking();
  const editQuote = useBookingEditQuote();
  const retry = useRetryOctorateSync();
  const [step, setStep] = useState<Step>({ name: 'form' });
  const [formValues, setFormValues] = useState<BookingFormSubmit | undefined>(undefined);
  const [formKey, setFormKey] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const detailPath = `/app/short-rent/bookings/${id}`;
  const busy = updateBooking.isPending || editQuote.isPending || retry.isPending;
  const readAfterOpen = query.dataUpdatedAt >= watch.openedAt;

  const askAgain = (overwrite: boolean) => {
    if (!id) return;
    setRetryError(null);
    retry.mutate(
      { id, overwrite },
      {
        onSuccess: () => watch.ask(),
        onError: (failure) => setRetryError(getProblemMessage(failure, t) ?? t('booking.edit.sync.retryFailed')),
      },
    );
  };

  const checkAgain = () => {
    watch.ask();
    void refetch();
  };

  if (isLoading || (!isError && !readAfterOpen)) {
    return <LoadingScreen message={t('booking.edit.loading')} className="h-auto flex-1" />;
  }

  const gone = isError && getHttpStatus(error) === 404;
  if (isError && !gone && !readAfterOpen) {
    return (
      <AppShell>
        <div className="text-center py-12 space-y-4" role="alert">
          <p className="text-destructive">{getProblemMessage(error, t) ?? t('booking.detailPage.loadError')}</p>
          <Button variant="outline" onClick={() => void refetch()}>
            {t('booking.detailPage.retry')}
          </Button>
        </div>
      </AppShell>
    );
  }

  if (gone || !booking) {
    return (
      <AppShell>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">{t('booking.edit.notFound')}</h2>
          <p className="text-muted-foreground">{t('booking.edit.notFoundDescription')}</p>
        </div>
      </AppShell>
    );
  }

  const guestName = `${booking.guest.firstName} ${booking.guest.lastName}`;
  const stayLock = stayLockOf(booking);
  const modifyGuidance = channelGuidanceOf(booking.changeOptions, 'modify');
  // The money of an edit is the business of who may read payments: the quote is asked only for them (the API refuses it otherwise), and so is what the save did with it.
  const canReadPayments = hasPermission('short-rent', 'payment.read');
  const reviewsMoney = booking.source === 'Direct' && stayLock === null && canReadPayments;
  const channelChange = stayLock === null ? channelVersionChange(booking, booking.octorateSync?.octorateVersion) : null;
  const chooseChannelVersion = channelChange
    ? () => {
        setFormValues({ propertyId: booking.propertyId, ...channelChange });
        setFormKey((key) => key + 1);
        setSubmitError(null);
        setStep({ name: 'form' });
      }
    : undefined;

  const afterSave = (answered: SavedSettlement | undefined) => {
    const settlement = canReadPayments ? answered : undefined;
    if (settlementHasMoney(settlement) || booking.octorateSync != null) {
      watch.ask();
      setStep({ name: 'saved', settlement });
    } else {
      navigate(detailPath);
    }
  };

  const save = async (change: UpdateBookingDto, from: 'form' | 'review') => {
    if (!id) return;
    try {
      const saved = await updateBooking.mutateAsync({ id, data: change });
      afterSave(saved.settlement);
    } catch (failure) {
      const message = getProblemMessage(failure, t) ?? t('toast.bookingUpdateFailed');
      if (from === 'review') setReviewError(message);
      else setSubmitError(message);
    }
  };

  const handleSubmit = async (data: BookingFormSubmit) => {
    if (!id) return;
    const change = changeOf(data);
    setSubmitError(null);
    setReviewError(null);
    setFormValues(data);

    if (!reviewsMoney || !stayChanged(booking, change)) {
      await save(change, 'form');
      return;
    }

    try {
      const quote = await editQuote.mutateAsync({ id, data: change });
      setStep({ name: 'review', change, quote });
    } catch (failure) {
      setSubmitError(getProblemMessage(failure, t) ?? t('booking.edit.review.quoteFailed'));
    }
  };

  const sync = (
    <BookingEditSync
      booking={booking}
      busy={busy}
      retryError={retryError}
      onRetry={askAgain}
      onUseChannelVersion={chooseChannelVersion}
      waitOver={watch.waitOver}
      onCheckAgain={checkAgain}
      checking={query.isFetching}
    />
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t('booking.edit.title')}
          description={t('booking.edit.description', { name: guestName })}
        />

        {step.name !== 'saved' && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border bg-muted/40 px-4 py-3 text-sm">
            {booking.propertyName && <span className="flex items-center gap-2 font-medium"><House aria-hidden className="size-4 text-primary-text" />{booking.propertyName}</span>}
            <span className="flex items-center gap-2"><CalendarDays aria-hidden className="size-4 text-primary-text" />{formatStayDate(booking.checkInDate, i18n.language)} → {formatStayDate(booking.checkOutDate, i18n.language)}</span>
            {booking.bookingCode && <span className="rounded-md bg-card px-2 py-1 font-mono">{booking.bookingCode}</span>}
          </div>
        )}
        {step.name === 'saved' ? (
          <div className={FOCUS_COLUMN}>
            <div className="space-y-4 rounded-2xl border bg-card p-6" data-testid="booking-edit-saved">
              <p role="status" className="font-medium">
                {t('booking.edit.saved.title')}
              </p>
              {step.settlement && settlementHasMoney(step.settlement) && <BookingEditSettlementResult settlement={step.settlement} />}
              {sync}
              <Button type="button" onClick={() => navigate(detailPath)} data-testid="booking-edit-back">
                {t('booking.edit.backToBooking')}
              </Button>
            </div>
          </div>
        ) : stayLock === 'Cancelled' || booking.status === 'Cancelled' ? (
          <div className="rounded-md border bg-muted/40 px-4 py-6 text-center space-y-3" data-testid="booking-not-editable">
            <p className="text-sm text-muted-foreground">{t('booking.edit.notEditable')}</p>
            <Link to={detailPath} className="text-primary hover:underline text-sm">
              {t('booking.edit.backToBooking')}
            </Link>
          </div>
        ) : modifyGuidance ? (
          <div className="rounded-md border bg-muted/40 px-4 py-6 text-center space-y-3" data-testid="booking-edit-channel-guidance">
            <OtaChangeGuidance action="modify" channel={modifyGuidance.channel} className="mx-auto" />
            <Link to={detailPath} className="text-primary hover:underline text-sm">
              {t('booking.edit.backToBooking')}
            </Link>
          </div>
        ) : (
          <div className={FOCUS_COLUMN}>
            <div className="space-y-6">
              {sync}
              {step.name === 'review' ? (
                <EditReview
                  change={step.change}
                  quote={step.quote}
                  canMoveMoney={hasPermission('short-rent', 'payment.write')}
                  busy={busy}
                  error={reviewError}
                  language={i18n.language}
                  onConfirm={() => {
                    setReviewError(null);
                    void save(step.change, 'review');
                  }}
                  onBack={() => {
                    setReviewError(null);
                    setStep({ name: 'form' });
                  }}
                />
              ) : (
                <BookingForm
                  key={formKey}
                  booking={booking}
                  stayLock={stayLock}
                  initialValues={formValues}
                  onSubmit={handleSubmit}
                  onCancel={() => navigate(detailPath)}
                  isLoading={updateBooking.isPending || editQuote.isPending}
                  disabled={retry.isPending}
                  submitError={submitError}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

interface EditReviewProps {
  change: UpdateBookingDto;
  quote: BookingEditQuote;
  /** The caller may write payments: a change that moves money needs it (403 `booking_edit_payment_permission_required` otherwise). */
  canMoveMoney: boolean;
  busy: boolean;
  error: string | null;
  language: string;
  onConfirm: () => void;
  onBack: () => void;
}

function EditReview({ change, quote, canMoveMoney, busy, error, language, onConfirm, onBack }: EditReviewProps) {
  const { t } = useTranslation();
  const day = (value: string) => formatStayDate(value, language, { day: 'numeric', month: 'short', year: 'numeric' });
  const blocked = quote.action !== 'none' && !canMoveMoney;

  return (
    <Card data-testid="booking-edit-review">
      <CardHeader>
        <CardTitle>{t('booking.edit.review.title')}</CardTitle>
        <CardDescription>{t('booking.edit.review.description')}</CardDescription>
      </CardHeader>
      <CardContent className="@container space-y-4">
        <div className={cn(FIELD_COLUMNS, 'gap-y-4')}>
          <dl className="min-w-0 space-y-3 rounded-xl border bg-muted/40 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t('booking.edit.review.dates')}</dt>
              <dd>{`${day(change.checkInDate)} → ${day(change.checkOutDate)}`}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t('booking.edit.review.guests')}</dt>
              <dd>{t('booking.list.guestCount', { count: change.numberOfGuests })}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t pt-3 font-semibold tabular-nums">
              <dt>{t('booking.edit.review.total')}</dt>
              <dd data-testid="booking-edit-review-total">{formatCurrency(quote.newTotal, quote.currency)}</dd>
            </div>
          </dl>

          <div className="min-w-0">
            <BookingEditSettlement quote={quote} />
          </div>
        </div>

        {blocked && (
          <p role="alert" className="text-sm text-destructive" data-testid="booking-edit-review-blocked">
            {t('apiErrors.codes.bookingEditPaymentPermissionRequired')}
          </p>
        )}
        {error && (
          <div
            role="alert"
            data-testid="booking-edit-review-error"
            className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" disabled={busy} onClick={onBack} data-testid="booking-edit-review-back">
            {t('booking.edit.review.back')}
          </Button>
          <Button type="button" disabled={busy || blocked} onClick={onConfirm} data-testid="booking-edit-review-confirm">
            {busy ? t('booking.form.saving') : t('booking.edit.review.confirm')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
