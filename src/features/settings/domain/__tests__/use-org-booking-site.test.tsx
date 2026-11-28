import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { DomainApi } from '@/api/domain.api';
import { ORG_BILLING_ADMIN_PERMISSION } from '@/lib/org-billing-admin';
import type { OrgDomainConfig } from '@/types/domain.types';
import { useOrgBookingSite } from '../use-org-domain';

const hasPermission = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ hasPermission }) }));
vi.mock('@/api/domain.api', () => ({ DomainApi: { getDomain: vi.fn() } }));

const ORG_ID = 'c0ffee00-0000-4000-8000-000000000001';
const config = (publicUrls: OrgDomainConfig['publicUrls']): OrgDomainConfig => ({
  orgId: ORG_ID,
  publicHostMode: 'CustomDomain',
  subdomain: null,
  customDomain: 'www.agenzia.it',
  domainVerificationStatus: 'Verified',
  canUseCustomDomain: true,
  publicUrls,
});
const SERVED = config({ pathUrl: 'https://app.example.test/book/villa-rossi', subdomainUrl: null, customDomainUrl: 'https://www.agenzia.it' });

function renderSite() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useOrgBookingSite(ORG_ID, 'villa-rossi'), { wrapper });
}

describe('useOrgBookingSite', () => {
  beforeEach(() => {
    vi.mocked(DomainApi.getDomain).mockReset();
    hasPermission.mockReset();
  });

  afterEach(() => cleanup());

  it('useOrgBookingSite_AccountAdministrator_ReadsTheSettingsAndLinksToTheDomainOfTheOrg', async () => {
    hasPermission.mockImplementation((_context: string, permission: string) => permission === ORG_BILLING_ADMIN_PERMISSION);
    vi.mocked(DomainApi.getDomain).mockResolvedValue(SERVED);

    const { result } = renderSite();

    expect(result.current?.status).toBe('loading');
    await waitFor(() => expect(result.current?.status).toBe('ready'));
    expect(result.current?.site).toMatchObject({ baseUrl: 'https://www.agenzia.it', ownHost: true });
    expect(result.current?.config).toEqual(SERVED);
    expect(DomainApi.getDomain).toHaveBeenCalledWith(ORG_ID);
  });

  it('useOrgBookingSite_CallerWhoDoesNotManageTheAccount_AsksNothingAndLinksToTheAddressOfCasaZen', () => {
    hasPermission.mockReturnValue(false);

    const { result } = renderSite();

    expect(result.current?.status).toBe('restricted');
    expect(result.current?.config).toBeUndefined();
    expect(result.current?.site).toMatchObject({ baseUrl: expect.stringMatching(/\/book\/villa-rossi$/), ownHost: false });
    expect(DomainApi.getDomain).not.toHaveBeenCalled();
  });

  it('useOrgBookingSite_ReadThatFails_IsFailedAndNeverALinkOnAnAddressThatWasNotConfirmed', async () => {
    hasPermission.mockReturnValue(true);
    vi.mocked(DomainApi.getDomain).mockResolvedValueOnce(SERVED).mockRejectedValueOnce(new Error('boom'));

    const { result } = renderSite();
    await waitFor(() => expect(result.current?.status).toBe('ready'));

    result.current?.retry();

    await waitFor(() => expect(result.current?.status).toBe('failed'));
    expect(result.current?.site).toMatchObject({ ownHost: false });
    expect(result.current?.config).toBeUndefined();
  });

  it('useOrgBookingSite_AnswerWithNoAddresses_IsFailedAndNotStillLoading', async () => {
    hasPermission.mockReturnValue(true);
    vi.mocked(DomainApi.getDomain).mockResolvedValue({ ...SERVED, publicUrls: undefined } as unknown as OrgDomainConfig);

    const { result } = renderSite();

    await waitFor(() => expect(result.current?.status).toBe('failed'));
  });

  it('useOrgBookingSite_OrgWithNoSlug_IsNoSite', () => {
    hasPermission.mockReturnValue(false);
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

    const { result } = renderHook(() => useOrgBookingSite(undefined, null), { wrapper });

    expect(result.current).toBeNull();
  });
});
