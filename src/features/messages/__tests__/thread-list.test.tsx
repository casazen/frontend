import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { MessageHubPage, MessageHubThread } from '@/types';
import type { InboxState } from '../lib/inbox-state';
import { ThreadList } from '../components/thread-list';

const OTA_KEY = 'ota:6f1c9a52-1111-4222-8333-944455556666';
const DIRECT_KEY = 'direct:0c9d2a10-aaaa-4bbb-8ccc-123456789abc';

function thread(overrides: Partial<MessageHubThread> & { threadKey: string }): MessageHubThread {
  return {
    source: 'Ota',
    channel: 'Airbnb',
    kind: 'Reservation',
    state: 'Open',
    propertyId: 'p-1',
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
    unreadCount: 2,
    needsReply: true,
    ...overrides,
  };
}

const PAGE: MessageHubPage = {
  items: [
    thread({ threadKey: OTA_KEY }),
    thread({ threadKey: DIRECT_KEY, source: 'Direct', channel: 'Direct', guestName: 'Luca Verdi', bookingCode: 'FGHIJ-67890', unreadCount: 0, lastMessageOrigin: 'Person', preview: 'Ti aspettiamo.' }),
    thread({ threadKey: 'ota:2222', kind: 'Request', bookingId: null, bookingCode: null, guestName: null, channel: 'Booking', unreadCount: 1, checkInDate: null, checkOutDate: null }),
  ],
  totalCount: 3,
  page: 1,
  pageSize: 20,
};

const TO_RESPOND: InboxState = { view: 'toRespond', channel: null, propertyId: null, bookingId: null, q: '', page: 1 };

function renderList(props: Partial<React.ComponentProps<typeof ThreadList>> = {}) {
  const onChange = vi.fn();
  render(
    <MemoryRouter>
      <ThreadList page={PAGE} loading={false} error={null} onRetry={vi.fn()} state={TO_RESPOND} search="?view=all" onChange={onChange} {...props} />
    </MemoryRouter>,
  );
  return { onChange };
}

describe('ThreadList (NF-61)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });
  afterEach(() => cleanup());

  it('ThreadList_ConversationsOfTheChannelsAndDirectOnes_AreOneListOfRowsThatOpenTheThread', () => {
    renderList();

    const rows = screen.getAllByTestId('message-thread-row');
    expect(rows).toHaveLength(3);
    // The key is escaped in the address, and the filters of the list go with it.
    expect(rows[0]).toHaveAttribute('href', `/app/short-rent/messages/${encodeURIComponent(OTA_KEY)}?view=all`);
    expect(rows[1]).toHaveAttribute('href', `/app/short-rent/messages/${encodeURIComponent(DIRECT_KEY)}?view=all`);
    expect(within(rows[0]).getByTestId('channel-badge')).toHaveTextContent('Airbnb');
    expect(within(rows[1]).getByTestId('channel-badge')).toHaveTextContent('Diretto');
    expect(within(rows[0]).getByText('Sofia Marino')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Che ore sono il check-in?')).toBeInTheDocument();
    expect(within(rows[0]).getByText('ABCDE-12345')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Casa Mare')).toBeInTheDocument();
  });

  it('ThreadList_UnreadMessages_ShowTheCountInWordsAndAReadThreadShowsNone', () => {
    renderList();

    const rows = screen.getAllByTestId('message-thread-row');
    expect(within(rows[0]).getByTestId('unread-messages-badge')).toHaveTextContent('2 messaggi da leggere');
    expect(within(rows[1]).queryByTestId('unread-messages-badge')).not.toBeInTheDocument();
  });

  it('ThreadList_ThreadWithoutBooking_IsLabelledRichiestaInsteadOfACode', () => {
    renderList();

    const request = screen.getAllByTestId('message-thread-row')[2];
    expect(within(request).getByTestId('thread-request-label')).toHaveTextContent('Richiesta');
    expect(within(request).getByText('Ospite')).toBeInTheDocument();
  });

  it('ThreadList_LastMessageOfTheHost_StartsThePreviewWithWhoWroteIt', () => {
    renderList();

    expect(within(screen.getAllByTestId('message-thread-row')[1]).getByText('Tu: Ti aspettiamo.')).toBeInTheDocument();
  });

  it('ThreadList_ViewAll_SaysWhichConversationsWaitForAnAnswer_ViewToRespondDoesNot', () => {
    const { onChange } = renderList({ state: { ...TO_RESPOND, view: 'all' } });

    expect(screen.getAllByText('Da rispondere')).toHaveLength(3);
    expect(onChange).not.toHaveBeenCalled();
    cleanup();

    renderList();
    expect(screen.queryByText('Da rispondere')).not.toBeInTheDocument();
  });

  it('ThreadList_OpenConversation_MarksItsRow', () => {
    renderList({ selectedKey: DIRECT_KEY });

    const rows = screen.getAllByTestId('message-thread-row');
    expect(rows[1]).toHaveAttribute('aria-current', 'true');
    expect(rows[0]).not.toHaveAttribute('aria-current');
  });

  it('ThreadList_NothingToRespondTo_SaysItInSimpleWordsAndOffersAllTheConversations', () => {
    const { onChange } = renderList({ page: { items: [], totalCount: 0, page: 1, pageSize: 20 } });

    expect(screen.getByText('Nessun messaggio a cui rispondere')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mostra tutte le conversazioni' }));
    expect(onChange).toHaveBeenCalledWith({ view: 'all' });
  });

  it('ThreadList_SearchThatFindsNothing_OffersToClearTheFilters', () => {
    const { onChange } = renderList({ page: { items: [], totalCount: 0, page: 1, pageSize: 20 }, state: { ...TO_RESPOND, view: 'all', q: 'zzz' } });

    expect(screen.getByText('Nessuna conversazione trovata')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Azzera i filtri' }));
    expect(onChange).toHaveBeenCalledWith({ channel: null, propertyId: null, bookingId: null, q: '' });
  });

  it('ThreadList_FailedLoad_IsAnErrorWithARetryNeverAnEmptyList', () => {
    const onRetry = vi.fn();
    renderList({ page: undefined, error: new Error('boom'), onRetry });

    expect(screen.getByTestId('messages-error')).toHaveTextContent('Non riesco a caricare i messaggi.');
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Nessun messaggio a cui rispondere')).not.toBeInTheDocument();
  });

  it('ThreadList_FirstLoad_ShowsTheWaitingStateAndNoRow', () => {
    renderList({ page: undefined, loading: true });

    expect(screen.getByRole('status')).toHaveTextContent('Carico le conversazioni…');
    expect(screen.queryByTestId('message-thread-row')).not.toBeInTheDocument();
  });

  it('ThreadList_MoreThanAPage_OffersThePagination', () => {
    const { onChange } = renderList({ page: { ...PAGE, totalCount: 45 } });

    fireEvent.click(screen.getByRole('button', { name: /successiva/i }));
    expect(onChange).toHaveBeenCalledWith({ page: 2 });
  });
});
