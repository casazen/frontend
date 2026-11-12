import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import { guestMarketingApi } from '@/api/guest-marketing.api';
import { httpError } from '@/features/leases/__tests__/lease-test-utils';
import type { GuestBookingDetails, GuestSession } from '@/types';
import type { GuestMarketing } from '@/types/guest-marketing.types';
import { GuestMarketingSection } from '../guest-marketing-section';

vi.mock('@/api/guest-marketing.api', () => ({
  guestMarketingApi: { get: vi.fn(), save: vi.fn(), resendConfirmation: vi.fn() },
}));

/**
 * NF-90, the guest page. What costs privacy when it is wrong is held here: no switch is on before the guest turns it on (whatever the server
 * knows about the address), a consent is for the version of the text the guest read, an opt-out is asked first and then recorded by the server,
 * and what the page shows is what the server sent, masked.
 */
const CODE = 'K7M4Q-9XP2H';
const SESSION: GuestSession = {
  accessToken: 'gs1.token-of-the-session',
  expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  bookingCode: CODE,
};
const BOOKING = { bookingCode: CODE, status: 'Confirmed', host: { name: 'Villa Rosa Srl', email: 'host@villarosa.example' } } as unknown as GuestBookingDetails;

function marketing(overrides: Partial<GuestMarketing> = {}): GuestMarketing {
  return {
    marketingConsentVersion: '2026-11-v1',
    softOptInNoticeVersion: '2026-11-v1',
    email: { state: 'none', maskedAddress: 'g***@e***.com', canResend: false },
    whatsapp: { state: 'none', maskedPhone: '+39******567' },
    ...overrides,
  };
}

const get = vi.mocked(guestMarketingApi.get);
const save = vi.mocked(guestMarketingApi.save);
const resendConfirmation = vi.mocked(guestMarketingApi.resendConfirmation);

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GuestMarketingSection session={SESSION} booking={BOOKING} />
    </QueryClientProvider>,
  );
}

const emailSwitch = () => screen.getByTestId('guest-marketing-email-switch');
const whatsappSwitch = () => screen.getByTestId('guest-marketing-whatsapp-switch');

