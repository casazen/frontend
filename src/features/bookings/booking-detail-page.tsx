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
import { BOOKING_STATUS_VARIANTS } from './schemas/booking.schema';
import { getBookingStatusLabel } from '@/lib/i18n-labels';
import { Edit, Calendar, Users, Mail, Phone, MapPin } from 'lucide-react';
import { useAlloggiatiStatus } from '@/queries/use-alloggiati';
import { AlloggiatiStatusBadge } from '@/features/alloggiati/components/alloggiati-status-badge';
import { ResendButton } from '@/features/alloggiati/components/resend-button';
import { ServiceRequestForm } from '@/features/service-requests/components/service-request-form';
import { ServiceRequestTimeline } from '@/features/service-requests/components/service-request-timeline';
import { useProperty } from '@/queries/use-properties';
import { useServiceRequests } from '@/queries/use-service-requests';
import { CheckInSessionBadge } from './components/checkin-session-badge';

type BookingTab = 'details' | 'guest' | 'payment' | 'alloggiati';

export function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<BookingTab>('details');
  const { data: booking, isLoading } = useBooking(id!);
  const { data: property } = useProperty(booking?.propertyId ?? '');
  const { data: serviceRequests } = useServiceRequests(
    booking ? { propertyId: booking.propertyId } : undefined,
  );
  const { data: alloggiatiStatus } = useAlloggiatiStatus(id!);
  const { t } = useTranslation();

  if (isLoading) {
    return <LoadingScreen message={t('booking.detailPage.loading')} />;
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

  const statusLabel = getBookingStatusLabel(booking.status, t);
  const statusVariant = BOOKING_STATUS_VARIANTS[booking.status] || BOOKING_STATUS_VARIANTS.Pending;
  const nights = Math.ceil(
    (new Date(booking.checkOutDate).getTime() - new Date(booking.checkInDate).getTime()) / (1000 * 60 * 60 * 24)
  );

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
          title={`Booking #${booking.id.slice(0, 8)}`}
          description={`${booking.guest.firstName} ${booking.guest.lastName}`}
          action={
            <div className="flex gap-2">
              {property?.city && (
                <ServiceRequestForm
                  propertyId={booking.propertyId}
                  bookingId={booking.id}
                  propertyCity={property.city}
                />
              )}
              <Button onClick={() => navigate(`/app/short-rent/bookings/${id}/edit`)}>
                <Edit className="mr-2 h-4 w-4" />
                {t('booking.detailPage.editBooking')}
              </Button>
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
                    <Badge variant={statusVariant} className="text-base px-3 py-1">
                      {statusLabel}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Calendar className="h-4 w-4" />
                        {t('booking.detail.checkIn')}
                      </div>
                      <div className="font-medium">{formatDate(booking.checkInDate, 'PPP')}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Calendar className="h-4 w-4" />
                        {t('booking.detail.checkOut')}
                      </div>
                      <div className="font-medium">{formatDate(booking.checkOutDate, 'PPP')}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <span>{booking.numberOfGuests} {t('booking.detail.guest_other')}</span>
                    </div>
                    <div className="text-muted-foreground">
                      {nights} {nights !== 1 ? t('booking.detail.night_other') : t('booking.detail.night_one')}
                    </div>
                  </div>

                  {booking.specialRequests && (
                    <div className="pt-3 border-t">
                      <div className="text-sm text-muted-foreground mb-1">{t('booking.detailPage.specialRequests')}</div>
                      <p className="text-sm">{booking.specialRequests}</p>
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
                    <div>{formatDate(booking.createdAt, 'PPp')}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">{t('booking.detailPage.lastUpdated')}</div>
                    <div>{formatDate(booking.updatedAt, 'PPp')}</div>
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

        {activeTab === 'payment' && (
          <Card>
            <CardHeader>
              <CardTitle>{t('booking.detailPage.paymentSummaryTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {nights} {nights !== 1 ? t('booking.detail.night_other') : t('booking.detail.night_one')}
                </span>
                <span>{formatCurrency(booking.totalPrice / nights, booking.currency)}{t('booking.detailPage.perNight')}</span>
              </div>

              <div className="border-t pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{t('booking.detailPage.total')}</span>
                  <span className="text-2xl font-bold">
                    {formatCurrency(booking.totalPrice, booking.currency)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'alloggiati' && alloggiatiStatus && (
          <Card data-testid="booking-alloggiati-section">
            <CardHeader>
              <CardTitle>{t('booking.detailPage.alloggiatiWeb')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('booking.detailPage.communicationStatus')}</span>
                <AlloggiatiStatusBadge
                  status={alloggiatiStatus.status}
                  isOverdue={alloggiatiStatus.isOverdue}
                />
              </div>
              {alloggiatiStatus.confirmationNumber && (
                <div className="text-sm">
                  <span className="text-muted-foreground">{t('booking.detailPage.confirmation')}</span>
                  {alloggiatiStatus.confirmationNumber}
                </div>
              )}
              {alloggiatiStatus.errorMessage && (
                <p className="text-sm text-destructive">{alloggiatiStatus.errorMessage}</p>
              )}
              {!alloggiatiStatus.dataComplete && (
                <p className="text-sm text-muted-foreground">{t('booking.detailPage.incompleteGuestData')}</p>
              )}
              <ResendButton bookingId={id!} status={alloggiatiStatus.status} />
            </CardContent>
          </Card>
        )}

        {activeTab === 'alloggiati' && !alloggiatiStatus && (
          <Card>
            <CardHeader>
              <CardTitle>{t('booking.detailPage.alloggiatiWeb')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t('booking.detailPage.noAlloggiatiInfo')}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
