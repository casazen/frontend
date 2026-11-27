import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import { publicOrgApi } from '@/api/public-org.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import type { EmbedMessage } from '@/embed/protocol';
import { GuestAccessForm, type GuestAccessProof } from '@/features/public-booking/guest-access-form';
import { GuestBookingsPage } from '@/features/public-booking/guest-bookings-page';
import { setHostSite } from '@/lib/host-site';
import { toAppPath } from '@/routes/host-site-window';
import type { PublicOrgDto } from '@/types';
import { FRAME_QUERY, PARENT, frameInsideAPage, renderWidgets, spyOnTheBrowserMemory, type FramingPage, type MemorySpies } from './embed-test-kit';

/**
 * The guest-access widget in the frame (E41/F01/US02/T03, NF-144, NF-143): one field, the booking code, and a button that hands the guest to the guest area of the
 * booking site. What costs something when it is wrong is held here: only the code and the language cross the frame (no credential, no session: every script of the
 * page that frames it reads what is posted), the widget asks the server for nothing (so it cannot tell whether a code exists) and keeps nothing in the browser.
 */
vi.mock('@/api/public-org.api', () => ({ publicOrgApi: { getPublicOrg: vi.fn() } }));
// The guest area the widget leads to (its own tests cover it): here only the page that reads `?code=`.
vi.mock('@/api/guest-session.api', () => ({ guestSessionApi: { openSession: vi.fn(), getBooking: vi.fn() } }));
vi.mock('@/api/guest-cancellation.api', () => ({ guestCancellationApi: { getPreview: vi.fn(() => new Promise(() => undefined)), cancel: vi.fn() } }));
// Any call of the API client fails the test: the widget makes none.
const client = vi.hoisted(() => {
  const refuse = () => vi.fn(() => Promise.reject(new Error('the guest-access widget asked the API for something')));
  return { get: refuse(), post: refuse(), put: refuse(), patch: refuse(), delete: refuse(), getPaginated: refuse() };
});
vi.mock('@/api/client', () => ({ ApiClient: client }));

const ORG: PublicOrgDto = { slug: 'villa-rossi', displayName: 'Villa Rossi', logoUrl: null, themeColor: null, contactEmail: null };
const getPublicOrg = vi.mocked(publicOrgApi.getPublicOrg);
const CODE = 'K7M4Q-9XP2H';
const ENTRY = '/embed/villa-rossi/guest-access';

let page: FramingPage;
let spies: MemorySpies | undefined;

function open(search = '', options?: Parameters<typeof renderWidgets>[1]) {
  return renderWidgets(`${ENTRY}?${search ? `${search}&` : ''}${FRAME_QUERY}`, options);
}

