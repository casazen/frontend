import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, AxiosHeaders } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { OrgsApi } from '@/api/orgs.api';
import type { AppContextKey } from '@/config/route-manifest';
import { useWorkspace } from '@/hooks/use-workspace';
import * as userQueries from '@/queries/use-users';
import { MEMBER_ROLE_KEYS, contextOf } from '@/test/org-contexts';
import type { OrgSiteDocumentKind, OrgSiteDocumentState, OrgSiteDocumentVersion } from '@/types';
import { SiteDocumentsPage } from '../site-documents-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/orgs.api', () => ({
  OrgsApi: {
    getSiteDocuments: vi.fn(),
    getSiteDocumentVersion: vi.fn(),
    publishSiteDocument: vi.fn(),
    withdrawSiteDocument: vi.fn(),
  },
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: vi.fn() }));
vi.mock('@/queries/use-users', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/queries/use-users')>();
  return { ...actual, useCurrentUser: vi.fn() };
});
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

type CurrentUserResult = ReturnType<typeof userQueries.useCurrentUser>;
type WorkspaceResult = ReturnType<typeof useWorkspace>;

const PAGE_PATH = '/app/short-rent/settings/site-documents';

function version(overrides: Partial<OrgSiteDocumentVersion> = {}): OrgSiteDocumentVersion {
  return {
    version: 1,
    source: 'Text',
    content: 'Testo della versione',
    externalUrl: null,
    publishedAt: '2026-10-01T09:30:00Z',
    withdrawnAt: null,
    ...overrides,
  };
}

function state(kind: OrgSiteDocumentKind, overrides: Partial<OrgSiteDocumentState> = {}): OrgSiteDocumentState {
  return { kind, published: false, current: null, history: [], ...overrides };
}

function publishedState(kind: OrgSiteDocumentKind, current: OrgSiteDocumentVersion, older: OrgSiteDocumentVersion[] = []) {
  return state(kind, {
    published: current.withdrawnAt === null,
    current,
    history: [{ ...current, content: null }, ...older.map((v) => ({ ...v, content: null }))],
  });
}

function problemError(status: number, data: Record<string, unknown> = {}): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data,
  });
}

