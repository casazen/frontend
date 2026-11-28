import { ArrowRight, Brush, CalendarDays, Flag, Mail, MessageSquare, Phone, UserRound, UsersRound, Wrench } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PropertyThumb } from '@/features/properties/components/property-thumb';
import { useProperty } from '@/queries/use-properties';
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

export function BookingStayTab({ booking }: BookingStayTabProps) {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  const { flags } = useFeatureFlags();
  const canReadProperty = hasPermission('short-rent', 'property.read');
  const property = useProperty(canReadProperty ? booking.propertyId : '').data;
  const serviceRequests = useServiceRequests({ bookingId: booking.id, pageSize: 50 });
  const canManageSupplierRequests = hasPermission('short-rent', 'property.write');
  const canRequestSupplier = hasPermission('short-rent', 'servicerequest.write') && booking.status !== 'Cancelled';
  const cleaningAction = canRequestSupplier ? (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild size="sm" variant="outline" className="min-h-11">
        <Link to={requestInterventionPath(booking.propertyId, { bookingId: booking.id, type: 'cleaning' })} data-testid="booking-request-cleaning">
          <Brush aria-hidden="true" />{t('requestWizard.housekeeping.request')}
        </Link>
      </Button>
      <Button asChild size="sm" variant="ghost" className="min-h-11">
        <Link to={requestInterventionPath(booking.propertyId, { bookingId: booking.id })}><Wrench aria-hidden="true" />{t('requestWizard.housekeeping.other')}</Link>
      </Button>
    </div>
  ) : undefined;
  const canWrite = hasPermission('short-rent', 'booking.write');
  const canRead = hasPermission('short-rent', 'booking.read');
  const modifyGuidance = canWrite ? channelGuidanceOf(booking.changeOptions, 'modify') : null;
  const cancelGuidance = canWrite ? channelGuidanceOf(booking.changeOptions, 'cancel') : null;
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

  const guestName = [guest?.firstName, guest?.lastName].filter(Boolean).join(' ') || t('compliance.checkout.guestFallback');
  const guestInitials = [guest?.firstName?.trim()[0], guest?.lastName?.trim()[0]].filter(Boolean).join('');
  const country = guest?.country && /^[a-z]{2}$/i.test(guest.country)
    ? new Intl.DisplayNames([i18n.language], { type: 'region' }).of(guest.country.toUpperCase())
    : guest?.country;
  const propertyName = booking.propertyName || property?.name || t('booking.detailPage.openProperty');

  return (
    <div className="space-y-5">
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" data-testid="booking-stay-overview">
        <section className="min-w-0 overflow-hidden rounded-xl border bg-card" aria-labelledby="stay-overview-heading">
          <div className="flex items-center gap-4 p-4 sm:p-5">
            <PropertyThumb photoUrls={property?.photoUrls} className="h-20 w-20 sm:h-24 sm:w-32" />
            <div className="min-w-0">
              <h2 id="stay-overview-heading" className="text-sm text-muted-foreground">{t('booking.detailPage.stayTitle')}</h2>
              <div className="mt-1 break-words text-lg font-semibold leading-tight">
                {canReadProperty ? <Link to={`/app/short-rent/properties/${booking.propertyId}`} className="rounded hover:underline focus-visible:outline-ring">{propertyName}</Link> : propertyName}
              </div>
              <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <UsersRound aria-hidden="true" className="size-4 shrink-0" />
                {t('booking.list.guestCount', { count: booking.numberOfGuests })}
                {children > 0 ? ` · ${t('booking.detailPage.childrenCount', { count: children })}` : ''}
              </p>
            </div>
          </div>
          <div className="border-t px-4 sm:px-5">
            <dl className="grid grid-cols-2 gap-3 py-3">
              {[[t('booking.detail.checkIn'), booking.checkInDate], [t('booking.detail.checkOut'), booking.checkOutDate]].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays aria-hidden="true" className="size-4 shrink-0" />{label}</dt>
                  <dd className="mt-1 font-semibold"><time dateTime={stayDateOf(value)}>{stayDate(value)}</time></dd>
                </div>
              ))}
            </dl>
            {booking.specialRequests && <div className="flex items-start gap-2 border-t py-3">
              <MessageSquare aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary-text" />
              <div className="min-w-0"><p className="text-sm text-muted-foreground">{t('booking.detail.specialRequests')}</p><p className="break-words">{booking.specialRequests}</p></div>
            </div>}
            {booking.status === 'Cancelled' && booking.cancellationNote && <p className="border-t py-3" data-testid="booking-cancellation-note">
              <span className="block text-sm text-muted-foreground">{t('booking.detailPage.cancellationNote')}</span>{booking.cancellationNote}
            </p>}
            {reviewCheckIn && <Link to={`?${checkInParams}`} data-testid="booking-review-checkin" className="flex min-h-11 w-fit items-center gap-2 rounded text-sm font-medium text-primary-text hover:underline">
              {t('dashboard.today.action.openCheckIn')}<ArrowRight aria-hidden="true" className="size-4"/>
            </Link>}
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
          </div>
        </section>

        {guest && <section className="min-w-0 rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="stay-guest-heading">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-soft font-semibold text-primary-text">{guestInitials || <UserRound className="size-5" />}</span>
            <div className="min-w-0">
              <h2 id="stay-guest-heading" className="font-semibold">{t('booking.detailPage.guestInformationTitle')}</h2>
              <p className="sr-only">{guestName}</p>
            </div>
          </div>
          {(guest.email || guest.phone || country) && <ul className="mt-3 border-t pt-2 text-sm">
            {guest.email && <li className="flex min-h-11 items-center gap-3"><Mail aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /><a href={`mailto:${guest.email}`} className={FACT_LINK}>{guest.email}</a></li>}
            {guest.phone && <li className="flex min-h-11 items-center gap-3"><Phone aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /><a href={`tel:${guest.phone}`} className={FACT_LINK}>{guest.phone}</a></li>}
            {country && <li className="flex items-center gap-3 py-2"><Flag aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /><span><span className="sr-only">{t('booking.detail.guestCountry')} </span>{country}</span></li>}
          </ul>}
        </section>}
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
              <BookingOriginBadge booking={booking} className="mt-1 flex w-fit" />
            </Fact>
          ) : null}
          <Fact label={t('booking.detailPage.created')}>{formatDateTime(booking.createdAt)}</Fact>
          <Fact label={t('booking.detailPage.lastUpdated')}>{formatDateTime(booking.updatedAt)}</Fact>
        </Facts>
      </details>

      <BookingReviewsSection booking={booking} canWrite={canWrite} />

      {serviceRequests.data?.items.length === 0 && !serviceRequests.isError ? cleaningAction : <ServiceRequestsCard
        plain
        query={serviceRequests}
        emptyText={t('serviceRequest.emptyForStay')}
        canManage={canManageSupplierRequests}
        testId="booking-service-requests"
        action={cleaningAction}
      />}

      {flags.scheduledMessages && canRead ? <BookingScheduledMessages booking={booking} canWrite={canWrite} /> : null}
    </div>
  );
}
