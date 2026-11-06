import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import { checkInWizardApi } from '@/api/checkin-wizard.api';
import { alloggiatiApi } from '@/api/alloggiati.api';
import { bookingsApi } from '@/api/bookings.api';
import type {
  CheckInConfirmation,
  CheckInIssue,
  CheckInWizardGuest,
  CheckInWizardState,
  StayTouristTax,
} from '@/types/checkin-wizard.types';
import { CheckInWizardPage } from '../checkin-wizard';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/api/checkin-wizard.api', () => ({
  checkInWizardApi: {
    getState: vi.fn(),
    saveGuests: vi.fn(),
    readDocument: vi.fn(),
    confirm: vi.fn(),
    markNoShow: vi.fn(),
    getTouristTax: vi.fn(),
    setExemptions: vi.fn(),
    setCollector: vi.fn(),
    getMunicipalityRate: vi.fn(),
    saveMunicipalityRate: vi.fn(),
  },
}));
vi.mock('@/api/alloggiati.api', () => ({ alloggiatiApi: { getGuestSummary: vi.fn(), searchCodes: vi.fn(), getStatus: vi.fn() } }));
vi.mock('@/api/bookings.api', () => ({ bookingsApi: { getById: vi.fn(), checkIn: vi.fn() } }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, action }: { title: string; action?: React.ReactNode }) =>
    createElement('div', null, createElement('h1', null, title), action),
}));
vi.mock('@/components/shared/breadcrumb', () => ({ Breadcrumb: () => null }));

// A form this size takes a few seconds in jsdom, more on a loaded runner: explicit conditions only, no fixed waits (QA-INFRA-01).
configure({ asyncUtilTimeout: 15_000 });
const FORM_TEST_TIMEOUT_MS = 40_000;

const BOOKING_ID = 'c0c1d2e3-0000-4000-8000-000000000041';
const PROPERTY_ID = 'c0c1d2e3-0000-4000-8000-0000000000aa';

function savedGuest(position: number, overrides: Partial<CheckInWizardGuest> = {}): CheckInWizardGuest {
  return {
    saved: true,
    position,
    type: 'SingleGuest',
    firstName: 'Giulia',
    lastName: 'Bianchi',
    gender: 'Female',
    dateOfBirth: '1992-03-08T00:00:00',
    bornInItaly: true,
    birthComuneName: 'Firenze',
    birthProvince: 'FI',
    birthCountryName: '',
    citizenshipName: 'Italia',
    documentType: 'IdentityCard',
    documentNumberMasked: '*****5AB',
    documentIssuePlaceName: 'Firenze',
    dataSource: 'Host',
    ...overrides,
  };
}

/** The booker shown before any guest is registered: only the name is known. */
const unsavedBooker: CheckInWizardGuest = {
  saved: false,
  position: 0,
  type: 'SingleGuest',
  firstName: 'Mario',
  lastName: 'Rossi',
  birthComuneName: '',
  birthCountryName: '',
  citizenshipName: '',
  documentIssuePlaceName: '',
  dataSource: 'NotRecorded',
};

function touristTax(overrides: Partial<StayTouristTax> = {}): StayTouristTax {
  return {
    bookingId: BOOKING_ID,
    status: 'Calculated',
    rateSource: 'Official',
    missingRate: false,
    nights: 2,
    taxableNights: 2,
    ageRulesApply: true,
    categories: [],
    total: 4,
    amountDue: 4,
    collector: 'Host',
    collectorSource: 'Default',
    collectorNeeded: false,
    guests: [{ position: 0, nights: 2, taxableNights: 2, amount: 4, exemptionKind: 'None' }],
    reasons: [
      { code: 'resident', labelKey: 'touristTax.exemption.resident' },
      { code: 'health_care', labelKey: 'touristTax.exemption.health_care' },
    ],
    stale: false,
    ...overrides,
  };
}

function wizardState(overrides: Partial<CheckInWizardState> = {}): CheckInWizardState {
  return {
    booking: {
      bookingId: BOOKING_ID,
      propertyId: PROPERTY_ID,
      propertyName: 'Villa Demo',
      checkIn: '2026-10-10',
      checkOut: '2026-10-12',
      nights: 2,
      source: 'Manual',
      declaredGuests: 1,
      status: 'Confirmed',
    },
    attendance: 'Expected',
    guests: [savedGuest(0)],
    requiredGuestFields: [],
    issues: [],
    tax: touristTax(),
    sender: { alloggiatiSender: 'ChannelManager', source: 'Stored', applies: true },
    octorate: { mirrored: true, guests: [], states: [] },
    alloggiati: { status: 'DaInviareManualmente', dataComplete: true, deadlineAt: '2026-10-11T00:00:00Z', isOverdue: false },
    capabilities: { documentReading: false, canRegisterArrival: false, canMarkNoShow: false, octorateTaxValues: false },
    suggestedStep: 'guests',
    ...overrides,
  };
}

function confirmation(overrides: Partial<CheckInConfirmation> = {}): CheckInConfirmation {
  return {
    tax: { saved: true, reason: null },
    octorate: { state: 'Sent', reason: null, draft: false, correctionAfterSend: false, guests: [{ position: 0, outcome: 'Created' }] },
    alloggiati: { step: 'ChannelManagerSends', sender: 'ChannelManager' },
    state: wizardState(),
    ...overrides,
  };
}

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

