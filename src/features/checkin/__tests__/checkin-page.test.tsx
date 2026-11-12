import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from 'vitest';
import { act, cleanup, configure, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import { CheckInPage } from '../checkin-page';
import { publicCheckinApi } from '@/api/checkin.api';
import type { PublicCheckInContextDto, PublicCheckInGuestPrefill } from '@/types/public-checkin.types';

vi.mock('@/api/checkin.api', () => ({
  publicCheckinApi: { getContext: vi.fn(), submit: vi.fn(), searchCodes: vi.fn(), setLanguage: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const TOKEN = 'tok-123';

/** Filling several guests over three steps takes a few seconds in jsdom, more on a loaded CI runner. */
const FORM_TEST_TIMEOUT_MS = 30_000;

// Every wait of the file (`findBy*`, `waitFor`) gave up after the 1 s default, which a form this size does not meet on a loaded
// machine. Explicit conditions only, no fixed waits: a wait ends as soon as its condition holds, so the ceiling costs nothing
// when the machine is idle (QA-INFRA-01). Below the test timeout above.
configure({ asyncUtilTimeout: 15_000 });

const booker: PublicCheckInGuestPrefill = {
  type: 'SingleGuest',
  firstName: 'Mario',
  lastName: 'Rossi',
  gender: null,
  dateOfBirth: null,
  bornInItaly: null,
  birthComuneName: '',
  birthCountryName: '',
  citizenshipName: '',
  documentNumberMasked: null,
  documentIssuePlaceName: '',
};

const openContext: PublicCheckInContextDto = {
  completed: false,
  status: 'InCompilazione',
  sessionId: '11111111-1111-1111-1111-111111111111',
  propertyName: 'Villa Demo',
  checkInDate: '2026-10-10T00:00:00Z',
  checkOutDate: '2026-10-12T00:00:00Z',
  declaredGuests: 1,
  guests: [booker],
  availableCodeTables: [],
};

function httpError(status: number, data?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, {
    status,
    data,
    statusText: '',
    headers: {},
    config,
  });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        { initialEntries: [`/checkin/${TOKEN}`] },
        createElement(Routes, null, createElement(Route, { path: '/checkin/:token', element: createElement(CheckInPage) })),
      ),
    ),
  );
  return { ...view, client };
}

function guestCard(index: number) {
  return within(screen.getByTestId(`stay-guest-${index}`));
}

function change(scope: ReturnType<typeof within>, label: RegExp, value: string) {
  fireEvent.change(scope.getByLabelText(label), { target: { value } });
}

interface GuestInput {
  firstName: string;
  lastName?: string;
  gender?: string;
  dateOfBirth?: string;
  bornIn?: 'yes' | 'no';
  place?: string;
}

function fillGuest(index: number, guest: GuestInput) {
  if (!screen.queryByTestId(`stay-guest-${index}`) && screen.queryByTestId('checkin-document-step')) {
    fireEvent.click(screen.getByTestId('checkin-enter-manually'));
  }
  const card = guestCard(index);
  change(card, /^Nome/, guest.firstName);
  change(card, /^Cognome/, guest.lastName ?? 'Bianchi');
  change(card, /^Sesso/, guest.gender ?? 'Female');
  change(card, /^Data di nascita/, guest.dateOfBirth ?? '1992-03-08');
  change(card, /^Luogo di nascita/, guest.bornIn ?? 'yes');
  if ((guest.bornIn ?? 'yes') === 'yes') {
    change(card, /^Comune di nascita/, guest.place ?? 'Firenze');
    change(card, /^Provincia/, 'FI');
  } else {
    change(card, /^Stato di nascita/, guest.place ?? 'Francia');
  }
  change(card, /^Cittadinanza/, 'Italia');
}

/**
 * The form is on screen AND the page has started it from the guests on file. That effect runs after the first render of the context and
 * replaces the cards of the guests (new keys): a card taken before it is detached, and what is typed on it never reaches the form.
 */
async function formReady() {
  await screen.findByTestId('checkin-page');
  if (screen.queryByTestId('checkin-document-step')) {
    fireEvent.click(screen.getByTestId('checkin-enter-manually'));
  }
  await waitFor(() => expect(guestCard(0).getByLabelText(/^Nome/)).toHaveValue('Mario'));
}

async function goToDocuments() {
  fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));
  await screen.findByTestId('stay-guest-0-document');
}

function fillDocument(index: number) {
  const card = within(screen.getByTestId(`stay-guest-${index}-document`));
  change(card, /^Tipo documento/, 'IdentityCard');
  change(card, /^Numero documento/, 'CA12345AB');
  change(card, /^Luogo di rilascio/, 'Firenze');
}

