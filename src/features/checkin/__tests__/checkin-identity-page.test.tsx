import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, configure, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import { CheckInPage } from '../checkin-page';
import { publicCheckinApi } from '@/api/checkin.api';
import type { IdentityVerificationState, PublicCheckInContextDto, PublicCheckInGuestPrefill } from '@/types/public-checkin.types';

vi.mock('@/api/checkin.api', () => ({
  publicCheckinApi: {
    getContext: vi.fn(),
    submit: vi.fn(),
    searchCodes: vi.fn(),
    setLanguage: vi.fn(),
    getLegalTexts: vi.fn(),
    postBiometricConsent: vi.fn(),
    postDocument: vi.fn(),
    postSelfie: vi.fn(),
    requestOperator: vi.fn(),
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const TOKEN = 'tok-identity-page';

const FORM_TEST_TIMEOUT_MS = 30_000;

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

const identityState = (overrides: Partial<IdentityVerificationState> = {}): IdentityVerificationState => ({
  step: 'consent',
  result: null,
  biometricOffered: true,
  consentRecorded: false,
  consentRefused: false,
  documentChecked: false,
  attemptsRemaining: 3,
  operatorRequested: false,
  operatorPathOpen: true,
  documentNotArchived: false,
  verifyingGuestPosition: 0,
  ...overrides,
});

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

const withIdentity: PublicCheckInContextDto = { ...openContext, identityVerification: identityState(), documentNotArchived: false };

function renderPage(search = '') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        { initialEntries: [`/checkin/${TOKEN}${search}`] },
        createElement(Routes, null, createElement(Route, { path: '/checkin/:token', element: createElement(CheckInPage) })),
      ),
    ),
  );
}

const guestCard = (index: number) => within(screen.getByTestId(`stay-guest-${index}`));

function change(scope: ReturnType<typeof within>, label: RegExp, value: string) {
  fireEvent.change(scope.getByLabelText(label), { target: { value } });
}

function fillGuest(index: number, firstName: string, dateOfBirth = '1992-03-08') {
  const card = guestCard(index);
  change(card, /^Nome/, firstName);
  change(card, /^Cognome/, 'Bianchi');
  change(card, /^Sesso/, 'Female');
  change(card, /^Data di nascita/, dateOfBirth);
  change(card, /^Luogo di nascita/, 'yes');
  change(card, /^Comune di nascita/, 'Firenze');
  change(card, /^Provincia/, 'FI');
  change(card, /^Cittadinanza/, 'Italia');
}

function fillDocument(index: number) {
  const card = within(screen.getByTestId(`stay-guest-${index}-document`));
  change(card, /^Tipo documento/, 'IdentityCard');
  change(card, /^Numero documento/, 'CA12345AB');
  change(card, /^Luogo di rilascio/, 'Firenze');
}

async function formReady() {
  await screen.findByTestId('checkin-page');
  if (screen.queryByTestId('checkin-document-step')) fireEvent.click(screen.getByTestId('checkin-enter-manually'));
  await waitFor(() => expect(guestCard(0).getByLabelText(/^Nome/)).toHaveValue('Mario'));
}

async function goToTheStepAfterTheDocument() {
  await formReady();
  fillGuest(0, 'Giulia');
  fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));
  await screen.findByTestId('stay-guest-0-document');
  fillDocument(0);
  fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));
}

const stepLabel = () => screen.getByText(/^Passo \d+ di \d+$/).textContent;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(publicCheckinApi.searchCodes).mockResolvedValue([]);
  vi.mocked(publicCheckinApi.getContext).mockResolvedValue(withIdentity);
  vi.mocked(publicCheckinApi.getLegalTexts).mockResolvedValue({
    language: 'it',
    texts: [{ kind: 'biometric-consent', version: 'checkin-biometric-2026-11', language: 'it', isDraft: false, contentHtml: '<p>Il tuo selfie non viene mai salvato.</p>' }],
  });
  await i18n.changeLanguage('it');
});

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('it');
  document.documentElement.lang = 'it';
});

