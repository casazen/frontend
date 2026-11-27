import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, type AxiosResponse } from 'axios';
import i18n from '@/i18n/config';
import en from '@/i18n/locales/en.json';
import it_ from '@/i18n/locales/it.json';
import { SiteConnectionsApi } from '@/api/site-connections.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FEATURE_FLAGS_QUERY_KEY, FeatureFlagsContext } from '@/contexts/feature-flags-context';
import type { SiteConnectionAuthorizeResponse } from '@/types/site-connection.types';
import { SiteConnectionError } from '@/lib/site-connection-error';
import { ConnectWordPressPage } from '../connect-wordpress-page';

vi.mock('@/api/site-connections.api', () => ({ SiteConnectionsApi: { authorize: vi.fn() } }));

const session = vi.hoisted(() => ({
  user: {} as { org: { id: string; name: string; slug: string } | null; isLoading: boolean },
  workspace: {} as { contexts: unknown[]; isReady: boolean; getDefaultRoute: (contextKey: string) => string },
}));
vi.mock('@/queries/use-users', () => ({ useCurrentUser: () => session.user }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => session.workspace }));

// Made-up values: none of them is a code, a state or a credential of anyone.
const SITE = 'https://www.quokka360.test';
const RETURN = 'https://www.quokka360.test/wp-admin/options-general.php?page=casazen';
const STATE = 'test-state-0123456789';
const CHALLENGE = 'A'.repeat(43);
const REDIRECT = `${RETURN}&casazen_code=test-code&state=${STATE}`;
const ANSWER: SiteConnectionAuthorizeResponse = { redirectUrl: REDIRECT, siteUrl: SITE, expiresAt: '2026-11-27T12:05:00Z' };

const OWNER = { contextKey: 'short-rent', displayName: 'Affitti brevi', roleKey: 'property_owner', permissions: [], defaultRoute: '/app/short-rent' };
const COLLABORATOR = { ...OWNER, roleKey: 'property_manager' };

function query(overrides: Record<string, string | null> = {}): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries({ site: SITE, return: RETURN, state: STATE, challenge: CHALLENGE, method: 'S256', ...overrides })) {
    if (value !== null) search.set(name, value);
  }
  return search.toString();
}

interface RenderOptions {
  query?: string;
  siteEmbed?: boolean;
  flagsLoading?: boolean;
  flagsError?: boolean;
}

function renderPage({ query: search = query(), siteEmbed = true, flagsLoading = false, flagsError = false }: RenderOptions = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, siteEmbed }, isLoading: flagsLoading, isError: flagsError }}>
          <MemoryRouter initialEntries={[`/app/connect/wordpress?${search}`]}>
            <Routes>
              <Route path="/app/connect/wordpress" element={<ConnectWordPressPage />} />
              <Route path="/app/short-rent" element={<p data-testid="area-home">home</p>} />
              <Route path="/app/no-access" element={<p data-testid="no-access">no access</p>} />
            </Routes>
          </MemoryRouter>
        </FeatureFlagsContext.Provider>
      </QueryClientProvider>
    </I18nextProvider>,
  );
  return { client, ...view };
}

function problem(status: number, data: Record<string, unknown> = {}) {
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, undefined, undefined, { status, statusText: 'Error', headers: {}, config: {}, data } as unknown as AxiosResponse);
}

const outcome = () => screen.getByTestId('connect-wordpress-page').getAttribute('data-outcome');
const connect = () => screen.getByTestId('connect-confirm');
const cancel = () => screen.getByTestId('connect-cancel');
const assign = vi.fn();

