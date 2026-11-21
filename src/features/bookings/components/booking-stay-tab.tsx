import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { requestInterventionPath } from '@/features/service-requests/interventions/paths';
import { Button } from '@/components/ui/button';
import { ServiceRequestsCard } from '@/features/service-requests/components/service-requests-card';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { formatStayDate } from '@/lib/stay-dates';
import { formatDateTime } from '@/lib/utils';
import { useServiceRequests } from '@/queries/use-service-requests';
import type { Booking } from '@/types';
import { stayDateOf } from '../lib/booking-price';
import { channelGuidanceOf } from '../lib/booking-change';
import { bookingChannelText } from '../lib/ota-stay';
import { BookingScheduledMessages } from './booking-scheduled-messages';
import { BookingSourceValue, FACT_LINK, Fact, Facts } from './booking-facts';
import { BookingOriginBadge } from './booking-origin-badge';
import { BookingReviewsSection } from './booking-reviews-section';
import { OtaChangeGuidance } from './ota-change-guidance';

interface BookingStayTabProps {
  booking: Booking;
}

/**
 * The tab Soggiorno: what the stay is (property, dates, guests, where it came from, the code the guest knows), who the guest is,
 * the supplier requests of the stay and, with the flag `scheduledMessages` on, the messages the routines will send to the guest
 * (E05/F07/US02, NF-71) for who may read the booking. Sections without a box: a title and what it says.
 */
