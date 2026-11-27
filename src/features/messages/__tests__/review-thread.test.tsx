import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError } from 'axios';
import { approvalQueueApi } from '@/api/approvalQueue.api';
import { messageHubApi } from '@/api/message-hub.api';
import { otaReviewsApi } from '@/api/ota-reviews.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import i18n from '@/i18n/config';
import { expectNoAxeViolations } from '@/test/axe';
import type { MessageBookingCard, ReviewThread } from '@/types';
import type { ApprovalQueueItem } from '@/types/approval-queue.types';
import { ThreadPage } from '../thread-page';

const grants = vi.hoisted(() => ({ permissions: new Set<string>() }));

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
vi.mock('@/api/message-hub.api', () => ({ messageHubApi: { list: vi.fn(), unread: vi.fn(), getThread: vi.fn(), markRead: vi.fn(), reply: vi.fn() } }));
vi.mock('@/api/approvalQueue.api', () => ({ approvalQueueApi: { getPending: vi.fn(), edit: vi.fn(), approve: vi.fn(), reject: vi.fn() } }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ hasPermission: (_context: string, permission: string) => grants.permissions.has(permission) }) }));
vi.mock('@/queries/use-properties', () => ({ useProperties: () => ({ data: [] }) }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const ID = '6f1c9a52-1111-4222-8333-944455556666';
const OTA_KEY = `otareview:${ID}`;
const SITE_KEY = `review:${ID}`;

const CARD: MessageBookingCard = {
  bookingId: 'b-1',
  bookingCode: 'ABCDE-12345',
  guestName: 'Sofia Marino',
  checkInDate: '2026-11-01',
  checkOutDate: '2026-11-04',
  guests: 2,
  adults: 2,
  children: 0,
  status: 'CheckedOut',
  source: 'Airbnb',
  channelLabel: null,
  currency: 'EUR',
};

function review(overrides: Partial<ReviewThread> = {}): ReviewThread {
  return {
    threadKey: OTA_KEY,
    source: 'OtaReview',
    channel: 'Airbnb',
    propertyId: 'p-1',
    propertyName: 'Casa Mare',
    bookingId: 'b-1',
    guestName: 'Sofia Marino',
    publishedAt: '2026-11-10T08:00:00Z',
    rating: 4.5,
    categoryRatings: [
      { category: 'cleanliness', value: 5 },
      { category: 'communication', value: 4 },
    ],
    text: 'Casa pulita e host gentilissimo.',
    reply: { state: 'None' },
    hostReview: { window: 'Open', state: 'None', ratings: [] },
    booking: CARD,
    customer: { guestId: 'g-1' },
    capabilities: { canRead: true, canReply: true, canHostReview: true },
    lastSyncedAt: '2026-11-11T08:00:00Z',
    lastSyncError: null,
    ...overrides,
  };
}

function draft(overrides: Partial<ApprovalQueueItem> = {}): ApprovalQueueItem {
  return {
    id: 'a1',
    itemType: 'ReviewReply',
    itemId: ID,
    contentText: 'Grazie di cuore per le belle parole.',
    contentVersion: null,
    isAiGenerated: true,
    status: 'Pending',
    approvedByUserId: null,
    approvedAt: null,
    createdAt: '2026-11-10T09:00:00Z',
    expiresAt: '2026-11-17T09:00:00Z',
    propertyId: 'p-1',
    originAction: 'SendReviewReply',
    originActionStatus: 'Pending',
    originActionError: null,
    originActionExecutedAt: null,
    originActionResult: null,
    confidenceScore: null,
    situationCode: null,
    threadKey: OTA_KEY,
    editedContentText: null,
    editedAt: null,
    rejectionReason: null,
    ...overrides,
  };
}

function httpError(status: number, data: Record<string, unknown> = {}): AxiosError {
  return new AxiosError('failed', String(status), undefined, undefined, { status, data, statusText: '', headers: {}, config: {} as never });
}

function renderReview(threadKey = OTA_KEY, options: { assistant?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, messageAssistant: options.assistant ?? false }, isLoading: false }}>
        <MemoryRouter initialEntries={[`/app/short-rent/messages/${encodeURIComponent(threadKey)}?view=reviews`]}>
          <Routes>
            <Route path="/app/short-rent/messages/:threadKey" element={<ThreadPage />} />
          </Routes>
        </MemoryRouter>
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );
  return { ...view, client };
}

