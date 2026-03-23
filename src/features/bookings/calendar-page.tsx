import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { BookingCalendar } from './components/booking-calendar';
import { useBookingCalendar } from '@/queries/use-bookings';
import { List } from 'lucide-react';
import type { BookingCalendarEvent } from '@/types';

export function CalendarPage() {
  const navigate = useNavigate();
  const { data: bookings, isLoading } = useBookingCalendar();

  const handleSelectEvent = (event: BookingCalendarEvent) => {
    if (event.resource) {
      navigate(`/bookings/${event.resource.id}`);
    }
  };

  const handleSelectSlot = (slotInfo: { start: Date; end: Date }) => {
    // Could navigate to create booking with pre-filled dates
    console.log('Selected slot:', slotInfo);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Bookings Calendar"
          description="View and manage bookings in calendar format"
          action={
            <Button variant="outline" onClick={() => navigate('/bookings')}>
              <List className="mr-2 h-4 w-4" />
              List View
            </Button>
          }
        />

        {isLoading ? (
          <div className="flex items-center justify-center h-[600px]">
            <p>Loading calendar...</p>
          </div>
        ) : (
          <BookingCalendar
            bookings={bookings || []}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
          />
        )}
      </div>
    </AppShell>
  );
}
