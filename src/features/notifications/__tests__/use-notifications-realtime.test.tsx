import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { createElement } from 'react';
import { getInvoiceData } from '@/api/invoice-data.api';
import { COMPLIANCE_KEY } from '@/features/compliance/use-compliance';
import { ALLOGGIATI_KEY } from '@/queries/use-alloggiati';
import { BOOKING_THREAD_QUERY, HOST_THREADS_QUERY, UNREAD_MESSAGES_QUERY } from '@/queries/use-booking-messages';
import { BOOKINGS_KEY } from '@/queries/use-bookings';
import { CHECKIN_SESSION_KEY } from '@/queries/use-checkin';
import { DASHBOARD_KEY } from '@/queries/use-dashboard';
import { INVOICE_DATA_KEY, useInvoiceData } from '@/queries/use-invoice-data';
import { NOTIFICATIONS_QUERY, UNREAD_COUNT_KEY } from '@/queries/use-notifications';
import type { PendingAlert } from '@/types/alert';
import type { NotificationsChange, RealtimeClient, RealtimeState } from '../realtime-client';
import { applyNotificationsChange, useNotificationsRealtime } from '../use-notifications-realtime';

// The section «Dati di fatturazione» of an open booking reads its data through this module: nothing goes to the network.
vi.mock('@/api/invoice-data.api', () => ({ getInvoiceData: vi.fn(), saveInvoiceData: vi.fn() }));

