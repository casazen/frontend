import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { messageHubApi } from '@/api/message-hub.api';
import type { MessageHubPage, MessageHubThread } from '@/types';
import { InboxPage } from '../inbox-page';

const state = vi.hoisted(() => ({ properties: [] as Array<{ id: string; name: string }> }));

vi.mock('@/api/message-hub.api', () => ({
  messageHubApi: { list: vi.fn(), unread: vi.fn(), getContactOptions: vi.fn(), startConversation: vi.fn() },
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ hasPermission: () => true }) }));
vi.mock('@/queries/use-properties', () => ({ useProperties: () => ({ data: state.properties }) }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));

const PROPERTY_A = '6f1c9a52-1111-4222-8333-944455556666';
const PROPERTY_B = '7a2d0b63-2222-4333-8444-a55566667777';
const BOOKING = '0c9d2a10-aaaa-4bbb-8ccc-123456789abc';

function thread(overrides: Partial<MessageHubThread> & { threadKey: string }): MessageHubThread {
  return {
    source: 'Ota',
    channel: 'Airbnb',
    kind: 'Reservation',
    state: 'Open',
    propertyId: PROPERTY_A,
    propertyName: 'Casa Mare',
    unassigned: false,
    bookingId: 'b-1',
    bookingCode: 'ABCDE-12345',
    guestName: 'Sofia Marino',
    checkInDate: '2026-11-20',
    checkOutDate: '2026-11-23',
    lastMessageAt: '2026-11-10T08:00:00Z',
    lastMessageOrigin: 'Guest',
    preview: 'Che ore sono il check-in?',
    unreadCount: 1,
    needsReply: true,
    ...overrides,
  };
}

const PAGE: MessageHubPage = { items: [thread({ threadKey: 'ota:1' })], totalCount: 1, page: 1, pageSize: 20 };
const EMPTY: MessageHubPage = { items: [], totalCount: 0, page: 1, pageSize: 20 };

function renderInbox(address = '/app/short-rent/messages') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[address]}>
        <InboxPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const lastFilters = () => vi.mocked(messageHubApi.list).mock.calls.at(-1)?.[0];

