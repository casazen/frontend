import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { contextsApi, type ContextBootstrapDto } from '@/api/contexts';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { ORG_BILLING_ADMIN_PERMISSION } from '@/lib/org-billing-admin';
import { MEMBER_ROLE_KEYS, contextOf } from '@/test/org-contexts';
import { WorkspaceProvider } from '../workspace-provider';

vi.mock('@/hooks/use-auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/api/contexts', () => ({ contextsApi: { getContexts: vi.fn() } }));

type AuthResult = ReturnType<typeof useAuth>;

const getAccessToken = vi.fn();

/** A context of the user, held as the owner unless `roleKey` says it is held as a member of the org. */
function context(
  contextKey: ContextBootstrapDto['contextKey'],
  permissions: string[] = [],
  roleKey?: string,
): ContextBootstrapDto {
  return contextOf(contextKey, roleKey, permissions);
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

  it('hasPermission_LongTermLandlordOnly_IsOrgBillingAdmin', async () => {
    // PL-16 (A1-36): the backend policy OrgBillingAdmin admits the long-rent owner, so the menu shows plan and billing.
    renderWith([context('long-rent', ['property.read', 'lease.read'])]);

    expect(await screen.findByTestId('long-rent')).toHaveTextContent('true');
  });

  it('hasPermission_SupplierOnly_IsNotOrgBillingAdmin', async () => {
    renderWith([context('supplier', ['supplier.inbox.read'])]);

    expect(await screen.findByTestId('long-rent')).toHaveTextContent('false');
    expect(screen.getByTestId('short-rent')).toHaveTextContent('false');
  });

  // AM-00 (S1): a collaborator of the org has the rental context with real permissions, but not the owner's role key:
  // the backend refuses it plan and billing, so the menu must not offer them.
  it.each(MEMBER_ROLE_KEYS)('hasPermission_MemberWithRoleKey_%s_IsNotOrgBillingAdmin', async (roleKey) => {
    renderWith([
      context('short-rent', ['property.read', 'property.write', 'payment.read'], roleKey),
      context('long-rent', ['property.read', 'lease.read'], roleKey),
    ]);

    expect(await screen.findByTestId('short-rent')).toHaveTextContent('false');
    expect(screen.getByTestId('long-rent')).toHaveTextContent('false');
  });
});
