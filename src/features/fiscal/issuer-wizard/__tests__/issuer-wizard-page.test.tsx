import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getIssuerSettings, saveIssuerSettings } from '@/api/fiscal-issuer.api';
import { fiscalApi } from '@/api/fiscal.api';
import { readWizardDraft } from '@/lib/wizard-draft';
import { expectNoAxeViolations } from '@/test/axe';
import { AREA_HOME_PATH, FISCAL_PATH, ISSUER_PATH } from '../issuer-paths';
import { IssuerWizardPage } from '../issuer-wizard-page';
import { ISSUER_DRAFT_VERSION, ISSUER_WIZARD_ID } from '../issuer-wizard-schema';
import { SCOPE, completedSetting, problem, settings } from './issuer-fixtures';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/queries/use-users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/queries/use-users')>()),
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1', name: 'Casa Mia Srl' } }),
}));
vi.mock('@/api/fiscal-issuer.api', () => ({ getIssuerSettings: vi.fn(), saveIssuerSettings: vi.fn(), getIssuerPreview: vi.fn() }));
vi.mock('@/api/fiscal.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/fiscal.api')>();
  return { ...actual, fiscalApi: { putTaxProfile: vi.fn() } };
});
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));

// A whole wizard is rendered in these tests (and some are checked with axe): the 5 s of the default are not enough on a loaded CI runner.
vi.setConfig({ testTimeout: 30_000 });

const WAIT = { timeout: 5000 };

function LocationProbe() {
  const location = useLocation();
  return createElement('div', { 'data-testid': 'location' }, `${location.pathname}${location.search}`);
}

/** The wizard on its own route, with the pages it can lead to marked. */
function renderWizard(url: string = ISSUER_PATH) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        { initialEntries: [url] },
        createElement(LocationProbe),
        createElement(
          Routes,
          null,
          createElement(Route, { path: ISSUER_PATH, element: createElement(IssuerWizardPage) }),
          createElement(Route, { path: FISCAL_PATH, element: createElement('div', { 'data-testid': 'fiscal-page' }) }),
          createElement(Route, { path: AREA_HOME_PATH, element: createElement('div', { 'data-testid': 'home-page' }) }),
        ),
      ),
    ),
  );
}

const wizard = () => screen.getByTestId('fiscal-issuer-wizard');
const next = () => screen.getByTestId('fiscal-issuer-next');
const finish = () => screen.getByTestId('fiscal-issuer-finish');
const text = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

async function onStep(step: string) {
  await waitFor(() => expect(wizard()).toHaveAttribute('data-step', step), WAIT);
}

/** Presses «Continua» and waits for the step it leads to. */
async function goTo(step: string) {
  fireEvent.click(next());
  await onStep(step);
}

function type(testId: string, value: string) {
  fireEvent.change(screen.getByTestId(testId), { target: { value } });
}

/** From the first step to the summary of a wizard whose data is all there (a saved setting): «Continua» on each step. */
async function throughTo(last: string, steps: string[]) {
  for (const step of steps) await goTo(step);
  await onStep(last);
}

/** A problem is on screen: on its field and, after a refused «Continua», in the list of the shell too. */
async function expectProblem(key: string) {
  expect((await screen.findAllByText(text(key))).length).toBeGreaterThan(0);
}

/** Every link inside the wizard goes to a step of the wizard: nothing in it leads to another page of the app (NF-02). */
function expectNoLinkLeavesTheWizard() {
  for (const link of wizard().querySelectorAll('a[href]')) {
    expect(link.getAttribute('href')).toMatch(new RegExp(`^${ISSUER_PATH}\\?step=`));
  }
}