describe('GuestMarketingSection (NF-90)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    vi.clearAllMocks();
    get.mockResolvedValue(marketing());
  });

  afterEach(() => {
    cleanup();
  });

  it('GuestMarketingSection_NothingConsentedYet_EverySwitchStartsOffAndNothingCanBeSent', async () => {
    renderSection();

    expect(await screen.findByTestId('guest-marketing')).toBeInTheDocument();
    await screen.findByTestId('guest-marketing-email');
    // Even with an address on the booking, nothing is on until the guest turns it on.
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(2);
    for (const control of switches) expect(control).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('guest-marketing-email-state')).toHaveTextContent('Non iscritto');
    expect(screen.getByTestId('guest-marketing-whatsapp-state')).toHaveTextContent('Non iscritto');
    // The address and the number are the masked ones of the server, and the text of the consent shows with its version.
    expect(screen.getByTestId('guest-marketing-email-value')).toHaveTextContent('g***@e***.com');
    expect(screen.getByTestId('guest-marketing-whatsapp-value')).toHaveTextContent('+39******567');
    expect(screen.getByTestId('guest-marketing-consent-version')).toHaveTextContent('2026-11-v1');
    expect(screen.getByTestId('guest-marketing-save')).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Non voglio ricevere offerte/ })).not.toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  it('GuestMarketingSection_SwitchOnEmail_SendsTheConsentWithTheCurrentVersionAndTheStateBecomesToConfirm', async () => {
    save.mockResolvedValue(marketing({ email: { state: 'pending', maskedAddress: 'g***@e***.com', canResend: true } }));
    renderSection();
    await screen.findByTestId('guest-marketing-email');

    fireEvent.click(emailSwitch());
    expect(emailSwitch()).toHaveAttribute('aria-checked', 'true');
    expect(whatsappSwitch()).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByTestId('guest-marketing-save'));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    // The booking has a real address: none is typed, and only the e-mail channel is named.
    expect(save).toHaveBeenCalledWith(SESSION.accessToken, CODE, { consentVersion: '2026-11-v1', language: 'it', email: { enabled: true } });
    expect(await screen.findByText('Da confermare')).toBeInTheDocument();
    expect(screen.getByTestId('guest-marketing-email')).toHaveAttribute('data-state', 'pending');
    // A choice that waits for its confirmation has no switch to press again, and the confirmation can be asked for again.
    expect(screen.queryByTestId('guest-marketing-email-switch')).not.toBeInTheDocument();
    expect(screen.getByTestId('guest-marketing-resend')).toBeInTheDocument();
  });

  it('GuestMarketingSection_BookingWithNoAddressToShow_AsksForAnAddressAndSendsTheOneTyped', async () => {
    // No address the server can show (the booking has none that is real and the guest never typed one): `maskedAddress` is null.
    get.mockResolvedValue(marketing({ email: { state: 'none', maskedAddress: null, canResend: false } }));
    save.mockResolvedValue(marketing({ email: { state: 'pending', maskedAddress: 'g***@e***.com', canResend: true } }));
    renderSection();
    await screen.findByTestId('guest-marketing-email');

    expect(screen.queryByTestId('guest-marketing-email-value')).not.toBeInTheDocument();
    fireEvent.click(emailSwitch());
    const address = await screen.findByTestId('guest-marketing-address');
    expect(screen.getByTestId('guest-marketing-email')).toHaveTextContent('non si può usare per le offerte');
    fireEvent.click(screen.getByTestId('guest-marketing-save'));

    // No address, no consent: the field says so and nothing is sent.
    expect(await screen.findByText('Scrivi l\'indirizzo e-mail su cui vuoi ricevere le offerte.')).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();

    fireEvent.change(address, { target: { value: ' giulia@example.com ' } });
    fireEvent.click(screen.getByTestId('guest-marketing-save'));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith(SESSION.accessToken, CODE, {
      consentVersion: '2026-11-v1',
      language: 'it',
      email: { enabled: true, address: 'giulia@example.com' },
    });
  });

  it('GuestMarketingSection_ServiceOnlyWithARealAddressAndNumber_ShowsThemMaskedAndAsksForNothing', async () => {
    // «Service only» is also the state of a real address and number of the booking (a direct booking with no notice, a manual one, the
    // check-in): the server uses them, and ignores an address typed beside a real one. So nothing is asked and both are shown.
    get.mockResolvedValue(
      marketing({
        email: { state: 'service_only', maskedAddress: 'g***@e***.com', canResend: false },
        whatsapp: { state: 'service_only', maskedPhone: '+39******567' },
      }),
    );
    save.mockResolvedValue(
      marketing({
        email: { state: 'pending', maskedAddress: 'g***@e***.com', canResend: true },
        whatsapp: { state: 'confirmed', maskedPhone: '+39******567' },
      }),
    );
    renderSection();
    await screen.findByTestId('guest-marketing-email');

    // Where the offers would go is visible before the switch is turned on, for both channels.
    expect(screen.getByTestId('guest-marketing-email-value')).toHaveTextContent('g***@e***.com');
    expect(screen.getByTestId('guest-marketing-whatsapp-value')).toHaveTextContent('+39******567');
    fireEvent.click(emailSwitch());
    fireEvent.click(whatsappSwitch());
    expect(screen.queryByTestId('guest-marketing-address')).not.toBeInTheDocument();
    expect(screen.queryByTestId('guest-marketing-phone')).not.toBeInTheDocument();
    expect(screen.getByTestId('guest-marketing-email')).not.toHaveTextContent('temporaneo del portale');
    fireEvent.click(screen.getByTestId('guest-marketing-save'));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith(SESSION.accessToken, CODE, {
      consentVersion: '2026-11-v1',
      language: 'it',
      email: { enabled: true },
      whatsapp: { enabled: true },
    });
  });

  it('GuestMarketingSection_ForwardAddressRefusedByTheServer_AsksForAnAddressAfterTheRefusalAndSendsTheOneTyped', async () => {
    // The answer cannot tell an OTA forward address from a real one: the server says it with a 422, and only then the address is asked for.
    get.mockResolvedValue(marketing({ email: { state: 'service_only', maskedAddress: 'a***@g***.example', canResend: false } }));
    save
      .mockRejectedValueOnce(httpError(422, { code: 'guest_marketing_email_invalid' }))
      .mockResolvedValue(marketing({ email: { state: 'pending', maskedAddress: 'g***@e***.com', canResend: true } }));
    renderSection();
    await screen.findByTestId('guest-marketing-email');

    fireEvent.click(emailSwitch());
    expect(screen.queryByTestId('guest-marketing-address')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('guest-marketing-save'));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenNthCalledWith(1, SESSION.accessToken, CODE, { consentVersion: '2026-11-v1', language: 'it', email: { enabled: true } });
    expect(await screen.findByTestId('guest-marketing-save-error')).toHaveTextContent('Scrivi un indirizzo e-mail corretto');
    const address = await screen.findByTestId('guest-marketing-address');
    // The switch stays on: the guest only has to type the address.
    expect(emailSwitch()).toHaveAttribute('aria-checked', 'true');

    fireEvent.change(address, { target: { value: 'giulia@example.com' } });
    fireEvent.click(screen.getByTestId('guest-marketing-save'));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save).toHaveBeenNthCalledWith(2, SESSION.accessToken, CODE, {
      consentVersion: '2026-11-v1',
      language: 'it',
      email: { enabled: true, address: 'giulia@example.com' },
    });
  });

  it('GuestMarketingSection_BookingWithNoNumber_AsksForOneWithItsCountryAndSendsTheOneTyped', async () => {
    get.mockResolvedValue(marketing({ whatsapp: { state: 'none', maskedPhone: null } }));
    save.mockResolvedValue(marketing({ whatsapp: { state: 'confirmed', maskedPhone: '+39******567' } }));
    renderSection();
    await screen.findByTestId('guest-marketing-whatsapp');

    fireEvent.click(whatsappSwitch());
    const phone = await screen.findByTestId('guest-marketing-phone');
    expect(screen.getByTestId('guest-marketing-whatsapp')).toHaveTextContent('prefisso internazionale');
    fireEvent.change(phone, { target: { value: ' 333 1234567 ' } });
    fireEvent.click(screen.getByTestId('guest-marketing-save'));

    // The server puts its own calling code in front of a number that does not say its country: nothing is sent, the field says why.
    expect(await screen.findByText(/con il prefisso internazionale, per esempio \+39 333 1234567/)).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();

    fireEvent.change(phone, { target: { value: ' +39 333 1234567 ' } });
    fireEvent.click(screen.getByTestId('guest-marketing-save'));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith(SESSION.accessToken, CODE, {
      consentVersion: '2026-11-v1',
      language: 'it',
      whatsapp: { enabled: true, phone: '+39 333 1234567' },
    });
  });

  it('GuestMarketingSection_SwitchOff_AsksFirstThatItIsFinalThenAsksTheServerToWithdrawTheChannel', async () => {
    get.mockResolvedValue(marketing({ email: { state: 'confirmed', maskedAddress: 'g***@e***.com', canResend: false } }));
    save.mockResolvedValue(marketing({ email: { state: 'withdrawn', maskedAddress: 'g***@e***.com', canResend: false } }));
    renderSection();

    const withdraw = await screen.findByRole('button', { name: 'Non voglio ricevere offerte su E-mail' });
    expect(screen.getByTestId('guest-marketing-email-state')).toHaveTextContent('Confermato');
    // The page says it before the press, and the dialog says it again: it is final, and nothing is sent until the guest agrees.
    expect(screen.getByTestId('guest-marketing-email')).toHaveTextContent('non si può tornare indietro');
    fireEvent.click(withdraw);
    const dialog = await screen.findByRole('dialog', { name: 'Non vuoi più ricevere offerte?' });
    expect(dialog).toHaveTextContent('non si può tornare indietro');
    expect(save).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Sì, non voglio più offerte' }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith(SESSION.accessToken, CODE, { email: { enabled: false }, language: 'it' });
    // What the server recorded is what the page shows: unsubscribed, with no way to switch it on again from here, and WhatsApp untouched.
    await waitFor(() => expect(screen.getByTestId('guest-marketing-email')).toHaveAttribute('data-state', 'withdrawn'));
    expect(screen.getByTestId('guest-marketing-email-state')).toHaveTextContent('Annullato');
    expect(screen.queryByTestId('guest-marketing-email-switch')).not.toBeInTheDocument();
    expect(screen.queryByTestId('guest-marketing-email-withdraw')).not.toBeInTheDocument();
    expect(screen.getByTestId('guest-marketing-whatsapp')).toHaveAttribute('data-state', 'none');
  });

  it('GuestMarketingSection_BackingOutOfTheWithdrawal_SendsNothing', async () => {
    get.mockResolvedValue(marketing({ whatsapp: { state: 'confirmed', maskedPhone: '+39******567' } }));
    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: 'Non voglio ricevere offerte su WhatsApp' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annulla' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByTestId('guest-marketing-whatsapp')).toHaveAttribute('data-state', 'confirmed');
  });

  it('GuestMarketingSection_SoftOptIn_SaysYouReceiveOffersOnSimilarStaysAndCanBeRefused', async () => {
    get.mockResolvedValue(marketing({ email: { state: 'soft_opt_in', maskedAddress: 'g***@e***.com', canResend: false } }));
    renderSection();

    expect(await screen.findByText('Ricevi offerte su soggiorni simili')).toBeInTheDocument();
    // The guest was told, not asked: it is not shown as a switch that is on, and it can be refused.
    expect(screen.queryByTestId('guest-marketing-email-switch')).not.toBeInTheDocument();
    expect(screen.getByTestId('guest-marketing-email-withdraw')).toBeInTheDocument();
  });

  it('GuestMarketingSection_NoConsentVersion_OffersNoSwitchAndNoConsentTextButStillShowsWhereTheChoicesStand', async () => {
    get.mockResolvedValue(
      marketing({ marketingConsentVersion: null, email: { state: 'confirmed', maskedAddress: 'g***@e***.com', canResend: false } }),
    );
    renderSection();

    await screen.findByTestId('guest-marketing-email');
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByTestId('guest-marketing-consent')).not.toBeInTheDocument();
    expect(screen.queryByTestId('guest-marketing-save')).not.toBeInTheDocument();
    expect(screen.getByTestId('guest-marketing-email-state')).toHaveTextContent('Confermato');
    expect(screen.getByTestId('guest-marketing-email-withdraw')).toBeInTheDocument();
  });

  it('GuestMarketingSection_BookingWithNoPreferences404_ShowsNothing', async () => {
    get.mockRejectedValue(httpError(404, { code: 'guest_booking_not_found' }));
    const { container } = renderSection();

    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByTestId('guest-marketing-loading')).not.toBeInTheDocument());
    expect(container).toBeEmptyDOMElement();
  });

  it('GuestMarketingSection_ServerFailure_SaysSoPlainlyAndOffersToTryAgain', async () => {
    get.mockRejectedValueOnce(httpError(500)).mockResolvedValue(marketing());
    renderSection();

    const error = await screen.findByTestId('guest-marketing-error');
    expect(error).toHaveTextContent('Non riusciamo a leggere le tue scelte');
    fireEvent.click(within(error).getByRole('button', { name: 'Riprova' }));

    expect(await screen.findByTestId('guest-marketing-email')).toBeInTheDocument();
  });

  it.each([
    [{ sent: true }, 'Ti abbiamo mandato di nuovo il messaggio'],
    [{ sent: false }, 'Non abbiamo mandato nulla'],
  ])('GuestMarketingSection_PendingConfirmation_AskedAgainAnswers%j_SaysWhatHappened', async (answer, expected) => {
    get.mockResolvedValue(marketing({ email: { state: 'pending', maskedAddress: 'g***@e***.com', canResend: true } }));
    resendConfirmation.mockResolvedValue(answer);
    renderSection();

    fireEvent.click(await screen.findByTestId('guest-marketing-resend'));

    expect(await screen.findByTestId('guest-marketing-resend-result')).toHaveTextContent(expected);
    expect(resendConfirmation).toHaveBeenCalledWith(SESSION.accessToken, CODE);
  });

  it('GuestMarketingSection_TextChangedWhileReading_ShowsTheNewVersionSwitchedOffAndAsksAgain', async () => {
    get.mockResolvedValueOnce(marketing()).mockResolvedValue(marketing({ marketingConsentVersion: '2026-12-v2' }));
    save.mockRejectedValue(httpError(409, { code: 'guest_marketing_consent_outdated' }));
    renderSection();
    await screen.findByTestId('guest-marketing-email');

    fireEvent.click(emailSwitch());
    fireEvent.click(screen.getByTestId('guest-marketing-save'));

    // What was switched on was for the old text: the new one is shown, with nothing on, and nothing was recorded.
    expect(await screen.findByTestId('guest-marketing-save-error')).toHaveTextContent('aggiornato');
    await waitFor(() => expect(screen.getByTestId('guest-marketing-consent-version')).toHaveTextContent('2026-12-v2'));
    expect(emailSwitch()).toHaveAttribute('aria-checked', 'false');
  });
});
