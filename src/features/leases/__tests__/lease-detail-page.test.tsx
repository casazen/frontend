import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { LeaseDetailPage } from '../lease-detail-page';
import { buildDetail, HTML_FALLBACK, httpError, renderAt } from './lease-test-utils';

// The real leasesApi runs; the panels with their own queries are covered by their own tests.
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../components/cedolare-decision-panel', () => ({ CedolareDecisionPanel: () => null }));
vi.mock('../components/rli-checklist', () => ({ RliChecklist: () => null }));
vi.mock('../components/registration-status-panel', () => ({ RegistrationStatusPanel: () => null }));
vi.mock('../components/canone-concordato-calculator', () => ({ CanoneConcordatoCalculator: () => null }));
vi.mock('../components/attestation-guidance-panel', () => ({ AttestationGuidancePanel: () => null }));
vi.mock('../components/imu-notification-export-button', () => ({ ImuNotificationExportButton: () => null }));
vi.mock('../components/delega-capture-dialog', () => ({ DelegaCaptureDialog: () => null }));
vi.mock('../components/lease-signing-panel', () => ({ LeaseSigningPanel: () => null }));

const get = vi.mocked(axios.get);
const post = vi.mocked(axios.post);

/** The address the server signs for the guided form (CF-FLOW): the tab of the browser goes to it. */
const FORM_URL = 'https://form.example.test/?leaseId=lease-1&signature=abc123';

/** The sync of the lease with its practice (CF-DONE): asked by itself when the sheet of a lease of the guided service opens. */
const SYNC_URL = '/leases/lease-1/concordatofacile/sync';
/** What the server answers to it while the lease waits for its contract. */
const WAITING = { state: 'WaitingForContract', leaseStatus: 'Draft' };

/** Every call of `post` that is not the sync: the ones the gestures of the person make. */
const gestures = () => post.mock.calls.filter(([url]) => url !== SYNC_URL);

/** `post`: the sync answers as `syncAnswer` says (the lease waits for its contract), any other call as `gesture` says (nothing by default). */
function mockPost(
  gesture: (url: string) => Promise<unknown> = () => Promise.resolve(undefined),
  syncAnswer: () => Promise<unknown> = () => Promise.resolve({ data: WAITING }),
) {
  post.mockImplementation((url: string) => (url === SYNC_URL ? syncAnswer() : gesture(url)));
}

function mockLease(response: () => Promise<unknown>) {
  get.mockImplementation((url: string) =>
    url === '/leases/lease-1' ? response() : Promise.reject(httpError(404)),
  );
}

// The data of the lease are in the tab `dati`; the sheet opens on the guide (LR-GUIDE-1), whose tools and advice have their own tests.
function renderPage(search = '') {
  return renderAt(`/app/long-rent/leases/lease-1${search}`, '/app/long-rent/leases/:id', createElement(LeaseDetailPage));
}

// The same page with the backend flags a person would have (all off without a provider, as in the tests above), and the page of
// payment as a second route: the main button of the sheet leads there when the access is missing.
function renderPageWithFlags(search: string, flags: Partial<FeatureFlags>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const value = { flags: { ...DEFAULT_FEATURE_FLAGS, ...flags }, isLoading: false };
  return render(
    <QueryClientProvider client={client}>
      <FeatureFlagsContext.Provider value={value}>
        <MemoryRouter initialEntries={[`/app/long-rent/leases/lease-1${search}`]}>
          <Routes>
            <Route path="/app/long-rent/leases/:id" element={<LeaseDetailPage />} />
            <Route path="/app/long-rent/leases/:id/guided-contract" element={<div data-testid="payment-page-stub" />} />
          </Routes>
        </MemoryRouter>
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );
}

/** What the server says about the access to the guided form: none, with the privacy notice accepted, unless `overrides` say otherwise. */
const accessOf = (overrides: object = {}) => ({ hasAccess: false, source: null, giftAvailable: false, giftConsumed: false, privacyAccepted: true, ...overrides });
const ACTIVE = { hasAccess: true, source: 'payment' };
/** The form was opened before (the link was made on this day). */
const OPENED = { linkOpenedAt: '2026-10-24T09:00:00Z' };
/** The status of the practices of a lease with none yet (a date in the past: nothing asks again). */
const NO_PRACTICES = { practices: [], lastCheckedAt: '2020-01-01T00:00:00Z', nextUpdateAt: '2020-01-01T00:15:00Z', stale: false, available: true };
const PRACTICE = { practiceId: 'P-0123456789abcdef', status: 'InProgress', statusChangedAt: '2026-10-24T12:00:00Z', comuneDiffersFromLink: false };

/**
 * A lease with the access to the guided form as `access()` says now (none, by default) and the status of its practices as `status()`
 * answers (none yet, by default); the service answers 404 to anything else, the reading of the contract that was uploaded included
 * unless `reading` says what it is.
 */
