import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { messageHubApi } from '@/api/message-hub.api';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { MESSAGE_HUB_QUERY } from '@/queries/use-message-hub';
import type { MessageChannelStatus, MessageChannelStatusItem, MessageHubPage } from '@/types';
import { InboxPage } from '../inbox-page';

vi.mock('@/api/message-hub.api', () => ({
  messageHubApi: { list: vi.fn(), unread: vi.fn(), getChannelStatus: vi.fn(), getContactOptions: vi.fn(), startConversation: vi.fn() },
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ hasPermission: () => true }) }));
vi.mock('@/queries/use-properties', () => ({ useProperties: () => ({ data: [] }) }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));

const EMPTY: MessageHubPage = { items: [], totalCount: 0, page: 1, pageSize: 20 };

function listing(propertyName: string, status: MessageChannelStatusItem['status'], index: number): MessageChannelStatusItem {
  return { propertyId: `00000000-0000-4000-8000-00000000000${index}`, propertyName, status, lastCheckedAt: '2026-11-14T08:00:00Z' };
}

function renderInbox(flags: Partial<FeatureFlags> = { octorateConnector: true }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const value = { flags: { ...DEFAULT_FEATURE_FLAGS, ...flags }, isLoading: false };
  const view = render(
    <QueryClientProvider client={client}>
      <FeatureFlagsContext.Provider value={value}>
        <MemoryRouter initialEntries={['/app/short-rent/messages']}>
          <InboxPage />
        </MemoryRouter>
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );
  return { ...view, client };
}

async function statusDrawn() {
  await waitFor(() => expect(messageHubApi.getChannelStatus).toHaveBeenCalled());
  await act(async () => {
    await vi.mocked(messageHubApi.getChannelStatus).mock.results[0]?.value.catch(() => undefined);
  });
  await act(async () => {});
}