describe('CheckInPage with the identity verification (E03/F04/US03/T01)', () => {
  it('identityStep_TheApiOffersTheVerification_IsAStepAfterTheDocumentAndNextWaitsForItsEnd', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    renderPage();

    await goToTheStepAfterTheDocument();

    await screen.findByTestId('checkin-identity-step');
    expect(stepLabel()).toBe('Passo 4 di 5');
    expect(screen.getByTestId('checkin-progress').children).toHaveLength(5);
    expect(screen.getByRole('heading', { name: i18n.t('checkin.stepIdentity') })).toBeInTheDocument();
    expect(screen.getAllByTestId('checkin-biometric-consent')).toHaveLength(1);
    expect(screen.getByTestId('checkin-next')).toBeDisabled();
    expect(screen.getByTestId('checkin-biometric-decline')).toBeEnabled();
  });

  it('identityStep_VerificationOff_TheStepsAreTheOnesTheyHaveAlwaysBeenAndNothingChanges', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue(openContext);
    renderPage();

    await goToTheStepAfterTheDocument();

    await screen.findByTestId('checkin-privacy-notice');
    expect(stepLabel()).toBe('Passo 4 di 4');
    expect(screen.queryByTestId('checkin-identity-step')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkin-progress').children).toHaveLength(4);
  });

  it('identityStep_TheGuestRefusesTheConsent_APersonHasItSoTheGuestGoesOnToTheInvoice', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(publicCheckinApi.postBiometricConsent).mockResolvedValue({
      consentRecorded: false,
      result: 'operator',
      biometricOffered: false,
      operatorPathOpen: true,
      state: identityState({ step: 'operator', consentRefused: true, operatorRequested: true, biometricOffered: false }),
    });
    renderPage();
    await goToTheStepAfterTheDocument();

    fireEvent.click(await screen.findByTestId('checkin-biometric-decline'));
    await screen.findByTestId('identity-operator-text');
    await waitFor(() => expect(screen.getByTestId('checkin-next')).toBeEnabled());
    fireEvent.click(screen.getByTestId('checkin-next'));

    await screen.findByTestId('checkin-privacy-notice');
    expect(stepLabel()).toBe('Passo 5 di 5');
    expect(publicCheckinApi.postBiometricConsent).toHaveBeenCalledWith(TOKEN, { consentGiven: false });
  });

  it('identityStep_GoingBackAndForth_KeepsWhatWasTypedAndWhereTheGuestIsInTheCheck', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(publicCheckinApi.postBiometricConsent).mockResolvedValue({
      consentRecorded: false,
      result: 'operator',
      biometricOffered: false,
      operatorPathOpen: true,
      state: identityState({ step: 'operator', consentRefused: true, operatorRequested: true, biometricOffered: false }),
    });
    renderPage();
    await goToTheStepAfterTheDocument();
    fireEvent.click(await screen.findByTestId('checkin-biometric-decline'));
    await waitFor(() => expect(screen.getByTestId('checkin-next')).toBeEnabled());
    fireEvent.click(screen.getByTestId('checkin-next'));
    await screen.findByTestId('checkin-privacy-notice');

    fireEvent.click(screen.getByRole('button', { name: /Indietro/ }));
    await screen.findByTestId('checkin-identity-step');
    expect(screen.getByTestId('checkin-identity-step')).toHaveAttribute('data-stage', 'operator');
    expect(publicCheckinApi.postBiometricConsent).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Indietro/ }));
    await screen.findByTestId('stay-guest-0-document');
    expect(within(screen.getByTestId('stay-guest-0-document')).getByLabelText(/^Numero documento/)).toHaveValue('CA12345AB');
  });

  it('identityStep_AFamily_AsksForOneConsentAndOneSelfieAndNoOtherGuestIsAsked', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue({
      ...withIdentity,
      declaredGuests: 3,
      guests: [{ ...booker, type: 'HeadOfFamily' }],
    });
    renderPage();
    await screen.findByTestId('checkin-document-step');
    fireEvent.click(screen.getByTestId('checkin-enter-manually'));
    await screen.findByTestId('stay-guest-2');
    fillGuest(0, 'Giulia', '1982-05-01');
    fillGuest(1, 'Marco', '2018-07-21');
    fillGuest(2, 'Anna', '1950-01-02');
    fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));
    await screen.findByTestId('stay-guest-0-document');
    expect(screen.queryByTestId('stay-guest-1-document')).not.toBeInTheDocument();
    fillDocument(0);
    fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));

    await screen.findByTestId('checkin-identity-step');
    expect(screen.getAllByTestId('checkin-biometric-consent')).toHaveLength(1);
    expect(screen.getAllByTestId('checkin-identity-step')).toHaveLength(1);
    expect(screen.queryByTestId('checkin-selfie-capture')).not.toBeInTheDocument();
    expect(screen.getByText(i18n.t('checkin.identity.intro'))).toBeInTheDocument();
  });

  it('identityStep_TheLinkOpenedAgainAfterAPass_ShowsItAsVerifiedAndNextIsOpen', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue({ ...withIdentity, identityVerification: identityState({ step: 'done', result: 'ok' }) });
    renderPage();

    await goToTheStepAfterTheDocument();

    expect(await screen.findByTestId('identity-result-ok')).toBeInTheDocument();
    expect(screen.getByTestId('checkin-next')).toBeEnabled();
  });

  it('identityStep_TicinoProperty_ShowsTheNoticeFromTheContext', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue({
      ...withIdentity,
      documentNotArchived: true,
      identityVerification: identityState({ documentNotArchived: true }),
    });
    renderPage();

    await goToTheStepAfterTheDocument();

    expect(await screen.findByTestId('checkin-document-not-archived')).toHaveTextContent('Il documento non sarà archiviato.');
  });
});