function mockLeaseWithService(
  detail: Parameters<typeof buildDetail>[0],
  {
    access = () => accessOf(),
    status = () => Promise.resolve({ data: NO_PRACTICES }),
    reading,
  }: { access?: () => object; status?: () => Promise<unknown>; reading?: object } = {},
) {
  get.mockImplementation((url: string) => {
    if (url === '/leases/lease-1') return Promise.resolve({ data: buildDetail(detail) });
    if (url === '/leases/lease-1/concordatofacile/access') return Promise.resolve({ data: access() });
    if (url === '/leases/lease-1/concordatofacile/status') return status();
    if (url === '/leases/lease-1/draft/reading' && reading) return Promise.resolve({ data: reading });
    return Promise.reject(httpError(404));
  });
}

/** The status of a practice that is over: the service says it is registered. */
const CONCLUDED_PRACTICE = () => Promise.resolve({ data: { ...NO_PRACTICES, practices: [{ ...PRACTICE, status: 'Registered' }] } });

/** The contract file that was uploaded was read and filled in a field: what the server says of it (names and fates, never a value). */
const READ_CONTRACT = {
  state: 'Done',
  documents: [{ id: 'doc-1', fileName: 'contratto.pdf', status: 'Completed', error: null }],
  fields: [{ field: 'rent', partyId: null, role: null, state: 'Read', confidence: 90, derived: false }],
  stipulaDate: null,
  contractDocumentId: 'doc-1',
};

/** A draft the server marked as the service's after reading its documents: it has dates and a rent now, and no longer looks like a draft with only its property. */
const readDraft = (): Parameters<typeof buildDetail>[0] => ({
  ...partnerDraft(),
  origin: 'Imported',
  isConcordatoFacileSource: true,
  startDate: '2026-11-01T00:00:00Z',
  endDate: '2029-10-31T00:00:00Z',
  monthlyRent: 595,
});

/** The main button of the block of the draft, once the server has said what it needs to (a button that is working is not pressed yet). */
async function mainButton() {
  const button = await screen.findByTestId('lease-partner-proceed');
  await waitFor(() => expect(button).not.toHaveAttribute('aria-busy'));
  return button;
}

/** A draft saved with only its property for ConcordatoFacile: the API keeps 1 January 3000 and a rent of 0 until they are typed. */
const partnerDraft = (): Parameters<typeof buildDetail>[0] => ({
  contractType: 'Concordato',
  startDate: '3000-01-01T00:00:00Z',
  endDate: '3000-01-01T00:00:00Z',
  monthlyRent: 0,
  registrationDeadline: null,
  parties: [],
  events: [{ eventType: 'Created', occurredAt: '2026-10-23T10:00:00Z' }],
});