/** The user's contexts as the API returns them: held as the owner, or with `roleKey` (a member of the org, AM-00). */
function mockContexts(contextKeys: AppContextKey[], roleKey?: string) {
  vi.mocked(useWorkspace).mockReturnValue({
    contexts: contextKeys.map((contextKey) => contextOf(contextKey, roleKey)),
  } as unknown as WorkspaceResult);
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[PAGE_PATH]}>
          <Routes>
            <Route path={PAGE_PATH} element={<SiteDocumentsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

const card = (kind: OrgSiteDocumentKind) => screen.getByTestId(`site-document-${kind}`);

describe('SiteDocumentsPage (BK-14, A3-21)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    mockContexts(['short-rent']);
    vi.mocked(userQueries.useCurrentUser).mockReturnValue({
      user: { orgId: 'org-1' },
      org: { id: 'org-1', name: 'Villa Parco', slug: 'villa-parco', planTier: 'Starter' },
      planTier: 'Starter',
    } as unknown as CurrentUserResult);
    vi.mocked(OrgsApi.getSiteDocuments).mockResolvedValue([state('privacy'), state('terms')]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('SiteDocumentsPage_NotBillingAdmin_ShowsAdminRequiredWithoutCallingTheApi', () => {
    mockContexts(['supplier']);
    renderPage();

    expect(screen.getByTestId('site-documents-admin-required')).toHaveTextContent(i18n.t('siteDocuments.adminRequired'));
    expect(OrgsApi.getSiteDocuments).not.toHaveBeenCalled();
  });

  // AM-00 (S1): a collaborator of the org has the rental context but not the owner's role key.
  it.each(MEMBER_ROLE_KEYS)(
    'SiteDocumentsPage_MemberWithRoleKey_%s_ShowsAdminRequiredWithoutCallingTheApi',
    (roleKey) => {
      mockContexts(['short-rent'], roleKey);
      renderPage();

      expect(screen.getByTestId('site-documents-admin-required')).toHaveTextContent(i18n.t('siteDocuments.adminRequired'));
      expect(OrgsApi.getSiteDocuments).not.toHaveBeenCalled();
      expect(OrgsApi.publishSiteDocument).not.toHaveBeenCalled();
    },
  );

  it('SiteDocumentsPage_WhileLoading_ShowsSkeleton', () => {
    vi.mocked(OrgsApi.getSiteDocuments).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByTestId('site-documents-loading')).toBeInTheDocument();
  });

  it('SiteDocumentsPage_LoadFails_ShowsErrorWithRetryNotEmptyEditors', async () => {
    vi.mocked(OrgsApi.getSiteDocuments)
      .mockRejectedValueOnce(problemError(500))
      .mockResolvedValueOnce([state('privacy'), state('terms')]);
    renderPage();

    expect(await screen.findByTestId('site-documents-error')).toHaveTextContent(i18n.t('siteDocuments.loadError'));
    expect(screen.queryByTestId('site-document-privacy')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.errorFallback.tryAgain') }));
    expect(await screen.findByTestId('site-document-privacy')).toBeInTheDocument();
  });

  it('SiteDocumentsPage_NothingPublished_SaysSoAndStatesWhoIsResponsible', async () => {
    renderPage();

    await screen.findByTestId('site-document-privacy');
    expect(screen.getByTestId('site-documents-responsibility')).toHaveTextContent(i18n.t('siteDocuments.responsibility.body'));
    for (const kind of ['privacy', 'terms'] as const) {
      expect(screen.getByTestId(`site-document-${kind}-status`)).toHaveTextContent(i18n.t('siteDocuments.status.never'));
      expect(within(card(kind)).getByTestId(`site-document-${kind}-publish`)).toHaveTextContent(
        i18n.t('siteDocuments.actions.publishFirst'),
      );
      expect(within(card(kind)).queryByTestId(`site-document-${kind}-withdraw`)).not.toBeInTheDocument();
    }
  });

  it('SiteDocumentsPage_PublishedText_FillsTheEditorAndOffersTheNextVersionOnlyWhenChanged', async () => {
    vi.mocked(OrgsApi.getSiteDocuments).mockResolvedValue([
      publishedState('privacy', version({ version: 2, content: 'Informativa v2' }), [version({ version: 1 })]),
      state('terms'),
    ]);
    renderPage();

    const content = await screen.findByTestId('site-document-privacy-content');
    expect(content).toHaveValue('Informativa v2');
    expect(screen.getByTestId('site-document-privacy-status')).toHaveTextContent(/versione 2/);
    expect(screen.getByTestId('site-document-privacy-publish')).toHaveTextContent(i18n.t('siteDocuments.actions.publishNew'));
    expect(screen.getByTestId('site-document-privacy-publish')).toBeDisabled();
    expect(screen.getByTestId('site-document-privacy-open-public')).toHaveAttribute('href', '/book/villa-parco/privacy');

    fireEvent.change(content, { target: { value: 'Informativa v3' } });
    expect(screen.getByTestId('site-document-privacy-publish')).toBeEnabled();
  });

  it('SiteDocumentsPage_PublishText_SendsTheTextAndShowsTheNewVersion', async () => {
    vi.mocked(OrgsApi.publishSiteDocument).mockResolvedValue(
      publishedState('privacy', version({ version: 1, content: '# Titolare\nVilla Parco' })),
    );
    renderPage();

    const content = await screen.findByTestId('site-document-privacy-content');
    fireEvent.change(content, { target: { value: '# Titolare\nVilla Parco' } });
    fireEvent.click(screen.getByTestId('site-document-privacy-publish'));

    await waitFor(() =>
      expect(OrgsApi.publishSiteDocument).toHaveBeenCalledWith('privacy', { source: 'Text', content: '# Titolare\nVilla Parco' }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('siteDocuments.toasts.published', { version: 1 })));
    expect(await screen.findByTestId('site-document-privacy-history')).toBeInTheDocument();
    expect(screen.getByTestId('site-document-privacy-status')).toHaveTextContent(/Pubblicato/);
  });

  it('SiteDocumentsPage_PublishAddress_SendsTheTrimmedAddress', async () => {
    vi.mocked(OrgsApi.publishSiteDocument).mockResolvedValue(
      publishedState('terms', version({ source: 'ExternalUrl', content: null, externalUrl: 'https://villaparco.test/termini.pdf' })),
    );
    renderPage();

    await screen.findByTestId('site-document-terms');
    fireEvent.click(screen.getByTestId('site-document-terms-source-ExternalUrl'));
    fireEvent.change(screen.getByTestId('site-document-terms-url'), { target: { value: ' https://villaparco.test/termini.pdf ' } });
    fireEvent.click(screen.getByTestId('site-document-terms-publish'));

    await waitFor(() =>
      expect(OrgsApi.publishSiteDocument).toHaveBeenCalledWith('terms', {
        source: 'ExternalUrl',
        externalUrl: 'https://villaparco.test/termini.pdf',
      }),
    );
  });

  it.each([
    ['<script>alert(1)</script>', 'siteDocuments.errors.htmlNotAllowed'],
    ['[x](javascript:alert(1))', 'siteDocuments.errors.linkInvalid'],
    ['   ', 'siteDocuments.errors.contentRequired'],
  ])('SiteDocumentsPage_InvalidText_%j_ShowsTheErrorAndDoesNotCallTheApi', async (text, key) => {
    renderPage();

    fireEvent.change(await screen.findByTestId('site-document-privacy-content'), { target: { value: text } });
    fireEvent.click(screen.getByTestId('site-document-privacy-publish'));

    expect(await screen.findByTestId('site-document-privacy-error')).toHaveTextContent(i18n.t(key));
    expect(OrgsApi.publishSiteDocument).not.toHaveBeenCalled();
  });

  it('SiteDocumentsPage_InvalidAddress_ShowsTheErrorAndDoesNotCallTheApi', async () => {
    renderPage();

    await screen.findByTestId('site-document-privacy');
    fireEvent.click(screen.getByTestId('site-document-privacy-source-ExternalUrl'));
    fireEvent.change(screen.getByTestId('site-document-privacy-url'), { target: { value: 'http://villaparco.test/privacy' } });
    fireEvent.click(screen.getByTestId('site-document-privacy-publish'));

    expect(await screen.findByTestId('site-document-privacy-error')).toHaveTextContent(i18n.t('siteDocuments.errors.urlInvalid'));
    expect(OrgsApi.publishSiteDocument).not.toHaveBeenCalled();
  });

  it('SiteDocumentsPage_TextOverTheLimit_ShowsTheCounterInRedAndRefusesIt', async () => {
    renderPage();

    fireEvent.change(await screen.findByTestId('site-document-privacy-content'), { target: { value: 'a'.repeat(50_001) } });
    expect(screen.getByTestId('site-document-privacy-counter')).toHaveClass('text-destructive');
    fireEvent.click(screen.getByTestId('site-document-privacy-publish'));

    expect(await screen.findByTestId('site-document-privacy-error')).toHaveTextContent(/50\.000/);
    expect(OrgsApi.publishSiteDocument).not.toHaveBeenCalled();
  });

  it('SiteDocumentsPage_ServerRefusesTheText_ShowsTheServerMessageAndKeepsTheText', async () => {
    vi.mocked(OrgsApi.publishSiteDocument).mockRejectedValue(
      problemError(422, { code: 'org_document_html_not_allowed', detail: 'Messaggio del server' }),
    );
    renderPage();

    const content = await screen.findByTestId('site-document-privacy-content');
    fireEvent.change(content, { target: { value: 'Testo valido per il client' } });
    fireEvent.click(screen.getByTestId('site-document-privacy-publish'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Messaggio del server'));
    expect(screen.getByTestId('site-document-privacy-content')).toHaveValue('Testo valido per il client');
  });

  it('SiteDocumentsPage_Withdraw_AsksForConfirmationThenWithdraws', async () => {
    vi.mocked(OrgsApi.getSiteDocuments).mockResolvedValue([
      publishedState('terms', version({ version: 1, content: 'Termini' })),
      state('privacy'),
    ]);
    vi.mocked(OrgsApi.withdrawSiteDocument).mockResolvedValue(
      state('terms', {
        published: false,
        current: version({ version: 1, content: 'Termini', withdrawnAt: '2026-10-02T08:00:00Z' }),
        history: [version({ version: 1, content: null, withdrawnAt: '2026-10-02T08:00:00Z' })],
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByTestId('site-document-terms-withdraw'));
    expect(OrgsApi.withdrawSiteDocument).not.toHaveBeenCalled();
    expect(screen.getByTestId('site-document-terms-withdraw-confirm')).toHaveTextContent(i18n.t('siteDocuments.actions.withdrawConfirm'));

    fireEvent.click(screen.getByTestId('site-document-terms-withdraw-yes'));

    await waitFor(() => expect(OrgsApi.withdrawSiteDocument).toHaveBeenCalledWith('terms'));
    await waitFor(() => expect(screen.getByTestId('site-document-terms-status')).toHaveTextContent(/Ritirato/));
    // The withdrawn text stays in the editor and can be published again.
    expect(screen.getByTestId('site-document-terms-content')).toHaveValue('Termini');
    expect(screen.getByTestId('site-document-terms-publish')).toBeEnabled();
    expect(screen.queryByTestId('site-document-terms-withdraw')).not.toBeInTheDocument();
  });

  it('SiteDocumentsPage_WithdrawCancelled_DoesNotCallTheApi', async () => {
    vi.mocked(OrgsApi.getSiteDocuments).mockResolvedValue([
      publishedState('terms', version({ content: 'Termini' })),
      state('privacy'),
    ]);
    renderPage();

    fireEvent.click(await screen.findByTestId('site-document-terms-withdraw'));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('siteDocuments.actions.withdrawCancel') }));

    expect(screen.queryByTestId('site-document-terms-withdraw-confirm')).not.toBeInTheDocument();
    expect(OrgsApi.withdrawSiteDocument).not.toHaveBeenCalled();
  });

  it('SiteDocumentsPage_History_ListsVersionsAndLoadsAnOlderOneIntoTheEditor', async () => {
    vi.mocked(OrgsApi.getSiteDocuments).mockResolvedValue([
      publishedState('privacy', version({ version: 2, content: 'Seconda' }), [version({ version: 1, content: 'Prima' })]),
      state('terms'),
    ]);
    vi.mocked(OrgsApi.getSiteDocumentVersion).mockResolvedValue(version({ version: 1, content: 'Testo della prima versione' }));
    renderPage();

    const history = await screen.findByTestId('site-document-privacy-history');
    expect(within(history).getAllByRole('listitem')).toHaveLength(2);
    // The current version has no "use as base": it is already in the editor.
    expect(within(history).queryByTestId('site-document-privacy-use-version-2')).not.toBeInTheDocument();

    fireEvent.click(within(history).getByTestId('site-document-privacy-use-version-1'));

    await waitFor(() => expect(OrgsApi.getSiteDocumentVersion).toHaveBeenCalledWith('privacy', 1));
    await waitFor(() => expect(screen.getByTestId('site-document-privacy-content')).toHaveValue('Testo della prima versione'));
    expect(screen.getByTestId('site-document-privacy-publish')).toBeEnabled();
  });
});
