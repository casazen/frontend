import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import { notificationsApi, type InAppNotification } from '@/api/notifications.api';
import { AppShellContext } from '@/components/layout/app-shell-context';
import type { AppContextKey } from '@/config/route-manifest';
import { UNREAD_COUNT_KEY } from '@/queries/use-notifications';
import { NotificationBell } from '../notification-bell';

const auth = vi.hoisted(() => ({
  value: { isAuthenticated: true, kind: 'auth0', user: { sub: 'auth0|u1' }, getAccessToken: async () => 'token' } as Record<string, unknown>,
}));
const realtime = vi.hoisted(() => ({ state: 'connected' as 'connected' | 'connecting' | 'disconnected' }));

vi.mock('@/hooks/use-auth', () => ({ useAuth: () => auth.value }));
vi.mock('../use-notifications-realtime', () => ({ useNotificationsRealtime: () => realtime.state }));
vi.mock('@/api/notifications.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/notifications.api')>()),
  notificationsApi: { list: vi.fn(), unreadCount: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn() },
}));

const NOW = new Date().toISOString();
const note = (id: string, type: string, entityId: string | null, readAt: string | null = null): InAppNotification => ({ id, type, entityId, createdAt: NOW, readAt });

function Where() {
  const location = useLocation();
  return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
}

function renderBell(context: AppContextKey = 'short-rent') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/short-rent']}>
        <AppShellContext.Provider value={{ contextKey: context }}>
          <NotificationBell />
          <Where />
        </AppShellContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { client, ...view };
}

