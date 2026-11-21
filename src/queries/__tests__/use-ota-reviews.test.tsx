import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { otaReviewsApi } from '@/api/ota-reviews.api';
import i18n from '@/i18n/config';
import type { BookingReviews, HostReviewCommand } from '@/types';
import { MESSAGE_HUB_POLL_MS } from '../use-message-hub';
import { useBookingReviews, useReplyToReview, useSendHostReview } from '../use-ota-reviews';

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
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const ID = '6f1c9a52-1111-4222-8333-944455556666';
const OTA_KEY = `otareview:${ID}`;
const SITE_KEY = `review:${ID}`;

function wrapper(client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })) {
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** No answer at all: the call may or may not have reached the server. */
function lostAnswer(): AxiosError {
  return new AxiosError('Network Error', AxiosError.ERR_NETWORK);
}

function refusal(status: number, code: string): AxiosError {
  return new AxiosError('failed', String(status), undefined, undefined, { status, data: { code }, statusText: '', headers: {}, config: {} as never });
}

const keysOf = (calls: unknown[][]) => calls.map((call) => call[2]);

describe('the send of a reply and of the host review does not go out twice (E05/F06/US02, AC-NF69-2)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  describe('the reply to a review of a channel', () => {
    it('useReplyToReview_AnswerLostThenTheSameTextAgain_SendsItWithTheSameKeySoTheServerAnswersWhatItStored', async () => {
      vi.mocked(otaReviewsApi.replyToOtaReview).mockRejectedValueOnce(lostAnswer()).mockResolvedValueOnce({ state: 'Sent', replayed: true });
      const { result } = renderHook(() => useReplyToReview(OTA_KEY), { wrapper: wrapper() });

      await act(async () => {
        await expect(result.current.mutateAsync('Grazie del soggiorno.')).rejects.toBeTruthy();
      });
      await act(async () => {
        await result.current.mutateAsync('Grazie del soggiorno.');
      });

      const keys = keysOf(vi.mocked(otaReviewsApi.replyToOtaReview).mock.calls);
      expect(keys).toHaveLength(2);
      expect(keys[0]).toBe(keys[1]);
      expect(String(keys[0])).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
      // The call is made for the id of the review, which the key of the page holds.
      expect(vi.mocked(otaReviewsApi.replyToOtaReview).mock.calls[0].slice(0, 2)).toEqual([ID, 'Grazie del soggiorno.']);
    });

    it('useReplyToReview_AnotherTextOrAnAnsweredAttempt_IsANewAttemptWithANewKey', async () => {
      vi.mocked(otaReviewsApi.replyToOtaReview).mockResolvedValue({ state: 'Sent', replayed: false });
      const { result } = renderHook(() => useReplyToReview(OTA_KEY), { wrapper: wrapper() });

      await act(async () => {
        await result.current.mutateAsync('Prima.');
      });
      await act(async () => {
        await result.current.mutateAsync('Prima.');
      });
      await act(async () => {
        await result.current.mutateAsync('Seconda.');
      });

      const keys = keysOf(vi.mocked(otaReviewsApi.replyToOtaReview).mock.calls);
      expect(new Set(keys).size).toBe(3);
    });

    it('useReplyToReview_ARefusalOfTheChannel_NextAttemptHasANewKeyBecauseTheOldOneWouldReplayTheRefusalForEver', async () => {
      vi.mocked(otaReviewsApi.replyToOtaReview)
        .mockResolvedValueOnce({ state: 'Error', replayed: false, errorCode: 'ota_review_action_not_allowed' })
        .mockResolvedValueOnce({ state: 'Sent', replayed: false });
      const { result } = renderHook(() => useReplyToReview(OTA_KEY), { wrapper: wrapper() });

      await act(async () => {
        const first = await result.current.mutateAsync('Grazie.');
        expect(first.state).toBe('Error');
      });
      await act(async () => {
        await result.current.mutateAsync('Grazie.');
      });

      const keys = keysOf(vi.mocked(otaReviewsApi.replyToOtaReview).mock.calls);
      expect(keys[0]).not.toBe(keys[1]);
    });

    it('useReplyToReview_ARefusalOfTheServer_SettlesTheAttemptButAFailureOfTheServerDoesNot', async () => {
      vi.mocked(otaReviewsApi.replyToOtaReview)
        .mockRejectedValueOnce(refusal(409, 'ota_review_action_unconfirmed'))
        .mockRejectedValueOnce(refusal(502, 'octorate_unavailable'))
        .mockResolvedValueOnce({ state: 'Sent', replayed: false });
      const { result } = renderHook(() => useReplyToReview(OTA_KEY), { wrapper: wrapper() });

      await act(async () => {
        await expect(result.current.mutateAsync('Grazie.')).rejects.toBeTruthy();
      });
      await act(async () => {
        await expect(result.current.mutateAsync('Grazie.')).rejects.toBeTruthy();
      });
      await act(async () => {
        await result.current.mutateAsync('Grazie.');
      });

      const keys = keysOf(vi.mocked(otaReviewsApi.replyToOtaReview).mock.calls);
      // A 409 is an answer: the next attempt is a new one. A 502 may hide a call that was taken: the next attempt is the same one.
      expect(keys[0]).not.toBe(keys[1]);
      expect(keys[1]).toBe(keys[2]);
    });

    it('useReplyToReview_TellsAReplyAsPublishedOnlyWhenTheChannelSaysSo', async () => {
      vi.mocked(otaReviewsApi.replyToOtaReview)
        .mockResolvedValueOnce({ state: 'Sent', replayed: false })
        .mockResolvedValueOnce({ state: 'ManualVerify', replayed: false })
        .mockResolvedValueOnce({ state: 'Error', replayed: false, errorCode: 'ota_review_not_published' });
      const { result } = renderHook(() => useReplyToReview(OTA_KEY), { wrapper: wrapper() });

      await act(async () => {
        await result.current.mutateAsync('Uno.');
      });
      expect(toast.success).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith('Risposta pubblicata.');

      // The outcome is not known: a warning, never a success.
      await act(async () => {
        await result.current.mutateAsync('Due.');
      });
      expect(toast.success).toHaveBeenCalledTimes(1);
      expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('Non sappiamo ancora'));

      // A refusal says why, in words, and is no success either.
      await act(async () => {
        await result.current.mutateAsync('Tre.');
      });
      expect(toast.success).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('non è ancora pubblicata'));
    });
  });

  describe('the reply to a review of the booking site', () => {
    it('useReplyToReview_ReviewOfTheSite_UsesTheEndpointThatWasAlwaysThereWithNoChannelKey', async () => {
      vi.mocked(otaReviewsApi.replyToDirectReview).mockResolvedValue({} as never);
      const { result } = renderHook(() => useReplyToReview(SITE_KEY), { wrapper: wrapper() });

      await act(async () => {
        const answer = await result.current.mutateAsync('Grazie.');
        expect(answer.state).toBe('Sent');
      });

      expect(otaReviewsApi.replyToDirectReview).toHaveBeenCalledWith(ID, 'Grazie.');
      expect(otaReviewsApi.replyToOtaReview).not.toHaveBeenCalled();
    });

    it('useReplyToReview_AReplyAlreadyThere_IsToldInTheWordsOfTheReviewNeverAsSent', async () => {
      vi.mocked(otaReviewsApi.replyToDirectReview).mockRejectedValue(refusal(409, 'review_reply_already_sent'));
      const { result } = renderHook(() => useReplyToReview(SITE_KEY), { wrapper: wrapper() });

      await act(async () => {
        await expect(result.current.mutateAsync('Grazie.')).rejects.toBeTruthy();
      });

      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('Hai già risposto a questa recensione: si risponde una volta sola.');
    });
  });

  describe('the host review of the guest', () => {
    const command: HostReviewCommand = {
      ratings: [
        { category: 'cleanliness', value: 5 },
        { category: 'communication', value: 4 },
      ],
      text: 'Ospite ordinato.',
    };

    it('useSendHostReview_SameFormAfterALostAnswer_SendsItWithTheSameKeyAndAnotherFormWithAnotherOne', async () => {
      vi.mocked(otaReviewsApi.sendHostReview)
        .mockRejectedValueOnce(lostAnswer())
        .mockResolvedValueOnce({ state: 'Sent', replayed: true })
        .mockResolvedValueOnce({ state: 'Sent', replayed: false });
      const { result } = renderHook(() => useSendHostReview(OTA_KEY), { wrapper: wrapper() });

      await act(async () => {
        await expect(result.current.mutateAsync(command)).rejects.toBeTruthy();
      });
      await act(async () => {
        await result.current.mutateAsync(command);
      });
      await act(async () => {
        await result.current.mutateAsync({ ...command, text: 'Un altro testo.' });
      });

      const keys = keysOf(vi.mocked(otaReviewsApi.sendHostReview).mock.calls);
      expect(keys[0]).toBe(keys[1]);
      expect(keys[2]).not.toBe(keys[0]);
    });

    it('useSendHostReview_TheReviewOfTheSiteHasNone_NothingIsSent', async () => {
      const { result } = renderHook(() => useSendHostReview(SITE_KEY), { wrapper: wrapper() });

      await act(async () => {
        await expect(result.current.mutateAsync(command)).rejects.toBeTruthy();
      });

      expect(otaReviewsApi.sendHostReview).not.toHaveBeenCalled();
    });

    it('useSendHostReview_OutcomeNotKnown_IsAWarningNeverASuccess', async () => {
      vi.mocked(otaReviewsApi.sendHostReview).mockResolvedValue({ state: 'ManualVerify', replayed: false });
      const { result } = renderHook(() => useSendHostReview(OTA_KEY), { wrapper: wrapper() });

      await act(async () => {
        await result.current.mutateAsync(command);
      });

      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('Non sappiamo ancora'));
    });
  });
});

