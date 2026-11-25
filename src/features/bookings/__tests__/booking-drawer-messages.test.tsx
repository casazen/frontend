import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { Booking } from '@/types';
import { BookingDrawerContent } from '../booking-drawer';

const BOOKING = {
  id: 'b-1',
  source: 'Direct',
  status: 'Confirmed',
  propertyName: 'Casa Mare',
  checkInDate: '2026-10-10',
  checkOutDate: '2026-10-12',
  numberOfGuests: 2,
  guest: { firstName: 'Sofia', lastName: 'Marino', email: '', phone: '' },
} as unknown as Booking;

vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ hasPermission: () => true }) }));
vi.mock('@/queries/use-bookings', () => ({ useBooking: () => ({ data: BOOKING, isLoading: false, isError: false }) }));
vi.mock('@/queries/use-dashboard', () => ({ useRefreshDashboard: () => vi.fn() }));
vi.mock('@/queries/use-booking-messages', () => ({ useBookingThread: () => ({ data: { unreadCount: 4 } }) }));
vi.mock('../components/booking-messages-section', () => ({ BookingMessagesSection: () => <div data-testid="thread" /> }));
vi.mock('../components/booking-timeline-section', () => ({ BookingTimelineSection: () => null }));
vi.mock('../components/check-in-dialog', () => ({ CheckInDialog: () => null }));

function renderDrawer(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/app/short-rent/bookings${search}`]}>
      <BookingDrawerContent id="b-1" />
    </MemoryRouter>,
  );
}

describe('the conversation in the booking drawer (SR-12)', () => {
  beforeEach(async () => {
    Element.prototype.scrollIntoView = vi.fn();
    await i18n.changeLanguage('it');
  });
  afterEach(() => cleanup());

  it('opens the preview without mounting the conversation or history', () => {
    renderDrawer();
    expect(screen.getByTestId('booking-drawer')).toHaveTextContent('Sofia Marino');
    expect(screen.queryByTestId('thread')).not.toBeInTheDocument();
    expect(screen.queryByTestId('booking-drawer-timeline')).not.toBeInTheDocument();
  });

  it('keeps a direct route to the conversation for a legacy message link', () => {
    renderDrawer('?detail=booking:b-1&focus=messages');
    expect(screen.getByRole('link', { name: 'Messaggi' })).toHaveAttribute('href', '/app/short-rent/bookings/b-1?tab=messages');
    expect(screen.queryByTestId('thread')).not.toBeInTheDocument();
  });
});