describe('InboxPage: the listings whose chat is not active yet (E23/F01/US02, NF-61)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(messageHubApi.list).mockResolvedValue(EMPTY);
    vi.mocked(messageHubApi.unread).mockResolvedValue({ items: [] });
    await i18n.changeLanguage('it');
  });
  afterEach(() => cleanup());

  it('InboxPage_SomeListingsWaitForTheChat_SaysHowManyWithOneLineAndWhich', async () => {
    const status: MessageChannelStatus = {
      items: [listing('Casa Lago', 'available', 1), listing('Casa Mare', 'waiting_permission', 2), listing('Casa Monti', 'waiting_permission', 3), listing('Casa Sole', 'error', 4)],
    };
    vi.mocked(messageHubApi.getChannelStatus).mockResolvedValue(status);
    renderInbox();

    const banner = await screen.findByTestId('chat-availability-banner');
    expect(banner).toHaveTextContent('Per 2 annunci la chat dei portali non è ancora attiva');
    expect(banner).toHaveTextContent('per attivarla devi dare il permesso alla chat nel tuo channel manager');
    const names = within(screen.getByTestId('chat-availability-listings')).getAllByTestId('chat-availability-listing').map((item) => item.textContent);
    expect(names).toEqual(['Casa Mare', 'Casa Monti']);
    expect(banner.textContent).not.toMatch(/octorate/i);
    expect(await screen.findByTestId('chat-error')).toHaveTextContent('Casa Sole');
  });

  it('InboxPage_OneListingWaitsForTheChat_SaysItInTheSingular', async () => {
    vi.mocked(messageHubApi.getChannelStatus).mockResolvedValue({ items: [listing('Casa Mare', 'waiting_permission', 1)] });
    renderInbox();

    expect(await screen.findByTestId('chat-availability-banner')).toHaveTextContent('Per 1 annuncio la chat del portale non è ancora attiva');
  });

  it('InboxPage_InEnglish_SaysItInEnglish', async () => {
    await i18n.changeLanguage('en');
    vi.mocked(messageHubApi.getChannelStatus).mockResolvedValue({ items: [listing('Casa Mare', 'waiting_permission', 1), listing('Casa Monti', 'waiting_permission', 2)] });
    renderInbox();

    expect(await screen.findByTestId('chat-availability-banner')).toHaveTextContent('For 2 listings the portal chats are not active yet');
    await i18n.changeLanguage('it');
  });

  it.each([
    ['every chat works', [listing('Casa Lago', 'available', 1)]],
    ['no listing is confirmed yet', []],
  ])('InboxPage_%s_ShowsNoBanner', async (_case, items) => {
    vi.mocked(messageHubApi.getChannelStatus).mockResolvedValue({ items });
    renderInbox();

    await screen.findByTestId('messages-inbox');
    await statusDrawn();
    expect(screen.queryByTestId('chat-availability-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chat-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chat-pending_sync')).not.toBeInTheDocument();
  });

  it('explains which listings are awaiting a first sync', async () => {
    vi.mocked(messageHubApi.getChannelStatus).mockResolvedValue({ items: [listing('Casa Mare', 'pending_sync', 1)] });
    renderInbox();

    const notice = await screen.findByTestId('chat-pending_sync');
    expect(notice).toHaveTextContent('1 annuncio in attesa della prima sincronizzazione');
    expect(notice).toHaveTextContent('Casa Mare');
  });

  it('InboxPage_StateOfTheChatsCannotBeRead_ShowsNoBannerAndTheInboxStillWorks', async () => {
    vi.mocked(messageHubApi.getChannelStatus).mockRejectedValue(new Error('boom'));
    renderInbox();

    await screen.findByTestId('messages-inbox');
    await statusDrawn();
    expect(screen.queryByTestId('chat-availability-banner')).not.toBeInTheDocument();
    expect(await screen.findByText('Nessun messaggio a cui rispondere')).toBeInTheDocument();
  });

  it('InboxPage_StateOfTheChatsFailsToBeReadAfterAnAnswer_TakesTheBannerAwayAndShowsItAgainWhenAReadWorks', async () => {
    vi.mocked(messageHubApi.getChannelStatus)
      .mockResolvedValueOnce({ items: [listing('Casa Mare', 'waiting_permission', 1)] })
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({ items: [listing('Casa Mare', 'waiting_permission', 1)] });
    const { client } = renderInbox();
    expect(await screen.findByTestId('chat-availability-banner')).toBeInTheDocument();

    await act(async () => {
      await client.invalidateQueries({ queryKey: [MESSAGE_HUB_QUERY, 'channel-status'] });
    });
    await waitFor(() => expect(screen.queryByTestId('chat-availability-banner')).not.toBeInTheDocument());

    await act(async () => {
      await client.invalidateQueries({ queryKey: [MESSAGE_HUB_QUERY, 'channel-status'] });
    });
    expect(await screen.findByTestId('chat-availability-banner')).toBeInTheDocument();
  });

  it('InboxPage_NoConnectionToTheChannels_AsksNothingOfTheChatsAndShowsNoBanner', async () => {
    vi.mocked(messageHubApi.getChannelStatus).mockResolvedValue({ items: [listing('Casa Mare', 'waiting_permission', 1)] });
    renderInbox({ octorateConnector: false });

    expect(await screen.findByText('Nessun messaggio a cui rispondere')).toBeInTheDocument();
    expect(messageHubApi.getChannelStatus).not.toHaveBeenCalled();
    expect(screen.queryByTestId('chat-availability-banner')).not.toBeInTheDocument();
  });

  it('InboxPage_AnAnswerThatIsNotTheShapeOfTheApi_ShowsNoBanner', async () => {
    vi.mocked(messageHubApi.getChannelStatus).mockResolvedValue('<!doctype html>' as never);
    renderInbox();

    await screen.findByTestId('messages-inbox');
    await statusDrawn();
    expect(screen.queryByTestId('chat-availability-banner')).not.toBeInTheDocument();
  });
});