// A reply that «waits for the check» turns into «published» (or into an error) when the job that reads the channel finds it: no push tells it, so the section of a booking that stays open
// has to ask again by itself, as the open review does (E05/F06/US02, NF-69).
describe('the reviews of a booking that stays open are read again by themselves', () => {
  const reviewsOfTheBooking: BookingReviews = {
    bookingId: 'b-1',
    channel: 'Airbnb',
    channelCapabilities: { canRead: true, canReply: true, canHostReview: true },
    items: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(otaReviewsApi.getBookingReviews).mockResolvedValue(reviewsOfTheBooking);
  });

  afterEach(() => {
    // The page is closed first (its interval stops), then the clock is the real one again.
    cleanup();
    vi.useRealTimers();
  });

  it('useBookingReviews_PageVisible_ReadsTheBookingAgainEveryMinute', async () => {
    vi.useFakeTimers();
    renderHook(() => useBookingReviews('b-1', true), { wrapper: wrapper() });

    // The first reading is when the page opens.
    await vi.advanceTimersByTimeAsync(0);
    expect(otaReviewsApi.getBookingReviews).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(MESSAGE_HUB_POLL_MS);
    expect(otaReviewsApi.getBookingReviews).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(MESSAGE_HUB_POLL_MS);
    expect(otaReviewsApi.getBookingReviews).toHaveBeenCalledTimes(3);
    expect(otaReviewsApi.getBookingReviews).toHaveBeenCalledWith('b-1');
  });

  it('useBookingReviews_TabHidden_AsksNothingWhileNobodyLooks', async () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    try {
      renderHook(() => useBookingReviews('b-1', true), { wrapper: wrapper() });
      await vi.advanceTimersByTimeAsync(0);
      expect(otaReviewsApi.getBookingReviews).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(MESSAGE_HUB_POLL_MS * 3);
      expect(otaReviewsApi.getBookingReviews).toHaveBeenCalledTimes(1);
    } finally {
      visibility.mockRestore();
    }
  });

  it('useBookingReviews_NotEnabled_AsksNothingAtAll', async () => {
    vi.useFakeTimers();
    renderHook(() => useBookingReviews('b-1', false), { wrapper: wrapper() });

    await vi.advanceTimersByTimeAsync(MESSAGE_HUB_POLL_MS * 2);
    expect(otaReviewsApi.getBookingReviews).not.toHaveBeenCalled();
  });
});

