import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
  publicCheckinApi: { getContext: vi.fn(), submit: vi.fn(), searchCodes: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Radix Checkbox measures itself with ResizeObserver, which jsdom does not provide.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);

const TOKEN = 'tok-123';

/** Filling several guests over three steps takes a few seconds in jsdom, more on a loaded CI runner. */
const FORM_TEST_TIMEOUT_MS = 30_000;

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
  return render(
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
    expect(payload.marketingConsent).toBe(false);
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
    const checkbox = within(marketing).getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByTestId('checkin-submit'));

    await waitFor(() => expect(publicCheckinApi.submit).toHaveBeenCalledTimes(1));
    expect(vi.mocked(publicCheckinApi.submit).mock.calls[0][1].marketingConsent).toBe(true);
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
    vi.mocked(publicCheckinApi.searchCodes).mockResolvedValue([
      { table: 'Comuni', code: '900000001', description: 'TEST Firenze', province: 'FI' },
    ]);
    vi.mocked(publicCheckinApi.submit).mockResolvedValue({ sessionId: openContext.sessionId!, message: 'ok' });
    renderPage();
    await screen.findByTestId('stay-guest-0');
    fillGuest(0, { firstName: 'Giulia', place: 'TE' });

    await waitFor(() => expect(publicCheckinApi.searchCodes).toHaveBeenCalledWith(TOKEN, 'comuni', 'TE'));
    await screen.findByText((_, element) => element?.getAttribute('value') === 'TEST Firenze (FI)');
    change(guestCard(0), /^Comune di nascita/, 'TEST Firenze (FI)');
    expect(await screen.findByTestId('guest-0-birthComuneName-code')).toHaveTextContent('900000001');

    await goToDocuments();
    fillDocument(0);
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
    await screen.findByTestId('stay-guest-0');
    await waitFor(() => expect(guestCard(0).getByLabelText(/^Sesso/)).toHaveValue('Male'));

    await goToDocuments();

    const document = within(screen.getByTestId('stay-guest-0-document'));
    expect(document.getByLabelText(/^Numero documento/)).toHaveValue('');
    expect(screen.getByTestId('stay-guest-0-document-on-file')).toHaveTextContent('*****456');
    expect(document.getByLabelText(/^Tipo documento/)).toHaveValue('Passport');
  });
});