function renderWizard(search = '') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(I18nextProvider, { i18n },
      createElement(QueryClientProvider, { client },
        createElement(MemoryRouter, { initialEntries: [`/app/short-rent/bookings/${BOOKING_ID}/check-in${search}`] },
          createElement(Routes, null,
            createElement(Route, { path: '/app/short-rent/bookings/:id/check-in', element: createElement(CheckInWizardPage) }),
            createElement(Route, {
              path: '/app/short-rent/bookings/:id',
              element: createElement('div', { 'data-testid': 'booking-detail-stub' }),
            }),
          )))),
  );
}

function change(scope: ReturnType<typeof within>, label: RegExp, value: string) {
  fireEvent.change(scope.getByLabelText(label), { target: { value } });
}

const next = () => fireEvent.click(screen.getByTestId('checkin-wizard-next'));

/** Fills the personal data the booker lacks (the name is known). */
function fillBookerPersonalData() {
  const card = within(screen.getByTestId('stay-guest-0'));
  change(card, /^Sesso/, 'Male');
  change(card, /^Data di nascita/, '1980-04-02');
  change(card, /^Luogo di nascita/, 'yes');
  change(card, /^Comune di nascita/, 'Milano');
  change(card, /^Provincia/, 'MI');
  change(card, /^Cittadinanza/, 'Italia');
}