// The words of a public reply and of the host's review are personal data (they speak of a guest): a send that fails keeps the answer of the server and nothing of the request that
// carried them, and what the mutation holds is dropped as soon as nobody watches it (`withoutRequest`, `gcTime: 0`) (E05/F06/US02, privacy).
describe('what a failed send of the words of the host leaves behind', () => {
  /** A failure as axios builds it: it holds the request that was sent, and the body of that request holds the words. */
  function failureOfTheRequest(body: unknown, status: number, code: string): AxiosError {
    const config = { headers: new AxiosHeaders(), method: 'post', url: '/reviews/ota/x/reply', data: JSON.stringify(body) } as InternalAxiosRequestConfig;
    return new AxiosError('failed', String(status), config, {}, { status, data: { code }, statusText: '', headers: {}, config });
  }

  /** What the hook throws for a send that fails. */
  async function thrownBy(send: () => Promise<unknown>): Promise<AxiosError> {
    let caught: unknown;
    await act(async () => {
      try {
        await send();
      } catch (error) {
        caught = error;
      }
    });
    return caught as AxiosError;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useReplyToReview_FailedSend_KeepsTheCodeOfTheAnswerAndNothingOfTheWordsAndTheMutationIsDroppedWhenNobodyWatches', async () => {
    const original = failureOfTheRequest({ text: 'Il signor Rossi era scortese, grazie lo stesso.' }, 502, 'octorate_unavailable');
    // The failure that axios throws does hold the words: the check below is about what the hook does with it.
    expect(original.config?.data).toContain('Rossi');
    vi.mocked(otaReviewsApi.replyToOtaReview).mockRejectedValue(original);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { result, unmount } = renderHook(() => useReplyToReview(OTA_KEY), { wrapper: wrapper(client) });

    const failure = await thrownBy(() => result.current.mutateAsync('Il signor Rossi era scortese, grazie lo stesso.'));
    await waitFor(() => expect(result.current.isError).toBe(true));

    // What a screen turns into words stays: the status and the body of the answer.
    expect(failure.response?.status).toBe(502);
    expect(failure.response?.data).toEqual({ code: 'octorate_unavailable' });
    // The request does not: not in what is thrown, not in what the mutation holds while it is watched.
    expect(failure.config?.data).toBeUndefined();
    expect(JSON.stringify(failure)).not.toMatch(/Rossi/);
    expect(JSON.stringify(result.current.error)).not.toMatch(/Rossi/);

    // Nobody watches it any more: nothing of it stays in the cache of the mutations.
    unmount();
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });

  it('useSendHostReview_FailedSend_KeepsTheCodeOfTheAnswerAndNothingOfTheWordsAndTheMutationIsDroppedWhenNobodyWatches', async () => {
    const command: HostReviewCommand = {
      ratings: [{ category: 'cleanliness', value: 4 }],
      text: 'Ospite ordinato, il signor Rossi.',
      privateText: 'Nota privata per il signor Rossi.',
    };
    const original = failureOfTheRequest(command, 409, 'ota_review_window_closed');
    expect(original.config?.data).toContain('Rossi');
    vi.mocked(otaReviewsApi.sendHostReview).mockRejectedValue(original);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { result, unmount } = renderHook(() => useSendHostReview(OTA_KEY), { wrapper: wrapper(client) });

    const failure = await thrownBy(() => result.current.mutateAsync(command));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(failure.response?.status).toBe(409);
    expect(failure.response?.data).toEqual({ code: 'ota_review_window_closed' });
    expect(failure.config?.data).toBeUndefined();
    expect(JSON.stringify(failure)).not.toMatch(/Rossi/);
    expect(JSON.stringify(result.current.error)).not.toMatch(/Rossi/);

    unmount();
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });
});
