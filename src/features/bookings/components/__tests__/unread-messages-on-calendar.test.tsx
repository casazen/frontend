import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { HostCalendarProperty, HostCalendarResponse } from '@/types/host-calendar.types';
import { UnreadMessagesContext } from '../../lib/unread-messages-context';
import { type HostCalendarEvent } from '../../lib/host-calendar';
import { buildTimelineRows } from '../../lib/host-timeline';
import { BookingCalendar } from '../booking-calendar';
import { HostTimeline } from '../host-timeline';

function bookingEvent(id: string, guestName: string): HostCalendarEvent {
  return {
    id,
    kind: 'booking',
    status: 'Confirmed',
    guestName,
    otaReviewReason: null,
    arrival: '2026-10-10',
    departure: '2026-10-12',
    nights: 2,
    start: new Date(2026, 9, 10),
    end: new Date(2026, 9, 12),
    allDay: true,
  };
}

describe('unread guest messages on the calendar (SR-12)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });
  afterEach(() => cleanup());

  it('BookingCalendar_BookingWithUnreadMessages_ShowsTheCounterOnlyOnThatEntry', () => {
    render(
      <UnreadMessagesContext.Provider value={new Map([['b-1', 3]])}>
        <BookingCalendar
          events={[bookingEvent('b-1', 'Sofia Marino'), bookingEvent('b-2', 'Luca Rossi')]}
          date="2026-10-10"
          view="month"
          onNavigate={vi.fn()}
          onView={vi.fn()}
        />
      </UnreadMessagesContext.Provider>,
    );

    const badges = screen.getAllByTestId('unread-messages-badge');
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent('3 messaggi da leggere');
    expect(badges[0].closest('.rbc-event')).toHaveTextContent('Sofia Marino');
  });

  it('BookingCalendar_NoProvider_ShowsNoCounter', () => {
    render(<BookingCalendar events={[bookingEvent('b-1', 'Sofia Marino')]} date="2026-10-10" view="month" onNavigate={vi.fn()} onView={vi.fn()} />);
    expect(screen.queryByTestId('unread-messages-badge')).not.toBeInTheDocument();
  });

  it('HostTimeline_BookingWithUnreadMessages_ShowsTheCounterAndSaysItInTheName', () => {
    const property: HostCalendarProperty = {
      id: 'p1', name: 'Casa Mare', city: 'Rimini', rentalMode: 'Short', status: 'Active', minNights: 1, baseRateCents: 10000, weekendSurchargePercent: 0, cleaningFeeCents: 0,
    };
    const calendar: HostCalendarResponse = {
      timezone: 'Europe/Rome', utcOffsetMinutes: 120, today: '2026-10-10', from: '2026-10-08', to: '2026-10-22', propertiesTotal: 1, properties: [property],
      items: [
        { type: 'Booking', id: 'b-1', propertyId: 'p1', from: '2026-10-10', to: '2026-10-12', status: 'Confirmed', guestName: 'Sofia Marino', channel: 'Direct' },
        { type: 'Booking', id: 'b-2', propertyId: 'p1', from: '2026-10-14', to: '2026-10-16', status: 'Confirmed', guestName: 'Luca Rossi', channel: 'Direct' },
      ],
    };
    const days = Array.from({ length: 14 }, (_, index) => `2026-10-${String(8 + index).padStart(2, '0')}`);
    render(
      <MemoryRouter>
      <UnreadMessagesContext.Provider value={new Map([['b-2', 120]])}>
        <HostTimeline rows={buildTimelineRows(calendar, '2026-10-08', 14, '2026-10-10')} days={days} today="2026-10-10" focusId="" busy={false} onOpen={vi.fn()} />
      </UnreadMessagesContext.Provider>
      </MemoryRouter>,
    );

    const bars = screen.getAllByTestId('timeline-bar');
    expect(bars).toHaveLength(2);
    const withMessages = bars.find((bar) => bar.getAttribute('data-item-id') === 'b-2')!;
    expect(within(withMessages).getByTestId('unread-messages-badge')).toHaveTextContent('99+');
    expect(withMessages).toHaveAttribute('aria-label', expect.stringContaining('120 messaggi da leggere'));
    expect(within(bars.find((bar) => bar.getAttribute('data-item-id') === 'b-1')!).queryByTestId('unread-messages-badge')).not.toBeInTheDocument();
  });
});
