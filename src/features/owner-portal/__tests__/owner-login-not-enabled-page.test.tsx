import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import axios from '@/lib/axios';
import i18n from '@/i18n/config';
import { setHostSite } from '@/lib/host-site';
import { clearOwnerContactToken, peekOwnerContactToken } from '@/lib/owner-contact-invitation';
import { clearOwnerInvitationToken, peekOwnerInvitationToken } from '@/lib/owner-invitation';
import { OwnerLoginNotEnabledPage } from '../owner-login-not-enabled-page';

vi.mock('@/lib/axios', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/axios')>()), default: { post: vi.fn(), get: vi.fn() } }));

/**
 * NF-141: the own domain of an agency has its owner portal on but is not yet registered with the sign-in service. Every address of the portal is this one page: it says the access is
 * not active yet, it asks nothing of the server and it keeps the secret of an invitation link out of the address bar.
 */
/** What the backend issues for an owner invitation: 64 lowercase hex characters. */
const OWNER_TOKEN = 'a7'.repeat(32);
/** What it issues for the invitation of a contact of an owner: 43 URL-safe characters. */
const CONTACT_TOKEN = 'Qx7_aB-9kLmN0pRsTuVwXyZ1234567890AbCdEfGhIj';

/** The page the browser is on, before anything is watching it. */
function openAt(url: string) {
  window.history.replaceState(null, '', url);
}

function renderPage() {
  const router = createBrowserRouter([
    { path: '/portale-proprietari/*', element: <OwnerLoginNotEnabledPage /> },
    { path: '/', element: <p data-testid="site-home" /> },
  ]);
  const view = render(<RouterProvider router={router} />);
  return { router, ...view };
}

describe('OwnerLoginNotEnabledPage (NF-141)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    clearOwnerInvitationToken();
    clearOwnerContactToken();
    setHostSite({ host: 'prenota.villa-rossi.example.test', slug: 'villa-rossi', displayName: 'Villa Rossi' });
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    setHostSite(null);
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('OwnerLoginNotEnabledPage_Italian_SaysTheAccessIsNotActiveYetAndWhoToAskNeverNamingTheSignInService', () => {
    openAt('/portale-proprietari/accedi');
    renderPage();

    const page = screen.getByTestId('owner-login-not-enabled');
    expect(page).toHaveTextContent('L’accesso proprietari su questo sito non è ancora attivo');
    expect(page).toHaveTextContent('Villa Rossi');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Accesso proprietari non ancora attivo');
    expect(page).not.toHaveTextContent(/auth0/i);
    // Not an error screen: no alert, nothing to retry.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('owner-login-not-enabled-home')).toHaveAttribute('href', '/');
  });

  it('OwnerLoginNotEnabledPage_English_SaysTheSameInEnglish', async () => {
    await i18n.changeLanguage('en');
    openAt('/portale-proprietari/accedi');

    renderPage();

    const page = screen.getByTestId('owner-login-not-enabled');
    expect(page).toHaveTextContent('Owner access on this site is not active yet');
    expect(page).toHaveTextContent('Villa Rossi');
    expect(page).not.toHaveTextContent(/auth0/i);
    expect(screen.getByRole('link', { name: 'Back to the site' })).toHaveAttribute('href', '/');
  });

  it.each([
    ['/portale-proprietari/invito', OWNER_TOKEN],
    ['/portale-proprietari/contatto', CONTACT_TOKEN],
  ])('invitation token is not read or stored and leaves the address bar (%s)', async (path, secret) => {
    openAt(`${path}?token=${secret}&resume=portal`);
    const entries = window.history.length;
    const replaceState = vi.spyOn(window.history, 'replaceState');
    const pushState = vi.spyOn(window.history, 'pushState');

    const { router } = renderPage();

    // The query is out of the address bar and out of the router, in place of the entry of the history that held it (no new entry).
    await waitFor(() => expect(window.location.search).toBe(''));
    expect(window.location.pathname).toBe(path);
    expect(window.location.href).not.toContain(secret);
    expect(router.state.location.search).toBe('');
    const written = replaceState.mock.calls.map(([, , url]) => String(url));
    expect(written.length).toBeGreaterThan(0);
    expect(written.every((url) => !url.includes(secret))).toBe(true);
    expect(pushState).not.toHaveBeenCalled();
    expect(window.history.length).toBe(entries);
    // It is not kept in memory for the page of the link, not in the storage of the browser, not in the page, and not sent anywhere.
    expect(peekOwnerInvitationToken()).toBeNull();
    expect(peekOwnerContactToken()).toBeNull();
    expect(Object.keys(localStorage)).toHaveLength(0);
    expect(Object.keys(sessionStorage)).toHaveLength(0);
    expect(document.body.innerHTML).not.toContain(secret);
    expect(axios.post).not.toHaveBeenCalled();
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('OwnerLoginNotEnabledPage_AddressWithNoQuery_LeavesTheHistoryAlone', () => {
    openAt('/portale-proprietari');
    const replaceState = vi.spyOn(window.history, 'replaceState');

    renderPage();

    // The router numbers its first entry (a state with no address); nothing is written to the address bar.
    expect(replaceState.mock.calls.filter(([, , url]) => url !== undefined)).toEqual([]);
    expect(window.location.pathname).toBe('/portale-proprietari');
  });

  it('OwnerLoginNotEnabledPage_Home_LeadsBackToTheSite', async () => {
    openAt('/portale-proprietari/accedi');
    const { router } = renderPage();

    fireEvent.click(screen.getByTestId('owner-login-not-enabled-home'));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await screen.findByTestId('site-home')).toBeInTheDocument();
  });

  it('OwnerLoginNotEnabledPage_Mounted_MarksTheDocumentNoindex', () => {
    openAt('/portale-proprietari/accedi');

    renderPage();

    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,nofollow');
    expect(document.title).toBe('Accesso proprietari non ancora attivo');
  });
});
