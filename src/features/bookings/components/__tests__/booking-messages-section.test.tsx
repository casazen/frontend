import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import { bookingMessagesApi } from '@/api/booking-messages.api';
import type { Booking, HostThread } from '@/types';
import { BookingMessagesSection } from '../booking-messages-section';

vi.mock('@/api/booking-messages.api', () => ({
  bookingMessagesApi: { getThread: vi.fn(), markRead: vi.fn(), send: vi.fn(), listThreads: vi.fn(), listUnread: vi.fn() },
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ hasPermission: () => true }) }));

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
      <BookingMessagesSection booking={BOOKING} />
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