function fakeClient(initial: RealtimeState = 'disconnected') {
  let state = initial;
  const stateListeners = new Set<(s: RealtimeState) => void>();
  const changeListeners = new Set<(c: NotificationsChange) => void>();
  const alertListeners = new Set<(a: PendingAlert) => void>();
  const client: RealtimeClient & {
    emit: (c: NotificationsChange) => void;
    emitAlert: (a: PendingAlert) => void;
    setState: (s: RealtimeState) => void;
  } = {
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
    onAlert: (l) => {
      alertListeners.add(l);
      return () => alertListeners.delete(l);
    },
    emit: (c) => changeListeners.forEach((l) => l(c)),
    emitAlert: (a) => alertListeners.forEach((l) => l(a)),
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

  it('useNotificationsRealtime_ReconnectAfterAGap_AlsoReadsAgainWhatACheckInChanges', () => {
    const { queryClient, wrapper } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const client = fakeClient();
    renderHook(() => useNotificationsRealtime({ enabled: true, userId: 'u1', getAccessToken, client }), { wrapper });

    act(() => client.setState('connected'));
    act(() => client.setState('connecting'));
    act(() => client.setState('connected'));

    // A check-in completed while the socket was down sent no message: the pages that show its data are read again.
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([BOOKINGS_KEY]);
    expect(keys).toContainEqual([CHECKIN_SESSION_KEY]);
    // The invoice data the guest wrote at that check-in (FIS-01) is one of them.
    expect(keys).toContainEqual([INVOICE_DATA_KEY]);
  });

  it('useNotificationsRealtime_State_FollowsTheChannel', () => {
    const { wrapper } = setup();
    const client = fakeClient();
    const { result } = renderHook(() => useNotificationsRealtime({ enabled: true, userId: 'u1', getAccessToken, client }), { wrapper });
    expect(result.current).toBe('connecting');
    act(() => client.setState('connected'));
    expect(result.current).toBe('connected');
  });

  describe('onNewNotification', () => {
    function mount(unreadBefore: number | undefined) {
      const { queryClient, wrapper } = setup();
      if (unreadBefore !== undefined) queryClient.setQueryData(UNREAD_COUNT_KEY, unreadBefore);
      const client = fakeClient();
      const onNewNotification = vi.fn();
      const view = renderHook(
        ({ callback }) => useNotificationsRealtime({ enabled: true, userId: 'u1', getAccessToken, client, onNewNotification: callback }),
        { wrapper, initialProps: { callback: onNewNotification } },
      );
      return { client, onNewNotification, ...view };
    }

    it('useNotificationsRealtime_ANewNotificationArrives_CallsTheCallbackOnceWithTheChange', () => {
      const { client, onNewNotification } = mount(1);
      const change = { unreadCount: 2, type: 'guest-checkin-completed', entityId: 'booking-1' };

      act(() => client.emit(change));

      expect(onNewNotification).toHaveBeenCalledTimes(1);
      expect(onNewNotification).toHaveBeenCalledWith(change);
    });

    it('useNotificationsRealtime_TheHostReadsAThread_DoesNotCallTheCallbackEvenThoughTheTypeIsThere', () => {
      // The server sends the type and the booking when a guest thread is read, so that an open tab refreshes it: the count falls.
      const { client, onNewNotification } = mount(3);

      act(() => client.emit({ unreadCount: 2, type: 'guest-message', entityId: 'booking-1' }));

      expect(onNewNotification).not.toHaveBeenCalled();
    });

    it.each([
      ['only the count changed (read, read all)', 3, { unreadCount: 4, type: null, entityId: null }],
      ['the count to compare with is not there yet', undefined, { unreadCount: 1, type: 'new-booking', entityId: 'b-1' }],
      ['the count did not grow', 2, { unreadCount: 2, type: 'new-booking', entityId: 'b-1' }],
    ])('useNotificationsRealtime_%s_DoesNotCallTheCallback', (_name, before, change) => {
      const { client, onNewNotification } = mount(before);

      act(() => client.emit(change));

      expect(onNewNotification).not.toHaveBeenCalled();
    });

    it('useNotificationsRealtime_ANewFunctionEveryRender_KeepsTheChannelAndCallsTheLatest', () => {
      const { client, onNewNotification, rerender } = mount(0);
      const latest = vi.fn();

      rerender({ callback: latest });
      act(() => client.emit({ unreadCount: 1, type: 'new-booking', entityId: 'b-1' }));

      expect(client.connect).toHaveBeenCalledTimes(1);
      expect(client.disconnect).not.toHaveBeenCalled();
      expect(onNewNotification).not.toHaveBeenCalled();
      expect(latest).toHaveBeenCalledTimes(1);
    });
  });

  describe('onAlert', () => {
    const alert: PendingAlert = { alertId: 'a-1', alertType: 'BookingNeedsReview', entityType: 'Booking', entityId: 'b-1', urgency: 'High' };

    it('useNotificationsRealtime_AnAlertArrives_CallsTheCallbackWithItOnTheSameChannel', () => {
      const { wrapper } = setup();
      const client = fakeClient();
      const onAlert = vi.fn();
      renderHook(() => useNotificationsRealtime({ enabled: true, userId: 'u1', getAccessToken, client, onAlert }), { wrapper });

      act(() => client.emitAlert(alert));

      expect(client.connect).toHaveBeenCalledTimes(1);
      expect(onAlert).toHaveBeenCalledTimes(1);
      expect(onAlert).toHaveBeenCalledWith(alert);
    });

    it('useNotificationsRealtime_ANewFunctionEveryRender_KeepsTheChannelAndCallsTheLatestAlertCallback', () => {
      const { wrapper } = setup();
      const client = fakeClient();
      const first = vi.fn();
      const latest = vi.fn();
      const { rerender } = renderHook(
        ({ callback }) => useNotificationsRealtime({ enabled: true, userId: 'u1', getAccessToken, client, onAlert: callback }),
        { wrapper, initialProps: { callback: first } },
      );

      rerender({ callback: latest });
      act(() => client.emitAlert(alert));

      expect(client.connect).toHaveBeenCalledTimes(1);
      expect(client.disconnect).not.toHaveBeenCalled();
      expect(first).not.toHaveBeenCalled();
      expect(latest).toHaveBeenCalledTimes(1);
    });

    it('useNotificationsRealtime_Unmounted_StopsListeningToAlerts', () => {
      const { wrapper } = setup();
      const client = fakeClient();
      const onAlert = vi.fn();
      const { unmount } = renderHook(() => useNotificationsRealtime({ enabled: true, userId: 'u1', getAccessToken, client, onAlert }), { wrapper });

      unmount();
      act(() => client.emitAlert(alert));

      expect(onAlert).not.toHaveBeenCalled();
    });

    it('useNotificationsRealtime_AlertsOnly_LeavesTheNotificationsToTheBell', () => {
      // The popup shares the channel with the bell: if both applied a change, the one that came second would see the count already
      // grown and the bell would miss that a notification is new.
      const { queryClient, wrapper } = setup();
      queryClient.setQueryData(UNREAD_COUNT_KEY, 1);
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      const client = fakeClient();
      const onAlert = vi.fn();
      renderHook(() => useNotificationsRealtime({ enabled: true, userId: 'u1', getAccessToken, client, onAlert, alertsOnly: true }), { wrapper });

      act(() => client.emit({ unreadCount: 5, type: 'guest-message', entityId: 'booking-1' }));
      act(() => client.setState('connected'));
      act(() => client.setState('connecting'));
      act(() => client.setState('connected'));
      act(() => client.emitAlert(alert));

      expect(queryClient.getQueryData(UNREAD_COUNT_KEY)).toBe(1);
      expect(invalidate).not.toHaveBeenCalled();
      expect(onAlert).toHaveBeenCalledWith(alert);
    });
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

  it('applyNotificationsChange_NoEntity_RefreshesEveryOpenThread', () => {
    const { queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    applyNotificationsChange(queryClient, { unreadCount: 0, type: null, entityId: null });
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([BOOKING_THREAD_QUERY]);
  });

  it('applyNotificationsChange_GuestCheckInCompleted_ReadsAgainWhatTheCheckInChanges', () => {
    const { queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    applyNotificationsChange(queryClient, { unreadCount: 1, type: 'guest-checkin-completed', entityId: 'b-1' });
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    for (const root of [BOOKINGS_KEY, CHECKIN_SESSION_KEY, ALLOGGIATI_KEY, COMPLIANCE_KEY, DASHBOARD_KEY, 'guests', INVOICE_DATA_KEY])
      expect(keys, root).toContainEqual([root]);
    // The entity is a booking, so its thread is read again too, as for any booking event.
    expect(keys).toContainEqual([BOOKING_THREAD_QUERY, 'b-1']);
  });

  // NF-52: a light of the cockpit changes with an alert, and a page of the adempimenti, a booking or a property that is open shows it without a reload.
  it.each([
    'guest-data-missing',
    'alloggiati-deadline',
    'alloggiati-overdue',
    'alloggiati-failed',
    'checkout-reminder',
    'receipt-missing',
    'short-stay-at-risk',
    'over-thirty-nights',
    'istat-deadline',
    'tourist-tax-deadline',
    'connection-inactive',
    'verification-required',
  ])('applyNotificationsChange_ComplianceAlert_%s_ReadsTheCockpitAgain', (type) => {
    const { queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    applyNotificationsChange(queryClient, { unreadCount: 1, type, entityId: 'b-1' });
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([COMPLIANCE_KEY]);
    // It is the cockpit that moves: not the rest of what a completed check-in changes.
    expect(keys).not.toContainEqual([BOOKINGS_KEY]);
    expect(keys).not.toContainEqual([INVOICE_DATA_KEY]);
  });

  it('applyNotificationsChange_ComplianceAlert_AnOpenCockpitReadsTheSummaryAgainWithoutAReload', async () => {
    const { queryClient, wrapper } = setup();
    const readSummary = vi.fn().mockResolvedValue({ light: 'Yellow' });
    renderHook(() => useQuery({ queryKey: [COMPLIANCE_KEY, 'summary'], queryFn: readSummary }), { wrapper });
    await waitFor(() => expect(readSummary).toHaveBeenCalledTimes(1));

    act(() => applyNotificationsChange(queryClient, { unreadCount: 1, type: 'receipt-missing', entityId: 'b-1' }));

    await waitFor(() => expect(readSummary).toHaveBeenCalledTimes(2));
  });

  it.each(['guest-message', 'new-booking', 'service-request-taken'])(
    'applyNotificationsChange_%s_DoesNotReadTheCheckInDataAgain',
    (type) => {
      const { queryClient } = setup();
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      applyNotificationsChange(queryClient, { unreadCount: 1, type, entityId: 'x-1' });
      const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
      expect(keys).not.toContainEqual([BOOKINGS_KEY]);
      expect(keys).not.toContainEqual([CHECKIN_SESSION_KEY]);
      expect(keys).not.toContainEqual([INVOICE_DATA_KEY]);
    },
  );

  it('applyNotificationsChange_GuestCheckInCompleted_AnOpenBookingPageReadsTheBookingAndItsCheckInAgainWithoutAReload', async () => {
    const { queryClient, wrapper } = setup();
    const readBooking = vi.fn().mockResolvedValue({ id: 'b-1' });
    const readLink = vi.fn().mockResolvedValue({ status: 'InCompilazione' });
    const readCompliance = vi.fn().mockResolvedValue({ unresolved: 0 });
    // What the open page of booking b-1 keeps mounted (`useBooking`, `useBookingCheckInSession`) and the counter of the menu.
    renderHook(
      () => ({
        booking: useQuery({ queryKey: [BOOKINGS_KEY, 'b-1'], queryFn: readBooking }),
        link: useQuery({ queryKey: [CHECKIN_SESSION_KEY, 'b-1'], queryFn: readLink }),
        compliance: useQuery({ queryKey: [COMPLIANCE_KEY, 'summary'], queryFn: readCompliance }),
      }),
      { wrapper },
    );
    await waitFor(() => expect(readLink).toHaveBeenCalledTimes(1));

    act(() => applyNotificationsChange(queryClient, { unreadCount: 1, type: 'guest-checkin-completed', entityId: 'b-1' }));

    await waitFor(() => expect(readLink).toHaveBeenCalledTimes(2));
    expect(readBooking).toHaveBeenCalledTimes(2);
    expect(readCompliance).toHaveBeenCalledTimes(2);
  });

  // FIS-01: the guest's «yes» to «Ti serve la fattura?» and the data the guest wrote are saved with the check-in, so the section «Dati di
  // fatturazione» of the open tab Pagamento (`useInvoiceData`, which keeps no data once unmounted) shows them at once, not at the next focus.
  it('applyNotificationsChange_GuestCheckInCompleted_AnOpenInvoiceDataSectionShowsWhatTheGuestWroteWithoutAReload', async () => {
    const { queryClient, wrapper } = setup();
    const read = vi.mocked(getInvoiceData);
    read.mockResolvedValueOnce({ bookingId: 'b-1', invoiceRequested: false });
    read.mockResolvedValueOnce({ bookingId: 'b-1', invoiceRequested: true, recipientKind: 'Guest', name: 'Mario Rossi', source: 'CheckIn' });
    const { result } = renderHook(() => useInvoiceData('b-1'), { wrapper });
    await waitFor(() => expect(result.current.data?.invoiceRequested).toBe(false));

    act(() => applyNotificationsChange(queryClient, { unreadCount: 1, type: 'guest-checkin-completed', entityId: 'b-1' }));

    await waitFor(() => expect(result.current.data?.invoiceRequested).toBe(true));
    expect(result.current.data).toMatchObject({ name: 'Mario Rossi', source: 'CheckIn' });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('applyNotificationsChange_GuestMessage_DoesNotReadTheInvoiceDataOfAnOpenBookingAgain', async () => {
    const { queryClient, wrapper } = setup();
    const read = vi.mocked(getInvoiceData);
    read.mockClear();
    read.mockResolvedValue({ bookingId: 'b-1', invoiceRequested: false });
    const { result } = renderHook(() => useInvoiceData('b-1'), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());

    act(() => applyNotificationsChange(queryClient, { unreadCount: 1, type: 'guest-message', entityId: 'b-1' }));
    await act(async () => {});

    expect(read).toHaveBeenCalledTimes(1);
  });
});
