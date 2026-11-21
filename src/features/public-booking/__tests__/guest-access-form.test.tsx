import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { guestSessionApi } from '@/api/guest-session.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { GuestAccessForm, type GuestAccessProof } from '../guest-access-form';
import { GuestBookingsPage } from '../guest-bookings-page';
import type { GuestBookingDetails, GuestSession, PublicOrgDto } from '@/types';

vi.mock('@/api/guest-session.api', () => ({
  guestSessionApi: { openSession: vi.fn(), getBooking: vi.fn() },
}));
vi.mock('@/api/public-booking.api', () => ({
  publicBookingApi: { sendGuestCheckInLink: vi.fn() },
}));
// The cancellation section of the guest area (DB-08b) is covered by its own test; here its preview never arrives.
vi.mock('@/api/guest-cancellation.api', () => ({
  guestCancellationApi: { getPreview: vi.fn(() => new Promise(() => undefined)), cancel: vi.fn() },
}));

/**
 * NF-143 (E40): the form that opens the guest session takes a second proof, the last four digits of the phone, while the flag `whiteLabelHost` is on. It is one reusable component (the
 * guest-access widget of the embeddable pages shows the same form): what it gives back, what it asks, and what it never lets out of the memory of the form.
 */
const CODE = 'K7M4Q-9XP2H';
const EMAIL = 'giulia@example.com';
const DIGITS = '4821';
const STORAGE_KEY = 'casazen.guestSession.demo-casazen';
const org = { slug: 'demo-casazen', displayName: 'Demo Casazen Stays' } as unknown as PublicOrgDto;

const PHONE_LABEL = 'Ultime 4 cifre del telefono usato per prenotare';
const EMAIL_LABEL = 'Email usata per prenotare';

function flagsOf(whiteLabelHost: boolean) {
  return { flags: { ...DEFAULT_FEATURE_FLAGS, whiteLabelHost }, isLoading: false };
}

function withFlag(whiteLabelHost: boolean, children: ReactNode) {
  return <FeatureFlagsContext.Provider value={flagsOf(whiteLabelHost)}>{children}</FeatureFlagsContext.Provider>;
}

function session(overrides: Partial<GuestSession> = {}): GuestSession {
  return {
    accessToken: 'gs1.token-of-the-session',
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    bookingCode: CODE,
    ...overrides,
  };
}

function booking(overrides: Partial<GuestBookingDetails> = {}): GuestBookingDetails {
  return {
    bookingCode: CODE,
    status: 'Confirmed',
    paymentOption: 'Immediate',
    propertyId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    propertySlug: 'trastevere-suite',
    propertyName: 'Trastevere Suite',
    propertyCity: 'Roma',
    checkInDate: '2026-10-24',
    checkOutDate: '2026-10-27',
    numberOfAdults: 2,
    numberOfChildren: 1,
    lodging: 300,
    cleaningFee: 50,
    touristTax: 12,
    totalPrice: 362,
    paidAmount: 362,
    refundedAmount: 0,
    currency: 'EUR',
    expiresAt: null,
    deferredChargeDate: null,
    host: { name: 'Villa Rosa Srl', email: 'host@villarosa.example' },
    checkIn: { status: 'NotYetOpen', opensOn: '2026-10-21', linkSentAt: null },
    ...overrides,
  };
}

/** The failure of a call: what the sent body held stays in `config.data`, as axios keeps it. */
function problemError(status: number, data?: unknown, sentBody?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders(), public: true, data: sentBody === undefined ? undefined : JSON.stringify(sentBody) };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, { body: sentBody }, { status, statusText: '', headers: {}, config, data });
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function renderForm(whiteLabelHost: boolean, props: { initialCode?: string; pending?: boolean } = {}) {
  const onSubmit = vi.fn<(proof: GuestAccessProof) => void>();
  render(withFlag(whiteLabelHost, <GuestAccessForm initialCode={props.initialCode ?? ''} pending={props.pending ?? false} onSubmit={onSubmit} />));
  return onSubmit;
}

