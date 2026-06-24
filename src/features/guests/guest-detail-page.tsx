import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { EmptyState } from '@/components/shared/empty-state';
import { GdprTab } from './components/gdpr-tab';
import { guestsApi } from '@/api/guests.api';
import { bookingsApi } from '@/api/bookings.api';
import { formatDate, formatCurrency } from '@/lib/utils';
import { getBookingStatusLabel } from '@/lib/i18n-labels';
import { ArrowLeft, RefreshCw, User, MapPin, FileText, Shield, Calendar, Loader2 } from 'lucide-react';

const BOOKING_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  Confirmed: 'default',
  Pending: 'secondary',
  CheckedIn: 'default',
  CheckedOut: 'outline',
  Cancelled: 'destructive',
};

type TabKey = 'anagrafica' | 'prenotazioni' | 'documenti' | 'gdpr';

const TABS: { key: TabKey; labelI18nKey: string; icon: React.ReactNode }[] = [
  { key: 'anagrafica', labelI18nKey: 'guests.anagrafica', icon: <User className="h-4 w-4" /> },
  { key: 'prenotazioni', labelI18nKey: 'guests.bookings', icon: <FileText className="h-4 w-4" /> },
  { key: 'documenti', labelI18nKey: 'guests.documents', icon: <FileText className="h-4 w-4" /> },
  { key: 'gdpr', labelI18nKey: 'guests.gdpr', icon: <Shield className="h-4 w-4" /> },
];

export function GuestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('anagrafica');

  const {
    data: guest,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['guests', id],
    queryFn: () => guestsApi.getById(id!),
    enabled: !!id,
  });

  const {
    data: guestBookings,
    isLoading: bookingsLoading,
  } = useQuery({
    queryKey: ['bookings', { guestId: id }],
    queryFn: () => bookingsApi.getByGuestId(id!),
    enabled: !!id,
  });

  const bookings = guestBookings ?? [];

  if (isLoading) {
    return <LoadingScreen message={t('shared.loading.defaultMessage')} />;
  }

  if (isError || !guest) {
    return (
      <AppShell>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">{t('guests.notFound')}</h2>
          <p className="text-muted-foreground mb-4">
            {t('guests.notFoundDescription')}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" onClick={() => refetch()} disabled={isRefetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
              {t('guests.retry')}
            </Button>
            <Button variant="outline" onClick={() => navigate('/app/short-rent/guests')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('guests.backToGuests')}
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t('guests.detail')}
          description={`${guest.firstName} ${guest.lastName}`}
          action={
            <Button variant="outline" onClick={() => navigate('/app/short-rent/guests')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('guests.title')}
            </Button>
          }
        />

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 border-b pb-px">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-md transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? 'border-primary text-primary bg-background'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              {tab.icon}
              {t(tab.labelI18nKey)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'anagrafica' && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {t('guests.anagrafica')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('guests.name')}</span>
                  <span className="font-medium">{guest.firstName} {guest.lastName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('guests.email')}</span>
                  <span className="font-medium">{guest.email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('guests.phone')}</span>
                  <span className="font-medium">{guest.phoneNumber || '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('guests.gender')}</span>
                  <span className="font-medium">{guest.gender ?? '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('guests.dateOfBirth')}</span>
                  <span className="font-medium">
                    {guest.dateOfBirth ? formatDate(guest.dateOfBirth) : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('guests.placeOfBirth')}</span>
                  <span className="font-medium">{guest.placeOfBirth || '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('guests.nationality')}</span>
                  <span className="font-medium">{guest.nationality || '—'}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  {t('guests.addressSection')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('guests.address')}</span>
                  <span className="font-medium">{guest.address || '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('guests.city')}</span>
                  <span className="font-medium">{guest.city || '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('guests.postalCode')}</span>
                  <span className="font-medium">{guest.postalCode || '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('guests.country')}</span>
                  <span className="font-medium">{guest.country || '—'}</span>
                </div>
              </CardContent>
            </Card>

            {guest.notes && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">{t('guests.notes')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{guest.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'prenotazioni' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('guests.bookings')}</CardTitle>
            </CardHeader>
            <CardContent>
              {bookingsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">{t('shared.loading.defaultMessage')}</span>
                </div>
              ) : bookings.length === 0 ? (
                <EmptyState
                  icon={Calendar}
                  title={t('guests.noBookings')}
                  description={t('guests.noBookingsDescription')}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('booking.detail.propertyId')}</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('booking.list.columns.checkIn')}</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('booking.list.columns.checkOut')}</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('booking.list.columns.total')}</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('booking.list.columns.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((booking) => (
                        <tr
                          key={booking.id}
                          className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => navigate(`/app/short-rent/bookings/${booking.id}`)}
                        >
                          <td className="px-4 py-3 font-medium">{booking.propertyName ?? '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(booking.checkInDate)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(booking.checkOutDate)}</td>
                          <td className="px-4 py-3 text-right font-medium">{formatCurrency(booking.totalPrice, booking.currency)}</td>
                          <td className="px-4 py-3">
                            <Badge variant={BOOKING_STATUS_VARIANT[booking.status] ?? 'secondary'}>
                              {getBookingStatusLabel(booking.status, t)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'documenti' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {t('guests.documents')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {guest.documentNumber ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('guests.documentType')}</span>
                    <span className="font-medium">{guest.documentType ?? '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('guests.documentNumber')}</span>
                    <span className="font-medium">{guest.documentNumber}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('guests.documentIssueDate')}</span>
                    <span className="font-medium">
                      {guest.documentIssueDate ? formatDate(guest.documentIssueDate) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('guests.documentExpiryDate')}</span>
                    <span className="font-medium">
                      {guest.documentExpiryDate ? formatDate(guest.documentExpiryDate) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('guests.documentIssuingCountry')}</span>
                    <span className="font-medium">{guest.documentIssuingCountry || '—'}</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center py-6 text-center text-muted-foreground">
                  <FileText className="h-10 w-10 mb-2" />
                  <p className="text-sm">{t('guests.noDocument')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'gdpr' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t('guests.gdpr')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <GdprTab guest={guest} />
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
