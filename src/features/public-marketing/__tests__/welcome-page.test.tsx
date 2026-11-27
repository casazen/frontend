import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import { welcomeApi } from '@/api/welcome.api';
import { httpError } from '@/features/leases/__tests__/lease-test-utils';
import type { WelcomePageData } from '@/types/welcome.types';
import { WelcomePage } from '../welcome-page';

vi.mock('@/api/welcome.api', () => ({
  welcomeApi: { getLink: vi.fn(), createLink: vi.fn(), rotateLink: vi.fn(), getPage: vi.fn(), submitConsent: vi.fn() },
}));

/**
 * CRM-03 (NF-90): the page behind the QR code in the apartment. What costs privacy when it is wrong is held here: nothing is ticked before
 * the guest ticks it (the two channels and the declaration of age), the consent is refused without the declaration, what the guest did
 * not consent to is not sent, a consent is for the version of the text the guest read, and the page says the same thing whatever the
 * server answers, so it can never tell who is already a customer.
 */
const TOKEN = 'TEST-benvenuto-villa-lago';
const EMAIL = 'mario.rossi@example.com';
const PHONE = '+39 333 1234567';
const PAGE: WelcomePageData = { orgName: 'Villa Rosa Srl', propertyName: 'Villa Lago', marketingConsentVersion: '2026-11-v1' };

