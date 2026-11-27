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

  describe('the reviews (E05/F06/US02, NF-69)', () => {
    const OTA_REVIEW_KEY = 'otareview:6f1c9a52-1111-4222-8333-944455556666';
    const SITE_REVIEW_KEY = 'review:0c9d2a10-aaaa-4bbb-8ccc-123456789abc';
    const REVIEWS: InboxState = { ...TO_RESPOND, view: 'reviews' };
    const reviewsPage: MessageHubPage = {
      items: [
        thread({ threadKey: OTA_REVIEW_KEY, source: 'OtaReview', kind: 'Review', rating: 4.5, preview: 'Casa pulita e host gentilissimo.', unreadCount: 0, needsReply: true }),
        thread({ threadKey: SITE_REVIEW_KEY, source: 'Review', kind: 'Review', channel: 'Direct', rating: 5, preview: 'Tutto perfetto.', guestName: 'Luca Verdi', unreadCount: 0, needsReply: false }),
      ],
      totalCount: 2,
      page: 1,
      pageSize: 20,
    };

    it('ThreadList_ReviewsOfBothSources_ShowTheStarsInWordsAThePreviewAndNotAnsweredWhereTheHostHasNotAnswered', () => {
      renderList({ page: reviewsPage, state: REVIEWS, search: '?view=reviews' });

      const rows = screen.getAllByTestId('message-thread-row');
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveAttribute('data-kind', 'review');
      expect(rows[0]).toHaveAttribute('href', `/app/short-rent/messages/${encodeURIComponent(OTA_REVIEW_KEY)}?view=reviews`);
      expect(within(rows[0]).getByTestId('review-row-rating')).toHaveTextContent('4,5 su 5');
      expect(rows[0]).toHaveTextContent('Casa pulita e host gentilissimo.');
      expect(rows[0]).toHaveTextContent('Airbnb');
      expect(within(rows[0]).getByTestId('review-row-not-answered')).toHaveTextContent('Senza risposta');
      expect(rows[1]).toHaveAttribute('href', `/app/short-rent/messages/${encodeURIComponent(SITE_REVIEW_KEY)}?view=reviews`);
      expect(rows[1]).toHaveTextContent('Diretto');
      expect(within(rows[1]).queryByTestId('review-row-not-answered')).not.toBeInTheDocument();
      expect(within(rows[0]).queryByText(/da leggere/)).not.toBeInTheDocument();
    });

    it('ThreadList_NoReviews_SaysSoInItsOwnWordsAndNotThatThereAreNoConversations', () => {
      renderList({ page: { items: [], totalCount: 0, page: 1, pageSize: 20 }, state: REVIEWS });

      expect(screen.getByText('Non ci sono ancora recensioni')).toBeInTheDocument();
      expect(screen.queryByText('Nessun messaggio a cui rispondere')).not.toBeInTheDocument();
    });

    it('ThreadList_ReviewSearchThatFindsNothing_SaysNoReviewWasFound', () => {
      renderList({ page: { items: [], totalCount: 0, page: 1, pageSize: 20 }, state: { ...REVIEWS, q: 'zzz' } });

      expect(screen.getByText('Nessuna recensione trovata')).toBeInTheDocument();
    });
  });

  it('ThreadList_ConversationsOfTheChannelsAndDirectOnes_AreOneListOfRowsThatOpenTheThread', () => {
    renderList();

    const rows = screen.getAllByTestId('message-thread-row');
    expect(rows).toHaveLength(3);
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

  it('ThreadList_PreviewOfAnAutomaticMessageWithTheCheckInLink_IsHiddenToWhoCannotCopyItAndShownToWhoCan', () => {
    const preview = 'Ecco il link: https://casazen.test/checkin/secret-token-123 Valido fino al 20/11.';
    const page: MessageHubPage = { ...PAGE, items: [thread({ threadKey: OTA_KEY, lastMessageOrigin: 'Automation', preview, unreadCount: 0 })], totalCount: 1 };

    renderList({ page });
    const hidden = screen.getByTestId('message-thread-row');
    expect(hidden).toHaveTextContent('Messaggio automatico: Ecco il link: [link del check-in nascosto] Valido fino al 20/11.');
    expect(hidden.textContent).not.toContain('secret-token-123');
    cleanup();

    renderList({ page, canWrite: true });
    expect(screen.getByTestId('message-thread-row')).toHaveTextContent('https://casazen.test/checkin/secret-token-123');
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
