import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Building2, Pencil, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import type { PageHeaderMenuItem } from '@/components/layout/page-header-actions';
import { PlainSection } from '@/components/shared/calm';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, type TabItem } from '@/components/ui/tabs';
import { AlloggiatiBookingPanel } from '@/features/alloggiati/components/alloggiati-booking-panel';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import { formatStayDate, todayInRome } from '@/lib/stay-dates';
import { useBooking } from '@/queries/use-bookings';
import { BookingNextStep } from './components/booking-next-step';
import { BookingPaymentTab } from './components/booking-payment-tab';
import { BookingStayTab } from './components/booking-stay-tab';
import { CancelBookingDialog } from './components/cancel-booking-dialog';
import { CheckInDialog } from './components/check-in-dialog';
import { CheckInLinkPanel } from './components/checkin-link-panel';
import { ConfirmBookingDialog } from './components/confirm-booking-dialog';
import { DeclineBookingDialog } from './components/decline-booking-dialog';
import { OtaReviewNotice } from './components/ota-review-notice';
import { bookingNights, stayDateOf } from './lib/booking-price';
import { BOOKINGS_PATH } from './lib/booking-list-query';
import { bookingPanelOf, type BookingPanel } from './lib/booking-tabs';
import { canRegisterArrival } from './lib/stay-actions';

/** The page while the booking loads: the shape of the page, no spinner in the middle of nothing. */
function BookingDetailSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" className="min-w-0 space-y-6" data-testid="booking-detail-loading">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-2/3 max-w-sm motion-reduce:animate-none" />
          <Skeleton className="h-4 w-1/2 max-w-xs motion-reduce:animate-none" />
        </div>
        <Skeleton className="h-36 w-full rounded-xl motion-reduce:animate-none" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full motion-reduce:animate-none" />
          <Skeleton className="h-4 w-11/12 motion-reduce:animate-none" />
          <Skeleton className="h-4 w-2/3 motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}

/**
 * `/app/short-rent/bookings/:id`: one booking (SR-05). The header says whose stay it is, where and when, with its status and the
 * "⋯" menu of the other actions; under it the one highlighted block, "Cosa succede ora", and then the tabs Soggiorno, Documenti
 * and Pagamento, each made of sections without a box. The tab is in the address (`?tab=`); `alloggiati`, the old fourth tab, opens
 * Documenti at its Alloggiati Web section.
 */
