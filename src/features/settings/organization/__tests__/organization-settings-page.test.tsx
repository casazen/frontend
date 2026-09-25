import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, AxiosHeaders } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { OrgsApi } from '@/api/orgs.api';
import { useWorkspace } from '@/hooks/use-workspace';
import * as userQueries from '@/queries/use-users';
import type { OrgSettings } from '@/types';
import { OrganizationSettingsPage } from '../organization-settings-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/orgs.api', () => ({
  OrgsApi: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
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

const PAGE_PATH = '/app/short-rent/settings/organization';

function settings(overrides: Partial<OrgSettings> = {}): OrgSettings {
  return {
    id: 'org-1',
    name: 'La mia organizzazione',
    slug: 'org-auth0-abc123',
    contactEmail: '',
    contactEmailPublic: false,
    ...overrides,
  };
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

function mockUser() {
  vi.mocked(userQueries.useCurrentUser).mockReturnValue({
    user: { orgId: 'org-1' },
    org: { id: 'org-1', name: 'La mia organizzazione', slug: 'org-auth0-abc123', planTier: 'Starter' },
    planTier: 'Starter',
  } as unknown as CurrentUserResult);
}

function mockContexts(contextKeys: string[]) {
  vi.mocked(useWorkspace).mockReturnValue({
    contexts: contextKeys.map((contextKey) => ({
      contextKey,
      displayName: contextKey,
      roleKey: contextKey,
      permissions: [],
      defaultRoute: `/app/${contextKey}`,
    })),
  } as unknown as WorkspaceResult);
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[PAGE_PATH]}>
          <Routes>
            <Route path={PAGE_PATH} element={<OrganizationSettingsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe('OrganizationSettingsPage', () => {
  beforeEach(() => {
    mockContexts(['short-rent']);
    mockUser();
    vi.mocked(OrgsApi.getSettings).mockResolvedValue(settings());
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('OrganizationSettingsPage_NotBillingAdmin_ShowsAdminRequiredWithoutCallingTheApi', () => {
    mockContexts(['supplier']);
    renderPage();

    expect(screen.getByTestId('org-settings-admin-required')).toHaveTextContent(
      i18n.t('orgSettings.adminRequired.title'),
    );
    expect(OrgsApi.getSettings).not.toHaveBeenCalled();
  });

  it('OrganizationSettingsPage_Loading_ShowsSkeleton', () => {
    vi.mocked(OrgsApi.getSettings).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByTestId('org-settings-loading')).toBeInTheDocument();
  });

  it('OrganizationSettingsPage_ApiError_ShowsErrorWithRetryNotAnEmptyForm', async () => {
    vi.mocked(OrgsApi.getSettings).mockRejectedValueOnce(problemError(500));
    renderPage();

    const error = await screen.findByTestId('org-settings-error');
    expect(error).toHaveTextContent(i18n.t('orgSettings.loadError'));
    expect(screen.queryByTestId('org-settings-form')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.errorFallback.tryAgain') }));
    expect(await screen.findByTestId('org-settings-form')).toBeInTheDocument();
  });

  it('OrganizationSettingsPage_Loaded_PrefillsFormFromServerSettings', async () => {
    vi.mocked(OrgsApi.getSettings).mockResolvedValue(
      settings({ name: 'Villa Parco Rentals', slug: 'villa-parco-rentals', contactEmail: 'host@villaparco.it', contactEmailPublic: true }),
    );
    renderPage();

    expect(await screen.findByTestId('org-name-input')).toHaveValue('Villa Parco Rentals');
    expect(screen.getByTestId('org-slug-input')).toHaveValue('villa-parco-rentals');
    expect(screen.getByTestId('org-contact-email-input')).toHaveValue('host@villaparco.it');
    expect(screen.getByTestId('org-contact-email-public-switch')).toBeChecked();
  });

  it('OrganizationSettingsPage_ContactEmailPublicOffByDefault_MatchesServerValue', async () => {
    renderPage();

    await screen.findByTestId('org-settings-form');
    expect(screen.getByTestId('org-contact-email-public-switch')).not.toBeChecked();
  });

  it('OrganizationSettingsPage_Save_SendsEditedFieldsAndShowsSuccess', async () => {
    vi.mocked(OrgsApi.updateSettings).mockResolvedValue(
      settings({ name: 'New Name', slug: 'new-slug', contactEmail: 'new@example.com', contactEmailPublic: true }),
    );
    renderPage();

    await screen.findByTestId('org-settings-form');
    fireEvent.change(screen.getByTestId('org-name-input'), { target: { value: 'New Name' } });
    fireEvent.change(screen.getByTestId('org-slug-input'), { target: { value: 'new-slug' } });
    fireEvent.change(screen.getByTestId('org-contact-email-input'), { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByTestId('org-contact-email-public-switch'));
    fireEvent.click(screen.getByTestId('save-org-settings'));

    await waitFor(() =>
      expect(OrgsApi.updateSettings).toHaveBeenCalledWith({
        name: 'New Name',
        slug: 'new-slug',
        contactEmail: 'new@example.com',
        contactEmailPublic: true,
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('orgSettings.saved')));
  });

  it('OrganizationSettingsPage_SaveSlugConflict_ShowsTranslatedMessage', async () => {
    vi.mocked(OrgsApi.updateSettings).mockRejectedValue(problemError(409, { code: 'org_slug_taken' }));
    renderPage();

    await screen.findByTestId('org-settings-form');
    fireEvent.click(screen.getByTestId('save-org-settings'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('apiErrors.codes.orgSlugTaken')));
  });
});
