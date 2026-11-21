import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from 'vitest';
import { cleanup, configure, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { CheckInPage } from '../checkin-page';
import { publicCheckinApi } from '@/api/checkin.api';
import type { PublicCheckInContextDto, PublicCheckInGuestPrefill } from '@/types/public-checkin.types';

vi.mock('@/api/checkin.api', () => ({
  publicCheckinApi: { getContext: vi.fn(), requestInvoice: vi.fn(), readDocument: vi.fn(), submit: vi.fn(), searchCodes: vi.fn(), setLanguage: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const TOKEN = 'tok-swiss';

/** Filling two guests over three steps takes a few seconds in jsdom, more on a loaded CI runner. */
const FORM_TEST_TIMEOUT_MS = 30_000;

// Explicit conditions only, no fixed waits (QA-INFRA-01): a wait ends as soon as its condition holds, so the ceiling costs nothing when the machine is idle.
configure({ asyncUtilTimeout: 15_000 });

/** What the API names for a property in canton Ticino (NF-132, E30/F01/US01/T01). */
const TICINO_FIELDS = ['DocumentType', 'DocumentNumber', 'ResidenceStreet', 'ResidencePostalCode', 'ResidenceCityName', 'ResidenceCountryName'];

const booker: PublicCheckInGuestPrefill = {
  type: 'HeadOfFamily',
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

const italianContext: PublicCheckInContextDto = {
  completed: false,
  status: 'InCompilazione',
  sessionId: '22222222-2222-2222-2222-222222222222',
  propertyName: 'Casa Roma',
  checkInDate: '2026-10-10T00:00:00Z',
  checkOutDate: '2026-10-12T00:00:00Z',
  declaredGuests: 2,
  guests: [booker],
  availableCodeTables: [],
};

const ticinoContext: PublicCheckInContextDto = {
  ...italianContext,
  propertyName: 'Casa Lugano',
  requiredGuestFields: TICINO_FIELDS,
  askVehiclePlate: true,
};

function httpError(status: number, data?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
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

function documentCard(index: number) {
  return within(screen.getByTestId(`stay-guest-${index}-document`));
}

function change(scope: ReturnType<typeof within>, label: RegExp, value: string) {
  fireEvent.change(scope.getByLabelText(label), { target: { value } });
}

/** The personal data of an adult born in Italy: the Alloggiati record, nothing Swiss. */
function fillGuest(index: number, firstName: string, dateOfBirth: string, gender = 'Female') {
  const card = guestCard(index);
  change(card, /^Nome/, firstName);
  change(card, /^Cognome/, 'Bianchi');
  change(card, /^Sesso/, gender);
  change(card, /^Data di nascita/, dateOfBirth);
  change(card, /^Luogo di nascita/, 'yes');
  change(card, /^Comune di nascita/, 'Firenze');
  change(card, /^Provincia/, 'FI');
  change(card, /^Cittadinanza/, 'Italia');
}

/** The scan step is the first one: the guest who types by hand skips it. Waits until the page started the form from the guests on file. */
async function openGuestsStep(lastCard: number) {
  await screen.findByTestId('checkin-document-step');
  fireEvent.click(screen.getByTestId('checkin-enter-manually'));
  await screen.findByTestId(`stay-guest-${lastCard}`);
  await waitFor(() => expect(guestCard(0).getByLabelText(/^Nome/)).toHaveValue('Mario'));
}

async function goToDocuments() {
  fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));
  await screen.findByTestId('stay-guest-0-document');
}

function fillDocument(scope: ReturnType<typeof within>, type: string, number: string, place?: string) {
  change(scope, /^Tipo documento/, type);
  change(scope, /^Numero documento/, number);
  if (place) change(scope, /^Luogo di rilascio/, place);
}

async function acceptAndSubmit() {
  fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));
  await screen.findByTestId('checkin-privacy-notice');
  fireEvent.click(within(screen.getByTestId('checkin-privacy-notice')).getByRole('checkbox'));
  fireEvent.click(screen.getByTestId('checkin-submit'));
}

beforeAll(async () => {
  await i18n.changeLanguage('it');
});

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('it');
  document.documentElement.lang = 'it';
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(publicCheckinApi.getContext).mockResolvedValue(ticinoContext);
  vi.mocked(publicCheckinApi.searchCodes).mockResolvedValue([]);
  vi.mocked(publicCheckinApi.submit).mockResolvedValue({ sessionId: ticinoContext.sessionId!, message: 'ok' });
});

describe('the guest check-in of a Swiss property (NF-132, E30/F01/US02)', () => {
  it('guestsStep_Ticino_AsksTheHomeOfEachGuestAndThePlateAndNoItalianResidence', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    renderPage();
    await openGuestsStep(1);

    for (const index of [0, 1]) {
      const card = guestCard(index);
      expect(card.getByLabelText(/^Via e numero civico/)).toHaveAttribute('autocomplete', 'street-address');
      expect(card.getByLabelText(/^CAP/)).toHaveAttribute('autocomplete', 'postal-code');
      expect(card.getByLabelText(/^Località/)).toHaveAttribute('autocomplete', 'address-level2');
      expect(card.getByLabelText(/^Stato di residenza/)).toHaveAttribute('autocomplete', 'country');
      // Never an Italian-only question of a Swiss stay: not «in Italy or abroad», not the comune nor the province of residence.
      expect(card.queryByLabelText(/^Residenza/)).not.toBeInTheDocument();
      expect(card.queryByLabelText(/^Comune di residenza/)).not.toBeInTheDocument();
      expect(card.queryByLabelText(/^Provincia di residenza/)).not.toBeInTheDocument();
    }
    // One plate for the stay, optional, and no longer the law of art. 109 TULPS in the words of the page.
    expect(screen.getAllByLabelText(/^Targa/)).toHaveLength(1);
    expect(screen.getByLabelText(/^Targa/)).toHaveAttribute('aria-describedby', expect.stringContaining('stay-vehicle-plate-hint'));
    expect(screen.queryByText(/art\. 109 TULPS/)).not.toBeInTheDocument();
  });

  it('documentsStep_Ticino_AsksTheTypeAndNumberOfEveryAdultAndTheFullDocumentOfTheHeadOnly', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    renderPage();
    await openGuestsStep(1);
    fillGuest(0, 'Giulia', '1982-05-01');
    fillGuest(1, 'Marco', '1984-02-02', 'Male');

    await goToDocuments();

    // The head gives the whole document; the adult member gives its type and number, not the place of issue nor the days.
    expect(documentCard(0).getByLabelText(/^Luogo di rilascio/)).toBeInTheDocument();
    expect(documentCard(1).getByLabelText(/^Tipo documento/)).toBeInTheDocument();
    expect(documentCard(1).getByLabelText(/^Numero documento/)).toBeInTheDocument();
    expect(documentCard(1).queryByLabelText(/^Luogo di rilascio/)).not.toBeInTheDocument();
    expect(documentCard(1).queryByLabelText(/^Data di rilascio/)).not.toBeInTheDocument();
    expect(documentCard(1).queryByLabelText(/^Data di scadenza/)).not.toBeInTheDocument();
  });

  it('documentsStep_Ticino_AMinorMemberIsNotAskedADocument', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    renderPage();
    await openGuestsStep(1);
    fillGuest(0, 'Giulia', '1982-05-01');
    fillGuest(1, 'Marco', '2018-07-21', 'Male');

    await goToDocuments();

    expect(screen.getByTestId('stay-guest-0-document')).toBeInTheDocument();
    expect(screen.queryByTestId('stay-guest-1-document')).not.toBeInTheDocument();
  });

  it('documentsStep_Ticino_AnAdultMemberWithoutADocumentCannotGoOn', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    renderPage();
    await openGuestsStep(1);
    fillGuest(0, 'Giulia', '1982-05-01');
    fillGuest(1, 'Marco', '1984-02-02', 'Male');
    await goToDocuments();
    fillDocument(documentCard(0), 'IdentityCard', 'CA12345AB', 'Firenze');

    fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));

    await waitFor(() => expect(documentCard(1).getByLabelText(/^Numero documento/)).toHaveAttribute('aria-invalid', 'true'));
    expect(documentCard(1).getByLabelText(/^Tipo documento/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByTestId('checkin-privacy-notice')).not.toBeInTheDocument();
    expect(publicCheckinApi.submit).not.toHaveBeenCalled();
  });

  it('submit_Ticino_SendsTheHomeOfEveryGuestTheDocumentOfTheAdultMemberAndThePlate', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    renderPage();
    await openGuestsStep(1);
    fillGuest(0, 'Giulia', '1982-05-01');
    fillGuest(1, 'Marco', '1984-02-02', 'Male');
    const head = guestCard(0);
    change(head, /^Via e numero civico/, ' Via Nassa 5 ');
    change(head, /^CAP/, '6900');
    change(head, /^Località/, 'Lugano');
    change(head, /^Stato di residenza/, 'Svizzera');
    fireEvent.change(screen.getByLabelText(/^Targa/), { target: { value: 'ti 123 456' } });

    await goToDocuments();
    fillDocument(documentCard(0), 'IdentityCard', 'CA12345AB', 'Firenze');
    fillDocument(documentCard(1), 'Passport', 'x1234567');
    await acceptAndSubmit();

    await waitFor(() => expect(publicCheckinApi.submit).toHaveBeenCalledTimes(1));
    const [token, payload] = vi.mocked(publicCheckinApi.submit).mock.calls[0];
    expect(token).toBe(TOKEN);
    expect(payload.vehiclePlate).toBe('TI123456');
    expect(payload.guests[0]).toMatchObject({
      type: 'HeadOfFamily',
      residenceStreet: 'Via Nassa 5',
      residencePostalCode: '6900',
      residenceCityName: 'Lugano',
      // The state of residence says the guest lives abroad: the Swiss form never asked it.
      residenceInItaly: false,
      residenceCountryName: 'Svizzera',
      documentType: 'IdentityCard',
      documentNumber: 'CA12345AB',
    });
    // The whole truth: the home the second guest left blank is sent as null, so a save never leaves a stale one.
    expect(payload.guests[1]).toMatchObject({
      type: 'FamilyMember',
      residenceStreet: null,
      residencePostalCode: null,
      residenceCityName: null,
      documentType: 'Passport',
      documentNumber: 'X1234567',
    });
  });

  it('submit_Ticino_NoPlateTypedSendsNoPlateSoTheStoredOneStays', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue({ ...ticinoContext, declaredGuests: 1, guests: [{ ...booker, type: 'SingleGuest' }] });
    renderPage();
    await openGuestsStep(0);
    fillGuest(0, 'Giulia', '1982-05-01');

    await goToDocuments();
    fillDocument(documentCard(0), 'IdentityCard', 'CA12345AB', 'Firenze');
    await acceptAndSubmit();

    await waitFor(() => expect(publicCheckinApi.submit).toHaveBeenCalledTimes(1));
    expect(vi.mocked(publicCheckinApi.submit).mock.calls[0][1]).not.toHaveProperty('vehiclePlate');
  });

  it('submit_Ticino_TheHomeOnFileIsSentBackSoAPageThatSendsTheGuestsWholeDoesNotClearIt', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue({
      ...ticinoContext,
      declaredGuests: 1,
      guests: [{ ...booker, type: 'SingleGuest', residenceStreet: 'Via Nassa 5', residencePostalCode: '6900', residenceCityName: 'Lugano' }],
    });
    renderPage();
    await openGuestsStep(0);
    await waitFor(() => expect(guestCard(0).getByLabelText(/^Via e numero civico/)).toHaveValue('Via Nassa 5'));
    fillGuest(0, 'Giulia', '1982-05-01');

    await goToDocuments();
    fillDocument(documentCard(0), 'IdentityCard', 'CA12345AB', 'Firenze');
    await acceptAndSubmit();

    await waitFor(() => expect(publicCheckinApi.submit).toHaveBeenCalledTimes(1));
    expect(vi.mocked(publicCheckinApi.submit).mock.calls[0][1].guests[0]).toMatchObject({
      residenceStreet: 'Via Nassa 5',
      residencePostalCode: '6900',
      residenceCityName: 'Lugano',
    });
  });

  it('next_Ticino_APlateThatIsNotOneStaysOnTheStepWithTheError', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    renderPage();
    await openGuestsStep(1);
    fillGuest(0, 'Giulia', '1982-05-01');
    fillGuest(1, 'Marco', '1984-02-02', 'Male');
    fireEvent.change(screen.getByLabelText(/^Targa/), { target: { value: 'non/una/targa' } });

    fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));

    expect(await screen.findByText(/Inserisci una targa valida/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Targa/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByTestId('stay-guest-0-document')).not.toBeInTheDocument();
  });

  it('submit_Ticino_APlateTheServerRefusesIsShownOnItsFieldInTheLanguageOfThePage', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(publicCheckinApi.submit).mockRejectedValue(
      httpError(400, {
        code: 'validation_error',
        errors: { VehiclePlate: ['Targa non valida: usa lettere, cifre e trattini, al massimo 20 caratteri.'] },
        codes: { VehiclePlate: 'CheckInVehiclePlateInvalid' },
      }),
    );
    renderPage();
    await openGuestsStep(1);
    fillGuest(0, 'Giulia', '1982-05-01');
    fillGuest(1, 'Marco', '1984-02-02', 'Male');
    await goToDocuments();
    fillDocument(documentCard(0), 'IdentityCard', 'CA12345AB', 'Firenze');
    fillDocument(documentCard(1), 'Passport', 'X1234567');
    await acceptAndSubmit();

    // Back to the guests step, where the plate is asked, with the message of the page.
    expect(await screen.findByText('La targa non è valida: usa lettere, cifre e trattini, al massimo 20 caratteri.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Targa/)).toHaveAttribute('aria-invalid', 'true');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('scanStep_Ticino_SaysThePhotoOfTheDocumentIsNotStored', async () => {
    renderPage();
    await screen.findByTestId('checkin-document-step');

    expect(screen.getByTestId('checkin-document-not-archived')).toHaveTextContent('Il documento non sarà archiviato.');
  });

  it('scanStep_PropertyThatKeepsNoDocumentWithoutTheSwissFields_SaysItToo', async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue({ ...italianContext, documentNotArchived: true });
    renderPage();
    await screen.findByTestId('checkin-document-step');

    expect(screen.getByTestId('checkin-document-not-archived')).toBeInTheDocument();
  });
});

