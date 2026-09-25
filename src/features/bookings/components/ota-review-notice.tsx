import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getProblemMessage } from '@/lib/api-errors';
import { formatRomeDateTime, formatStayDate } from '@/lib/stay-dates';
import { getBookingSourceLabel } from '@/lib/i18n-labels';
import { useResolveOtaReview } from '@/queries/use-bookings';
import type { Booking } from '@/types';
import { stayDateOf } from '../lib/booking-price';
import { needsOtaReview } from '../lib/ota-stay';

interface OtaReviewNoticeProps {
  booking: Booking;
  canWrite: boolean;
}

/**
 * OTA stay created from an iCal block and "da verificare" (CO-21): a sync found its reservation gone from the channel's
 * calendar, or with other dates. CasaZen changed nothing: the host checks the channel, then marks the stay verified or,
 * for new dates, applies them to the stay.
 */
export function OtaReviewNotice({ booking, canWrite }: OtaReviewNoticeProps) {
  const { t, i18n } = useTranslation();
  const resolve = useResolveOtaReview();

  if (!needsOtaReview(booking)) return null;

  const date = (value: string) => formatStayDate(stayDateOf(value), i18n.language);
  const channel = booking.source ? getBookingSourceLabel(booking.source, t) : t('booking.otaStay.channelIcal');
  const block = booking.channelBlock;
  const datesChanged = booking.otaReviewReason === 'BlockDatesChanged';
  const canApplyDates =
    canWrite &&
    datesChanged &&
    !!block &&
    booking.status === 'Confirmed' &&
    (stayDateOf(block.startDate) !== stayDateOf(booking.checkInDate) ||
      stayDateOf(block.endDate) !== stayDateOf(booking.checkOutDate));

  return (
    <div
      role="status"
      className="space-y-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      data-testid="ota-review-notice"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-1">
          <p className="font-medium">{t('booking.otaReview.title')}</p>
          <p>
            {datesChanged && block
              ? t('booking.otaReview.datesChanged', {
                  channel,
                  channelCheckIn: date(block.startDate),
                  channelCheckOut: date(block.endDate),
                  checkIn: date(booking.checkInDate),
                  checkOut: date(booking.checkOutDate),
                })
              : datesChanged
                ? t('booking.otaReview.datesChangedNoBlock', { channel })
                : t('booking.otaReview.removed', { channel })}
          </p>
          <p>{t('booking.otaReview.nothingChanged')}</p>
          {booking.otaReviewRaisedAt && (
            <p className="text-xs">
              {t('booking.otaReview.raisedAt', { date: formatRomeDateTime(booking.otaReviewRaisedAt, i18n.language) })}
            </p>
          )}
          <p className="text-xs">
            {datesChanged ? t('booking.otaReview.datesChangedAction') : t('booking.otaReview.removedAction')}
          </p>
        </div>
      </div>

      {resolve.isError && (
        <p role="alert" className="text-destructive">
          {getProblemMessage(resolve.error, t) ?? t('booking.otaReview.failed')}
        </p>
      )}

      {canWrite && (
        <div className="flex flex-wrap gap-2">
          {canApplyDates && (
            <Button
              size="sm"
              disabled={resolve.isPending}
              onClick={() => resolve.mutate({ id: booking.id, data: { applyChannelDates: true } })}
              data-testid="ota-review-apply-dates"
            >
              {t('booking.otaReview.applyDates')}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={resolve.isPending}
            onClick={() => resolve.mutate({ id: booking.id, data: {} })}
            data-testid="ota-review-resolve"
          >
            {t('booking.otaReview.markVerified')}
          </Button>
        </div>
      )}
    </div>
  );
}
