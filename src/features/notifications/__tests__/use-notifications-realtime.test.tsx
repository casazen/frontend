import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { BOOKING_THREAD_QUERY, HOST_THREADS_QUERY, UNREAD_MESSAGES_QUERY } from '@/queries/use-booking-messages';
import { NOTIFICATIONS_QUERY, UNREAD_COUNT_KEY } from '@/queries/use-notifications';
import type { NotificationsChange, RealtimeClient, RealtimeState } from '../realtime-client';
import { applyNotificationsChange, useNotificationsRealtime } from '../use-notifications-realtime';

function fakeClient(initial: RealtimeState = 'disconnected') {
  let state = initial;
  const stateListeners = new Set<(s: RealtimeState) => void>();
  const changeListeners = new Set<(c: NotificationsChange) => void>();
  const client: RealtimeClient & { emit: (c: NotificationsChange) => void; setState: (s: RealtimeState) => void } = {
    connect: vi.fn(() => {
      state = 'connecting';
    }),
    disconnect: vi.fn(() => {
      state = 'disconnected';
    }),
    getState: () => state,
    onState: (l) => {
      stateListeners.add(l);
      return () => stateListeners.delete(l);
    },
    onChange: (l) => {
      changeListeners.add(l);
      return () => changeListeners.delete(l);
    },
    emit: (c) => changeListeners.forEach((l) => l(c)),
    setState: (s) => {
      state = s;
      stateListeners.forEach((l) => l(s));
    },
  };
  return client;
}

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

const getAccessToken = async () => 'token';

describe('useNotificationsRealtime', () => {
  it('useNotificationsRealtime_Enabled_ConnectsAndDisconnectsOnUnmount', () => {
    const { wrapper } = setup();
    const client = fakeClient();
    const { unmount } = renderHook(() => useNotificationsRealtime({ enabled: true, userId: 'u1', getAccessToken, client }), { wrapper });

    expect(client.connect).toHaveBeenCalledTimes(1);
    unmount();
    expect(client.disconnect).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['signed out', { enabled: true, userId: null }],
    ['a guest or public page', { enabled: false, userId: 'u1' }],
  ])('useNotificationsRealtime_%s_NeverConnects', (_name, options) => {
    const { wrapper } = setup();
    const client = fakeClient();
    renderHook(() => useNotificationsRealtime({ ...options, getAccessToken, client }), { wrapper });
    expect(client.connect).not.toHaveBeenCalled();
  });

  it('useNotificationsRealtime_UserChanges_ClosesTheChannelAndOpensANewOne', () => {
    const { wrapper } = setup();
    const client = fakeClient();
    const { rerender } = renderHook(({ userId }) => useNotificationsRealtime({ enabled: true, userId, getAccessToken, client }), {
      wrapper,
      initialProps: { userId: 'u1' as string | null },
    });
    rerender({ userId: null });
    expect(client.disconnect).toHaveBeenCalledTimes(1);
    rerender({ userId: 'u2' });
    expect(client.connect).toHaveBeenCalledTimes(2);
  });

  it('useNotificationsRealtime_ChangeArrives_SetsTheCountAndInvalidatesWhatItFeeds', () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(UNREAD_COUNT_KEY, 1);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const client = fakeClient();
    renderHook(() => useNotificationsRealtime({ enabled: true, userId: 'u1', getAccessToken, client }), { wrapper });

    act(() => client.emit({ unreadCount: 4, type: 'guest-message', entityId: 'booking-1' }));

    expect(queryClient.getQueryData(UNREAD_COUNT_KEY)).toBe(4);
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([NOTIFICATIONS_QUERY]);
    expect(keys).toContainEqual([HOST_THREADS_QUERY]);
    expect(keys).toContainEqual([UNREAD_MESSAGES_QUERY]);
    expect(keys).toContainEqual([BOOKING_THREAD_QUERY, 'booking-1']);
  });

  it('useNotificationsRealtime_ReconnectAfterAGap_ReadsEverythingAgain', () => {
    const { queryClient, wrapper } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const client = fakeClient();
    renderHook(() => useNotificationsRealtime({ enabled: true, userId: 'u1', getAccessToken, client }), { wrapper });

    act(() => client.setState('connected'));
    expect(invalidate).not.toHaveBeenCalled();

    act(() => client.setState('connecting'));
    act(() => client.setState('connected'));
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([NOTIFICATIONS_QUERY]);
    expect(keys).toContainEqual([BOOKING_THREAD_QUERY]);
  });

  it('useNotificationsRealtime_State_FollowsTheChannel', () => {
    const { wrapper } = setup();
    const client = fakeClient();
    const { result } = renderHook(() => useNotificationsRealtime({ enabled: true, userId: 'u1', getAccessToken, client }), { wrapper });
    expect(result.current).toBe('connecting');
    act(() => client.setState('connected'));
    expect(result.current).toBe('connected');
  });
});

describe('applyNotificationsChange', () => {
  it('applyNotificationsChange_ServiceRequest_DoesNotTreatTheEntityAsABooking', () => {
    const { queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    applyNotificationsChange(queryClient, { unreadCount: 2, type: 'service-request-taken', entityId: 'sr-1' });
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).not.toContainEqual([BOOKING_THREAD_QUERY, 'sr-1']);
    expect(keys).not.toContainEqual([BOOKING_THREAD_QUERY]);
  });

  it.each(['property-compliance-suspended', 'new-booking', 'service-payment-failed'])(
    'applyNotificationsChange_%s_NeverTreatsTheEntityAsAThread',
    (type) => {
      const { queryClient } = setup();
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      applyNotificationsChange(queryClient, { unreadCount: 1, type, entityId: 'e-1' });
      const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
      expect(keys).not.toContainEqual([BOOKING_THREAD_QUERY, 'e-1']);
      expect(keys).not.toContainEqual([BOOKING_THREAD_QUERY]);
    },
  );

  it('applyNotificationsChange_NoEntity_RefreshesEveryOpenThread', () => {
    const { queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    applyNotificationsChange(queryClient, { unreadCount: 0, type: null, entityId: null });
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([BOOKING_THREAD_QUERY]);
  });
});