describe('NotificationBell (UI-12)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    realtime.state = 'connected';
    auth.value = { isAuthenticated: true, kind: 'auth0', user: { sub: 'auth0|u1' }, getAccessToken: async () => 'token' };
    vi.mocked(notificationsApi.unreadCount).mockResolvedValue({ count: 3 });
    vi.mocked(notificationsApi.markRead).mockResolvedValue(undefined);
    vi.mocked(notificationsApi.markAllRead).mockResolvedValue(undefined);
    vi.mocked(notificationsApi.list).mockResolvedValue({
      items: [note('n1', 'guest-message', 'b-1'), note('n2', 'service-request-taken', 'sr-1'), note('n3', 'new-booking', 'b-2', NOW), note('n4', 'brand-new', 'x')],
      totalCount: 4,
      page: 1,
      pageSize: 20,
    });
    await i18n.changeLanguage('it');
  });

  afterEach(() => cleanup());

  it('NotificationBell_SignedOutOrNotAuth0_RendersNothingAndAsksNothing', () => {
    auth.value = { isAuthenticated: false, kind: 'auth0', user: undefined, getAccessToken: async () => undefined };
    const { container } = renderBell();
    expect(container.querySelector('[data-testid="notification-bell"]')).toBeNull();
    expect(notificationsApi.unreadCount).not.toHaveBeenCalled();

    cleanup();
    auth.value = { isAuthenticated: true, kind: 'anonymous', user: undefined, getAccessToken: async () => undefined };
    renderBell();
    expect(screen.queryByTestId('notification-bell')).not.toBeInTheDocument();
  });

  it('NotificationBell_UnreadNotifications_ShowsTheCountInTheBadgeAndInTheName', async () => {
    renderBell();
    expect(await screen.findByRole('button', { name: 'Notifiche, 3 da leggere' })).toBeInTheDocument();
    expect(screen.getByTestId('notification-badge')).toHaveTextContent('3');
  });

  it('NotificationBell_NothingUnread_HasNoBadge', async () => {
    vi.mocked(notificationsApi.unreadCount).mockResolvedValue({ count: 0 });
    renderBell();
    expect(await screen.findByRole('button', { name: 'Notifiche' })).toBeInTheDocument();
    await waitFor(() => expect(notificationsApi.unreadCount).toHaveBeenCalled());
    expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
  });

  it('NotificationBell_MoreThan99_CapsTheBadgeButNotTheName', async () => {
    vi.mocked(notificationsApi.unreadCount).mockResolvedValue({ count: 250 });
    renderBell();
    expect(await screen.findByRole('button', { name: 'Notifiche, 250 da leggere' })).toBeInTheDocument();
    expect(screen.getByTestId('notification-badge')).toHaveTextContent('99+');
  });

  it('NotificationBell_Opened_ListsTheNotificationsWithASentenceEachAndTheUnreadDot', async () => {
    renderBell();
    fireEvent.click(await screen.findByTestId('notification-bell'));

    const rows = await screen.findAllByTestId('notification-row');
    expect(rows).toHaveLength(4);
    expect(within(rows[0]).getByText('Un ospite ti ha scritto un messaggio.')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Da leggere')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Un fornitore ha preso in carico la tua richiesta.')).toBeInTheDocument();
    expect(within(rows[2]).queryByText('Da leggere')).not.toBeInTheDocument();
    expect(within(rows[3]).getByText('Hai una nuova notifica.')).toBeInTheDocument();
  });

  it('NotificationBell_English_ShowsTheSentencesInEnglish', async () => {
    await i18n.changeLanguage('en');
    renderBell();
    fireEvent.click(await screen.findByTestId('notification-bell'));
    expect(await screen.findByText('A guest sent you a message.')).toBeInTheDocument();
  });

  it('NotificationBell_ClickOnAGuestMessage_MarksItReadAndOpensTheMessagesOfTheBooking', async () => {
    renderBell();
    fireEvent.click(await screen.findByTestId('notification-bell'));
    fireEvent.click((await screen.findAllByTestId('notification-row'))[0]);

    await waitFor(() => expect(notificationsApi.markRead).toHaveBeenCalledWith('n1'));
    expect(screen.getByTestId('where')).toHaveTextContent('/app/short-rent/bookings/b-1?tab=messages');
    expect(screen.queryByTestId('notification-panel')).not.toBeInTheDocument();
  });

  it('NotificationBell_ClickOnAReadOne_NavigatesWithoutMarkingAgain', async () => {
    renderBell();
    fireEvent.click(await screen.findByTestId('notification-bell'));
    fireEvent.click((await screen.findAllByTestId('notification-row'))[2]);

    expect(screen.getByTestId('where')).toHaveTextContent('/app/short-rent/bookings/b-2');
    expect(notificationsApi.markRead).not.toHaveBeenCalled();
  });

  it('NotificationBell_ServiceRequestForASupplier_OpensTheRequestInTheInbox', async () => {
    renderBell('supplier');
    fireEvent.click(await screen.findByTestId('notification-bell'));
    fireEvent.click((await screen.findAllByTestId('notification-row'))[1]);
    expect(screen.getByTestId('where')).toHaveTextContent('/app/supplier/inbox/sr-1');
  });

  it('NotificationBell_UnknownType_MarksItReadAndStaysWhereItIs', async () => {
    renderBell();
    fireEvent.click(await screen.findByTestId('notification-bell'));
    fireEvent.click((await screen.findAllByTestId('notification-row'))[3]);
    await waitFor(() => expect(notificationsApi.markRead).toHaveBeenCalledWith('n4'));
    expect(screen.getByTestId('where')).toHaveTextContent('/app/short-rent');
    expect(screen.getByTestId('where')).not.toHaveTextContent('bookings');
  });

  it('NotificationBell_MarkAll_CallsTheApiAndEmptiesTheBadge', async () => {
    const { client } = renderBell();
    fireEvent.click(await screen.findByTestId('notification-bell'));
    vi.mocked(notificationsApi.unreadCount).mockResolvedValue({ count: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Segna tutte come lette' }));

    await waitFor(() => expect(notificationsApi.markAllRead).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(client.getQueryData(UNREAD_COUNT_KEY)).toBe(0));
    await waitFor(() => expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument());
  });

  it('NotificationBell_MoreOnTheServer_LoadsTheNextPage', async () => {
    vi.mocked(notificationsApi.list)
      .mockResolvedValueOnce({ items: [note('n1', 'new-booking', 'b-1')], totalCount: 2, page: 1, pageSize: 1 })
      .mockResolvedValueOnce({ items: [note('n2', 'guest-message', 'b-2')], totalCount: 2, page: 2, pageSize: 1 });
    renderBell();
    fireEvent.click(await screen.findByTestId('notification-bell'));
    fireEvent.click(await screen.findByTestId('notifications-load-more'));

    await waitFor(() => expect(screen.getAllByTestId('notification-row')).toHaveLength(2));
    expect(notificationsApi.list).toHaveBeenLastCalledWith({ page: 2, pageSize: 20 });
    expect(screen.queryByTestId('notifications-load-more')).not.toBeInTheDocument();
  });

  it('NotificationBell_NoNotifications_SaysSo', async () => {
    vi.mocked(notificationsApi.list).mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 20 });
    renderBell();
    fireEvent.click(await screen.findByTestId('notification-bell'));
    expect(await screen.findByTestId('notifications-empty')).toBeInTheDocument();
  });

  it('NotificationBell_ListFails_ShowsAnErrorWithRetry', async () => {
    vi.mocked(notificationsApi.list).mockRejectedValueOnce(new Error('boom'));
    renderBell();
    fireEvent.click(await screen.findByTestId('notification-bell'));
    expect(await screen.findByText('Non riusciamo a caricare le notifiche.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(await screen.findAllByTestId('notification-row')).toHaveLength(4);
  });

  it('NotificationBell_CountGrows_AnnouncesItInAPoliteLiveRegionButNotOnLoad', async () => {
    const { client } = renderBell();
    await screen.findByRole('button', { name: 'Notifiche, 3 da leggere' });
    const live = screen.getByTestId('notifications-live');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveTextContent('');

    client.setQueryData(UNREAD_COUNT_KEY, 5);
    await waitFor(() => expect(live).toHaveTextContent('5 notifiche da leggere'));
  });

  it('NotificationBell_SocketDown_PollsTheCountEveryMinute', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      realtime.state = 'disconnected';
      renderBell();
      await screen.findByTestId('notification-bell');
      const calls = vi.mocked(notificationsApi.unreadCount).mock.calls.length;
      await vi.advanceTimersByTimeAsync(60_500);
      expect(vi.mocked(notificationsApi.unreadCount).mock.calls.length).toBeGreaterThan(calls);
    } finally {
      vi.useRealTimers();
    }
  });

  it('NotificationBell_SocketUp_DoesNotPoll', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      realtime.state = 'connected';
      renderBell();
      await screen.findByTestId('notification-bell');
      const calls = vi.mocked(notificationsApi.unreadCount).mock.calls.length;
      await vi.advanceTimersByTimeAsync(180_000);
      expect(vi.mocked(notificationsApi.unreadCount).mock.calls.length).toBe(calls);
    } finally {
      vi.useRealTimers();
    }
  });

  it('NotificationBell_Keyboard_OpensWithEnterAndClosesWithEscape', async () => {
    renderBell();
    const bell = await screen.findByTestId('notification-bell');
    bell.focus();
    fireEvent.click(bell);
    expect(await screen.findByTestId('notification-panel')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId('notification-panel'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('notification-panel')).not.toBeInTheDocument());
  });
});