describe('InboxPage (NF-61)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    state.properties = [];
    vi.mocked(messageHubApi.list).mockResolvedValue(PAGE);
    vi.mocked(messageHubApi.unread).mockResolvedValue({ items: [] });
    await i18n.changeLanguage('it');
  });
  afterEach(() => cleanup());

  it('InboxPage_Opens_OnDaRispondereAndAsksTheListWithTheOtaConversationsIncluded', async () => {
    renderInbox();

    expect(await screen.findByTestId('message-thread-row')).toBeInTheDocument();
    expect(messageHubApi.list).toHaveBeenCalledWith({ needsReply: true, page: 1, pageSize: 20 });
    expect(screen.getByTestId('messages-view-toRespond')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Messaggi');
  });

  it('InboxPage_Tutte_AsksForEveryConversation', async () => {
    renderInbox();
    await screen.findByTestId('message-thread-row');

    fireEvent.click(screen.getByTestId('messages-view-all'));

    await waitFor(() => expect(lastFilters()).toEqual({ page: 1, pageSize: 20 }));
    expect(screen.getByTestId('messages-view-all')).toHaveAttribute('aria-pressed', 'true');
  });

  it('InboxPage_NonLette_AsksForTheConversationsWithUnreadMessages', async () => {
    renderInbox();
    await screen.findByTestId('message-thread-row');

    fireEvent.click(screen.getByTestId('messages-view-unread'));

    await waitFor(() => expect(lastFilters()).toEqual({ unread: true, page: 1, pageSize: 20 }));
  });

  it('InboxPage_Channel_NarrowsTheList', async () => {
    renderInbox();
    await screen.findByTestId('message-thread-row');

    fireEvent.change(screen.getByTestId('messages-channel-filter'), { target: { value: 'Booking' } });

    await waitFor(() => expect(lastFilters()).toEqual({ needsReply: true, channel: 'Booking', page: 1, pageSize: 20 }));
  });

  it('InboxPage_Property_IsOfferedOnlyToWhoHasMoreThanOne', async () => {
    renderInbox();
    await screen.findByTestId('message-thread-row');
    expect(screen.queryByTestId('messages-property-filter')).not.toBeInTheDocument();
    cleanup();

    state.properties = [
      { id: PROPERTY_A, name: 'Casa Mare' },
      { id: PROPERTY_B, name: 'Casa Monti' },
    ];
    renderInbox();
    await screen.findByTestId('message-thread-row');
    fireEvent.change(screen.getByTestId('messages-property-filter'), { target: { value: PROPERTY_B } });

    await waitFor(() => expect(lastFilters()).toEqual({ needsReply: true, propertyId: PROPERTY_B, page: 1, pageSize: 20 }));
  });

  it('InboxPage_Search_IsAppliedAfterTheLastKeyNotOnEveryOne', async () => {
    renderInbox();
    await screen.findByTestId('message-thread-row');
    vi.mocked(messageHubApi.list).mockClear();

    const box = screen.getByTestId('messages-search');
    fireEvent.change(box, { target: { value: 'ro' } });
    fireEvent.change(box, { target: { value: 'rossi' } });
    expect(messageHubApi.list).not.toHaveBeenCalled();

    await waitFor(() => expect(lastFilters()).toEqual({ needsReply: true, q: 'rossi', page: 1, pageSize: 20 }));
    // One request for the whole word, not one for each key.
    expect(vi.mocked(messageHubApi.list).mock.calls.filter(([filters]) => filters?.q === 'ro')).toHaveLength(0);
  });

  it('InboxPage_AddressWithTheFilters_IsTheListAsItWasLeft', async () => {
    renderInbox(`/app/short-rent/messages?view=unread&channel=Vrbo&property=${PROPERTY_A}&q=rossi&page=2`);

    await screen.findByTestId('message-thread-row');
    expect(messageHubApi.list).toHaveBeenCalledWith({ unread: true, channel: 'Vrbo', propertyId: PROPERTY_A, q: 'rossi', page: 2, pageSize: 20 });
    expect(screen.getByTestId('messages-search')).toHaveValue('rossi');
    expect(screen.getByTestId('messages-channel-filter')).toHaveValue('Vrbo');
  });

  it('InboxPage_ClearFilters_GoesBackToTheWholeViewAndEmptiesTheSearchBox', async () => {
    renderInbox('/app/short-rent/messages?view=all&channel=Vrbo&q=rossi');
    await screen.findByTestId('message-thread-row');

    fireEvent.click(screen.getByTestId('messages-clear-filters'));

    await waitFor(() => expect(lastFilters()).toEqual({ page: 1, pageSize: 20 }));
    expect(screen.getByTestId('messages-search')).toHaveValue('');
  });

  it('InboxPage_BookingWithNoConversation_SaysHowTheGuestCanBeReachedInsteadOfAnEmptyList', async () => {
    vi.mocked(messageHubApi.list).mockResolvedValue(EMPTY);
    vi.mocked(messageHubApi.getContactOptions).mockResolvedValue({ channel: 'Email', emailAvailable: true, phoneAvailable: false });
    renderInbox(`/app/short-rent/messages?view=all&booking=${BOOKING}`);

    expect(await screen.findByTestId('contact-email-form')).toBeInTheDocument();
    expect(messageHubApi.getContactOptions).toHaveBeenCalledWith(BOOKING);
    expect(screen.getByTestId('messages-booking-filter')).toHaveTextContent('Solo una prenotazione');
  });

  it('InboxPage_BookingThatHasConversations_ListsThemAndDoesNotAskHowToReachTheGuest', async () => {
    renderInbox(`/app/short-rent/messages?view=all&booking=${BOOKING}`);

    await screen.findByTestId('message-thread-row');
    expect(messageHubApi.getContactOptions).not.toHaveBeenCalled();
  });

  it('InboxPage_NeverNamesTheChannelManager', async () => {
    renderInbox();
    await screen.findByTestId('message-thread-row');

    expect(document.body.textContent).not.toMatch(/octorate/i);
  });
});