describe('LeaseDetailPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockPost();
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('render_Lease_ShowsMaskedPartiesTranslatedRolesAndTimeline', async () => {
    mockLease(() => Promise.resolve({ data: buildDetail() }));

    renderPage('?tab=dati');

    const parties = await screen.findAllByTestId('lease-party');
    expect(parties).toHaveLength(2);
    const landlord = parties[0];
    expect(within(landlord).getByText('Mario Rossi')).toBeInTheDocument();
    expect(within(landlord).getByText('Locatore')).toBeInTheDocument();
    expect(within(landlord).getByText(/\*{12}501Z/)).toBeInTheDocument();
    expect(within(landlord).getByText('m***@example.com')).toBeInTheDocument();
    expect(within(parties[1]).getByText('Conduttore')).toBeInTheDocument();
    // The title is the tenant, the line under it says what the lease is about.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Giulia Verdi');
    expect(screen.getByText(/Casa Trastevere · Roma · .* · 950,00\s€\/mese/)).toBeInTheDocument();
    // History with translated event types, never the raw enum value (A7-26), the latest first, with who did it.
    const events = within(screen.getByTestId('lease-timeline')).getAllByRole('listitem');
    expect(within(events[0]).getByText('Delega RLI registrata')).toBeInTheDocument();
    expect(within(events[1]).getByText('Bozza creata')).toBeInTheDocument();
    expect(within(events[1]).getByText('Tu')).toBeInTheDocument();
    expect(screen.queryByText('RegistrationAuthorized')).not.toBeInTheDocument();
    expect(screen.getByText('Bozza')).toBeInTheDocument();
    expect(screen.queryByTestId('lease-load-error')).not.toBeInTheDocument();
  });

  it('render_EnglishUi_TranslatesRoleEventAndStatus', async () => {
    await i18n.changeLanguage('en');
    mockLease(() => Promise.resolve({ data: buildDetail({ status: 'Rejected' }) }));

    renderPage('?tab=dati');

    expect(await screen.findByText('Landlord')).toBeInTheDocument();
    expect(screen.getByText('Draft created')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  /** A canone concordato lease whose range the server computed at its creation: indicative with Partial data, the rent outside it. */
  const concordatoOutOfRange = () =>
    buildDetail({
      fiscalRegime: 'CanoneConcordato',
      contractType: 'Concordato',
      taxRegime: 'Ordinario',
      monthlyRent: 900,
      securityDeposit: 2700,
      concordatoAssessment: {
        sqm: 65,
        garageSqm: 0,
        balconySqm: 0,
        otherAppurtenanceSqm: 0,
        privateGreenSqm: 0,
        typeAElementCount: 2,
        typeBElementCount: 3,
        typeCElementCount: 0,
        typeDElementCount: 0,
        qualifyingTypeDElementCount: 0,
        stoveHeating: false,
        isFurnished: false,
        airConditioning: false,
        zoneName: null,
        cadastralSheet: null,
        contractYears: 3,
        usableSqm: 65,
        zone: 'Unica',
        subFascia: 2,
        canoneMinAnnuo: 1300,
        canoneMaxAnnuo: 5525,
        canoneMinMensile: 108.34,
        canoneMaxMensile: 460.41,
        dataCompleteness: 'Partial',
        indicative: true,
        rentWithinRange: false,
        calculatedAt: '2026-09-24T10:00:00Z',
      },
    });

  it('render_ConcordatoLeaseWithIndicativeRange_TheGuideAnswersInOneSentenceAndTheWindowShowsTheServerRangeWithWarning', async () => {
    // LT-10 (A7-12, A7-23): the range the API computed at creation, indicative with Partial data, rent outside it.
    mockLease(() => Promise.resolve({ data: concordatoOutOfRange() }));

    renderPage('?tab=guida');

    // The tool says its answer without being opened (LR-GUIDE-1): the rent is above the limit of the agreement.
    expect(await screen.findByTestId('guide-tool-rent-summary')).toHaveTextContent(/supera il limite dell'accordo/);
    expect(screen.getByTestId('guide-tool-rent-summary')).toHaveTextContent(/460,41/);
    fireEvent.click(screen.getByTestId('guide-tool-rent-open'));

    const panel = await screen.findByTestId('concordato-assessment');
    expect(within(panel).getByTestId('concordato-assessment-indicative')).toHaveTextContent(
      i18n.t('leases.concordatoAssessment.indicative'),
    );
    expect(within(panel).getByTestId('concordato-assessment-outside')).toBeInTheDocument();
    expect(within(panel).getByText(/460,41/)).toBeInTheDocument();
  });

  it('render_ConcordatoLease_TheDataTabHasTheDataOfTheContractAndNothingFiscal', async () => {
    mockLease(() => Promise.resolve({ data: concordatoOutOfRange() }));

    renderPage('?tab=dati');

    expect(await screen.findByTestId('lease-type-regime')).toHaveTextContent('Canone concordato (3+2) · Regime ordinario');
    expect(screen.getByText(/2\.?700,00/)).toBeInTheDocument();
    // The comparison of the regimes, the range of the agreement, the guidance and the IMU communication are tools of the guide now.
    expect(screen.queryByTestId('concordato-assessment')).not.toBeInTheDocument();
    expect(screen.queryByTestId('advisory-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('guide-tool-dialog')).not.toBeInTheDocument();
  });

  it('render_LiberoLease_TheGuideOffersTheRegimeToolAndNotTheRangeOfTheAgreement', async () => {
    // A7-24: the range of the agreement is for a canone concordato contract only.
    mockLease(() => Promise.resolve({ data: buildDetail() })); // contractType: 'Libero' by default

    renderPage('?tab=guida');

    expect(await screen.findByTestId('guide-tool-regime')).toBeInTheDocument();
    expect(screen.queryByTestId('guide-tool-rent')).not.toBeInTheDocument();
  });

  it('render_TheSheetOpensOnTheGuide_AndTheOldNamesOfTheTabsStillLead', async () => {
    mockLease(() => Promise.resolve({ data: buildDetail({ status: 'Registered' }) }));

    const { unmount } = renderPage();
    expect(await screen.findByTestId('lease-guide')).toBeInTheDocument();
    expect(screen.getByTestId('lease-tab-guida')).toHaveAttribute('aria-selected', 'true');
    unmount();

    // An address of the old page (`?tab=cronologia`) leads to the tab that holds what it showed.
    const { unmount: unmountOld } = renderPage('?tab=cronologia');
    expect(await screen.findAllByTestId('lease-party')).toHaveLength(2);
    unmountOld();

    // The jobs asked of the suppliers had a tab here: it was taken away, an address that still names it opens the guide.
    renderPage('?tab=interventi');
    expect(await screen.findByTestId('lease-guide')).toBeInTheDocument();
    expect(screen.getByTestId('lease-tab-guida')).toHaveAttribute('aria-selected', 'true');
  });

  it('render_TheSheet_HasSixTabsAndNoTabOfTheJobs_NorAWayToAskForOneInItsMenu', async () => {
    mockLease(() => Promise.resolve({ data: buildDetail({ status: 'Registered' }) }));

    renderPage('?tab=dati');

    await screen.findAllByTestId('lease-party');
    const tabs = within(screen.getByRole('tablist')).getAllByRole('tab');
    expect(tabs.map((tab) => tab.getAttribute('data-testid'))).toEqual([
      'lease-tab-guida',
      'lease-tab-inquilini',
      'lease-tab-dati',
      'lease-tab-documenti',
      'lease-tab-pagamenti',
      'lease-tab-scadenze',
    ]);
    expect(screen.queryByTestId('lease-tab-interventi')).not.toBeInTheDocument();
    expect(screen.queryByTestId('lease-requests')).not.toBeInTheDocument();
    // The menu «⋯» offers the ways to somewhere else; «Richiedi intervento» is not one of them any more.
    fireEvent.keyDown(screen.getByTestId('page-header-more'), { key: 'Enter' });
    expect(await screen.findByTestId('lease-menu-documents')).toBeInTheDocument();
    expect(screen.queryByTestId('lease-menu-request-job')).not.toBeInTheDocument();
  });

  it('shows only this contract tenants in its tenant tab', async () => {
    mockLease(() => Promise.resolve({ data: buildDetail({ status: 'Registered' }) }));
    renderPage('?tab=inquilini');
    const tenants = await screen.findByTestId('lease-tenants');
    expect(within(tenants).getAllByTestId('lease-party')).toHaveLength(1);
    expect(tenants).toHaveTextContent('Giulia Verdi');
    expect(tenants).not.toHaveTextContent('Mario Rossi');
    expect(tenants).toHaveTextContent('g***@example.com');
    expect(screen.getByTestId('lease-tab-inquilini')).toHaveAttribute('aria-selected', 'true');
  });

  it('render_ConcordatoDraftForThePartner_WaitsForItsContractWithoutDatesOrRentOfTheDraft', async () => {
    // A draft saved with only its property for ConcordatoFacile: the API keeps 1 January 3000 and a rent of 0 until they are typed.
    mockLease(() =>
      Promise.resolve({
        data: buildDetail({
          contractType: 'Concordato',
          startDate: '3000-01-01T00:00:00Z',
          endDate: '3000-01-01T00:00:00Z',
          monthlyRent: 0,
          registrationDeadline: null,
          parties: [],
          events: [{ eventType: 'Created', occurredAt: '2026-10-23T10:00:00Z' }],
        }),
      }),
    );

    renderPage('?tab=dati');

    const notice = await screen.findByTestId('lease-partner-draft');
    expect(notice).toHaveTextContent(i18n.t('leases.partnerDraft.title'));
    // The service is off (the flags default): the guided form is not available yet, so the button waits and the way to the documents stays.
    expect(screen.getByTestId('lease-partner-proceed')).toBeDisabled();
    expect(within(notice).getByText(i18n.t('leases.partnerDraft.soon'))).toBeInTheDocument();
    expect(screen.getByTestId('lease-partner-upload')).toHaveAttribute('href', '/app/long-rent/documents/upload?leaseId=lease-1');
    // CF-FLOW: nothing to give anyone, and no name of the supplier (nor «partner») in the block.
    expect(screen.queryByDisplayValue('lease-1')).not.toBeInTheDocument();
    expect(notice.textContent).not.toMatch(/partner|concordato\s*facile/i);
    expect(screen.getByText(/Casa Trastevere · Roma · .* · Canone da definire/)).toBeInTheDocument();
    expect(screen.queryByText(/3000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/0,00\s€/)).not.toBeInTheDocument();
  });

  // CF-FIX: the switch of the service. CF-FLOW: the sheet of the draft is the centre — the privacy notice, the way to the payment or
  // straight into the form, and once the form is sent the status of the practice.
  it('render_ConcordatoDraftForThePartner_NoAccess_TheBoxOfThePrivacyGatesTheButton_ThenItAcceptsAndGoesToThePayment', async () => {
    mockLeaseWithService(partnerDraft(), { access: () => accessOf({ privacyAccepted: false }) });
    mockPost(() => Promise.resolve({ data: accessOf({ privacyAccepted: true }) }));

    renderPageWithFlags('?tab=dati', { concordatoFacile: true });

    const privacy = await screen.findByTestId('lease-partner-privacy');
    expect(within(privacy).getByRole('link', { name: i18n.t('guidedContract.privacyRead') })).toHaveAttribute('href', '/legale/privacy');
    const proceed = screen.getByTestId('lease-partner-proceed');
    expect(proceed).toHaveTextContent(i18n.t('leases.partnerDraft.proceed'));
    expect(proceed).toBeDisabled();
    expect(screen.getByText(i18n.t('leases.partnerDraft.ready'))).toBeInTheDocument();
    // Nothing for the person to communicate, and the status is not read where there is no access.
    expect(screen.queryByDisplayValue('lease-1')).not.toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => String(url).endsWith('/concordatofacile/status'))).toBe(false);

    fireEvent.click(within(privacy).getByRole('checkbox'));
    expect(proceed).toBeEnabled();
    fireEvent.click(proceed);

    // The acceptance is recorded, then the person goes to the page of payment: no link of the form is made without the access.
    expect(await screen.findByTestId('payment-page-stub')).toBeInTheDocument();
    expect(gestures()).toHaveLength(1);
    expect(gestures()[0][0]).toBe('/leases/lease-1/concordatofacile/privacy-acceptance');
  });

  it('render_ConcordatoDraftForThePartner_AccessActive_TheMainButtonOpensTheFormInThisTabFromTheClick', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    mockPost(() => Promise.resolve({ data: { url: FORM_URL } }));
    mockLeaseWithService(partnerDraft(), { access: () => accessOf(ACTIVE) });

    renderPageWithFlags('?tab=dati', { concordatoFacile: true });

    const proceed = await mainButton();
    // The privacy notice was accepted: no box. The form was never opened: the status is not read.
    expect(screen.queryByTestId('lease-partner-privacy')).not.toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => String(url).endsWith('/concordatofacile/status'))).toBe(false);
    expect(screen.getByTestId('lease-partner-upload')).toHaveAttribute('href', '/app/long-rent/documents/upload?leaseId=lease-1');

    fireEvent.click(proceed);

    // One call for the link, then this tab (not a new window, no page in between) goes to the address the server signed.
    await waitFor(() => expect(assign).toHaveBeenCalledWith(FORM_URL));
    expect(gestures()).toHaveLength(1);
    expect(gestures()[0][0]).toBe('/leases/lease-1/concordatofacile/link');
    expect(open).not.toHaveBeenCalled();
    expect(screen.queryByTestId('payment-page-stub')).not.toBeInTheDocument();
    open.mockRestore();
  });

  it('render_ConcordatoDraftForThePartner_FormSentAndPracticeUnderWay_ShowsOnlyItsStatusAndTheWayToTheDocuments', async () => {
    mockLeaseWithService(partnerDraft(), {
      access: () => accessOf({ ...ACTIVE, ...OPENED }),
      status: () => Promise.resolve({ data: { ...NO_PRACTICES, practices: [{ ...PRACTICE, comuneDiffersFromLink: true }] } }),
    });

    renderPageWithFlags('?tab=dati', { concordatoFacile: true });

    const status = await screen.findByTestId('lease-partner-status');
    expect(within(status).getByTestId('cf-status-badge')).toHaveAttribute('data-status', 'InProgress');
    expect(status).toHaveTextContent(/Aggiornato il 24\/10\/2026/);
    // The number of the practice, discreet, for whoever has to find it (CF-END).
    expect(screen.getByTestId('lease-partner-practice')).toHaveTextContent('Pratica P-0123456789abcdef');
    expect(screen.getByText(i18n.t('guidedContract.sent'))).toBeInTheDocument();
    // The municipality the person chose in the form is not the one of the house: said, as the status always did.
    expect(screen.getByTestId('lease-partner-comune')).toHaveTextContent(i18n.t('guidedContract.comuneDiffers'));
    // A second visit to the form after the sending would make a second practice: nothing in the block opens it.
    expect(screen.queryByTestId('lease-partner-proceed')).not.toBeInTheDocument();
    expect(screen.queryByTestId('lease-partner-privacy')).not.toBeInTheDocument();
    expect(screen.getByTestId('lease-partner-upload')).toBeInTheDocument();
    expect(gestures()).toHaveLength(0);
    // The practice is with the supplier, not waiting for the person: nothing sends them to their mailbox.
    expect(screen.queryByTestId('lease-partner-hint')).not.toBeInTheDocument();
  });

  // The two statuses in which the practice waits for the person (a request e-mailed to them, or stopped for want of an answer) say so:
  // the sheet was the only place where they would look and it told them nothing to do. The words are the product's, not the supplier's.
  it.each(['AwaitingUser', 'Suspended'] as const)('render_ConcordatoDraftForThePartner_Practice%s_WaitsForThePerson_SaysToLookInTheMailbox', async (practiceStatus) => {
    mockLeaseWithService(partnerDraft(), {
      access: () => accessOf({ ...ACTIVE, ...OPENED }),
      status: () => Promise.resolve({ data: { ...NO_PRACTICES, practices: [{ ...PRACTICE, status: practiceStatus }] } }),
    });

    renderPageWithFlags('?tab=dati', { concordatoFacile: true });

    const hint = await screen.findByTestId('lease-partner-hint');
    expect(hint).toHaveTextContent(i18n.t(`guidedContract.hint.${practiceStatus}`));
    expect(hint).toHaveTextContent(/e-mail/);
    expect(hint).toHaveTextContent(/spam/);
    expect(within(screen.getByTestId('lease-partner-status')).getByTestId('cf-status-badge')).toHaveAttribute('data-status', practiceStatus);
    expect(screen.queryByTestId('lease-partner-proceed')).not.toBeInTheDocument();
    expect(screen.getByTestId('lease-partner-draft').textContent).not.toMatch(/partner|concordato\s*facile/i);
  });

  it.each(['Received', 'DraftSent', 'SignedReceived', 'SentToAssociation', 'Attested', 'Registered'] as const)(
    'render_ConcordatoDraftForThePartner_Practice%s_IsWithTheSupplier_NoHintToLookInTheMailbox',
    async (practiceStatus) => {
      mockLeaseWithService(partnerDraft(), {
        access: () => accessOf({ ...ACTIVE, ...OPENED }),
        status: () => Promise.resolve({ data: { ...NO_PRACTICES, practices: [{ ...PRACTICE, status: practiceStatus }] } }),
      });

      renderPageWithFlags('?tab=dati', { concordatoFacile: true });

      const status = await screen.findByTestId('lease-partner-status');
      expect(within(status).getByTestId('cf-status-badge')).toHaveAttribute('data-status', practiceStatus);
      expect(screen.queryByTestId('lease-partner-hint')).not.toBeInTheDocument();
    },
  );

  // A new form after the closing makes a new practice: the button says so instead of «resume».
  it('render_ConcordatoDraftForThePartner_PracticeClosed_TheFormCanBeFilledInAgain', async () => {
    mockLeaseWithService(partnerDraft(), {
      access: () => accessOf({ ...ACTIVE, ...OPENED }),
      status: () => Promise.resolve({ data: { ...NO_PRACTICES, practices: [{ ...PRACTICE, status: 'ClosedWithoutAttestation', closeReason: 'withdrawn' }] } }),
    });

    renderPageWithFlags('?tab=dati', { concordatoFacile: true });

    const proceed = await mainButton();
    expect(proceed).toHaveTextContent(i18n.t('guidedContract.fillAgain'));
    expect(proceed).not.toHaveTextContent(i18n.t('guidedContract.resume'));
    expect(screen.queryByTestId('lease-partner-status')).not.toBeInTheDocument();
    // CF-END: what became of the practice is said, with its number, before the button that starts again.
    const closed = screen.getByTestId('lease-partner-closed');
    expect(closed).toHaveTextContent('Pratica P-0123456789abcdef');
    expect(closed).toHaveTextContent('La pratica è stata ritirata.');
  });

  it.each([
    ['duplicate', "Era un doppione di un'altra pratica."],
    ['not_compliant', 'Il contratto non è attestabile (per esempio con il canone fuori fascia): correggi i dati e ricomincia.'],
    ['other', 'Chiusa senza attestazione.'],
    [undefined, 'Chiusa senza attestazione.'],
  ])('render_ConcordatoDraftForThePartner_PracticeClosedFor_%s_SaysWhyInPlainWords', async (closeReason, sentence) => {
    mockLeaseWithService(partnerDraft(), {
      access: () => accessOf({ ...ACTIVE, ...OPENED }),
      status: () => Promise.resolve({ data: { ...NO_PRACTICES, practices: [{ ...PRACTICE, status: 'ClosedWithoutAttestation', closeReason }] } }),
    });

    renderPageWithFlags('?tab=dati', { concordatoFacile: true });

    await mainButton();
    const closed = screen.getByTestId('lease-partner-closed');
    expect(closed).toHaveTextContent(sentence);
    expect(closed).toHaveTextContent('Pratica P-0123456789abcdef');
    // No name of the supplier, no «partner»: the words are the product's.
    expect(screen.getByTestId('lease-partner-draft').textContent).not.toMatch(/partner|concordato\s*facile/i);
  });

  it('render_ConcordatoDraftForThePartner_StatusNotAvailable_SaysNotToReopenIfSent_NotAnError_AndTheFormCanBeResumed', async () => {
    mockLeaseWithService(partnerDraft(), {
      access: () => accessOf({ ...ACTIVE, ...OPENED }),
      status: () => Promise.resolve({ data: { practices: [], lastCheckedAt: null, nextUpdateAt: '2020-01-01T00:15:00Z', stale: false, available: false } }),
    });

    renderPageWithFlags('?tab=dati', { concordatoFacile: true });

    const quiet = await screen.findByTestId('lease-partner-status-unavailable');
    expect(quiet).toHaveTextContent(i18n.t('concordatofacile.entry.statusFailed'));
    const notice = screen.getByTestId('lease-partner-draft');
    expect(within(notice).queryByRole('alert')).not.toBeInTheDocument();
    expect(notice.textContent).not.toMatch(/partner|concordato\s*facile/i);
    const proceed = await mainButton();
    expect(proceed).toHaveTextContent(i18n.t('guidedContract.resume'));
    expect(proceed).toBeEnabled();
  });

  it('render_ConcordatoDraftForThePartner_LinkRefusedForThePrivacyNotice_AsksForTheBoxAndShowsNoError', async () => {
    let accepted = true;
    mockLeaseWithService(partnerDraft(), { access: () => accessOf({ ...ACTIVE, privacyAccepted: accepted }) });
    mockPost(() => {
      accepted = false; // the server does not have the notice: the access, read again, says so
      return Promise.reject(httpError(409, { code: 'concordatofacile_privacy_not_accepted' }));
    });

    renderPageWithFlags('?tab=dati', { concordatoFacile: true });
    fireEvent.click(await mainButton());

    expect(await screen.findByTestId('lease-partner-privacy')).toBeInTheDocument();
    expect(screen.queryByTestId('lease-partner-open-error')).not.toBeInTheDocument();
  });

  // CF-DONE: the lease of the guided service follows its practice. The sheet shows the state of the practice and never asks for the data of
  // the contract, which are read from the documents; the server moves the lease on (reads the documents into it, imports the contract as
  // signed, declares the registration) and the sheet reads the lease again when it did.
  it('render_ServiceDraft_PracticeConcluded_AsksTheServerToMoveItOnOnce_SaysToUploadTheDocumentsAndNeverToFillInData', async () => {
    mockLeaseWithService(partnerDraft(), { access: () => accessOf({ ...ACTIVE, ...OPENED }), status: CONCLUDED_PRACTICE });

    renderPageWithFlags('?tab=dati', { concordatoFacile: true });

    expect(await screen.findByTestId('lease-partner-sentence')).toHaveTextContent(i18n.t('guidedContract.concluded'));
    expect(within(screen.getByTestId('lease-partner-status')).getByTestId('cf-status-badge')).toHaveAttribute('data-status', 'Registered');
    await waitFor(() => expect(post.mock.calls.filter(([url]) => url === SYNC_URL)).toHaveLength(1));
    // No way into the wizard of the draft, and no gesture of the person: only the sync, asked by the sheet itself.
    expect(screen.queryByTestId('lease-continue-draft')).not.toBeInTheDocument();
    expect(gestures()).toHaveLength(0);
    expect(screen.getByTestId('lease-partner-upload')).toBeInTheDocument();
  });

  it('render_ServiceDraft_StatusExplainer_SaysTheServicePreparesTheContract_WithoutTheChecklistOfTheDataToFillIn', async () => {
    mockLeaseWithService(partnerDraft());

    renderPageWithFlags('?tab=dati', { concordatoFacile: true });
    fireEvent.click(await screen.findByTestId('lease-status-toggle'));

    const explainer = await screen.findByTestId('lease-status-explainer');
    expect(explainer).toHaveTextContent(i18n.t('leaseSheet.status.serviceDraft'));
    expect(within(explainer).queryAllByRole('listitem')).toHaveLength(0);
    for (const item of i18n.t('status.lease.Draft.need', { returnObjects: true }) as unknown as string[]) {
      expect(explainer).not.toHaveTextContent(item);
    }
    expect(explainer.textContent).not.toMatch(/partner|concordato\s*facile/i);
  });

  it('render_Draft_NotTheServices_StatusExplainerKeepsItsChecklist', async () => {
    mockLease(() => Promise.resolve({ data: buildDetail() }));

    renderPage('?tab=dati');
    fireEvent.click(await screen.findByTestId('lease-status-toggle'));

    const explainer = await screen.findByTestId('lease-status-explainer');
    expect(within(explainer).getAllByRole('listitem').length).toBeGreaterThan(0);
    expect(explainer).not.toHaveTextContent(i18n.t('leaseSheet.status.serviceDraft'));
  });

  it('render_ServiceDraftWithItsDataRead_ShowsTheCardOfThePractice_NotTheWayIntoTheWizard', async () => {
    // The server read the documents into the draft: it has dates and a rent and no longer looks like a draft with only its property.
    mockLeaseWithService(readDraft(), {
      access: () => accessOf({ ...ACTIVE, ...OPENED }),
      status: CONCLUDED_PRACTICE,
      reading: { state: 'None', documents: [], fields: [], stipulaDate: null, contractDocumentId: null },
    });

    renderPageWithFlags('?tab=dati', { concordatoFacile: true });

    expect(await screen.findByTestId('lease-partner-status')).toBeInTheDocument();
    expect(screen.getByTestId('lease-partner-draft')).toBeInTheDocument();
    expect(screen.queryByTestId('lease-continue-draft')).not.toBeInTheDocument();
    // The step «Completa la bozza» is not laid over it either: the card is its one voice.
    expect(screen.queryByTestId('lease-now')).not.toBeInTheDocument();
  });

  it.each([
    ['WaitingForSignature', 'cfDocuments.import.waitingForSignature', 'outline'],
    ['ContractNeedsData', 'cfDocuments.import.needsData', 'default'],
  ] as const)('render_ServiceDraftWithItsContractRead_Sync%s_TheOneCardShowsThePracticeAndWhatItWaitsFor', async (state, key) => {
    mockLeaseWithService(readDraft(), { access: () => accessOf({ ...ACTIVE, ...OPENED }), status: CONCLUDED_PRACTICE, reading: READ_CONTRACT });
    mockPost(undefined, () => Promise.resolve({ data: { state, leaseStatus: 'Draft' } }));

    renderPageWithFlags('?tab=dati', { concordatoFacile: true });

    const panel = await screen.findByTestId('cf-import-panel');
    // The practice stays in view when the contract arrives; one highlighted block, never two.
    expect(await within(panel).findByTestId('lease-partner-status')).toBeInTheDocument();
    expect(within(panel).getByTestId('lease-partner-practice')).toHaveTextContent('Pratica P-0123456789abcdef');
    await waitFor(() => expect(within(panel).getByTestId('cf-import-description')).toHaveTextContent(i18n.t(key)));
    expect(screen.queryByTestId('lease-partner-draft')).not.toBeInTheDocument();
    expect(panel.textContent).not.toMatch(/partner|concordato\s*facile/i);
    // Waiting for the practice, the button is only the way to do it by hand (quiet) and there is nothing to check yet; with data missing the
    // button is the thing to do (main) and the invitation to check what was read and complete the rest stays.
    expect(within(panel).getByTestId('cf-import-open')).toHaveClass(state === 'WaitingForSignature' ? 'border-input' : 'bg-primary');
    expect(within(panel).queryByTestId('lease-reading-done') !== null).toBe(state === 'ContractNeedsData');
  });

  it('render_ServiceDraft_TheServerMovesItOn_TheSheetReadsTheLeaseAgain_TheDraftBecomesTheRegisteredContractAndItsCardIsGone', async () => {
    let registered = false;
    get.mockImplementation((url: string) => {
      if (url === '/leases/lease-1') {
        return Promise.resolve({ data: buildDetail(registered ? { ...readDraft(), status: 'Registered' } : partnerDraft()) });
      }
      if (url === '/leases/lease-1/concordatofacile/access') return Promise.resolve({ data: accessOf({ ...ACTIVE, ...OPENED }) });
      if (url === '/leases/lease-1/concordatofacile/status') return CONCLUDED_PRACTICE();
      return Promise.reject(httpError(404));
    });
    mockPost(undefined, () => {
      registered = true; // the server read the documents, imported the contract and declared the registration
      return Promise.resolve({ data: { state: 'Completed', leaseStatus: 'Registered' } });
    });

    renderPageWithFlags('?tab=dati', { concordatoFacile: true });

    await waitFor(() => expect(screen.getByTestId('lease-status-toggle')).toHaveTextContent('Registrato'));
    expect(screen.queryByTestId('lease-partner-draft')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cf-import-panel')).not.toBeInTheDocument();
    // Registered, the sheet follows nothing any more: the sync is not asked again.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(post.mock.calls.filter(([url]) => url === SYNC_URL)).toHaveLength(1);
  });

  it('render_ServiceDraft_ServerRefusesTheSync_TheSheetIsTheSheetItWas', async () => {
    mockLeaseWithService(partnerDraft(), { access: () => accessOf({ ...ACTIVE, ...OPENED }), status: CONCLUDED_PRACTICE });
    mockPost(undefined, () => Promise.reject(httpError(403)));

    renderPageWithFlags('?tab=dati', { concordatoFacile: true });

    expect(await screen.findByTestId('lease-partner-sentence')).toHaveTextContent(i18n.t('guidedContract.concluded'));
    await waitFor(() => expect(post.mock.calls.filter(([url]) => url === SYNC_URL)).toHaveLength(1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('lease-load-error')).not.toBeInTheDocument();
  });

  it('render_ConcordatoLease_ServiceOff_ShowsNoPaymentPanelAndAsksNothingOfTheService', async () => {
    mockLeaseWithService({ contractType: 'Concordato' });

    renderPage('?tab=dati');

    await screen.findAllByTestId('lease-party');
    expect(screen.queryByTestId('cf-entry-panel')).not.toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => String(url).includes('/concordatofacile/'))).toBe(false);
  });

  it('render_ConcordatoLeaseNotMadeForThePartner_ServiceOn_OffersNoWayIntoTheService', async () => {
    // CF-DOC-FU4: a canone concordato that is not the draft made for the partner (made in CasaZen, imported, signed) has no entrance to it.
    mockLeaseWithService({ contractType: 'Concordato' });

    renderPageWithFlags('?tab=dati', { concordatoFacile: true });

    await screen.findAllByTestId('lease-party');
    expect(screen.queryByTestId('cf-entry-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('lease-partner-draft')).not.toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => String(url).includes('/concordatofacile/'))).toBe(false);
    // CF-DONE: nor is the server asked to move it on with a practice it has none of.
    expect(post).not.toHaveBeenCalled();
  });

  it('render_LeaseWithoutParties_ShowsEmptyPartiesMessage', async () => {
    mockLease(() => Promise.resolve({ data: buildDetail({ parties: [], events: [] }) }));

    renderPage('?tab=dati');

    expect(await screen.findByText('Nessuna parte registrata.')).toBeInTheDocument();
    expect(within(screen.getByTestId('lease-timeline')).queryAllByRole('listitem')).toHaveLength(0);
  });

  it('render_NotFound_ShowsNotFound', async () => {
    mockLease(() => Promise.reject(httpError(404, { code: 'lease_not_found' })));

    renderPage();

    expect(await screen.findByTestId('lease-not-found')).toBeInTheDocument();
    expect(screen.getByText('Contratto non trovato')).toBeInTheDocument();
    expect(screen.queryByTestId('lease-load-error')).not.toBeInTheDocument();
  });

  it('render_ServerError_ShowsLoadErrorNotNotFound_AndRetryLoadsTheLease', async () => {
    let calls = 0;
    mockLease(() => (++calls === 1 ? Promise.reject(httpError(500)) : Promise.resolve({ data: buildDetail() })));

    renderPage('?tab=dati');

    const alert = await screen.findByTestId('lease-load-error');
    expect(within(alert).getByText('Impossibile caricare il contratto. Riprova.')).toBeInTheDocument();
    expect(screen.queryByText('Contratto non trovato')).not.toBeInTheDocument();

    fireEvent.click(within(alert).getByRole('button', { name: 'Riprova' }));

    expect(await screen.findAllByTestId('lease-party')).toHaveLength(2);
  });

  it('render_Forbidden_ShowsPermissionErrorNotNotFound', async () => {
    mockLease(() => Promise.reject(httpError(403, { code: 'forbidden' })));

    renderPage();

    const alert = await screen.findByTestId('lease-load-error');
    expect(within(alert).getByText(i18n.t('apiErrors.forbidden'))).toBeInTheDocument();
    expect(screen.queryByText('Contratto non trovato')).not.toBeInTheDocument();
  });

  it('render_NetworkError_ShowsNetworkMessageNotNotFound', async () => {
    mockLease(() => Promise.reject(httpError()));

    renderPage();

    const alert = await screen.findByTestId('lease-load-error');
    expect(within(alert).getByText(i18n.t('apiErrors.network'))).toBeInTheDocument();
    expect(screen.queryByText('Contratto non trovato')).not.toBeInTheDocument();
  });

  it('render_HtmlFallbackBody_ShowsLoadErrorInsteadOfCrashing', async () => {
    mockLease(() => Promise.resolve({ data: HTML_FALLBACK }));

    renderPage();

    expect(await screen.findByTestId('lease-load-error')).toBeInTheDocument();
    expect(screen.queryByTestId('lease-party')).not.toBeInTheDocument();
  });
});