describe('the guest check-in of an Italian property is the one it has always been (E30/F01/US02)', () => {
  beforeEach(() => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue(italianContext);
  });

  it('guestsStep_Italy_AsksTheItalianResidenceAndNoHomeNoPlate', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    renderPage();
    await openGuestsStep(1);

    const card = guestCard(0);
    expect(card.getByLabelText(/^Residenza/)).toBeInTheDocument();
    expect(card.queryByLabelText(/^Via e numero civico/)).not.toBeInTheDocument();
    expect(card.queryByLabelText(/^CAP/)).not.toBeInTheDocument();
    expect(card.queryByLabelText(/^Località/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Targa/)).not.toBeInTheDocument();
    expect(screen.getByText(/art\. 109 TULPS/)).toBeInTheDocument();
  });

  it('documentsStep_Italy_OnlyTheHeadGivesADocumentAndNothingSwissIsSent', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    renderPage();
    await openGuestsStep(1);
    fillGuest(0, 'Giulia', '1982-05-01');
    fillGuest(1, 'Marco', '1984-02-02', 'Male');

    await goToDocuments();
    expect(screen.queryByTestId('stay-guest-1-document')).not.toBeInTheDocument();
    fillDocument(documentCard(0), 'IdentityCard', 'CA12345AB', 'Firenze');
    await acceptAndSubmit();

    await waitFor(() => expect(publicCheckinApi.submit).toHaveBeenCalledTimes(1));
    const [, payload] = vi.mocked(publicCheckinApi.submit).mock.calls[0];
    expect(payload).not.toHaveProperty('vehiclePlate');
    for (const body of payload.guests) {
      expect(body).not.toHaveProperty('residenceStreet');
      expect(body).not.toHaveProperty('residencePostalCode');
      expect(body).not.toHaveProperty('residenceCityName');
    }
    expect(payload.guests[1]).toMatchObject({ documentType: null, documentNumber: null });
  });

  it('scanStep_Italy_SaysNothingAboutTheDocumentNotBeingStored', async () => {
    renderPage();
    await screen.findByTestId('checkin-document-step');

    expect(screen.queryByTestId('checkin-document-not-archived')).not.toBeInTheDocument();
  });
});
