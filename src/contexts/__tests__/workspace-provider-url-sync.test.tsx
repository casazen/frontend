import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { contextsApi, type ContextBootstrapDto } from '@/api/contexts';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { ACTIVE_CONTEXT_STORAGE_KEY } from '../workspace-context';
import { WorkspaceProvider } from '../workspace-provider';

vi.mock('@/hooks/use-auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/api/contexts', () => ({ contextsApi: { getContexts: vi.fn() } }));

type AuthResult = ReturnType<typeof useAuth>;

function context(contextKey: ContextBootstrapDto['contextKey']): ContextBootstrapDto {
  return { contextKey, displayName: contextKey, roleKey: contextKey, permissions: [], defaultRoute: `/app/${contextKey}` };
}

const ALL_AREAS = [context('short-rent'), context('long-rent'), context('admin'), context('supplier')];

function Probe() {
  const { isReady, activeContext } = useWorkspace();
  const navigate = useNavigate();
  if (!isReady) return <p>loading</p>;
  return (
    <>
      <p data-testid="active">{activeContext ?? 'none'}</p>
      <button type="button" onClick={() => navigate('/app/supplier/dashboard')}>
        open supplier
      </button>
      <button type="button" onClick={() => navigate('/app/short-rent/bookings')}>
        open short-rent
      </button>
    </>
  );
}

/** A user with `contexts`, who last worked in `stored`, opens `entry`. */
function renderAt(entry: string, contexts: ContextBootstrapDto[], stored: string) {
  window.localStorage.setItem(ACTIVE_CONTEXT_STORAGE_KEY, stored);
  vi.mocked(useAuth).mockReturnValue({
    user: { roles: [] },
    isAuthenticated: true,
    isLoading: false,
    getAccessToken: vi.fn(),
  } as unknown as AuthResult);
  vi.mocked(contextsApi.getContexts).mockResolvedValue({ userId: 'u1', contexts });
  render(
    <MemoryRouter initialEntries={[entry]}>
      <WorkspaceProvider>
        <Probe />
      </WorkspaceProvider>
    </MemoryRouter>,
  );
}

/** Lets the effects that follow the first ready render run, so that a "nothing changed" check is not made too early. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

// The area in the address is the active area of the workspace (the switcher, the profile link of the user menu and the
// login redirect read it): it holds for every area, the supplier console included.
describe('WorkspaceProvider follows the area of the address (UI-00)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it.each([
    ['/app/short-rent/bookings', 'short-rent'],
    ['/app/long-rent/leases', 'long-rent'],
    ['/app/admin/users', 'admin'],
    ['/app/supplier/inbox', 'supplier'],
    ['/app/supplier', 'supplier'],
  ])('WorkspaceProvider_AddressInArea_%s_ActivatesThatArea', async (path, area) => {
    // The user last worked in another area (and has them all).
    renderAt(path, ALL_AREAS, area === 'short-rent' ? 'long-rent' : 'short-rent');

    expect(await screen.findByText(area)).toBeInTheDocument();
    expect(screen.getByTestId('active')).toHaveTextContent(area);
    expect(window.localStorage.getItem(ACTIVE_CONTEXT_STORAGE_KEY)).toBe(area);
  });

  it('WorkspaceProvider_SupplierAddressForADualRoleUser_ActivatesTheSupplierArea', async () => {
    renderAt('/app/supplier/inbox', [context('short-rent'), context('supplier')], 'short-rent');

    expect(await screen.findByText('supplier')).toBeInTheDocument();
    expect(window.localStorage.getItem(ACTIVE_CONTEXT_STORAGE_KEY)).toBe('supplier');
  });

  it('WorkspaceProvider_AddressInAnAreaTheUserDoesNotHave_KeepsTheActiveArea', async () => {
    renderAt('/app/supplier/inbox', [context('short-rent')], 'short-rent');

    expect(await screen.findByText('short-rent')).toBeInTheDocument();
    await settle();
    expect(screen.getByTestId('active')).toHaveTextContent('short-rent');
    expect(window.localStorage.getItem(ACTIVE_CONTEXT_STORAGE_KEY)).toBe('short-rent');
  });

  it('WorkspaceProvider_AddressOutsideTheAreas_KeepsTheActiveArea', async () => {
    renderAt('/app/choose-context', [context('short-rent'), context('supplier')], 'supplier');

    expect(await screen.findByText('supplier')).toBeInTheDocument();
    await settle();
    expect(screen.getByTestId('active')).toHaveTextContent('supplier');
    expect(window.localStorage.getItem(ACTIVE_CONTEXT_STORAGE_KEY)).toBe('supplier');
  });

  it('WorkspaceProvider_UserMovesBetweenAreas_FollowsTheAddress', async () => {
    renderAt('/app/short-rent/bookings', [context('short-rent'), context('supplier')], 'short-rent');
    expect(await screen.findByText('short-rent')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'open supplier' }));
    expect(await screen.findByText('supplier')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'open short-rent' }));
    expect(await screen.findByText('short-rent')).toBeInTheDocument();
  });
});
