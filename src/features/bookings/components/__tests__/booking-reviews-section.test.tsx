import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError } from 'axios';
import { otaReviewsApi } from '@/api/ota-reviews.api';
import { hostReviewsApi } from '@/api/reviews.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import i18n from '@/i18n/config';
import { expectNoAxeViolations } from '@/test/axe';
import type { Booking, BookingReviewItem, BookingReviews } from '@/types';
import { BookingReviewsSection } from '../booking-reviews-section';

vi.mock('@/api/ota-reviews.api', () => ({
  otaReviewsApi: {
    getReviewThread: vi.fn(),
    getBookingReviews: vi.fn(),
    refreshBookingReviews: vi.fn(),
    replyToOtaReview: vi.fn(),
    sendHostReview: vi.fn(),
    replyToDirectReview: vi.fn(),
    requestReviewDraft: vi.fn(),
  },
}));
vi.mock('@/api/reviews.api', () => ({
  hostReviewsApi: { getInviteStatus: vi.fn(), sendInvite: vi.fn(), list: vi.fn(), reply: vi.fn(), report: vi.fn() },
  publicReviewsApi: { list: vi.fn(), lookupLink: vi.fn(), submit: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const KEY = 'otareview:6f1c9a52-1111-4222-8333-944455556666';

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'b-1',
    propertyId: 'p-1',
    userId: 'u-1',
    checkInDate: '2026-06-01T14:00:00Z',
    checkOutDate: '2026-06-04T10:00:00Z',
    numberOfGuests: 2,
    totalPrice: 300,
    currency: 'EUR',
    status: 'CheckedOut',
    source: 'Airbnb',
    createdAt: '2026-05-01T10:00:00Z',
    updatedAt: '2026-05-01T10:00:00Z',
    guest: { firstName: 'Sofia', lastName: 'Marino', email: 'sofia@example.com', phone: '', country: 'IT' },
    ...overrides,
  };
}

function item(overrides: Partial<BookingReviewItem> = {}): BookingReviewItem {
  return {
    threadKey: KEY,
    source: 'OtaReview',
    channel: 'Airbnb',
    rating: 4.5,
    preview: 'Casa pulita e host gentilissimo.',
    publishedAt: '2026-06-10T08:00:00Z',
    replyState: 'None',
    capabilities: { canRead: true, canReply: true, canHostReview: true },
    ...overrides,
  };
}

function reviews(overrides: Partial<BookingReviews> = {}): BookingReviews {
  return {
    bookingId: 'b-1',
    channel: 'Airbnb',
    channelCapabilities: { canRead: true, canReply: true, canHostReview: true },
    items: [],
    lastSyncedAt: '2026-06-11T08:00:00Z',
    lastSyncError: null,
    canRefreshAt: null,
    ...overrides,
  };
}

function httpError(status: number, data: Record<string, unknown> = {}): AxiosError {
  return new AxiosError('failed', String(status), undefined, undefined, { status, data, statusText: '', headers: {}, config: {} as never });
}

function renderSection(options: { booking?: Booking; connector?: boolean; guestPortal?: boolean; canWrite?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, octorateConnector: options.connector ?? true, guestPortal: options.guestPortal ?? false }, isLoading: false }}>
        <MemoryRouter>
          <BookingReviewsSection booking={options.booking ?? booking()} canWrite={options.canWrite ?? true} />
        </MemoryRouter>
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );
  return { ...view, client };
}

