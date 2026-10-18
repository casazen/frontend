import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import { useAuth } from '@/hooks/use-auth';
import { acceptHostInvite, lookupHostInvite } from '@/api/host-invites.api';
import { readPendingHostInvite } from '@/lib/host-invite';
import type { HostInviteLookup } from '@/types/host-invites';
import { HostInvitePage } from '../host-invite-page';

vi.mock('@/hooks/use-auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/api/host-invites.api', () => ({ lookupHostInvite: vi.fn(), acceptHostInvite: vi.fn() }));

// A new token per test: the page remembers the tokens it already accepted.
let TOKEN = '';
let counter = 0;
const login = vi.fn();

function mockAuth(authenticated: boolean, isLoading = false) {
  vi.mocked(useAuth).mockReturnValue({
    isLoading,
    isAuthenticated: authenticated,
    user: authenticated ? { email: 'nuovo@example.com' } : undefined,
    login,
  } as unknown as ReturnType<typeof useAuth>);
}

function problem(status: number, code: string) {
  return Object.assign(new Error('detail'), { isAxiosError: true, response: { status, data: { code, detail: 'detail' } } });
}

function renderPage(path = `/invito-host/${TOKEN}`, strict = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const tree = (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/invito-host/:token" element={<HostInvitePage />} />
          <Route path="/" element={<div>home of the app</div>} />
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

const VALID: HostInviteLookup = { valid: true, state: 'Pending', inviterName: 'Maria Rossi', maskedEmail: 'n***o@e***.com' };

describe('HostInvitePage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();
    counter += 1;
    TOKEN = `tok_${String(counter).padStart(4, '0')}${'b'.repeat(36)}`;
    await i18n.changeLanguage('it');
    mockAuth(false);
    vi.mocked(lookupHostInvite).mockResolvedValue(VALID);
    vi.mocked(acceptHostInvite).mockResolvedValue(undefined);
  });

  // ─── Anonymous visitor ───

  it('HostInvitePage_ValidInviteAnonymous_ShowsInviterAndMaskedEmailNeverTheWholeOne', async () => {
    renderPage();

    expect(await screen.findByText('Maria Rossi ti ha invitato su CasaZen')).toBeInTheDocument();
    expect(screen.getByTestId('host-invite-masked-email')).toHaveTextContent('n***o@e***.com');
    expect(document.body).not.toHaveTextContent('nuovo@example.com');
    expect(lookupHostInvite).toHaveBeenCalledWith(TOKEN);
    expect(acceptHostInvite).not.toHaveBeenCalled();
  });

  it('HostInvitePage_ValidInviteAnonymous_KeepsTheTokenInSessionStorageForTheSignup', async () => {
    renderPage();
    await screen.findByTestId('host-invite-signup');

    await waitFor(() => expect(readPendingHostInvite()).toBe(TOKEN));
  });

  it('HostInvitePage_SignupCta_OpensTheNormalSignupAndReturnsToThePage', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('host-invite-signup'));

    expect(login).toHaveBeenCalledWith({
      returnTo: `/invito-host/${TOKEN}`,
      authorizationParams: { screen_hint: 'signup' },
    });
  });

  it('HostInvitePage_LoginCta_OpensTheLoginAndReturnsToThePage', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('host-invite-login'));

    expect(login).toHaveBeenCalledWith({ returnTo: `/invito-host/${TOKEN}` });
  });

  it('HostInvitePage_ValidInviteWithoutInviterName_ShowsTheGenericInvitation', async () => {
    vi.mocked(lookupHostInvite).mockResolvedValue({ valid: true, state: 'Pending' });
    renderPage();

    expect(await screen.findByText('Sei stato invitato su CasaZen')).toBeInTheDocument();
    expect(screen.queryByTestId('host-invite-masked-email')).not.toBeInTheDocument();
  });

  // ─── Unusable states ───

  it.each([
    ['Expired', 'Invito scaduto'],
    ['Revoked', 'Invito revocato'],
    ['Used', 'Invito già usato'],
    ['NotFound', 'Invito non valido'],
    [undefined, 'Invito non valido'],
  ])('HostInvitePage_LookupSays_%s_ShowsTheMatchingMessageAndStoresNothing', async (state, title) => {
    vi.mocked(lookupHostInvite).mockResolvedValue({ valid: false, state });
    renderPage();

    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.queryByTestId('host-invite-signup')).not.toBeInTheDocument();
    expect(readPendingHostInvite()).toBeNull();
    expect(acceptHostInvite).not.toHaveBeenCalled();
  });

  it('HostInvitePage_UnusableInviteWhileSignedIn_NeverCallsAccept', async () => {
    mockAuth(true);
    vi.mocked(lookupHostInvite).mockResolvedValue({ valid: false, state: 'Expired' });
    renderPage();

    expect(await screen.findByText('Invito scaduto')).toBeInTheDocument();
    expect(acceptHostInvite).not.toHaveBeenCalled();
  });

  it('HostInvitePage_MalformedToken_ShowsInvalidWithoutCallingTheApi', async () => {
    renderPage('/invito-host/x');

    expect(await screen.findByText('Invito non valido')).toBeInTheDocument();
    expect(lookupHostInvite).not.toHaveBeenCalled();
  });

  it('HostInvitePage_LookupRefusedWith404_ShowsInvalid', async () => {
    vi.mocked(lookupHostInvite).mockRejectedValue(problem(404, 'not_found'));
    renderPage();

    expect(await screen.findByText('Invito non valido')).toBeInTheDocument();
  });

  it('HostInvitePage_LookupUnreachable_OffersARetry', async () => {
    vi.mocked(lookupHostInvite).mockRejectedValueOnce(problem(503, 'x')).mockResolvedValue(VALID);
    renderPage();

    expect(await screen.findByText('Invito non verificabile')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));

    expect(await screen.findByTestId('host-invite-signup')).toBeInTheDocument();
  });

  // ─── Signed in ───

  it('HostInvitePage_SignedInWithValidInvite_AcceptsOnceAndForgetsTheStoredToken', async () => {
    sessionStorage.setItem('cz-host-invite', TOKEN);
    mockAuth(true);
    renderPage(`/invito-host/${TOKEN}`, true);

    expect(await screen.findByText('Invito accettato')).toBeInTheDocument();
    expect(acceptHostInvite).toHaveBeenCalledTimes(1);
    expect(acceptHostInvite).toHaveBeenCalledWith(TOKEN);
    expect(readPendingHostInvite()).toBeNull();
  });

  it('HostInvitePage_PageOpenedAgainAfterAccepting_DoesNotCallAcceptAgain', async () => {
    mockAuth(true);
    const first = renderPage();
    await screen.findByText('Invito accettato');
    first.unmount();

    renderPage();
    await screen.findByText('Invito accettato');

    expect(acceptHostInvite).toHaveBeenCalledTimes(1);
  });

  it('HostInvitePage_AcceptedContinue_GoesToTheAppWhereTheGuardDecidesTheOnboarding', async () => {
    mockAuth(true);
    renderPage();
    fireEvent.click(await screen.findByTestId('host-invite-continue'));

    expect(await screen.findByText('home of the app')).toBeInTheDocument();
  });

  it('HostInvitePage_AcceptRefused_ShowsTheErrorAndDoesNotRetryByItself', async () => {
    mockAuth(true);
    vi.mocked(acceptHostInvite).mockRejectedValue(problem(409, 'duplicate_invite'));
    renderPage();

    expect(await screen.findByTestId('host-invite-accept-error')).toHaveTextContent(
      'Esiste già un invito in attesa per questa email.',
    );
    expect(screen.queryByRole('button', { name: 'Riprova' })).not.toBeInTheDocument();
    expect(acceptHostInvite).toHaveBeenCalledTimes(1);
    expect(readPendingHostInvite()).toBeNull();
  });

  it('HostInvitePage_AcceptServerError_OffersARetryThatCallsAcceptAgain', async () => {
    mockAuth(true);
    vi.mocked(acceptHostInvite).mockRejectedValueOnce(problem(503, 'x')).mockResolvedValue(undefined);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Riprova' }));

    expect(await screen.findByText('Invito accettato')).toBeInTheDocument();
    expect(acceptHostInvite).toHaveBeenCalledTimes(2);
  });

  it('HostInvitePage_AuthLoading_WaitsWithoutOfferingTheCtas', async () => {
    mockAuth(false, true);
    renderPage();

    expect(await screen.findByRole('status', { name: 'Verifica dell\'invito…' })).toBeInTheDocument();
    expect(screen.queryByTestId('host-invite-signup')).not.toBeInTheDocument();
  });

  it('HostInvitePage_English_ShowsTranslatedTexts', async () => {
    await i18n.changeLanguage('en');
    renderPage();

    expect(await screen.findByText('Maria Rossi invited you to CasaZen')).toBeInTheDocument();
    expect(screen.getByTestId('host-invite-signup')).toHaveTextContent('Create your account');
  });
});
