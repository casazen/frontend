import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useTranslation } from 'react-i18next';
import type { Booking } from '@/types';
import type { BookingCalendarEvent } from '@/types';

const localizer = momentLocalizer(moment);

interface BookingCalendarProps {
  bookings: Booking[];
  icalEvents?: BookingCalendarEvent[];
  onSelectEvent?: (event: BookingCalendarEvent) => void;
  onSelectSlot?: (slotInfo: { start: Date; end: Date }) => void;
}

export function BookingCalendar({ bookings, icalEvents = [], onSelectEvent, onSelectSlot }: BookingCalendarProps) {
  const { t } = useTranslation();

  const bookingEvents: BookingCalendarEvent[] = bookings.map((booking) => ({
    id: booking.id,
    title: `${booking.guest.firstName} ${booking.guest.lastName}`,
    start: new Date(booking.checkInDate),
    end: new Date(booking.checkOutDate),
    resource: booking,
    eventType: 'booking',
  }));

  const events: BookingCalendarEvent[] = [...bookingEvents, ...icalEvents];

  const eventStyleGetter = (event: BookingCalendarEvent) => {
    if (event.eventType === 'ical-block') {
      return {
        style: {
          backgroundColor: '#9333ea',
          borderRadius: '5px',
          opacity: 0.85,
          color: 'white',
          border: '0px',
          display: 'block',
        },
      };
    }

    const booking = event.resource;
    let backgroundColor = '#3174ad';

    if (booking) {
      switch (booking.status) {
        case 'Pending':
          backgroundColor = '#f59e0b';
          break;
        case 'Confirmed':
          backgroundColor = '#3b82f6';
          break;
        case 'CheckedIn':
          backgroundColor = '#10b981';
          break;
        case 'CheckedOut':
          backgroundColor = '#6b7280';
          break;
        case 'Cancelled':
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
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-blue-500" />
          {t('ical.legendBooking')}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-purple-600" />
          {t('ical.legendIcalBlock')}
        </span>
      </div>
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
    </div>
  );
}