describe('the section «Recensioni» of the booking (E05/F06/US02, NF-69)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(otaReviewsApi.getBookingReviews).mockResolvedValue(reviews({ items: [item()] }));
    vi.mocked(hostReviewsApi.getInviteStatus).mockResolvedValue({ canInvite: false, reviewed: false });
    await i18n.changeLanguage('it');
  });

  afterEach(() => cleanup());

  describe('a stay of Airbnb', () => {
    it('BookingReviewsSection_Airbnb_ListsTheReviewsWithTheStarsTheWordsTheReplyAndTheWayToTheMessages', async () => {
      vi.mocked(otaReviewsApi.getBookingReviews).mockResolvedValue(reviews({ items: [item(), item({ threadKey: 'otareview:aaaaaaaa-1111-4222-8333-944455556666', rating: 3, preview: 'Va bene.', replyState: 'ManualVerify' })] }));
      renderSection();

      const rows = await screen.findAllByTestId('booking-review-item');
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent('4,5 su 5');
      expect(rows[0]).toHaveTextContent('Casa pulita e host gentilissimo.');
      expect(rows[0]).toHaveTextContent('Airbnb');
      expect(within(rows[0]).getByTestId('booking-review-reply-state')).toHaveTextContent('Senza risposta');
      expect(within(rows[1]).getByTestId('booking-review-reply-state')).toHaveTextContent('Risposta da verificare');
      expect(within(rows[0]).getByRole('link', { name: 'Apri nei Messaggi' })).toHaveAttribute('href', `/app/short-rent/messages/${encodeURIComponent(KEY)}?view=reviews`);
      expect(otaReviewsApi.getBookingReviews).toHaveBeenCalledWith('b-1');
    });

    it('BookingReviewsSection_Airbnb_IsOneSectionNamedRecensioniAndNeverTwo', async () => {
      renderSection();
      await screen.findByTestId('booking-review-item');

      expect(screen.getAllByRole('region')).toHaveLength(1);
      expect(screen.getByRole('region', { name: 'Recensioni' })).toBeInTheDocument();
      expect(screen.getAllByRole('heading', { name: /recension/i })).toHaveLength(1);
    });

    it('BookingReviewsSection_NoReviewYet_SaysSoAndOffersTheRefresh', async () => {
      vi.mocked(otaReviewsApi.getBookingReviews).mockResolvedValue(reviews());
      renderSection();

      expect(await screen.findByTestId('booking-reviews-empty')).toHaveTextContent('Nessuna recensione per ora.');
      expect(screen.getByTestId('booking-reviews-refresh')).toBeEnabled();
      expect(screen.getByTestId('booking-reviews-read')).toHaveTextContent('Lette dal portale il');
    });

    it('BookingReviewsSection_Refresh_ReadsTheBookingNowAndShowsWhatItAnswers', async () => {
      vi.mocked(otaReviewsApi.getBookingReviews).mockResolvedValue(reviews());
      vi.mocked(otaReviewsApi.refreshBookingReviews).mockResolvedValue(reviews({ items: [item()] }));
      renderSection();
      fireEvent.click(await screen.findByTestId('booking-reviews-refresh'));

      expect(await screen.findByTestId('booking-review-item')).toHaveTextContent('Casa pulita e host gentilissimo.');
      expect(otaReviewsApi.refreshBookingReviews).toHaveBeenCalledWith('b-1');
      expect(screen.queryByTestId('booking-reviews-empty')).not.toBeInTheDocument();
    });

    it('BookingReviewsSection_RefreshTooSoon_SaysInHowManyMinutesToTryAgain', async () => {
      vi.mocked(otaReviewsApi.getBookingReviews).mockResolvedValue(reviews());
      vi.mocked(otaReviewsApi.refreshBookingReviews).mockRejectedValue(httpError(429, { code: 'ota_review_refresh_too_soon', retryAfterSeconds: 460 }));
      renderSection();
      fireEvent.click(await screen.findByTestId('booking-reviews-refresh'));

      expect(await screen.findByTestId('booking-reviews-refresh-problem')).toHaveTextContent('puoi aggiornare di nuovo tra 8 minuti');
    });

    it('BookingReviewsSection_RefreshThatDidNotWork_SaysWhyInWordsAndKeepsTheReviews', async () => {
      vi.mocked(otaReviewsApi.refreshBookingReviews).mockRejectedValue(httpError(409, { code: 'review_not_available' }));
      renderSection();
      fireEvent.click(await screen.findByTestId('booking-reviews-refresh'));

      expect(await screen.findByTestId('booking-reviews-refresh-problem')).toHaveTextContent('Il portale non ci dà le recensioni di questo annuncio');
      expect(screen.getByTestId('booking-review-item')).toBeInTheDocument();
    });

    it('BookingReviewsSection_LastReadThatFailed_IsToldNextToTheReviews', async () => {
      vi.mocked(otaReviewsApi.getBookingReviews).mockResolvedValue(reviews({ items: [item()], lastSyncError: 'review_not_available' }));
      renderSection();

      expect(await screen.findByTestId('booking-reviews-read-failed')).toHaveTextContent("L'ultima lettura dal portale non è riuscita");
    });

    it('BookingReviewsSection_HasNoAccessibilityViolation', async () => {
      const { container } = renderSection();
      await screen.findByTestId('booking-review-item');

      await expectNoAxeViolations(container);
    });
  });

  describe('a stay of a channel that gives no review', () => {
    it.each([
      ['BookingCom', 'Booking', 'Booking.com'],
      ['Vrbo', 'Vrbo', 'Vrbo'],
      ['Expedia', 'Expedia', 'Expedia'],
    ])('BookingReviewsSection_%s_SaysInOneSentenceWhatItCannotDoAndShowsNoReviewNorRefresh', async (source, channel, name) => {
      vi.mocked(otaReviewsApi.getBookingReviews).mockResolvedValue(
        reviews({
          channel: channel as BookingReviews['channel'],
          channelCapabilities: { canRead: false, canReply: false, canHostReview: false, reason: 'channel_not_integrated' },
        }),
      );
      renderSection({ booking: booking({ source }) });

      expect(await screen.findByTestId('booking-reviews-limit')).toHaveTextContent(`${name} non permette a CasaZen di leggere le recensioni né di rispondere`);
      expect(screen.queryByTestId('booking-review-item')).not.toBeInTheDocument();
      expect(screen.queryByTestId('booking-reviews-empty')).not.toBeInTheDocument();
      expect(screen.queryByTestId('booking-reviews-refresh')).not.toBeInTheDocument();
    });
  });

  describe('what is not drawn and not asked', () => {
    it('BookingReviewsSection_ConnectorOff_DrawsNothingForAStayOfAChannelAndAsksNothing', async () => {
      const { container } = renderSection({ connector: false });

      await act(async () => {});
      expect(container).toBeEmptyDOMElement();
      expect(otaReviewsApi.getBookingReviews).not.toHaveBeenCalled();
    });

    it.each([
      ['a cancelled stay', booking({ status: 'Cancelled' })],
      ['a request', booking({ status: 'Pending' })],
      ['a booking of the host', booking({ source: 'Manual' })],
      ['a stay of the site that is not over', booking({ source: 'Direct', checkOutDate: '2999-06-04T10:00:00Z' })],
    ])('BookingReviewsSection_%s_DrawsNothingAndAsksNothing', async (_name, stay) => {
      const { container } = renderSection({ booking: stay });

      await act(async () => {});
      expect(container).toBeEmptyDOMElement();
      expect(otaReviewsApi.getBookingReviews).not.toHaveBeenCalled();
      expect(hostReviewsApi.getInviteStatus).not.toHaveBeenCalled();
    });

    it('BookingReviewsSection_ChannelWithNoReviewsAtAll_DrawsNothingOnceItKnows', async () => {
      vi.mocked(otaReviewsApi.getBookingReviews).mockResolvedValue(
        reviews({ channelCapabilities: { canRead: false, canReply: false, canHostReview: false, reason: 'no_reviews_for_booking_source' } }),
      );
      const { container } = renderSection({ booking: booking({ source: 'OtherChannel' }) });

      await waitFor(() => expect(otaReviewsApi.getBookingReviews).toHaveBeenCalled());
      await waitFor(() => expect(container).toBeEmptyDOMElement());
    });
  });

  describe('a stay of the booking site', () => {
    const direct = () => booking({ source: 'Direct' });

    it('BookingReviewsSection_DirectStayWithAReview_HoldsTheInvitationAndTheReviewInTheOneSection', async () => {
      vi.mocked(otaReviewsApi.getBookingReviews).mockResolvedValue(
        reviews({
          channel: 'Direct',
          channelCapabilities: { canRead: true, canReply: true, canHostReview: false },
          items: [item({ threadKey: 'review:6f1c9a52-1111-4222-8333-944455556666', source: 'Review', channel: 'Direct', rating: 5 })],
        }),
      );
      vi.mocked(hostReviewsApi.getInviteStatus).mockResolvedValue({ canInvite: false, reviewed: true });
      renderSection({ booking: direct() });

      expect(await screen.findByTestId('booking-review-item')).toHaveTextContent('5 su 5');
      expect(screen.getAllByRole('region')).toHaveLength(1);
      expect(screen.getByTestId('review-invite-reviewed')).toHaveTextContent("L'ospite ha lasciato una recensione.");
      expect(screen.queryByRole('link', { name: 'Vedi le recensioni' })).not.toBeInTheDocument();
      expect(screen.queryByTestId('booking-reviews-refresh')).not.toBeInTheDocument();
    });

    it('BookingReviewsSection_DirectStayNotReviewedYet_OffersToAskTheGuestAndSaysThereIsNoReviewYet', async () => {
      vi.mocked(otaReviewsApi.getBookingReviews).mockResolvedValue(reviews({ channel: 'Direct', channelCapabilities: { canRead: true, canReply: true, canHostReview: false } }));
      vi.mocked(hostReviewsApi.getInviteStatus).mockResolvedValue({ canInvite: true, reviewed: false });
      renderSection({ booking: direct() });

      expect(await screen.findByTestId('review-invite-open')).toBeInTheDocument();
      expect(screen.getByTestId('booking-reviews-empty')).toBeInTheDocument();
      expect(screen.getAllByRole('region')).toHaveLength(1);
    });

    it('BookingReviewsSection_DirectStayNobodyAskedAboutAndNobodyReviewed_DrawsNothing', async () => {
      vi.mocked(otaReviewsApi.getBookingReviews).mockResolvedValue(reviews({ channel: 'Direct', channelCapabilities: { canRead: true, canReply: true, canHostReview: false } }));
      const { container } = renderSection({ booking: direct() });

      await waitFor(() => expect(hostReviewsApi.getInviteStatus).toHaveBeenCalled());
      await waitFor(() => expect(container).toBeEmptyDOMElement());
    });
  });

  it.each([false, true])('offers a verified portal review for a checked-out OTA guest with channel sync %s', async (connector) => {
    vi.mocked(hostReviewsApi.getInviteStatus).mockResolvedValue({ canInvite: true, reviewed: false });
    renderSection({ connector, guestPortal: true });

    expect(await screen.findByTestId('review-invite-open')).toBeInTheDocument();
    expect(otaReviewsApi.getBookingReviews).toHaveBeenCalledTimes(connector ? 1 : 0);
  });

  describe('a reading that fails is not a list of reviews', () => {
    it('BookingReviewsSection_404AfterAReading_IsNotFoundAndTheOldReviewsAreNotShown', async () => {
      const { client } = renderSection();
      expect(await screen.findByTestId('booking-review-item')).toBeInTheDocument();

      vi.mocked(otaReviewsApi.getBookingReviews).mockRejectedValue(httpError(404, { code: 'booking_not_found' }));
      await client.invalidateQueries();

      expect(await screen.findByTestId('booking-reviews-not-found')).toHaveTextContent('non sono state trovate');
      expect(screen.queryByTestId('booking-review-item')).not.toBeInTheDocument();
      expect(screen.queryByTestId('booking-reviews-error')).not.toBeInTheDocument();
    });

    it('BookingReviewsSection_FailedRereading_SaysItCouldNotReadNeverTheReviewsOfTheReadingBefore', async () => {
      const { client } = renderSection();
      expect(await screen.findByTestId('booking-review-item')).toBeInTheDocument();

      vi.mocked(otaReviewsApi.getBookingReviews).mockRejectedValue(httpError(422, { code: 'channel_not_integrated' }));
      await client.invalidateQueries();

      expect(await screen.findByTestId('booking-reviews-error')).toHaveTextContent('Non riesco a leggere le recensioni di questo soggiorno.');
      expect(screen.queryByTestId('booking-review-item')).not.toBeInTheDocument();
      expect(screen.queryByTestId('booking-reviews-empty')).not.toBeInTheDocument();

      vi.mocked(otaReviewsApi.getBookingReviews).mockResolvedValue(reviews({ items: [item()] }));
      fireEvent.click(within(screen.getByTestId('booking-reviews-error')).getByRole('button', { name: 'Riprova' }));
      expect(await screen.findByTestId('booking-review-item')).toBeInTheDocument();
    });
  });
});
