import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, type AxiosResponse } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { SiteConnectionsApi } from '@/api/site-connections.api';
import { formatDate } from '@/lib/utils';
import type { SiteConnection } from '@/types/site-connection.types';
import { EmbedConnectedSites } from '../embed-connected-sites';

vi.mock('@/api/site-connections.api', () => ({ SiteConnectionsApi: { list: vi.fn(), revoke: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

// Midday in UTC: the same day in every time zone, so the dates the page writes can be told exactly.
const QUOKKA: SiteConnection = { id: 'c1', siteUrl: 'https://www.quokka360.test', createdAt: '2026-11-20T12:00:00Z', lastUsedAt: '2026-11-26T12:00:00Z' };
const BLOG: SiteConnection = { id: 'c2', siteUrl: 'https://blog.quokka360.test', createdAt: '2026-11-25T12:00:00Z', lastUsedAt: null };

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

function view(client: QueryClient, wrap: (node: React.ReactNode) => React.ReactNode = (node) => node) {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>{wrap(<EmbedConnectedSites orgId="org-1" />)}</QueryClientProvider>
    </I18nextProvider>
  );
}

const renderBlock = (client = newClient(), wrap?: (node: React.ReactNode) => React.ReactNode) => render(view(client, wrap));

function problem(status: number, data: Record<string, unknown>) {
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, undefined, undefined, { status, statusText: 'Error', headers: {}, config: {}, data } as unknown as AxiosResponse);
}

const rows = () => screen.queryAllByTestId('embed-site');
const rowOf = (id: string) => {
  const row = rows().find((candidate) => candidate.getAttribute('data-site-id') === id);
  if (!row) throw new Error(`no row for ${id}`);
  return row;
};
const dialog = () => screen.getByRole('dialog');

describe('EmbedConnectedSites (PLG-FE-CONSOLE, NF-203)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    vi.mocked(SiteConnectionsApi.list).mockResolvedValue([QUOKKA, BLOG]);
    vi.mocked(SiteConnectionsApi.revoke).mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await act(async () => undefined);
    cleanup();
    vi.clearAllMocks();
  });

  describe('what it shows', () => {
    it('sites_NoneConnected_SaysSo', async () => {
      vi.mocked(SiteConnectionsApi.list).mockResolvedValue([]);
      renderBlock();

      expect(await screen.findByTestId('embed-sites-empty')).toHaveTextContent('Nessun sito collegato');
      expect(rows()).toHaveLength(0);
    });

    it('sites_Rows_ShowTheAddressTheDateAndTheLastUse', async () => {
      renderBlock();

      await waitFor(() => expect(rows()).toHaveLength(2));
      expect(SiteConnectionsApi.list).toHaveBeenCalledWith('org-1');
      expect(within(rowOf('c1')).getByTestId('embed-site-address')).toHaveTextContent('https://www.quokka360.test');
      expect(within(rowOf('c1')).getByTestId('embed-site-dates')).toHaveTextContent(
        `${i18n.t('embed.settings.sites.linked', { date: formatDate(QUOKKA.createdAt) })} · ${i18n.t('embed.settings.sites.lastUsed', { date: formatDate(QUOKKA.lastUsedAt!) })}`,
      );
      // A site that was never used says so, it does not show an empty date.
      expect(within(rowOf('c2')).getByTestId('embed-site-dates')).toHaveTextContent(i18n.t('embed.settings.sites.lastUsedNever'));
      expect(screen.queryByTestId('embed-sites-empty')).not.toBeInTheDocument();
    });

    it('sites_Loading_ShowsAPlaceholder_NotTheEmptyState', () => {
      vi.mocked(SiteConnectionsApi.list).mockReturnValue(new Promise(() => undefined));
      renderBlock();

      expect(screen.getByTestId('embed-sites-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('embed-sites-empty')).not.toBeInTheDocument();
    });

    it('sites_ReadFails_ShowsTheErrorWithRetry_AndNoRows', async () => {
      vi.mocked(SiteConnectionsApi.list).mockRejectedValueOnce(problem(500, {})).mockResolvedValueOnce([QUOKKA]);
      renderBlock();

      const alert = await screen.findByTestId('embed-sites-error');
      expect(alert).toHaveTextContent(i18n.t('embed.settings.sites.loadError'));
      expect(screen.queryByTestId('embed-sites-empty')).not.toBeInTheDocument();

      fireEvent.click(within(alert).getByRole('button', { name: i18n.t('embed.settings.retry') }));

      await waitFor(() => expect(rows()).toHaveLength(1));
      expect(screen.queryByTestId('embed-sites-error')).not.toBeInTheDocument();
    });

    it('sites_ALaterReadThatIsRefused404_NeverShowsTheRowsOfTheEarlierRead', async () => {
      // TanStack Query keeps the data of the last good read when a later one fails: the block says the list could not be read, it does not show a connection that may be gone.
      const client = newClient();
      renderBlock(client);
      await waitFor(() => expect(rows()).toHaveLength(2));

      vi.mocked(SiteConnectionsApi.list).mockRejectedValue(problem(404, { code: 'not_found' }));
      await act(async () => {
        await client.invalidateQueries({ queryKey: ['site-connections'] });
      });

      expect(await screen.findByTestId('embed-sites-error')).toBeInTheDocument();
      expect(rows()).toHaveLength(0);
    });

    it('sites_AnotherVisit_ReadsTheListAgain', async () => {
      // A site connects from WordPress without this page doing anything: the list is not served from the cache of an earlier visit.
      const client = newClient();
      const first = renderBlock(client);
      await waitFor(() => expect(rows()).toHaveLength(2));
      first.unmount();

      vi.mocked(SiteConnectionsApi.list).mockResolvedValue([QUOKKA]);
      renderBlock(client);

      await waitFor(() => expect(rows()).toHaveLength(1));
      expect(SiteConnectionsApi.list).toHaveBeenCalledTimes(2);
    });

    it('sites_ItIsAQuietBlock_NoCountersNoFiltersAndNoForm', async () => {
      const { container } = renderBlock();
      await waitFor(() => expect(rows()).toHaveLength(2));

      expect(container.querySelector('form')).toBeNull();
      expect(screen.getAllByRole('heading')).toHaveLength(1);
      expect(screen.getByRole('heading')).toHaveTextContent('Siti collegati');
    });
  });

  describe('«Scollega»', () => {
    it('revoke_AsksFirst_NothingGoesOutUntilTheAnswer', async () => {
      renderBlock();
      await waitFor(() => expect(rows()).toHaveLength(2));

      fireEvent.click(within(rowOf('c1')).getByTestId('embed-site-revoke'));

      expect(dialog()).toHaveTextContent(i18n.t('embed.settings.sites.revokeConfirm.title', { site: 'https://www.quokka360.test' }));
      expect(dialog()).toHaveTextContent(i18n.t('embed.settings.sites.revokeConfirm.description'));
      expect(SiteConnectionsApi.revoke).not.toHaveBeenCalled();

      // «Annulla»: nothing is revoked, and the row stays.
      fireEvent.click(within(dialog()).getByRole('button', { name: i18n.t('shared.cancel') }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(SiteConnectionsApi.revoke).not.toHaveBeenCalled();
      expect(rows()).toHaveLength(2);
    });

    it('revoke_Confirmed_RevokesThatConnectionAndReadsTheListAgain', async () => {
      renderBlock();
      await waitFor(() => expect(rows()).toHaveLength(2));
      vi.mocked(SiteConnectionsApi.list).mockResolvedValue([BLOG]);

      fireEvent.click(within(rowOf('c1')).getByTestId('embed-site-revoke'));
      fireEvent.click(within(dialog()).getByRole('button', { name: i18n.t('embed.settings.sites.revokeConfirm.confirm') }));

      await waitFor(() => expect(SiteConnectionsApi.revoke).toHaveBeenCalledWith('org-1', 'c1'));
      expect(SiteConnectionsApi.revoke).toHaveBeenCalledTimes(1);
      // The list is the server's: the row of the connection that was revoked goes, the other stays.
      await waitFor(() => expect(rows().map((row) => row.getAttribute('data-site-id'))).toEqual(['c2']));
      expect(SiteConnectionsApi.list).toHaveBeenCalledTimes(2);
      expect(toast.success).toHaveBeenCalledWith(i18n.t('embed.settings.sites.revoked'));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('revoke_TheLastOne_LeavesTheEmptyState', async () => {
      vi.mocked(SiteConnectionsApi.list).mockResolvedValue([BLOG]);
      renderBlock();
      await waitFor(() => expect(rows()).toHaveLength(1));
      vi.mocked(SiteConnectionsApi.list).mockResolvedValue([]);

      fireEvent.click(screen.getByTestId('embed-site-revoke'));
      fireEvent.click(within(dialog()).getByRole('button', { name: i18n.t('embed.settings.sites.revokeConfirm.confirm') }));

      expect(await screen.findByTestId('embed-sites-empty')).toHaveTextContent('Nessun sito collegato');
    });

    it('revoke_TheConfirmationDoesNotSubmitAFormAroundIt', async () => {
      // A ConfirmationDialog inside a form submits it (the events of a portal reach the parents): this one is confirmed and the form around it never hears.
      const submitted = vi.fn((event: React.FormEvent) => event.preventDefault());
      renderBlock(newClient(), (node) => <form onSubmit={submitted}>{node}</form>);
      await waitFor(() => expect(rows()).toHaveLength(2));

      fireEvent.click(within(rowOf('c1')).getByTestId('embed-site-revoke'));
      fireEvent.click(within(dialog()).getByRole('button', { name: i18n.t('embed.settings.sites.revokeConfirm.confirm') }));

      await waitFor(() => expect(SiteConnectionsApi.revoke).toHaveBeenCalledTimes(1));
      expect(submitted).not.toHaveBeenCalled();
    });

    it('revoke_WhileOneIsOnItsWay_EveryButtonIsOff_AndItGoesOutOnce', async () => {
      let answer!: () => void;
      vi.mocked(SiteConnectionsApi.revoke).mockReturnValue(
        new Promise<void>((resolve) => {
          answer = resolve;
        }),
      );
      renderBlock();
      await waitFor(() => expect(rows()).toHaveLength(2));

      fireEvent.click(within(rowOf('c1')).getByTestId('embed-site-revoke'));
      const confirm = within(dialog()).getByRole('button', { name: i18n.t('embed.settings.sites.revokeConfirm.confirm') });
      fireEvent.click(confirm);

      // Every «Scollega» of the block is off while one is on its way, the one of the other row too, and so is the confirmation.
      await waitFor(() => expect(confirm).toBeDisabled());
      for (const button of screen.getAllByTestId('embed-site-revoke')) expect(button).toBeDisabled();
      fireEvent.click(confirm);
      fireEvent.submit(confirm.closest('form')!);
      expect(SiteConnectionsApi.revoke).toHaveBeenCalledTimes(1);

      vi.mocked(SiteConnectionsApi.list).mockResolvedValue([BLOG]);
      await act(async () => answer());
      await waitFor(() => expect(rows()).toHaveLength(1));
      await waitFor(() => expect(screen.getByTestId('embed-site-revoke')).toBeEnabled());
    });

    it('revoke_Fails_SaysSoAndKeepsTheRow', async () => {
      vi.mocked(SiteConnectionsApi.revoke).mockRejectedValue(problem(500, {}));
      renderBlock();
      await waitFor(() => expect(rows()).toHaveLength(2));

      fireEvent.click(within(rowOf('c1')).getByTestId('embed-site-revoke'));
      fireEvent.click(within(dialog()).getByRole('button', { name: i18n.t('embed.settings.sites.revokeConfirm.confirm') }));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('embed.settings.sites.revokeFailed')));
      expect(toast.success).not.toHaveBeenCalled();
      // The list is read again whatever the answer, and the connection that could not be revoked is still on it.
      await waitFor(() => expect(SiteConnectionsApi.list).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(rows()).toHaveLength(2));
      await waitFor(() => expect(within(rowOf('c1')).getByTestId('embed-site-revoke')).toBeEnabled());
    });

    it('revoke_AConnectionThatIsNotThereAnyMore404_UsesTheWordsOfItsCode_AndReadsTheListAgain', async () => {
      vi.mocked(SiteConnectionsApi.revoke).mockRejectedValue(problem(404, { code: 'site_connection_not_found' }));
      renderBlock();
      await waitFor(() => expect(rows()).toHaveLength(2));
      vi.mocked(SiteConnectionsApi.list).mockResolvedValue([BLOG]);

      fireEvent.click(within(rowOf('c1')).getByTestId('embed-site-revoke'));
      fireEvent.click(within(dialog()).getByRole('button', { name: i18n.t('embed.settings.sites.revokeConfirm.confirm') }));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('apiErrors.codes.siteConnectionNotFound')));
      await waitFor(() => expect(rows().map((row) => row.getAttribute('data-site-id'))).toEqual(['c2']));
    });

    it('revoke_TheRowIsGone_TheFocusGoesToTheTitleOfTheBlock', async () => {
      renderBlock();
      await waitFor(() => expect(rows()).toHaveLength(2));
      vi.mocked(SiteConnectionsApi.list).mockResolvedValue([BLOG]);

      fireEvent.click(within(rowOf('c1')).getByTestId('embed-site-revoke'));
      fireEvent.click(within(dialog()).getByRole('button', { name: i18n.t('embed.settings.sites.revokeConfirm.confirm') }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      await waitFor(() => expect(screen.getByRole('heading', { name: i18n.t('embed.settings.sites.title') })).toHaveFocus());
    });

    it('revoke_TheButtonOfARow_NamesItsSiteForAScreenReader', async () => {
      renderBlock();
      await waitFor(() => expect(rows()).toHaveLength(2));

      expect(within(rowOf('c1')).getByRole('button', { name: 'Scollega https://www.quokka360.test' })).toBeInTheDocument();
      expect(within(rowOf('c2')).getByRole('button', { name: 'Scollega https://blog.quokka360.test' })).toBeInTheDocument();
    });
  });

  describe('in English', () => {
    it('sites_English_EveryTextOfTheBlockIsInEnglish', async () => {
      await i18n.changeLanguage('en');
      renderBlock();

      await waitFor(() => expect(rows()).toHaveLength(2));
      expect(screen.getByRole('heading')).toHaveTextContent('Connected sites');
      expect(within(rowOf('c2')).getByTestId('embed-site-dates')).toHaveTextContent('Never used');
      expect(within(rowOf('c1')).getByRole('button', { name: 'Disconnect https://www.quokka360.test' })).toBeInTheDocument();
      await i18n.changeLanguage('it');
    });
  });
});
