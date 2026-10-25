import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { createElement } from 'react';
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

function mockLease(response: () => Promise<unknown>) {
  get.mockImplementation((url: string) =>
    url === '/leases/lease-1' ? response() : Promise.reject(httpError(404)),
  );
}

// The data of the lease are in the tab `dati`; a draft opens on the signature, which these tests stub.
function renderPage(search = '') {
  return renderAt(`/app/long-rent/leases/lease-1${search}`, '/app/long-rent/leases/:id', createElement(LeaseDetailPage));
}

// The same page with the backend flags a person would have (all off without a provider, as in the tests above).
function renderPageWithFlags(search: string, flags: Partial<FeatureFlags>) {
  const value = { flags: { ...DEFAULT_FEATURE_FLAGS, ...flags }, isLoading: false };
  return renderAt(
    `/app/long-rent/leases/lease-1${search}`,
    '/app/long-rent/leases/:id',
    createElement(FeatureFlagsContext.Provider, { value }, createElement(LeaseDetailPage)),
  );
}

/** A lease whose access to the ConcordatoFacile service is not active; the service answers 404 to anything else. */
function mockLeaseWithService(detail: Parameters<typeof buildDetail>[0]) {
  get.mockImplementation((url: string) => {
    if (url === '/leases/lease-1') return Promise.resolve({ data: buildDetail(detail) });
    if (url === '/leases/lease-1/concordatofacile/access') {
      return Promise.resolve({ data: { hasAccess: false, source: null, giftAvailable: false, giftConsumed: false } });
    }
    return Promise.reject(httpError(404));
  });
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
    await i18n.changeLanguage('it');
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

  it('render_ConcordatoLeaseWithIndicativeRange_ShowsTheServerRangeWithWarning', async () => {
    // LT-10 (A7-12, A7-23): the range the API computed at creation, indicative with Partial data, rent outside it.
    mockLease(() =>
      Promise.resolve({
        data: buildDetail({
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
        }),
      }),
    );

    renderPage('?tab=dati');

    const panel = await screen.findByTestId('concordato-assessment');
    expect(within(panel).getByTestId('concordato-assessment-indicative')).toHaveTextContent(
      i18n.t('leases.concordatoAssessment.indicative'),
    );
    expect(within(panel).getByTestId('concordato-assessment-outside')).toBeInTheDocument();
    expect(within(panel).getByText(/460,41/)).toBeInTheDocument();
    expect(screen.getByTestId('lease-type-regime')).toHaveTextContent('Canone concordato (3+2) · Regime ordinario');
    expect(screen.getByText(/2\.?700,00/)).toBeInTheDocument();
    // A7-24: calculator/guide/IMU only for a canone concordato contract.
    expect(screen.getByTestId('lease-concordato-sections')).toBeInTheDocument();
  });

  it('render_LiberoLease_HidesConcordatoCalculatorAndImuSections', async () => {
    // A7-24: the calculator, the attestation guidance and the IMU button applied to any regime before this fix.
    mockLease(() => Promise.resolve({ data: buildDetail() })); // contractType: 'Libero' by default

    renderPage('?tab=dati');

    await screen.findAllByTestId('lease-party');
    expect(screen.queryByTestId('lease-concordato-sections')).not.toBeInTheDocument();
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

    expect(await screen.findByTestId('lease-partner-draft')).toHaveTextContent('Bozza — in attesa del contratto del partner');
    expect(screen.getByTestId('lease-partner-proceed')).toBeDisabled();
    // The reference to give the partner is the id of this contract.
    expect(screen.getByDisplayValue('lease-1')).toBeInTheDocument();
    expect(screen.getByText(/Casa Trastevere · Roma · .* · Canone da definire/)).toBeInTheDocument();
    expect(screen.queryByText(/3000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/0,00\s€/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('lease-concordato-sections')).not.toBeInTheDocument();
  });

  // CF-FIX: the switch of the ConcordatoFacile service.
  it('render_ConcordatoDraftForThePartner_ServiceOn_ProceedOpensTheServicePage_AndTheComingSoonLineIsGone', async () => {
    mockLeaseWithService(partnerDraft());

    renderPageWithFlags('?tab=dati', { concordatoFacile: true });

    const proceed = await screen.findByTestId('lease-partner-proceed');
    expect(proceed).toBeEnabled();
    expect(proceed).toHaveAttribute('href', '/app/long-rent/leases/lease-1/concordatofacile');
    expect(screen.getByText(i18n.t('leases.partnerDraft.ready'))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('leases.partnerDraft.soon'))).not.toBeInTheDocument();
    // The reference to give the partner stays.
    expect(screen.getByDisplayValue('lease-1')).toBeInTheDocument();
    // One way in: the panel of the service is not laid next to the notice of a draft for the partner.
    expect(screen.queryByTestId('cf-entry-panel')).not.toBeInTheDocument();
  });

  it('render_ConcordatoLease_ServiceOff_ShowsNoPaymentPanelAndAsksNothingOfTheService', async () => {
    mockLeaseWithService({ contractType: 'Concordato' });

    renderPage('?tab=dati');

    await screen.findAllByTestId('lease-party');
    expect(screen.queryByTestId('cf-entry-panel')).not.toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => String(url).includes('/concordatofacile/'))).toBe(false);
  });

  it('render_ConcordatoLease_ServiceOn_ShowsThePaymentPanel', async () => {
    mockLeaseWithService({ contractType: 'Concordato' });

    renderPageWithFlags('?tab=dati', { concordatoFacile: true });

    expect(await screen.findByTestId('cf-entry-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('lease-partner-draft')).not.toBeInTheDocument();
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
