import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { DomainApi } from '@/api/domain.api';
import type { OrgDomainConfig } from '@/types/domain.types';
import { CustomDomainSettingsPage } from '../custom-domain-settings-page';

vi.mock('@/api/domain.api', () => ({
  DomainApi: { getDomain: vi.fn(), setDomain: vi.fn(), verifyDomain: vi.fn(), resolveHost: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));
const entitlement = vi.hoisted(() => ({ canUseCustomDomain: true }));
vi.mock('@/queries/use-users', () => ({
  useCurrentUser: () => ({
    org: { id: 'org-1', slug: 'villa-mare' },
    user: { orgId: 'org-1', onboardingRequired: false },
  }),
  useEntitlement: () => ({ data: { canUseCustomDomain: entitlement.canUseCustomDomain } }),
}));

const BASE: OrgDomainConfig = {
  orgId: 'org-1',
  publicHostMode: 'CustomDomain',
  subdomain: null,
  customDomain: 'www.tuavilla.it',
  domainVerificationStatus: 'Pending',
  canUseCustomDomain: true,
  dnsInstructions: {
    cnameHost: 'www.tuavilla.it',
    cnameTarget: 'cname.example-target.test',
    txtHost: '_casazen-challenge.www.tuavilla.it',
    txtValue: 'token-123',
    sslNote: 'nota server',
    aRecordValues: ['203.0.113.10'],
    vercelTxtHost: null,
    vercelTxtValue: null,
  },
  publicUrls: { pathUrl: 'https://sito.test/book/villa-mare', subdomainUrl: null, customDomainUrl: null },
  status: {
    detail: 'ownership_txt_missing',
    message: 'messaggio del server',
    checkedAt: '2026-10-01T10:00:00Z',
    verifiedAt: null,
    activationAvailable: true,
    autoCheckActive: true,
  },
};

function config(overrides: Partial<OrgDomainConfig> = {}, status: Partial<NonNullable<OrgDomainConfig['status']>> = {}) {
  return { ...BASE, ...overrides, status: { ...BASE.status!, ...status } } as OrgDomainConfig;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(
        QueryClientProvider,
        { client },
        createElement(MemoryRouter, null, createElement(CustomDomainSettingsPage)),
      ),
    ),
  );
}

