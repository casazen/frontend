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

  it('BookingDrawerContent_UnreadMessages_ShowsTheCountNextToTheTitle', () => {
    renderDrawer();
    const section = screen.getByTestId('booking-drawer-messages');
    expect(section).toHaveTextContent('4 messaggi da leggere');
  });

  it('BookingDrawerContent_OpenedWithFocusMessages_ScrollsToTheConversationAndFocusesItsTitle', () => {
    renderDrawer('?detail=booking:b-1&focus=messages');
    const title = screen.getByRole('heading', { name: /Messaggi/ });
    expect(title).toHaveFocus();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('BookingDrawerContent_OpenedPlainly_KeepsTheFocusWhereItWas', () => {
    renderDrawer('?detail=booking:b-1');
    expect(screen.getByRole('heading', { name: /Messaggi/ })).not.toHaveFocus();
  });
});