export function BookingStayTab({ booking }: BookingStayTabProps) {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  const { flags } = useFeatureFlags();
  // The stay's own requests (D2), with the same query as the app's booking screen.
  const canReadProperty = hasPermission('short-rent', 'property.read');
  // Always ask for the stay's requests when the booking page is open: the list is what the host sees after creating one
  // (GJ L3 pay-at-property). Gating the query on property.read hid the card after the cleaning wizard returned.
  const serviceRequests = useServiceRequests({ bookingId: booking.id, pageSize: 50 });
  // Creating a request and managing an existing intervention are distinct permissions.
  const canManageSupplierRequests = hasPermission('short-rent', 'property.write');
  const canRequestSupplier = hasPermission('short-rent', 'servicerequest.write') && booking.status !== 'Cancelled';
  const cleaningAction = canRequestSupplier ? (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild size="sm" variant="outline" className="min-h-11">
        <Link to={requestInterventionPath(booking.propertyId, { bookingId: booking.id, type: 'cleaning' })} data-testid="booking-request-cleaning">
          {t('requestWizard.housekeeping.request')}
        </Link>
      </Button>
      <Button asChild size="sm" variant="ghost" className="min-h-11">
        <Link to={requestInterventionPath(booking.propertyId, { bookingId: booking.id })}>{t('requestWizard.housekeeping.other')}</Link>
      </Button>
    </div>
  ) : undefined;
  const canWrite = hasPermission('short-rent', 'booking.write');
  const canRead = hasPermission('short-rent', 'booking.read');
  // A booking of a channel that the channel does not let the host change or cancel from CasaZen (E08/F03/US02, NF-75, NF-76): the one sentence that says how to ask the
  // guest or the channel, in place of the action. It replaces the lock sentence below, which would send the host to cancel a booking that cannot be cancelled here.
  const modifyGuidance = canWrite ? channelGuidanceOf(booking.changeOptions, 'modify') : null;
  const cancelGuidance = canWrite ? channelGuidanceOf(booking.changeOptions, 'cancel') : null;
  // Why the dates and guests cannot be changed (SR-05c), for who would have changed them: the page offers no "Modifica" then, and the
  // server's `canEdit` says why. A cancelled booking says it itself.
  const editLock =
    canWrite && !modifyGuidance && booking.canEdit && !booking.canEdit.allowed && booking.canEdit.reason !== 'Cancelled' ? booking.canEdit.reason : null;

  const stayDate = (value: string) => formatStayDate(stayDateOf(value), i18n.language);
  const channelText = bookingChannelText(booking, t);
  const children = booking.numberOfChildren ?? 0;
  const guest = booking.guest;
  const [params] = useSearchParams();
  const checkInParams = new URLSearchParams(params);
  checkInParams.set('tab', 'guest');
  const reviewCheckIn = booking.status === 'Confirmed' || booking.status === 'CheckedIn';

  return (
    <div className="space-y-8">
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:gap-10" data-testid="booking-stay-overview">
        <PlainSection
          title={t('booking.detailPage.stayTitle')}
          actionTestId="booking-review-checkin"
          {...(reviewCheckIn ? {
            actionLabel: t('dashboard.today.action.openCheckIn'),
            href: `?${checkInParams}`,
          } : { actionLabel: undefined })}
        >
          <Facts className="divide-y divide-border space-y-0 [&>div]:py-2">
            <Fact label={t('booking.detailPage.property')}>
              {canReadProperty ? (
                <Link to={`/app/short-rent/properties/${booking.propertyId}`} className={FACT_LINK}>
                  {booking.propertyName || t('booking.detailPage.openProperty')}
                </Link>
              ) : booking.propertyName || '—'}
            </Fact>
            <Fact label={t('booking.detail.checkIn')}>{stayDate(booking.checkInDate)}</Fact>
            <Fact label={t('booking.detail.checkOut')}>{stayDate(booking.checkOutDate)}</Fact>
            <Fact label={t('booking.detail.guests')}>
              {t('booking.list.guestCount', { count: booking.numberOfGuests })}
              {children > 0 ? ` · ${t('booking.detailPage.childrenCount', { count: children })}` : ''}
            </Fact>
            {booking.specialRequests ? <Fact label={t('booking.detail.specialRequests')}>{booking.specialRequests}</Fact> : null}
            {booking.status === 'Cancelled' && booking.cancellationNote ? (
              <Fact label={t('booking.detailPage.cancellationNote')}>
                <span data-testid="booking-cancellation-note">{booking.cancellationNote}</span>
              </Fact>
            ) : null}
          </Facts>
          {editLock ? (
            <p className="max-w-prose text-sm text-foreground/70" data-testid="booking-edit-locked" data-reason={editLock}>
              {t(`booking.detailPage.editLocked.${editLock}`)}
            </p>
          ) : null}
          {modifyGuidance || cancelGuidance ? (
            <div className="space-y-2" data-testid="booking-channel-guidance">
              {modifyGuidance ? <OtaChangeGuidance action="modify" channel={modifyGuidance.channel} /> : null}
              {cancelGuidance ? <OtaChangeGuidance action="cancel" channel={cancelGuidance.channel} /> : null}
            </div>
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
      </div>

      <details className="rounded-lg border border-border px-4" data-testid="booking-stay-reference">
        <summary className="cursor-pointer rounded py-3 font-medium focus-visible:outline-2 focus-visible:outline-ring">
          {t('booking.detailPage.referenceDetails')}
          {booking.bookingCode && <span className="ml-2 break-all font-mono text-sm text-foreground/75">{booking.bookingCode}</span>}
        </summary>
        <Facts className="border-t border-border py-3">
          {booking.source ? (
            <Fact label={t('booking.detailPage.source')}>
              <BookingSourceValue booking={booking} />
              {channelText ? (
                <span className="block text-sm text-foreground/70" data-testid="booking-detail-channel">
                  {channelText}
                </span>
              ) : null}
              {/* Where it came from (NF-123): «Portale Airbnb», «Sito dell'agenzia», «Sito CasaZen» or «Manuale». */}
              <BookingOriginBadge booking={booking} className="mt-1 flex w-fit" />
            </Fact>
          ) : null}
          <Fact label={t('booking.detailPage.created')}>{formatDateTime(booking.createdAt)}</Fact>
          <Fact label={t('booking.detailPage.lastUpdated')}>{formatDateTime(booking.updatedAt)}</Fact>
        </Facts>
      </details>

      {/* The one section of the reviews of the stay (E05/F06/US02): the host asks the guest of the site for a review (DB-12b) and reads the reviews of the guests, of the site and of the channel. It draws nothing where there is nothing to say. */}
      <BookingReviewsSection booking={booking} canWrite={canWrite} />

      <ServiceRequestsCard
        plain
        query={serviceRequests}
        emptyText={t('serviceRequest.emptyForStay')}
        canManage={canManageSupplierRequests}
        testId="booking-service-requests"
        action={cleaningAction}
      />

      {/* NF-71: what the routines will send to the guest of this stay, after the sections above (they keep their place). Only with the flag on and for who may read the booking: off, nothing is drawn and nothing is asked. */}
      {flags.scheduledMessages && canRead ? <BookingScheduledMessages booking={booking} canWrite={canWrite} /> : null}
    </div>
  );
}
