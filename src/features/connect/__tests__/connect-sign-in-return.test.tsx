import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { safeReturnTo } from '@/lib/auth-return-to';
import { LoginPage } from '@/pages/login-page';

/**
 * A visitor who is not signed in opens the page of the plugin (`/app/connect/wordpress?site=…&return=…&state=…&challenge=…&method=S256`): they are sent to the sign-in and come back to this
 * very address, with every parameter (PLG-FE-CONSOLE, NF-201, AC3). The proof is in the style of the repository's own (`protected-route-return`, `login-page`): the protected route hands the whole
 * address to the login, the login hands it to the sign-in service, and once signed in the person lands on the same address.
 */
const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => auth.value }));
vi.mock('@/hooks/use-user-roles', () => ({ useUserRoles: () => [] }));
vi.mock('@/config/demo.config', () => ({ isDemoMode: false }));

// Made-up values: none of them is a code, a state or a credential of anyone.
const PARAMS = {
  site: 'https://www.quokka360.test',
  return: 'https://www.quokka360.test/wp-admin/options-general.php?page=casazen',
  state: 'test-state-0123456789',
  challenge: 'A'.repeat(43),
  method: 'S256',
};
const ADDRESS = `/app/connect/wordpress?${new URLSearchParams(PARAMS).toString()}`;

function Where() {
  const location = useLocation();
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>;
}

function tree(initial: string) {
  return (
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="/app/connect/wordpress"
          element={
            <ProtectedRoute>
              <Where />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/app/choose-context" element={<p data-testid="area-picker" />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('the page of the plugin, signed out and back in (PLG-FE-CONSOLE, AC3)', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    await i18n.changeLanguage('it');
  });

  afterEach(cleanup);

  it('signedOut_TheProtectedRouteHandsTheWholeAddressToTheLogin_AndShowsNothingOfThePage', () => {
    auth.value = { isAuthenticated: false, isLoading: false, user: undefined, login: vi.fn() };
    // The login page is the next stop: here only the address it is given is read.
    render(
      <MemoryRouter initialEntries={[ADDRESS]}>
        <Routes>
          <Route
            path="/app/connect/wordpress"
            element={
              <ProtectedRoute>
                <p>connect page</p>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );

    const login = new URL(screen.getByTestId('where').textContent!, 'https://console.test');
    expect(login.pathname).toBe('/login');
    const returnTo = login.searchParams.get('returnTo')!;
    expect(returnTo).toBe(ADDRESS);
    // Every parameter of the plugin travels with it.
    const carried = new URL(returnTo, 'https://console.test').searchParams;
    for (const [name, value] of Object.entries(PARAMS)) expect(carried.get(name)).toBe(value);
    expect(screen.queryByText('connect page')).not.toBeInTheDocument();
  });

  it('signedOut_TheLoginSendsTheVisitorToTheSignInWithThatSameAddressAsWhereToComeBack', () => {
    const login = vi.fn();
    auth.value = { isAuthenticated: false, isLoading: false, user: undefined, login };

    render(tree(ADDRESS));

    expect(login).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledWith({ returnTo: ADDRESS });
  });

  it('signedIn_TheAddressTheSignInBringsBackIsAcceptedAsItIs', () => {
    // `handleAuthRedirect` of the app reads `appState.returnTo` through `safeReturnTo`: an address of this origin, query included, is kept whole.
    expect(safeReturnTo(ADDRESS)).toBe(ADDRESS);
  });

  it('signedIn_TheLoginOpensTheSameAddressAgain_WithAllTheParameters', () => {
    auth.value = { isAuthenticated: true, isLoading: false, user: { sub: 'auth0|admin' }, login: vi.fn() };

    render(tree(`/login?returnTo=${encodeURIComponent(ADDRESS)}`));

    expect(screen.getByTestId('where').textContent).toBe(ADDRESS);
    expect(screen.queryByTestId('area-picker')).not.toBeInTheDocument();
  });

  it('signedIn_TheAddressOfThePluginIsOpenedAtOnce_WithoutGoingThroughTheLogin', () => {
    auth.value = { isAuthenticated: true, isLoading: false, user: { sub: 'auth0|admin' }, login: vi.fn() };

    render(tree(ADDRESS));

    expect(screen.getByTestId('where').textContent).toBe(ADDRESS);
  });

  it.each(['https://evil.example/app/connect/wordpress', '//evil.example/app/connect/wordpress'])('login_ADestinationOnAnotherSite_%s_IsNeverAReturn', (returnTo) => {
    const login = vi.fn();
    auth.value = { isAuthenticated: false, isLoading: false, user: undefined, login };

    render(tree(`/login?returnTo=${encodeURIComponent(returnTo)}`));

    expect(login).toHaveBeenCalledWith(undefined);
  });
});