function fillBookerDocument() {
  const card = within(screen.getByTestId('stay-guest-0-document'));
  change(card, /^Tipo documento/, 'IdentityCard');
  change(card, /^Numero documento/, 'CA12345AB');
  change(card, /^Luogo di rilascio/, 'Milano');
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
  vi.mocked(checkInWizardApi.getState).mockResolvedValue(wizardState());
  vi.mocked(checkInWizardApi.getTouristTax).mockResolvedValue(touristTax());
  vi.mocked(checkInWizardApi.getMunicipalityRate).mockResolvedValue({
    propertyId: PROPERTY_ID,
    city: 'Roma',
    officialRateInForce: false,
    rate: null,
  });
  vi.mocked(alloggiatiApi.getGuestSummary).mockResolvedValue({ missingCodeTables: ['Comuni', 'Stati', 'Documenti', 'TipiAlloggiato'], guests: [] } as never);
  vi.mocked(alloggiatiApi.searchCodes).mockResolvedValue([]);
  vi.mocked(bookingsApi.getById).mockResolvedValue({
    id: BOOKING_ID,
    status: 'Confirmed',
    checkInDate: '2026-10-10T00:00:00Z',
    checkOutDate: '2026-10-12T00:00:00Z',
    guest: { firstName: 'Giulia', lastName: 'Bianchi' },
  } as never);
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('CheckInWizardPage', () => {
  it('opensOnTheStepTheServerSuggests_AndTheAddressWins', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(checkInWizardApi.getState).mockResolvedValue(wizardState({ suggestedStep: 'tax' }));
    const first = renderWizard();
    expect(await screen.findByTestId('checkin-wizard-tax')).toBeInTheDocument();
    first.unmount();

    renderWizard('?step=checks');
    expect(await screen.findByTestId('checkin-wizard-checks-ok')).toBeInTheDocument();
  });

  it('nothingLeftToDo_OpensTheSendStepSoTheHostCanConfirmAgain', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(checkInWizardApi.getState).mockResolvedValue(wizardState({ suggestedStep: 'result' }));

    renderWizard();

    expect(await screen.findByTestId('checkin-wizard-send')).toBeInTheDocument();
    expect(screen.getByTestId('checkin-wizard-confirm')).toHaveTextContent('Conferma e invia');
  });

  it('stayWithNoCheckInExpected_SaysSoAndLeadsBack', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(checkInWizardApi.getState).mockResolvedValue(wizardState({ attendance: 'NoShow' }));

    renderWizard();

    const card = await screen.findByTestId('checkin-wizard-not-expected');
    expect(card).toHaveTextContent('Ospite non arrivato');
    expect(screen.queryByTestId('checkin-wizard-form')).not.toBeInTheDocument();
    expect(within(card).getByRole('link', { name: /Torna alla prenotazione/ })).toHaveAttribute('href', `/app/short-rent/bookings/${BOOKING_ID}`);
  });

  it('everyStep_ShowsTheHelpAndSaveAndExit_AndTheOnlyWaysOutAreSaveAndExitAndTheNoShow', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(checkInWizardApi.getState).mockResolvedValue(wizardState({ capabilities: { documentReading: false, canRegisterArrival: false, canMarkNoShow: true, octorateTaxValues: false } }));
    renderWizard();
    await screen.findByTestId('checkin-wizard-guests');

    for (const step of ['guests', 'documents', 'checks', 'tax', 'send']) {
      await waitFor(() => expect(screen.getByTestId('checkin-wizard-form')).toHaveAttribute('data-step', step));
      expect(screen.getByRole('button', { name: /^Cos'è: / })).toBeInTheDocument();
      expect(screen.getByTestId('checkin-wizard-save-exit')).toBeInTheDocument();
      // No link of the page leaves the wizard but the stepper and the footer; the leaving actions are the two named by the brief.
      const form = screen.getByTestId('checkin-wizard-form');
      expect(within(form).queryAllByRole('link').filter((link) => !(link.getAttribute('href') ?? '').includes('step='))).toEqual([]);
      if (step !== 'send') next();
    }
    expect(screen.getByTestId('checkin-wizard-no-show')).toBeInTheDocument();
  });

  it('guestsStep_NewHeadWithoutDocument_SavesNothingYet_TheDocumentsStepSavesOnceWithTheNewFields', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(checkInWizardApi.getState).mockResolvedValue(wizardState({ guests: [unsavedBooker], issues: [] }));
    vi.mocked(checkInWizardApi.saveGuests).mockResolvedValue(
      wizardState({ guests: [savedGuest(0, { firstName: 'Mario', lastName: 'Rossi' })], suggestedStep: 'checks' }),
    );
    renderWizard();
    await screen.findByTestId('stay-guest-0');

    fillBookerPersonalData();
    const card = within(screen.getByTestId('stay-guest-0'));
    change(card, /^Residenza/, 'yes');
    change(card, /^Comune di residenza/, 'Roma');
    change(card, /^Provincia di residenza/, 'rm');
    next();

    // The document comes next: the server saves no head without it, so nothing is saved on this step.
    await screen.findByTestId('checkin-wizard-documents');
    expect(checkInWizardApi.saveGuests).not.toHaveBeenCalled();

    fillBookerDocument();
    change(within(screen.getByTestId('stay-guest-0-document')), /^Data di scadenza/, '2031-04-02');
    next();

    await screen.findByTestId('checkin-wizard-checks-ok');
    expect(checkInWizardApi.saveGuests).toHaveBeenCalledTimes(1);
    const [bookingId, guests] = vi.mocked(checkInWizardApi.saveGuests).mock.calls[0];
    expect(bookingId).toBe(BOOKING_ID);
    expect(guests[0]).toMatchObject({
      firstName: 'Mario',
      documentNumber: 'CA12345AB',
      documentExpiresOn: '2031-04-02',
      residenceInItaly: true,
      residenceComuneName: 'Roma',
      residenceProvince: 'RM',
      // The exemption of the tourist tax goes back as it came (none): the server takes the list as the whole truth.
      taxExemptionCode: null,
    });
    expect(guests[0]).not.toHaveProperty('tourismType');
  });

  it('guestsStep_ExemptionTheHostChose_TravelsBackWithTheGuestsSoASaveDoesNotEraseIt', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(checkInWizardApi.getState).mockResolvedValue(
      wizardState({ guests: [savedGuest(0, { taxExemptionCode: 'resident' })] }),
    );
    vi.mocked(checkInWizardApi.saveGuests).mockResolvedValue(wizardState());
    renderWizard();
    await screen.findByTestId('stay-guest-0');

    change(within(screen.getByTestId('stay-guest-0')), /^Nome/, 'Anna');
    next();
    await screen.findByTestId('checkin-wizard-documents');
    change(within(screen.getByTestId('stay-guest-0-document')), /^Numero documento/, 'CA12345AB');
    next();

    await waitFor(() => expect(checkInWizardApi.saveGuests).toHaveBeenCalledTimes(1));
    expect(vi.mocked(checkInWizardApi.saveGuests).mock.calls[0][1][0]).toMatchObject({ firstName: 'Anna', taxExemptionCode: 'resident' });
  });

  it('steps_GuestsOnFileAndNothingChanged_ContinueWithoutSavingAndWithoutAskingTheNumberAgain', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    renderWizard();
    await screen.findByTestId('stay-guest-0');
    next();

    await screen.findByTestId('checkin-wizard-documents');
    expect(screen.getByTestId('stay-guest-0-document-on-file')).toHaveTextContent('*****5AB');
    next();

    await screen.findByTestId('checkin-wizard-checks-ok');
    expect(checkInWizardApi.saveGuests).not.toHaveBeenCalled();
  });

  it('guestsStep_ServerRefusesAField_ShowsItOnTheFieldAndStaysOnTheStep', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(checkInWizardApi.getState).mockResolvedValue(wizardState({ suggestedStep: 'documents' }));
    vi.mocked(checkInWizardApi.saveGuests).mockRejectedValue(
      httpError(400, { code: 'validation_error', errors: { 'Guests[0].DocumentIssuePlaceName': ['Campo obbligatorio.'] } }),
    );
    renderWizard();
    await screen.findByTestId('stay-guest-0-document');

    change(within(screen.getByTestId('stay-guest-0-document')), /^Numero documento/, 'CA12345AB');
    next();

    const card = within(screen.getByTestId('stay-guest-0-document'));
    expect(await card.findByText('Campo obbligatorio.')).toBeInTheDocument();
    expect(card.getByLabelText(/^Luogo di rilascio/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('checkin-wizard-form')).toHaveAttribute('data-step', 'documents');
  });

  describe('Save and exit', () => {
    it('saveAndExit_NothingChanged_LeavesToTheBookingWithoutSaving', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      renderWizard();
      await screen.findByTestId('stay-guest-0');

      fireEvent.click(screen.getByTestId('checkin-wizard-save-exit'));

      expect(await screen.findByTestId('booking-detail-stub')).toBeInTheDocument();
      expect(checkInWizardApi.saveGuests).not.toHaveBeenCalled();
    });

    it('saveAndExit_ChangedAndComplete_SavesWithTheSameCallThenLeaves', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      vi.mocked(checkInWizardApi.getState).mockResolvedValue(wizardState({ suggestedStep: 'documents' }));
      vi.mocked(checkInWizardApi.saveGuests).mockResolvedValue(wizardState());
      renderWizard();
      await screen.findByTestId('stay-guest-0-document');

      change(within(screen.getByTestId('stay-guest-0-document')), /^Numero documento/, 'CA12345AB');
      fireEvent.click(screen.getByTestId('checkin-wizard-save-exit'));

      expect(await screen.findByTestId('booking-detail-stub')).toBeInTheDocument();
      expect(checkInWizardApi.saveGuests).toHaveBeenCalledTimes(1);
    });

    it('saveAndExit_ChangedButTheDocumentIsMissing_StaysAndSaysWhy', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      renderWizard();
      await screen.findByTestId('stay-guest-0');

      change(within(screen.getByTestId('stay-guest-0')), /^Nome/, 'Anna');
      fireEvent.click(screen.getByTestId('checkin-wizard-save-exit'));

      expect(await screen.findByTestId('checkin-wizard-save-exit-problem')).toHaveTextContent('Per salvare servono i dati completi');
      expect(screen.queryByTestId('booking-detail-stub')).not.toBeInTheDocument();
      expect(checkInWizardApi.saveGuests).not.toHaveBeenCalled();
    });
  });

  describe('checks', () => {
    const blocking: CheckInIssue = { position: 0, code: 'guest_field_missing', field: 'documentNumber', blocking: true };
    const warning: CheckInIssue = { position: 0, code: 'document_expired', field: 'documentExpiresOn', blocking: false };

    it('checksStep_BlockingFirst_ContinueIsClosedAndFixOpensTheStepWithTheFieldInFocus', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      vi.mocked(checkInWizardApi.getState).mockResolvedValue(wizardState({ issues: [warning, blocking], suggestedStep: 'checks' }));
      renderWizard();

      const items = await screen.findAllByTestId('checkin-wizard-issue');
      expect(items.map((item) => item.getAttribute('data-blocking'))).toEqual(['true', 'false']);
      expect(items[0]).toHaveTextContent('Per Giulia Bianchi manca un dato: Numero del documento.');
      expect(screen.getByTestId('checkin-wizard-next')).toBeDisabled();

      fireEvent.click(within(items[0]).getByTestId('checkin-wizard-issue-fix'));

      await screen.findByTestId('stay-guest-0-document');
      await waitFor(() => expect(document.activeElement?.id).toBe('guest-0-documentNumber'));
      // Never to another page: the wizard is still the page.
      expect(screen.getByTestId('checkin-wizard-form')).toHaveAttribute('data-step', 'documents');
    });

    it('checksStep_OnlyWarnings_OfferFixOrContinueAnyway', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      vi.mocked(checkInWizardApi.getState).mockResolvedValue(wizardState({ issues: [warning], suggestedStep: 'checks' }));
      renderWizard();

      const item = await screen.findByTestId('checkin-wizard-issue');
      expect(item).toHaveTextContent('scade prima dell');
      expect(within(item).getByTestId('checkin-wizard-issue-fix')).toBeInTheDocument();
      expect(screen.getByTestId('checkin-wizard-next')).toBeEnabled();
      expect(screen.getByTestId('checkin-wizard-next')).toHaveTextContent('Prosegui comunque');
    });

    it('checksStep_NoIssue_SaysEverythingIsInPlace', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      renderWizard('?step=checks');

      expect(await screen.findByTestId('checkin-wizard-checks-ok')).toHaveTextContent('Tutto a posto');
    });
  });

  describe('tourist tax', () => {
    it('taxStep_PerGuestRows_AMinorByAgeIsAutomaticAndAnyOtherExemptionIsChosenAndSaved', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      const tax = touristTax({
        total: 4,
        guests: [
          { position: 0, nights: 2, taxableNights: 2, amount: 4, exemptionKind: 'None' },
          { position: 1, nights: 2, taxableNights: 0, amount: 0, exemptionKind: 'Age' },
        ],
      });
      vi.mocked(checkInWizardApi.getState).mockResolvedValue(
        wizardState({
          booking: { ...wizardState().booking, declaredGuests: 2 },
          guests: [savedGuest(0, { type: 'HeadOfFamily' }), savedGuest(1, { type: 'FamilyMember', firstName: 'Luca' })],
          tax,
          suggestedStep: 'tax',
        }),
      );
      vi.mocked(checkInWizardApi.getTouristTax).mockResolvedValue(tax);
      vi.mocked(checkInWizardApi.setExemptions).mockResolvedValue(
        touristTax({
          total: 0,
          amountDue: 0,
          guests: [
            { position: 0, nights: 2, taxableNights: 0, amount: 0, exemptionKind: 'Host', exemptionCode: 'resident' },
            { position: 1, nights: 2, taxableNights: 0, amount: 0, exemptionKind: 'Age' },
          ],
        }),
      );
      renderWizard();

      const first = await screen.findByTestId('tax-guest-0');
      // The minor exempt by age is shown as automatic, with no list to choose from.
      expect(within(screen.getByTestId('tax-guest-1')).getByTestId('tax-guest-1-age')).toHaveTextContent('Esente per età (automatico)');
      expect(within(screen.getByTestId('tax-guest-1')).queryByRole('combobox')).not.toBeInTheDocument();
      expect(within(first).getByTestId('tax-guest-0-amount')).toHaveTextContent('4,00');
      const breakdown = screen.getByTestId('checkin-wizard-tax-breakdown');
      expect(breakdown).toHaveTextContent('Ospiti esenti');

      fireEvent.change(within(first).getByTestId('tax-exemption-0'), { target: { value: 'resident' } });

      await waitFor(() => expect(checkInWizardApi.setExemptions).toHaveBeenCalledTimes(1));
      expect(vi.mocked(checkInWizardApi.setExemptions).mock.calls[0]).toEqual([
        BOOKING_ID,
        [
          { position: 0, code: 'resident' },
          { position: 1, code: null },
        ],
      ]);
      await waitFor(() => expect(within(screen.getByTestId('tax-guest-0')).getByTestId('tax-guest-0-amount')).toHaveTextContent('0,00'));
    });

    it('taxStep_ChannelCollectedIt_SaysNothingToCollectAndKeepsTheAmounts', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      const tax = touristTax({ collector: 'Channel', collectorSource: 'ChannelRule', amountDue: 0 });
      vi.mocked(checkInWizardApi.getTouristTax).mockResolvedValue(tax);
      vi.mocked(checkInWizardApi.getState).mockResolvedValue(wizardState({ tax, suggestedStep: 'tax' }));
      renderWizard();

      const alert = await screen.findByTestId('checkin-wizard-tax-channel');
      expect(alert).toHaveTextContent('niente da incassare');
      expect(alert).toHaveTextContent('4,00');
      expect(screen.getByTestId('tax-guest-0-amount')).toHaveTextContent('4,00');
      expect(screen.queryByTestId('checkin-wizard-tax-collector')).not.toBeInTheDocument();
    });

    it('taxStep_CollectorUnknown_AsksWhoCollectedIt', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      const tax = touristTax({ collector: null, collectorNeeded: true, collectorSource: 'Default' });
      vi.mocked(checkInWizardApi.getTouristTax).mockResolvedValue(tax);
      vi.mocked(checkInWizardApi.getState).mockResolvedValue(wizardState({ tax, suggestedStep: 'tax' }));
      vi.mocked(checkInWizardApi.setCollector).mockResolvedValue(touristTax({ collector: 'Host', collectorSource: 'HostDeclared' }));
      renderWizard();

      const question = await screen.findByTestId('checkin-wizard-tax-collector');
      fireEvent.click(within(question).getByTestId('tax-collector-Host'));

      await waitFor(() => expect(checkInWizardApi.setCollector).toHaveBeenCalledWith(BOOKING_ID, 'Host'));
    });

    it('taxStep_NoRate_NeverShowsZeroAndOffersTheMunicipalityTaxThatReturnsToTheSameStep', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      const missing = touristTax({
        status: 'RateUnavailable',
        rateSource: 'None',
        missingRate: true,
        total: null,
        amountDue: null,
        guests: [{ position: 0, nights: 2, taxableNights: 0, amount: null, exemptionKind: 'None' }],
      });
      vi.mocked(checkInWizardApi.getTouristTax).mockResolvedValue(missing);
      vi.mocked(checkInWizardApi.getState).mockResolvedValue(wizardState({ tax: missing, suggestedStep: 'tax' }));
      vi.mocked(checkInWizardApi.saveMunicipalityRate).mockResolvedValue({
        propertyId: PROPERTY_ID,
        city: 'Roma',
        officialRateInForce: false,
        rate: {
          ratePerPersonPerNight: 3,
          minimumAge: 10,
          effectiveFrom: '2026-10-01',
          sourceNote: 'Delibera del comune',
          updatedAt: '2026-11-06T10:00:00Z',
        },
      });
      renderWizard();

      const alert = await screen.findByTestId('checkin-wizard-tax-missing-rate');
      expect(alert).toHaveTextContent("Manca l'imposta del comune");
      // No amount, no zero: the step does not draw the guests or the total while the rate is unknown.
      expect(screen.queryByTestId('checkin-wizard-tax-guests')).not.toBeInTheDocument();
      expect(screen.queryByTestId('checkin-wizard-tax-breakdown')).not.toBeInTheDocument();
      expect(screen.getByTestId('checkin-wizard-tax')).not.toHaveTextContent(/0,00/);

      fireEvent.click(screen.getByTestId('checkin-wizard-tax-enter-rate'));
      const rate = within(await screen.findByTestId('checkin-wizard-tax-rate'));
      // The button waits for the rate the organization declared before (if any) to be read.
      await waitFor(() => expect(rate.getByTestId('tax-rate-save')).toBeEnabled());
      fireEvent.click(rate.getByTestId('tax-rate-save'));
      // Plain words for what is missing, and the focus on the first field.
      expect(await rate.findByText('Scrivi un importo da 0,01 a 50 euro')).toBeInTheDocument();
      expect(rate.getByText("Indica da dove viene l'importo")).toBeInTheDocument();
      await waitFor(() => expect(document.activeElement?.id).toBe('tax-rate-rate'));
      expect(checkInWizardApi.saveMunicipalityRate).not.toHaveBeenCalled();

      fireEvent.change(rate.getByLabelText(/^Importo a persona per notte/), { target: { value: '3,00' } });
      fireEvent.change(rate.getByLabelText(/^Esenti i minori di/), { target: { value: '10' } });
      fireEvent.change(rate.getByLabelText(/^Da dove viene l'importo/), { target: { value: 'Delibera del comune' } });
      vi.mocked(checkInWizardApi.getTouristTax).mockResolvedValue(touristTax({ total: 6, amountDue: 6, rateSource: 'HostDeclared' }));
      fireEvent.click(rate.getByTestId('tax-rate-save'));

      await waitFor(() => expect(checkInWizardApi.saveMunicipalityRate).toHaveBeenCalledTimes(1));
      expect(vi.mocked(checkInWizardApi.saveMunicipalityRate).mock.calls[0]).toEqual([
        PROPERTY_ID,
        { ratePerPersonPerNight: 3, minimumAge: 10, maxNights: null, seasonStart: null, seasonEnd: null, sourceNote: 'Delibera del comune' },
      ]);
      // Back on the same step, with the amounts now.
      await waitFor(() => expect(screen.queryByTestId('checkin-wizard-tax-rate')).not.toBeInTheDocument());
      expect(screen.getByTestId('checkin-wizard-form')).toHaveAttribute('data-step', 'tax');
      expect(await screen.findByTestId('checkin-wizard-tax-breakdown')).toBeInTheDocument();
    });
  });

  describe('send and what happens now', () => {
    it('sendStep_SummaryWithAnEditPerBlock_ThenConfirmShowsOneLinePerElement', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      vi.mocked(checkInWizardApi.confirm).mockResolvedValue(
        confirmation({
          octorate: { state: 'Sent', reason: null, draft: false, correctionAfterSend: true, guests: [{ position: 0, outcome: 'Updated' }] },
          state: wizardState({ capabilities: { documentReading: false, canRegisterArrival: true, canMarkNoShow: false, octorateTaxValues: false } }),
        }),
      );
      renderWizard('?step=send');

      const send = await screen.findByTestId('checkin-wizard-send');
      expect(within(send).getAllByRole('link', { name: /^Modifica/ })).toHaveLength(5);
      expect(within(send).getByTestId('checkin-wizard-send-route')).toHaveTextContent('Octorate');
      expect(send).toHaveTextContent(/4,00.*da incassare/);
      expect(checkInWizardApi.confirm).not.toHaveBeenCalled();

      fireEvent.click(screen.getByTestId('checkin-wizard-confirm'));

      const done = await screen.findByTestId('checkin-wizard-done');
      expect(checkInWizardApi.confirm).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Gli ospiti sono stati inviati a Octorate.')).toBeInTheDocument();
      expect(screen.getByText(/Imposta di soggiorno salvata: .*4,00/)).toBeInTheDocument();
      expect(screen.getByText(/Octorate invia la comunicazione alla Questura quando registri l'arrivo/)).toBeInTheDocument();
      expect(within(done).getByTestId('checkin-wizard-done-correction')).toHaveTextContent('potrebbero richiedere una correzione');
      expect(within(done).getByTestId('checkin-wizard-register-arrival')).toBeInTheDocument();
    });

    it('sendStep_SenderIsNotTheChannelManager_SaysNothingGoesToOctorateAndThePoliceIsYours', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      vi.mocked(checkInWizardApi.getState).mockResolvedValue(
        wizardState({ sender: { alloggiatiSender: 'Manual', source: 'Stored', applies: true } }),
      );
      vi.mocked(checkInWizardApi.confirm).mockResolvedValue(
        confirmation({
          octorate: { state: 'NotApplicable', reason: 'sender_not_channel_manager', draft: false, correctionAfterSend: false, guests: [] },
          alloggiati: { step: 'Manual', sender: 'Manual' },
        }),
      );
      renderWizard('?step=send');

      expect(await screen.findByTestId('checkin-wizard-send-route')).toHaveAttribute('data-route', 'senderManual');
      fireEvent.click(screen.getByTestId('checkin-wizard-confirm'));

      await screen.findByTestId('checkin-wizard-done');
      expect(screen.getByText(/non passa dal gestionale/)).toBeInTheDocument();
      expect(screen.getByText(/La comunicazione alla Questura la fai tu sul portale Alloggiati Web/)).toBeInTheDocument();
      expect(screen.getByTestId('checkin-wizard-done-manual')).toBeInTheDocument();
      expect(screen.queryByTestId('checkin-wizard-register-arrival')).not.toBeInTheDocument();
    });

    it('done_GuestsFailedOnOctorate_ShowsThePlainReasonAndRetryConfirmsAgain', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      vi.mocked(checkInWizardApi.confirm)
        .mockResolvedValueOnce(
          confirmation({
            octorate: {
              state: 'Failed',
              reason: null,
              draft: false,
              correctionAfterSend: false,
              guests: [{ position: 0, outcome: 'Failed', errorCode: 'octorate_rate_limited' }],
            },
          }),
        )
        .mockResolvedValueOnce(confirmation());
      renderWizard('?step=send');
      await screen.findByTestId('checkin-wizard-send');
      fireEvent.click(screen.getByTestId('checkin-wizard-confirm'));

      expect(await screen.findByText(/Octorate è occupato, riprova tra qualche minuto/)).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('checkin-wizard-retry'));

      expect(await screen.findByText('Gli ospiti sono stati inviati a Octorate.')).toBeInTheDocument();
      expect(checkInWizardApi.confirm).toHaveBeenCalledTimes(2);
      expect(screen.queryByTestId('checkin-wizard-done-retry')).not.toBeInTheDocument();
    });

    it('confirm_NotReady_ReturnsToTheChecksWithTheIssues', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      vi.mocked(checkInWizardApi.confirm).mockRejectedValue(
        httpError(422, { code: 'checkin_not_ready', issues: [{ position: 0, code: 'guest_field_missing', field: 'documentNumber', blocking: true }] }),
      );
      renderWizard('?step=send');
      await screen.findByTestId('checkin-wizard-send');
      vi.mocked(checkInWizardApi.getState).mockResolvedValue(
        wizardState({ issues: [{ position: 0, code: 'guest_field_missing', field: 'documentNumber', blocking: true }] }),
      );

      fireEvent.click(screen.getByTestId('checkin-wizard-confirm'));

      await waitFor(() => expect(screen.getByTestId('checkin-wizard-form')).toHaveAttribute('data-step', 'checks'));
      expect(await screen.findByTestId('checkin-wizard-issue')).toHaveTextContent('manca un dato');
      expect(screen.getByTestId('checkin-wizard-error')).toHaveTextContent('Mancano ancora dei dati');
    });
  });

  describe('no-show', () => {
    it('noShow_Capability_IsAHeaderActionThatAsksForConfirmationAndLeavesToTheBooking', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      vi.mocked(checkInWizardApi.getState).mockResolvedValue(
        wizardState({ capabilities: { documentReading: false, canRegisterArrival: false, canMarkNoShow: true, octorateTaxValues: false } }),
      );
      vi.mocked(checkInWizardApi.markNoShow).mockResolvedValue({ bookingId: BOOKING_ID, status: 'Confirmed', noShowAt: '2026-10-10T12:00:00Z' });
      renderWizard();

      fireEvent.click(await screen.findByTestId('checkin-wizard-no-show'));
      const dialog = within(await screen.findByTestId('checkin-wizard-no-show-dialog'));
      expect(checkInWizardApi.markNoShow).not.toHaveBeenCalled();
      fireEvent.click(dialog.getByTestId('checkin-wizard-no-show-confirm'));

      expect(await screen.findByTestId('booking-detail-stub')).toBeInTheDocument();
      expect(checkInWizardApi.markNoShow).toHaveBeenCalledWith(BOOKING_ID);
    });

    it('noShow_Refused_StaysInTheDialogWithThePlainReason', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      vi.mocked(checkInWizardApi.getState).mockResolvedValue(
        wizardState({ capabilities: { documentReading: false, canRegisterArrival: false, canMarkNoShow: true, octorateTaxValues: false } }),
      );
      vi.mocked(checkInWizardApi.markNoShow).mockRejectedValue(httpError(422, { code: 'no_show_too_early', detail: 'x' }));
      renderWizard();

      fireEvent.click(await screen.findByTestId('checkin-wizard-no-show'));
      fireEvent.click(await screen.findByTestId('checkin-wizard-no-show-confirm'));

      expect(await screen.findByTestId('checkin-wizard-no-show-problem')).toHaveTextContent('solo dal giorno del check-in');
      expect(screen.queryByTestId('booking-detail-stub')).not.toBeInTheDocument();
    });

    it('noShow_WithoutTheCapability_HasNoButton', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      renderWizard();
      await screen.findByTestId('checkin-wizard-form');

      expect(screen.queryByTestId('checkin-wizard-no-show')).not.toBeInTheDocument();
    });
  });

  describe('document photo (ADR-013)', () => {
    const readingOf = (overrides: Record<string, unknown> = {}) => ({
      method: 'Mrz' as const,
      confidence: 0.95,
      checkDigitsValid: true,
      requiresManualReview: false,
      fields: { documentType: 'I', documentNumber: 'ca 12345 ab', expirationDate: '2031-04-02' },
      ...overrides,
    });

    function stubObjectUrls() {
      const create = vi.fn(() => 'blob:document-photo-1');
      const revoke = vi.fn();
      Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
      return { create, revoke };
    }

    const photo = () => new File([new Uint8Array([1, 2, 3])], 'passaporto-giulia-bianchi.jpg', { type: 'image/jpeg' });

    it('CheckInWizard_DocumentPhoto_NotKeptInBrowser_Test', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      const urls = stubObjectUrls();
      vi.mocked(checkInWizardApi.getState).mockResolvedValue(
        wizardState({
          suggestedStep: 'documents',
          capabilities: { documentReading: true, canRegisterArrival: false, canMarkNoShow: false, octorateTaxValues: false },
        }),
      );
      vi.mocked(checkInWizardApi.readDocument).mockResolvedValue(readingOf());
      renderWizard();
      await screen.findByTestId('document-photo-0');

      fireEvent.change(screen.getByTestId('document-photo-0-input'), { target: { files: [photo()] } });

      // The reading fills what was empty.
      await waitFor(() => expect(within(screen.getByTestId('stay-guest-0-document')).getByLabelText(/^Numero documento/)).toHaveValue('CA12345AB'));
      expect(screen.getByTestId('document-photo-0-filled')).toBeInTheDocument();
      // The photo went to the request only, under a neutral name (the file name can be a person's).
      expect(checkInWizardApi.readDocument).toHaveBeenCalledTimes(1);
      const [bookingId, sent, fileName] = vi.mocked(checkInWizardApi.readDocument).mock.calls[0];
      expect(bookingId).toBe(BOOKING_ID);
      expect(sent).toBeInstanceOf(Blob);
      expect(fileName).toBe('document.jpg');
      // The preview was an object URL for the time of the reading, and it is revoked.
      expect(urls.create).toHaveBeenCalledTimes(1);
      expect(urls.revoke).toHaveBeenCalledWith('blob:document-photo-1');
      expect(screen.queryByTestId('document-photo-0-reading')).not.toBeInTheDocument();
      // Nothing of the photo, or of the guest, sits in the browser: no draft, no local storage, no session storage.
      expect(sessionStorage.length).toBe(0);
      const stored = Object.keys(localStorage)
        .map((key) => `${key}=${localStorage.getItem(key)}`)
        .join('\n');
      expect(stored).not.toMatch(/CA12345AB|Bianchi|Giulia|passaporto|blob:/);
      expect((screen.getByTestId('document-photo-0-input') as HTMLInputElement).value).toBe('');
    });

    it('documentPhoto_FieldAlreadyTypedDifferently_IsNeverOverwrittenWithoutAsking', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      stubObjectUrls();
      vi.mocked(checkInWizardApi.getState).mockResolvedValue(
        wizardState({
          suggestedStep: 'documents',
          capabilities: { documentReading: true, canRegisterArrival: false, canMarkNoShow: false, octorateTaxValues: false },
        }),
      );
      vi.mocked(checkInWizardApi.readDocument).mockResolvedValue(readingOf({ requiresManualReview: true }));
      renderWizard();
      await screen.findByTestId('document-photo-0');
      const number = () => within(screen.getByTestId('stay-guest-0-document')).getByLabelText(/^Numero documento/);
      fireEvent.change(number(), { target: { value: 'AB1' } });

      fireEvent.change(screen.getByTestId('document-photo-0-input'), { target: { files: [photo()] } });

      const conflicts = await screen.findByTestId('document-photo-0-conflicts');
      expect(conflicts).toHaveTextContent('AB1');
      expect(conflicts).toHaveTextContent('CA12345AB');
      expect(screen.getByTestId('document-photo-0-check')).toHaveTextContent('Controlla questi dati');
      expect(number()).toHaveValue('AB1');

      fireEvent.click(screen.getByTestId('document-photo-0-use'));
      expect(number()).toHaveValue('CA12345AB');
      expect(screen.queryByTestId('document-photo-0-conflicts')).not.toBeInTheDocument();
    });

    it('documentPhoto_ReadingClosed_ThereIsOnlyTheManualPath', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      vi.mocked(checkInWizardApi.getState).mockResolvedValue(wizardState({ suggestedStep: 'documents' }));
      renderWizard();

      await screen.findByTestId('stay-guest-0-document');
      expect(screen.queryByTestId('document-photo-0')).not.toBeInTheDocument();
      expect(within(screen.getByTestId('stay-guest-0-document')).getByLabelText(/^Numero documento/)).toBeInTheDocument();
    });

    it('documentPhoto_NothingRead_SaysSoAndLeavesTheFieldsToTheHost', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
      stubObjectUrls();
      vi.mocked(checkInWizardApi.getState).mockResolvedValue(
        wizardState({
          suggestedStep: 'documents',
          capabilities: { documentReading: true, canRegisterArrival: false, canMarkNoShow: false, octorateTaxValues: false },
        }),
      );
      vi.mocked(checkInWizardApi.readDocument).mockResolvedValue({ method: 'None', confidence: 0, requiresManualReview: true, fields: null });
      renderWizard();
      await screen.findByTestId('document-photo-0');

      fireEvent.change(screen.getByTestId('document-photo-0-input'), { target: { files: [photo()] } });

      expect(await screen.findByTestId('document-photo-0-nothing')).toHaveTextContent('scrivi i dati a mano');
    });
  });
});
