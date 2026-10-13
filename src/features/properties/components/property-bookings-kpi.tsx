import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BookingsSummaryDto } from '@/types';
import { formatStayDate } from '@/lib/stay-dates';
import { stayDateOf } from '@/features/bookings/lib/booking-price';
import { Calendar, CalendarClock, Home, ListOrdered } from 'lucide-react';

interface PropertyBookingsKpiProps {
  summary: BookingsSummaryDto;
}

/**
 * Bookings KPIs of the property (A2-36): counted by the backend on Europe/Rome dates, never with cancelled bookings;
 * the next check-in is a calendar date, shown without time zone shift.
 */
export function PropertyBookingsKpi({ summary }: PropertyBookingsKpiProps) {
  const { t, i18n } = useTranslation();

  const cards = [
    { label: t('property.bookings.total'), value: summary.totalBookings, icon: ListOrdered },
    { label: t('property.bookings.upcoming'), value: summary.upcomingBookings, icon: CalendarClock },
    { label: t('property.bookings.active'), value: summary.activeBookings, icon: Home },
    {
      label: t('property.bookings.nextCheckIn'),
      value: summary.nextCheckIn ? formatStayDate(stayDateOf(summary.nextCheckIn), i18n.language) : '—',
      icon: Calendar,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('property.bookings.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="h-4 w-4" />
                <span className="text-xs">{label}</span>
              </div>
              <div className="text-2xl font-bold">{value}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