beforeEach(async () => {
  vi.resetAllMocks();
  sessionStorage.clear();
  await i18n.changeLanguage('it');
  vi.mocked(getIssuerSettings).mockResolvedValue(settings());
  vi.mocked(saveIssuerSettings).mockImplementation(async (request) =>
    completedSetting({ mode: request.mode, regime: request.regime, confirmedAt: '2026-11-10T10:00:00Z' }),
  );
  vi.mocked(fiscalApi.putTaxProfile).mockResolvedValue({
    hasPartitaIva: true,
    partitaIvaNumber: '12345678901',
    fiscalCode: null,
    fiscalDataRetentionUntil: null,
  });
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe('who issues the documents (step 1)', () => {
  it('IssuerWizard_FirstStep_OffersTheThreeChoicesInPlainWordsAndNeverNamesTheChannelManager', async () => {
    renderWizard();
    await onStep('who');

    expect(screen.getByRole('heading', { level: 2, name: text('fiscalDocuments.issuer.steps.who.title') })).toBeInTheDocument();
    expect(screen.getByTestId('fiscal-issuer-mode-Octorate')).toBeInTheDocument();
    expect(screen.getByTestId('fiscal-issuer-mode-CasaZenDirectOnly')).toBeInTheDocument();
    expect(screen.getByTestId('fiscal-issuer-mode-Accountant')).toBeInTheDocument();
    expect(screen.getByText(text('fiscalDocuments.issuer.who.channelManager.title'))).toBeInTheDocument();
    expect(screen.getByText(text('fiscalDocuments.issuer.who.casazen.title'))).toBeInTheDocument();
    expect(screen.getByText(text('fiscalDocuments.issuer.who.accountant.title'))).toBeInTheDocument();
    // "Il tuo channel manager", never its name (NF-12): this is not where the host acts on its site.
    expect(wizard().textContent).not.toMatch(/octorate/i);
    expect(wizard().textContent).toMatch(/channel manager/i);
  });

  it('IssuerWizard_CasazenIssuingOff_TheChoiceIsBlockedWithItsReason', async () => {
    vi.mocked(getIssuerSettings).mockResolvedValue(settings({ casazenIssuanceEnabled: false, octorateConnected: true }));
    renderWizard();
    await onStep('who');

    expect(screen.getByTestId('fiscal-issuer-mode-CasaZenDirectOnly')).toBeDisabled();
    expect(screen.getByText(text('fiscalDocuments.issuer.who.casazen.unavailable'))).toBeInTheDocument();
    expect(screen.getByTestId('fiscal-issuer-mode-Octorate')).toBeEnabled();
    expect(screen.getByTestId('fiscal-issuer-mode-Accountant')).toBeEnabled();
  });

  it('IssuerWizard_ChannelManagerNotConnected_TheChoiceIsBlockedWithItsReason', async () => {
    renderWizard();
    await onStep('who');

    expect(screen.getByTestId('fiscal-issuer-mode-Octorate')).toBeDisabled();
    expect(screen.getByText(text('fiscalDocuments.issuer.who.channelManager.unavailable'))).toBeInTheDocument();
    expect(screen.getByTestId('fiscal-issuer-mode-CasaZenDirectOnly')).toBeEnabled();
  });

  it('IssuerWizard_ChannelManager_IsRecommendedOnlyWhenItIssuesEveryBookingAndIsConnected', async () => {
    vi.mocked(getIssuerSettings).mockResolvedValue(settings({ octorateConnected: true, octorateIssuesAllBookings: true }));
    const view = renderWizard();
    await onStep('who');
    expect(screen.getByTestId('fiscal-issuer-recommended')).toHaveTextContent(text('fiscalDocuments.issuer.who.recommended'));
    expect(screen.getByTestId('fiscal-issuer-mode-Octorate')).toBeEnabled();
    view.unmount();

    // Connected, but not every booking can be issued there: one choice among the others.
    vi.mocked(getIssuerSettings).mockResolvedValue(settings({ octorateConnected: true, octorateIssuesAllBookings: false }));
    const second = renderWizard();
    await onStep('who');
    expect(screen.queryByTestId('fiscal-issuer-recommended')).not.toBeInTheDocument();
    expect(screen.getByTestId('fiscal-issuer-mode-Octorate')).toBeEnabled();
    second.unmount();

    // Every booking can be issued there, but the organization is not connected: not recommended, and not a choice yet.
    vi.mocked(getIssuerSettings).mockResolvedValue(settings({ octorateConnected: false, octorateIssuesAllBookings: true }));
    renderWizard();
    await onStep('who');
    expect(screen.queryByTestId('fiscal-issuer-recommended')).not.toBeInTheDocument();
    expect(screen.getByTestId('fiscal-issuer-mode-Octorate')).toBeDisabled();
  });

  it('IssuerWizard_Continue_WithoutAnAnswerStaysAndSaysWhy', async () => {
    renderWizard();
    await onStep('who');

    fireEvent.click(next());

    await expectProblem('fiscalDocuments.issuer.errors.modeRequired');
    expect(wizard()).toHaveAttribute('data-step', 'who');
  });

  it('IssuerWizard_SavedCasazenWhileIssuingIsOff_IsSentBackToTheQuestion', async () => {
    vi.mocked(getIssuerSettings).mockResolvedValue(completedSetting({ casazenIssuanceEnabled: false }));
    renderWizard();
    await onStep('who');

    fireEvent.click(next());

    await expectProblem('fiscalDocuments.issuer.errors.casazenUnavailable');
    expect(wizard()).toHaveAttribute('data-step', 'who');
  });
});

describe('the regime and the example document (step 2)', () => {
  it('IssuerWizard_Regime_TwoQuestionsLeadToAnExampleOfTheDocumentOfTheRegime', async () => {
    renderWizard();
    await onStep('who');
    fireEvent.click(screen.getByTestId('fiscal-issuer-mode-Accountant'));
    await goTo('regime');

    expect(screen.queryByTestId('fiscal-issuer-example')).not.toBeInTheDocument();
    expect(screen.queryByTestId('fiscal-issuer-vat-regime')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('fiscal-issuer-vat-no'));
    expect(screen.getByTestId('fiscal-issuer-example')).toHaveAttribute('data-regime', 'PrivatePerson');
    expect(within(screen.getByTestId('fiscal-issuer-example')).getByText(text('fiscalDocuments.issuer.example.PrivatePerson.title'))).toBeInTheDocument();
    expect(screen.queryByTestId('fiscal-issuer-vat-regime')).not.toBeInTheDocument();

    // Only whoever has a VAT number is asked which regime it applies.
    fireEvent.click(screen.getByTestId('fiscal-issuer-vat-yes'));
    expect(screen.getByTestId('fiscal-issuer-vat-regime')).toBeInTheDocument();
    expect(screen.queryByTestId('fiscal-issuer-example')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('fiscal-issuer-vat-regime-flatRate'));
    expect(screen.getByTestId('fiscal-issuer-example')).toHaveAttribute('data-regime', 'VatFlatRate');
    fireEvent.click(screen.getByTestId('fiscal-issuer-vat-regime-ordinary'));
    expect(screen.getByTestId('fiscal-issuer-example')).toHaveAttribute('data-regime', 'VatOrdinary');
    // An example, not the rule: the accountant confirms the final document.
    expect(screen.getByText(text('fiscalDocuments.issuer.example.note'))).toBeInTheDocument();
  });

  it('IssuerWizard_Regime_ChoosingNoVatNumberForgetsTheRegimeOfTheSecondQuestion', async () => {
    renderWizard();
    await onStep('who');
    fireEvent.click(screen.getByTestId('fiscal-issuer-mode-Accountant'));
    await goTo('regime');
    fireEvent.click(screen.getByTestId('fiscal-issuer-vat-yes'));
    fireEvent.click(screen.getByTestId('fiscal-issuer-vat-regime-flatRate'));
    fireEvent.click(screen.getByTestId('fiscal-issuer-vat-no'));
    fireEvent.click(screen.getByTestId('fiscal-issuer-vat-yes'));

    // Back on «yes»: nobody answered the second question again, so none is chosen.
    expect(screen.getByTestId('fiscal-issuer-vat-regime-flatRate')).not.toBeChecked();
    fireEvent.click(next());
    await expectProblem('fiscalDocuments.issuer.errors.vatRegime');
    expect(wizard()).toHaveAttribute('data-step', 'regime');
  });
});

describe('another issuer: the issuer steps do not exist', () => {
  it('IssuerWizard_Accountant_GoesFromTheRegimeToTheSummaryAndSavesWhoIssuesAndTheRegime', async () => {
    vi.mocked(getIssuerSettings)
      .mockResolvedValueOnce(settings())
      .mockResolvedValue(completedSetting({ mode: 'Accountant', regime: 'PrivatePerson', confirmedAt: '2026-11-10T10:00:00Z' }));
    renderWizard();
    await onStep('who');
    fireEvent.click(screen.getByTestId('fiscal-issuer-mode-Accountant'));
    await goTo('regime');
    fireEvent.click(screen.getByTestId('fiscal-issuer-vat-no'));
    await goTo('summary');

    const effects = screen.getByTestId('fiscal-issuer-effects');
    expect(within(effects).getByText(text('fiscalDocuments.issuer.effects.accountant.issues'))).toBeInTheDocument();
    expect(within(effects).getByText(text('fiscalDocuments.issuer.effects.change'))).toBeInTheDocument();
    // Nothing has been sent until the last button.
    expect(saveIssuerSettings).not.toHaveBeenCalled();

    fireEvent.click(finish());

    await waitFor(() => expect(saveIssuerSettings).toHaveBeenCalledTimes(1), WAIT);
    expect(vi.mocked(saveIssuerSettings).mock.calls[0][0]).toMatchObject({ mode: 'Accountant', regime: 'PrivatePerson', confirmed: true });
    expect(fiscalApi.putTaxProfile).not.toHaveBeenCalled();
    expect(await screen.findByTestId('fiscal-issuer-done', undefined, WAIT)).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith(text('fiscalDocuments.issuer.saved'));
    // One suggested next step and the way home.
    expect(screen.getByTestId('wizard-done-primary')).toHaveAttribute('href', FISCAL_PATH);
    expect(screen.getByTestId('wizard-done-secondary')).toHaveAttribute('href', AREA_HOME_PATH);
  });

  it('IssuerWizard_ChannelManager_SavesItAndSaysThereIsOneIssuerPerBooking', async () => {
    vi.mocked(getIssuerSettings)
      .mockResolvedValueOnce(settings({ octorateConnected: true, octorateIssuesAllBookings: true }))
      .mockResolvedValue(
        completedSetting({ mode: 'Octorate', regime: 'VatOrdinary', octorateConnected: true, confirmedAt: '2026-11-10T10:00:00Z' }),
      );
    renderWizard();
    await onStep('who');
    fireEvent.click(screen.getByTestId('fiscal-issuer-mode-Octorate'));
    await goTo('regime');
    fireEvent.click(screen.getByTestId('fiscal-issuer-vat-yes'));
    fireEvent.click(screen.getByTestId('fiscal-issuer-vat-regime-ordinary'));
    await goTo('summary');

    const effects = screen.getByTestId('fiscal-issuer-effects');
    expect(within(effects).getByText(text('fiscalDocuments.issuer.effects.octorate.oneIssuer'))).toBeInTheDocument();
    expect(wizard().textContent).not.toMatch(/octorate/i);
    fireEvent.click(finish());

    await waitFor(() => expect(saveIssuerSettings).toHaveBeenCalledTimes(1), WAIT);
    expect(vi.mocked(saveIssuerSettings).mock.calls[0][0]).toMatchObject({ mode: 'Octorate', regime: 'VatOrdinary', confirmed: true });
    expect(await screen.findByTestId('fiscal-issuer-done', undefined, WAIT)).toBeInTheDocument();
  });
});

describe('CasaZen issues: the data and the address of the issuer', () => {
  it('IssuerWizard_Casazen_AsksTheDataAndTheAddressAndAddsTheVatNumberToTheTaxProfileBeforeSaving', async () => {
    vi.mocked(getIssuerSettings)
      .mockResolvedValueOnce(settings())
      .mockResolvedValue(completedSetting({ mode: 'CasaZenDirectOnly', regime: 'VatFlatRate', confirmedAt: '2026-11-10T10:00:00Z' }));
    renderWizard();
    await onStep('who');
    fireEvent.click(screen.getByTestId('fiscal-issuer-mode-CasaZenDirectOnly'));
    await goTo('regime');
    fireEvent.click(screen.getByTestId('fiscal-issuer-vat-yes'));
    fireEvent.click(screen.getByTestId('fiscal-issuer-vat-regime-flatRate'));
    await goTo('issuer');

    // Pre-filled from what CasaZen knows: the name of the organization. The VAT number is asked because the tax profile has none.
    expect(screen.getByTestId('fiscal-issuer-legal-name')).toHaveValue('Casa Mia Srl');
    expect(screen.getByTestId('fiscal-issuer-vat-number')).toBeInTheDocument();
    expect(screen.getByTestId('fiscal-issuer-more-options')).not.toHaveAttribute('open');
    type('fiscal-issuer-vat-number', '123 456 789 01');
    await goTo('address');

    type('fiscal-issuer-street', 'Via Roma');
    type('fiscal-issuer-civic', '12');
    type('fiscal-issuer-postal-code', '20121');
    type('fiscal-issuer-city', 'Milano');
    type('fiscal-issuer-province', 'mi');
    await goTo('summary');

    const summary = screen.getByTestId('fiscal-issuer-summary-step');
    expect(summary).toHaveTextContent('Casa Mia Srl');
    expect(summary).toHaveTextContent('Via Roma 12, 20121 Milano (MI)');
    expect(summary).toHaveTextContent('12345678901');
    // The sending to the SDI is not there yet: the XML is downloaded (the server has no channel for it).
    expect(within(screen.getByTestId('fiscal-issuer-effects')).getByText(text('fiscalDocuments.issuer.effects.sdi.notAvailable'))).toBeInTheDocument();
    expect(within(screen.getByTestId('fiscal-issuer-effects')).getByText(text('fiscalDocuments.issuer.effects.casazen.portals'))).toBeInTheDocument();

    fireEvent.click(finish());
    await waitFor(() => expect(saveIssuerSettings).toHaveBeenCalledTimes(1), WAIT);

    expect(fiscalApi.putTaxProfile).toHaveBeenCalledWith({ hasPartitaIva: true, partitaIvaNumber: '12345678901' });
    expect(vi.mocked(saveIssuerSettings).mock.calls[0][0]).toEqual({
      mode: 'CasaZenDirectOnly',
      regime: 'VatFlatRate',
      confirmed: true,
      issuer: {
        legalName: 'Casa Mia Srl',
        addressStreet: 'Via Roma',
        addressCivic: '12',
        postalCode: '20121',
        city: 'Milano',
        province: 'MI',
        countryCode: 'IT',
      },
    });
    // The identifier goes to the tax profile first: the setting is refused without it.
    expect(vi.mocked(fiscalApi.putTaxProfile).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(saveIssuerSettings).mock.invocationCallOrder[0]);
    expect(await screen.findByTestId('fiscal-issuer-done', undefined, WAIT)).toBeInTheDocument();
  });

  it('IssuerWizard_Casazen_AnIdentifierOnRecordIsShownNotAskedAndNotRewritten', async () => {
    const saved = completedSetting({
      regime: 'VatOrdinary',
      issuer: { ...completedSetting().issuer, vatNumber: '99999999999', fiscalCode: undefined },
    });
    vi.mocked(getIssuerSettings).mockResolvedValueOnce(saved).mockResolvedValue({ ...saved, confirmedAt: '2026-11-10T10:00:00Z' });
    renderWizard();
    await onStep('who');
    await throughTo('issuer', ['regime', 'issuer']);

    expect(screen.queryByTestId('fiscal-issuer-vat-number')).not.toBeInTheDocument();
    expect(screen.getByTestId('fiscal-issuer-on-record')).toHaveTextContent('99999999999');
    expect(screen.getByTestId('fiscal-issuer-legal-name')).toHaveValue('Mario Rossi');
    await throughTo('summary', ['address', 'summary']);
    fireEvent.click(finish());

    await waitFor(() => expect(saveIssuerSettings).toHaveBeenCalledTimes(1), WAIT);
    expect(fiscalApi.putTaxProfile).not.toHaveBeenCalled();
  });

  it('IssuerWizard_Casazen_TheChecksOfTheStepAreOnTheFieldsAndTheStepStays', async () => {
    renderWizard();
    await onStep('who');
    fireEvent.click(screen.getByTestId('fiscal-issuer-mode-CasaZenDirectOnly'));
    await goTo('regime');
    fireEvent.click(screen.getByTestId('fiscal-issuer-vat-yes'));
    fireEvent.click(screen.getByTestId('fiscal-issuer-vat-regime-ordinary'));
    await goTo('issuer');

    // A partita IVA that is not one, and a code of the options that is not one: all the problems of the step come together.
    type('fiscal-issuer-vat-number', '1234');
    fireEvent.click(screen.getByText(text('fiscalDocuments.issuer.data.moreOptions')));
    type('fiscal-issuer-sdi-code', 'ABC');
    fireEvent.click(next());

    await expectProblem('fiscalDocuments.issuer.errors.vatNumber');
    await expectProblem('fiscalDocuments.issuer.errors.issuerSdiRecipientCode');
    expect(screen.getByTestId('fiscal-issuer-vat-number')).toHaveAttribute('aria-invalid', 'true');
    expect(wizard()).toHaveAttribute('data-step', 'issuer');
  });

  it('IssuerWizard_SdiWithAChannel_TheSummaryDoesNotSayItIsMissing', async () => {
    const saved = completedSetting({ sdi: { providerConfigured: true, providerName: 'Intermediary' } });
    vi.mocked(getIssuerSettings).mockResolvedValue(saved);
    renderWizard();
    await onStep('who');
    await throughTo('summary', ['regime', 'issuer', 'address', 'summary']);

    const effects = screen.getByTestId('fiscal-issuer-effects');
    expect(within(effects).getByText(text('fiscalDocuments.issuer.effects.sdi.available'))).toBeInTheDocument();
    expect(within(effects).queryByText(text('fiscalDocuments.issuer.effects.sdi.notAvailable'))).not.toBeInTheDocument();
  });
});

describe('the summary and the way back', () => {
  it('IssuerWizard_Summary_EditGoesBackToTheStepOfTheAnswer', async () => {
    vi.mocked(getIssuerSettings).mockResolvedValue(completedSetting());
    renderWizard();
    await onStep('who');
    await throughTo('summary', ['regime', 'issuer', 'address', 'summary']);

    const summary = screen.getByTestId('fiscal-issuer-summary-step');
    const field = text('fiscalDocuments.issuer.summary.items.regime');
    fireEvent.click(within(summary).getByRole('link', { name: text('wizard.summary.editField', { field }) }));
    await onStep('regime');

    // The answers are kept: back on the summary nothing was asked again.
    expect(screen.getByTestId('fiscal-issuer-vat-no')).toBeChecked();
    await goTo('issuer');
    await throughTo('summary', ['address', 'summary']);
    fireEvent.click(within(screen.getByTestId('fiscal-issuer-summary-step')).getByRole('link', { name: text('wizard.summary.editField', { field: text('fiscalDocuments.issuer.summary.items.address') }) }));
    await onStep('address');
  });

  it('IssuerWizard_NoLinkInTheWizardLeavesIt_OnEveryStep', async () => {
    vi.mocked(getIssuerSettings).mockResolvedValue(completedSetting());
    renderWizard();
    await onStep('who');
    expectNoLinkLeavesTheWizard();

    for (const step of ['regime', 'issuer', 'address', 'summary']) {
      await goTo(step);
      expectNoLinkLeavesTheWizard();
    }
    // The summary has its «Modifica» links, and they all stay in the wizard.
    expect(within(wizard()).getAllByRole('link').length).toBeGreaterThan(0);
  });

  it('IssuerWizard_Wizard_NamesNoChannelManagerOnAnyStepOfAnyChoice', async () => {
    vi.mocked(getIssuerSettings).mockResolvedValue(completedSetting({ octorateConnected: true, octorateIssuesAllBookings: true }));
    renderWizard();
    await onStep('who');
    expect(wizard().textContent).not.toMatch(/octorate/i);
    for (const step of ['regime', 'issuer', 'address', 'summary']) {
      await goTo(step);
      expect(wizard().textContent).not.toMatch(/octorate/i);
    }
  });
});

describe('a refused save', () => {
  async function toTheSummaryOfACompleteSetting() {
    vi.mocked(getIssuerSettings).mockResolvedValue(completedSetting());
    renderWizard();
    await onStep('who');
    await throughTo('summary', ['regime', 'issuer', 'address', 'summary']);
  }

  it('IssuerWizard_ProfileIncomplete_ShowsTheMissingFieldsOnTheRightStepWithAWayToFixThem', async () => {
    vi.mocked(saveIssuerSettings).mockRejectedValue(problem(422, { code: 'issuer_profile_incomplete', fields: ['postalCode', 'legalName'] }));
    await toTheSummaryOfACompleteSetting();

    fireEvent.click(finish());

    const problems = await screen.findByTestId('fiscal-issuer-problems', undefined, WAIT);
    expect(within(problems).getByTestId('fiscal-issuer-problem-postalCode')).toHaveTextContent(text('fiscalDocuments.issuer.errors.postalCode'));
    expect(within(problems).getByTestId('fiscal-issuer-problem-legalName')).toHaveTextContent(text('fiscalDocuments.issuer.errors.legalName'));
    expect(wizard()).toHaveAttribute('data-step', 'summary');
    expect(toast.error).toHaveBeenCalled();

    // «Correggi» opens the step that holds the field, and the field says what is wrong.
    const step = text('fiscalDocuments.issuer.steps.address.label');
    fireEvent.click(within(problems).getByRole('link', { name: text('fiscalDocuments.issuer.summary.problems.fixStep', { step }) }));
    await onStep('address');
    await waitFor(() => expect(screen.getByTestId('fiscal-issuer-postal-code')).toHaveAttribute('aria-invalid', 'true'), WAIT);
    await expectProblem('fiscalDocuments.issuer.errors.postalCode');

    // Editing the field settles the problem: it leaves the summary, and the server checks again at the next confirmation.
    type('fiscal-issuer-postal-code', '20122');
    await goTo('summary');
    await waitFor(() => expect(screen.queryByTestId('fiscal-issuer-problem-postalCode')).not.toBeInTheDocument(), WAIT);
    expect(screen.getByTestId('fiscal-issuer-problem-legalName')).toBeInTheDocument();
  });

  it('IssuerWizard_FieldInvalid_ShowsTheValueTheServerRefusedOnItsField', async () => {
    vi.mocked(saveIssuerSettings).mockRejectedValue(
      problem(422, { code: 'issuer_field_invalid', field: 'issuerPec', errors: [{ field: 'issuerPec', code: 'issuer_field_invalid' }] }),
    );
    await toTheSummaryOfACompleteSetting();

    fireEvent.click(finish());

    const problems = await screen.findByTestId('fiscal-issuer-problems', undefined, WAIT);
    expect(within(problems).getByTestId('fiscal-issuer-problem-issuerPec')).toHaveTextContent(text('fiscalDocuments.issuer.errors.issuerPec'));
    fireEvent.click(within(problems).getByRole('link'));
    await onStep('issuer');
    // The option that holds the problem is open: nobody has to look for it.
    await waitFor(() => expect(screen.getByTestId('fiscal-issuer-pec')).toHaveAttribute('aria-invalid', 'true'), WAIT);
    expect(screen.getByTestId('fiscal-issuer-more-options')).toHaveAttribute('open');
  });

  it('IssuerWizard_WholeOrganizationOnly_ACollaboratorWithSomePropertiesIsToldWhyItIsRefused', async () => {
    vi.mocked(saveIssuerSettings).mockRejectedValue(problem(403, { status: 403, code: 'fiscal_settings_need_whole_org' }));
    await toTheSummaryOfACompleteSetting();

    fireEvent.click(finish());

    const message = await screen.findByTestId('fiscal-issuer-finish-error', undefined, WAIT);
    expect(message).toHaveTextContent(text('apiErrors.codes.fiscalSettingsNeedWholeOrg'));
    expect(screen.queryByTestId('fiscal-issuer-problems')).not.toBeInTheDocument();
    expect(wizard()).toHaveAttribute('data-step', 'summary');
    expect(screen.queryByTestId('fiscal-issuer-done')).not.toBeInTheDocument();
  });

  it('IssuerWizard_RefusedWhileTheFlagWentOff_SaysSoAndStaysOnTheSummary', async () => {
    vi.mocked(saveIssuerSettings).mockRejectedValue(problem(422, { status: 422, code: 'document_issuance_not_available' }));
    await toTheSummaryOfACompleteSetting();

    fireEvent.click(finish());

    expect(await screen.findByTestId('fiscal-issuer-finish-error', undefined, WAIT)).toHaveTextContent(text('apiErrors.codes.documentIssuanceNotAvailable'));
    expect(toast.error).toHaveBeenCalledWith(text('apiErrors.codes.documentIssuanceNotAvailable'));
  });
});

describe('save and exit, help and the draft', () => {
  it('IssuerWizard_SaveAndExit_KeepsTheAnswersAsTheDraftChangesNothingAndLeaves', async () => {
    const first = renderWizard();
    await onStep('who');
    fireEvent.click(screen.getByTestId('fiscal-issuer-mode-Accountant'));

    fireEvent.click(screen.getByTestId('fiscal-issuer-save-exit'));

    expect(await screen.findByTestId('fiscal-page', undefined, WAIT)).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith(text('fiscalDocuments.issuer.exit.saved'));
    expect(saveIssuerSettings).not.toHaveBeenCalled();
    expect(readWizardDraft(ISSUER_WIZARD_ID, SCOPE, { version: ISSUER_DRAFT_VERSION })?.values.mode).toBe('Accountant');
    first.unmount();

    // Opened again, the wizard has the answer.
    renderWizard();
    await onStep('who');
    expect(screen.getByTestId('fiscal-issuer-mode-Accountant')).toBeChecked();
  });

  it('IssuerWizard_Draft_NeverKeepsTheVatNumberOrTheFiscalCode', async () => {
    const view = renderWizard();
    await onStep('who');
    fireEvent.click(screen.getByTestId('fiscal-issuer-mode-CasaZenDirectOnly'));
    await goTo('regime');
    fireEvent.click(screen.getByTestId('fiscal-issuer-vat-yes'));
    fireEvent.click(screen.getByTestId('fiscal-issuer-vat-regime-ordinary'));
    await goTo('issuer');
    type('fiscal-issuer-legal-name', 'Casa Rossi Srl');
    type('fiscal-issuer-vat-number', '12345678901');
    view.unmount();

    const draft = readWizardDraft(ISSUER_WIZARD_ID, SCOPE, { version: ISSUER_DRAFT_VERSION });
    expect(draft?.values.legalName).toBe('Casa Rossi Srl');
    expect(draft?.values).not.toHaveProperty('vatNumber');
    expect(draft?.values).not.toHaveProperty('fiscalCode');
    const stored = Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.getItem(sessionStorage.key(index) ?? '') ?? '').join(' ');
    expect(stored).toContain('Casa Rossi Srl');
    expect(stored).not.toContain('12345678901');
  });

  it('IssuerWizard_Draft_ACasazenAnswerOfTheDraftBringsItsStepsBack', async () => {
    const first = renderWizard();
    await onStep('who');
    fireEvent.click(screen.getByTestId('fiscal-issuer-mode-CasaZenDirectOnly'));
    await goTo('regime');
    fireEvent.click(screen.getByTestId('fiscal-issuer-vat-no'));
    first.unmount();

    // The server knows nothing of the choice: the list of the steps comes from the draft, not from the setting.
    renderWizard(`${ISSUER_PATH}?step=address`);
    await onStep('address');
    expect(screen.getByTestId('fiscal-issuer-address-step')).toBeInTheDocument();
  });

  it('IssuerWizard_Help_IsOnEveryStepAndSaysWhatTheStepIsFor', async () => {
    renderWizard();
    await onStep('who');

    fireEvent.click(screen.getByTestId('fiscal-issuer-help'));
    const dialog = await screen.findByTestId('fiscal-issuer-help-dialog', undefined, WAIT);
    expect(within(dialog).getByText(text('fiscalDocuments.issuer.help.who'))).toBeInTheDocument();
    expect(within(dialog).getByText(text('fiscalDocuments.issuer.help.supportGeneric'))).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('fiscal-issuer-help-dialog')).not.toBeInTheDocument(), WAIT);

    // Help and «Salva ed esci» are on the next step too, and the help is the one of that step.
    fireEvent.click(screen.getByTestId('fiscal-issuer-mode-Accountant'));
    await goTo('regime');
    expect(screen.getByTestId('fiscal-issuer-save-exit')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('fiscal-issuer-help'));
    expect(await screen.findByText(text('fiscalDocuments.issuer.help.regime'))).toBeInTheDocument();
    // Opening the help took the person nowhere.
    expect(screen.getByTestId('location')).toHaveTextContent(`${ISSUER_PATH}?step=regime`);
  });
});

