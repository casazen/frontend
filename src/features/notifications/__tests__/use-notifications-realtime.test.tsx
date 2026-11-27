import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { createElement } from 'react';
import { getInvoiceData } from '@/api/invoice-data.api';
import { COMPLIANCE_KEY } from '@/features/compliance/use-compliance';
import { ORG_DOMAIN_QUERY_KEY } from '@/features/settings/domain/use-org-domain';
import { INTERNAL_ACTIVITIES_KEY } from '@/lib/query-client';
import { COMPLIANCE_ARCHIVE_KEY } from '@/queries/compliance-archive';
import { COMPLIANCE_HEALTH_KEY } from '@/queries/compliance-health';
import { ACCOUNTANT_PACKAGE_KEY } from '@/queries/use-accountant-package';
import { ADMIN_ASSIST_KEY } from '@/queries/use-admin-onboarding-assist';
import { ALLOGGIATI_KEY } from '@/queries/use-alloggiati';
import { ASSIST_REQUESTS_KEY } from '@/queries/use-onboarding-assist';
import { PANEL_STEPS_KEY } from '@/queries/use-onboarding-panel-step';
import { BOOKING_THREAD_QUERY, HOST_THREADS_QUERY, UNREAD_MESSAGES_QUERY } from '@/queries/use-booking-messages';
import { BOOKINGS_KEY } from '@/queries/use-bookings';
import { CHECKIN_SESSION_KEY } from '@/queries/use-checkin';
import { CHECKIN_LINK_DELIVERY_KEY } from '@/queries/use-checkin-link-delivery';
import { DASHBOARD_KEY } from '@/queries/use-dashboard';
import { FISCAL_DOCUMENTS_KEY } from '@/queries/use-fiscal-documents';
import { INVOICE_DATA_KEY, useInvoiceData } from '@/queries/use-invoice-data';
import { NOTIFICATIONS_QUERY, UNREAD_COUNT_KEY } from '@/queries/use-notifications';
import { PAYMENTS_KEY } from '@/queries/use-payments';
import { PROPERTIES_KEY } from '@/queries/use-properties';
import { SCHEDULED_MESSAGES_KEY } from '@/queries/use-scheduled-messages';
import { GUEST_REGISTER_KEY } from '@/queries/guestRegister';
import { SWISS_NOTIFICATION_KEY, TICINO_POLICE_KEY } from '@/queries/swissCompliance';
import { TOURIST_TAX_SUMMARY_KEY } from '@/queries/use-tourist-tax-summary';
import { VERIFICATION_KEY } from '@/queries/verification';
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
    // So is the coverage report of the archive of the proofs, which an open «Riepilogo» shows (E03/F03/US02).
    expect(keys).toContainEqual([COMPLIANCE_ARCHIVE_KEY, 'report']);
  });

  // E23/F01/US01/T01: a link that did not reach the guest while the socket was down sent no message either: where the link stands and the «To do» list are read again.
  it('useNotificationsRealtime_ReconnectAfterAGap_AlsoReadsAgainWhereTheCheckInLinkStandsAndTheTodoList', () => {
    const { queryClient, wrapper } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const client = fakeClient();
    renderHook(() => useNotificationsRealtime({ enabled: true, userId: 'u1', getAccessToken, client }), { wrapper });

    act(() => client.setState('connected'));
    act(() => client.setState('connecting'));
    act(() => client.setState('connected'));

    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([CHECKIN_LINK_DELIVERY_KEY]);
    expect(keys).toContainEqual([INTERNAL_ACTIVITIES_KEY]);
  });

  it('useNotificationsRealtime_ReconnectAfterAGap_AlsoReadsAgainTheVerificationsOfTheOperator', () => {
    const { queryClient, wrapper } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const client = fakeClient();
    renderHook(() => useNotificationsRealtime({ enabled: true, userId: 'u1', getAccessToken, client }), { wrapper });

    act(() => client.setState('connected'));
    act(() => client.setState('connecting'));
    act(() => client.setState('connected'));

    // A guest handed a verification to an operator while the socket was down: the console open in front of the operator reads it again.
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([VERIFICATION_KEY]);
  });

  it('useNotificationsRealtime_ReconnectAfterAGap_AlsoReadsAgainTheStaffQueueOfTheRequestsOfHelp', () => {
    const { queryClient, wrapper } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const client = fakeClient();
    renderHook(() => useNotificationsRealtime({ enabled: true, userId: 'u1', getAccessToken, client }), { wrapper });

    act(() => client.setState('connected'));
    act(() => client.setState('connecting'));
    act(() => client.setState('connected'));

    // A host asked for help while the socket was down: the queue open in front of the staff reads it again.
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([...ADMIN_ASSIST_KEY]);
  });

  it('useNotificationsRealtime_ReconnectAfterAGap_AlsoReadsAgainTheRequestsOfHelpOfTheHostAndTheirSteps', () => {
    const { queryClient, wrapper } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const client = fakeClient();
    renderHook(() => useNotificationsRealtime({ enabled: true, userId: 'u1', getAccessToken, client }), { wrapper });

    act(() => client.setState('connected'));
    act(() => client.setState('connecting'));
    act(() => client.setState('connected'));

    // Support closed a request while the socket was down: the page of the host reads the request and its step again.
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([...ASSIST_REQUESTS_KEY]);
    expect(keys).toContainEqual([...PANEL_STEPS_KEY]);
  });

  it('useNotificationsRealtime_ReconnectAfterAGap_AlsoReadsAgainTheFiscalDocuments', () => {
    const { queryClient, wrapper } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const client = fakeClient();
    renderHook(() => useNotificationsRealtime({ enabled: true, userId: 'u1', getAccessToken, client }), { wrapper });

    act(() => client.setState('connected'));
    act(() => client.setState('connecting'));
    act(() => client.setState('connected'));

    // A document issued while the socket was down sent no message: the pages that show it read the documents again, and so does the count of Ticino at year end.
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([...FISCAL_DOCUMENTS_KEY]);
    expect(keys).toContainEqual([TOURIST_TAX_SUMMARY_KEY]);
  });

  // E05/F07/US02 (NF-71): a scheduled message that was held back or skipped while the socket was down sent no message either: every timeline that is open and the «To do» list are read again.
  it('useNotificationsRealtime_ReconnectAfterAGap_AlsoReadsAgainTheScheduledMessagesAndTheTodoList', () => {
    const { queryClient, wrapper } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const client = fakeClient();
    renderHook(() => useNotificationsRealtime({ enabled: true, userId: 'u1', getAccessToken, client }), { wrapper });

    act(() => client.setState('connected'));
    act(() => client.setState('connecting'));
    act(() => client.setState('connected'));

    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([SCHEDULED_MESSAGES_KEY]);
    expect(keys).toContainEqual([INTERNAL_ACTIVITIES_KEY]);
  });

  // E05/F07/US02 (NF-71): the push `scheduled-message-issue` (a message held back, failed, skipped or sent outside hours) is a new notice for the bell, which shows its pop-up, and the timeline of THAT booking
  // and the «To do» list read it again; the timelines of other bookings and what a check-in changes do not.
  it('useNotificationsRealtime_ScheduledMessageIssueArrives_TellsTheBellAndReadsTheTimelineOfThatBookingAndTheTodoListOnly', () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(UNREAD_COUNT_KEY, 0);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const client = fakeClient();
    const onNewNotification = vi.fn();
    renderHook(() => useNotificationsRealtime({ enabled: true, userId: 'host-1', getAccessToken, client, onNewNotification }), { wrapper });

    const change = { unreadCount: 1, type: 'scheduled-message-issue', entityId: 'b-1' };
    act(() => client.emit(change));

    expect(onNewNotification).toHaveBeenCalledWith(change);
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([SCHEDULED_MESSAGES_KEY, 'b-1']);
    expect(keys).toContainEqual([INTERNAL_ACTIVITIES_KEY]);
    expect(keys).not.toContainEqual([SCHEDULED_MESSAGES_KEY]);
    for (const root of [BOOKINGS_KEY, CHECKIN_SESSION_KEY, CHECKIN_LINK_DELIVERY_KEY, ALLOGGIATI_KEY, COMPLIANCE_KEY]) expect(keys, root).not.toContainEqual([root]);
  });

  it('applyNotificationsChange_ScheduledMessageIssue_AnOpenTimelineShowsTheNewStateWithoutAReload_AndTheTimelineOfAnotherBookingIsLeftAlone', async () => {
    const { queryClient, wrapper } = setup();
    const readThisBooking = vi.fn().mockResolvedValue([]);
    const readAnotherBooking = vi.fn().mockResolvedValue([]);
    // What the open tab Soggiorno of booking b-1 keeps mounted (`useScheduledMessages`), and another booking's.
    renderHook(
      () => ({
        mine: useQuery({ queryKey: [SCHEDULED_MESSAGES_KEY, 'b-1'], queryFn: readThisBooking }),
        other: useQuery({ queryKey: [SCHEDULED_MESSAGES_KEY, 'b-2'], queryFn: readAnotherBooking }),
      }),
      { wrapper },
    );
    await waitFor(() => expect(readThisBooking).toHaveBeenCalledTimes(1));

    act(() => applyNotificationsChange(queryClient, { unreadCount: 1, type: 'scheduled-message-issue', entityId: 'b-1' }));

    await waitFor(() => expect(readThisBooking).toHaveBeenCalledTimes(2));
    expect(readAnotherBooking).toHaveBeenCalledTimes(1);
  });

  // E30/F02/US03/T01 (NF-127, NF-128): the alerts of the 24 hours of a Ticino arrival day and the declaration of a day are new notices for the bell, which shows its pop-up; the cockpit (and the counter of the menu),
  // the days of THAT property and the properties read again. The entity is the property: no thread of a booking is read.
  it.each(['ticino-notification-due', 'ticino-notification-overdue', 'ticino-notification-declared'])(
    'useNotificationsRealtime_%sArrives_TellsTheBellAndReadsTheCockpitTheDaysOfThatPropertyAndThePropertiesOnly',
    (type) => {
      const { queryClient, wrapper } = setup();
      queryClient.setQueryData(UNREAD_COUNT_KEY, 0);
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      const client = fakeClient();
      const onNewNotification = vi.fn();
      renderHook(() => useNotificationsRealtime({ enabled: true, userId: 'host-1', getAccessToken, client, onNewNotification }), { wrapper });

      const change = { unreadCount: 1, type, entityId: 'p-1' };
      act(() => client.emit(change));

      expect(onNewNotification).toHaveBeenCalledWith(change);
      const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
      expect(keys).toContainEqual([COMPLIANCE_KEY]);
      expect(keys).toContainEqual([TICINO_POLICE_KEY, 'p-1']);
      expect(keys).toContainEqual([PROPERTIES_KEY]);
      // The entity is a property, never a booking: no thread, and nothing of what a check-in or a scheduled message changes.
      expect(keys).not.toContainEqual([BOOKING_THREAD_QUERY, 'p-1']);
      expect(keys).not.toContainEqual([TICINO_POLICE_KEY]);
      for (const root of [BOOKINGS_KEY, CHECKIN_SESSION_KEY, ALLOGGIATI_KEY, DASHBOARD_KEY, SCHEDULED_MESSAGES_KEY]) expect(keys, root).not.toContainEqual([root]);
    },
  );

  // E31/F02/US01/T01 (NF-131): the alerts of the deadline of an arrival day of another canton and the declaration of a day are new notices for the bell, which shows its pop-up; the cockpit (and the counter of the
  // menu), the days of THAT property and the properties read again. The entity is the property: no thread of a booking is read, and the days of the Ticino notification are not touched.
  it.each(['swiss-notification-due', 'swiss-notification-overdue', 'swiss-notification-declared'])(
    'useNotificationsRealtime_%sArrives_TellsTheBellAndReadsTheCockpitTheDaysOfThatPropertyAndThePropertiesOnly',
    (type) => {
      const { queryClient, wrapper } = setup();
      queryClient.setQueryData(UNREAD_COUNT_KEY, 0);
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      const client = fakeClient();
      const onNewNotification = vi.fn();
      renderHook(() => useNotificationsRealtime({ enabled: true, userId: 'host-1', getAccessToken, client, onNewNotification }), { wrapper });

      const change = { unreadCount: 1, type, entityId: 'p-1' };
      act(() => client.emit(change));

      expect(onNewNotification).toHaveBeenCalledWith(change);
      const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
      expect(keys).toContainEqual([COMPLIANCE_KEY]);
      expect(keys).toContainEqual([SWISS_NOTIFICATION_KEY, 'p-1']);
      expect(keys).toContainEqual([PROPERTIES_KEY]);
      // The entity is a property, never a booking: no thread, and nothing of what a check-in, a scheduled message or the Ticino notification changes.
      expect(keys).not.toContainEqual([BOOKING_THREAD_QUERY, 'p-1']);
      expect(keys).not.toContainEqual([SWISS_NOTIFICATION_KEY]);
      expect(keys).not.toContainEqual([TICINO_POLICE_KEY]);
      for (const root of [BOOKINGS_KEY, CHECKIN_SESSION_KEY, ALLOGGIATI_KEY, DASHBOARD_KEY, SCHEDULED_MESSAGES_KEY]) expect(keys, root).not.toContainEqual([root]);
    },
  );

  it('useNotificationsRealtime_ReconnectAfterAGap_AlsoReadsAgainTheAssistedNotification', () => {
    const { queryClient, wrapper } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const client = fakeClient();
    renderHook(() => useNotificationsRealtime({ enabled: true, userId: 'u1', getAccessToken, client }), { wrapper });

    act(() => client.setState('connected'));
    act(() => client.setState('connecting'));
    act(() => client.setState('connected'));

    // A day declared, or whose deadline ran out, while the socket was down sent no message: the cockpit, every open day and the properties are read again.
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([COMPLIANCE_KEY]);
    expect(keys).toContainEqual([SWISS_NOTIFICATION_KEY]);
    expect(keys).toContainEqual([PROPERTIES_KEY]);
  });

  it('useNotificationsRealtime_ReconnectAfterAGap_AlsoReadsAgainTheTicinoNotification', () => {
    const { queryClient, wrapper } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const client = fakeClient();
    renderHook(() => useNotificationsRealtime({ enabled: true, userId: 'u1', getAccessToken, client }), { wrapper });

    act(() => client.setState('connected'));
    act(() => client.setState('connecting'));
    act(() => client.setState('connected'));

    // A day declared, or whose 24 hours ran out, while the socket was down sent no message: the cockpit, every open day and the properties are read again.
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([COMPLIANCE_KEY]);
    expect(keys).toContainEqual([TICINO_POLICE_KEY]);
    expect(keys).toContainEqual([PROPERTIES_KEY]);
  });

  // E40/F02/US02 (`be-auth0-host-sync`): the domain of the agency became active, or the sign-in of the owners on it became active or failed, with no one touching the page. The entity is the ORG: the
  // administrator is told at once (the pop-up of the bell, with the way to the domain settings), and the domain settings that are open read the domain again. Nothing of a booking is read.
  it.each(['domain-verified', 'owner-login-ready', 'owner-login-failed'])('useNotificationsRealtime_%sArrives_TellsTheBellAndReadsTheDomainSettingsOnly', (type) => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(UNREAD_COUNT_KEY, 0);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const client = fakeClient();
    const onNewNotification = vi.fn();
    renderHook(() => useNotificationsRealtime({ enabled: true, userId: 'admin-1', getAccessToken, client, onNewNotification }), { wrapper });

    const change = { unreadCount: 1, type, entityId: 'org-1' };
    act(() => client.emit(change));

    expect(onNewNotification).toHaveBeenCalledWith(change);
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([ORG_DOMAIN_QUERY_KEY]);
    // The entity is the org, never a booking: no thread, and nothing of what a check-in, a verification or a Ticino notification changes.
    expect(keys).not.toContainEqual([BOOKING_THREAD_QUERY, 'org-1']);
    expect(keys).not.toContainEqual([BOOKING_THREAD_QUERY]);
    for (const root of [BOOKINGS_KEY, CHECKIN_SESSION_KEY, ALLOGGIATI_KEY, DASHBOARD_KEY, COMPLIANCE_KEY, PROPERTIES_KEY]) expect(keys, root).not.toContainEqual([root]);
  });

  it('useNotificationsRealtime_ReconnectAfterAGap_AlsoReadsAgainTheDomainSettings', () => {
    const { queryClient, wrapper } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const client = fakeClient();
    renderHook(() => useNotificationsRealtime({ enabled: true, userId: 'u1', getAccessToken, client }), { wrapper });

    act(() => client.setState('connected'));
    act(() => client.setState('connecting'));
    act(() => client.setState('connected'));

    // A domain verified, or a sign-in of the owners made active or failed, while the socket was down sent no message: the domain settings are read again.
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([ORG_DOMAIN_QUERY_KEY]);
  });

  it('useNotificationsRealtime_AssistRequestedArrives_ReadsTheStaffQueueAgainAndTellsTheBell', () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(UNREAD_COUNT_KEY, 0);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const client = fakeClient();
    const onNewNotification = vi.fn();
    renderHook(() => useNotificationsRealtime({ enabled: true, userId: 'staff-1', getAccessToken, client, onNewNotification }), { wrapper });

    const change = { unreadCount: 1, type: 'assist-requested', entityId: 'ar-1' };
    act(() => client.emit(change));

    // The staff are told at once (the pop-up of the bell, with the way to the queue), and the queue that is open shows the request.
    expect(onNewNotification).toHaveBeenCalledWith(change);
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([...ADMIN_ASSIST_KEY]);
  });

  it.each(['assist-verified', 'assist-declared'])('useNotificationsRealtime_%sArrives_ReadsTheRequestsOfTheHostAndTheirStepsAndTellsTheBell', (type) => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(UNREAD_COUNT_KEY, 0);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const client = fakeClient();
    const onNewNotification = vi.fn();
    renderHook(() => useNotificationsRealtime({ enabled: true, userId: 'host-1', getAccessToken, client, onNewNotification }), { wrapper });

    const change = { unreadCount: 1, type, entityId: 'ar-1' };
    act(() => client.emit(change));

    // The administrator is told at once (the pop-up of the bell), and the page that is open shows the request and its step as support left them.
    expect(onNewNotification).toHaveBeenCalledWith(change);
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([...ASSIST_REQUESTS_KEY]);
    expect(keys).toContainEqual([...PANEL_STEPS_KEY]);
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
    // Where the link stands on its way to the guest ends with the check-in (E23/F01/US01/T01): the guest panel stops saying that it waits.
    for (const root of [BOOKINGS_KEY, CHECKIN_SESSION_KEY, CHECKIN_LINK_DELIVERY_KEY, ALLOGGIATI_KEY, COMPLIANCE_KEY, DASHBOARD_KEY, 'guests', INVOICE_DATA_KEY])
      expect(keys, root).toContainEqual([root]);
    // The entity is a booking, so its thread is read again too, as for any booking event.
    expect(keys).toContainEqual([BOOKING_THREAD_QUERY, 'b-1']);
  });

  // E03/F03/US02: the guests of a stay change what the coverage report of the archive of the proofs says about it, and an open «Riepilogo» shows it
  // without a reload; the files of the archive are not touched by a check-in.
  it('applyNotificationsChange_GuestCheckInCompleted_ReadsAgainTheCoverageReportOfTheArchiveAndNotItsFiles', () => {
    const { queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    applyNotificationsChange(queryClient, { unreadCount: 1, type: 'guest-checkin-completed', entityId: 'b-1' });
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([COMPLIANCE_ARCHIVE_KEY, 'report']);
    expect(keys).not.toContainEqual([COMPLIANCE_ARCHIVE_KEY]);
    expect(keys).not.toContainEqual([COMPLIANCE_ARCHIVE_KEY, 'list']);
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

  // E03/F03/US02: an open archive of the proofs shows the new row of its report without a reload; the files of the archive are not touched by an alert.
  it.each(['receipt-missing', 'istat-deadline', 'connection-inactive'])('applyNotificationsChange_ComplianceAlert_%s_ReadsTheCoverageReportOfTheArchiveAgain', (type) => {
    const { queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    applyNotificationsChange(queryClient, { unreadCount: 1, type, entityId: 'p-1' });
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([COMPLIANCE_ARCHIVE_KEY, 'report']);
    expect(keys).not.toContainEqual([COMPLIANCE_ARCHIVE_KEY]);
    expect(keys).not.toContainEqual([COMPLIANCE_ARCHIVE_KEY, 'list']);
  });

  it.each([
    ['connection-inactive', true],
    ['receipt-missing', false],
  ])('applyNotificationsChange_ComplianceAlert_%s_ReadsTheConnectionHealthAgain_%s', (type, reads) => {
    const { queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    applyNotificationsChange(queryClient, { unreadCount: 1, type, entityId: 'p-1' });
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys.some((key) => key[0] === COMPLIANCE_HEALTH_KEY)).toBe(reads);
  });

  it('applyNotificationsChange_ComplianceAlert_AnOpenCockpitReadsTheSummaryAgainWithoutAReload', async () => {
    const { queryClient, wrapper } = setup();
    const readSummary = vi.fn().mockResolvedValue({ light: 'Yellow' });
    renderHook(() => useQuery({ queryKey: [COMPLIANCE_KEY, 'summary'], queryFn: readSummary }), { wrapper });
    await waitFor(() => expect(readSummary).toHaveBeenCalledTimes(1));

    act(() => applyNotificationsChange(queryClient, { unreadCount: 1, type: 'receipt-missing', entityId: 'b-1' }));

    await waitFor(() => expect(readSummary).toHaveBeenCalledTimes(2));
  });

  // E30/F02/US03/T01: the arrival days of the Ticino properties still to notify are a section of the summary of the cockpit, which the counter of the menu reads too: an open cockpit shows the day closed (or
  // reopened) by a co-host, and an open layer shows who declared it, without a reload. Only the days of THAT property are read again.
  it.each(['ticino-notification-due', 'ticino-notification-overdue', 'ticino-notification-declared'])(
    'applyNotificationsChange_%s_AnOpenCockpitAndAnOpenDayReadTheNewStateWithoutAReload_AndTheDayOfAnotherPropertyIsLeftAlone',
    async (type) => {
      const { queryClient, wrapper } = setup();
      const readSummary = vi.fn().mockResolvedValue({ ticinoNotifications: { count: 1, items: [] } });
      const readThisProperty = vi.fn().mockResolvedValue({ alreadyDeclared: false });
      const readAnotherProperty = vi.fn().mockResolvedValue({ alreadyDeclared: false });
      // What the open cockpit and the open layer keep mounted: the summary, and the day of this property (the layer reads one day, the key holds the date) and of another one.
      renderHook(
        () => ({
          summary: useQuery({ queryKey: [COMPLIANCE_KEY, 'summary'], queryFn: readSummary }),
          mine: useQuery({ queryKey: [TICINO_POLICE_KEY, 'p-1', '2026-11-19'], queryFn: readThisProperty }),
          other: useQuery({ queryKey: [TICINO_POLICE_KEY, 'p-2', '2026-11-19'], queryFn: readAnotherProperty }),
        }),
        { wrapper },
      );
      await waitFor(() => expect(readThisProperty).toHaveBeenCalledTimes(1));

      act(() => applyNotificationsChange(queryClient, { unreadCount: 1, type, entityId: 'p-1' }));

      await waitFor(() => expect(readSummary).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(readThisProperty).toHaveBeenCalledTimes(2));
      expect(readAnotherProperty).toHaveBeenCalledTimes(1);
    },
  );

  it('applyNotificationsChange_TicinoNotification_AnEventThatNamesNoPropertyReadsTheDaysOfEveryProperty', () => {
    const { queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    applyNotificationsChange(queryClient, { unreadCount: 1, type: 'ticino-notification-declared', entityId: null });
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([TICINO_POLICE_KEY]);
    // No entity at all is what a notification read on another device looks like: the threads are read again, as for any type without an entity.
    expect(keys).toContainEqual([BOOKING_THREAD_QUERY]);
  });

  // A guest who completes the check-in changes who is in the file of the arrival day and who still misses data: the open layer shows it without a reload.
  it('applyNotificationsChange_GuestCheckInCompleted_ReadsAgainTheDaysOfTheTicinoNotification', () => {
    const { queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    applyNotificationsChange(queryClient, { unreadCount: 1, type: 'guest-checkin-completed', entityId: 'b-1' });
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([TICINO_POLICE_KEY]);
  });

  // The same check-in changes the guests of the arrival day of another canton (the data to copy, and what is still missing) and the count of the guest register: the layers that are open show it without a reload.
  it('applyNotificationsChange_GuestCheckInCompleted_ReadsAgainTheDaysOfTheAssistedNotificationAndTheCountOfTheGuestRegister', () => {
    const { queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    applyNotificationsChange(queryClient, { unreadCount: 1, type: 'guest-checkin-completed', entityId: 'b-1' });
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([SWISS_NOTIFICATION_KEY]);
    expect(keys).toContainEqual([GUEST_REGISTER_KEY]);
  });

  it.each(['swiss-notification-due', 'swiss-notification-overdue', 'swiss-notification-declared'])(
    'applyNotificationsChange_%s_AnOpenCockpitAndAnOpenDayReadTheNewStateWithoutAReload_AndTheDayOfAnotherPropertyIsLeftAlone',
    async (type) => {
      const { queryClient, wrapper } = setup();
      const readSummary = vi.fn().mockResolvedValue({ swissNotifications: { count: 1, items: [] } });
      const readThisProperty = vi.fn().mockResolvedValue({ alreadyDeclared: false });
      const readAnotherProperty = vi.fn().mockResolvedValue({ alreadyDeclared: false });
      renderHook(
        () => ({
          summary: useQuery({ queryKey: [COMPLIANCE_KEY, 'summary'], queryFn: readSummary }),
          mine: useQuery({ queryKey: [SWISS_NOTIFICATION_KEY, 'p-1', '2026-11-19'], queryFn: readThisProperty }),
          other: useQuery({ queryKey: [SWISS_NOTIFICATION_KEY, 'p-2', '2026-11-19'], queryFn: readAnotherProperty }),
        }),
        { wrapper },
      );
      await waitFor(() => expect(readThisProperty).toHaveBeenCalledTimes(1));

      act(() => applyNotificationsChange(queryClient, { unreadCount: 1, type, entityId: 'p-1' }));

      await waitFor(() => expect(readSummary).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(readThisProperty).toHaveBeenCalledTimes(2));
      expect(readAnotherProperty).toHaveBeenCalledTimes(1);
    },
  );

  it('applyNotificationsChange_VerificationRequired_ReadsAgainTheQueueTheFiguresAndTheCockpit', () => {
    const { queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    applyNotificationsChange(queryClient, { unreadCount: 1, type: 'verification-required', entityId: 'b-1' });
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([VERIFICATION_KEY]);
    expect(keys).toContainEqual([COMPLIANCE_KEY]);
    // It is not a completed check-in: the booking data is not read again.
    expect(keys).not.toContainEqual([INVOICE_DATA_KEY]);
  });

  // E10/F03/US03/T03: a host asked CasaZen support to do a step. The entity is the request of help: it is not read as a booking.
  it('applyNotificationsChange_AssistRequested_ReadsTheStaffQueueAgainAndNothingOfABooking', () => {
    const { queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    applyNotificationsChange(queryClient, { unreadCount: 1, type: 'assist-requested', entityId: 'ar-1' });
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([...ADMIN_ASSIST_KEY]);
    expect(keys).not.toContainEqual([BOOKING_THREAD_QUERY, 'ar-1']);
    expect(keys).not.toContainEqual([BOOKING_THREAD_QUERY]);
    expect(keys).not.toContainEqual([BOOKINGS_KEY]);
    expect(keys).not.toContainEqual([VERIFICATION_KEY]);
  });

  it('applyNotificationsChange_AssistRequested_AnOpenStaffQueueReadsTheNewRequestWithoutAReload', async () => {
    const { queryClient, wrapper } = setup();
    const readQueue = vi.fn().mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 20 });
    // What the open page of the staff queue keeps mounted (`useAssistQueue`): one page of the list of a status.
    renderHook(() => useQuery({ queryKey: [...ADMIN_ASSIST_KEY, 'list', { status: 'Requested', page: 1 }], queryFn: readQueue }), { wrapper });
    await waitFor(() => expect(readQueue).toHaveBeenCalledTimes(1));

    act(() => applyNotificationsChange(queryClient, { unreadCount: 1, type: 'assist-requested', entityId: 'ar-1' }));

    await waitFor(() => expect(readQueue).toHaveBeenCalledTimes(2));
  });

  // E20/F03/US01/T02: support closed a request of the host. The entity is the request of help: it is not read as a booking, and the staff queue has nothing to read again.
  it.each(['assist-verified', 'assist-declared'])('applyNotificationsChange_%s_ReadsTheRequestsOfTheHostTheStepsAndNothingOfABookingOrOfTheStaffQueue', (type) => {
    const { queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    applyNotificationsChange(queryClient, { unreadCount: 1, type, entityId: 'ar-1' });
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([...ASSIST_REQUESTS_KEY]);
    expect(keys).toContainEqual([...PANEL_STEPS_KEY]);
    expect(keys).not.toContainEqual([...ADMIN_ASSIST_KEY]);
    expect(keys).not.toContainEqual([BOOKING_THREAD_QUERY, 'ar-1']);
    expect(keys).not.toContainEqual([BOOKING_THREAD_QUERY]);
    expect(keys).not.toContainEqual([BOOKINGS_KEY]);
  });

  it('applyNotificationsChange_AssistOutcome_AnOpenListOfTheRequestsAndTheStepThePageFollowsReadTheOutcomeWithoutAReload', async () => {
    const { queryClient, wrapper } = setup();
    const readRequests = vi.fn().mockResolvedValue([]);
    const readStep = vi.fn().mockResolvedValue({ id: 'step-1' });
    // What the open page of a guided step keeps mounted: the requests of the host (`useAssistRequests`) and the step it follows (`usePanelStepStatus`).
    renderHook(
      () => [
        useQuery({ queryKey: [...ASSIST_REQUESTS_KEY], queryFn: readRequests }),
        useQuery({ queryKey: [...PANEL_STEPS_KEY, 'step', 'step-1'], queryFn: readStep }),
      ],
      { wrapper },
    );
    await waitFor(() => expect(readRequests).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(readStep).toHaveBeenCalledTimes(1));

    act(() => applyNotificationsChange(queryClient, { unreadCount: 1, type: 'assist-declared', entityId: 'ar-1' }));

    await waitFor(() => expect(readRequests).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(readStep).toHaveBeenCalledTimes(2));
  });

  // E40/F02/US02: the domain of the agency changed by itself (verified, owner sign-in active or failed). The entity is the ORG: it is not read as a booking, and the domain settings are read again.
  it('applyNotificationsChange_OwnerLoginReady_InvalidatesTheOrgDomainQuery', () => {
    const { queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    applyNotificationsChange(queryClient, { unreadCount: 1, type: 'owner-login-ready', entityId: 'org-1' });
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([ORG_DOMAIN_QUERY_KEY]);
    expect(keys).not.toContainEqual([BOOKING_THREAD_QUERY, 'org-1']);
    expect(keys).not.toContainEqual([BOOKING_THREAD_QUERY]);
  });

  it('applyNotificationsChange_DomainEvent_AnOpenDomainSettingsPageReadsTheNewStateWithoutAReload', async () => {
    const { queryClient, wrapper } = setup();
    const readDomain = vi.fn().mockResolvedValue({ orgId: 'org-1' });
    // What the open page of the domain settings keeps mounted (`useOrgDomain`): the configuration of the org.
    renderHook(() => useQuery({ queryKey: [ORG_DOMAIN_QUERY_KEY, 'org-1'], queryFn: readDomain }), { wrapper });
    await waitFor(() => expect(readDomain).toHaveBeenCalledTimes(1));

    act(() => applyNotificationsChange(queryClient, { unreadCount: 1, type: 'owner-login-failed', entityId: 'org-1' }));

    await waitFor(() => expect(readDomain).toHaveBeenCalledTimes(2));
  });

  it.each(['guest-message', 'new-booking', 'guest-checkin-completed', 'assist-requested', 'ticino-notification-due'])('applyNotificationsChange_%s_DoesNotReadTheDomainSettings', (type) => {
    const { queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    applyNotificationsChange(queryClient, { unreadCount: 1, type, entityId: 'x-1' });
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).not.toContainEqual([ORG_DOMAIN_QUERY_KEY]);
  });

  // E20/F03/US01/T02: the host reopened a request: for the staff it is a request to handle again, as a new one.
  it('applyNotificationsChange_AssistReopened_ReadsTheStaffQueueAgainAndNothingOfABookingOrOfTheHost', () => {
    const { queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    applyNotificationsChange(queryClient, { unreadCount: 1, type: 'assist-reopened', entityId: 'ar-1' });
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([...ADMIN_ASSIST_KEY]);
    expect(keys).not.toContainEqual([BOOKING_THREAD_QUERY, 'ar-1']);
    expect(keys).not.toContainEqual([BOOKING_THREAD_QUERY]);
    expect(keys).not.toContainEqual([BOOKINGS_KEY]);
    expect(keys).not.toContainEqual([...ASSIST_REQUESTS_KEY]);
  });

  // E12/F02/US01/T01: a document of a booking was issued (the push `fiscal-document-issued`, whose entity is the booking): the pages of the documents show it without a reload.
  it('applyNotificationsChange_FiscalDocumentIssued_ReadsAgainTheDocumentsAndTheLedgerAndNothingOfTheCheckIn', () => {
    const { queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    applyNotificationsChange(queryClient, { unreadCount: 1, type: 'fiscal-document-issued', entityId: 'b-1' });
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([...FISCAL_DOCUMENTS_KEY]);
    expect(keys).toContainEqual([PAYMENTS_KEY]);
    // The summary of the page «Commercialista» counts the documents issued to the guests (E15/F02/US01/T01): an open page reads it again too.
    expect(keys).toContainEqual([ACCOUNTANT_PACKAGE_KEY]);
    // The count of the nights in Ticino at year end is made of the documents issued (E18/F01/US02/T03), and the reads of the year end are under the key of the tourist tax summaries: an open page reads them again too.
    expect(keys).toContainEqual([TOURIST_TAX_SUMMARY_KEY]);
    expect(keys).not.toContainEqual([CHECKIN_SESSION_KEY]);
    expect(keys).not.toContainEqual([VERIFICATION_KEY]);
  });

  it('applyNotificationsChange_FiscalDocumentIssued_AnOpenListAndTheCardOfTheBookingReadTheNewDocumentWithoutAReload', async () => {
    const { queryClient, wrapper } = setup();
    const readList = vi.fn().mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 20 });
    const readCard = vi.fn().mockResolvedValue([]);
    // What the open page of the documents (`useFiscalDocuments`) and the card of the booking (`useBookingFiscalDocuments`) keep mounted.
    renderHook(
      () => [
        useQuery({ queryKey: [...FISCAL_DOCUMENTS_KEY, 'list', {}, 1, 20], queryFn: readList }),
        useQuery({ queryKey: [...FISCAL_DOCUMENTS_KEY, 'booking', 'b-1'], queryFn: readCard }),
      ],
      { wrapper },
    );
    await waitFor(() => expect(readList).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(readCard).toHaveBeenCalledTimes(1));

    act(() => applyNotificationsChange(queryClient, { unreadCount: 1, type: 'fiscal-document-issued', entityId: 'b-1' }));

    await waitFor(() => expect(readList).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(readCard).toHaveBeenCalledTimes(2));
  });

  it.each(['guest-message', 'new-booking', 'guest-checkin-completed'])('applyNotificationsChange_%s_DoesNotReadTheFiscalDocumentsAgain', (type) => {
    const { queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    applyNotificationsChange(queryClient, { unreadCount: 1, type, entityId: 'x-1' });
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).not.toContainEqual([...FISCAL_DOCUMENTS_KEY]);
  });

  it.each(['guest-message', 'new-booking', 'verification-required', 'service-request-taken'])(
    'applyNotificationsChange_%s_DoesNotReadTheStaffQueueAgain',
    (type) => {
      const { queryClient } = setup();
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      applyNotificationsChange(queryClient, { unreadCount: 1, type, entityId: 'x-1' });
      const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
      expect(keys).not.toContainEqual([...ADMIN_ASSIST_KEY]);
    },
  );

  it.each(['guest-message', 'new-booking', 'service-request-taken'])(
    'applyNotificationsChange_%s_DoesNotReadTheVerificationsAgain',
    (type) => {
      const { queryClient } = setup();
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      applyNotificationsChange(queryClient, { unreadCount: 1, type, entityId: 'x-1' });
      const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
      expect(keys).not.toContainEqual([VERIFICATION_KEY]);
    },
  );

  it.each(['guest-message', 'new-booking', 'service-request-taken'])(
    'applyNotificationsChange_%s_DoesNotReadTheCheckInDataAgain',
    (type) => {
      const { queryClient } = setup();
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      applyNotificationsChange(queryClient, { unreadCount: 1, type, entityId: 'x-1' });
      const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
      expect(keys).not.toContainEqual([BOOKINGS_KEY]);
      expect(keys).not.toContainEqual([CHECKIN_SESSION_KEY]);
      expect(keys).not.toContainEqual([CHECKIN_LINK_DELIVERY_KEY]);
      expect(keys).not.toContainEqual([INVOICE_DATA_KEY]);
    },
  );

  // E23/F01/US01/T01 (NF-122): the automatic delivery of the check-in link of a booking failed for good (the push `checkin-link-failed`, whose entity is the booking). The page of the
  // booking that is open shows where the link stands and «Copia link», and the «To do» list the item that asks the host to carry the link, without a reload.
  it('applyNotificationsChange_CheckInLinkFailed_ReadsAgainWhereTheLinkStandsTheSessionTheBookingAndTheTodoListAndNothingElseOfTheCheckIn', () => {
    const { queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    applyNotificationsChange(queryClient, { unreadCount: 1, type: 'checkin-link-failed', entityId: 'b-1' });
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    for (const root of [CHECKIN_LINK_DELIVERY_KEY, CHECKIN_SESSION_KEY, BOOKINGS_KEY, INTERNAL_ACTIVITIES_KEY]) expect(keys, root).toContainEqual([root]);
    // The entity is a booking, as for any booking event.
    expect(keys).toContainEqual([BOOKING_THREAD_QUERY, 'b-1']);
    // No guest completed anything: the guests of the stay, the invoice data and the cockpit are not read again.
    for (const root of [ALLOGGIATI_KEY, COMPLIANCE_KEY, INVOICE_DATA_KEY]) expect(keys, root).not.toContainEqual([root]);
  });

  it('applyNotificationsChange_CheckInLinkFailed_AnOpenGuestPanelReadsWhereTheLinkStandsAgainWithoutAReload', async () => {
    const { queryClient, wrapper } = setup();
    const readDelivery = vi.fn().mockResolvedValue({ channel: 'PortalChat', state: 'Sending', attempts: 1, ended: false });
    // What the open guest tab of booking b-1 keeps mounted (`useCheckInLinkDelivery`).
    renderHook(() => useQuery({ queryKey: [CHECKIN_LINK_DELIVERY_KEY, 'b-1'], queryFn: readDelivery }), { wrapper });
    await waitFor(() => expect(readDelivery).toHaveBeenCalledTimes(1));

    act(() => applyNotificationsChange(queryClient, { unreadCount: 1, type: 'checkin-link-failed', entityId: 'b-1' }));

    await waitFor(() => expect(readDelivery).toHaveBeenCalledTimes(2));
  });

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
