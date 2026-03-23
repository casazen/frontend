import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import type { Booking } from '@/types';
import type { BookingCalendarEvent } from '@/types';

const localizer = momentLocalizer(moment);

interface BookingCalendarProps {
  bookings: Booking[];
  onSelectEvent?: (event: BookingCalendarEvent) => void;
  onSelectSlot?: (slotInfo: { start: Date; end: Date }) => void;
}

export function BookingCalendar({ bookings, onSelectEvent, onSelectSlot }: BookingCalendarProps) {
  const events: BookingCalendarEvent[] = bookings.map((booking) => ({
    id: booking.id,
    title: `${booking.guest.firstName} ${booking.guest.lastName}`,
    start: new Date(booking.checkInDate),
    end: new Date(booking.checkOutDate),
    resource: booking,
  }));

  const eventStyleGetter = (event: BookingCalendarEvent) => {
    const booking = event.resource;
    let backgroundColor = '#3174ad';

    if (booking) {
      switch (booking.status) {
        case 'PENDING':
          backgroundColor = '#f59e0b';
          break;
        case 'CONFIRMED':
          backgroundColor = '#3b82f6';
          break;
        case 'CHECKED_IN':
          backgroundColor = '#10b981';
          break;
        case 'CHECKED_OUT':
          backgroundColor = '#6b7280';
          break;
        case 'CANCELLED':
          backgroundColor = '#ef4444';
          break;
      }
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '5px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block',
      },
    };
  };

  return (
    <div className="h-[600px] bg-white p-4 rounded-lg border">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%' }}
        onSelectEvent={onSelectEvent}
        onSelectSlot={onSelectSlot}
        selectable
        eventPropGetter={eventStyleGetter}
        views={['month', 'week', 'day']}
        defaultView="month"
      />
    </div>
  );
}
