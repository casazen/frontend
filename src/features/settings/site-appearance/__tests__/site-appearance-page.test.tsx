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
import { useWorkspace } from '@/hooks/use-workspace';
import * as userQueries from '@/queries/use-users';
import type { OrgBranding } from '@/types';
import { SiteAppearancePage } from '../site-appearance-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/orgs.api', () => ({
  OrgsApi: {
    getBranding: vi.fn(),
    updateBranding: vi.fn(),
    uploadBrandingImage: vi.fn(),
    removeBrandingImage: vi.fn(),
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

const PAGE_PATH = '/app/short-rent/settings/site-appearance';

function branding(overrides: Partial<OrgBranding> = {}): OrgBranding {
  return {
    logoUrl: null,
    heroImageUrl: null,
    primaryColor: null,
    publicThemeId: 'mare',
    tagline: null,
    slug: 'villa-parco',
    displayName: 'Villa Parco',
    showPoweredBy: true,
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
            <Route path={PAGE_PATH} element={<SiteAppearancePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

function pickFile(kind: 'logo' | 'hero', file: File) {
  fireEvent.change(screen.getByTestId(`branding-image-${kind}-input`), { target: { files: [file] } });
}

describe('SiteAppearancePage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    mockContexts(['short-rent']);
    vi.mocked(userQueries.useCurrentUser).mockReturnValue({
      user: { orgId: 'org-1' },
      org: { id: 'org-1', name: 'Villa Parco', slug: 'villa-parco', planTier: 'Starter' },
      planTier: 'Starter',
    } as unknown as CurrentUserResult);
    vi.mocked(OrgsApi.getBranding).mockResolvedValue(branding());
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('SiteAppearancePage_NotBillingAdmin_ShowsAdminRequiredWithoutCallingTheApi', () => {
    mockContexts(['supplier']);
    renderPage();

    expect(screen.getByTestId('site-appearance-admin-required')).toHaveTextContent(i18n.t('siteAppearance.adminRequired'));
    expect(OrgsApi.getBranding).not.toHaveBeenCalled();
  });

  it('SiteAppearancePage_WhileLoading_ShowsSkeleton', () => {
    vi.mocked(OrgsApi.getBranding).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByTestId('site-appearance-loading')).toBeInTheDocument();
  });

  it('SiteAppearancePage_LoadFails_ShowsErrorWithRetryNotAnEmptyForm', async () => {
    vi.mocked(OrgsApi.getBranding).mockRejectedValueOnce(problemError(500)).mockResolvedValueOnce(branding());
    renderPage();

    expect(await screen.findByTestId('site-appearance-error')).toHaveTextContent(i18n.t('siteAppearance.loadError'));
    expect(screen.queryByTestId('site-appearance-form')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.errorFallback.tryAgain') }));
    expect(await screen.findByTestId('site-appearance-form')).toBeInTheDocument();
  });

  it('SiteAppearancePage_SavedBranding_FillsFormAndPreview', async () => {
    vi.mocked(OrgsApi.getBranding).mockResolvedValue(
      branding({
        primaryColor: '#1a6b8f',
        publicThemeId: 'montagna',
        tagline: 'Baite in quota',
        logoUrl: 'https://cdn.test/logo.png',
      }),
    );
    renderPage();

    expect(await screen.findByTestId('site-primary-color-input')).toHaveValue('#1a6b8f');
    expect(screen.getByTestId('site-theme-montagna')).toBeChecked();
    expect(screen.getByTestId('site-tagline-input')).toHaveValue('Baite in quota');
    const preview = screen.getByTestId('site-preview-root');
    expect(preview).toHaveAttribute('data-theme', 'montagna');
    expect(preview.style.getPropertyValue('--cz-public-primary')).toBe('#1a6b8f');
    expect(screen.getByTestId('site-preview-logo')).toHaveAttribute('src', 'https://cdn.test/logo.png');
    expect(within(preview).getByText('Baite in quota')).toBeInTheDocument();
    expect(screen.getByTestId('site-appearance-open-site')).toHaveAttribute('href', '/book/villa-parco');
  });

  it('SiteAppearancePage_ThemeOptions_ShowASampleOfEachTheme', async () => {
    renderPage();

    await screen.findByTestId('site-appearance-form');
    for (const themeId of ['mare', 'montagna', 'urban']) {
      expect(screen.getByTestId(`site-theme-sample-${themeId}`)).toHaveAttribute('data-theme', themeId);
    }
  });

  it('SiteAppearancePage_NoCustomColor_ShowsNoContrastPanelAndPickerShowsTheThemeColor', async () => {
    renderPage();

    await screen.findByTestId('site-appearance-form');
    expect(screen.queryByTestId('site-color-contrast')).not.toBeInTheDocument();
    expect(screen.getByTestId('site-primary-color-picker')).toHaveValue('#b4492f');

    fireEvent.click(screen.getByTestId('site-theme-urban'));
    expect(screen.getByTestId('site-primary-color-picker')).toHaveValue('#2f3bd1');
  });

  it('SiteAppearancePage_DarkColor_AnnouncesWhiteButtonTextWithItsContrast', async () => {
    renderPage();

    await screen.findByTestId('site-appearance-form');
    fireEvent.change(screen.getByTestId('site-primary-color-input'), { target: { value: '#1a6b8f' } });

    expect(screen.getByTestId('site-color-contrast-button')).toHaveTextContent(/bianco/);
    expect(screen.getByTestId('site-color-contrast-button')).toHaveTextContent(/\d,\d:1/);
    expect(screen.queryByTestId('site-color-contrast-adjusted')).not.toBeInTheDocument();
    const preview = screen.getByTestId('site-preview-root');
    expect(preview.style.getPropertyValue('--cz-public-on-primary')).toBe('#ffffff');
  });

  it('SiteAppearancePage_LightColor_AnnouncesDarkButtonTextAndTheDarkerLinkVariant', async () => {
    renderPage();

    await screen.findByTestId('site-appearance-form');
    fireEvent.change(screen.getByTestId('site-primary-color-input'), { target: { value: '#f4d03f' } });

    expect(screen.getByTestId('site-color-contrast-button')).toHaveTextContent(/scuro/);
    expect(screen.getByTestId('site-color-contrast-adjusted')).toBeInTheDocument();
    const preview = screen.getByTestId('site-preview-root');
    expect(preview.style.getPropertyValue('--cz-public-on-primary')).not.toBe('#ffffff');
    expect(preview.style.getPropertyValue('--cz-public-primary')).toBe('#f4d03f');
  });

  it('SiteAppearancePage_Save_SendsNormalizedColorThemeAndTagline', async () => {
    vi.mocked(OrgsApi.updateBranding).mockImplementation((payload) =>
      Promise.resolve(branding({ ...payload, publicThemeId: payload.publicThemeId })),
    );
    renderPage();

    await screen.findByTestId('site-appearance-form');
    fireEvent.click(screen.getByTestId('site-theme-urban'));
    fireEvent.change(screen.getByTestId('site-primary-color-input'), { target: { value: '#ABC' } });
    fireEvent.change(screen.getByTestId('site-tagline-input'), { target: { value: '  Nel cuore\n della città ' } });
    fireEvent.click(screen.getByTestId('save-site-appearance'));

    await waitFor(() =>
      expect(OrgsApi.updateBranding).toHaveBeenCalledWith({
        primaryColor: '#aabbcc',
        publicThemeId: 'urban',
        tagline: 'Nel cuore della città',
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('siteAppearance.saved')));
  });

  it('SiteAppearancePage_ThemeColorChosen_SendsNullColor', async () => {
    vi.mocked(OrgsApi.getBranding).mockResolvedValue(branding({ primaryColor: '#123456' }));
    vi.mocked(OrgsApi.updateBranding).mockResolvedValue(branding());
    renderPage();

    fireEvent.click(await screen.findByTestId('site-primary-color-reset'));
    fireEvent.click(screen.getByTestId('save-site-appearance'));

    await waitFor(() =>
      expect(OrgsApi.updateBranding).toHaveBeenCalledWith({ primaryColor: null, publicThemeId: 'mare', tagline: null }),
    );
  });

  it('SiteAppearancePage_InvalidColor_ShowsErrorAndDoesNotSave', async () => {
    renderPage();

    await screen.findByTestId('site-appearance-form');
    fireEvent.change(screen.getByTestId('site-primary-color-input'), { target: { value: 'rosso' } });
    fireEvent.click(screen.getByTestId('save-site-appearance'));

    expect(await screen.findByTestId('site-primary-color-error')).toHaveTextContent(
      i18n.t('siteAppearance.errors.colorInvalid'),
    );
    expect(OrgsApi.updateBranding).not.toHaveBeenCalled();
  });

  it('SiteAppearancePage_TaglineTooLong_ShowsErrorAndDoesNotSave', async () => {
    renderPage();

    await screen.findByTestId('site-appearance-form');
    fireEvent.change(screen.getByTestId('site-tagline-input'), { target: { value: 'a'.repeat(161) } });
    fireEvent.click(screen.getByTestId('save-site-appearance'));

    expect(await screen.findByTestId('site-tagline-error')).toHaveTextContent(
      i18n.t('siteAppearance.errors.taglineTooLong', { maxLength: 160 }),
    );
    expect(OrgsApi.updateBranding).not.toHaveBeenCalled();
  });

  it('SiteAppearancePage_SaveRejectedByServer_ShowsTheBrandingErrorMessage', async () => {
    vi.mocked(OrgsApi.updateBranding).mockRejectedValue(
      problemError(422, { code: 'org_branding_theme_invalid', detail: 'server text' }),
    );
    renderPage();

    await screen.findByTestId('site-appearance-form');
    fireEvent.click(screen.getByTestId('save-site-appearance'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('siteAppearance.errors.themeInvalid')));
  });

  it('SiteAppearancePage_UploadLogo_SendsFileAndShowsNewLogo', async () => {
    vi.mocked(OrgsApi.uploadBrandingImage).mockResolvedValue(branding({ logoUrl: 'https://cdn.test/new-logo.png' }));
    renderPage();

    await screen.findByTestId('site-appearance-images');
    const file = new File([new Uint8Array(1024)], 'logo.png', { type: 'image/png' });
    pickFile('logo', file);

    await waitFor(() => expect(OrgsApi.uploadBrandingImage).toHaveBeenCalledWith('logo', file));
    expect(await screen.findByTestId('branding-image-logo-current')).toHaveAttribute('src', 'https://cdn.test/new-logo.png');
    expect(screen.getByTestId('branding-image-logo-remove')).toBeInTheDocument();
  });

  it('SiteAppearancePage_PickSvgLogo_ShowsTypeErrorWithoutUploading', async () => {
    renderPage();

    await screen.findByTestId('site-appearance-images');
    pickFile('logo', new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }));

    expect(await screen.findByTestId('branding-image-logo-error')).toHaveTextContent(i18n.t('siteAppearance.errors.imageType'));
    expect(OrgsApi.uploadBrandingImage).not.toHaveBeenCalled();
  });

  it('SiteAppearancePage_PickOversizedHero_ShowsSizeErrorWithoutUploading', async () => {
    renderPage();

    await screen.findByTestId('site-appearance-images');
    pickFile('hero', new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'hero.jpg', { type: 'image/jpeg' }));

    expect(await screen.findByTestId('branding-image-hero-error')).toHaveTextContent(
      i18n.t('siteAppearance.errors.imageTooLarge', { maxMb: 10 }),
    );
    expect(OrgsApi.uploadBrandingImage).not.toHaveBeenCalled();
  });

  it('SiteAppearancePage_HeroRejectedForDimensions_ShowsHeroLimits', async () => {
    vi.mocked(OrgsApi.uploadBrandingImage).mockRejectedValue(
      problemError(422, { code: 'org_branding_image_dimensions_invalid' }),
    );
    renderPage();

    await screen.findByTestId('site-appearance-images');
    pickFile('hero', new File([new Uint8Array(2048)], 'hero.jpg', { type: 'image/jpeg' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        i18n.t('siteAppearance.errors.imageDimensions', { minWidth: 1200, minHeight: 400, maxWidth: 8000, maxHeight: 8000 }),
      ),
    );
  });

  it('SiteAppearancePage_RemoveHero_CallsApiAndShowsEmptyState', async () => {
    vi.mocked(OrgsApi.getBranding).mockResolvedValue(branding({ heroImageUrl: 'https://cdn.test/hero.jpg' }));
    vi.mocked(OrgsApi.removeBrandingImage).mockResolvedValue(branding());
    renderPage();

    fireEvent.click(await screen.findByTestId('branding-image-hero-remove'));

    await waitFor(() => expect(OrgsApi.removeBrandingImage).toHaveBeenCalledWith('hero'));
    await waitFor(() => expect(screen.queryByTestId('branding-image-hero-current')).not.toBeInTheDocument());
    expect(screen.getByTestId('branding-image-hero')).toHaveTextContent(i18n.t('siteAppearance.images.hero.empty'));
  });
});