export function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: BookingPanel = bookingPanelOf(tabParam);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [arrivalOpen, setArrivalOpen] = useState(false);
  const { hasPermission } = useWorkspace();
  const { data: booking, isLoading, isError, error, refetch } = useBooking(id!);

  // The links of the arrival and of the cockpit ask for Alloggiati Web (`?tab=alloggiati`): Documenti opens at its section.
  const alloggiatiRef = useRef<HTMLDivElement>(null);
  const scrollToAlloggiati = tabParam === 'alloggiati' && booking !== undefined;
  useEffect(() => {
    if (scrollToAlloggiati) alloggiatiRef.current?.scrollIntoView?.({ block: 'start' });
  }, [scrollToAlloggiati]);

  if (isLoading) {
    return <BookingDetailSkeleton label={t('booking.detailPage.loading')} />;
  }

  // An API error is never shown as "not found" (only a 404 is).
  if (isError && getHttpStatus(error) !== 404) {
    return (
      <AppShell>
        <div className="min-w-0 space-y-6">
          <PageHeader crumbs="auto" title={t('booking.detailPage.fallbackTitle')} />
          <ErrorState testId="booking-load-error" title={t('booking.detailPage.loadError')} error={error} onRetry={() => void refetch()} />
        </div>
      </AppShell>
    );
  }

  if (!booking) {
    return (
      <AppShell>
        <div className="min-w-0 space-y-6">
          <PageHeader crumbs="auto" title={t('booking.detailPage.fallbackTitle')} />
          <EmptyState
            icon={Building2}
            title={t('booking.detailPage.notFound')}
            description={t('booking.detailPage.notFoundDescription')}
            action={{ label: t('booking.next.toBookings'), href: BOOKINGS_PATH }}
          />
        </div>
      </AppShell>
    );
  }

  const canWrite = hasPermission('short-rent', 'booking.write');
  // One confirmation for every pending booking the host can confirm (PC-07 with BK-06): the ones entered by hand and
  // left Pending by the old code, and the "pay at the property" requests waiting for the host's answer.
  const pendingManual = booking.status === 'Pending' && booking.source === 'Manual';
  const canConfirm = canWrite && (pendingManual || (booking.status === 'Pending' && booking.onSiteRequestState === 'AwaitingHostApproval'));
  // The host can also decline the request that waits for the answer (BK-06, the same dialog as the list).
  const canDecline = canWrite && booking.status === 'Pending' && booking.onSiteRequestState === 'AwaitingHostApproval';
  // Cancellation with refunds on Stripe (BK-02); the API also checks payment.write when money moves.
  const canCancel = canWrite && (booking.status === 'Pending' || booking.status === 'Confirmed' || booking.status === 'CheckedIn');
  const canEdit = canWrite && booking.status !== 'Cancelled';
  // "Registra arrivo" (CO-08): a confirmed booking from its check-in day to its check-out day (Europe/Rome).
  const canCheckIn = canWrite && canRegisterArrival(booking);

  const language = i18n.language;
  const thisYear = todayInRome().slice(0, 4);
  const day = (value: string) => {
    const stay = stayDateOf(value);
    return formatStayDate(stay, language, stay.startsWith(thisYear) ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const nights = bookingNights(booking);
  const guestName = `${booking.guest?.firstName ?? ''} ${booking.guest?.lastName ?? ''}`.trim() || t('compliance.checkout.guestFallback');
  // The line under the name: where, when, for how long, how many.
  const summary = [
    booking.propertyName,
    `${day(booking.checkInDate)} → ${day(booking.checkOutDate)}`,
    nights > 0 ? t('booking.list.nights', { count: nights }) : '',
    t('booking.list.guestCount', { count: booking.numberOfGuests }),
  ]
    .filter(Boolean)
    .join(' · ');

  const menu: PageHeaderMenuItem[] = [
    ...(canEdit ? [{ label: t('booking.detailPage.editBooking'), icon: Pencil, to: `${BOOKINGS_PATH}/${booking.id}/edit`, testId: 'edit-booking' }] : []),
    { label: t('booking.detailPage.openProperty'), icon: Building2, to: `/app/short-rent/properties/${booking.propertyId}`, testId: 'booking-open-property' },
    ...(canCancel
      ? [{ separator: true as const }, { label: t('booking.cancel.action'), icon: XCircle, danger: true, onClick: () => setCancelOpen(true), testId: 'open-cancel-booking' }]
      : []),
  ];

  // The test ids are how the Golden Journey (L3) and the tests reach the tabs.
  const tabs: TabItem<BookingPanel>[] = [
    { value: 'details', label: t('booking.detailPage.tabs.details'), testId: 'booking-tab-details' },
    { value: 'guest', label: t('booking.detailPage.tabs.guest'), testId: 'booking-tab-guest' },
    { value: 'payment', label: t('booking.detailPage.tabs.payment'), testId: 'booking-tab-payment' },
  ];

  return (
    <AppShell>
      <div className="min-w-0 space-y-6">
        {/* The trail (Affitti brevi › Prenotazioni › this booking) and, on a phone, the link back to the list as the user left it (UI-05). */}
        <PageHeader
          crumbs="auto"
          title={guestName}
          description={summary}
          action={<StatusBadge kind="booking" status={booking.status} size="lg" data-testid="booking-detail-status" />}
          secondary={menu}
        />

        <OtaReviewNotice booking={booking} canWrite={canWrite} />

        <BookingNextStep
          booking={booking}
          canWrite={canWrite}
          onConfirm={() => setConfirmOpen(true)}
          onDecline={() => setDeclineOpen(true)}
          onArrival={() => setArrivalOpen(true)}
        />

        {/* UI-07 Tabs: links with the tab in the address (`?tab=`), a menu on a phone. */}
        <Tabs label={t('booking.detailPage.tabsLabel')} items={tabs} defaultValue="details" value={activeTab} selectTestId="booking-tabs-select">
          {activeTab === 'details' && <BookingStayTab booking={booking} />}

          {activeTab === 'guest' && (
            <div className="space-y-8">
              <PlainSection title={t('booking.detailPage.checkInOnline')}>
                <CheckInLinkPanel bookingId={booking.id} canWrite={canWrite} />
              </PlainSection>
              <div ref={alloggiatiRef} className="scroll-mt-6">
                <PlainSection title={t('booking.detailPage.alloggiatiWeb')}>
                  <AlloggiatiBookingPanel bookingId={booking.id} checkInDate={booking.checkInDate} />
                </PlainSection>
              </div>
            </div>
          )}

          {activeTab === 'payment' && <BookingPaymentTab booking={booking} />}
        </Tabs>
      </div>

      {(canCancel || cancelOpen) && <CancelBookingDialog bookingId={booking.id} open={cancelOpen} onOpenChange={setCancelOpen} />}
      {(canConfirm || confirmOpen) && <ConfirmBookingDialog bookingId={booking.id} open={confirmOpen} onOpenChange={setConfirmOpen} />}
      {(canDecline || declineOpen) && (
        <DeclineBookingDialog booking={declineOpen ? booking : null} open={declineOpen} onOpenChange={setDeclineOpen} />
      )}
      {(canCheckIn || arrivalOpen) && <CheckInDialog booking={booking} open={arrivalOpen} onOpenChange={setArrivalOpen} />}
    </AppShell>
  );
}