const typeReply = (text: string) => fireEvent.change(screen.getByTestId('review-reply-text'), { target: { value: text } });

describe('the page of a review (E05/F06/US02, NF-69)', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(async () => {
    vi.clearAllMocks();
    grants.permissions = new Set(['booking.read', 'booking.write', 'approval.decide']);
    // On a wide desktop the list and the booking are both beside the review.
    window.matchMedia = ((query: string) => ({
      matches: query === '(width >= 64rem)' || query === '(width >= 96rem)',
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    vi.mocked(otaReviewsApi.getReviewThread).mockResolvedValue(review());
    vi.mocked(messageHubApi.list).mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 20 });
    vi.mocked(messageHubApi.unread).mockResolvedValue({ items: [] });
    vi.mocked(approvalQueueApi.getPending).mockResolvedValue([]);
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    window.matchMedia = originalMatchMedia;
  });

  describe('what is on the page', () => {
    it('shows the channel review and opens its booking details on request', async () => {
      renderReview();

      expect(await screen.findByTestId('review-guest-text')).toHaveTextContent('Casa pulita e host gentilissimo.');
      // The key is the one of the address, back as the server gave it, and not the endpoint of a conversation.
      expect(otaReviewsApi.getReviewThread).toHaveBeenCalledWith(OTA_KEY);
      expect(messageHubApi.getThread).not.toHaveBeenCalled();
      expect(screen.getByTestId('review-rating')).toHaveTextContent('4,5 su 5');
      expect(screen.getByTestId('review-categories')).toHaveTextContent('Pulizia');
      expect(screen.getByTestId('review-categories')).toHaveTextContent('5 su 5');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sofia Marino');
      expect(screen.queryByTestId('booking-card')).not.toBeInTheDocument();
      const detailsLabel = i18n.t('messages.bookingCard.details');
      fireEvent.click(screen.getByRole('button', { name: detailsLabel }));
      const bookingDialog = await screen.findByRole('dialog', { name: detailsLabel });
      expect(within(bookingDialog).getByTestId('booking-card-code')).toHaveTextContent('ABCDE-12345');
      // The list beside it is the one of the reviews, and the review has no unread count: nothing is marked as read.
      expect(messageHubApi.list).toHaveBeenCalledWith(expect.objectContaining({ kind: 'Review' }));
      expect(messageHubApi.markRead).not.toHaveBeenCalled();
    });

    it('ReviewThreadView_NotAnsweredYet_SaysSoAndOffersTheBoxWithItsLimitAndTheHostReview', async () => {
      renderReview();

      expect(await screen.findByTestId('review-not-answered')).toHaveTextContent('Senza risposta');
      expect(screen.getByTestId('review-reply-text')).toHaveAttribute('maxlength', '800');
      expect(screen.getByRole('button', { name: 'Pubblica la risposta' })).toBeDisabled();
      expect(screen.getByTestId('host-review-form')).toBeInTheDocument();
    });

    it('ReviewThreadView_HasNoAccessibilityViolation', async () => {
      renderReview();
      await screen.findByTestId('review-guest-text');

      await expectNoAxeViolations(screen.getByTestId('review-thread'));
    });
  });

  describe('a reply is public: it asks first and it goes out once', () => {
    it('ReviewThreadView_Publish_AsksFirstSaysItCannotBeTakenBackAndSendsOnlyWhenTheHostConfirms', async () => {
      vi.mocked(otaReviewsApi.replyToOtaReview).mockResolvedValue({ state: 'Sent', replayed: false });
      renderReview();
      await screen.findByTestId('review-reply-text');

      typeReply('  Grazie di cuore, a presto!  ');
      fireEvent.click(screen.getByRole('button', { name: 'Pubblica la risposta' }));

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Pubblichi la risposta?')).toBeInTheDocument();
      expect(within(dialog).getByText(/Non si può ritirare né modificare/)).toBeInTheDocument();
      // The exact words that will be published are on the question.
      expect(within(dialog).getByTestId('review-publish-text')).toHaveTextContent('Grazie di cuore, a presto!');
      expect(otaReviewsApi.replyToOtaReview).not.toHaveBeenCalled();

      vi.mocked(otaReviewsApi.getReviewThread).mockResolvedValue(
        review({ reply: { state: 'Sent', text: 'Grazie di cuore, a presto!', sentAt: '2026-11-12T09:30:00Z' }, capabilities: { canRead: true, canReply: false, canHostReview: true, replyReason: 'ota_review_reply_already_sent' } }),
      );
      fireEvent.click(within(dialog).getByRole('button', { name: 'Pubblica' }));

      await waitFor(() => expect(otaReviewsApi.replyToOtaReview).toHaveBeenCalledTimes(1));
      expect(vi.mocked(otaReviewsApi.replyToOtaReview).mock.calls[0].slice(0, 2)).toEqual([ID, 'Grazie di cuore, a presto!']);
      expect(String(vi.mocked(otaReviewsApi.replyToOtaReview).mock.calls[0][2])).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
      // The review is read again and shows the reply as published, with no box to write another one.
      expect(await screen.findByTestId('review-reply-state')).toHaveTextContent('Pubblicata');
      expect(screen.queryByTestId('review-reply-text')).not.toBeInTheDocument();
      expect(screen.getByTestId('review-reply-text-shown')).toHaveTextContent('Grazie di cuore, a presto!');
    });

    it('ReviewThreadView_AnswerWhoseOutcomeIsNotKnown_IsShownAsToCheckAndTheBoxIsGone', async () => {
      vi.mocked(otaReviewsApi.getReviewThread).mockResolvedValue(
        review({ reply: { state: 'ManualVerify', text: 'Grazie!' }, capabilities: { canRead: true, canReply: false, canHostReview: true, replyReason: 'ota_review_action_unconfirmed' } }),
      );
      renderReview();

      expect(await screen.findByTestId('review-reply-state')).toHaveTextContent('Da verificare');
      expect(screen.getByTestId('review-reply-verify')).toHaveTextContent('Non sappiamo ancora se il portale ha ricevuto la risposta');
      // It is never shown as published, and it cannot be sent again by a second click.
      expect(screen.queryByRole('button', { name: 'Pubblica la risposta' })).not.toBeInTheDocument();
      expect(screen.queryByTestId('review-reply-text')).not.toBeInTheDocument();
    });

    it('ReviewThreadView_ReplyTheChannelRefused_SaysWhyAndKeepsTheWordsInTheBoxToTryAgain', async () => {
      vi.mocked(otaReviewsApi.getReviewThread).mockResolvedValue(
        review({ reply: { state: 'Error', text: 'Grazie, a presto!', errorCode: 'reply_not_delivered' } }),
      );
      renderReview();

      expect(await screen.findByTestId('review-reply-error')).toHaveTextContent('La risposta non è stata pubblicata');
      expect(screen.getByTestId('review-reply-error')).toHaveTextContent("Il portale non ha confermato la risposta entro un'ora");
      expect(screen.getByTestId('review-reply-text')).toHaveValue('Grazie, a presto!');
      expect(screen.getByRole('button', { name: 'Pubblica la risposta' })).toBeEnabled();
    });

    it('ReviewThreadView_ReplyTheChannelManagerAnsweredNotAllowed_SaysItInTheWordsWrittenForItAfterTheReadingAndNotTheGeneralSentence', async () => {
      // The code the server saves on the review for a 409 of the channel manager (not the `ota_…` one of the HTTP answer).
      vi.mocked(otaReviewsApi.getReviewThread).mockResolvedValue(
        review({ reply: { state: 'Error', text: 'Grazie, a presto!', errorCode: 'review_action_not_allowed' } }),
      );
      renderReview();

      const error = await screen.findByTestId('review-reply-error');
      expect(error).toHaveTextContent('Il portale non ha permesso l\'azione');
      expect(error).not.toHaveTextContent('Il portale non l\'ha accettata');
    });

    it('ReviewThreadView_AChannelThatCannotBeAnswered_SaysOneSentenceAndShowsNothingInItsPlace', async () => {
      vi.mocked(otaReviewsApi.getReviewThread).mockResolvedValue(
        review({
          channel: 'Booking',
          capabilities: { canRead: false, canReply: false, canHostReview: false, reason: 'channel_not_integrated' },
          booking: { ...CARD, source: 'BookingCom' },
        }),
      );
      renderReview();

      expect(await screen.findByTestId('review-thread-limit')).toHaveTextContent('Booking.com non permette a CasaZen di leggere le recensioni né di rispondere');
      // No placeholder review: no stars, no words, no box, no review of the host.
      expect(screen.queryByTestId('review-rating')).not.toBeInTheDocument();
      expect(screen.queryByTestId('review-guest-text')).not.toBeInTheDocument();
      expect(screen.queryByTestId('review-reply')).not.toBeInTheDocument();
      expect(screen.queryByTestId('host-review')).not.toBeInTheDocument();
    });

    it('ReviewThreadView_ReviewOfTheBookingSite_IsAnsweredThroughTheOldEndpointAndHasNoReviewOfTheHost', async () => {
      vi.mocked(otaReviewsApi.getReviewThread).mockResolvedValue(
        review({ threadKey: SITE_KEY, source: 'Review', channel: 'Direct', categoryRatings: [], hostReview: null, capabilities: { canRead: true, canReply: true, canHostReview: false, hostReviewReason: 'host_review_not_supported' } }),
      );
      vi.mocked(otaReviewsApi.replyToDirectReview).mockResolvedValue({} as never);
      renderReview(SITE_KEY);
      await screen.findByTestId('review-reply-text');
      expect(screen.queryByTestId('host-review')).not.toBeInTheDocument();

      typeReply('Grazie!');
      fireEvent.click(screen.getByRole('button', { name: 'Pubblica la risposta' }));
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Pubblica' }));

      await waitFor(() => expect(otaReviewsApi.replyToDirectReview).toHaveBeenCalledWith(ID, 'Grazie!'));
      expect(otaReviewsApi.replyToOtaReview).not.toHaveBeenCalled();
    });

    it('ReviewThreadView_WithoutThePermissionToWrite_ReadsTheReviewAndSaysItCannotAnswer', async () => {
      grants.permissions = new Set(['booking.read']);
      renderReview();

      expect(await screen.findByTestId('review-reply-readonly')).toHaveTextContent('non hai il permesso di rispondere');
      expect(screen.queryByTestId('review-reply-text')).not.toBeInTheDocument();
      expect(screen.queryByTestId('host-review-form')).not.toBeInTheDocument();
      expect(screen.getByTestId('host-review-readonly')).toBeInTheDocument();
    });
  });

  describe('a reading that fails is not a review', () => {
    it('ReviewThreadView_404AfterAReading_IsNotFoundAndTheOldReviewIsNotShown', async () => {
      const { client } = renderReview();
      expect(await screen.findByTestId('review-guest-text')).toBeInTheDocument();

      vi.mocked(otaReviewsApi.getReviewThread).mockRejectedValue(httpError(404, { code: 'review_not_found' }));
      await client.invalidateQueries();

      expect(await screen.findByText('Recensione non trovata')).toBeInTheDocument();
      expect(screen.queryByTestId('review-guest-text')).not.toBeInTheDocument();
    });

    it('ReviewThreadView_FailedRereading_SaysItCouldNotReadNeverTheOldReviewAndKeepsWhatTheHostTyped', async () => {
      const { client } = renderReview();
      await screen.findByTestId('review-reply-text');
      typeReply('Una risposta a metà');

      // A refusal that is not transient: the reading is not retried by itself, so the page says at once that it could not read.
      vi.mocked(otaReviewsApi.getReviewThread).mockRejectedValue(httpError(403, { code: 'forbidden' }));
      await client.invalidateQueries();
      expect(await screen.findByTestId('review-thread-error')).toHaveTextContent('Non riesco a caricare la recensione.');
      expect(screen.queryByTestId('review-guest-text')).not.toBeInTheDocument();

      // Read again, the review is back with the words the host had typed.
      vi.mocked(otaReviewsApi.getReviewThread).mockResolvedValue(review());
      fireEvent.click(within(screen.getByTestId('review-thread-error')).getByRole('button', { name: 'Riprova' }));
      expect(await screen.findByTestId('review-reply-text')).toHaveValue('Una risposta a metà');
    });
  });

  describe('the review of the host', () => {
    async function fillAndSend() {
      for (const category of ['Pulizia', 'Comunicazione', 'Rispetto delle regole della casa']) {
        fireEvent.click(within(screen.getByRole('group', { name: category })).getByRole('radio', { name: '5 stelle su 5' }));
      }
      fireEvent.change(screen.getByTestId('host-review-text'), { target: { value: 'Ospite ordinato e puntuale.' } });
      fireEvent.click(screen.getByTestId('host-review-send'));
    }

    it('ReviewThreadView_HostReviewOpenWindow_AsksForEveryMarkThenSendsOnceAfterTheQuestion', async () => {
      vi.mocked(otaReviewsApi.sendHostReview).mockResolvedValue({ state: 'Sent', replayed: false });
      renderReview();
      await screen.findByTestId('host-review-form');

      // Without the marks nothing is asked and nothing is sent.
      fireEvent.click(screen.getByTestId('host-review-send'));
      expect(screen.getByTestId('host-review-ratings-error')).toHaveTextContent('Dai un voto da 1 a 5 a ogni voce.');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      await fillAndSend();
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText("Invii la recensione dell'ospite?")).toBeInTheDocument();
      expect(otaReviewsApi.sendHostReview).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Invia' }));

      await waitFor(() => expect(otaReviewsApi.sendHostReview).toHaveBeenCalledTimes(1));
      const [id, command, key] = vi.mocked(otaReviewsApi.sendHostReview).mock.calls[0];
      expect(id).toBe(ID);
      expect(command).toEqual({
        ratings: [
          { category: 'cleanliness', value: 5 },
          { category: 'communication', value: 5 },
          { category: 'respect_house_rules', value: 5 },
        ],
        text: 'Ospite ordinato e puntuale.',
      });
      expect(String(key)).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    });

    it.each([
      ['Closed', 'host-review-closed', 'Il tempo per scrivere la tua recensione dell’ospite è finito'],
      ['Unknown', 'host-review-unknown', 'Il portale non ha ancora detto se puoi scrivere'],
    ] as const)('ReviewThreadView_HostReviewWindow%s_IsDisabledWithItsReasonAndHasNoForm', async (windowState, testId, sentence) => {
      vi.mocked(otaReviewsApi.getReviewThread).mockResolvedValue(
        review({ hostReview: { window: windowState, state: 'None', ratings: [] }, capabilities: { canRead: true, canReply: true, canHostReview: false, hostReviewReason: 'ota_review_window_closed' } }),
      );
      renderReview();

      expect(await screen.findByTestId(testId)).toHaveTextContent(sentence.replace('’', "'"));
      expect(screen.queryByTestId('host-review-form')).not.toBeInTheDocument();
    });

    it('ReviewThreadView_HostReviewAlreadySent_ShowsWhatWasSentAndCannotBeWrittenAgain', async () => {
      vi.mocked(otaReviewsApi.getReviewThread).mockResolvedValue(
        review({
          hostReview: {
            window: 'Sent',
            state: 'Sent',
            ratings: [{ category: 'cleanliness', value: 5 }],
            text: 'Ospite ordinato.',
            privateText: 'Grazie ancora.',
            sentAt: '2026-11-12T10:00:00Z',
          },
          capabilities: { canRead: true, canReply: true, canHostReview: false, hostReviewReason: 'ota_review_host_review_already_sent' },
        }),
      );
      renderReview();

      expect(await screen.findByTestId('host-review-state')).toHaveTextContent('Pubblicata');
      expect(screen.getByTestId('host-review-sent')).toHaveTextContent('Ospite ordinato.');
      expect(screen.getByTestId('host-review-sent')).toHaveTextContent('Grazie ancora.');
      expect(screen.queryByTestId('host-review-form')).not.toBeInTheDocument();
    });

    it('ReviewThreadView_HostReviewTheChannelManagerAnsweredNotAllowed_SaysItInTheWordsWrittenForItAfterTheReading', async () => {
      vi.mocked(otaReviewsApi.getReviewThread).mockResolvedValue(
        review({
          hostReview: { window: 'Open', state: 'Error', ratings: [{ category: 'cleanliness', value: 4 }], text: 'Bene.', errorCode: 'review_action_not_allowed' },
        }),
      );
      renderReview();

      const error = await screen.findByTestId('host-review-error');
      expect(error).toHaveTextContent('Il portale non ha permesso l\'azione');
      expect(error).not.toHaveTextContent('Il portale non l\'ha accettata');
    });

    it('ReviewThreadView_HostReviewWhoseOutcomeIsNotKnown_IsToCheckAndCannotBeSentAgain', async () => {
      vi.mocked(otaReviewsApi.getReviewThread).mockResolvedValue(
        review({
          hostReview: { window: 'Open', state: 'ManualVerify', ratings: [{ category: 'cleanliness', value: 4 }], text: 'Bene.' },
          capabilities: { canRead: true, canReply: true, canHostReview: false, hostReviewReason: 'ota_review_action_unconfirmed' },
        }),
      );
      renderReview();

      expect(await screen.findByTestId('host-review-verify')).toHaveTextContent('Non sappiamo ancora se il portale ha ricevuto');
      expect(screen.getByTestId('host-review-state')).toHaveTextContent('Da verificare');
      expect(screen.queryByTestId('host-review-form')).not.toBeInTheDocument();
    });
  });

  describe('the draft of the assistant', () => {
    it('ReviewThreadView_AssistantFlagOff_DrawsNothingAndAsksNothingOfTheQueue', async () => {
      renderReview(OTA_KEY, { assistant: false });
      await screen.findByTestId('review-reply-text');

      await act(async () => {});
      expect(screen.queryByTestId('review-draft-panel')).not.toBeInTheDocument();
      expect(approvalQueueApi.getPending).not.toHaveBeenCalled();
    });

    it('ReviewThreadView_AssistantOnButNoPermissionToDecideApprovals_DrawsNothingAsksNothingOfTheQueueAndTheHostStillAnswersByHand', async () => {
      // The host may write the bookings (`booking.write`) and the assistant is on, but deciding approvals is another permission (`approval.decide`): the draft is for who decides it.
      grants.permissions = new Set(['booking.read', 'booking.write']);
      renderReview(OTA_KEY, { assistant: true });
      await screen.findByTestId('review-reply-text');

      await act(async () => {});
      expect(screen.queryByTestId('review-draft-panel')).not.toBeInTheDocument();
      expect(screen.queryByTestId('review-draft-ask')).not.toBeInTheDocument();
      expect(approvalQueueApi.getPending).not.toHaveBeenCalled();
      expect(otaReviewsApi.requestReviewDraft).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Pubblica la risposta' })).toBeInTheDocument();
    });

    it('ReviewThreadView_PendingDraft_ApprovePublishesOnlyAfterTheQuestionAndOnce', async () => {
      vi.mocked(approvalQueueApi.getPending).mockResolvedValue([draft()]);
      vi.mocked(approvalQueueApi.approve).mockResolvedValue(draft({ status: 'Approved', originActionStatus: 'Executed', originActionResult: 'Sent' }));
      renderReview(OTA_KEY, { assistant: true });

      expect(await screen.findByTestId('review-draft-text')).toHaveTextContent('Grazie di cuore per le belle parole.');
      fireEvent.click(screen.getByTestId('review-draft-approve'));

      // Nothing is published by the click: the host is asked first, with the exact words.
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByTestId('review-publish-text')).toHaveTextContent('Grazie di cuore per le belle parole.');
      expect(approvalQueueApi.approve).not.toHaveBeenCalled();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Pubblica' }));
      await waitFor(() => expect(approvalQueueApi.approve).toHaveBeenCalledTimes(1));
      expect(approvalQueueApi.approve).toHaveBeenCalledWith('a1');
      expect(await screen.findByTestId('review-draft-notice')).toHaveTextContent('Risposta pubblicata.');
    });

    it('ReviewThreadView_ApprovalThatFails_KeepsTheDraftWithTheReasonAndARetry', async () => {
      vi.mocked(approvalQueueApi.getPending).mockResolvedValue([draft()]);
      vi.mocked(approvalQueueApi.approve).mockRejectedValue(httpError(409, { code: 'approval_origin_action_failed', originActionError: 'ota_review_not_published' }));
      renderReview(OTA_KEY, { assistant: true });
      await screen.findByTestId('review-draft-text');

      fireEvent.click(screen.getByTestId('review-draft-approve'));
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Pubblica' }));

      expect(await screen.findByTestId('review-draft-failure')).toHaveTextContent("non è ancora pubblicata");
      expect(screen.getByTestId('review-draft-text')).toBeInTheDocument();
      expect(screen.getByTestId('review-draft-approve')).toHaveTextContent('Riprova');
    });

    it('ReviewThreadView_AskForADraft_AReplyThatBrokeARuleIsToldWithItsReasonNeverAsADraft', async () => {
      vi.mocked(otaReviewsApi.requestReviewDraft).mockResolvedValue({ status: 'NotDrafted', reason: 'draft_rule_violation' });
      renderReview(OTA_KEY, { assistant: true });

      fireEvent.click(await screen.findByTestId('review-draft-ask'));

      expect(await screen.findByTestId('review-draft-outcome')).toHaveTextContent("non rispettava le regole");
      expect(otaReviewsApi.requestReviewDraft).toHaveBeenCalledWith(OTA_KEY);
      expect(screen.queryByTestId('review-draft-text')).not.toBeInTheDocument();
    });

    it('ReviewThreadView_ReadingOfTheQueueThatFails_IsToldAsSuchNotAsNoDraft', async () => {
      vi.mocked(approvalQueueApi.getPending).mockRejectedValue(httpError(500));
      renderReview(OTA_KEY, { assistant: true });

      expect(await screen.findByTestId('review-draft-load-error')).toHaveTextContent('Non è stato possibile leggere le bozze in attesa');
      expect(screen.queryByTestId('review-draft-none')).not.toBeInTheDocument();
    });

    it('ReviewThreadView_ReadingOfTheQueueFailsWhileTheHostEditsTheDraft_KeepsTheEditorWithTheWordsAndSaysItCouldNotRead', async () => {
      vi.mocked(approvalQueueApi.getPending).mockResolvedValue([draft()]);
      const { client } = renderReview(OTA_KEY, { assistant: true });
      await screen.findByTestId('review-draft-text');

      fireEvent.click(screen.getByTestId('review-draft-edit'));
      fireEvent.change(within(await screen.findByTestId('review-draft-editor')).getByRole('textbox'), { target: { value: 'Grazie di cuore, a presto da tutti noi!' } });

      // The reading of the queue fails (the poll of the minute): it is told above the editor, which stays with the words that were not saved yet.
      vi.mocked(approvalQueueApi.getPending).mockRejectedValue(httpError(500));
      await client.invalidateQueries({ queryKey: ['approval-queue'] });
      expect(await screen.findByTestId('review-draft-load-error')).toHaveTextContent('Non è stato possibile leggere le bozze in attesa');
      expect(within(screen.getByTestId('review-draft-editor')).getByRole('textbox')).toHaveValue('Grazie di cuore, a presto da tutti noi!');
      // It is neither «no draft» nor the draft of the reading before.
      expect(screen.queryByTestId('review-draft-none')).not.toBeInTheDocument();
      expect(screen.queryByTestId('review-draft-text')).not.toBeInTheDocument();

      // The queue is read again: it is the same editor, with the same words, and the warning is gone.
      vi.mocked(approvalQueueApi.getPending).mockResolvedValue([draft()]);
      await client.invalidateQueries({ queryKey: ['approval-queue'] });
      await waitFor(() => expect(screen.queryByTestId('review-draft-load-error')).not.toBeInTheDocument());
      expect(within(screen.getByTestId('review-draft-editor')).getByRole('textbox')).toHaveValue('Grazie di cuore, a presto da tutti noi!');
    });

    it('ReviewThreadView_DraftDecidedElsewhereWhileTheHostEdits_TheEditorGoesWhenTheQueueIsReadWithoutItAndDoesNotOpenOnTheNextDraft', async () => {
      vi.mocked(approvalQueueApi.getPending).mockResolvedValue([draft()]);
      const { client } = renderReview(OTA_KEY, { assistant: true });
      await screen.findByTestId('review-draft-text');
      fireEvent.click(screen.getByTestId('review-draft-edit'));
      await screen.findByTestId('review-draft-editor');

      // A reading that works and no longer holds the draft: there is nothing left to edit.
      vi.mocked(approvalQueueApi.getPending).mockResolvedValue([]);
      await client.invalidateQueries({ queryKey: ['approval-queue'] });
      expect(await screen.findByTestId('review-draft-none')).toBeInTheDocument();
      expect(screen.queryByTestId('review-draft-editor')).not.toBeInTheDocument();

      // Another draft, which comes after, is shown to be read: the editor does not open by itself on it.
      vi.mocked(approvalQueueApi.getPending).mockResolvedValue([draft({ id: 'a2', contentText: 'Un altro testo.' })]);
      await client.invalidateQueries({ queryKey: ['approval-queue'] });
      expect(await screen.findByTestId('review-draft-text')).toHaveTextContent('Un altro testo.');
      expect(screen.queryByTestId('review-draft-editor')).not.toBeInTheDocument();
    });
  });
});
