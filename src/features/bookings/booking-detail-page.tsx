import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/shared/breadcrumb';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useTranslation } from 'react-i18next';
import { useBooking } from '@/queries/use-bookings';
import { formatDate, formatCurrency } from '@/lib/utils';
import { formatStayDate } from '@/lib/stay-dates';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { BOOKING_STATUS_VARIANTS } from './schemas/booking.schema';
import { bookingNights, bookingPriceBreakdown, stayDateOf } from './lib/booking-price';
import { getBookingSourceLabel, getBookingStatusLabel } from '@/lib/i18n-labels';
import { CheckCircle2, Edit, Calendar, Users, Mail, Phone, MapPin, XCircle } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';
import { CancelBookingDialog } from './components/cancel-booking-dialog';
import { ConfirmBookingDialog } from './components/confirm-booking-dialog';
import { AlloggiatiBookingPanel } from '@/features/alloggiati/components/alloggiati-booking-panel';
import { ServiceRequestTimeline } from '@/features/service-requests/components/service-request-timeline';
import { useServiceRequests } from '@/queries/use-service-requests';
import { CheckInSessionBadge } from './components/checkin-session-badge';
import type { Booking } from '@/types';

type BookingTab = 'details' | 'guest' | 'payment' | 'alloggiati';

export function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<BookingTab>('details');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { hasPermission } = useWorkspace();
  const { data: booking, isLoading, isError, error, refetch } = useBooking(id!);
  const { data: serviceRequests } = useServiceRequests(
    booking ? { propertyId: booking.propertyId } : undefined,
  );
  const { t, i18n } = useTranslation();

  if (isLoading) {
    return <LoadingScreen message={t('booking.detailPage.loading')} />;
  }

  // An API error is never shown as "not found" (only a 404 is).
  if (isError && getHttpStatus(error) !== 404) {
    return (
      <AppShell>
        <div className="text-center py-12 space-y-4" role="alert" data-testid="booking-load-error">
          <p className="text-destructive">{getProblemMessage(error, t) ?? t('booking.detailPage.loadError')}</p>
          <Button variant="outline" onClick={() => void refetch()}>
            {t('booking.detailPage.retry')}
          </Button>
        </div>
      </AppShell>
    );
  }

  if (!booking) {
    return (
      <AppShell>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">{t('booking.detailPage.notFound')}</h2>
          <p className="text-muted-foreground">{t('booking.detailPage.notFoundDescription')}</p>
        </div>
      </AppShell>
    );
  }

  const canWrite = hasPermission('short-rent', 'booking.write');
  const statusLabel = getBookingStatusLabel(booking.status, t);
  // One confirmation for every pending booking the host can confirm (PC-07 with BK-06): the ones entered by hand and
  // left Pending by the old code, and the "pay at the property" requests waiting for the host's answer.
  const pendingManual = booking.status === 'Pending' && booking.source === 'Manual';
  const canConfirm =
    canWrite && (pendingManual || (booking.status === 'Pending' && booking.onSiteRequestState === 'AwaitingHostApproval'));
  // Cancellation with refunds on Stripe (BK-02); the API also checks payment.write when money moves.
  const canCancel =
    canWrite && (booking.status === 'Pending' || booking.status === 'Confirmed' || booking.status === 'CheckedIn');
  const canEdit = canWrite && booking.status !== 'Cancelled';
  const statusVariant = BOOKING_STATUS_VARIANTS[booking.status] || BOOKING_STATUS_VARIANTS.Pending;
  const nights = bookingNights(booking);
  const stayDate = (value: string) => formatStayDate(stayDateOf(value), i18n.language);

  const tabs: { key: BookingTab; label: string }[] = [
    { key: 'details', label: t('booking.detailPage.tabs.details') },
    { key: 'guest', label: t('booking.detailPage.tabs.guest') },
    { key: 'payment', label: t('booking.detailPage.tabs.payment') },
    { key: 'alloggiati', label: t('booking.detailPage.tabs.alloggiati') },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <Breadcrumb />

        <PageHeader
          title={t('booking.detailPage.title', { code: booking.id.slice(0, 8) })}
          description={`${booking.guest?.firstName ?? ''} ${booking.guest?.lastName ?? ''}`.trim() || t('compliance.checkout.guestFallback')}
          action={
            <div className="flex flex-wrap gap-2">
              {canConfirm && (
                <Button onClick={() => setConfirmOpen(true)} data-testid="open-confirm-booking">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {t('booking.confirm.action')}
                </Button>
              )}
              {canCancel && (
                <Button variant="outline" onClick={() => setCancelOpen(true)} data-testid="open-cancel-booking">
                  <XCircle className="mr-2 h-4 w-4" />
                  {t('booking.cancel.action')}
                </Button>
              )}
              <Button variant="outline" asChild>
                <Link to={`/app/short-rent/bookings/${booking.id}/checkout`} data-testid="open-checkout-wizard">
                  {t('booking.card.checkOutAction')}
                </Link>
              </Button>
              {canEdit && (
                <Button onClick={() => navigate(`/app/short-rent/bookings/${booking.id}/edit`)} data-testid="edit-booking">
                  <Edit className="mr-2 h-4 w-4" />
                  {t('booking.detailPage.editBooking')}
                </Button>
              )}
            </div>
          }
        />

        <Link
          to={`/app/short-rent/properties/${booking.propertyId}`}
          className="text-primary hover:underline text-sm inline-block"
        >
          {t('booking.detailPage.viewProperty')} &#8594;
        </Link>

        <div className="flex gap-1 border-b mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'details' && (
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{t('booking.detailPage.bookingDetailsTitle')}</CardTitle>
                    <div className="flex items-center gap-2">
                      {booking.source && (
                        <Badge
                          variant="outline"
                          title={t('booking.detailPage.source')}
                          data-testid="booking-detail-source"
                        >
                          {getBookingSourceLabel(booking.source, t)}
                        </Badge>
                      )}
                      <Badge variant={statusVariant} className="text-base px-3 py-1" data-testid="booking-detail-status">
                        {statusLabel}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {canConfirm && pendingManual && (
                    <p className="rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground" data-testid="booking-pending-manual">
                      {t('booking.confirm.pendingNotice')}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Calendar className="h-4 w-4" />
                        {t('booking.detail.checkIn')}
                      </div>
                      <div className="font-medium">{stayDate(booking.checkInDate)}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Calendar className="h-4 w-4" />
                        {t('booking.detail.checkOut')}
                      </div>
                      <div className="font-medium">{stayDate(booking.checkOutDate)}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <span>{booking.numberOfGuests} {t('booking.detail.guest', { count: booking.numberOfGuests })}</span>
                      {(booking.numberOfChildren ?? 0) > 0 && (
                        <span className="text-sm text-muted-foreground">
                          {t('booking.detailPage.childrenCount', { count: booking.numberOfChildren })}
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground">
                      {nights} {t('booking.detail.night', { count: nights })}
                    </div>
                  </div>

                  {booking.specialRequests && (
                    <div className="pt-3 border-t">
                      <div className="text-sm text-muted-foreground mb-1">{t('booking.detailPage.specialRequests')}</div>
                      <p className="text-sm">{booking.specialRequests}</p>
                    </div>
                  )}

                  {booking.status === 'Cancelled' && booking.cancellationNote && (
                    <div className="pt-3 border-t" data-testid="booking-cancellation-note">
                      <div className="text-sm text-muted-foreground mb-1">{t('booking.detailPage.cancellationNote')}</div>
                      <p className="text-sm">{booking.cancellationNote}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <ServiceRequestTimeline requests={serviceRequests?.items ?? []} />
              <Card>
                <CardHeader>
                  <CardTitle>{t('booking.detailPage.timeline')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <div className="text-muted-foreground">{t('booking.detailPage.created')}</div>
                    <div>{formatDate(booking.createdAt, 'dd/MM/yyyy HH:mm')}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">{t('booking.detailPage.lastUpdated')}</div>
                    <div>{formatDate(booking.updatedAt, 'dd/MM/yyyy HH:mm')}</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'guest' && (
          <Card>
            <CardHeader>
              <CardTitle>{t('booking.detailPage.guestInformationTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="pb-3 border-b">
                <div className="text-sm text-muted-foreground mb-2">{t('checkin.sessionLabel')}</div>
                <CheckInSessionBadge bookingId={booking.id} />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">{t('booking.detailPage.guestName')}</div>
                <div className="font-medium">
                  {booking.guest.firstName} {booking.guest.lastName}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${booking.guest.email}`} className="text-sm hover:underline">
                  {booking.guest.email}
                </a>
              </div>

              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${booking.guest.phone}`} className="text-sm hover:underline">
                  {booking.guest.phone}
                </a>
              </div>

              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{booking.guest.country}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'payment' && <PaymentSummary booking={booking} />}

        {activeTab === 'alloggiati' && (
          <AlloggiatiBookingPanel bookingId={booking.id} checkInDate={booking.checkInDate} />
        )}
      </div>
      {(canCancel || cancelOpen) && (
        <CancelBookingDialog bookingId={booking.id} open={cancelOpen} onOpenChange={setCancelOpen} />
      )}
      {(canConfirm || confirmOpen) && (
        <ConfirmBookingDialog bookingId={booking.id} open={confirmOpen} onOpenChange={setConfirmOpen} />
      )}
    </AppShell>
  );
}

/**
 * Price as recorded: lodging (per night: base price without cleaning, divided by the nights; tourist tax and cleaning
 * excluded, A2-30), cleaning fee, tourist tax, total.
 */
function PaymentSummary({ booking }: { booking: Booking }) {
  const { t } = useTranslation();
  const breakdown = bookingPriceBreakdown(booking);
  const money = (value: number) => formatCurrency(value, booking.currency);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('booking.detailPage.paymentSummaryTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {breakdown ? (
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground" data-testid="booking-price-per-night">
                {t('booking.detailPage.lodgingPerNight', { count: breakdown.nights, perNight: money(breakdown.perNight) })}
              </dt>
              <dd>{money(breakdown.lodging)}</dd>
            </div>
            {breakdown.cleaningFee > 0 && (
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">{t('booking.detailPage.cleaningFee')}</dt>
                <dd>{money(breakdown.cleaningFee)}</dd>
              </div>
            )}
            {breakdown.touristTax > 0 && (
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">{t('booking.detailPage.touristTax')}</dt>
                <dd>{money(breakdown.touristTax)}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="booking-price-no-breakdown">
            {t('booking.detailPage.noPriceBreakdown')}
          </p>
        )}

        <div className="border-t pt-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{t('booking.detailPage.total')}</span>
            <span className="text-2xl font-bold" data-testid="booking-price-total">
              {money(booking.totalPrice)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