const getPage = vi.mocked(welcomeApi.getPage);
const submitConsent = vi.mocked(welcomeApi.submitConsent);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/benvenuto/${TOKEN}`]}>
        <Routes>
          <Route path="/benvenuto/:token" element={<WelcomePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const field = (testId: string) => screen.getByTestId(testId);
const type = (id: string, value: string) => fireEvent.change(document.getElementById(id) as HTMLInputElement, { target: { value } });
const tick = (testId: string) => fireEvent.click(field(testId));
const isTicked = (testId: string) => field(testId).getAttribute('aria-checked') === 'true';

describe('WelcomePage (CRM-03, NF-90)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    vi.clearAllMocks();
    getPage.mockResolvedValue(PAGE);
  });

  afterEach(() => {
    cleanup();
  });

  it('WelcomePage_WithAConsentVersion_TheBoxesAndTheDeclarationOfAgeStartUnticked', async () => {
    renderPage();

    expect(await screen.findByTestId('welcome-form')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Benvenuto a Villa Lago');
    expect(screen.getByTestId('welcome-page')).toHaveTextContent('Villa Rosa Srl');
    for (const testId of ['welcome-consent-email', 'welcome-consent-whatsapp', 'welcome-adult']) {
      expect(isTicked(testId), testId).toBe(false);
    }
    // WhatsApp waits for a number: disabled, with the reason beside it, until one is typed.
    expect(field('welcome-consent-whatsapp')).toBeDisabled();
    expect(field('welcome-whatsapp-hint')).toBeInTheDocument();
    // The text of the consent is shown with the version the server gave.
    expect(field('welcome-consent-text')).toBeInTheDocument();
    expect(field('welcome-consent-version')).toHaveTextContent('2026-11-v1');
    type('welcome-phone', PHONE);
    expect(field('welcome-consent-whatsapp')).toBeEnabled();
    expect(isTicked('welcome-consent-whatsapp')).toBe(false);
  });

  it('WelcomePage_Form_LinksToThePrivacyNoticeBeforeAnythingIsSent', async () => {
    renderPage();
    const form = await screen.findByTestId('welcome-form');

    // The page collects an address and a number: the notice opens beside the form, in a new tab, so what was typed is not lost.
    const link = within(form).getByRole('link', { name: 'informativa privacy' });
    expect(link).toHaveAttribute('href', '/legale/privacy');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(submitConsent).not.toHaveBeenCalled();
  });

  it('WelcomePage_SubmitWithoutTheDeclarationOfAge_IsRefusedAndNothingIsSent', async () => {
    renderPage();
    await screen.findByTestId('welcome-form');

    type('welcome-email', EMAIL);
    tick('welcome-consent-email');
    fireEvent.click(field('welcome-submit'));

    expect(await screen.findByTestId('welcome-adult-error')).toHaveTextContent('almeno 18 anni');
    expect(submitConsent).not.toHaveBeenCalled();
  });

  it('WelcomePage_SubmitWithNoChannel_IsRefusedAndNothingIsSent', async () => {
    renderPage();
    await screen.findByTestId('welcome-form');

    type('welcome-email', EMAIL);
    tick('welcome-adult');
    fireEvent.click(field('welcome-submit'));

    expect(await screen.findByTestId('welcome-channels-error')).toHaveTextContent('almeno un canale');
    expect(submitConsent).not.toHaveBeenCalled();
  });

  it.each([{ confirmationSent: true }, { confirmationSent: false }, undefined])(
    'WelcomePage_ServerAnswers_%j_TheConfirmationMessageIsTheSame',
    async (answer) => {
      submitConsent.mockResolvedValue(answer as never);
      renderPage();
      await screen.findByTestId('welcome-form');

      type('welcome-email', EMAIL);
      tick('welcome-consent-email');
      tick('welcome-adult');
      fireEvent.click(field('welcome-submit'));

      // The same words whether the address was new, known, confirmed or opted out: the page never reads what the server says it did.
      expect(await screen.findByRole('heading', { level: 1, name: 'Controlla la tua e-mail per confermare' })).toBeInTheDocument();
      expect(screen.getByTestId('welcome-page')).toHaveAttribute('data-state', 'done');
      expect(screen.queryByTestId('welcome-form')).not.toBeInTheDocument();
      expect(submitConsent).toHaveBeenCalledTimes(1);
      expect(submitConsent).toHaveBeenCalledWith(TOKEN, {
        email: EMAIL,
        consentEmail: true,
        consentWhatsApp: false,
        adultConfirmed: true,
        consentVersion: '2026-11-v1',
        language: 'it',
      });
    },
  );

  it('WelcomePage_OnlyWhatsAppTicked_SendsTheNumberAndNotTheAddressTypedForNothing', async () => {
    submitConsent.mockResolvedValue({ confirmationSent: true });
    renderPage();
    await screen.findByTestId('welcome-form');

    // The e-mail box stays unticked: the address typed is not consented to, so it is not sent.
    type('welcome-email', EMAIL);
    type('welcome-phone', PHONE);
    tick('welcome-consent-whatsapp');
    tick('welcome-adult');
    fireEvent.click(field('welcome-submit'));

    await waitFor(() => expect(submitConsent).toHaveBeenCalledTimes(1));
    const [, body] = submitConsent.mock.calls[0];
    expect(body).toEqual({
      phone: PHONE,
      consentEmail: false,
      consentWhatsApp: true,
      adultConfirmed: true,
      consentVersion: '2026-11-v1',
      language: 'it',
    });
    expect(body).not.toHaveProperty('email');
  });

  it('WelcomePage_OnlyWhatsAppTicked_NeedsNoAddressAndTheEndSaysNothingAboutAnEmail', async () => {
    submitConsent.mockResolvedValue({ confirmationSent: true });
    renderPage();
    await screen.findByTestId('welcome-form');

    // The API reads the address only with the E-mail box: a guest who wants WhatsApp only is not asked for one (data minimisation).
    type('welcome-phone', PHONE);
    tick('welcome-consent-whatsapp');
    tick('welcome-adult');
    fireEvent.click(field('welcome-submit'));

    await waitFor(() => expect(submitConsent).toHaveBeenCalledTimes(1));
    expect(submitConsent).toHaveBeenCalledWith(TOKEN, {
      phone: PHONE,
      consentEmail: false,
      consentWhatsApp: true,
      adultConfirmed: true,
      consentVersion: '2026-11-v1',
      language: 'it',
    });
    // No e-mail was asked for, so none is promised: the end does not say «controlla la tua e-mail» (and does not depend on the server's answer).
    expect(await screen.findByRole('heading', { level: 1, name: 'Grazie, abbiamo ricevuto la tua scelta' })).toBeInTheDocument();
    expect(screen.getByTestId('welcome-page')).toHaveAttribute('data-state', 'done');
    expect(screen.getByTestId('welcome-page')).not.toHaveTextContent(/e-mail/i);
  });

  it('WelcomePage_EmailBoxTickedWithoutAValidAddress_IsRefusedOnTheAddressUntilTheBoxIsOffOrTheAddressIsRight', async () => {
    submitConsent.mockResolvedValue({ confirmationSent: true });
    renderPage();
    await screen.findByTestId('welcome-form');

    tick('welcome-consent-email');
    tick('welcome-adult');
    fireEvent.click(field('welcome-submit'));
    expect(await screen.findByText('Inserisci l\'indirizzo email')).toBeInTheDocument();
    expect(submitConsent).not.toHaveBeenCalled();

    type('welcome-email', 'mario@');
    expect(await screen.findByText('Inserisci un indirizzo email valido')).toBeInTheDocument();
    expect(submitConsent).not.toHaveBeenCalled();

    // The address is needed only with this box: with the E-mail box off (and WhatsApp on) its message goes away and the choice goes through.
    type('welcome-phone', PHONE);
    tick('welcome-consent-whatsapp');
    tick('welcome-consent-email');
    await waitFor(() => expect(screen.queryByText('Inserisci un indirizzo email valido')).not.toBeInTheDocument());
    fireEvent.click(field('welcome-submit'));

    await waitFor(() => expect(submitConsent).toHaveBeenCalledTimes(1));
    const [, body] = submitConsent.mock.calls[0];
    expect(body).not.toHaveProperty('email');
    expect(body).toMatchObject({ phone: PHONE, consentEmail: false, consentWhatsApp: true });
  });

  it('WelcomePage_WhatsAppOnANumberWithoutItsCountry_IsRefusedAndNothingIsSentUntilThePrefixIsTyped', async () => {
    submitConsent.mockResolvedValue({ confirmationSent: true });
    renderPage();
    await screen.findByTestId('welcome-form');
    // The hint of the phone asks for the prefix before anything is typed.
    expect(screen.getByText(/prefisso internazionale/)).toBeInTheDocument();

    // The server puts its own calling code in front of such a number: the consent would be recorded for somebody else's phone.
    type('welcome-email', EMAIL);
    type('welcome-phone', '333 1234567');
    tick('welcome-consent-whatsapp');
    tick('welcome-adult');
    fireEvent.click(field('welcome-submit'));

    expect(await screen.findByTestId('welcome-whatsapp-error')).toHaveTextContent('con il prefisso internazionale');
    expect(submitConsent).not.toHaveBeenCalled();

    type('welcome-phone', '0039 333 1234567');
    fireEvent.click(field('welcome-submit'));

    await waitFor(() => expect(submitConsent).toHaveBeenCalledTimes(1));
    expect(submitConsent.mock.calls[0][1]).toMatchObject({ phone: '0039 333 1234567', consentWhatsApp: true });
  });

  it('WelcomePage_NumberWithoutItsCountryButOnlyTheEmailBox_IsNotRefusedAndTheNumberIsNotSent', async () => {
    submitConsent.mockResolvedValue({ confirmationSent: true });
    renderPage();
    await screen.findByTestId('welcome-form');

    // No consent is given on the number, so no prefix is asked and the number does not leave the page.
    type('welcome-email', EMAIL);
    type('welcome-phone', '333 1234567');
    tick('welcome-consent-email');
    tick('welcome-adult');
    fireEvent.click(field('welcome-submit'));

    await waitFor(() => expect(submitConsent).toHaveBeenCalledTimes(1));
    const [, body] = submitConsent.mock.calls[0];
    expect(body).not.toHaveProperty('phone');
    expect(body).toMatchObject({ email: EMAIL, consentEmail: true, consentWhatsApp: false });
  });

  it('WelcomePage_TextChangedWhileReading_ShowsTheNewVersionUntickedAndAsksAgain', async () => {
    getPage.mockResolvedValueOnce(PAGE).mockResolvedValue({ ...PAGE, marketingConsentVersion: '2026-12-v2' });
    submitConsent.mockRejectedValue(httpError(409, { code: 'welcome_consent_outdated' }));
    renderPage();
    await screen.findByTestId('welcome-form');

    type('welcome-email', EMAIL);
    tick('welcome-consent-email');
    tick('welcome-adult');
    fireEvent.click(field('welcome-submit'));

    // What was ticked was for the old text: the new one is shown, with nothing ticked, and nothing was recorded.
    expect(await screen.findByTestId('welcome-submit-error')).toHaveTextContent('aggiornato');
    await waitFor(() => expect(field('welcome-consent-version')).toHaveTextContent('2026-12-v2'));
    expect(isTicked('welcome-consent-email')).toBe(false);
    expect(isTicked('welcome-adult')).toBe(false);
    expect(screen.getByTestId('welcome-page')).toHaveAttribute('data-state', 'ask');
  });

  it('WelcomePage_NoConsentVersion_OnlyWelcomesTheGuestWithNothingToFill', async () => {
    getPage.mockResolvedValue({ ...PAGE, marketingConsentVersion: null });
    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Benvenuto a Villa Lago' })).toBeInTheDocument();
    expect(screen.getByTestId('welcome-page')).toHaveAttribute('data-state', 'welcome');
    expect(screen.getByTestId('welcome-page')).toHaveTextContent('Villa Rosa Srl');
    expect(screen.queryByTestId('welcome-form')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it.each([
    ['WithItsCode', { code: 'welcome_link_invalid' }],
    ['WithoutACode', {}],
  ])('WelcomePage_UnknownOrRevokedLink_404%s_SaysThePageIsNotActive', async (_name, body) => {
    getPage.mockRejectedValue(httpError(404, body));
    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Questa pagina non è attiva' })).toBeInTheDocument();
    expect(screen.getByTestId('welcome-page')).toHaveAttribute('data-state', 'inactive');
    expect(screen.queryByTestId('welcome-form')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('welcome_link_invalid');
  });

  it('WelcomePage_ServerFailure_OffersToTryAgainInsteadOfSayingTheCodeIsNotActive', async () => {
    getPage.mockRejectedValueOnce(httpError(500)).mockResolvedValue(PAGE);
    renderPage();

    const retry = await screen.findByTestId('welcome-retry');
    expect(screen.getByTestId('welcome-page')).toHaveAttribute('data-state', 'error');
    fireEvent.click(retry);

    expect(await screen.findByTestId('welcome-form')).toBeInTheDocument();
  });

  it('WelcomePage_Page_IsNotIndexedByTheSearchEngines', async () => {
    renderPage();
    await screen.findByTestId('welcome-form');

    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
  });
});
