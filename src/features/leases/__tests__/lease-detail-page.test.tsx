import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
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

function renderPage() {
  return renderAt('/app/long-rent/leases/lease-1', '/app/long-rent/leases/:id', createElement(LeaseDetailPage));
}

describe('LeaseDetailPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  it('render_Lease_ShowsMaskedPartiesTranslatedRolesAndTimeline', async () => {
    mockLease(() => Promise.resolve({ data: buildDetail() }));

    renderPage();

    const parties = await screen.findAllByTestId('lease-party');
    expect(parties).toHaveLength(2);
    const landlord = parties[0];
    expect(within(landlord).getByText('Mario Rossi')).toBeInTheDocument();
    expect(within(landlord).getByText('Locatore')).toBeInTheDocument();
    expect(within(landlord).getByText(/\*{12}501Z/)).toBeInTheDocument();
    expect(within(landlord).getByText('m***@example.com')).toBeInTheDocument();
    expect(within(parties[1]).getByText('Conduttore')).toBeInTheDocument();
    // Timeline with translated event types, never the raw enum value (A7-26).
    const events = screen.getAllByTestId('lease-event');
    expect(within(events[0]).getByText('Bozza creata')).toBeInTheDocument();
    expect(within(events[1]).getByText('Delega RLI registrata')).toBeInTheDocument();
    expect(screen.queryByText('RegistrationAuthorized')).not.toBeInTheDocument();
    expect(screen.getByText('Bozza')).toBeInTheDocument();
    expect(screen.queryByTestId('lease-load-error')).not.toBeInTheDocument();
  });

  it('render_EnglishUi_TranslatesRoleEventAndStatus', async () => {
    await i18n.changeLanguage('en');
    mockLease(() => Promise.resolve({ data: buildDetail({ status: 'Rejected' }) }));

    renderPage();

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

    renderPage();

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

    renderPage();

    await screen.findAllByTestId('lease-party');
    expect(screen.queryByTestId('lease-concordato-sections')).not.toBeInTheDocument();
  });

  it('render_LeaseWithoutParties_ShowsEmptyPartiesMessage', async () => {
    mockLease(() => Promise.resolve({ data: buildDetail({ parties: [], events: [] }) }));

    renderPage();

    expect(await screen.findByText('Nessuna parte registrata.')).toBeInTheDocument();
    expect(screen.queryByTestId('lease-event')).not.toBeInTheDocument();
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

    renderPage();

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
