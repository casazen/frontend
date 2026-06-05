import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BookingsSummaryDto } from '@/types';
import { formatDate } from '@/lib/utils';
import { Calendar, CalendarClock, Home, ListOrdered } from 'lucide-react';

interface PropertyBookingsKpiProps {
  summary: BookingsSummaryDto;
}

export function PropertyBookingsKpi({ summary }: PropertyBookingsKpiProps) {
  const cards = [
    { label: 'Totale prenotazioni', value: summary.totalBookings, icon: ListOrdered },
    { label: 'In arrivo', value: summary.upcomingBookings, icon: CalendarClock },
    { label: 'Attive', value: summary.activeBookings, icon: Home },
    {
      label: 'Prossimo check-in',
      value: summary.nextCheckIn ? formatDate(summary.nextCheckIn) : '—',
      icon: Calendar,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Riepilogo prenotazioni</CardTitle>
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
