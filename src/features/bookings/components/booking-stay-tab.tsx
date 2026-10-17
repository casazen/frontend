import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { ReviewInvitePanel } from '@/features/reviews/components/review-invite-panel';
import { ServiceRequestForm } from '@/features/service-requests/components/service-request-form';
import { ServiceRequestsCard } from '@/features/service-requests/components/service-requests-card';
import { useWorkspace } from '@/hooks/use-workspace';
import { getBookingSourceLabel } from '@/lib/i18n-labels';
import { formatStayDate } from '@/lib/stay-dates';
import { formatDateTime } from '@/lib/utils';
import { useServiceRequests } from '@/queries/use-service-requests';
import type { Booking } from '@/types';
import { stayDateOf } from '../lib/booking-price';
import { bookingChannelText } from '../lib/ota-stay';
import { FACT_LINK, Fact, Facts } from './booking-facts';

interface BookingStayTabProps {
  booking: Booking;
}

/**
 * The tab Soggiorno: what the stay is (property, dates, guests, where it came from, the code the guest knows), who the guest is,
 * and the supplier requests of the stay. Sections without a box: a title and what it says.
 */
export function BookingStayTab({ booking }: BookingStayTabProps) {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  // The stay's own requests (D2), with the same query as the app's booking screen.
  const serviceRequests = useServiceRequests({ bookingId: booking.id, pageSize: 50 });
  // A short-rent supplier request is for this stay (D2); the API needs property.write in short-rent, also to pay a completed
  // request or ask another supplier after a rejection (SU-09). No new request for a cancelled stay.
  const canManageSupplierRequests = hasPermission('short-rent', 'property.write');
  const canRequestSupplier = canManageSupplierRequests && booking.status !== 'Cancelled';
  // Why the dates and guests cannot be changed (SR-05c), for who would have changed them: the page offers no "Modifica" then, and the
  // server's `canEdit` says why. A cancelled booking says it itself.
  const editLock =
    hasPermission('short-rent', 'booking.write') && booking.canEdit && !booking.canEdit.allowed && booking.canEdit.reason !== 'Cancelled'
      ? booking.canEdit.reason
      : null;

  const stayDate = (value: string) => formatStayDate(stayDateOf(value), i18n.language);
  const channelText = bookingChannelText(booking, t);
  const children = booking.numberOfChildren ?? 0;
  const guest = booking.guest;

  return (
    <div className="space-y-8">
      <PlainSection title={t('booking.detailPage.stayTitle')}>
        <Facts>
          <Fact label={t('booking.detailPage.property')}>
            <Link to={`/app/short-rent/properties/${booking.propertyId}`} className={FACT_LINK}>
              {booking.propertyName || t('booking.detailPage.openProperty')}
            </Link>
          </Fact>
          <Fact label={t('booking.detail.checkIn')}>{stayDate(booking.checkInDate)}</Fact>
          <Fact label={t('booking.detail.checkOut')}>{stayDate(booking.checkOutDate)}</Fact>
          <Fact label={t('booking.detail.guests')}>
            {t('booking.list.guestCount', { count: booking.numberOfGuests })}
            {children > 0 ? ` · ${t('booking.detailPage.childrenCount', { count: children })}` : ''}
          </Fact>
          {booking.source ? (
            <Fact label={t('booking.detailPage.source')}>
              <span data-testid="booking-detail-source">{getBookingSourceLabel(booking.source, t)}</span>
              {channelText ? (
                <span className="block text-sm text-foreground/70" data-testid="booking-detail-channel">
                  {channelText}
                </span>
              ) : null}
            </Fact>
          ) : null}
          {booking.bookingCode ? (
            <Fact label={t('booking.detailPage.code')}>
              <code className="text-sm">{booking.bookingCode}</code>
            </Fact>
          ) : null}
          {booking.specialRequests ? <Fact label={t('booking.detail.specialRequests')}>{booking.specialRequests}</Fact> : null}
          {booking.status === 'Cancelled' && booking.cancellationNote ? (
            <Fact label={t('booking.detailPage.cancellationNote')}>
              <span data-testid="booking-cancellation-note">{booking.cancellationNote}</span>
            </Fact>
          ) : null}
          <Fact label={t('booking.detailPage.created')}>{formatDateTime(booking.createdAt)}</Fact>
          <Fact label={t('booking.detailPage.lastUpdated')}>{formatDateTime(booking.updatedAt)}</Fact>
        </Facts>
        {editLock ? (
          <p className="max-w-prose text-sm text-foreground/70" data-testid="booking-edit-locked" data-reason={editLock}>
            {t(`booking.detailPage.editLocked.${editLock}`)}
          </p>
        ) : null}
      </PlainSection>

      {guest ? (
        <PlainSection title={t('booking.detailPage.guestInformationTitle')}>
          <Facts>
            <Fact label={t('booking.detail.guestName')}>{`${guest.firstName ?? ''} ${guest.lastName ?? ''}`.trim() || t('compliance.checkout.guestFallback')}</Fact>
            {guest.email ? (
              <Fact label={t('booking.detail.guestEmail')}>
                <a href={`mailto:${guest.email}`} className={FACT_LINK}>
                  {guest.email}
                </a>
              </Fact>
            ) : null}
            {guest.phone ? (
              <Fact label={t('booking.detail.guestPhone')}>
                <a href={`tel:${guest.phone}`} className={FACT_LINK}>
                  {guest.phone}
                </a>
              </Fact>
            ) : null}
            {guest.country ? <Fact label={t('booking.detail.guestCountry')}>{guest.country}</Fact> : null}
          </Facts>
        </PlainSection>
      ) : null}

      {/* DB-12b: the host asks the guest of a stay that is over for a review; the panel draws nothing for any other booking. */}
      <ReviewInvitePanel booking={booking} canWrite={hasPermission('short-rent', 'booking.write')} />

      <ServiceRequestsCard
        plain
        query={serviceRequests}
        emptyText={t('serviceRequest.emptyForStay')}
        canManage={canManageSupplierRequests}
        testId="booking-service-requests"
        action={
          canRequestSupplier ? (
            <ServiceRequestForm propertyId={booking.propertyId} bookingId={booking.id} jobDate={stayDateOf(booking.checkOutDate)} />
          ) : undefined
        }
      />
    </div>
  );
}