describe('ConnectWordPressPage (PLG-FE-CONSOLE, NF-201)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    session.user = { org: { id: 'org-1', name: 'Quokka360', slug: 'quokka360' }, isLoading: false };
    session.workspace = { contexts: [OWNER], isReady: true, getDefaultRoute: () => '/app/short-rent' };
    vi.mocked(SiteConnectionsApi.authorize).mockResolvedValue(ANSWER);
    vi.stubGlobal('location', { ...window.location, assign });
  });

  afterEach(async () => {
    await act(async () => undefined);
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('the one block it shows', () => {
    it('page_ValidRequestOfAnAdministrator_AsksWhichSiteAndWhichAgency_AndSendsNothingYet', async () => {
      renderPage();

      await screen.findByTestId('connect-wordpress-page');
      expect(outcome()).toBe('consent');
      const title = screen.getByRole('heading', { level: 1 });
      expect(title).toHaveTextContent('Collegare il sito www.quokka360.test a Quokka360?');
      // The site and the agency stand out in the question.
      expect(Array.from(title.querySelectorAll('strong')).map((part) => part.textContent)).toEqual(['www.quokka360.test', 'Quokka360']);
      expect(connect()).toHaveTextContent('Collega');
      expect(connect()).toBeEnabled();
      expect(cancel()).toHaveTextContent('Annulla');
      expect(cancel()).toBeEnabled();
      expect(SiteConnectionsApi.authorize).not.toHaveBeenCalled();
      expect(assign).not.toHaveBeenCalled();
    });

    it('page_SaysWhatThePluginWillAndWillNotBeAbleToDo_AndThatItCanBeDisconnectedAnytime', async () => {
      renderPage();
      await screen.findByTestId('connect-wordpress-page');

      expect(within(screen.getByTestId('connect-allowed')).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        i18n.t('siteConnect.wordpress.allowed.domain'),
        i18n.t('siteConnect.wordpress.allowed.surfaces'),
      ]);
      expect(screen.getByTestId('connect-allowed')).toHaveTextContent('dominio');
      expect(screen.getByTestId('connect-not-allowed')).toHaveTextContent('prenotazioni, ospiti o pagamenti');
      // True for everyone who may connect: «Incorpora nel tuo sito» exists only in the area of short rent, so the plugin's own «Scollega» is named first.
      expect(screen.getByTestId('connect-wordpress-page')).toHaveTextContent('dal plugin o da «Incorpora nel tuo sito»');
    });

    it('page_TheHostIsShownInFull_SoALookAlikeCannotPassForTheSite', async () => {
      renderPage({ query: query({ site: 'https://www.quokka360.test.evil.example:8443', return: 'https://www.quokka360.test.evil.example:8443/wp-admin' }) });
      await screen.findByTestId('connect-wordpress-page');

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Collegare il sito www.quokka360.test.evil.example:8443 a Quokka360?');
    });

    it('page_AnAgencyNameWithMarkup_IsShownAsTextNeverAsMarkup', async () => {
      session.user = { org: { id: 'org-1', name: '<img src=x onerror=alert(1)> & Co', slug: 'quokka360' }, isLoading: false };
      renderPage();
      await screen.findByTestId('connect-wordpress-page');

      const title = screen.getByRole('heading', { level: 1 });
      expect(title.querySelector('img')).toBeNull();
      expect(title).toHaveTextContent('<img src=x onerror=alert(1)> & Co');
    });

    it('page_English_IsAllInEnglish', async () => {
      await i18n.changeLanguage('en');
      renderPage();
      await screen.findByTestId('connect-wordpress-page');

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Connect the site www.quokka360.test to Quokka360?');
      expect(connect()).toHaveTextContent('Connect');
      expect(cancel()).toHaveTextContent('Cancel');
      await i18n.changeLanguage('it');
    });
  });

  describe('«Collega»', () => {
    it('connect_SendsTheRequestOfThePlugin_AndTakesTheWholeWindowToTheAddressOfTheServer', async () => {
      renderPage();
      await screen.findByTestId('connect-wordpress-page');

      fireEvent.click(connect());

      await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
      expect(assign).toHaveBeenCalledWith(REDIRECT);
      expect(SiteConnectionsApi.authorize).toHaveBeenCalledTimes(1);
      // The body of the contract and nothing more: no host of the page, no id, no token.
      expect(SiteConnectionsApi.authorize).toHaveBeenCalledWith('org-1', { siteUrl: SITE, returnUrl: RETURN, state: STATE, codeChallenge: CHALLENGE, codeChallengeMethod: 'S256' });
      // It says it is taking the person back to WordPress, not that the site is connected: the connection is completed there.
      expect(outcome()).toBe('leaving');
      expect(screen.getByRole('status')).toHaveTextContent(i18n.t('siteConnect.wordpress.leaving.description'));
      expect(screen.queryByTestId('connect-confirm')).not.toBeInTheDocument();
    });

    it('connect_NeverFollowsTheReturnOfItsOwnAddress_OnlyTheAddressTheServerAnswered', async () => {
      const answered = 'https://www.quokka360.test/wp-admin/options-general.php?page=casazen&casazen_code=test-code&state=test-state-0123456789&x=1';
      vi.mocked(SiteConnectionsApi.authorize).mockResolvedValue({ ...ANSWER, redirectUrl: answered });
      renderPage();
      await screen.findByTestId('connect-wordpress-page');

      fireEvent.click(connect());

      await waitFor(() => expect(assign).toHaveBeenCalledWith(answered));
      expect(assign).not.toHaveBeenCalledWith(RETURN);
    });

    it.each([
      ['an address on another origin', 'https://evil.example/wp-admin?casazen_code=test-code'],
      ['a name that only starts like the site', 'https://www.quokka360.test.evil.example/wp-admin?casazen_code=test-code'],
      ['the same host on http', 'http://www.quokka360.test/wp-admin?casazen_code=test-code'],
      ['a script', 'javascript:alert(1)'],
      ['an address with a credential', 'https://user:secret@www.quokka360.test/wp-admin?casazen_code=test-code'],
      ['a relative address', '/wp-admin?casazen_code=test-code'],
    ])('connect_TheServerAnswers_%s_NothingIsFollowed_AndTheFailureIsShown', async (_label, redirectUrl) => {
      vi.mocked(SiteConnectionsApi.authorize).mockResolvedValue({ ...ANSWER, redirectUrl });
      renderPage();
      await screen.findByTestId('connect-wordpress-page');

      fireEvent.click(connect());

      expect(await screen.findByTestId('connect-error')).toHaveTextContent(i18n.t('siteConnect.wordpress.failed'));
      expect(assign).not.toHaveBeenCalled();
      // Nothing is claimed as done: the buttons are back for another try.
      expect(outcome()).toBe('consent');
      await waitFor(() => expect(connect()).toBeEnabled());
    });

    it('connect_WhileTheCallIsOnItsWay_BothButtonsAreOff_AndASecondClickSendsNothing', async () => {
      let answer!: (value: SiteConnectionAuthorizeResponse) => void;
      vi.mocked(SiteConnectionsApi.authorize).mockReturnValue(
        new Promise((resolve) => {
          answer = resolve;
        }),
      );
      renderPage();
      const button = await screen.findByTestId('connect-confirm');

      // Two clicks in the very same moment, before the page has had the time to draw the button off.
      act(() => {
        button.click();
        button.click();
      });
      await waitFor(() => expect(SiteConnectionsApi.authorize).toHaveBeenCalledTimes(1));

      await waitFor(() => expect(connect()).toBeDisabled());
      expect(cancel()).toBeDisabled();
      fireEvent.click(connect());
      fireEvent.click(cancel());
      expect(SiteConnectionsApi.authorize).toHaveBeenCalledTimes(1);
      expect(outcome()).toBe('consent');
      expect(assign).not.toHaveBeenCalled();

      await act(async () => answer(ANSWER));
      await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
      expect(SiteConnectionsApi.authorize).toHaveBeenCalledTimes(1);
    });

    it('connect_TooManyRequests429_SaysSoWithTheWordsOfTheWait_AndALaterClickTriesAgain', async () => {
      vi.mocked(SiteConnectionsApi.authorize).mockRejectedValueOnce(problem(429, { code: 'too_many_requests', retryAfterSeconds: 120 }));
      renderPage();
      await screen.findByTestId('connect-wordpress-page');

      fireEvent.click(connect());

      expect(await screen.findByTestId('connect-error')).toHaveTextContent(i18n.t('apiErrors.tooManyRequests'));
      expect(assign).not.toHaveBeenCalled();
      await waitFor(() => expect(connect()).toBeEnabled());

      fireEvent.click(connect());

      await waitFor(() => expect(assign).toHaveBeenCalledWith(REDIRECT));
      expect(SiteConnectionsApi.authorize).toHaveBeenCalledTimes(2);
    });

    it('connect_TheServerFails500_ShowsTheSentenceOfThePage_NotTheTextOfTheServer', async () => {
      vi.mocked(SiteConnectionsApi.authorize).mockRejectedValue(problem(500, { detail: 'System.InvalidOperationException at Casazen.Web in SiteConnectionService' }));
      renderPage();
      await screen.findByTestId('connect-wordpress-page');

      fireEvent.click(connect());

      const alert = await screen.findByTestId('connect-error');
      expect(alert).toHaveTextContent(i18n.t('siteConnect.wordpress.failed'));
      expect(alert).not.toHaveTextContent('InvalidOperationException');
      expect(assign).not.toHaveBeenCalled();
    });

    it('connect_NoAnswerAtAll_SaysTheConnectionIsDown', async () => {
      vi.mocked(SiteConnectionsApi.authorize).mockRejectedValue(new AxiosError('Network Error', AxiosError.ERR_NETWORK));
      renderPage();
      await screen.findByTestId('connect-wordpress-page');

      fireEvent.click(connect());

      expect(await screen.findByTestId('connect-error')).toHaveTextContent(i18n.t('apiErrors.network'));
    });

    it('connect_ThePageNeverBuildsAnAddressFromItsOwnQuery', async () => {
      // The plugin may write anything in `return`: the address the window goes to is the one of the server, and a server that answered another one is not followed.
      vi.mocked(SiteConnectionsApi.authorize).mockResolvedValue({ ...ANSWER, redirectUrl: 'https://evil.example/' });
      renderPage();
      await screen.findByTestId('connect-wordpress-page');

      fireEvent.click(connect());

      await screen.findByTestId('connect-error');
      expect(assign).not.toHaveBeenCalled();
      expect(assign).not.toHaveBeenCalledWith(RETURN);
    });
  });

  describe('«Annulla»', () => {
    it('cancel_SaysTheTabCanBeClosed_AndNothingGoesOutNorMoves', async () => {
      renderPage();
      await screen.findByTestId('connect-wordpress-page');

      fireEvent.click(cancel());

      expect(outcome()).toBe('cancelled');
      expect(screen.getByRole('status')).toHaveTextContent('Puoi chiudere questa scheda e tornare su WordPress');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Annullato');
      expect(SiteConnectionsApi.authorize).not.toHaveBeenCalled();
      expect(assign).not.toHaveBeenCalled();
      // Nothing to press any more: no button, no link to an address nobody checked.
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });

  describe('what the server refuses, and who may not', () => {
    it('refused_400_SaysTheRequestIsNotValid_WithNoButton', async () => {
      vi.mocked(SiteConnectionsApi.authorize).mockRejectedValue(problem(400, { code: 'site_connection_invalid_request' }));
      renderPage();
      await screen.findByTestId('connect-wordpress-page');

      fireEvent.click(connect());

      await waitFor(() => expect(outcome()).toBe('invalid'));
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Richiesta non valida');
      expect(screen.getByTestId('connect-wordpress-page')).toHaveTextContent('Torna al plugin e riprova');
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(assign).not.toHaveBeenCalled();
    });

    it.each([401, 403])('refused_%s_SaysOnlyAnAdministratorOfTheAgencyCanConnect_WithNoButton', async (status) => {
      vi.mocked(SiteConnectionsApi.authorize).mockRejectedValue(problem(status, { code: 'forbidden' }));
      renderPage();
      await screen.findByTestId('connect-wordpress-page');

      fireEvent.click(connect());

      await waitFor(() => expect(outcome()).toBe('admin-only'));
      expect(screen.getByTestId('connect-wordpress-page')).toHaveTextContent('Solo un amministratore dell\'agenzia può collegare un sito');
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(assign).not.toHaveBeenCalled();
    });

    it('notAnAdministrator_SaysWhy_HasNoButton_AndSendsNothing', async () => {
      session.workspace = { contexts: [COLLABORATOR], isReady: true, getDefaultRoute: () => '/app/short-rent' };
      renderPage();

      await screen.findByTestId('connect-wordpress-page');
      expect(outcome()).toBe('admin-only');
      expect(screen.getByTestId('connect-wordpress-page')).toHaveTextContent('Solo un amministratore dell\'agenzia può collegare un sito');
      expect(screen.queryByTestId('connect-confirm')).not.toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      // The site that asked is not even named to someone who cannot answer.
      expect(screen.getByTestId('connect-wordpress-page')).not.toHaveTextContent('quokka360');
      expect(SiteConnectionsApi.authorize).not.toHaveBeenCalled();
    });

    it.each([
      ['the owner of long rent', { contextKey: 'long-rent', displayName: 'Affitti lunghi', roleKey: 'long_term_landlord', permissions: [], defaultRoute: '/app/long-rent' }],
      ['an administrator of the account', { contextKey: 'account', displayName: 'Amministrazione', roleKey: 'org_admin', permissions: [], defaultRoute: '/app/account' }],
    ])('administrator_%s_MayConnect', async (_label, context) => {
      // The same people the server lets in (`RequireOrgBillingAdmin`): not only the owner of short rent.
      session.workspace = { contexts: [context], isReady: true, getDefaultRoute: () => context.defaultRoute };
      renderPage();

      await screen.findByTestId('connect-wordpress-page');
      expect(outcome()).toBe('consent');
    });

    it('noAgency_SaysOnlyAnAdministratorCanConnect', async () => {
      session.user = { org: null, isLoading: false };
      renderPage();

      await screen.findByTestId('connect-wordpress-page');
      expect(outcome()).toBe('admin-only');
      expect(SiteConnectionsApi.authorize).not.toHaveBeenCalled();
    });
  });

  describe('a request that is not valid', () => {
    it.each([
      ['no site', { site: null }],
      ['no return', { return: null }],
      ['no state', { state: null }],
      ['no challenge', { challenge: null }],
      ['no method', { method: null }],
      ['a method that is not S256', { method: 'plain' }],
      ['a site that is not an address', { site: 'www.quokka360.test' }],
      ['a site that is a script', { site: 'javascript:alert(1)' }],
      ['a site with a credential', { site: 'https://www.quokka360.test@evil.example' }],
      ['a return that is a script', { return: 'javascript:alert(1)' }],
    ])('request_%s_IsToldNotValid_WithNoButton_AndNothingGoesOut', async (_label, overrides) => {
      renderPage({ query: query(overrides) });

      await screen.findByTestId('connect-wordpress-page');
      expect(outcome()).toBe('invalid');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Richiesta non valida');
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      // What the plugin wrote is not shown back: it is not a site that can be trusted.
      expect(screen.getByTestId('connect-wordpress-page')).not.toHaveTextContent('evil.example');
      expect(SiteConnectionsApi.authorize).not.toHaveBeenCalled();
    });

    it('request_NoQueryAtAll_IsToldNotValid', async () => {
      renderPage({ query: '' });

      await screen.findByTestId('connect-wordpress-page');
      expect(outcome()).toBe('invalid');
    });
  });

  describe('the flag and the session', () => {
    it('flagOff_TheAddressDoesNotExist_BackToTheAreaAndNothingGoesOut', async () => {
      renderPage({ siteEmbed: false });

      expect(await screen.findByTestId('area-home')).toBeInTheDocument();
      expect(screen.queryByTestId('connect-wordpress-page')).not.toBeInTheDocument();
      expect(SiteConnectionsApi.authorize).not.toHaveBeenCalled();
    });

    it('flagOff_NoRequestIsNeededToLeave_EvenForAnInvalidOne', async () => {
      renderPage({ siteEmbed: false, query: '' });

      expect(await screen.findByTestId('area-home')).toBeInTheDocument();
    });

    it('flagsOnTheirWay_ShowsTheLoadingAndNothingElse', () => {
      renderPage({ flagsLoading: true });

      expect(screen.getByTestId('connect-loading')).toHaveTextContent(i18n.t('siteConnect.wordpress.loading'));
      expect(screen.queryByTestId('connect-wordpress-page')).not.toBeInTheDocument();
      expect(screen.queryByTestId('area-home')).not.toBeInTheDocument();
    });

    it('flagsCouldNotBeRead_SaysNothingIsKnown_NotThatTheFeatureIsOff_AndOffersToTryAgain', async () => {
      const { client } = renderPage({ flagsError: true });
      const refetch = vi.spyOn(client, 'refetchQueries').mockResolvedValue(undefined);

      await screen.findByTestId('connect-wordpress-page');
      expect(outcome()).toBe('unavailable');
      expect(screen.queryByTestId('area-home')).not.toBeInTheDocument();
      expect(screen.queryByTestId('connect-confirm')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('connect-flags-retry'));

      expect(refetch).toHaveBeenCalledWith({ queryKey: FEATURE_FLAGS_QUERY_KEY });
    });

    it('workspaceOnItsWay_ShowsTheLoadingAndNothingElse', () => {
      session.workspace = { contexts: [], isReady: false, getDefaultRoute: () => '/app/short-rent' };
      renderPage();

      expect(screen.getByTestId('connect-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('no-access')).not.toBeInTheDocument();
    });

    it('profileOnItsWay_ShowsTheLoadingAndNothingElse', () => {
      session.user = { org: null, isLoading: true };
      renderPage();

      expect(screen.getByTestId('connect-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('connect-wordpress-page')).not.toBeInTheDocument();
    });

    it('noAreaAtAll_GoesToTheNoAccessPage', async () => {
      session.workspace = { contexts: [], isReady: true, getDefaultRoute: () => '/app/short-rent' };
      renderPage();

      expect(await screen.findByTestId('no-access')).toBeInTheDocument();
    });
  });

  describe('what stays after it', () => {
    it('failure_LeavesNothingOfTheRequestOrOfTheTokenInTheCacheOfTheMutations', async () => {
      const failure = new AxiosError(
        'Request failed',
        AxiosError.ERR_BAD_RESPONSE,
        { headers: { Authorization: 'Bearer test-access-token' }, data: JSON.stringify({ state: STATE, codeChallenge: CHALLENGE }) } as never,
        undefined,
        { status: 500, statusText: 'Error', headers: {}, config: {}, data: { detail: `echo ${STATE}` } } as unknown as AxiosResponse,
      );
      vi.mocked(SiteConnectionsApi.authorize).mockRejectedValue(failure);
      const { client, unmount } = renderPage();
      await screen.findByTestId('connect-wordpress-page');

      fireEvent.click(connect());
      await screen.findByTestId('connect-error');

      // What the cache holds of the failed call is its status, its code and its message: not the request, not the headers of the HTTP client.
      const held = client.getMutationCache().getAll().map((mutation) => mutation.state.error);
      expect(held).toHaveLength(1);
      expect(held[0]).toBeInstanceOf(SiteConnectionError);
      const text = JSON.stringify(held[0], Object.getOwnPropertyNames(held[0]));
      for (const secret of ['test-access-token', STATE, CHALLENGE, 'Authorization']) expect(text).not.toContain(secret);
      expect(held[0]).toMatchObject({ status: 500 });

      // And the call itself does not outlive the page.
      unmount();
      await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
    });

    it('success_TheAddressWithTheCodeDoesNotStayInTheCacheOfTheMutationsOnceThePageIsGone', async () => {
      const { client, unmount } = renderPage();
      await screen.findByTestId('connect-wordpress-page');

      fireEvent.click(connect());
      await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
      unmount();

      await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
    });

    it('page_NeverWritesTheRequestOrTheAnswerAnywhere', async () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      localStorage.clear();
      sessionStorage.clear();
      renderPage();
      await screen.findByTestId('connect-wordpress-page');
      fireEvent.click(connect());
      await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));

      for (const spy of [log, warn, error]) expect(JSON.stringify(spy.mock.calls)).not.toMatch(/test-code|test-state|AAAAAAAA/);
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
      log.mockRestore();
      warn.mockRestore();
      error.mockRestore();
    });
  });
});

describe('the texts of the page', () => {
  const sources = import.meta.glob<string>(['/src/features/connect/*.ts', '/src/features/connect/*.tsx'], { query: '?raw', import: 'default', eager: true });

  /** Every text of a block with the path of its key, and the keys of each of its objects in the order the file has them. */
  function scan(node: unknown, path: string, texts: [string, string][] = [], orders: [string, string[]][] = []) {
    if (typeof node === 'string') texts.push([path, node]);
    else if (node !== null && typeof node === 'object') {
      orders.push([path, Object.keys(node)]);
      for (const [key, value] of Object.entries(node)) scan(value, `${path}.${key}`, texts, orders);
    }
    return { texts, orders };
  }

  it.each([
    ['it', it_],
    ['en', en],
  ] as const)('texts_%s_AreInAlphabeticalOrderNameNoOtherBookingSystemAndNeverConvertACurrency', (_language, locale) => {
    const { texts, orders } = scan(locale.siteConnect, 'siteConnect');
    expect(texts.length).toBeGreaterThan(20);

    for (const [path, keys] of orders) expect(keys, path).toEqual([...keys].sort());
    expect(texts.filter(([, text]) => text.trim() === '').map(([key]) => key)).toEqual([]);
    expect(texts.filter(([, text]) => /kross|booking\.com|airbnb|expedia|octorate|smoobu|lodgify|guesty|hostaway|beds24|vrbo|concordato\s*facile/i.test(text)).map(([key]) => key)).toEqual([]);
    expect(texts.filter(([, text]) => /conver(t|s|ti|sion)|cambio|exchange rate/i.test(text)).map(([key]) => key)).toEqual([]);
  });

  it('texts_BothLanguagesHaveTheSameKeysInTheSameOrder', () => {
    expect(scan(it_.siteConnect, 'siteConnect').texts.map(([key]) => key)).toEqual(scan(en.siteConnect, 'siteConnect').texts.map(([key]) => key));
  });

  it.each([
    ['it', it_],
    ['en', en],
  ] as const)('texts_%s_TheQuestionNamesTheSiteAndTheAgencyInBold', (_language, locale) => {
    expect(locale.siteConnect.wordpress.question).toContain('<strong>{{site}}</strong>');
    expect(locale.siteConnect.wordpress.question).toContain('<strong>{{agency}}</strong>');
  });

  it.each(['it', 'en'] as const)('texts_%s_EveryKeyThePageAsksFor_Exists', (language) => {
    const has = (key: string) => typeof i18n.getResource(language, 'translation', key) === 'string';
    const keys = new Set<string>();
    for (const source of Object.values(sources)) {
      for (const match of source.matchAll(/\bt\(\s*['"]([A-Za-z0-9_.-]+)['"]/g)) keys.add(match[1] ?? '');
      for (const match of source.matchAll(/i18nKey="([A-Za-z0-9_.-]+)"/g)) keys.add(match[1] ?? '');
    }

    expect(keys.size).toBeGreaterThan(15);
    expect([...keys].filter((key) => !has(key))).toEqual([]);
  });

  it('texts_TheCodeOfThePage_NeverUsesADefaultValue', () => {
    // The scan really reaches the code of the page: its parameters, its call and its page.
    expect(Object.keys(sources).length).toBeGreaterThanOrEqual(3);
    expect(Object.values(sources).some((source) => /\bdefaultValue\b/.test(source))).toBe(false);
  });

  it('texts_TheCodeOfThePage_NeverUsesTheStorageOfTheBrowserNorLogsAnything', () => {
    // The request of the plugin and the answer of the server (the one-time code) are held in the page and nowhere else.
    expect(Object.values(sources).some((source) => /localStorage|sessionStorage|document\.cookie|console\./.test(source))).toBe(false);
  });
});