describe('loading, the address opened again and accessibility', () => {
  it('IssuerWizard_LoadFailure_IsNeverAnEmptyFormAndCanBeRetried', async () => {
    vi.mocked(getIssuerSettings).mockRejectedValueOnce(problem(500, {})).mockResolvedValue(settings());
    renderWizard();

    const error = await screen.findByTestId('fiscal-issuer-error', undefined, WAIT);
    expect(screen.queryByTestId('fiscal-issuer-wizard')).not.toBeInTheDocument();
    expect(error).toHaveTextContent(text('fiscalDocuments.issuer.loadError'));

    fireEvent.click(within(error).getByRole('button', { name: text('shared.errorState.retry') }));
    await onStep('who');
  });

  it('IssuerWizard_DoneAddressOpenedAgain_ShowsWhatIsSavedOrSendsBackToTheFirstStep', async () => {
    vi.mocked(getIssuerSettings).mockResolvedValue(completedSetting({ mode: 'Accountant', regime: 'PrivatePerson' }));
    const view = renderWizard(`${ISSUER_PATH}?step=fatto`);

    expect(await screen.findByTestId('fiscal-issuer-done', undefined, WAIT)).toBeInTheDocument();
    expect(within(screen.getByTestId('fiscal-issuer-done')).getAllByText(text('fiscalDocuments.issuer.labels.mode.Accountant')).length).toBeGreaterThan(0);
    view.unmount();

    // A setting that the wizard never completed has nothing to confirm: the first step opens.
    vi.mocked(getIssuerSettings).mockResolvedValue(settings());
    renderWizard(`${ISSUER_PATH}?step=fatto`);
    await onStep('who');
    expect(screen.queryByTestId('fiscal-issuer-done')).not.toBeInTheDocument();
  });

  it('IssuerWizard_Done_SaysWhichDocumentTheRegimeGivesOnlyWhenTheServerHasTheRule', async () => {
    const rule = { invoiceTypeCode: 'TD01', creditNoteTypeCode: 'TD04', seriesPattern: '{year}' };
    vi.mocked(getIssuerSettings).mockResolvedValue(
      completedSetting({ regime: 'VatOrdinary', rule: { documentKind: 'Invoice', configured: true, ...rule } }),
    );
    const view = renderWizard(`${ISSUER_PATH}?step=fatto`);

    const done = await screen.findByTestId('fiscal-issuer-done', undefined, WAIT);
    expect(within(done).getByText(text('fiscalDocuments.issuer.done.rule.invoice'))).toBeInTheDocument();
    expect(within(done).queryByText(text('fiscalDocuments.issuer.effects.casazen.ruleUnconfirmed'))).not.toBeInTheDocument();
    view.unmount();

    // A rule the accountant has not confirmed: nothing is issued yet, and the screen does not pretend otherwise.
    vi.mocked(getIssuerSettings).mockResolvedValue(
      completedSetting({ regime: 'PrivatePerson', rule: { documentKind: 'None', configured: false, ...rule } }),
    );
    renderWizard(`${ISSUER_PATH}?step=fatto`);

    const unconfirmed = await screen.findByTestId('fiscal-issuer-done', undefined, WAIT);
    expect(within(unconfirmed).getByText(text('fiscalDocuments.issuer.effects.casazen.ruleUnconfirmed'))).toBeInTheDocument();
    expect(within(unconfirmed).queryByText(text('fiscalDocuments.issuer.done.rule.invoice'))).not.toBeInTheDocument();
    expect(within(unconfirmed).queryByText(text('fiscalDocuments.issuer.done.rule.receipt'))).not.toBeInTheDocument();
  });

  it('IssuerWizard_English_TheWizardAndTheConfirmationHaveTheirWords', async () => {
    await i18n.changeLanguage('en');
    vi.mocked(getIssuerSettings).mockResolvedValue(completedSetting());
    renderWizard();
    await onStep('who');

    expect(screen.getByRole('heading', { level: 2, name: 'Who issues the documents?' })).toBeInTheDocument();
    expect(screen.getByText('Your channel manager issues the documents')).toBeInTheDocument();
    expect(screen.getByTestId('fiscal-issuer-help')).toHaveTextContent('Help');
    expect(screen.getByTestId('fiscal-issuer-save-exit')).toHaveTextContent('Save and exit');
    await throughTo('summary', ['regime', 'issuer', 'address', 'summary']);
    expect(screen.getByText(i18n.t('fiscalDocuments.issuer.effects.sdi.notAvailable'))).toHaveTextContent(/you download the XML file yourself/);
  });

  it('IssuerWizard_Steps_HaveNoViolationThatAxeCanFindWithoutABrowser', async () => {
    vi.mocked(getIssuerSettings).mockResolvedValue(completedSetting({ octorateConnected: true, octorateIssuesAllBookings: true }));
    const view = renderWizard();
    await onStep('who');
    await expectNoAxeViolations(view.container);

    for (const step of ['regime', 'issuer', 'address', 'summary']) {
      await goTo(step);
      await expectNoAxeViolations(view.container);
    }
  });
});