describe('CustomDomainSettingsPage (BK-17, A3-25)', () => {
  beforeEach(async () => {
    entitlement.canUseCustomDomain = true;
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('page_Loading_ShowsTheLoadingText', () => {
    vi.mocked(DomainApi.getDomain).mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByTestId('domain-loading')).toHaveTextContent(i18n.t('domain.settings.loading'));
  });

  it('page_LoadFails_ShowsTheErrorWithRetryNotAnEmptyForm', async () => {
    vi.mocked(DomainApi.getDomain).mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(config());
    renderPage();

    const alert = await screen.findByTestId('domain-load-error');
    expect(alert).toHaveTextContent(i18n.t('domain.settings.loadError'));
    expect(screen.queryByTestId('save-domain-settings')).not.toBeInTheDocument();

    fireEvent.click(within(alert).getByRole('button', { name: i18n.t('domain.settings.retry') }));

    expect(await screen.findByTestId('domain-current-config')).toBeInTheDocument();
    expect(screen.queryByTestId('domain-load-error')).not.toBeInTheDocument();
  });

  it('page_PendingOwnershipTxt_SaysItIsWaitingForDnsWithTheReasonAndTheRecords', async () => {
    vi.mocked(DomainApi.getDomain).mockResolvedValue(config());
    renderPage();

    const panel = await screen.findByTestId('domain-status-panel');
    expect(panel).toHaveAttribute('data-state', 'waitingDns');
    expect(screen.getByTestId('domain-status-badge')).toHaveTextContent(i18n.t('domain.state.waitingDns'));
    // The reason in the user's language, not the server text.
    expect(screen.getByTestId('domain-state-description')).toHaveTextContent(i18n.t('domain.issues.ownership_txt_missing'));
    expect(panel).not.toHaveTextContent('messaggio del server');
    expect(screen.getByTestId('domain-last-check')).not.toHaveTextContent(i18n.t('domain.neverChecked'));
    expect(screen.getByTestId('domain-auto-check')).toHaveTextContent(i18n.t('domain.autoCheck.active'));
    expect(screen.getByTestId('verify-domain-button')).toBeEnabled();

    const dns = screen.getByTestId('dns-instructions-panel');
    expect(within(dns).getByTestId('dns-record-txt')).toHaveTextContent('token-123');
    expect(within(dns).getByTestId('dns-record-cname')).toHaveTextContent('cname.example-target.test');
    expect(within(dns).getByTestId('dns-record-a')).toHaveTextContent('203.0.113.10');
    expect(within(dns).queryByTestId('dns-record-provider-txt')).not.toBeInTheDocument();
    // The SSL note is translated by the app, not the Italian text of the server.
    expect(dns).toHaveTextContent(i18n.t('domain.dns.sslNote'));
    expect(dns).not.toHaveTextContent('nota server');
    // A pending domain is not yet "your site": no link to it.
    expect(screen.queryByText(i18n.t('domain.settings.customDomainUrl'), { exact: false })).not.toBeInTheDocument();
  });

  it('page_VercelAsksItsOwnTxt_ShowsThatRecordToo', async () => {
    const base = config({}, { detail: 'vercel_verification_pending' });
    vi.mocked(DomainApi.getDomain).mockResolvedValue({
      ...base,
      dnsInstructions: { ...base.dnsInstructions!, vercelTxtHost: '_vercel.tuavilla.it', vercelTxtValue: 'vc-domain-verify=abc' },
    });
    renderPage();

    const record = await screen.findByTestId('dns-record-provider-txt');
    expect(record).toHaveTextContent('_vercel.tuavilla.it');
    expect(record).toHaveTextContent('vc-domain-verify=abc');
  });

  it('page_PlatformNotConfigured_SaysActivatingAndThatNothingOnDnsWillChangeIt', async () => {
    vi.mocked(DomainApi.getDomain).mockResolvedValue(
      config({}, { detail: 'vercel_not_configured', activationAvailable: false }),
    );
    renderPage();

    const panel = await screen.findByTestId('domain-status-panel');
    expect(panel).toHaveAttribute('data-state', 'activating');
    expect(screen.getByTestId('domain-status-badge')).toHaveTextContent(i18n.t('domain.state.activating'));
    expect(screen.getByTestId('domain-activation-unavailable')).toHaveTextContent(i18n.t('domain.activationUnavailable'));
    expect(screen.getByTestId('domain-state-description')).toHaveTextContent(i18n.t('domain.issues.vercel_not_configured'));
  });

  it('page_NeverChecked_SaysSoAndAutoCheckStoppedExplainsHowToResume', async () => {
    vi.mocked(DomainApi.getDomain).mockResolvedValue(config({}, { checkedAt: null, autoCheckActive: false }));
    renderPage();

    expect(await screen.findByTestId('domain-last-check')).toHaveTextContent(i18n.t('domain.neverChecked'));
    expect(screen.getByTestId('domain-auto-check')).toHaveTextContent(i18n.t('domain.autoCheck.stopped'));
  });

  it('page_Verified_ShowsActiveWithTheLinkAndNoVerifyButton', async () => {
    vi.mocked(DomainApi.getDomain).mockResolvedValue(
      config(
        {
          domainVerificationStatus: 'Verified',
          publicUrls: { ...BASE.publicUrls, customDomainUrl: 'https://www.tuavilla.it' },
        },
        { detail: null, verifiedAt: '2026-10-01T09:00:00Z' },
      ),
    );
    renderPage();

    const panel = await screen.findByTestId('domain-status-panel');
    expect(panel).toHaveAttribute('data-state', 'verified');
    expect(screen.getByTestId('domain-status-badge')).toHaveTextContent(i18n.t('domain.state.verified'));
    expect(screen.getByTestId('domain-verified-at')).toBeInTheDocument();
    expect(screen.queryByTestId('verify-domain-button')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'https://www.tuavilla.it' })).toHaveAttribute('href', 'https://www.tuavilla.it');
  });

  it('page_Failed_ShowsTheReasonAsAlertAndKeepsTheCheckButton', async () => {
    vi.mocked(DomainApi.getDomain).mockResolvedValue(
      config({ domainVerificationStatus: 'Failed' }, { detail: 'domain_taken' }),
    );
    renderPage();

    const panel = await screen.findByTestId('domain-status-panel');
    expect(panel).toHaveAttribute('data-state', 'failed');
    expect(within(panel).getByRole('alert')).toHaveTextContent(i18n.t('domain.issues.domain_taken'));
    expect(screen.getByTestId('domain-status-badge')).toHaveTextContent(i18n.t('domain.state.failed'));
    expect(screen.getByTestId('verify-domain-button')).toBeInTheDocument();
  });

  it('page_PlanLapsed_SaysTheSiteIsNotServedOnTheDomain', async () => {
    entitlement.canUseCustomDomain = false;
    vi.mocked(DomainApi.getDomain).mockResolvedValue(config({ canUseCustomDomain: false }));
    renderPage();

    expect(await screen.findByTestId('domain-plan-lapsed')).toHaveTextContent(i18n.t('domain.settings.planLapsed'));
  });

  it('page_PlanAllowsCustomDomain_NoPlanNote', async () => {
    vi.mocked(DomainApi.getDomain).mockResolvedValue(config());
    renderPage();

    await screen.findByTestId('domain-status-panel');
    expect(screen.queryByTestId('domain-plan-lapsed')).not.toBeInTheDocument();
  });

  it('verify_StillWaiting_ToastsTheReasonInTheUsersLanguage', async () => {
    vi.mocked(DomainApi.getDomain).mockResolvedValue(config());
    vi.mocked(DomainApi.verifyDomain).mockResolvedValue({
      domainVerificationStatus: 'Pending',
      customDomain: 'www.tuavilla.it',
      checkedAt: '2026-10-01T10:05:00Z',
      detail: 'dns_not_pointing',
      message: 'testo del server',
    });
    renderPage();

    fireEvent.click(await screen.findByTestId('verify-domain-button'));

    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(i18n.t('domain.issues.dns_not_pointing')));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('verify_UnknownCode_ToastsTheServerMessage', async () => {
    vi.mocked(DomainApi.getDomain).mockResolvedValue(config());
    vi.mocked(DomainApi.verifyDomain).mockResolvedValue({
      domainVerificationStatus: 'Pending',
      customDomain: 'www.tuavilla.it',
      checkedAt: '2026-10-01T10:05:00Z',
      detail: 'something_new',
      message: 'testo del server',
    });
    renderPage();

    fireEvent.click(await screen.findByTestId('verify-domain-button'));

    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith('testo del server'));
  });

  it('verify_Verified_ToastsSuccess', async () => {
    vi.mocked(DomainApi.getDomain).mockResolvedValue(config());
    vi.mocked(DomainApi.verifyDomain).mockResolvedValue({
      domainVerificationStatus: 'Verified',
      customDomain: 'www.tuavilla.it',
      checkedAt: '2026-10-01T10:05:00Z',
      detail: null,
      message: null,
    });
    renderPage();

    fireEvent.click(await screen.findByTestId('verify-domain-button'));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('domain.settings.verifySuccess')));
  });

  it('verify_RequestFails_ToastsAnErrorWithoutAnUnhandledRejection', async () => {
    vi.mocked(DomainApi.getDomain).mockResolvedValue(config());
    vi.mocked(DomainApi.verifyDomain).mockRejectedValue(new Error('network'));
    renderPage();

    fireEvent.click(await screen.findByTestId('verify-domain-button'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('domain.settings.verifyFailed')));
  });
});
