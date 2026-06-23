import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n/config';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Search, Loader2 } from 'lucide-react';
import { useBookings } from '@/queries/use-bookings';
import { getBookingStatusLabel } from '@/lib/i18n-labels';
import type { Booking } from '@/types';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  Confirmed: 'default',
  Pending: 'secondary',
  CheckedIn: 'outline',
  CheckedOut: 'outline',
  Cancelled: 'destructive',
};

const TABS = ['all', 'Confirmed', 'Pending', 'CheckedIn', 'CheckedOut', 'Cancelled'];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });
}

function getNights(checkIn: string, checkOut: string): number {
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function BookingDetail({ booking, onBack, t }: { booking: Booking; onBack: () => void; t: (key: string) => string }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold">{booking.id}</h2>
        </div>
        <div className="ml-auto">
          <Badge variant={STATUS_VARIANT[booking.status] ?? 'secondary'} className="capitalize">
            {getBookingStatusLabel(booking.status, t)}
          </Badge>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{t('booking.detail.guestInformation')}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('booking.detail.guestName')}</span>
              <span className="font-medium">{booking.guest.firstName} {booking.guest.lastName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('booking.detail.guestEmail')}</span>
              <span className="font-medium">{booking.guest.email}</span>
            </div>
            {booking.guest.phone && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('booking.detail.guestPhone')}</span>
                <span className="font-medium">{booking.guest.phone}</span>
              </div>
            )}
            {booking.guest.country && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('booking.detail.guestCountry')}</span>
                <span className="font-medium">{booking.guest.country}</span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t('booking.detail.bookingDetails')}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('booking.detail.propertyId')}</span>
              <span className="font-medium font-mono text-xs">{booking.propertyId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('booking.detail.checkIn')}</span>
              <span className="font-medium">{formatDate(booking.checkInDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('booking.detail.checkOut')}</span>
              <span className="font-medium">{formatDate(booking.checkOutDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('booking.detail.nights')}</span>
              <span className="font-medium">{getNights(booking.checkInDate, booking.checkOutDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('booking.detail.guests')}</span>
              <span className="font-medium">{booking.numberOfGuests}</span>
            </div>
            {booking.specialRequests && (
              <div className="flex flex-col gap-1 pt-1">
                <span className="text-muted-foreground">{t('booking.detail.specialRequests')}</span>
                <span className="text-xs">{booking.specialRequests}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2">
              <span className="font-medium">{t('booking.detail.total')}</span>
              <span className="font-bold text-primary">
                {booking.currency ?? 'EUR'} {booking.totalPrice.toLocaleString(i18n.language)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function BookingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Booking | null>(null);

  const { data: bookings, isLoading, isError } = useBookings();

  const filtered = (bookings ?? []).filter((b) => {
    const matchesTab = activeTab === 'all' || b.status === activeTab;
    const matchesSearch =
      search === '' ||
      `${b.guest.firstName} ${b.guest.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      b.id.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const getTabLabel = (tab: string): string => {
    if (tab === 'all') return t('booking.list.all');
    return getBookingStatusLabel(tab, t);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title={t('booking.list.title')} description={t('booking.list.description')} />

        {selected ? (
          <BookingDetail booking={selected} onBack={() => setSelected(null)} t={t} />
        ) : (
          <Card>
            <CardContent className="pt-4 space-y-4">
              {/* Tabs */}
              <div className="flex flex-wrap gap-1 border-b pb-3">
                {TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                      activeTab === tab
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    {getTabLabel(tab)}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('booking.list.searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Loading State */}
              {isLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">{t('booking.list.loading')}</span>
                </div>
              )}

              {/* Error State */}
              {isError && (
                <div className="py-8 text-center text-destructive">
                  {t('booking.list.loadError')}
                </div>
              )}

              {/* Table */}
              {!isLoading && !isError && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        {[
                          t('booking.list.columns.id'),
                          t('booking.list.columns.guest'),
                          t('booking.list.columns.checkIn'),
                          t('booking.list.columns.checkOut'),
                          t('booking.list.columns.nights'),
                          t('booking.list.columns.guests'),
                          t('booking.list.columns.total'),
                          t('booking.list.columns.status'),
                          '',
                        ].map((h) => (
                          <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((b) => (
                        <tr
                          key={b.id}
                          className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => setSelected(b)}
                        >
                          <td className="px-4 py-3 font-mono text-xs">{b.id.slice(0, 8)}...</td>
                          <td className="px-4 py-3 font-medium">{b.guest.firstName} {b.guest.lastName}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(b.checkInDate)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(b.checkOutDate)}</td>
                          <td className="px-4 py-3 text-center">{getNights(b.checkInDate, b.checkOutDate)}</td>
                          <td className="px-4 py-3 text-center">{b.numberOfGuests}</td>
                          <td className="px-4 py-3 font-medium">
                            {b.currency ?? 'EUR'} {b.totalPrice.toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={STATUS_VARIANT[b.status] ?? 'secondary'} className="capitalize">
                              {getBookingStatusLabel(b.status, t)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelected(b); }}>
                              {t('booking.list.view')}
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                            {t('booking.list.noResults')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