/** Last step: the privacy notice is only shown (legal obligation, no checkbox to tick), then the form is sent. */
async function acceptAndSubmit() {
  await goToConsents();
  fireEvent.click(screen.getByTestId('checkin-submit'));
}

async function goToConsents() {
  fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));
  await screen.findByTestId('checkin-privacy-notice');
}

async function submitSingleGuest() {
  await screen.findByTestId('checkin-page');
  fillGuest(0, { firstName: 'Giulia' });
  await goToDocuments();
  fillDocument(0);
  await acceptAndSubmit();
}

beforeAll(async () => {
  await i18n.changeLanguage('it');
});

afterEach(async () => {
  // The page changes the language of the app for as long as it is on screen and gives it back: a test never leaves it changed.
  cleanup();
  await i18n.changeLanguage('it');
  document.documentElement.lang = 'it';
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(publicCheckinApi.getContext).mockResolvedValue(openContext);
  vi.mocked(publicCheckinApi.searchCodes).mockResolvedValue([]);
});

describe('CheckInPage', () => {
  it('consentStep_alloggiatiIsALegalObligation_showsTheNoticeWithoutAnyRequiredCheckbox', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue({ ...openContext, privacyNoticeVersion: 'notice-2026-10' });
    vi.mocked(publicCheckinApi.submit).mockResolvedValue({ sessionId: openContext.sessionId!, message: 'ok' });
    renderPage();
    await screen.findByTestId('checkin-page');
    fillGuest(0, { firstName: 'Giulia' });
    await goToDocuments();
    fillDocument(0);
    await goToConsents();

    const notice = screen.getByTestId('checkin-privacy-notice');
    expect(notice).toHaveTextContent('obbligo di legge (art. 109 TULPS)');
    expect(notice).toHaveTextContent("art. 6, par. 1, lett. c) del GDPR e non richiede il tuo consenso");
    expect(notice).toHaveTextContent('Versione dell’informativa: notice-2026-10');
    expect(within(notice).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);

    fireEvent.click(screen.getByTestId('checkin-submit'));

    await waitFor(() => expect(publicCheckinApi.submit).toHaveBeenCalledTimes(1));
    const [, payload] = vi.mocked(publicCheckinApi.submit).mock.calls[0];
    expect(payload).not.toHaveProperty('gdprConsent');
    expect(payload.marketingConsentEmail).toBe(false);
    expect(payload.marketingConsentWhatsApp).toBe(false);
  });

  it('marketingConsent_offeredWithAVersion_isOptionalAndSentOnlyWhenTicked', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue({ ...openContext, marketingConsentVersion: 'marketing-2026-10' });
    vi.mocked(publicCheckinApi.submit).mockResolvedValue({ sessionId: openContext.sessionId!, message: 'ok' });
    renderPage();
    await screen.findByTestId('checkin-page');
    fillGuest(0, { firstName: 'Giulia' });
    await goToDocuments();
    fillDocument(0);
    await goToConsents();

    const marketing = screen.getByTestId('checkin-marketing-consent');
    expect(marketing).toHaveTextContent('Facoltativo. Versione del testo: marketing-2026-10');
    const checkboxes = within(marketing).getAllByRole('checkbox');
    expect(checkboxes[0]).not.toBeChecked();
    fireEvent.click(checkboxes[0]);

    // Fill in the required marketing email after ticking the channel (label: "Il tuo indirizzo email *")
    const emailInput = await screen.findByLabelText(/il tuo indirizzo email/i);
    fireEvent.change(emailInput, { target: { value: 'guest@example.com' } });

    fireEvent.click(screen.getByTestId('checkin-submit'));

    await waitFor(() => expect(publicCheckinApi.submit).toHaveBeenCalledTimes(1));
    expect(vi.mocked(publicCheckinApi.submit).mock.calls[0][1].marketingConsentEmail).toBe(true);
  });

  it('marketingConsent_versionNotConfigured_isNotOffered', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    renderPage();
    await screen.findByTestId('checkin-page');
    fillGuest(0, { firstName: 'Giulia' });
    await goToDocuments();
    fillDocument(0);
    await goToConsents();

    expect(screen.queryByTestId('checkin-marketing-consent')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkin-privacy-notice')).not.toHaveTextContent('Versione dell’informativa');
  });

  it('genderSelect_openSession_offersOnlyAlloggiatiValues', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    renderPage();
    await screen.findByTestId('checkin-document-step');
    fireEvent.click(screen.getByTestId('checkin-enter-manually'));
    await screen.findByTestId('stay-guest-0');

    const select = guestCard(0).getByLabelText(/^Sesso/) as HTMLSelectElement;

    expect(Array.from(select.options).map((option) => option.value)).toEqual(['', 'Male', 'Female']);
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual(['Seleziona', 'Maschio', 'Femmina']);
  });

  it('next_missingRequiredFields_showsErrorOnEachFieldAndStaysOnStep', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue({
      ...openContext,
      guests: [{ ...booker, firstName: '', lastName: '' }],
    });
    renderPage();
    await screen.findByTestId('checkin-document-step');
    fireEvent.click(screen.getByTestId('checkin-enter-manually'));
    await screen.findByTestId('stay-guest-0');

    fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));

    expect(await screen.findByText('Seleziona il sesso')).toBeInTheDocument();
    expect(screen.getByText('Nome obbligatorio')).toBeInTheDocument();
    expect(screen.getByText('Data di nascita obbligatoria')).toBeInTheDocument();
    expect(screen.getByText("Indica se l'ospite è nato in Italia o all'estero")).toBeInTheDocument();
    expect(screen.getByText('Cittadinanza obbligatoria')).toBeInTheDocument();
    const gender = guestCard(0).getByLabelText(/^Sesso/);
    expect(gender).toHaveAttribute('aria-invalid', 'true');
    expect(gender).toHaveAttribute('aria-describedby', 'guest-0-gender-error');
    expect(screen.queryByTestId('stay-guest-0-document')).not.toBeInTheDocument();
  });

  it('bornInItaly_conditionalFields_comuneAndProvinceInItalyStateAbroad', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    renderPage();
    await screen.findByTestId('checkin-document-step');
    fireEvent.click(screen.getByTestId('checkin-enter-manually'));
    await screen.findByTestId('stay-guest-0');
    const card = guestCard(0);

    change(card, /^Luogo di nascita/, 'yes');
    expect(card.getByLabelText(/^Comune di nascita/)).toBeInTheDocument();
    expect(card.getByLabelText(/^Provincia/)).toBeInTheDocument();
    expect(card.queryByLabelText(/^Stato di nascita/)).not.toBeInTheDocument();

    change(card, /^Luogo di nascita/, 'no');
    expect(card.getByLabelText(/^Stato di nascita/)).toBeInTheDocument();
    expect(card.queryByLabelText(/^Comune di nascita/)).not.toBeInTheDocument();
  });

  it('submit_familyOfThreeWithAMinor_sendsOneEntryPerGuestHeadFirstAndDocumentOnlyForTheHead', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue({
      ...openContext,
      declaredGuests: 3,
      guests: [{ ...booker, type: 'HeadOfFamily' }],
    });
    vi.mocked(publicCheckinApi.submit).mockResolvedValue({ sessionId: openContext.sessionId!, message: 'ok' });
    renderPage();
    await screen.findByTestId('checkin-document-step');
    fireEvent.click(screen.getByTestId('checkin-enter-manually'));
    await screen.findByTestId('stay-guest-2');

    // The form starts with the declared guests: the head and two family members.
    expect(screen.getByTestId('stay-guest-0-type')).toHaveTextContent('Capofamiglia');
    expect(screen.getByTestId('stay-guest-1-type')).toHaveTextContent('Familiare');
    expect(screen.getByTestId('stay-guest-2-type')).toHaveTextContent('Familiare');
    fillGuest(0, { firstName: 'Giulia', dateOfBirth: '1982-05-01' });
    fillGuest(1, { firstName: 'Marco', gender: 'Male', dateOfBirth: '2018-07-21', bornIn: 'no', place: 'Francia' });
    fillGuest(2, { firstName: 'Anna', dateOfBirth: '1950-01-02' });
    expect(screen.getByTestId('stay-guest-1-minor')).toHaveTextContent('Minore');
    expect(screen.queryByTestId('stay-guest-0-minor')).not.toBeInTheDocument();

    await goToDocuments();
    // Only the head of family carries the document.
    expect(screen.queryByTestId('stay-guest-1-document')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stay-guest-2-document')).not.toBeInTheDocument();
    fillDocument(0);
    await acceptAndSubmit();

    await waitFor(() => expect(publicCheckinApi.submit).toHaveBeenCalledTimes(1));
    const [token, payload] = vi.mocked(publicCheckinApi.submit).mock.calls[0];
    expect(token).toBe(TOKEN);
    expect(payload.guests.map((g) => g.type)).toEqual(['HeadOfFamily', 'FamilyMember', 'FamilyMember']);
    expect(payload.guests.map((g) => g.firstName)).toEqual(['Giulia', 'Marco', 'Anna']);
    expect(payload.guests[0]).toMatchObject({ documentType: 'IdentityCard', documentNumber: 'CA12345AB', documentIssuePlaceName: 'Firenze' });
    expect(payload.guests[1]).toMatchObject({
      bornInItaly: false,
      birthCountryName: 'Francia',
      birthComuneName: '',
      documentType: null,
      documentNumber: null,
    });
    expect(payload.guests[2]).toMatchObject({ bornInItaly: true, birthComuneName: 'Firenze', birthProvince: 'FI', documentNumber: null });
    expect(await screen.findByText('Check-in completato!')).toBeInTheDocument();
  });

  it('addGuestAndStayKind_changesTheKindOfTheOtherGuests', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    renderPage();
    await screen.findByTestId('checkin-document-step');
    fireEvent.click(screen.getByTestId('checkin-enter-manually'));
    await screen.findByTestId('stay-guest-0');

    fireEvent.click(screen.getByTestId('checkin-add-guest'));
    expect(await screen.findByTestId('stay-guest-1-type')).toHaveTextContent('Ospite singolo');

    change(guestCard(0), /^Chi soggiorna/, 'HeadOfGroup');
    await waitFor(() => expect(screen.getByTestId('stay-guest-1-type')).toHaveTextContent('Membro del gruppo'));
    expect(screen.getByTestId('stay-guest-0-type')).toHaveTextContent('Capogruppo');
    expect(screen.getByTestId('checkin-guest-count-mismatch')).toHaveTextContent('1 ospite');

    fireEvent.click(screen.getByTestId('stay-guest-1-remove'));
    await waitFor(() => expect(screen.queryByTestId('stay-guest-1')).not.toBeInTheDocument());
  });

  it('next_familyWithOnlyTheHead_showsTheCompositionErrorOnTheKind', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    renderPage();
    await screen.findByTestId('checkin-document-step');
    fireEvent.click(screen.getByTestId('checkin-enter-manually'));
    await screen.findByTestId('stay-guest-0');
    change(guestCard(0), /^Chi soggiorna/, 'HeadOfFamily');
    fillGuest(0, { firstName: 'Giulia' });

    fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));

    expect(await screen.findByText(/Aggiungi almeno un familiare o un membro del gruppo/)).toBeInTheDocument();
    expect(screen.queryByTestId('stay-guest-0-document')).not.toBeInTheDocument();
  });

  it('codeTablesImported_choosingAnOfficialEntry_sendsItsCode', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue({ ...openContext, availableCodeTables: ['Comuni', 'Stati'] });
    // Synthetic entry (test data, not an official code).
    vi.mocked(publicCheckinApi.searchCodes).mockImplementation(async (_token, list) => {
      if (list === 'stati') return [{ table: 'Stati', code: '100000100', description: 'ITALIA', citizenshipLabel: 'Italiano' }];
      if (list === 'comuni' || list === 'luoghi') return [{ table: 'Comuni', code: '900000001', description: 'TEST Firenze', province: 'FI' }];
      return [];
    });
    vi.mocked(publicCheckinApi.submit).mockResolvedValue({ sessionId: openContext.sessionId!, message: 'ok' });
    renderPage();
    await screen.findByTestId('checkin-document-step');
    fireEvent.click(screen.getByTestId('checkin-enter-manually'));
    await screen.findByTestId('stay-guest-0');
    fillGuest(0, { firstName: 'Giulia', place: 'TE' });

    await waitFor(() => expect(publicCheckinApi.searchCodes).toHaveBeenCalledWith(TOKEN, 'comuni', 'TE'));
    fireEvent.focus(guestCard(0).getByLabelText(/^Comune di nascita/));
    fireEvent.click(await screen.findByRole('option', { name: 'TEST Firenze (FI)' }));
    expect(await screen.findByTestId('guest-0-birthComuneName-code')).toHaveTextContent('900000001');
    fireEvent.focus(guestCard(0).getByLabelText(/^Cittadinanza/));
    fireEvent.click(await guestCard(0).findByRole('option', { name: 'Italiano' }));

    await goToDocuments();
    fillDocument(0);
    fireEvent.focus(within(screen.getByTestId('stay-guest-0-document')).getByLabelText(/^Luogo di rilascio/));
    fireEvent.click(await screen.findByRole('option', { name: 'TEST Firenze (FI)' }));
    await acceptAndSubmit();

    await waitFor(() => expect(publicCheckinApi.submit).toHaveBeenCalledTimes(1));
    const [, payload] = vi.mocked(publicCheckinApi.submit).mock.calls[0];
    expect(payload.guests[0]).toMatchObject({ birthComuneName: 'TEST Firenze', birthComuneCode: '900000001', birthProvince: 'FI' });
  });

  it('submit_serverValidationProblem_showsServerErrorsOnTheirGuestFields', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(publicCheckinApi.submit).mockRejectedValue(
      httpError(400, {
        code: 'validation_error',
        errors: {
          'Guests[0].Gender': ['Seleziona maschio o femmina: sono gli unici valori accettati da Alloggiati Web.'],
          'Guests[0].DocumentNumber': ['Campo obbligatorio.'],
        },
      }),
    );
    renderPage();

    await submitSingleGuest();

    // Back to the first step with an error: the gender field shows the server message.
    expect(
      await screen.findByText('Seleziona maschio o femmina: sono gli unici valori accettati da Alloggiati Web.'),
    ).toBeInTheDocument();
    expect(guestCard(0).getByLabelText(/^Sesso/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('checkin-submit-error')).toHaveTextContent('correggi i campi evidenziati');

    fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));
    const document = within(await screen.findByTestId('stay-guest-0-document'));
    expect(document.getByText('Campo obbligatorio.')).toBeInTheDocument();
    expect(document.getByLabelText(/^Numero documento/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('submit_errorWithoutFieldErrors_showsProblemMessageInline', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(publicCheckinApi.submit).mockRejectedValue(
      httpError(400, { code: 'bad_request', detail: 'Richiesta non valida per questo soggiorno.' }),
    );
    renderPage();

    await submitSingleGuest();

    expect(await screen.findByTestId('checkin-submit-error')).toHaveTextContent('Richiesta non valida per questo soggiorno.');
  });

  it('submit_alreadySubmittedConflict_showsAlreadyCompletedState', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(publicCheckinApi.submit).mockRejectedValue(
      httpError(409, { code: 'checkin_already_submitted', detail: 'Il check-in è già stato completato.' }),
    );
    renderPage();
    await screen.findByTestId('checkin-page');
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue({ completed: true, status: 'AlloggiatiInviato' });

    fillGuest(0, { firstName: 'Giulia' });
    await goToDocuments();
    fillDocument(0);
    await acceptAndSubmit();

    expect(await screen.findByText('Check-in già completato')).toBeInTheDocument();
  });

  it('completedContext_showsAlreadyCompletedWithoutFormOrGuestData', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue({ completed: true, status: 'Completo' });

    renderPage();

    expect(await screen.findByText('Check-in già completato')).toBeInTheDocument();
    expect(screen.getByText(/non vengono più mostrati/)).toBeInTheDocument();
    expect(screen.queryByTestId('guest-data-form')).not.toBeInTheDocument();
    expect(screen.queryByText('Link non valido')).not.toBeInTheDocument();
  });

  it('prefill_maskedDocumentNumber_isShownAsHintAndNeverPrefilled', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue({
      ...openContext,
      guests: [
        {
          ...booker,
          gender: 'Male',
          dateOfBirth: '1985-03-10T00:00:00Z',
          bornInItaly: true,
          birthComuneName: 'Milano',
          birthProvince: 'MI',
          citizenshipName: 'Italia',
          documentType: 'Passport',
          documentNumberMasked: '*****456',
          documentIssuePlaceName: 'Milano',
        },
      ],
    });
    renderPage();
    await screen.findByTestId('checkin-document-step');
    fireEvent.click(screen.getByTestId('checkin-enter-manually'));
    await screen.findByTestId('stay-guest-0');
    await waitFor(() => expect(guestCard(0).getByLabelText(/^Sesso/)).toHaveValue('Male'));

    await goToDocuments();

    const document = within(screen.getByTestId('stay-guest-0-document'));
    expect(document.getByLabelText(/^Numero documento/)).toHaveValue('');
    expect(screen.getByTestId('stay-guest-0-document-on-file')).toHaveTextContent('*****456');
    expect(document.getByLabelText(/^Tipo documento/)).toHaveValue('Passport');
  });

  describe('five languages (NF-40)', () => {
    it('language_ApiResolvedGerman_OpensInGermanWithTheChoiceShown', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      vi.mocked(publicCheckinApi.getContext).mockResolvedValue({
        ...openContext,
        language: 'de',
        supportedLanguages: ['it', 'en', 'de', 'fr', 'es'],
      });
      renderPage();

      expect(await screen.findByRole('heading', { name: 'Gäste-Check-in' })).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('checkin-enter-manually'));
      expect(screen.getByLabelText('Sprache')).toHaveValue('de');
      expect(document.documentElement.lang).toBe('de');
      expect(guestCard(0).getByLabelText(/^Vorname/)).toBeInTheDocument();
      // Nothing is saved when the page only follows what the API resolved.
      expect(publicCheckinApi.setLanguage).not.toHaveBeenCalled();
    });

    it('language_Switcher_OffersFiveLanguagesInTheirOwnNamesWithTheirLangAndFortyFourPixels', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      renderPage();
      const select = (await screen.findByLabelText('Lingua')) as HTMLSelectElement;

      expect(Array.from(select.options).map((option) => option.textContent)).toEqual([
        'Italiano',
        'English',
        'Deutsch',
        'Français',
        'Español',
      ]);
      expect(Array.from(select.options).map((option) => option.lang)).toEqual(['it', 'en', 'de', 'fr', 'es']);
      expect(select.className).toContain('h-11');
    });

    it('language_Choosing_SavesItChangesThePageAndLeavesTheLanguageOfTheAppStored', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      localStorage.removeItem('casazen.locale');
      vi.mocked(publicCheckinApi.setLanguage).mockResolvedValue({ language: 'fr' });
      const view = renderPage();
      const select = await screen.findByLabelText('Lingua');

      fireEvent.change(select, { target: { value: 'fr' } });

      expect(await screen.findByRole('heading', { name: 'Check-in des invités' })).toBeInTheDocument();
      expect(publicCheckinApi.setLanguage).toHaveBeenCalledWith(TOKEN, 'fr');
      expect(document.documentElement.lang).toBe('fr');
      // The guest locale lives for the page: the language chosen for the app (it or en) is not touched.
      expect(localStorage.getItem('casazen.locale')).toBeNull();

      view.unmount();
      await waitFor(() => expect(i18n.language).toBe('it'));
      expect(localStorage.getItem('casazen.locale')).toBeNull();
    });

    it('language_ChoiceCannotBeSaved_PageStaysInTheChosenLanguageAndSaysSo', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      vi.mocked(publicCheckinApi.setLanguage).mockRejectedValue(httpError(500));
      renderPage();

      fireEvent.change(await screen.findByLabelText('Lingua'), { target: { value: 'es' } });

      expect(await screen.findByRole('heading', { name: 'Check-in de huéspedes' })).toBeInTheDocument();
      expect(await screen.findByTestId('checkin-language-not-saved')).toHaveTextContent('No hemos podido guardar');
    });

    it('language_TextsCannotBeLoaded_GoBackToThePreviousLanguageAndSayWhy', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      vi.mocked(publicCheckinApi.setLanguage).mockResolvedValue({ language: 'de' });
      // The file of the language is not there yet and the network gives out while it is added.
      i18n.removeResourceBundle('de', 'translation');
      const addBundle = vi.spyOn(i18n, 'addResourceBundle').mockImplementationOnce(() => {
        throw new Error('chunk');
      });
      try {
        renderPage();
        const select = (await screen.findByLabelText('Lingua')) as HTMLSelectElement;

        fireEvent.change(select, { target: { value: 'de' } });

        expect(await screen.findByTestId('checkin-language-not-loaded')).toHaveTextContent('Non siamo riusciti a caricare questa lingua');
        // The page is in the language it had, and the control, the voice of the screen reader and the texts agree on it.
        expect(select.value).toBe('it');
        expect(document.documentElement.lang).toBe('it');
        expect(i18n.language).toBe('it');
      } finally {
        addBundle.mockRestore();
      }
    });

    it('language_CompletedLink_StillChangesTheLanguageButSavesNothing', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      vi.mocked(publicCheckinApi.getContext).mockResolvedValue({ completed: true, status: 'Completo' });
      renderPage();

      fireEvent.change(await screen.findByLabelText('Lingua'), { target: { value: 'de' } });

      expect(await screen.findByText('Check-in bereits abgeschlossen')).toBeInTheDocument();
      expect(publicCheckinApi.setLanguage).not.toHaveBeenCalled();
    });

    it('language_Choosing_AfterTypingKeepsWhatTheGuestTyped', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      let saved: (answer: { language: string }) => void = () => undefined;
      vi.mocked(publicCheckinApi.setLanguage).mockImplementationOnce(() => new Promise((resolve) => { saved = resolve; }));
      renderPage();
      await formReady();
      fillGuest(0, { firstName: 'Giulia' });

      fireEvent.change(screen.getByLabelText('Lingua'), { target: { value: 'fr' } });
      expect(await screen.findByRole('heading', { name: 'Check-in des invités' })).toBeInTheDocument();
      // The save answers: the page must not start the form again from what the server has on file.
      await act(async () => {
        saved({ language: 'fr' });
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(publicCheckinApi.setLanguage).toHaveBeenCalledWith(TOKEN, 'fr');
      expect(guestCard(0).getByLabelText(/^Prénom/)).toHaveValue('Giulia');
    });

    it('prefill_ContextReadAgainWithTheSameGuests_KeepsWhatTheGuestTyped', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      const view = renderPage();
      await formReady();
      fillGuest(0, { firstName: 'Giulia' });

      // The session moved on (another `status`): a new object, the same guests on file.
      vi.mocked(publicCheckinApi.getContext).mockResolvedValue({ ...openContext, status: 'Inviato' });
      await act(async () => {
        await view.client.refetchQueries({ queryKey: ['checkin', TOKEN] });
        // The query client tells its observers on the next tick: let the page render the new context and run its effects.
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(publicCheckinApi.getContext).toHaveBeenCalledTimes(2);
      expect(guestCard(0).getByLabelText(/^Nome/)).toHaveValue('Giulia');
    });

    it('language_GermanKeyMissingFromTheSubsetFile_FallsBackToEnglish', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      vi.mocked(publicCheckinApi.getContext).mockResolvedValue({ ...openContext, language: 'de' });
      renderPage();
      await screen.findByRole('heading', { name: 'Gäste-Check-in' });

      // A key of the host side is not in the German subset: the page never shows a raw key, English answers.
      expect(i18n.t('checkin.link.copyTitle')).toBe('Check-in link');
    });
  });

  describe('new fields (NF-40)', () => {
    it('residence_Italy_AsksComuneAndProvinceAndSendsThemDocumentDatesToo', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      vi.mocked(publicCheckinApi.submit).mockResolvedValue({ sessionId: openContext.sessionId!, message: 'ok' });
      renderPage();
      await screen.findByTestId('checkin-page');
      fillGuest(0, { firstName: 'Giulia' });
      const card = guestCard(0);
      expect(card.queryByLabelText(/^Comune di residenza/)).not.toBeInTheDocument();
      change(card, /^Residenza/, 'yes');
      change(card, /^Comune di residenza/, 'Roma');
      change(card, /^Provincia di residenza/, 'rm');
      await goToDocuments();
      fillDocument(0);
      const documentCard = within(screen.getByTestId('stay-guest-0-document'));
      change(documentCard, /^Data di rilascio/, '2020-05-10');
      change(documentCard, /^Data di scadenza/, '2030-05-09');
      await acceptAndSubmit();

      await waitFor(() => expect(publicCheckinApi.submit).toHaveBeenCalledTimes(1));
      const [, payload] = vi.mocked(publicCheckinApi.submit).mock.calls[0];
      expect(payload.guests[0]).toMatchObject({
        residenceInItaly: true,
        residenceComuneName: 'Roma',
        residenceProvince: 'RM',
        documentIssuedOn: '2020-05-10',
        documentExpiresOn: '2030-05-09',
      });
      // What the region does not require is not shown and not sent; the exemption of the tourist tax is the host's alone.
      expect(payload.guests[0]).not.toHaveProperty('tourismType');
      expect(payload.guests[0]).not.toHaveProperty('taxExemptionCode');
    });

    it('statisticalFields_RegionDoesNotRequireThem_AreNotShown', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      renderPage();
      await screen.findByTestId('checkin-document-step');
    fireEvent.click(screen.getByTestId('checkin-enter-manually'));
    await screen.findByTestId('stay-guest-0');

      expect(guestCard(0).queryByLabelText(/^Motivo del viaggio/)).not.toBeInTheDocument();
      expect(guestCard(0).queryByLabelText(/^Mezzo usato per arrivare/)).not.toBeInTheDocument();
      expect(guestCard(0).queryByLabelText(/^Titolo di studio/)).not.toBeInTheDocument();
    });

    it('statisticalFields_RegionRequiresTwo_AreAskedMustBeChosenAndAreTheOnlyOnesSent', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      vi.mocked(publicCheckinApi.getContext).mockResolvedValue({ ...openContext, requiredGuestFields: ['TourismType', 'TravelWay'] });
      vi.mocked(publicCheckinApi.submit).mockResolvedValue({ sessionId: openContext.sessionId!, message: 'ok' });
      renderPage();
      await screen.findByTestId('checkin-document-step');
      fireEvent.click(screen.getByTestId('checkin-enter-manually'));
      const card = guestCard(0);
      await waitFor(() => expect(card.getByLabelText(/^Motivo del viaggio/)).toBeInTheDocument());
      expect(card.queryByLabelText(/^Titolo di studio/)).not.toBeInTheDocument();

      fillGuest(0, { firstName: 'Giulia' });
      fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));
      expect(await screen.findByText('Seleziona il motivo del viaggio')).toBeInTheDocument();
      expect(screen.getByText('Seleziona il mezzo usato per arrivare')).toBeInTheDocument();
      expect(screen.queryByTestId('stay-guest-0-document')).not.toBeInTheDocument();

      change(card, /^Motivo del viaggio/, 'business');
      change(card, /^Mezzo usato per arrivare/, 'train');
      await goToDocuments();
      fillDocument(0);
      await acceptAndSubmit();

      await waitFor(() => expect(publicCheckinApi.submit).toHaveBeenCalledTimes(1));
      const [, payload] = vi.mocked(publicCheckinApi.submit).mock.calls[0];
      expect(payload.guests[0]).toMatchObject({ tourismType: 'business', travelWay: 'train' });
      expect(payload.guests[0]).not.toHaveProperty('educationLevel');
    });

    it('prefill_NewFieldsOnFile_ArePutBackInTheForm', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      vi.mocked(publicCheckinApi.getContext).mockResolvedValue({
        ...openContext,
        guests: [
          {
            ...booker,
            residenceInItaly: false,
            residenceCountryName: 'Francia',
            documentIssuedOn: '2020-05-10',
            documentExpiresOn: '2030-05-09',
          },
        ],
      });
      renderPage();
      await screen.findByTestId('checkin-document-step');
    fireEvent.click(screen.getByTestId('checkin-enter-manually'));
    await screen.findByTestId('stay-guest-0');

      await waitFor(() => expect(guestCard(0).getByLabelText(/^Residenza/)).toHaveValue('no'));
      expect(guestCard(0).getByLabelText(/^Stato di residenza/)).toHaveValue('Francia');
      fillGuest(0, { firstName: 'Giulia' });
      await goToDocuments();
      expect(within(screen.getByTestId('stay-guest-0-document')).getByLabelText(/^Data di rilascio/)).toHaveValue('2020-05-10');
    });
  });

  describe('errors in the language of the page (NF-40, NF-11)', () => {
    it('submit_ServerCodes_AreTranslatedWithTheGuestLocaleAndUnknownKeysKeepTheServerMessage', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      vi.mocked(publicCheckinApi.getContext).mockResolvedValue({ ...openContext, language: 'de' });
      vi.mocked(publicCheckinApi.submit).mockRejectedValue(
        httpError(400, {
          code: 'validation_error',
          errors: {
            'Guests[0].DocumentNumber': ['Il numero del documento può avere solo lettere e cifre, al massimo 20.'],
            'Guests[0].DocumentIssuePlaceName': ['Un messaggio che questa versione non conosce.'],
          },
          codes: {
            'Guests[0].DocumentNumber': 'CheckInDocumentNumberInvalid',
            'Guests[0].DocumentIssuePlaceName': 'CheckInSomethingNew',
          },
        }),
      );
      renderPage();
      await screen.findByRole('heading', { name: 'Gäste-Check-in' });
      fireEvent.click(screen.getByTestId('checkin-enter-manually'));
      await screen.findByLabelText(/^Vorname/);
      const setField = (id: string, value: string) => fireEvent.change(window.document.getElementById(id)!, { target: { value } });
      setField('guest-0-firstName', 'Giulia');
      setField('guest-0-lastName', 'Bianchi');
      setField('guest-0-gender', 'Female');
      setField('guest-0-dateOfBirth', '1992-03-08');
      setField('guest-0-bornInItaly', 'no');
      setField('guest-0-birthCountryName', 'Francia');
      setField('guest-0-citizenship', 'Italia');
      fireEvent.click(screen.getByRole('button', { name: /Weiter/ }));
      await screen.findByTestId('stay-guest-0-document');
      setField('guest-0-documentType', 'IdentityCard');
      setField('guest-0-documentNumber', 'CA12345AB');
      setField('guest-0-documentIssuePlaceName', 'Firenze');
      fireEvent.click(screen.getByRole('button', { name: /Weiter/ }));
      await screen.findByTestId('checkin-privacy-notice');
      fireEvent.click(screen.getByTestId('checkin-submit'));

      // In the language of the page, from the key of the message.
      expect(await screen.findByText('Die Dokumentnummer darf nur Buchstaben und Ziffern enthalten, höchstens 20.')).toBeInTheDocument();
      // A key the page does not know: the message of the server.
      expect(screen.getByText('Un messaggio che questa versione non conosce.')).toBeInTheDocument();
    });

    it('next_MissingFields_FocusGoesToTheFirstErrorAndTheCountIsAnnounced', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      vi.mocked(publicCheckinApi.getContext).mockResolvedValue({
        ...openContext,
        guests: [{ ...booker, firstName: '', lastName: '' }],
      });
      renderPage();
      await screen.findByTestId('checkin-document-step');
    fireEvent.click(screen.getByTestId('checkin-enter-manually'));
    await screen.findByTestId('stay-guest-0');

      fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));

      await waitFor(() => expect(guestCard(0).getByLabelText(/^Nome/)).toHaveFocus());
      expect(await screen.findByTestId('checkin-announcement')).toHaveTextContent(/campi da controllare/);
      expect(screen.getByTestId('checkin-announcement')).toHaveAttribute('role', 'status');
    });
  });
});
