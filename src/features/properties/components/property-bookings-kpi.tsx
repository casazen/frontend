import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BookingsSummaryDto } from '@/types';
import { formatDate } from '@/lib/utils';
import { Calendar, CalendarClock, Home, ListOrdered } from 'lucide-react';

interface PropertyBookingsKpiProps {
  summary: BookingsSummaryDto;
}

export function PropertyBookingsKpi({ summary }: PropertyBookingsKpiProps) {
  const { t } = useTranslation();

  const cards = [
    { label: t('property.bookings.total'), value: summary.totalBookings, icon: ListOrdered },
    { label: t('property.bookings.upcoming'), value: summary.upcomingBookings, icon: CalendarClock },
    { label: t('property.bookings.active'), value: summary.activeBookings, icon: Home },
    {
      label: t('property.bookings.nextCheckIn'),
      value: summary.nextCheckIn ? formatDate(summary.nextCheckIn) : '—',
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