function renderPage(whiteLabelHost: boolean, client = newClient()) {
  const view = render(
    withFlag(
      whiteLabelHost,
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/book/demo-casazen/my-bookings']}>
          <Routes>
            <Route path="/book/:orgSlug" element={<Outlet context={{ org }} />}>
              <Route path="my-bookings" element={<GuestBookingsPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  return { ...view, client };
}

function choosePhone() {
  fireEvent.click(screen.getByRole('radio', { name: 'Ultime 4 cifre del telefono' }));
}

function typeCode(code = CODE) {
  fireEvent.change(screen.getByLabelText('Codice prenotazione'), { target: { value: code } });
}

describe('GuestAccessForm (NF-143)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
    vi.mocked(guestSessionApi.openSession).mockResolvedValue(session());
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('with the flag off', () => {
    it('GuestAccessForm_FlagOff_IsTheEmailFormItAlwaysWas', async () => {
      const onSubmit = renderForm(false, { initialCode: CODE });

      expect(screen.getByLabelText('Codice prenotazione')).toHaveValue(CODE);
      expect(screen.getByLabelText(EMAIL_LABEL)).toHaveAttribute('type', 'email');
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
      expect(screen.queryByLabelText(PHONE_LABEL)).not.toBeInTheDocument();
      expect(screen.queryByText('Come vuoi verificare la prenotazione?')).not.toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(EMAIL_LABEL), { target: { value: ` ${EMAIL} ` } });
      fireEvent.click(screen.getByRole('button', { name: 'Trova la prenotazione' }));

      await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ bookingCode: CODE, email: EMAIL }));
    });

    it('GuestAccessForm_FlagOff_NothingTypedInTheFormCanSendThePhone', async () => {
      const onSubmit = renderForm(false, { initialCode: CODE });
      fireEvent.change(screen.getByLabelText(EMAIL_LABEL), { target: { value: EMAIL } });

      fireEvent.click(screen.getByRole('button', { name: 'Trova la prenotazione' }));

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(Object.keys(onSubmit.mock.calls[0][0]).sort()).toEqual(['bookingCode', 'email']);
    });
  });

  describe('with the flag on', () => {
    it('GuestAccessForm_FlagOn_OffersTheTwoWaysAsARadioGroupStartingWithTheEmail', () => {
      renderForm(true);

      const group = screen.getByRole('group', { name: 'Come vuoi verificare la prenotazione?' });
      const radios = within(group).getAllByRole('radio');
      expect(radios.map((radio) => (radio as HTMLInputElement).checked)).toEqual([true, false]);
      expect(within(group).getByRole('radio', { name: 'E-mail' })).toBeChecked();
      expect(within(group).getByRole('radio', { name: 'Ultime 4 cifre del telefono' })).not.toBeChecked();
      // Real radios of one group: the keyboard moves between them with the arrows.
      expect(new Set(radios.map((radio) => radio.getAttribute('name'))).size).toBe(1);
      expect(screen.getByLabelText(EMAIL_LABEL)).toBeInTheDocument();
      expect(screen.queryByLabelText(PHONE_LABEL)).not.toBeInTheDocument();
    });

    it('GuestAccessForm_PhoneWay_HasOneNumericFieldOfFourDigitsWithALabelAndAHint', () => {
      renderForm(true);

      choosePhone();

      const input = screen.getByLabelText(PHONE_LABEL);
      expect(input).toHaveAttribute('inputmode', 'numeric');
      expect(input).toHaveAttribute('autocomplete', 'off');
      expect(input).toHaveAttribute('maxlength', '4');
      expect(input).not.toHaveAttribute('aria-invalid');
      expect(input).toHaveAccessibleDescription('Sono le ultime quattro cifre del numero di telefono che hai indicato quando hai prenotato.');
      // One proof at a time: the email field is gone, and it is not asked.
      expect(screen.queryByLabelText(EMAIL_LABEL)).not.toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Ultime 4 cifre del telefono' })).toBeChecked();
    });

    it('GuestAccessForm_PhoneWay_SubmitsTheCodeAndTheDigitsWithoutAnEmailKey', async () => {
      const onSubmit = renderForm(true);
      choosePhone();

      typeCode(' k7m4q 9xp2h ');
      fireEvent.change(screen.getByLabelText(PHONE_LABEL), { target: { value: ` ${DIGITS} ` } });
      fireEvent.click(screen.getByRole('button', { name: 'Trova la prenotazione' }));

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      const proof = onSubmit.mock.calls[0][0];
      expect(proof).toEqual({ bookingCode: CODE, phoneLast4: DIGITS });
      // The backend takes exactly one of the two proofs: the key is absent, not empty.
      expect('email' in proof).toBe(false);
      expect(Object.keys(proof).sort()).toEqual(['bookingCode', 'phoneLast4']);
    });

    it.each(['', '1', '123', '12345', '12a4', '12 34', '+39 1', '١٢٣٤'])('GuestAccessForm_PhoneWay_%j_IsBlockedWithAMessage', async (typed) => {
      const onSubmit = renderForm(true, { initialCode: CODE });
      choosePhone();

      fireEvent.change(screen.getByLabelText(PHONE_LABEL), { target: { value: typed } });
      fireEvent.click(screen.getByRole('button', { name: 'Trova la prenotazione' }));

      const input = screen.getByLabelText(PHONE_LABEL);
      await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'));
      expect(screen.getByText('Inserisci esattamente 4 cifre, senza spazi.')).toBeInTheDocument();
      expect(input).toHaveAccessibleDescription(expect.stringContaining('Inserisci esattamente 4 cifre'));
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('GuestAccessForm_PhoneWay_AWrongCodeIsBlockedToo', async () => {
      const onSubmit = renderForm(true);
      choosePhone();

      typeCode('ABC');
      fireEvent.change(screen.getByLabelText(PHONE_LABEL), { target: { value: DIGITS } });
      fireEvent.click(screen.getByRole('button', { name: 'Trova la prenotazione' }));

      expect(await screen.findByText(/Il codice prenotazione è di 10 caratteri/)).toBeInTheDocument();
      expect(screen.getByLabelText('Codice prenotazione')).toHaveAttribute('aria-invalid', 'true');
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('GuestAccessForm_ChangingTheWay_ForgetsWhatWasTypedForTheOtherOneAndWhatWasSaidAboutIt', async () => {
      renderForm(true, { initialCode: CODE });
      choosePhone();
      fireEvent.change(screen.getByLabelText(PHONE_LABEL), { target: { value: '12' } });
      fireEvent.click(screen.getByRole('button', { name: 'Trova la prenotazione' }));
      await screen.findByText('Inserisci esattamente 4 cifre, senza spazi.');

      fireEvent.click(screen.getByRole('radio', { name: 'E-mail' }));

      expect(screen.getByLabelText(EMAIL_LABEL)).toHaveValue('');
      expect(screen.queryByText('Inserisci esattamente 4 cifre, senza spazi.')).not.toBeInTheDocument();
      choosePhone();
      expect(screen.getByLabelText(PHONE_LABEL)).toHaveValue('');
      expect(screen.getByLabelText(PHONE_LABEL)).not.toHaveAttribute('aria-invalid');
      // The booking code is not a proof: it stays.
      expect(screen.getByLabelText('Codice prenotazione')).toHaveValue(CODE);
    });

    it('GuestAccessForm_EmailWayAfterChoosingIt_StillSubmitsTheEmailOnly', async () => {
      const onSubmit = renderForm(true, { initialCode: CODE });
      choosePhone();
      fireEvent.click(screen.getByRole('radio', { name: 'E-mail' }));

      fireEvent.change(screen.getByLabelText(EMAIL_LABEL), { target: { value: EMAIL } });
      fireEvent.click(screen.getByRole('button', { name: 'Trova la prenotazione' }));

      await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ bookingCode: CODE, email: EMAIL }));
      expect('phoneLast4' in onSubmit.mock.calls[0][0]).toBe(false);
    });

    it('GuestAccessForm_RequestOnItsWay_TheFieldsAndTheChoiceWait', () => {
      renderForm(true, { initialCode: CODE, pending: true });

      expect(screen.getByRole('button', { name: 'Ricerca in corso…' })).toBeDisabled();
      expect(screen.getByLabelText(EMAIL_LABEL)).toBeDisabled();
      for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
    });

    it('GuestAccessForm_English_SaysItInEnglish', async () => {
      await i18n.changeLanguage('en');
      renderForm(true);

      expect(screen.getByRole('group', { name: 'How do you want to verify the booking?' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Email' })).toBeChecked();
      fireEvent.click(screen.getByRole('radio', { name: 'Last 4 digits of the phone' }));
      expect(screen.getByLabelText('Last 4 digits of the phone used to book')).toBeInTheDocument();
    });
  });

  describe('on the page of «Le mie prenotazioni»', () => {
    async function openByPhone() {
      choosePhone();
      typeCode();
      fireEvent.change(screen.getByLabelText(PHONE_LABEL), { target: { value: DIGITS } });
      fireEvent.click(screen.getByRole('button', { name: 'Trova la prenotazione' }));
    }

    it('phone way posts phoneLast4 without email and keeps the digits out of storage and URL', async () => {
      const consoleCalls: unknown[][] = [];
      for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
        vi.spyOn(console, method).mockImplementation((...args: unknown[]) => void consoleCalls.push(args));
      }
      vi.mocked(guestSessionApi.getBooking).mockResolvedValue(booking());
      const { client, unmount } = renderPage(true);

      await openByPhone();

      expect(await screen.findByTestId('guest-booking-result')).toBeInTheDocument();
      // The body of the call: the site, the code as the backend expects it, the digits. Nothing else, and no email key at all.
      expect(guestSessionApi.openSession).toHaveBeenCalledTimes(1);
      const body = vi.mocked(guestSessionApi.openSession).mock.calls[0][0];
      expect(body).toEqual({ orgSlug: 'demo-casazen', bookingCode: CODE, phoneLast4: DIGITS });
      expect('email' in body).toBe(false);
      // The session entry of the tab keeps the token, the end of the session and the code: never the digits.
      const stored = window.sessionStorage.getItem(STORAGE_KEY) ?? '';
      expect(Object.keys(JSON.parse(stored)).sort()).toEqual(['accessToken', 'bookingCode', 'expiresAt']);
      expect(stored).not.toContain(DIGITS);
      for (let index = 0; index < window.sessionStorage.length; index += 1) {
        const key = window.sessionStorage.key(index) ?? '';
        expect(`${key}${window.sessionStorage.getItem(key)}`).not.toContain(DIGITS);
      }
      expect(window.localStorage.length).toBe(0);
      // Not in the address, not in a key of the cache of the queries, not in the console.
      expect(window.location.href).not.toContain(DIGITS);
      expect(JSON.stringify(client.getQueryCache().getAll().map((query) => query.queryKey))).not.toContain(DIGITS);
      expect(JSON.stringify(consoleCalls)).not.toContain(DIGITS);
      expect(document.body.innerHTML).not.toContain(DIGITS);

      // The page goes: the cache of the mutations does not keep the proof either.
      unmount();
      await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
    });

    it('PhoneWay_FailedCall_TheCacheOfTheMutationsKeepsTheAnswerButNotTheBodyThatWasSent', async () => {
      const sent = { orgSlug: 'demo-casazen', bookingCode: CODE, phoneLast4: DIGITS };
      vi.mocked(guestSessionApi.openSession).mockRejectedValue(problemError(404, { code: 'guest_booking_not_found', detail: 'x' }, sent));
      const { client } = renderPage(true);

      await openByPhone();

      expect(await screen.findByTestId('guest-bookings-not-found')).toBeInTheDocument();
      const kept = client.getMutationCache().getAll().map((mutation) => mutation.state.error);
      expect(kept).toHaveLength(1);
      // The status and the body of the answer stay (the page turns them into words); the request, which holds the body that was sent, does not.
      const error = kept[0] as AxiosError;
      expect(error.response?.status).toBe(404);
      expect(error.response?.data).toEqual({ code: 'guest_booking_not_found', detail: 'x' });
      expect(error.config?.data).toBeUndefined();
      expect(error.request).toBeUndefined();
      expect(JSON.stringify(error, (_key, value: unknown) => (typeof value === 'function' ? undefined : value))).not.toContain(DIGITS);
    });

    it('the 404 text is identical for both ways', async () => {
      vi.mocked(guestSessionApi.openSession).mockRejectedValue(problemError(404, { code: 'guest_booking_not_found', detail: 'x' }));

      /** What the guest reads when nothing matches, after sending the form one way or the other (a page of its own each time). */
      async function notFoundTextWhen(byPhone: boolean) {
        renderPage(true);
        typeCode();
        if (byPhone) {
          choosePhone();
          fireEvent.change(screen.getByLabelText(PHONE_LABEL), { target: { value: DIGITS } });
        } else {
          fireEvent.change(screen.getByLabelText(EMAIL_LABEL), { target: { value: EMAIL } });
        }
        fireEvent.click(screen.getByRole('button', { name: 'Trova la prenotazione' }));
        const text = (await screen.findByTestId('guest-bookings-not-found')).textContent;
        expect(screen.queryByTestId('guest-bookings-error')).not.toBeInTheDocument();
        cleanup();
        return text;
      }

      const byEmail = await notFoundTextWhen(false);
      const byPhone = await notFoundTextWhen(true);

      expect(guestSessionApi.openSession).toHaveBeenCalledTimes(2);
      expect(byPhone).toBe(byEmail);
      expect(byEmail).toContain('Nessuna prenotazione trovata');
      expect(byEmail).toContain('corrisponde ai dati inseriti');
      // It never hints that the code exists or that one half of the proof is right.
      expect(byEmail).not.toMatch(/telefono|cifre|email non|codice è|esiste/i);
    });

    it.each([
      ['by e-mail', false],
      ['by phone', true],
    ])('the 429 shows the rate-limit message with the minutes (%s)', async (_name, byPhone) => {
      // The lock of a code names the whole window: an hour.
      vi.mocked(guestSessionApi.openSession).mockRejectedValue(problemError(429, { code: 'rate_limited', detail: 'Troppe richieste', retryAfterSeconds: 3600 }));
      renderPage(true);

      typeCode();
      if (byPhone) {
        choosePhone();
        fireEvent.change(screen.getByLabelText(PHONE_LABEL), { target: { value: DIGITS } });
      } else {
        fireEvent.change(screen.getByLabelText(EMAIL_LABEL), { target: { value: EMAIL } });
      }
      fireEvent.click(screen.getByRole('button', { name: 'Trova la prenotazione' }));

      const error = await screen.findByTestId('guest-bookings-error');
      expect(error).toHaveTextContent('Troppi tentativi: riprova tra 60 minuti');
      expect(screen.queryByTestId('guest-bookings-not-found')).not.toBeInTheDocument();
      expect(within(error).queryByRole('button', { name: 'Riprova' })).not.toBeInTheDocument();
      expect(guestSessionApi.openSession).toHaveBeenCalledTimes(1);
    });

    it('PhoneWay_SessionOpenedWithTheDigits_TheCheckInLinkAsksForTheEmailBeforeItIsSent', async () => {
      vi.mocked(guestSessionApi.getBooking).mockResolvedValue(booking({ checkIn: { status: 'Open', opensOn: null, linkSentAt: null } }));
      renderPage(true);

      await openByPhone();

      // The email is not known: the existing branch asks for it, and the button waits for it.
      const checkIn = await screen.findByTestId('guest-booking-check-in');
      expect(within(checkIn).getByLabelText(EMAIL_LABEL)).toBeInTheDocument();
      expect(within(checkIn).getByRole('button', { name: 'Inviami il link' })).toBeDisabled();
    });

    it('EmailWay_SessionOpenedWithTheEmail_TheCheckInLinkDoesNotAskForItAgain', async () => {
      vi.mocked(guestSessionApi.getBooking).mockResolvedValue(booking({ checkIn: { status: 'Open', opensOn: null, linkSentAt: null } }));
      renderPage(true);

      typeCode();
      fireEvent.change(screen.getByLabelText(EMAIL_LABEL), { target: { value: EMAIL } });
      fireEvent.click(screen.getByRole('button', { name: 'Trova la prenotazione' }));

      const checkIn = await screen.findByTestId('guest-booking-check-in');
      expect(within(checkIn).queryByLabelText(EMAIL_LABEL)).not.toBeInTheDocument();
      expect(within(checkIn).getByRole('button', { name: 'Inviami il link' })).toBeEnabled();
    });

    it('PhoneWay_AfterSignOut_TheFormComesBackEmptyOnTheEmailWay', async () => {
      vi.mocked(guestSessionApi.getBooking).mockResolvedValue(booking());
      renderPage(true);
      await openByPhone();
      await screen.findByTestId('guest-booking-result');

      fireEvent.click(screen.getByTestId('guest-bookings-sign-out'));

      expect(screen.getByTestId('guest-bookings-form')).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'E-mail' })).toBeChecked();
      expect(screen.getByLabelText(EMAIL_LABEL)).toHaveValue('');
      choosePhone();
      expect(screen.getByLabelText(PHONE_LABEL)).toHaveValue('');
      expect(document.body.innerHTML).not.toContain(DIGITS);
    });

    it('PhoneWay_TheWordsOfThePage_SpeakOfTheTwoWays', async () => {
      vi.mocked(guestSessionApi.getBooking).mockRejectedValue(problemError(401));
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session()));
      renderPage(true);

      expect(await screen.findByText(/con le ultime 4 cifre del tuo telefono/)).toBeInTheDocument();
      // A session that has ended asks to verify the booking again, not «write your email again» when it was opened with the phone.
      const expired = await screen.findByTestId('guest-bookings-session-expired');
      expect(expired).toHaveTextContent('verifica di nuovo la prenotazione con i tuoi dati');
      expect(expired).not.toHaveTextContent('scrivi di nuovo la tua email');
    });
  });
});
