import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { contextsApi, type ContextBootstrapDto } from '@/api/contexts';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { ORG_BILLING_ADMIN_PERMISSION } from '@/lib/org-billing-admin';
import { WorkspaceProvider } from '../workspace-provider';

vi.mock('@/hooks/use-auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/api/contexts', () => ({ contextsApi: { getContexts: vi.fn() } }));

type AuthResult = ReturnType<typeof useAuth>;

const getAccessToken = vi.fn();

function context(contextKey: ContextBootstrapDto['contextKey'], permissions: string[] = []): ContextBootstrapDto {
  return { contextKey, displayName: contextKey, roleKey: contextKey, permissions, defaultRoute: `/app/${contextKey}` };
}

function Probe() {
  const { isReady, hasPermission } = useWorkspace();
  if (!isReady) return <p>loading</p>;
  return (
    <>
      <p data-testid="short-rent">{String(hasPermission('short-rent', ORG_BILLING_ADMIN_PERMISSION))}</p>
      <p data-testid="long-rent">{String(hasPermission('long-rent', ORG_BILLING_ADMIN_PERMISSION))}</p>
    </>
  );
}

function renderWith(contexts: ContextBootstrapDto[]) {
  vi.mocked(useAuth).mockReturnValue({
    user: { roles: [] },
    isAuthenticated: true,
    isLoading: false,
    getAccessToken,
  } as unknown as AuthResult);
  vi.mocked(contextsApi.getContexts).mockResolvedValue({ userId: 'u1', contexts });
  render(
    <MemoryRouter>
      <WorkspaceProvider>
        <Probe />
      </WorkspaceProvider>
    </MemoryRouter>,
  );
}

// TN-3 / PL-12: the org billing administrator is derived from the contexts, like the backend policy OrgBillingAdmin.
describe('WorkspaceProvider org billing administrator', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('hasPermission_HostOwner_IsOrgBillingAdmin', async () => {
    renderWith([context('short-rent', ['property.read'])]);

    expect(await screen.findByTestId('short-rent')).toHaveTextContent('true');
  });

  it('hasPermission_LongTermLandlordOnly_IsNotOrgBillingAdmin', async () => {
    renderWith([context('long-rent', ['property.read', 'lease.read'])]);

    expect(await screen.findByTestId('long-rent')).toHaveTextContent('false');
    expect(screen.getByTestId('short-rent')).toHaveTextContent('false');
  });
});
