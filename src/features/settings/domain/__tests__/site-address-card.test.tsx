import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { DomainApi } from '@/api/domain.api';
import { MEMBER_ROLE_KEYS } from '@/test/org-contexts';
import type { OrgDomainConfig } from '@/types/domain.types';
import { SiteAddressCard } from '../site-address-card';

vi.mock('@/api/domain.api', () => ({
  DomainApi: { getDomain: vi.fn(), setDomain: vi.fn(), verifyDomain: vi.fn(), resolveHost: vi.fn() },
}));
const workspace = vi.hoisted(() => ({
  contexts: [{ contextKey: 'short-rent', roleKey: 'property_owner' }] as { contextKey: string; roleKey: string }[],
  writes: true,
}));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    contexts: workspace.contexts,
    hasPermission: (_context: string, permission: string) => permission !== 'property.write' || workspace.writes,
  }),
}));
vi.mock('@/queries/use-users', () => ({
  useCurrentUser: () => ({ org: { id: 'org-1', slug: 'villa-mare' }, user: {} }),
}));

const PATH_MODE: OrgDomainConfig = {
  orgId: 'org-1',
  publicHostMode: 'CasazenPath',
  subdomain: null,
  customDomain: null,
  domainVerificationStatus: 'Pending',
  canUseCustomDomain: false,
  dnsInstructions: null,
  publicUrls: { pathUrl: 'https://sito.test/book/villa-mare', subdomainUrl: null, customDomainUrl: null },
  status: { detail: null, checkedAt: null, verifiedAt: null, activationAvailable: true, autoCheckActive: false },
};

const PENDING_DOMAIN: OrgDomainConfig = {
  ...PATH_MODE,
  publicHostMode: 'CustomDomain',
  customDomain: 'www.tuavilla.it',
  canUseCustomDomain: true,
  status: {
    detail: 'dns_not_pointing',
    checkedAt: '2026-10-01T10:00:00Z',
    verifiedAt: null,
    activationAvailable: true,
    autoCheckActive: true,
  },
};

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(SiteAddressCard))),
    ),
  );
}

