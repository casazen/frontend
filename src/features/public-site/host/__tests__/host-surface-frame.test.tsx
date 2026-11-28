import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import { setHostSite, type HostBranding, type HostSite } from '@/lib/host-site';
import { analyzePrimaryColor } from '@/lib/public-site-colors';
import { useSeoMeta } from '@/lib/seo-meta';
import { HostSurfaceFrame } from '../host-surface-frame';

const BRANDING: HostBranding = {
  logoUrl: 'https://cdn.example.test/villa-rossi.png',
  primaryColor: '#1a5276',
  themeId: 'mare',
  fontId: 'moderno',
  displayName: 'Villa Rossi',
  showPoweredBy: false,
};

function site(branding?: HostBranding, displayName = 'Villa Rossi'): HostSite {
  return { host: 'prenota.villa-rossi.example.test', slug: 'villa-rossi', displayName, ...(branding ? { branding } : {}) };
}

function renderFrame(hostSite: HostSite | null) {
  setHostSite(hostSite);
  return render(
    <MemoryRouter initialEntries={['/inside']}>
      <Routes>
        <Route element={<HostSurfaceFrame />}>
          <Route path="/inside" element={<main data-testid="page-inside">The page</main>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function PageWithATitle() {
  useSeoMeta({ title: 'Area proprietari', noindex: true });
  return <main data-testid="page-inside" />;
}

const robots = () => document.head.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null;

describe('HostSurfaceFrame (NF-140)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    setHostSite(null);
    vi.restoreAllMocks();
  });

  it('HostSurfaceFrame_AgencyWithALogo_ShowsLogoAndNameAsALinkToTheLandingPageAndKeepsThePageInside', () => {
    renderFrame(site(BRANDING));

    const home = screen.getByRole('link', { name: 'Villa Rossi' });
    expect(home).toHaveAttribute('href', '/');
    const logo = home.querySelector('img');
    expect(logo).toHaveAttribute('src', BRANDING.logoUrl);
    expect(logo).toHaveAttribute('alt', '');
    expect(screen.getByTestId('host-surface-frame')).toContainElement(screen.getByTestId('page-inside'));
    expect(screen.getByTestId('page-inside')).toHaveTextContent('The page');
  });

  it('HostSurfaceFrame_AgencyWithoutALogo_ShowsTheInitialAndTheName', () => {
    renderFrame(site({ ...BRANDING, logoUrl: null }));

    const home = screen.getByTestId('host-surface-frame-home');
    expect(home.querySelector('img')).toBeNull();
    expect(home).toHaveTextContent('V');
    expect(home).toHaveTextContent('Villa Rossi');
  });

  it('HostSurfaceFrame_AgencyColoursAndTheme_AreOnTheRootOfTheFrame', () => {
    renderFrame(site(BRANDING));

    const root = screen.getByTestId('host-surface-frame');
    const analysis = analyzePrimaryColor('#1a5276', 'mare');
    expect(root.style.getPropertyValue('--cz-public-primary')).toBe('#1a5276');
    expect(root.style.getPropertyValue('--cz-public-on-primary')).toBe(analysis?.onPrimary);
    expect(root).toHaveAttribute('data-theme', 'mare');
    expect(root).toHaveAttribute('data-font', 'moderno');
    expect(root).toHaveClass('public-site-root');
  });

  it.each([
    ['a colour that is not a colour', { ...BRANDING, primaryColor: 'red; background:url(x)' }],
    ['no colour', { ...BRANDING, primaryColor: null }],
  ])('HostSurfaceFrame_%s_KeepsTheColoursOfTheTheme', (_name, branding) => {
    renderFrame(site(branding));

    const root = screen.getByTestId('host-surface-frame');
    expect(root.style.getPropertyValue('--cz-public-primary')).toBe('');
    expect(root.getAttribute('style') ?? '').not.toContain('url(');
  });

  it('HostSurfaceFrame_UnknownThemeAndFont_FallBackToTheDefaults', () => {
    renderFrame(site({ ...BRANDING, themeId: 'not-a-theme', fontId: 'not-a-font' }));

    const root = screen.getByTestId('host-surface-frame');
    expect(root).toHaveAttribute('data-theme', 'terra');
    expect(root).not.toHaveAttribute('data-font');
  });

  it('HostSurfaceFrame_Mounted_MarksTheDocumentNoindexAndRestoresItWhenItGoes', () => {
    document.title = 'before';
    const view = renderFrame(site(BRANDING));

    expect(robots()).toBe('noindex,nofollow');
    expect(document.title).toBe('Villa Rossi');

    view.unmount();
    expect(robots()).toBeNull();
    expect(document.title).toBe('before');
  });

  it('HostSurfaceFrame_PageInsideSetsItsOwnTitle_TheTitleOfThePageWins', () => {
    setHostSite(site(BRANDING));
    render(
      <MemoryRouter initialEntries={['/inside']}>
        <Routes>
          <Route element={<HostSurfaceFrame />}>
            <Route path="/inside" element={<PageWithATitle />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(document.title).toBe('Area proprietari');
    expect(robots()).toBe('noindex,nofollow');
  });

  it('HostSurfaceFrame_ShowPoweredBy_ShowsTheLineOnlyWhenTheAgencySaysSo', () => {
    const off = renderFrame(site({ ...BRANDING, showPoweredBy: false }));
    expect(screen.queryByTestId('host-surface-frame-powered-by')).not.toBeInTheDocument();
    off.unmount();

    renderFrame(site({ ...BRANDING, showPoweredBy: true }));
    expect(screen.getByTestId('host-surface-frame-powered-by')).toHaveTextContent('Powered by CasaZen');
  });

  it('HostSurfaceFrame_AgencyWithNoBrandingBlock_IsThePlainFrameWithTheNameOfTheSite', () => {
    renderFrame(site(undefined, 'Casa Mare'));

    expect(screen.getByRole('link', { name: 'Casa Mare' })).toHaveAttribute('href', '/');
    expect(screen.getByTestId('host-surface-frame')).toHaveAttribute('data-theme', 'terra');
    expect(screen.queryByTestId('host-surface-frame-powered-by')).not.toBeInTheDocument();
  });

  it('HostSurfaceFrame_NameOfTheAgency_IsOnlyEverText', () => {
    renderFrame(site({ ...BRANDING, displayName: '<img src=x onerror=alert(1)> Villa' }, '<img src=x onerror=alert(1)> Villa'));

    const home = screen.getByTestId('host-surface-frame-home');
    expect(home).toHaveTextContent('<img src=x onerror=alert(1)> Villa');
    expect(home.querySelectorAll('img')).toHaveLength(1);
    expect(document.querySelectorAll('img[onerror]')).toHaveLength(0);
  });

  it('HostSurfaceFrame_Render_ReadsNothingFromTheStorageOfTheBrowser', () => {
    const local = vi.spyOn(Storage.prototype, 'getItem');

    renderFrame(site({ ...BRANDING, showPoweredBy: true }));

    expect(local).not.toHaveBeenCalled();
  });
});
