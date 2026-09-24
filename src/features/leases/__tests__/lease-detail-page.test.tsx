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