const field = () => screen.findByLabelText('Codice prenotazione');
const type = async (value: string) => fireEvent.change(await field(), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Continua' }));
const navigations = () => page.sent('navigate') as EmbedMessage<'navigate'>[];

// The routes load the shell and the widget when they are first needed: here they are loaded before the first test, so that none of them has to wait for it.
beforeAll(async () => {
  await Promise.all([import('../embed-shell'), import('../guest-access-widget')]);
}, 120_000);

beforeEach(async () => {
  getPublicOrg.mockReset().mockResolvedValue(ORG);
  for (const spy of Object.values(client)) spy.mockClear();
  page = frameInsideAPage();
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
  spies?.restore();
  spies = undefined;
  page.restore();
  setHostSite(null);
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('what the widget shows (AC1)', () => {
  it('embedGuestAccess_RendersOneLabelledCodeField_AHelperLineAndOneButton_InItalian', async () => {
    open();

    const input = await field();
    const container = document.body;
    expect(screen.getByTestId('embed-widget-guest-access')).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Gestisci la tua prenotazione' })).toBeInTheDocument();
    expect(screen.getByText(/Lo trovi nell.email di conferma della prenotazione\./)).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Continua' })).toHaveAttribute('type', 'submit');
    // The label is tied to the field, the helper line describes it, and there is no other field to fill in: no e-mail, no phone.
    expect(input).toHaveAttribute('id');
    expect(input).toHaveAccessibleDescription(/email di conferma/);
    expect(container.querySelectorAll('input:not([type="hidden"])')).toHaveLength(1);
    expect(container.querySelector('input[type="email"], input[type="tel"], input[autocomplete="email"], input[autocomplete="tel"]')).toBeNull();
  });

  it('embedGuestAccess_LangEn_IsInEnglish', async () => {
    open('lang=en');

    expect(await screen.findByLabelText('Booking code')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Manage your booking' })).toBeInTheDocument();
    expect(screen.getByText('You find it in the booking confirmation email.')).toBeInTheDocument();
  });
});

describe('the code (AC2)', () => {
  it.each([
    ['empty', '', 'Inserisci il codice prenotazione.'],
    ['spaces only', '   ', 'Inserisci il codice prenotazione.'],
    ['too short', 'ABC', 'Il codice prenotazione è di 10 caratteri'],
    ['an e-mail address', 'mario@rossi.it', 'Il codice prenotazione è di 10 caratteri'],
    ['a letter the alphabet has not', 'UUUUU-UUUUU', 'Il codice prenotazione è di 10 caratteri'],
  ])('embedGuestAccess_%s_ShowsAnAnnouncedInlineErrorAndPostsNothing', async (_label, value, message) => {
    open();
    await page.attach();
    await type(value);

    submit();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(message);
    expect(await field()).toHaveAttribute('aria-invalid', 'true');
    expect(await field()).toHaveAccessibleDescription(new RegExp(message.slice(0, 20)));
    expect(document.activeElement).toBe(await field());
    expect(navigations()).toHaveLength(0);
    expect(page.sent('event')).toHaveLength(0);
  });

  it('embedGuestAccess_TheErrorGoesWhenTheGuestTypesAgain', async () => {
    open();
    await type('ABC');
    submit();
    await screen.findByRole('alert');

    await type('ABCDE-1234');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(await field()).not.toHaveAttribute('aria-invalid');
  });

  it('embedGuestAccess_AcceptsAndRejectsTheSameInputsAsTheFormOfTheGuestArea', async () => {
    const inputs = ['', '   ', 'ABC', 'ABCDE-1234', 'ABCDE-123456', 'K7M4Q-9XP2H', ' k7m4q9xp2h ', 'k7m4q 9xp2h', 'K7M4Q_9XP2H', 'O0O0O-IIII1', 'UUUUU-UUUUU', 'mario@rossi.it', '１２３４５-１２３４５'];

    // What the guest area accepts: its own form, with a valid e-mail so that only the code decides.
    const accepted = new Map<string, boolean>();
    for (const value of inputs) {
      const onSubmit = vi.fn<(proof: GuestAccessProof) => void>();
      const { unmount } = render(
        <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, whiteLabelHost: false }, isLoading: false }}>
          <GuestAccessForm initialCode="" pending={false} onSubmit={onSubmit} />
        </FeatureFlagsContext.Provider>,
      );
      fireEvent.change(screen.getByLabelText('Codice prenotazione'), { target: { value } });
      fireEvent.change(screen.getByLabelText('Email usata per prenotare'), { target: { value: 'giulia@example.com' } });
      fireEvent.click(screen.getByRole('button', { name: 'Trova la prenotazione' }));
      // A form that rejects says so at once, one that accepts calls `onSubmit` after its resolver has run: wait for one or the other.
      await waitFor(() => expect(onSubmit.mock.calls.length > 0 || screen.queryByText(/Il codice prenotazione|Inserisci il codice/) !== null).toBe(true));
      accepted.set(value, onSubmit.mock.calls.length > 0);
      unmount();
    }
    // The control of the proof: both outcomes are in the table.
    expect([...accepted.values()]).toContain(true);
    expect([...accepted.values()]).toContain(false);

    // What the widget accepts: a message that asks the page to leave the frame.
    open();
    await page.attach();
    for (const value of inputs) {
      const before = navigations().length;
      await type(value);
      submit();
      expect(navigations().length > before, `the widget on «${value}»`).toBe(accepted.get(value));
    }
  });
});

describe('where the code goes (AC3, AC4)', () => {
  it('embedGuestAccess_sendsOnlyTheCode', async () => {
    // Whatever the address of the frame carries, the guest's e-mail, phone, a token: none of it is in what the widget sends.
    open('email=mario%40rossi.it&phone=%2B393331234567&token=gs1.secret&surname=Rossi');
    await page.attach();
    await type(' k7m4q 9xp2h ');

    submit();

    const [go] = navigations();
    expect(navigations()).toHaveLength(1);
    expect(go).toEqual({ source: 'casazen', v: 1, type: 'navigate', url: `${window.location.origin}/book/villa-rossi/my-bookings?code=${CODE}&lang=it`, target: 'top' });
    const url = new URL(go.url);
    expect(url.origin).toBe(window.location.origin);
    expect([...url.searchParams.keys()]).toEqual(['code', 'lang']);
    // The code as the guest area writes it, and the language: nothing else in the address, and no other message but the navigation (no event, no credential).
    const said = JSON.stringify(page.posts());
    for (const secret of ['mario', 'Rossi', '393331234567', 'gs1.secret', 'surname', 'phone', 'email', 'token']) expect(said).not.toContain(secret);
    expect(page.sent('event')).toHaveLength(0);
    // To the origin of the page, never to every window.
    expect(page.posts().filter(([message]) => message.type === 'navigate').every(([, target]) => target === PARENT)).toBe(true);
  });

  it('embedGuestAccess_OnAnAgencyDomain_TheUrlIsTheGuestAreaOfTheHostAtItsRoot_WithTheLanguage', async () => {
    setHostSite({ host: 'prenota.villa-rossi.example.test', slug: 'villa-rossi', displayName: 'Villa Rossi', embedEnabled: true });
    renderWidgets(`/embed/guest-access?lang=en&${FRAME_QUERY}`, { mode: 'host' });
    await page.attach();
    fireEvent.change(await screen.findByLabelText('Booking code'), { target: { value: CODE } });

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(navigations()).toHaveLength(1);
    expect(navigations()[0].url).toBe(`${window.location.origin}/my-bookings?code=${CODE}&lang=en`);
  });

  it('embedGuestAccess_TheOrgIsTheOneOfTheFrame_NeverAParameterOfTheAddress', async () => {
    renderWidgets(`/embed/other-site/guest-access?org=villa-rossi&orgSlug=villa-rossi&${FRAME_QUERY}`);
    await page.attach();
    fireEvent.change(await screen.findByLabelText('Codice prenotazione'), { target: { value: CODE } });

    submit();

    expect(new URL(navigations()[0].url).pathname).toBe('/book/other-site/my-bookings');
  });

  it('embedGuestAccess_WithNoLoaderAttached_TheFormGoesOnByItself_AsAGetToTheGuestAreaAimedAtTheTopWindow', async () => {
    open();
    await type(CODE.toLowerCase());
    const form = screen.getByRole('form', { name: 'Gestisci la tua prenotazione' }) as HTMLFormElement;

    // The web does it: a GET of the same origin, in the top window, with the code (as the guest area writes it) and the language as its only two fields.
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('target', '_top');
    expect(form).toHaveAttribute('action', `${window.location.origin}/book/villa-rossi/my-bookings`);
    expect(Object.fromEntries(new FormData(form) as unknown as Iterable<[string, string]>)).toEqual({ code: CODE, lang: 'it' });
    // A click that nobody reads (no loader) is not taken over: the form is not stopped, and nothing is posted.
    const stopped = !fireEvent.submit(form);
    expect(stopped).toBe(false);
    expect(navigations()).toHaveLength(0);
  });

  it('embedGuestAccess_WithNoLoaderAttached_AMalformedCodeIsStoppedAllTheSame', async () => {
    open();
    await type('ABC');
    const form = screen.getByRole('form', { name: 'Gestisci la tua prenotazione' });

    const stopped = !fireEvent.submit(form);

    expect(stopped).toBe(true);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('embedGuestAccess_TheUrlOpensTheGuestAreaWithTheCodePrefilled', async () => {
    open();
    await page.attach();
    await type('k7m4q9xp2h');
    submit();
    const url = new URL(navigations()[0].url);
    cleanup();

    // The page the guest lands on, as the router of the site reads it: `?code=` fills the code field, and nothing is asked of the server before the second proof.
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[`${url.pathname}${url.search}`]}>
          <Routes>
            <Route path="/book/:orgSlug" element={<Outlet context={{ org: ORG }} />}>
              <Route path="my-bookings" element={<GuestBookingsPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByLabelText('Codice prenotazione')).toHaveValue(CODE);
    expect(screen.getByLabelText('Email usata per prenotare')).toHaveValue('');
    expect(screen.queryByTestId('guest-booking-result')).not.toBeInTheDocument();
  });

  it('embedGuestAccess_OnAnAgencyDomain_TheUrlOpensTheGuestAreaOfTheHostWithTheCodePrefilled', async () => {
    setHostSite({ host: 'prenota.villa-rossi.example.test', slug: 'villa-rossi', displayName: 'Villa Rossi', embedEnabled: true });
    renderWidgets(`/embed/guest-access?${FRAME_QUERY}`, { mode: 'host' });
    await page.attach();
    fireEvent.change(await screen.findByLabelText('Codice prenotazione'), { target: { value: CODE } });
    submit();
    const url = new URL(navigations()[0].url);
    cleanup();

    // The router of an agency's domain reads `/my-bookings` as the guest area of its org (`toAppPath`): the page is the one of the site, with the code in its field.
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[`${toAppPath(url.pathname, 'villa-rossi')}${url.search}`]}>
          <Routes>
            <Route path="/book/:orgSlug" element={<Outlet context={{ org: ORG }} />}>
              <Route path="my-bookings" element={<GuestBookingsPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByLabelText('Codice prenotazione')).toHaveValue(CODE);
  });
});

describe('no request, nothing kept (AC5)', () => {
  it('embedGuestAccess_makesNoRequest', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const xhrSpy = vi.spyOn(XMLHttpRequest.prototype, 'open');
    open();
    await page.attach();

    // Everything a guest does with it: a wrong code, a right one, and again.
    await type('ABC');
    submit();
    await screen.findByRole('alert');
    await type(CODE);
    submit();

    expect(navigations()).toHaveLength(1);
    // The shell asked for the org (its own business, once); the widget asked for nothing: it cannot tell whether a code exists, because it never asks.
    expect(getPublicOrg).toHaveBeenCalledTimes(1);
    for (const spy of Object.values(client)) expect(spy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();
  });

  it('embedGuestAccess_noStorageOrCookies', async () => {
    // What the site keeps for the guest area (the session of the booking, the language): the frame neither reads it nor writes anything.
    sessionStorage.setItem('casazen.guestSession.villa-rossi', JSON.stringify({ accessToken: 'gs1.secret', bookingCode: CODE }));
    localStorage.setItem('casazen.locale', 'en');
    open('', { afterRouter: () => (spies = spyOnTheBrowserMemory()) });
    await page.attach();

    await type('ABC');
    submit();
    await screen.findByRole('alert');
    await type(CODE);
    submit();

    expect(navigations()).toHaveLength(1);
    expect(spies?.calls()).toEqual([]);
    sessionStorage.clear();
  });
});

describe('the frame is as tall as the form (AC6)', () => {
  const resizes = () => page.sent('resize') as EmbedMessage<'resize'>[];

  it('embedGuestAccess_TheFrameFollowsTheFormWhenAnErrorAppears', async () => {
    // The wrapper of the frame is the element whose height the page is told: it follows what is in it, the error included. A stand-in for the layout of the browser.
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const observers: { callback: ResizeObserverCallback }[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          observers.push({ callback });
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      // Without the error the form is as tall as its field, its line and its button; with it, one line taller.
      return { height: this.getAttribute('data-testid') === 'embed-shell' ? (screen.queryByRole('alert') ? 168 : 140) : 0 } as DOMRect;
    });
    const flush = () => {
      for (const callback of frames.splice(0)) act(() => callback(0));
    };
    const resized = () => {
      act(() => {
        for (const observer of observers) observer.callback([], {} as ResizeObserver);
      });
      flush();
    };

    open();
    await field();
    flush();
    resized();
    expect(resizes().map((message) => message.height)).toEqual([140]);

    await type('ABC');
    submit();
    await screen.findByRole('alert');
    resized();

    expect(resizes().map((message) => message.height)).toEqual([140, 168]);
    // The widget gives no height of its own: nothing here makes the frame taller or shorter than the form (no height, no `vh`, no scrollbar of its own).
    const root = screen.getByTestId('embed-widget-guest-access');
    expect(root.className).toBe('');
    expect(root.getAttribute('style')).toBeNull();
    for (const element of root.querySelectorAll('*')) expect(element.className.toString()).not.toMatch(/screen|\d(d|s|l)?vh|overflow-y/);
  });
});
