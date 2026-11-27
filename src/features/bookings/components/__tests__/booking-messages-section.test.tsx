import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { bookingMessagesApi } from '@/api/booking-messages.api';
import type { Booking, HostThread } from '@/types';
import { BookingMessagesSection } from '../booking-messages-section';

vi.mock('@/api/booking-messages.api', () => ({
  bookingMessagesApi: { getThread: vi.fn(), markRead: vi.fn(), send: vi.fn(), listThreads: vi.fn(), listUnread: vi.fn() },
}));
const permissions = vi.hoisted(() => ({ read: true }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (_context: string, permission: string) => permission !== 'booking.read' || permissions.read }),
}));

const BOOKING = { id: 'b-1', guest: { firstName: 'Sofia', lastName: 'Marino' } } as unknown as Booking;

function thread(unreadCount: number): HostThread {
  return {
    state: 'Open',
    closesAt: null,
    unreadCount,
    needsReply: unreadCount > 0,
    messages: [{ id: 'm-1', sender: 'Guest', text: 'Ciao', createdAt: '2026-10-23T10:00:00Z' }] as HostThread['messages'],
  };
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
}

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <BookingMessagesSection booking={BOOKING} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BookingMessagesSection: marking the thread as read (SR-12)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    setVisibility('visible');
    vi.mocked(bookingMessagesApi.getThread).mockResolvedValue(thread(2));
    vi.mocked(bookingMessagesApi.markRead).mockResolvedValue(thread(0));
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    setVisibility('visible');
  });

  it('BookingMessagesSection_VisibleWithUnreadMessages_MarksThemReadOnce', async () => {
    renderSection();
    await screen.findByTestId('booking-messages');
    await waitFor(() => expect(bookingMessagesApi.markRead).toHaveBeenCalledWith('b-1'));
    expect(bookingMessagesApi.markRead).toHaveBeenCalledTimes(1);
  });

  it('BookingMessagesSection_TabHidden_DoesNotMarkUntilItIsInFrontAgain', async () => {
    setVisibility('hidden');
    renderSection();
    await screen.findByTestId('booking-messages');
    expect(bookingMessagesApi.markRead).not.toHaveBeenCalled();

    setVisibility('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(bookingMessagesApi.markRead).toHaveBeenCalledTimes(1));
  });

  it('BookingMessagesSection_NothingUnread_DoesNotCallTheApi', async () => {
    vi.mocked(bookingMessagesApi.getThread).mockResolvedValue(thread(0));
    renderSection();
    await screen.findByTestId('booking-messages');
    expect(bookingMessagesApi.markRead).not.toHaveBeenCalled();
  });
});

// NF-61, NF-63: how a booking leads to the page of the messages, where its conversations are and where the host is told how a guest with
// no conversation can be written to (the contact options). Without this link the panel of the contact options had no way in.
describe('BookingMessagesSection: the way to the page of the messages', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    setVisibility('visible');
    permissions.read = true;
    vi.mocked(bookingMessagesApi.getThread).mockResolvedValue(thread(0));
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    setVisibility('visible');
    permissions.read = true;
  });

  it('BookingMessagesSection_BookingWithItsThread_LeadsToTheMessagesOfThatBooking', async () => {
    renderSection();

    const link = await screen.findByTestId('booking-messages-hub-link');
    expect(link).toHaveTextContent("Scrivi all'ospite");
    // The same address the inbox reads back as «all the conversations of this booking».
    expect(link).toHaveAttribute('href', '/app/short-rent/messages?view=all&booking=b-1');
  });

  it('BookingMessagesSection_BookingWithNoThread_LeadsThereToo', async () => {
    vi.mocked(bookingMessagesApi.getThread).mockResolvedValue({ state: 'Unavailable', closesAt: null, unreadCount: 0, needsReply: false, messages: [] });
    renderSection();

    expect(await screen.findByTestId('booking-messages-unavailable')).toBeInTheDocument();
    expect(screen.getByTestId('booking-messages-hub-link')).toHaveAttribute('href', '/app/short-rent/messages?view=all&booking=b-1');
  });

  it('BookingMessagesSection_UserWhoMayNotOpenTheMessages_HasNoLinkToThePageOfNoAccess', async () => {
    permissions.read = false;
    renderSection();

    await screen.findByTestId('booking-messages');
    expect(screen.queryByTestId('booking-messages-hub-link')).not.toBeInTheDocument();
  });
});
