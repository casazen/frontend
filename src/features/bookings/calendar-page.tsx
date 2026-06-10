import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { BookingCalendar } from './components/booking-calendar';
import { useBookingCalendar } from '@/queries/use-bookings';
import { useProperties } from '@/queries/use-properties';
import { List } from 'lucide-react';
import type { Booking, BookingCalendarEvent } from '@/types';
import type { CalendarBookingDto } from '@/types/calendar.types';

function toMonthRange(date: Date): { startDate: string; endDate: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function mapCalendarBooking(dto: CalendarBookingDto): Booking {
  const [firstName = '', ...rest] = dto.guestName.split(' ');
  return {
    id: dto.id,
    propertyId: dto.propertyId,
    userId: '',
    checkInDate: dto.checkInDate,
    checkOutDate: dto.checkOutDate,
    numberOfGuests: dto.numberOfGuests,
    totalPrice: dto.totalPrice,
    currency: 'EUR',
    status: dto.status as Booking['status'],
    guest: {
      firstName,
      lastName: rest.join(' '),
      email: '',
      phone: '',
      country: '',
    },
    createdAt: dto.checkInDateUtc,
    updatedAt: dto.checkOutDateUtc,
  };
}

export function CalendarPage() {
  const navigate = useNavigate();
  const { data: properties, isLoading: propertiesLoading } = useProperties();
  const propertyList = properties ?? [];
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');

  const activePropertyId = selectedPropertyId || propertyList[0]?.id || '';
  const { startDate, endDate } = useMemo(() => toMonthRange(new Date()), []);

  const { data: calendarResponse, isLoading: calendarLoading, isError } = useBookingCalendar(
    activePropertyId
      ? { propertyId: activePropertyId, startDate, endDate }
      : undefined,
  );

  const bookings = useMemo(
    () => (calendarResponse?.bookings ?? []).map(mapCalendarBooking),
    [calendarResponse],
  );

  const handleSelectEvent = (event: BookingCalendarEvent) => {
    if (event.resource) {
      navigate(`/app/short-rent/bookings/${event.resource.id}`);
    }
  };

  const handleSelectSlot = (slotInfo: { start: Date; end: Date }) => {
    console.log('Selected slot:', slotInfo);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Bookings Calendar"
          description="View and manage bookings in calendar format"
          action={
            <Button variant="outline" onClick={() => navigate('/app/short-rent/bookings')}>
              <List className="mr-2 h-4 w-4" />
              List View
            </Button>
          }
        />

        {propertiesLoading ? (
          <div className="flex h-[600px] items-center justify-center">
            <p>Loading calendar...</p>
          </div>
        ) : propertyList.length === 0 ? (
          <div className="flex h-[400px] flex-col items-center justify-center gap-2 text-center">
            <p className="font-medium">Nessuna proprietà disponibile</p>
            <p className="text-sm text-muted-foreground">
              Aggiungi una proprietà per visualizzare il calendario prenotazioni.
            </p>
            <Button onClick={() => navigate('/app/short-rent/properties')}>Vai alle proprietà</Button>
          </div>
        ) : (
          <>
            <div className="max-w-sm space-y-2">
              <Label htmlFor="calendar-property">Proprietà</Label>
              <select
                id="calendar-property"
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={activePropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
              >
                {propertyList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {calendarLoading ? (
              <div className="flex h-[600px] items-center justify-center">
                <p>Loading calendar...</p>
              </div>
            ) : isError ? (
              <div className="flex h-[400px] items-center justify-center text-destructive">
                Impossibile caricare il calendario. Riprova più tardi.
              </div>
            ) : (
              <BookingCalendar
                bookings={bookings}
                onSelectEvent={handleSelectEvent}
                onSelectSlot={handleSelectSlot}
              />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
