import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { createElement } from 'react';
import { MESSAGE_HUB_QUERY } from '@/queries/use-message-hub';
import { OTA_REVIEWS_QUERY } from '@/queries/use-ota-reviews';
import { applyNotificationsChange, refreshAfterGap } from '../use-notifications-realtime';

function invalidatedBy(change: (queryClient: QueryClient) => void): unknown[][] {
  const queryClient = new QueryClient();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  change(queryClient);
  return invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
}

describe('the reviews, live', () => {
  it.each(['ota-review-received', 'ota-review-action-failed'])(
    'applyNotificationsChange_%s_ReadsAgainTheReviewsOfTheBookingTheOpenReviewAndTheListOfTheHub',
    (type) => {
      const keys = invalidatedBy((queryClient) => applyNotificationsChange(queryClient, { unreadCount: 1, type, entityId: 'b-1' }));

      expect(keys).toContainEqual([OTA_REVIEWS_QUERY]);
      expect(keys).toContainEqual([MESSAGE_HUB_QUERY, 'review-thread']);
      expect(keys).toContainEqual([MESSAGE_HUB_QUERY, 'threads']);
    },
  );

  it.each(['guest-message', 'new-booking', 'guest-checkin-completed', 'tourist-tax-paid'])(
    'applyNotificationsChange_%s_LeavesTheReviewsAlone',
    (type) => {
      const keys = invalidatedBy((queryClient) => applyNotificationsChange(queryClient, { unreadCount: 1, type, entityId: 'b-1' }));

      expect(keys).not.toContainEqual([OTA_REVIEWS_QUERY]);
      expect(keys).not.toContainEqual([MESSAGE_HUB_QUERY, 'review-thread']);
    },
  );

  it('refreshAfterGap_EventsMissedWhileTheChannelWasDown_ReadAgainTheReviewsToo', () => {
    const keys = invalidatedBy((queryClient) => refreshAfterGap(queryClient));

    expect(keys).toContainEqual([OTA_REVIEWS_QUERY]);
    expect(keys).toContainEqual([MESSAGE_HUB_QUERY, 'review-thread']);
  });

  it('applyNotificationsChange_ReviewReceived_AnOpenSectionOfABookingAndAnOpenReviewReadTheNewStateWithoutAReload', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children);
    const readBooking = vi.fn().mockResolvedValue({ items: [] });
    const readReview = vi.fn().mockResolvedValue({ reply: { state: 'None' } });
    renderHook(
      () => [
        useQuery({ queryKey: [OTA_REVIEWS_QUERY, 'booking', 'b-1'], queryFn: readBooking }),
        useQuery({ queryKey: [MESSAGE_HUB_QUERY, 'review-thread', 'otareview:x'], queryFn: readReview }),
      ],
      { wrapper },
    );
    await waitFor(() => expect(readBooking).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(readReview).toHaveBeenCalledTimes(1));

    act(() => applyNotificationsChange(queryClient, { unreadCount: 1, type: 'ota-review-received', entityId: 'b-1' }));

    await waitFor(() => expect(readBooking).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(readReview).toHaveBeenCalledTimes(2));
  });
});
