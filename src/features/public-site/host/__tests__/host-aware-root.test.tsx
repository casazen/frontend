import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { getHostSite, setHostSite, type HostResolution } from '@/lib/host-site';

vi.mock('@/lib/host-site', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/host-site')>()),
  isDefaultAppHost: vi.fn(),
  resolveHostSite: vi.fn(),
}));

import { isDefaultAppHost, resolveHostSite } from '@/lib/host-site';
import { HostAwareRoot } from '../host-aware-root';

function renderRoot() {
  return render(
    <I18nextProvider i18n={i18n}>
      <HostAwareRoot>
        <div data-testid="the-app" />
      </HostAwareRoot>
    </I18nextProvider>,
  );
}

const SITE: HostResolution = { kind: 'site', site: { host: 'www.villa-rossi.example.test', slug: 'villa-rossi', displayName: 'Villa Rossi' } };

describe('HostAwareRoot (BK-16, A3-08)', () => {
  beforeEach(() => {
    setHostSite(null);
    vi.mocked(isDefaultAppHost).mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
    setHostSite(null);
    vi.resetAllMocks();
  });

  it('HostAwareRoot_AppOwnHost_StartsTheAppOnTheFirstRenderWithoutResolvingAnything', () => {
    vi.mocked(isDefaultAppHost).mockReturnValue(true);

    renderRoot();

    expect(screen.getByTestId('the-app')).toBeInTheDocument();
    expect(screen.queryByTestId('host-site-loading')).not.toBeInTheDocument();
    expect(resolveHostSite).not.toHaveBeenCalled();
    expect(getHostSite()).toBeNull();
  });

  it('HostAwareRoot_OrgHost_ShowsLoadingThenStartsTheAppWithTheSiteKnown', async () => {
    vi.mocked(resolveHostSite).mockResolvedValue(SITE);

    renderRoot();
    expect(screen.getByTestId('host-site-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('the-app')).not.toBeInTheDocument();

    expect(await screen.findByTestId('the-app')).toBeInTheDocument();
    expect(getHostSite()?.slug).toBe('villa-rossi');
  });

  it('HostAwareRoot_HostNobodyServes_ShowsTheNotFoundPageAndNeverTheApp', async () => {
    vi.mocked(resolveHostSite).mockResolvedValue({ kind: 'not-found' });

    renderRoot();

    expect(await screen.findByTestId('host-site-not-found')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('hostSite.notFound.title'))).toBeInTheDocument();
    expect(screen.queryByTestId('the-app')).not.toBeInTheDocument();
    expect(getHostSite()).toBeNull();
  });

  it('HostAwareRoot_CheckFailed_ShowsAnErrorWithRetryNotNotFound_AndRetryStartsTheApp', async () => {
    vi.mocked(resolveHostSite).mockResolvedValueOnce({ kind: 'error' }).mockResolvedValueOnce(SITE);

    renderRoot();

    expect(await screen.findByTestId('host-site-error')).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('hostSite.notFound.title'))).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('hostSite.error.retry') }));

    await waitFor(() => expect(screen.getByTestId('the-app')).toBeInTheDocument());
    expect(resolveHostSite).toHaveBeenCalledTimes(2);
  });
});
