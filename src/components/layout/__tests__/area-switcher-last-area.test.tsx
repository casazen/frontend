import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import { contextsApi, type ContextBootstrapDto } from '@/api/contexts';
import { ACTIVE_CONTEXT_STORAGE_KEY } from '@/contexts/workspace-context';
import { WorkspaceProvider } from '@/contexts/workspace-provider';
import { useWorkspace } from '@/hooks/use-workspace';
import { AreaSwitcher } from '../area-switcher';

vi.mock('@/hooks/use-auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/api/contexts', () => ({ contextsApi: { getContexts: vi.fn() } }));
vi.mock('@/queries/use-users', () => ({
  useCurrentUser: () => ({ org: { id: 'org-1', name: 'Casa Rossi Srl', slug: 'casa-rossi', planTier: 'Pro' }, user: null, planTier: 'Pro', isLoading: false }),
}));

import { useAuth } from '@/hooks/use-auth';

type AuthResult = ReturnType<typeof useAuth>;

const contexts: ContextBootstrapDto[] = [
  { contextKey: 'short-rent', displayName: 'Affitti brevi', roleKey: 'property_owner', permissions: [], defaultRoute: '/app/short-rent' },
  { contextKey: 'long-rent', displayName: 'Affitti lungo termine', roleKey: 'long_term_landlord', permissions: [], defaultRoute: '/app/long-rent/leases' },
];

function Probe() {
  const { isReady, activeContext } = useWorkspace();
  const { pathname } = useLocation();
  if (!isReady) return <p>loading</p>;
  return (
    <>
      <p data-testid="active-context">{activeContext}</p>
      <p data-testid="pathname">{pathname}</p>
      <AreaSwitcher contextKey={activeContext ?? 'short-rent'} />
    </>
  );
}

function mount(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <WorkspaceProvider>
        <Probe />
      </WorkspaceProvider>
    </MemoryRouter>,
  );
}

// "Ricordando l'ultima area": the selector goes through the workspace, which keeps the area in the browser
// (`casazen:active-context`; keeping it on the server too is UI-13).
describe('AreaSwitcher with the workspace (UI-04a)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.mocked(useAuth).mockReturnValue({
      user: { roles: [] },
      isAuthenticated: true,
      isLoading: false,
      getAccessToken: vi.fn(),
    } as unknown as AuthResult);
    vi.mocked(contextsApi.getContexts).mockResolvedValue({ userId: 'u1', contexts });
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('AreaSwitcher_ChoosingAnArea_OpensItsHomeAndRemembersTheArea', async () => {
    mount('/app/short-rent');
    const trigger = await screen.findByTestId('area-switcher');
    expect(screen.getByTestId('active-context')).toHaveTextContent('short-rent');

    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    const other = await screen.findByRole('menuitemradio', { name: /Affitti lunghi/ });
    other.focus();
    fireEvent.keyDown(other, { key: 'Enter' });

    await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent('/app/long-rent/leases'));
    expect(screen.getByTestId('active-context')).toHaveTextContent('long-rent');
    expect(window.localStorage.getItem(ACTIVE_CONTEXT_STORAGE_KEY)).toBe('long-rent');
    // The area name is the one of the app, not the one the backend sends ("Affitti lungo termine").
    expect(screen.getByTestId('area-switcher')).toHaveTextContent('Affitti lunghi');
  });

  it('AreaSwitcher_NextVisit_StartsInTheLastAreaTheUserChose', async () => {
    window.localStorage.setItem(ACTIVE_CONTEXT_STORAGE_KEY, 'long-rent');
    mount('/app/choose-context');

    await waitFor(() => expect(screen.getByTestId('active-context')).toHaveTextContent('long-rent'));
    expect(screen.getByTestId('area-switcher')).toHaveTextContent('Affitti lunghi');
  });
});
