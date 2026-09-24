import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { LeasesPage } from '../leases-page';
import { buildSummary, HTML_FALLBACK, httpError, renderAt } from './lease-test-utils';

// The real leasesApi and ApiClient run: only the HTTP layer is replaced.
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const get = vi.mocked(axios.get);

function renderPage() {
  return renderAt('/app/long-rent/leases', '/app/long-rent/leases', createElement(LeasesPage));
}

describe('LeasesPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  it('render_RealisticLeases_ShowsCardsWithTranslatedStatusRentAndPartyCount', async () => {
    get.mockResolvedValue({
      data: [
        buildSummary(),
        buildSummary({
          id: 'lease-2',
          property: null,
          propertyId: 'abcdef12-0000-0000-0000-000000000000',
          status: 'PartiallySigned',
          fiscalRegime: 'CanoneConcordato',
          partyCount: 3,
        }),
      ],
    });

    renderPage();

    const cards = await screen.findAllByTestId('lease-card');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('Casa Trastevere')).toBeInTheDocument();
    // Every real status has a label: never the raw key "leases.statusLabel.SentToProvider" (A7-15).
    expect(within(cards[0]).getByText('Inviato al provider')).toBeInTheDocument();
    expect(within(cards[0]).getByText(/950,00\s€\/mese/)).toBeInTheDocument();
    expect(within(cards[0]).getByText('2')).toBeInTheDocument();
    expect(within(cards[1]).getByText('abcdef12')).toBeInTheDocument();
    expect(within(cards[1]).getByText('Firmato parzialmente')).toBeInTheDocument();
    expect(within(cards[1]).getByText('3')).toBeInTheDocument();
    expect(screen.queryByText(/leases\.statusLabel/)).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/leases', expect.objectContaining({ params: undefined }));
  });

  it('render_EnglishUi_ShowsEnglishStatusAndMonthlySuffix', async () => {
    await i18n.changeLanguage('en');
    get.mockResolvedValue({ data: [buildSummary({ status: 'RegistrationPending' })] });

    renderPage();

    const card = await screen.findByTestId('lease-card');
    expect(within(card).getByText('Registration pending')).toBeInTheDocument();
    expect(within(card).getByText(/\/mo$/)).toBeInTheDocument();
  });

  it('render_NoLeases_ShowsEmptyStateWithCreateAction', async () => {
    get.mockResolvedValue({ data: [] });

    renderPage();

    expect(await screen.findByText('Nessun contratto')).toBeInTheDocument();
    expect(screen.queryByTestId('leases-load-error')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Nuovo contratto' }).length).toBeGreaterThan(0);
  });

  it('render_HtmlFallbackBody_ShowsLoadErrorInsteadOfCrashing', async () => {
    // Regression: `/api/leases` answered by the SPA index.html crashed the page with
    // "items.map is not a function" (E2E L2 Vetrina AC12 redirected here).
    get.mockResolvedValue({ data: HTML_FALLBACK });

    renderPage();

    const alert = await screen.findByTestId('leases-load-error');
    expect(within(alert).getByText('Impossibile caricare i contratti. Riprova.')).toBeInTheDocument();
    expect(screen.queryByText('Nessun contratto')).not.toBeInTheDocument();
    expect(screen.queryByTestId('lease-card')).not.toBeInTheDocument();
  });

  it('render_ServerError_ShowsErrorNotEmptyState_AndRetryLoadsTheList', async () => {
    get.mockRejectedValueOnce(httpError(500, { code: 'internal_error', detail: 'NullReferenceException at ...' }));
    get.mockResolvedValueOnce({ data: [buildSummary()] });

    renderPage();

    const alert = await screen.findByTestId('leases-load-error');
    expect(within(alert).getByText('Impossibile caricare i contratti. Riprova.')).toBeInTheDocument();
    expect(screen.queryByText(/NullReferenceException/)).not.toBeInTheDocument();
    expect(screen.queryByText('Nessun contratto')).not.toBeInTheDocument();

    fireEvent.click(within(alert).getByRole('button', { name: 'Riprova' }));

    expect(await screen.findByTestId('lease-card')).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('render_NetworkError_ShowsTheNetworkMessage', async () => {
    get.mockRejectedValue(httpError());

    renderPage();

    const alert = await screen.findByTestId('leases-load-error');
    expect(within(alert).getByText(i18n.t('apiErrors.network'))).toBeInTheDocument();
    expect(screen.queryByText('Nessun contratto')).not.toBeInTheDocument();
  });

  it('render_Forbidden_ShowsThePermissionMessage', async () => {
    get.mockRejectedValue(httpError(403, { code: 'forbidden' }));

    renderPage();

    const alert = await screen.findByTestId('leases-load-error');
    expect(within(alert).getByText(i18n.t('apiErrors.forbidden'))).toBeInTheDocument();
  });
});