describe('CheckInPage opened through the door of the property (E22/F02/US01/T01)', () => {
  it('doorEntry_TheAddressSaysIdentity_StartsAtTheIdentityStepWithTheTextOfTheRegistry', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    renderPage('?step=identity');

    await screen.findByTestId('checkin-identity-step');
    expect(stepLabel()).toBe('Passo 4 di 5');
    expect(await screen.findByTestId('checkin-consent-text')).toHaveTextContent('Il tuo selfie non viene mai salvato.');
    expect(publicCheckinApi.getLegalTexts).toHaveBeenCalledWith(TOKEN, 'it');
  });

  it('doorEntry_NoStepInTheAddress_StartsAtTheFirstStepAsItAlwaysDid', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    renderPage();

    await screen.findByTestId('checkin-page');
    expect(screen.queryByTestId('checkin-identity-step')).not.toBeInTheDocument();
    expect(stepLabel()).toBe('Passo 1 di 5');
  });

  it('doorEntry_TheVerificationIsOffForTheStay_StartsAtTheFirstStepWhateverTheAddressSays', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue(openContext);
    renderPage('?step=identity');

    await screen.findByTestId('checkin-page');
    expect(screen.queryByTestId('checkin-identity-step')).not.toBeInTheDocument();
    expect(stepLabel()).toBe('Passo 1 di 4');
  });

  it('doorEntry_SendingWithTheDataNeverTyped_TakesTheGuestToTheStepThatHoldsIt', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(publicCheckinApi.postBiometricConsent).mockResolvedValue({
      consentRecorded: false,
      result: 'operator',
      biometricOffered: false,
      operatorPathOpen: true,
      state: identityState({ step: 'operator', consentRefused: true, operatorRequested: true, biometricOffered: false }),
    });
    renderPage('?step=identity');
    fireEvent.click(await screen.findByTestId('checkin-biometric-decline'));
    await waitFor(() => expect(screen.getByTestId('checkin-next')).toBeEnabled());
    fireEvent.click(screen.getByTestId('checkin-next'));
    fireEvent.click(within(await screen.findByTestId('checkin-privacy-notice')).getByRole('checkbox'));
    fireEvent.click(await screen.findByTestId('checkin-submit'));

    await screen.findByTestId('stay-guest-0');
    expect(stepLabel()).toBe('Passo 2 di 5');
    expect(publicCheckinApi.submit).not.toHaveBeenCalled();
  });
});
