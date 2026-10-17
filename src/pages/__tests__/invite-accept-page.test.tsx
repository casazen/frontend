import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { useAuth } from '@/hooks/use-auth';
import type { OrgInvitationLookup } from '@/types/org-team.types';

// The page pulls in the consents step and the whole shell; importing it can take a while on a loaded machine.
configure({ asyncUtilTimeout: 8_000 });
vi.setConfig({ testTimeout: 60_000 });

vi.mock('@/hooks/use-auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: { post: vi.fn(), get: vi.fn() } }));

let InviteAcceptPage: typeof import('../invite-accept-page').InviteAcceptPage;
beforeAll(async () => {
  ({ InviteAcceptPage } = await import('../invite-accept-page'));
}, 240_000);

/** What the backend reads: 64 lowercase hex characters. */
const TOKEN = 'a1'.repeat(32);
const STORAGE_KEY = 'cz-org-invite';
const login = vi.fn();

const LOOKUP: OrgInvitationLookup = {
  orgName: 'Masseria Lume',
  email: 'marta@example.com',
  name: 'Marta Esposito',
  role: 'Collaborator',
  areas: ['short-rent'],
  expiresAt: '2026-10-24T10:00:00Z',
};

function mockAuth(authenticated: boolean) {
  vi.mocked(useAuth).mockReturnValue({
    isLoading: false,
    isAuthenticated: authenticated,
    user: authenticated ? { email: 'marta@example.com' } : undefined,
    login,
    logout: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>);
}

/** The real address bar of jsdom: the page is opened the way the link of the email opens it. */
function openAt(path: string) {
  window.history.pushState({}, '', path);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Routes>
          <Route path="/invite/accept" element={<InviteAcceptPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>,
  );
}

describe('InviteAcceptPage: the secret of the link', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    await i18n.changeLanguage('it');
    mockAuth(false);
    vi.mocked(axios.post).mockResolvedValue({ data: LOOKUP });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('InviteAcceptPage_LinkOfTheEmail_TakesTheTokenOutOfTheAddressAndKeepsItInTheTabOnly', async () => {
    const logged = [vi.spyOn(console, 'log'), vi.spyOn(console, 'info'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')];
    openAt(`/invite/accept?token=${TOKEN}`);

    expect(await screen.findByTestId('invite-accept-signup')).toBeInTheDocument();

    // Out of the address bar and the history entry, in the storage of this tab only.
    await waitFor(() => expect(window.location.search).toBe(''));
    expect(window.location.href).not.toContain(TOKEN);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(TOKEN);
    expect(Object.keys(localStorage)).toHaveLength(0);
    expect(JSON.stringify({ ...localStorage })).not.toContain(TOKEN);
    expect(document.referrer).not.toContain(TOKEN);
    for (const spy of logged) expect(JSON.stringify(spy.mock.calls)).not.toContain(TOKEN);
  });

  it('InviteAcceptPage_Lookup_SendsTheTokenInTheBodyNeverInTheUrl', async () => {
    openAt(`/invite/accept?token=${TOKEN}`);
    await screen.findByTestId('invite-accept-signup');

    expect(axios.post).toHaveBeenCalledTimes(1);
    const [url, body, options] = vi.mocked(axios.post).mock.calls[0];
    expect(url).toBe('/org-invitations/lookup');
    expect(url).not.toContain(TOKEN);
    expect(body).toEqual({ token: TOKEN });
    expect(options).toMatchObject({ public: true });
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('InviteAcceptPage_SignInButton_ReturnsToThePageWithoutTheToken', async () => {
    openAt(`/invite/accept?token=${TOKEN}`);
    fireEvent.click(await screen.findByTestId('invite-accept-signup'));

    expect(login).toHaveBeenCalledWith({ returnTo: '/invite/accept', authorizationParams: { screen_hint: 'signup' } });
    expect(JSON.stringify(login.mock.calls)).not.toContain(TOKEN);
  });

  it('InviteAcceptPage_ReturnFromTheSignIn_UsesTheTokenKeptInTheTab', async () => {
    sessionStorage.setItem(STORAGE_KEY, TOKEN);
    openAt('/invite/accept');

    expect(await screen.findByTestId('invite-accept-signup')).toBeInTheDocument();
    expect(vi.mocked(axios.post).mock.calls[0][1]).toEqual({ token: TOKEN });
  });

  it('InviteAcceptPage_ShowsTheInvitedAddressMaskedNeverWhole', async () => {
    openAt(`/invite/accept?token=${TOKEN}`);
    await screen.findByTestId('invite-accept-signup');

    expect(screen.getByTestId('invite-accept-details')).toHaveTextContent('m***@example.com');
    expect(document.body).not.toHaveTextContent('marta@example.com');
  });

  it('InviteAcceptPage_MalformedToken_ShowsTheLinkThatDoesNotWorkWithoutCallingTheApi', async () => {
    openAt('/invite/accept?token=not-a-token');

    expect(await screen.findByText('Questo link non funziona')).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