describe('SiteAddressCard (BK-17, CD-AC9)', () => {
  beforeEach(async () => {
    workspace.contexts = [{ contextKey: 'short-rent', roleKey: 'property_owner' }];
    workspace.writes = true;
    window.localStorage.clear();
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('card_NotBillingAdmin_RendersNothingAndAsksNothing', () => {
    workspace.contexts = [{ contextKey: 'guest', roleKey: 'guest' }];
    renderCard();

    expect(screen.queryByTestId('site-address-card')).not.toBeInTheDocument();
    expect(DomainApi.getDomain).not.toHaveBeenCalled();
  });

  // AM-00 (S1): a collaborator of the org with property.write has the short-rent context but not the owner's role key:
  // the custom domain endpoints answer 403 to it, so the card does not ask for them.
  it.each(MEMBER_ROLE_KEYS)('card_MemberWithRoleKey_%s_RendersNothingAndAsksNothing', (roleKey) => {
    workspace.contexts = [{ contextKey: 'short-rent', roleKey }];
    renderCard();

    expect(screen.queryByTestId('site-address-card')).not.toBeInTheDocument();
    expect(DomainApi.getDomain).not.toHaveBeenCalled();
  });

  it('card_NoWritePermission_RendersNothingAndAsksNothing', () => {
    workspace.writes = false;
    renderCard();

    expect(screen.queryByTestId('site-address-card')).not.toBeInTheDocument();
    expect(DomainApi.getDomain).not.toHaveBeenCalled();
  });

  it('card_Loading_ShowsASkeleton', () => {
    vi.mocked(DomainApi.getDomain).mockReturnValue(new Promise(() => undefined));
    renderCard();

    expect(screen.getByTestId('site-address-loading')).toBeInTheDocument();
  });

  it('card_LoadFails_ShowsTheErrorWithRetry', async () => {
    vi.mocked(DomainApi.getDomain).mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(PATH_MODE);
    renderCard();

    const alert = await screen.findByTestId('site-address-error');
    expect(alert).toHaveTextContent(i18n.t('domain.siteAddress.loadError'));

    fireEvent.click(within(alert).getByRole('button', { name: i18n.t('domain.settings.retry') }));

    expect(await screen.findByTestId('site-address-card')).toBeInTheDocument();
  });

  it('card_PathMode_SuggestsAnAddressWithTheCurrentUrlAndLinksToTheSettings', async () => {
    vi.mocked(DomainApi.getDomain).mockResolvedValue(PATH_MODE);
    renderCard();

    const card = await screen.findByTestId('site-address-card');
    expect(card).toHaveAttribute('data-mode', 'suggestion');
    expect(card).toHaveTextContent('https://sito.test/book/villa-mare');
    expect(within(card).getByTestId('site-address-link')).toHaveAttribute('href', '/app/short-rent/settings/domain');
  });

  it('card_SuggestionDismissed_DisappearsAndStaysHiddenOnTheNextVisit', async () => {
    vi.mocked(DomainApi.getDomain).mockResolvedValue(PATH_MODE);
    const first = renderCard();

    fireEvent.click(await screen.findByTestId('site-address-dismiss'));
    expect(screen.queryByTestId('site-address-card')).not.toBeInTheDocument();

    first.unmount();
    renderCard();
    // Wait for the data, then the card must still be hidden.
    await waitFor(() => expect(screen.queryByTestId('site-address-loading')).not.toBeInTheDocument());
    expect(screen.queryByTestId('site-address-card')).not.toBeInTheDocument();
  });

  it('card_CustomDomainWaitingForDns_FollowsItWithTheStateAndTheReason', async () => {
    vi.mocked(DomainApi.getDomain).mockResolvedValue(PENDING_DOMAIN);
    renderCard();

    const card = await screen.findByTestId('site-address-card');
    expect(card).toHaveAttribute('data-mode', 'domain');
    expect(card).toHaveAttribute('data-state', 'waitingDns');
    expect(card).toHaveTextContent('www.tuavilla.it');
    expect(within(card).getByTestId('domain-status-badge')).toHaveTextContent(i18n.t('domain.state.waitingDns'));
    expect(card).toHaveTextContent(i18n.t('domain.issues.dns_not_pointing'));
    // A domain being followed has no "dismiss": the host must finish or change it.
    expect(within(card).queryByTestId('site-address-dismiss')).not.toBeInTheDocument();
  });

  it('card_CustomDomainFailed_ShowsFailedState', async () => {
    vi.mocked(DomainApi.getDomain).mockResolvedValue({
      ...PENDING_DOMAIN,
      domainVerificationStatus: 'Failed',
      status: { ...PENDING_DOMAIN.status!, detail: 'domain_taken' },
    });
    renderCard();

    const card = await screen.findByTestId('site-address-card');
    expect(card).toHaveAttribute('data-state', 'failed');
    expect(card).toHaveTextContent(i18n.t('domain.issues.domain_taken'));
  });

  it('card_CustomDomainVerified_IsDoneAndHidden', async () => {
    vi.mocked(DomainApi.getDomain).mockResolvedValue({ ...PENDING_DOMAIN, domainVerificationStatus: 'Verified' });
    renderCard();

    await waitFor(() => expect(screen.queryByTestId('site-address-loading')).not.toBeInTheDocument());
    expect(screen.queryByTestId('site-address-card')).not.toBeInTheDocument();
  });

  it('card_SubdomainChosen_IsDoneAndHidden', async () => {
    vi.mocked(DomainApi.getDomain).mockResolvedValue({ ...PATH_MODE, publicHostMode: 'CasazenSubdomain', subdomain: 'villa-mare' });
    renderCard();

    await waitFor(() => expect(screen.queryByTestId('site-address-loading')).not.toBeInTheDocument());
    expect(screen.queryByTestId('site-address-card')).not.toBeInTheDocument();
  });
});
